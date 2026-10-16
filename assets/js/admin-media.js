// The upload screen on /admin/media. Files go up as the request body (no multipart), with the text fields in
// headers, so the server can stream big videos straight to disk. Only loaded on that page.
(function () {
  "use strict";

  function put(url, file, csrf, headers, onProgress) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("X-CSRF-Token", csrf);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      Object.keys(headers || {}).forEach(function (name) { xhr.setRequestHeader(name, encodeURIComponent(headers[name])); });
      if (onProgress) xhr.upload.addEventListener("progress", function (event) { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); });
      xhr.onload = function () {
        var body;
        try { body = JSON.parse(xhr.responseText); } catch (error) { body = {}; }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, error: body.error || "The upload failed (status " + xhr.status + ")", item: body.item });
      };
      xhr.onerror = function () { resolve({ ok: false, error: "The connection dropped, nothing was saved" }); };
      xhr.send(file);
    });
  }

  var form = document.querySelector("[data-media-upload]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = form.querySelector("[data-upload-status]");
      var progress = form.querySelector("[data-upload-progress]");
      var button = form.querySelector("[data-submit]");
      var file = form.elements.file.files[0];
      if (!file) { status.textContent = "Choose a file first."; form.elements.file.focus(); return; }
      if (!form.elements.title.value.trim()) { status.textContent = "Give it a title."; form.elements.title.focus(); return; }
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
      progress.hidden = false;
      status.textContent = "Uploading " + file.name + "...";
      put("/admin/media/upload", file, form.getAttribute("data-csrf"), {
        "X-Media-Title": form.elements.title.value,
        "X-Media-Alt": form.elements.alt.value,
        "X-Media-Caption": form.elements.caption.value,
        "X-Media-Credit": form.elements.credit.value
      }, function (percent) { progress.value = percent; }).then(function (result) {
        button.removeAttribute("aria-busy");
        button.disabled = false;
        if (!result.ok) { status.textContent = result.error; progress.hidden = true; return; }
        status.textContent = "Uploaded. It is not published yet, tick Published below and save.";
        window.location.assign("/admin/media?saved=1#title-" + result.item.id);
      });
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-media-extra]"), function (extra) {
    extra.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = extra.querySelector("input[type=file]");
      var status = extra.querySelector(".form-status");
      if (!input.files[0]) { status.textContent = "Choose a file first."; return; }
      status.textContent = "Uploading...";
      var url = "/admin/media/" + extra.getAttribute("data-id") + "/" + extra.getAttribute("data-media-extra");
      put(url, input.files[0], extra.getAttribute("data-csrf")).then(function (result) {
        status.textContent = result.ok ? "Done." : result.error;
        if (result.ok) window.location.assign("/admin/media?saved=1");
      });
    });
  });

  // Deleting asks for a second press on the same button instead of a browser pop up
  Array.prototype.forEach.call(document.querySelectorAll("[data-confirm-delete]"), function (del) {
    var button = del.querySelector("[data-delete-button]");
    var label = button.textContent;
    del.addEventListener("submit", function (event) {
      if (button.getAttribute("data-armed") === "true") return;
      event.preventDefault();
      button.setAttribute("data-armed", "true");
      button.textContent = "Press again to delete for good";
      setTimeout(function () { button.removeAttribute("data-armed"); button.textContent = label; }, 5000);
    });
  });
})();
