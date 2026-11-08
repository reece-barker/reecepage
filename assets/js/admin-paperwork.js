// The paperwork editor: the form on the left is built from the document kind's fields (admin-fields.js, same as
// the lists), and every change redraws the A4 preview on the right a moment later. It saves on its own a couple
// of seconds after you stop typing, and Ctrl or Cmd + S saves straight away. No popups, the status line says
// whats going on.
(function () {
  "use strict";

  var form = document.querySelector("[data-paperwork]");
  if (!form || !window.AdminFields) return;
  var F = window.AdminFields;
  var config = JSON.parse(form.querySelector("[data-editor-config]").textContent);
  var root = form.querySelector("[data-editor-root]");
  var frame = form.querySelector("[data-preview-frame]");
  var statusLine = form.querySelector("[data-status]");
  var dirty = false;
  var previewTimer = null;
  var saveTimer = null;
  var previewSeq = 0;
  var saving = false;

  var built = F.buildFields(config.fields, config.value, changed);
  root.appendChild(built.node);

  function changed() {
    dirty = true;
    statusLine.textContent = "Unsaved changes";
    statusLine.classList.remove("is-error");
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 350);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { save(); }, 2500);
  }

  // Redraws the preview and keeps the scroll position, so typing on page two doesnt jump back to page one
  function preview() {
    var seq = ++previewSeq;
    window.RP.send(config.previewUrl, { id: config.id, value: built.get() }).then(function (result) {
      if (seq !== previewSeq || !result.ok) return;
      var y = 0;
      try { y = frame.contentWindow.scrollY; } catch (e) { y = 0; }
      frame.addEventListener("load", function restore() {
        frame.removeEventListener("load", restore);
        try { frame.contentWindow.scrollTo(0, y); } catch (e) { /* a preview that didnt load, nothing to scroll */ }
      });
      frame.src = result.data.url;
    });
  }

  function save(then) {
    if (saving) return;
    saving = true;
    clearTimeout(saveTimer);
    statusLine.textContent = "Saving...";
    window.RP.send(config.saveUrl, { value: built.get() }).then(function (result) {
      saving = false;
      if (!result.ok) {
        statusLine.textContent = (result.data && result.data.error) || "Not saved, try again";
        statusLine.classList.add("is-error");
        return;
      }
      dirty = false;
      statusLine.textContent = "Saved";
      if (then) then();
    });
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); save(); });
  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); }
  });

  // The download buttons save first, so the PDF has what's on screen
  document.querySelectorAll("[data-download]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (!dirty) return;
      event.preventDefault();
      save(function () { window.location.href = link.href; });
    });
  });

  window.addEventListener("beforeunload", function (event) {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });

  preview();
})();
