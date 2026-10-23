// The editor for the lists and settings at /admin/lists/<name>: builds the form from the field list, saves it as
// JSON and shows what needs fixing. Leaving with unsaved changes asks first (the browser's own leave page prompt,
// which is the one prompt a page cant replace with anything better).
(function () {
  "use strict";

  var form = document.querySelector("[data-admin-editor]");
  if (!form || !window.AdminFields) return;
  var F = window.AdminFields;
  var config = JSON.parse(form.querySelector("[data-editor-config]").textContent);
  var root = form.querySelector("[data-editor-root]");
  var statusLine = form.querySelector("[data-status]");
  var dirty = false;

  function changed() {
    if (!dirty) { dirty = true; statusLine.textContent = "Unsaved changes"; }
  }

  var built = config.root.type === "object"
    ? F.buildFields(config.root.fields, config.value, changed)
    : F.buildObjects(config.root, config.value, changed, { fixedLength: config.fixedLength });
  root.appendChild(built.node);

  window.addEventListener("beforeunload", function (event) {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });

  function showErrors(data) {
    var old = form.querySelector(".alert--error");
    if (old) old.remove();
    if (!data || (!data.errors && !data.error)) return;
    var box = F.errorBox(data.error || "Not saved", data.errors);
    form.insertBefore(box, root);
    box.focus();
  }

  function save(then) {
    statusLine.textContent = "Saving...";
    statusLine.classList.remove("is-error");
    window.RP.send(config.saveUrl, { value: built.get() }).then(function (result) {
      if (!result.ok) {
        statusLine.textContent = "Not saved";
        statusLine.classList.add("is-error");
        showErrors(result.data);
        return;
      }
      showErrors(null);
      dirty = false;
      statusLine.textContent = "Saved, it's on the site";
      if (then) then();
    });
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); save(); });
  if (new URLSearchParams(window.location.search).get("restored")) statusLine.textContent = "Restored, it's on the site";

  if (config.cvPdf) {
    var pdfButton = F.smallButton("Save, then make a new PDF", function () {
      save(function () {
        statusLine.textContent = "Making the PDF...";
        fetch("/admin/cv-pdf", { method: "POST", headers: { "X-CSRF-Token": window.RP.csrf }, credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (data) { statusLine.textContent = data.ok ? "PDF made, open /cv to download it." : data.error; });
      });
    });
    form.querySelector(".admin-editor__bar .cluster").appendChild(pdfButton);
  }
})();
