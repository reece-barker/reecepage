// The editor's own blocks for Editor.js: picture or video, gallery, callout, button, and "kept as Markdown" for
// anythin the blocks cant show. Plus the media picker and the uploader they share.
//
// Pictures are re-made in the browser before they go up: no bigger than 2400 pixels, and without the hidden
// details a phone puts in a photo (like where it was taken). Smaller copies at 480, 960 and 1600 pixels go up
// with it so phones get a small file. Videos go up as they are.
//
//   RPBlocks.tools(context)   the tool classes for new EditorJS({ tools })
//   context = { library: Map(slug -> item), refreshLibrary(), changed() }
(function () {
  "use strict";

  var F = window.AdminFields;
  var el = F.el;

  var SIZES = [
    ["small", "Small"], ["medium", "Medium"], ["text", "Text width"], ["wide", "Wide"], ["full", "Edge to edge"]
  ];
  var ALIGNS = [["left", "Left"], ["center", "Centre"], ["right", "Right"]];
  var SIZE_NOTES = { wide: "Wider than the text on big screens", full: "Edge to edge on the site" };
  var MAX_SIDE = 2400;
  var VARIANT_WIDTHS = [480, 960, 1600];

  var ICONS = {
    image: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
    gallery: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
    callout: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="7" y="9" width="3" height="3" fill="currentColor"/><path d="M13 10.5h4"/></svg>',
    button: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M8 12h8"/></svg>',
    raw: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></svg>'
  };

  // Small helpers

  function segment(options, current, onPick, label) {
    var group = el("div", { className: "rp-segment", role: "group", "aria-label": label });
    var buttons = options.map(function (option) {
      var b = el("button", { type: "button", text: option[1], "aria-pressed": String(option[0] === current) });
      b.addEventListener("click", function () {
        buttons.forEach(function (other) { other.setAttribute("aria-pressed", String(other === b)); });
        onPick(option[0]);
      });
      group.appendChild(b);
      return b;
    });
    group.setDisabled = function (disabled) { buttons.forEach(function (b) { b.disabled = disabled; }); };
    return group;
  }

  function stop(event) { event.stopPropagation(); }

  /** Inputs inside a block shouldnt let Editor.js take Enter and Backspace for itself */
  function keepKeys(input) {
    input.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === "Backspace" || event.key === "Tab") event.stopPropagation(); });
    input.addEventListener("paste", stop);
    return input;
  }

  // Uploading: resize and clean pictures in the browser, then PUT them like the media page does

  function put(url, body, headers, onProgress) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("X-CSRF-Token", window.RP.csrf);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      Object.keys(headers || {}).forEach(function (name) { xhr.setRequestHeader(name, encodeURIComponent(headers[name])); });
      if (onProgress) xhr.upload.addEventListener("progress", function (event) { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); });
      xhr.onload = function () {
        var data;
        try { data = JSON.parse(xhr.responseText); } catch (error) { data = {}; }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, error: data.error || "The upload failed (status " + xhr.status + ")", item: data.item });
      };
      xhr.onerror = function () { resolve({ ok: false, error: "The connection dropped, nothing was saved." }); };
      xhr.send(body);
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }

  /** Draws a picture at a width and encodes it. Photos as JPEG, pictures with see through parts as PNG */
  function encode(bitmap, width, keepAlpha) {
    var height = Math.round(bitmap.height * (width / bitmap.width));
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext("2d");
    if (!keepAlpha) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return keepAlpha ? canvasBlob(canvas, "image/png") : canvasBlob(canvas, "image/jpeg", 0.86);
  }

  /** Every picture is redrawn, which drops the hidden location and camera details along the way */
  function preparePicture(file) {
    if (!window.createImageBitmap) return Promise.resolve({ main: file, variants: [] });
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bitmap) {
      var keepAlpha = /png|webp|avif/.test(file.type);
      var width = Math.min(bitmap.width, Math.round(MAX_SIDE * Math.min(1, bitmap.width / Math.max(bitmap.width, bitmap.height))));
      return encode(bitmap, width, keepAlpha).then(function (main) {
        var wanted = VARIANT_WIDTHS.filter(function (w) { return w < width * 0.85; });
        return Promise.all(wanted.map(function (w) { return encode(bitmap, w, keepAlpha); })).then(function (blobs) {
          return { main: main, variants: blobs.filter(Boolean) };
        });
      });
    }, function () {
      throw new Error("This browser cant open that picture. Save it as a JPEG or PNG and try again.");
    });
  }

  /**
   * Uploads a file to the media library and returns the new item. onStatus gets short progress messages.
   * Pictures in posts arent ticked for the media page, they show in the post either way
   */
  function upload(file, fields, onStatus) {
    var isVideo = /^video\//.test(file.type);
    var ready = isVideo ? Promise.resolve({ main: file, variants: [] }) : (onStatus("Getting the picture ready..."), preparePicture(file));
    return ready.then(function (prepared) {
      onStatus("Uploading...");
      return put("/admin/media/upload", prepared.main, { "X-Media-Title": fields.title, "X-Media-Alt": fields.alt, "X-Media-Caption": fields.caption || "" }, function (percent) {
        onStatus("Uploading, " + percent + "%");
      }).then(function (result) {
        if (!result.ok) throw new Error(result.error);
        var item = result.item;
        if (!prepared.variants.length) return item;
        onStatus("Making the smaller copies for phones...");
        return prepared.variants.reduce(function (chain, blob) {
          return chain.then(function () { return put("/admin/media/" + item.id + "/variant", blob, {}); });
        }, Promise.resolve()).then(function () { return item; });
      });
    });
  }

  // The media picker, a <dialog> over the editor

  function pick(context, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var chosen = [];
      var dialog = el("dialog", { className: "rp-picker", "aria-labelledby": "rp-picker-title" });
      var search = el("input", { className: "input", type: "search", placeholder: "Search by title", "aria-label": "Search the media library" });
      var grid = el("ul", { className: "rp-picker__grid", role: "list" });
      var useButton = el("button", { className: "button", type: "button", text: options.multiple ? "Add the chosen pictures" : "Use this one", disabled: true });
      var cancel = el("button", { className: "button button--secondary", type: "button", text: "Cancel" });
      dialog.appendChild(el("div", { className: "rp-picker__head" }, [el("h2", { id: "rp-picker-title", text: options.multiple ? "Choose pictures" : "Choose from the media library" }), search]));
      dialog.appendChild(grid);
      dialog.appendChild(el("div", { className: "rp-picker__foot" }, [cancel, useButton]));

      function draw() {
        grid.textContent = "";
        var needle = search.value.trim().toLowerCase();
        var items = Array.from(context.library.values()).filter(function (item) {
          if (options.picturesOnly && item.kind !== "image") return false;
          return !needle || (item.title + " " + item.alt).toLowerCase().indexOf(needle) >= 0;
        });
        if (!items.length) grid.appendChild(el("li", { text: context.library.size ? "Nothing matches." : "The media library is empty, upload something from the block instead." }));
        items.forEach(function (item) {
          var thumb = item.kind === "video"
            ? (item.poster ? el("img", { src: item.poster, alt: "" }) : el("span", { className: "rp-picker__video", text: "Video" }))
            : el("img", { src: item.src, alt: "", loading: "lazy" });
          var b = el("button", { type: "button", "aria-pressed": String(chosen.indexOf(item) >= 0) }, [thumb, el("span", { text: item.title })]);
          b.addEventListener("click", function () {
            var at = chosen.indexOf(item);
            if (options.multiple) {
              if (at >= 0) chosen.splice(at, 1); else chosen.push(item);
            } else {
              chosen = [item];
              grid.querySelectorAll("[aria-pressed]").forEach(function (other) { other.setAttribute("aria-pressed", "false"); });
            }
            b.setAttribute("aria-pressed", String(chosen.indexOf(item) >= 0));
            useButton.disabled = !chosen.length;
          });
          b.addEventListener("dblclick", function () { if (!options.multiple) finish(chosen); });
          grid.appendChild(el("li", {}, [b]));
        });
      }
      function finish(result) {
        dialog.close();
        dialog.remove();
        resolve(result);
      }
      search.addEventListener("input", draw);
      search.addEventListener("keydown", stop);
      cancel.addEventListener("click", function () { finish([]); });
      useButton.addEventListener("click", function () { finish(chosen); });
      dialog.addEventListener("cancel", function (event) { event.preventDefault(); finish([]); });
      document.body.appendChild(dialog);
      context.refreshLibrary().then(draw);
      draw();
      dialog.showModal();
      search.focus();
    });
  }

  // The upload form inside an empty picture block: choose or drop a file, describe it, upload

  function uploadPanel(context, onDone, accept) {
    var panel = el("div", { className: "rp-media__empty" });
    var status = el("p", { className: "form-status", role: "status", "aria-live": "polite" });
    var fileInput = el("input", { type: "file", accept: accept || "image/*,video/mp4,video/webm", className: "visually-hidden", tabindex: "-1" });
    var chooseFile = el("button", { className: "button button--small", type: "button", text: "Upload a file" });
    var fromLibrary = el("button", { className: "button button--secondary button--small", type: "button", text: "Choose from the library" });
    var hint = el("p", { className: "hint", text: "Or drop a picture or video here. Pictures are made web ready before they go up." });
    var fields = el("div", { className: "rp-media__upload-fields", hidden: true });
    var alt = keepKeys(el("input", { className: "input", type: "text", maxlength: "300", placeholder: "What the picture shows, for people who cant see it (needed)" }));
    var title = keepKeys(el("input", { className: "input", type: "text", maxlength: "160", placeholder: "Title in the media library" }));
    var send = el("button", { className: "button button--small", type: "button", text: "Upload" });
    fields.appendChild(el("label", { className: "label", text: "Description (alt text)" }));
    fields.appendChild(alt);
    fields.appendChild(el("label", { className: "label", text: "Title" }));
    fields.appendChild(title);
    fields.appendChild(el("div", { className: "cluster" }, [send]));
    panel.appendChild(el("div", { className: "cluster" }, [chooseFile, fromLibrary]));
    panel.appendChild(hint);
    panel.appendChild(fileInput);
    panel.appendChild(fields);
    panel.appendChild(status);
    var file = null;

    function choose(f) {
      if (!f) return;
      if (!/^(image|video)\//.test(f.type)) { status.textContent = "Only pictures and videos can go in here."; return; }
      file = f;
      fields.hidden = false;
      title.value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      alt.closest("div").firstChild.textContent = /^video/.test(f.type) ? "Description (optional for videos)" : "Description (alt text)";
      status.textContent = f.name + " chosen";
      alt.focus();
    }
    chooseFile.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () { choose(fileInput.files[0]); });
    fromLibrary.addEventListener("click", function () {
      pick(context, { picturesOnly: accept === "image/*" }).then(function (items) { if (items[0]) onDone(items[0]); });
    });
    panel.addEventListener("dragover", function (event) { event.preventDefault(); panel.classList.add("is-dragging"); });
    panel.addEventListener("dragleave", function () { panel.classList.remove("is-dragging"); });
    panel.addEventListener("drop", function (event) {
      event.preventDefault();
      event.stopPropagation();
      panel.classList.remove("is-dragging");
      choose(event.dataTransfer.files[0]);
    });
    send.addEventListener("click", function () {
      if (!file) return;
      if (/^image\//.test(file.type) && !alt.value.trim()) { status.textContent = "Describe the picture first, its needed for people who cant see it."; alt.focus(); return; }
      if (!title.value.trim()) { status.textContent = "Give it a title."; title.focus(); return; }
      send.disabled = true;
      upload(file, { title: title.value.trim(), alt: alt.value.trim() }, function (text) { status.textContent = text; })
        .then(function (item) {
          return context.refreshLibrary().then(function () { onDone(context.library.get(item.slug) || item); });
        })
        .catch(function (error) {
          status.textContent = error.message;
          send.disabled = false;
        });
    });
    panel.chooseFile = choose;
    return panel;
  }

  // Tools

  function tools(context) {
    function MediaTool(options) {
      this.data = Object.assign({ slug: "", size: "text", align: "center", caption: "", link: "" }, options.data || {});
      this.readOnly = options.readOnly;
      this.wrapper = null;
    }
    MediaTool.toolbox = { title: "Picture or video", icon: ICONS.image };
    MediaTool.pasteConfig = { files: { mimeTypes: ["image/*", "video/mp4", "video/webm"] } };
    MediaTool.prototype.render = function () {
      this.wrapper = el("div", { className: "rp-block rp-media" });
      this.draw();
      return this.wrapper;
    };
    MediaTool.prototype.onPaste = function (event) {
      if (event.type === "file") {
        this.pending = event.detail.file;
        this.data.slug = "";
        this.draw();
      }
    };
    MediaTool.prototype.draw = function () {
      var self = this;
      var w = this.wrapper;
      w.textContent = "";
      w.className = "rp-block rp-media rp-media--" + this.data.size + " rp-media--align-" + this.data.align;
      var item = this.data.slug ? context.library.get(this.data.slug) : null;
      if (!this.data.slug || (!item && !context.library.size)) {
        var panel = uploadPanel(context, function (chosen) {
          self.data.slug = chosen.slug;
          self.draw();
          context.changed();
        });
        w.appendChild(panel);
        if (this.pending) { panel.chooseFile(this.pending); this.pending = null; }
        return;
      }
      if (!item) {
        w.appendChild(el("p", { className: "alert alert--error", text: "The picture " + this.data.slug + " isnt in the media library anymore, it wont show on the site. Replace it or remove this block." }));
      }
      var stage = el("div", { className: "rp-media__stage", "data-size-note": SIZE_NOTES[this.data.size] || "" });
      if (item) {
        stage.appendChild(item.kind === "video"
          ? el("video", { src: item.src, poster: item.poster || false, preload: "metadata", muted: true, "aria-label": item.title })
          : el("img", { src: item.src, alt: item.alt || "" }));
      }
      var handle = el("button", { className: "rp-media__handle", type: "button", "aria-label": "Drag to make it smaller or bigger" });
      stage.appendChild(handle);
      w.appendChild(stage);

      // Dragging the handle snaps between small, medium and text width. Wide and edge to edge are buttons, they
      // go past the text so theres nowhere to drag to
      handle.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        var box = w.getBoundingClientRect();
        var start = stage.getBoundingClientRect().left;
        function move(e) {
          var ratio = Math.max(0.15, Math.min(1, (e.clientX - start) / box.width));
          stage.style.width = (ratio * 100) + "%";
        }
        function up(e) {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          stage.style.width = "";
          var ratio = (e.clientX - start) / box.width;
          var size = ratio < 0.42 ? "small" : ratio < 0.75 ? "medium" : "text";
          if (size !== self.data.size && !(size === "text" && (self.data.size === "wide" || self.data.size === "full"))) {
            self.data.size = size;
            self.draw();
            context.changed();
          }
        }
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
      });
      handle.addEventListener("keydown", function (event) {
        var order = SIZES.map(function (s) { return s[0]; });
        var at = order.indexOf(self.data.size);
        if (event.key === "ArrowLeft" && at > 0) self.data.size = order[at - 1];
        else if (event.key === "ArrowRight" && at < order.length - 1) self.data.size = order[at + 1];
        else return;
        event.preventDefault();
        event.stopPropagation();
        self.draw();
        context.changed();
        self.wrapper.querySelector(".rp-media__handle").focus();
      });

      var aligns = segment(ALIGNS, this.data.align, function (value) { self.data.align = value; self.draw(); context.changed(); }, "Position");
      aligns.setDisabled(this.data.size !== "small" && this.data.size !== "medium");
      var strip = el("div", { className: "rp-block__strip" }, [
        segment(SIZES, this.data.size, function (value) { self.data.size = value; self.draw(); context.changed(); }, "Size"),
        aligns
      ]);
      var replace = el("button", { className: "button button--secondary button--small", type: "button", text: "Replace" });
      replace.addEventListener("click", function () {
        pick(context, {}).then(function (items) { if (items[0]) { self.data.slug = items[0].slug; self.draw(); context.changed(); } });
      });
      strip.appendChild(replace);
      w.appendChild(strip);

      var caption = keepKeys(el("input", { className: "rp-block__caption", type: "text", placeholder: item && item.caption ? "Caption (empty uses: " + item.caption + ")" : "Caption (optional)", "aria-label": "Caption" }));
      caption.value = this.data.caption || "";
      caption.addEventListener("input", function () { self.data.caption = caption.value; context.changed(); });
      w.appendChild(caption);
      if (item && item.kind !== "video") {
        var link = keepKeys(el("input", { className: "rp-block__caption", type: "text", placeholder: "Link when clicked (optional), like /projects or https://...", "aria-label": "Link" }));
        link.value = this.data.link || "";
        link.addEventListener("input", function () { self.data.link = link.value.trim(); context.changed(); });
        w.appendChild(link);
      }
      if (item && item.kind === "image" && !item.alt) w.appendChild(el("p", { className: "hint", text: "This picture has no description yet, add one in the media library." }));
    };
    MediaTool.prototype.save = function () { return Object.assign({}, this.data); };
    MediaTool.prototype.validate = function (data) { return Boolean(data.slug); };

    function GalleryTool(options) {
      this.data = Object.assign({ slugs: [], columns: "3", caption: "" }, options.data || {});
    }
    GalleryTool.toolbox = { title: "Gallery", icon: ICONS.gallery };
    GalleryTool.prototype.render = function () {
      this.wrapper = el("div", { className: "rp-block rp-gallery" });
      this.draw();
      return this.wrapper;
    };
    GalleryTool.prototype.draw = function () {
      var self = this;
      var w = this.wrapper;
      w.textContent = "";
      var grid = el("div", { className: "rp-gallery__grid" });
      grid.style.setProperty("--cols", this.data.columns);
      this.data.slugs.forEach(function (slug, index) {
        var item = context.library.get(slug);
        var remove = el("button", { className: "button button--secondary button--small", type: "button", text: "Remove" });
        remove.addEventListener("click", function () { self.data.slugs.splice(index, 1); self.draw(); context.changed(); });
        grid.appendChild(el("div", { className: "rp-gallery__item" }, [item ? el("img", { src: item.src, alt: item.alt || "" }) : el("p", { className: "hint", text: slug + " is missing" }), remove]));
      });
      if (this.data.slugs.length) w.appendChild(grid);
      var add = el("button", { className: "button button--small" + (this.data.slugs.length ? " button--secondary" : ""), type: "button", text: this.data.slugs.length ? "Add pictures" : "Choose pictures" });
      add.addEventListener("click", function () {
        pick(context, { multiple: true, picturesOnly: true }).then(function (items) {
          items.forEach(function (item) { if (self.data.slugs.indexOf(item.slug) < 0) self.data.slugs.push(item.slug); });
          self.draw();
          context.changed();
        });
      });
      w.appendChild(el("div", { className: "rp-block__strip" }, [
        add,
        el("span", { text: "Across:" }),
        segment([["2", "2"], ["3", "3"], ["4", "4"]], String(this.data.columns), function (value) { self.data.columns = value; self.draw(); context.changed(); }, "Pictures across")
      ]));
      if (!this.data.slugs.length) w.appendChild(el("p", { className: "hint", text: "Upload the pictures with a picture block or on the media page first, then choose them here." }));
      var caption = keepKeys(el("input", { className: "rp-block__caption", type: "text", placeholder: "Caption for the whole gallery (optional)", "aria-label": "Gallery caption" }));
      caption.value = this.data.caption || "";
      caption.addEventListener("input", function () { self.data.caption = caption.value; context.changed(); });
      w.appendChild(caption);
    };
    GalleryTool.prototype.save = function () { return { slugs: this.data.slugs.slice(), columns: this.data.columns, caption: this.data.caption }; };
    GalleryTool.prototype.validate = function (data) { return data.slugs.length > 0; };

    function CalloutTool(options) {
      this.data = Object.assign({ kind: "note", title: "", text: "" }, options.data || {});
    }
    CalloutTool.toolbox = { title: "Callout", icon: ICONS.callout };
    CalloutTool.enableLineBreaks = true;
    CalloutTool.prototype.render = function () {
      var self = this;
      var box = el("div", { className: "callout callout--" + this.data.kind });
      var title = el("div", { className: "rp-callout__title", contenteditable: "true", role: "textbox", "data-placeholder": "Title (optional)", "aria-label": "Callout title" });
      title.innerHTML = this.data.title || "";
      var body = el("div", { className: "rp-callout__body", contenteditable: "true", role: "textbox", "aria-multiline": "true", "aria-label": "Callout text" });
      body.innerHTML = this.data.text || "";
      box.appendChild(title);
      box.appendChild(body);
      [title, body].forEach(function (node) { node.addEventListener("input", function () { context.changed(); }); });
      title.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); body.focus(); } });
      this.titleNode = title;
      this.bodyNode = body;
      var strip = el("div", { className: "rp-block__strip" }, [segment([["note", "Note"], ["tip", "Tip"], ["warning", "Warning"]], this.data.kind, function (value) {
        self.data.kind = value;
        box.className = "callout callout--" + value;
        context.changed();
      }, "Kind of callout")]);
      return el("div", { className: "rp-block" }, [box, strip]);
    };
    CalloutTool.prototype.save = function () {
      return { kind: this.data.kind, title: this.titleNode.textContent.trim(), text: this.bodyNode.innerHTML };
    };
    CalloutTool.sanitize = { title: false, text: { b: true, i: true, a: { href: true }, br: true, div: true, p: true, code: { class: "inline-code" } } };

    function ButtonTool(options) {
      this.data = Object.assign({ label: "", href: "", style: "primary" }, options.data || {});
    }
    ButtonTool.toolbox = { title: "Button", icon: ICONS.button };
    ButtonTool.prototype.render = function () {
      var self = this;
      var preview = el("span", { className: "button" + (this.data.style === "secondary" ? " button--secondary" : ""), text: this.data.label || "Button text" });
      var label = keepKeys(el("input", { className: "input", type: "text", maxlength: "60", placeholder: "Text on the button", "aria-label": "Button text" }));
      var href = keepKeys(el("input", { className: "input", type: "text", placeholder: "Where it goes, like /contact or https://...", "aria-label": "Button link" }));
      label.value = this.data.label;
      href.value = this.data.href;
      label.addEventListener("input", function () { self.data.label = label.value; preview.textContent = label.value || "Button text"; context.changed(); });
      href.addEventListener("input", function () { self.data.href = href.value.trim(); context.changed(); });
      return el("div", { className: "rp-block rp-button" }, [
        preview,
        el("div", { className: "rp-button__fields" }, [label, href]),
        el("div", { className: "rp-block__strip" }, [segment([["primary", "Filled"], ["secondary", "Outline"]], this.data.style, function (value) {
          self.data.style = value;
          preview.className = "button" + (value === "secondary" ? " button--secondary" : "");
          context.changed();
        }, "Button style")])
      ]);
    };
    ButtonTool.prototype.save = function () { return Object.assign({}, this.data); };
    ButtonTool.prototype.validate = function (data) { return Boolean(data.label && data.href); };

    // Anything the blocks cant show (a top level heading, a picture by address, raw HTML, code with a language)
    // stays exactly as it was written. Editable as text here, or in the Markdown view
    function RawTool(options) {
      this.data = { markdown: (options.data && options.data.markdown) || "" };
    }
    RawTool.toolbox = { title: "Markdown", icon: ICONS.raw };
    RawTool.enableLineBreaks = true;
    RawTool.prototype.render = function () {
      var self = this;
      var area = keepKeys(el("textarea", { className: "studio__markdown", rows: "4", "aria-label": "Markdown kept as it is", spellcheck: "false" }));
      area.value = this.data.markdown;
      area.addEventListener("input", function () { self.data.markdown = area.value; context.changed(); });
      this.area = area;
      return el("div", { className: "rp-block" }, [el("p", { className: "hint", text: "Kept as Markdown, the blocks cant show this one." }), area]);
    };
    RawTool.prototype.save = function () { return { markdown: this.area.value }; };
    RawTool.prototype.validate = function (data) { return Boolean(data.markdown.trim()); };

    return {
      header: { class: window.Header, inlineToolbar: ["bold", "italic", "link"], config: { levels: [2, 3, 4], defaultLevel: 2, placeholder: "Heading" } },
      list: { class: window.EditorjsList, inlineToolbar: true, config: { defaultStyle: "unordered" } },
      quote: { class: window.Quote, inlineToolbar: true, config: { quotePlaceholder: "The quote", captionPlaceholder: "Who said it (optional)" } },
      rpMedia: { class: MediaTool },
      rpGallery: { class: GalleryTool },
      rpCallout: { class: CalloutTool, inlineToolbar: true },
      rpButton: { class: ButtonTool },
      code: { class: window.CodeTool, config: { placeholder: "Code" } },
      table: { class: window.Table, inlineToolbar: true, config: { withHeadings: true, rows: 2, cols: 2 } },
      delimiter: { class: window.Delimiter },
      inlineCode: { class: window.InlineCode, shortcut: "CMD+E" },
      rpRaw: { class: RawTool }
    };
  }

  window.RPBlocks = { tools: tools, pick: pick, upload: upload };
})();
