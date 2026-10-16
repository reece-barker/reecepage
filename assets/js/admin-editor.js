// The editor behind /admin/content and /admin/data. It builds a form from the field list the server sends (the same
// one the server checks against), lets you add, remove and reorder items, previews Markdown, inserts media codes,
// and saves everything as JSON. Built with createElement and textContent only, so nothing typed is ever run as HTML.
(function () {
  "use strict";

  var form = document.querySelector("[data-admin-editor]");
  if (!form) return;
  var config = JSON.parse(form.querySelector("[data-editor-config]").textContent);
  var root = form.querySelector("[data-editor-root]");
  var statusLine = form.querySelector("[data-status]");
  var csrf = form.getAttribute("data-csrf");
  var editing = form.getAttribute("data-editing") === "true";
  var uid = 0;
  var dirty = false;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else if (key === "className") node.className = attrs[key];
      else if (attrs[key] !== false && attrs[key] != null) node.setAttribute(key, attrs[key] === true ? "" : attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function nextId() { uid += 1; return "f" + uid; }

  function markDirty() {
    if (!dirty) { dirty = true; statusLine.textContent = "Unsaved changes"; }
  }
  form.addEventListener("input", markDirty);

  function smallButton(label, onClick, extraClass) {
    var b = el("button", { type: "button", className: "button button--secondary button--small" + (extraClass ? " " + extraClass : ""), text: label });
    b.addEventListener("click", function () { onClick(); markDirty(); });
    return b;
  }

  /* Each builder returns { node, get } where get() reads the current value back out */

  function buildScalar(field, value) {
    var id = nextId();
    var input;
    var help = field.help ? el("p", { className: "hint", id: id + "-hint", text: field.help }) : null;
    if (field.type === "checkbox") {
      input = el("input", { type: "checkbox", id: id });
      input.checked = value === undefined ? field.default === true : value === true;
      var label = el("label", { className: "check", for: id }, [input, el("span", { text: field.label })]);
      return { node: el("div", { className: "field" }, [label, help]), get: function () { return input.checked; } };
    }
    if (field.type === "select") {
      input = el("select", { className: "select", id: id, "aria-describedby": help ? id + "-hint" : false });
      if (!field.required) input.appendChild(el("option", { value: "", text: "None" }));
      field.options.forEach(function (option) { input.appendChild(el("option", { value: option, text: option })); });
      input.value = value == null ? "" : String(value);
    } else if (field.type === "textarea" || field.type === "markdown") {
      input = el("textarea", { className: "textarea", id: id, rows: field.type === "markdown" ? 18 : 3, "aria-describedby": help ? id + "-hint" : false });
      input.value = value == null ? "" : String(value);
    } else {
      var types = { date: "date", url: "text", email: "email", tel: "tel" };
      input = el("input", { className: "input", id: id, type: types[field.type] || "text", "aria-describedby": help ? id + "-hint" : false, inputmode: field.number ? "numeric" : false, spellcheck: field.type === "url" || field.type === "email" ? "false" : false });
      input.value = value == null ? "" : String(value);
    }
    if (field.required) input.setAttribute("required", "");
    var labelText = field.label + (field.required ? "" : " (optional)");
    return {
      node: el("div", { className: "field" }, [el("label", { className: "label", for: id, text: labelText }), help, input]),
      get: function () { return input.value; }
    };
  }

  function buildStrings(field, value) {
    var list = el("ol", { className: "editor-strings", role: "list" });
    var getters = [];
    function addRow(text) {
      var id = nextId();
      var input = el("input", { className: "input", id: id, type: "text", "aria-label": field.label + " " + (getters.length + 1) });
      input.value = text || "";
      var entry = { get: function () { return input.value; } };
      var row = el("li", { className: "editor-strings__row" }, [input]);
      row.appendChild(smallButton("Remove", function () {
        getters.splice(getters.indexOf(entry), 1);
        row.remove();
      }));
      getters.push(entry);
      list.appendChild(row);
      return input;
    }
    (Array.isArray(value) ? value : []).forEach(function (text) { addRow(text); });
    var add = smallButton("Add a line", function () { addRow("").focus(); });
    var group = el("fieldset", { className: "editor-group" }, [el("legend", { className: "label", text: field.label }), field.help ? el("p", { className: "hint", text: field.help }) : null, list, add]);
    return { node: group, get: function () { return getters.map(function (g) { return g.get(); }); } };
  }

  function buildFields(fields, value) {
    var wrap = el("div", { className: "editor-fields" });
    var getters = {};
    fields.forEach(function (field) {
      var built = build(field, value ? value[field.name] : undefined);
      getters[field.name] = built.get;
      wrap.appendChild(built.node);
    });
    return { node: wrap, get: function () { var out = {}; Object.keys(getters).forEach(function (k) { out[k] = getters[k](); }); return out; } };
  }

  function buildObjects(field, value, opts) {
    opts = opts || {};
    var list = el("ol", { className: "editor-items", role: "list" });
    var entries = [];
    function titleOf(item) { return (item && field.itemLabel && item[field.itemLabel]) || "New item"; }
    function refreshNumbers() {
      entries.forEach(function (entry, i) { entry.number.textContent = (i + 1) + ". "; });
    }
    function addItem(item, atStart) {
      var inner = buildFields(field.fields, item);
      var number = el("span", { className: "editor-item__number" });
      var heading = el("span", { text: titleOf(item) });
      var summary = el("summary", {}, [number, heading]);
      var details = el("details", { className: "editor-item" }, [summary, inner.node]);
      if (!item || opts.open) details.open = true;
      var entry = { get: inner.get, node: null, number: number };
      var controls = el("div", { className: "editor-item__controls cluster" });
      if (!opts.fixedLength) {
        controls.appendChild(smallButton("Move up", function () { move(entry, -1); }));
        controls.appendChild(smallButton("Move down", function () { move(entry, 1); }));
        controls.appendChild(smallButton("Remove", function () {
          entries.splice(entries.indexOf(entry), 1);
          entry.node.remove();
          refreshNumbers();
        }, "button--danger"));
      }
      details.appendChild(controls);
      // Keep the summary line in step with the title while typing
      details.addEventListener("input", function () { heading.textContent = titleOf(inner.get()); });
      entry.node = el("li", {}, [details]);
      if (atStart) { entries.unshift(entry); list.insertBefore(entry.node, list.firstChild); } else { entries.push(entry); list.appendChild(entry.node); }
      refreshNumbers();
      return details;
    }
    function move(entry, step) {
      var i = entries.indexOf(entry);
      var j = i + step;
      if (j < 0 || j >= entries.length) return;
      entries.splice(i, 1);
      entries.splice(j, 0, entry);
      if (step < 0) list.insertBefore(entry.node, entries[j + 1].node); else list.insertBefore(entry.node, entries[j - 1].node.nextSibling);
      refreshNumbers();
      entry.node.querySelector("summary").focus();
    }
    (Array.isArray(value) ? value : []).forEach(function (item) { addItem(item); });
    var group = el("fieldset", { className: "editor-group" }, [el("legend", { className: "label", text: field.label }), field.help ? el("p", { className: "hint", text: field.help }) : null]);
    if (!opts.fixedLength) {
      group.appendChild(el("div", { className: "cluster" }, [
        smallButton("Add at the top", function () { addItem(null, true).querySelector("input, textarea, select").focus(); }),
        smallButton("Add at the bottom", function () { addItem(null, false).querySelector("input, textarea, select").focus(); })
      ]));
    }
    group.appendChild(list);
    return { node: group, get: function () { return entries.map(function (e) { return e.get(); }); } };
  }

  function build(field, value) {
    if (field.type === "objects") return buildObjects(field, value);
    if (field.type === "object") return buildFields(field.fields, value);
    if (field.type === "strings") return buildStrings(field, value);
    return buildScalar(field, value);
  }

  /* Markdown body with media insert and preview, only for projects and articles */
  function buildBody(text, media) {
    var id = nextId();
    var area = el("textarea", { className: "textarea editor-body", id: id, rows: 22, spellcheck: "true" });
    area.value = text || "";
    var preview = el("div", { className: "prose editor-preview", hidden: true, "aria-live": "polite" });
    var mediaSelect = el("select", { className: "select", id: id + "-media", "aria-label": "Picture or video to insert" });
    mediaSelect.appendChild(el("option", { value: "", text: media.length ? "Choose a picture or video" : "Nothing in the media library yet" }));
    media.forEach(function (m) { mediaSelect.appendChild(el("option", { value: m.code, text: (m.kind === "video" ? "Video: " : "Picture: ") + m.title + (m.published ? "" : " (not published)") })); });
    var insert = smallButton("Insert", function () {
      if (!mediaSelect.value) return;
      var at = area.selectionStart || area.value.length;
      var piece = "\n\n" + mediaSelect.value + "\n\n";
      area.value = area.value.slice(0, at) + piece + area.value.slice(at);
      area.focus();
    });
    var showPreview = smallButton("Preview", function () {
      if (!preview.hidden) { preview.hidden = true; showPreview.textContent = "Preview"; return; }
      fetch("/admin/preview", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ markdown: area.value }), credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          // The preview HTML comes from our own server's Markdown renderer, the same one the site uses
          preview.innerHTML = data.html || "";
          preview.hidden = false;
          showPreview.textContent = "Back to editing";
        });
    });
    var help = el("p", { className: "hint", id: id + "-hint", text: "Markdown: ## for a heading, **bold**, *italic*, [link text](https://...), - for a list. Media codes go on a line of their own." });
    area.setAttribute("aria-describedby", id + "-hint");
    var node = el("div", { className: "field editor-body-field" }, [
      el("label", { className: "label", for: id, text: "Text" }), help,
      el("div", { className: "cluster editor-toolbar" }, [mediaSelect, insert, showPreview]),
      area, preview
    ]);
    return { node: node, get: function () { return area.value; } };
  }

  var getValue;
  if (config.mode === "document") {
    var slugId = nextId();
    var slugInput = el("input", { className: "input", id: slugId, type: "text", spellcheck: "false", "aria-describedby": slugId + "-hint" });
    slugInput.value = config.slug || "";
    var fields = buildFields(config.fields, config.value);
    var body = buildBody(config.body, config.media || []);
    root.appendChild(el("div", { className: "editor-columns" }, [
      el("div", {}, [fields.node]),
      el("div", {}, [
        el("div", { className: "field" }, [
          el("label", { className: "label", for: slugId, text: "Address (optional for a new one)" }),
          el("p", { className: "hint", id: slugId + "-hint", text: "The last part of the link, lowercase with hyphens. Left empty it is made from the title. Changing it changes the link." }),
          slugInput
        ]),
        body.node
      ])
    ]));
    getValue = function () { return { slug: slugInput.value.trim(), originalSlug: config.slug || "", fields: fields.get(), body: body.get() }; };
    if (config.deleteUrl && editing) {
      var del = el("form", { method: "post", action: config.deleteUrl, className: "editor-delete" }, [
        el("input", { type: "hidden", name: "_csrf", value: csrf }),
        el("button", { type: "submit", className: "button button--secondary button--small button--danger", text: "Delete this file" })
      ]);
      del.addEventListener("submit", function (event) {
        var b = del.querySelector("button");
        if (b.getAttribute("data-armed") === "true") return;
        event.preventDefault();
        b.setAttribute("data-armed", "true");
        b.textContent = "Press again to delete for good";
        setTimeout(function () { b.removeAttribute("data-armed"); b.textContent = "Delete this file"; }, 5000);
      });
      form.after(del);
    }
  } else {
    var built = config.root.type === "object" ? buildFields(config.root.fields, config.value) : buildObjects(config.root, config.value, { fixedLength: config.fixedLength });
    root.appendChild(built.node);
    getValue = function () { return { value: built.get() }; };
    if (config.cvPdf) {
      var pdfButton = smallButton("Save, then make a new PDF", function () {
        save(function () {
          statusLine.textContent = "Making the PDF...";
          fetch("/admin/cv-pdf", { method: "POST", headers: { "X-CSRF-Token": csrf }, credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (data) { statusLine.textContent = data.ok ? "PDF made, open /cv to download it." : data.error; });
        });
      });
      form.querySelector(".admin-editor__bar .cluster").appendChild(pdfButton);
    }
  }

  function showErrors(data) {
    var old = form.querySelector(".editor-errors");
    if (old) old.remove();
    if (!data.errors || !data.errors.length) return;
    var list = el("ul", {}, data.errors.map(function (message) { return el("li", { text: message }); }));
    var box = el("div", { className: "alert alert--error editor-errors", role: "alert", tabindex: "-1" }, [el("div", {}, [el("h2", { className: "h-small", text: data.error }), list])]);
    form.insertBefore(box, root);
    box.focus();
  }

  function save(then) {
    if (!editing) return;
    statusLine.textContent = "Saving...";
    fetch(config.saveUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(getValue()), credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok && data.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) { statusLine.textContent = result.data.error || "Not saved"; showErrors(result.data); return; }
        showErrors({});
        dirty = false;
        statusLine.textContent = "Saved " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        if (config.mode === "document" && result.data.slug !== config.slug) {
          window.location.assign(config.afterSave + result.data.slug + "?saved=1");
          return;
        }
        if (then) then();
      })
      .catch(function () { statusLine.textContent = "Not saved, the server could not be reached"; });
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); save(); });
  if (new URLSearchParams(window.location.search).get("saved")) statusLine.textContent = "Saved";
})();
