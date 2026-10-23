// The editor for posts, pages, projects, tools and the legal pages. Writing on the left (blocks, Markdown, or the
// template for the legal pages), the live preview and the details on the right. Markdown is what gets saved, the
// blocks are turned into it with admin-markdown.js.
//
// Saving: Save draft keeps it off the site, Publish puts it on (or schedules it), Update saves changes to
// something allready published. Changes are autosaved every half a minute, and for something already published an
// autosave never touches the site, it only keeps a copy that is offered back if the tab closes before saving.
(function () {
  "use strict";

  var studio = document.querySelector("[data-studio]");
  if (!studio) return;
  var F = window.AdminFields;
  var config = JSON.parse(studio.querySelector("[data-editor-config]").textContent);
  var marked = window.marked;
  var MD = window.RPMarkdown;

  var titleInput = studio.querySelector("[data-title]");
  var canvas = studio.querySelector("[data-canvas]");
  var statusLine = studio.querySelector("[data-status]");
  var stateLine = studio.querySelector("[data-state]");
  var alerts = studio.querySelector("[data-alerts]");
  var draftButton = studio.querySelector('[data-action="draft"]');
  var mainButton = studio.querySelector('[data-action="publish"]');
  var slugInput = studio.querySelector("[data-slug]");
  var publishAtInput = studio.querySelector("[data-publish-at]");
  var frame = studio.querySelector("[data-preview-frame]");
  var frameWrap = studio.querySelector("[data-frame-wrap]");
  var previewStatus = studio.querySelector("[data-preview-status]");
  var modeGroup = studio.querySelector("[data-mode-group]");

  var entry = config.entry;
  var dirty = false;
  var saving = false;
  var slugTouched = Boolean(entry);
  var mode = config.editor === "template" ? "template" : "blocks";
  var editor = null;
  var markdownArea = null;
  var previewKey = null;
  var previewTimer = null;
  var autosaveTimer = null;
  var library = new Map();
  var lastSavedAt = null;
  // Nothing reads the text untill the editor has started, the preview and autosave wait for this
  var ready = false;

  // Small helpers

  function say(text, isError) {
    statusLine.textContent = text;
    statusLine.classList.toggle("is-error", Boolean(isError));
  }

  function clock(date) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function showAlert(title, errors, kind, actions) {
    alerts.textContent = "";
    if (!title) return;
    var box = kind === "note"
      ? F.el("div", { className: "alert alert--note", role: "status" }, [F.el("div", {}, [F.el("p", { text: title })])])
      : F.errorBox(title, errors);
    if (actions) box.firstChild.appendChild(F.el("div", { className: "cluster" }, actions));
    alerts.appendChild(box);
    if (kind !== "note") box.focus();
  }

  function slugify(text) {
    return String(text || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  // datetime-local works in your own time zone, the server gets UTC
  function toLocalInput(iso) {
    if (!iso) return "";
    var date = new Date(iso);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }
  function fromLocalInput(value) {
    if (!value) return "";
    var date = new Date(value);
    return isNaN(date.getTime()) ? "" : date.toISOString();
  }

  // Whether theres anythin unsaved is worked out by comparing with what was last saved, not by counting change
  // events: Editor.js reports changes a moment late, sometimes after a save, which would say "unsaved" wrongly
  var savedSnapshot = null;
  var checkTimer = null;
  function snapshot() {
    return payload("").then(function (body) {
      return JSON.stringify([body.title, body.slug, body.meta, body.body, publishAtInput.value]);
    });
  }
  function changed() {
    if (!ready) return;
    clearTimeout(checkTimer);
    checkTimer = setTimeout(function () {
      snapshot().then(function (now) {
        var differs = now !== savedSnapshot;
        if (differs && !dirty) say("Unsaved changes");
        if (!differs && dirty) say("No unsaved changes");
        dirty = differs;
        if (differs) {
          schedulePreview();
          scheduleAutosave();
        }
      });
    }, 250);
  }

  // The title grows with what you type, like the heading it will become
  function fitTitle() {
    titleInput.style.height = "auto";
    titleInput.style.height = titleInput.scrollHeight + "px";
  }

  // Details panel

  // The summary or intro line shows under the title on the page, so its written there too instead of hiding in
  // Details. The rest of the details get a row of small chips under it, the same things the page shows up top
  var LEDE_NAMES = ["lead", "summary"];
  var ledeField = config.editor === "template" ? null : config.fields.filter(function (f) { return LEDE_NAMES.indexOf(f.name) !== -1; })[0];
  var ledeInput = studio.querySelector("[data-lede]");
  var factsBox = studio.querySelector("[data-facts]");
  var detailFields = config.fields.filter(function (f) { return f !== ledeField; });
  var fields = F.buildFields(detailFields, entry ? entry.meta : {}, function () { renderFacts(); changed(); });
  studio.querySelector("[data-fields]").appendChild(F.el("div", { className: "studio__group" }, [F.el("h2", { text: "Details" }), fields.node]));
  if (ledeField) {
    studio.querySelector("[data-lede-wrap]").hidden = false;
    studio.querySelector("[data-lede-label]").textContent = ledeField.label;
    ledeInput.placeholder = ledeField.name === "lead" ? "An intro line under the title (optional)" : "A summary in one or two sentences, shown under the title and in lists";
    if (ledeField.max) ledeInput.maxLength = ledeField.max;
    ledeInput.value = entry && entry.meta && entry.meta[ledeField.name] ? entry.meta[ledeField.name] : "";
    ledeInput.addEventListener("input", function () { fitLede(); changed(); });
    ledeInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (editor && editor.blocks.getBlocksCount()) editor.caret.setToFirstBlock("start"); else if (markdownArea) markdownArea.focus();
      }
    });
  }
  function fitLede() {
    ledeInput.style.height = "auto";
    ledeInput.style.height = ledeInput.scrollHeight + "px";
  }
  function metaNow() {
    var meta = fields.get();
    if (ledeField) meta[ledeField.name] = ledeInput.value;
    return meta;
  }

  // The chips: what the page shows next to the title, each one opens Details
  var FACTS = {
    writing: function (m) { return [m.date ? "Published " + m.date : "Dated the day it goes live", m.updated ? "Updated " + m.updated : null].concat(m.tags || []); },
    projects: function (m) { return [m.branch ? ({ code: "Code", earth: "Earth", faith: "People" }[m.branch] || m.branch) : null, m.kind, m.status, m.period, m.featured ? "On the home page" : null]; },
    tools: function (m) { return [m.status]; },
    pages: function () { return []; }
  };
  function renderFacts() {
    var make = FACTS[config.type];
    if (!make) return;
    var meta = fields.get();
    var chips = make(meta).filter(function (text) { return text && String(text).trim(); });
    var todo = (meta.todo || []).filter(function (t) { return t && t.trim(); });
    factsBox.textContent = "";
    chips.forEach(function (text) {
      var chip = F.el("button", { type: "button", className: "studio__fact", text: String(text) });
      chip.addEventListener("click", function () { showPane("details"); });
      factsBox.appendChild(chip);
    });
    var edit = F.el("button", { type: "button", className: "studio__fact studio__fact--edit", text: chips.length ? "Edit details" : "Add details" });
    edit.addEventListener("click", function () { showPane("details"); });
    if (config.type !== "pages") factsBox.appendChild(edit);
    if (todo.length) {
      var note = F.el("div", { className: "studio__todo" }, [
        F.el("strong", { text: "Still missing (only you see this)" }),
        F.el("ul", {}, todo.map(function (t) { return F.el("li", { text: t }); }))
      ]);
      factsBox.appendChild(note);
    }
    factsBox.hidden = !factsBox.firstChild;
  }
  if (config.fixed) studio.querySelector("[data-address-group]").hidden = true;
  slugInput.value = entry ? entry.slug : "";
  studio.querySelector("[data-slug-hint]").textContent = "The address is " + config.publicBase.replace("SLUG", "...") + ". Made from the title if you leave it empty. Changing it on something published breaks old links to it.";
  slugInput.addEventListener("input", function () { slugTouched = true; changed(); });
  titleInput.value = entry ? entry.title : "";
  fitTitle();
  titleInput.addEventListener("input", function () {
    fitTitle();
    if (!slugTouched && !config.fixed) slugInput.value = slugify(titleInput.value);
    changed();
  });
  titleInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (editor && editor.blocks.getBlocksCount()) editor.caret.setToFirstBlock("start"); else if (markdownArea) markdownArea.focus();
    }
  });
  publishAtInput.value = entry && entry.state === "scheduled" ? toLocalInput(entry.publishAt) : "";
  publishAtInput.addEventListener("input", function () { updateButtons(); changed(); });

  // Buttons and the state line follow what the entry is right now

  function updateButtons() {
    var state = entry ? entry.state : "new";
    var future = publishAtInput.value && new Date(publishAtInput.value).getTime() > Date.now();
    studio.querySelector("[data-publish-group]").hidden = config.fixed || state === "published";
    if (config.fixed) {
      draftButton.hidden = true;
      mainButton.textContent = "Save";
      mainButton.dataset.action = "update";
    } else if (state === "published") {
      draftButton.textContent = "Switch to draft";
      mainButton.textContent = "Update";
      mainButton.dataset.action = "update";
    } else if (state === "scheduled") {
      draftButton.textContent = "Switch to draft";
      mainButton.textContent = future ? "Reschedule" : "Publish now";
      mainButton.dataset.action = "publish";
    } else {
      draftButton.textContent = "Save draft";
      mainButton.textContent = future ? "Schedule" : "Publish";
      mainButton.dataset.action = "publish";
    }
    if (entry) {
      var label = entry.state === "scheduled" ? "Scheduled for " + window.RP.formatTime(entry.publishAt) : entry.stateLabel;
      stateLine.textContent = "";
      stateLine.appendChild(F.el("span", { className: "pill pill--" + entry.state, text: label }));
    }
  }

  // Writing: blocks, Markdown or the template

  function currentBody() {
    if (mode === "blocks" || !markdownArea) return editor.save().then(function (data) { return MD.blocksToMarkdown(data.blocks); });
    return Promise.resolve(markdownArea.value);
  }

  var MARKDOWN_HELP = [
    ["## Heading", "a heading (### and #### for smaller ones)"],
    ["**bold** *italic*", "bold and italic"],
    ["[text](https://...)", "a link"],
    ["- item", "a list, 1. for a numbered one, - [ ] for a checklist"],
    ["> quote", "a quote, or :::quote cite=\"Name\" ... ::: with who said it"],
    ["[[media:slug size=wide]]", "a picture or video, sizes small medium text wide full, align=left or right for small and medium"],
    ["[[gallery:a,b,c columns=3]]", "pictures side by side"],
    ["[[button href=\"/contact\" label=\"Say hello\"]]", "a button"],
    [":::note title=\"...\" ... :::", "a callout, also :::tip and :::warning"]
  ];

  function showMarkdown(text) {
    markdownArea = F.el("textarea", { className: "studio__markdown", spellcheck: "true", "aria-label": mode === "template" ? "Template" : "Text in Markdown" });
    markdownArea.value = text;
    markdownArea.addEventListener("input", changed);
    markdownArea.addEventListener("keydown", function (event) {
      // Tab puts two spaces in, Shift Tab still leaves the box for keyboard users
      if (event.key === "Tab" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        var s = markdownArea.selectionStart;
        markdownArea.setRangeText("  ", s, markdownArea.selectionEnd, "end");
        changed();
      }
    });
    canvas.appendChild(markdownArea);
    if (mode === "template") {
      canvas.appendChild(F.el("p", { className: "studio__markdown-help", text: "This is the page's Handlebars template. {{legal.owner.email}} and the other {{...}} parts are filled in from the settings, keep them as they are. Every save is checked first, a mistake in the template is shown here and nothing is saved." }));
      return;
    }
    var help = F.el("details", { className: "studio__markdown-help" }, [F.el("summary", { text: "Markdown cheat sheet" })]);
    var list = F.el("dl");
    MARKDOWN_HELP.forEach(function (row) {
      list.appendChild(F.el("dt", {}, [F.el("code", { text: row[0] })]));
      list.appendChild(F.el("dd", { text: row[1] }));
    });
    help.appendChild(list);
    canvas.appendChild(help);
  }

  function startBlocks(markdown) {
    var holder = F.el("div", { id: "studio-blocks" });
    canvas.appendChild(holder);
    var context = { library: library, refreshLibrary: loadLibrary, changed: changed };
    editor = new window.EditorJS({
      holder: holder,
      data: { blocks: MD.markdownToBlocks(markdown, marked) },
      tools: window.RPBlocks.tools(context),
      inlineToolbar: ["bold", "italic", "link", "inlineCode"],
      placeholder: "Start writing, or press / or the + for a heading, picture, gallery, callout...",
      style: { nonce: document.querySelector("meta[property=csp-nonce]").content },
      minHeight: 120,
      onChange: function () { changed(); }
    });
    return editor.isReady;
  }

  // In the block menu, Enter picks the first match of what you typed ("/head" then Enter makes a heading).
  // Editor.js only picks one after Arrow Down, which nobody expects
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || !event.target.closest || !event.target.closest(".cdx-search-field__input, .ce-popover__search")) return;
    var popover = event.target.closest(".ce-popover");
    if (!popover || popover.querySelector(".ce-popover-item--focused")) return;
    var first = popover.querySelector(".ce-popover-item:not(.ce-popover-item--hidden)");
    if (!first) return;
    event.preventDefault();
    event.stopPropagation();
    first.click();
  }, true);

  function setMode(next) {
    if (next === mode || saving) return Promise.resolve();
    return currentBody().then(function (markdown) {
      if (next === "markdown") {
        studio.querySelector("#studio-blocks").hidden = true;
        showMarkdown(markdown);
        mode = next;
        markdownArea.focus();
      } else {
        var blocks = MD.markdownToBlocks(markdownArea.value, marked);
        markdownArea.nextSibling && markdownArea.nextSibling.remove();
        markdownArea.remove();
        markdownArea = null;
        // The mode has to flip before rendering, Editor.js fires its change event while it renders and that reads
        // the body back, with the textarea already gone it would of crashed
        mode = next;
        studio.querySelector("#studio-blocks").hidden = false;
        return editor.render({ blocks: blocks });
      }
    }).then(function () {
      mode = next;
      modeGroup.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === next)); });
      try { localStorage.setItem("rp-editor-mode", next); } catch (e) { /* Not remembered, thats fine */ }
    });
  }

  // The media library, the picture blocks look up their files in it

  function loadLibrary() {
    return fetch(config.urls.media, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        library.clear();
        (data.items || []).forEach(function (item) { library.set(item.slug, item); });
      })
      .catch(function () { /* The blocks show "missing" instead, saving still works */ });
  }

  // Saving

  function payload(action) {
    return currentBody().then(function (body) {
      return {
        id: entry ? entry.id : undefined,
        action: action,
        title: titleInput.value,
        slug: slugInput.value,
        meta: metaNow(),
        body: body,
        publishAt: action === "publish" ? fromLocalInput(publishAtInput.value) : "",
        baseUpdatedAt: entry ? entry.updatedAt : undefined
      };
    });
  }

  function save(action, quiet) {
    if (saving || !ready) return Promise.resolve(false);
    saving = true;
    clearTimeout(autosaveTimer);
    if (!quiet) say(action === "publish" ? "Publishing..." : "Saving...");
    return payload(action).then(function (built) {
      return window.RP.send(config.urls.save, built);
    }).then(function (result) {
      saving = false;
      if (!result.ok) {
        if (quiet) { say("Autosave didnt work, press Save draft to try yourself", true); return false; }
        say(result.data.error || "Not saved", true);
        showAlert(result.data.error || "Not saved", result.data.errors);
        return false;
      }
      showAlert(null);
      var wasNew = !entry;
      if (!result.data.autosavedOnly) entry = result.data.entry;
      // An autosave of something published only keeps a copy, the site still needs Update, so it stays unsaved
      dirty = Boolean(result.data.autosavedOnly);
      lastSavedAt = new Date();
      if (wasNew && entry) {
        history.replaceState(null, "", "/admin/" + config.type + "/" + entry.id);
        slugTouched = true;
      }
      if (entry) slugInput.value = entry.slug;
      // What was just saved is the new "nothing to save" point
      if (!result.data.autosavedOnly) takeSnapshot();
      updateButtons();
      var at = clock(lastSavedAt);
      if (quiet) say(result.data.autosavedOnly ? "Changes kept at " + at + ", the site still shows the published version" : "Autosaved at " + at);
      else if (action === "publish" && entry.state === "scheduled") say("Scheduled for " + window.RP.formatTime(entry.publishAt));
      else if (action === "publish") say("Published at " + at);
      else if (action === "update") say("Updated at " + at + ", it's on the site");
      else say(entry.state === "draft" ? "Draft saved at " + at : "Saved at " + at);
      return true;
    });
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      if (!ready || !dirty || saving || config.fixed) return;
      if (!entry && !titleInput.value.trim()) return;
      save("autosave", true);
    }, 30000);
  }

  draftButton.addEventListener("click", function () { save("draft"); });
  mainButton.addEventListener("click", function () { save(mainButton.dataset.action); });
  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save(entry && entry.state !== "draft" ? "update" : config.fixed ? "update" : "draft");
    }
  });
  window.addEventListener("beforeunload", function (event) {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });

  // The live preview: what the editor has right now goes to the server, the frame loads the real page with it

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 700);
  }

  function refreshPreview() {
    if (!ready) return Promise.resolve();
    previewStatus.textContent = "Updating...";
    return payload("preview").then(function (body) {
      body.type = config.type;
      body.key = previewKey;
      return window.RP.send(config.urls.preview, body);
    }).then(function (result) {
      if (!result.ok) { previewStatus.textContent = "The preview couldnt be updated"; return; }
      previewKey = result.data.key;
      var scroll = 0;
      try { scroll = frame.contentWindow.scrollY || 0; } catch (e) { scroll = 0; }
      frame.onload = function () {
        try { frame.contentWindow.scrollTo(0, scroll); } catch (e) { /* A different origin cant happen here, but just in case */ }
        previewStatus.textContent = "Preview updated " + clock(new Date());
      };
      frame.src = result.data.url + "?t=" + Date.now();
    });
  }

  // Phone, fit or desktop width. Desktop is drawn 1280 wide and scaled down to fit the panel
  var width = "fit";
  function layoutFrame() {
    frameWrap.classList.toggle("is-phone", width === "phone");
    if (width === "desktop") {
      var scale = frameWrap.clientWidth / 1280;
      frame.style.width = "1280px";
      frame.style.height = (frameWrap.clientHeight / scale) + "px";
      frame.style.transform = "scale(" + scale + ")";
    } else {
      frame.style.width = "";
      frame.style.height = "";
      frame.style.transform = "";
    }
  }
  studio.querySelectorAll("[data-width]").forEach(function (button) {
    button.addEventListener("click", function () {
      width = button.dataset.width;
      studio.querySelectorAll("[data-width]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === button)); });
      layoutFrame();
    });
  });
  if (window.ResizeObserver) new ResizeObserver(layoutFrame).observe(frameWrap);

  // Tabs: on a narrow screen Write, Preview and Details take turns, on a wide one Preview and Details share the side

  var wide = window.matchMedia("(min-width: 75rem)");
  var panes = { write: studio.querySelector('[data-pane="write"]'), preview: studio.querySelector('[data-pane="preview"]'), details: studio.querySelector('[data-pane="details"]') };
  var current = "write";
  var side = "preview";
  function showPane(name) {
    if (wide.matches) {
      if (name === "write") return;
      side = name;
      panes.write.hidden = false;
      panes.preview.hidden = name !== "preview";
      panes.details.hidden = name !== "details";
    } else {
      current = name;
      Object.keys(panes).forEach(function (key) { panes[key].hidden = key !== name; });
    }
    studio.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === (wide.matches ? "write" : current))); });
    studio.querySelectorAll("[data-side-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.sideTab === side)); });
    if (name === "preview") { layoutFrame(); if (!frame.src) refreshPreview(); }
  }
  studio.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { showPane(b.dataset.tab); }); });
  studio.querySelectorAll("[data-side-tab]").forEach(function (b) { b.addEventListener("click", function () { showPane(b.dataset.sideTab); }); });
  function applyLayout() {
    if (wide.matches) showPane(side); else showPane(current);
  }
  wide.addEventListener("change", applyLayout);
  applyLayout();

  // An autosave newer than the saved version, from a tab that closed before saving

  if (config.autosave) {
    var restore = F.el("button", { className: "button button--small", type: "button", text: "Bring those changes back" });
    var dismiss = F.el("button", { className: "button button--secondary button--small", type: "button", text: "Keep the saved version" });
    showAlert("There are changes from " + window.RP.formatTime(config.autosave.createdAt) + " that were never saved.", null, "note", [restore, dismiss]);
    restore.addEventListener("click", function () {
      titleInput.value = config.autosave.title;
      fitTitle();
      showAlert(null);
      var body = config.autosave.body;
      var done = mode === "blocks" ? editor.render({ blocks: MD.markdownToBlocks(body, marked) }) : Promise.resolve(markdownArea.value = body);
      Promise.resolve(done).then(function () { changed(); say("Changes brought back, save to keep them"); });
    });
    dismiss.addEventListener("click", function () { showAlert(null); });
  }

  // Start

  var body = entry ? entry.body : "";
  // A new one starts in the title straight away, not once the blocks have loaded, by then you might be typing
  // somewhere else and the focus would jump away from under you
  if (!entry) titleInput.focus();
  updateButtons();
  renderFacts();
  if (ledeField) requestAnimationFrame(fitLede);
  function takeSnapshot() {
    return snapshot().then(function (now) { savedSnapshot = now; });
  }

  if (mode === "template") {
    showMarkdown(body);
    ready = true;
    takeSnapshot();
    refreshPreview();
  } else {
    modeGroup.hidden = false;
    modeGroup.querySelectorAll("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
    loadLibrary().then(function () { return startBlocks(body); }).then(function () {
      ready = true;
      // The editor tidies the text a little as it reads it in, so the starting point is what it gives back
      return takeSnapshot();
    }).then(function () {
      var saved;
      try { saved = localStorage.getItem("rp-editor-mode"); } catch (e) { saved = null; }
      return saved === "markdown" ? setMode("markdown") : null;
    }).then(function () {
      refreshPreview();
    });
  }
  if (new URLSearchParams(location.search).get("notice") === "restored") say("The earlier version is back");
})();
