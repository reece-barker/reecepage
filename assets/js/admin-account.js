// Adding a passkey on the account page. The browser makes the key, the server checks and keeps its public half
(function () {
  "use strict";

  var box = document.querySelector("[data-add-passkey]");
  var lib = window.SimpleWebAuthnBrowser;
  if (!box) return;
  if (!lib || !lib.browserSupportsWebAuthn()) {
    var note = document.querySelector("[data-passkey-unsupported]");
    if (note) note.hidden = false;
    return;
  }
  box.hidden = false;
  var button = box.querySelector("[data-passkey-add]");
  var nameInput = box.querySelector("[data-passkey-name]");
  var status = box.querySelector("[data-passkey-status]");

  // A sensible default name from the device, easy to change
  var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  if (/iphone/i.test(navigator.userAgent)) nameInput.value = "iPhone";
  else if (/android/i.test(navigator.userAgent)) nameInput.value = "Android phone";
  else if (/mac/i.test(platform)) nameInput.value = "Mac";
  else if (/win/i.test(platform)) nameInput.value = "Windows PC";

  function say(text, isError) {
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  }

  button.addEventListener("click", function () {
    button.disabled = true;
    say("Follow what your browser asks...");
    window.RP.send("/admin/account/passkeys/options", {})
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "Adding a passkey isnt available right now.");
        return lib.startRegistration({ optionsJSON: result.data.options });
      })
      .then(function (response) { return window.RP.send("/admin/account/passkeys", { response: response, name: nameInput.value }); })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "The passkey wasnt added.");
        say("Passkey added");
        window.location.reload();
      })
      .catch(function (error) {
        var cancelled = error && (error.name === "NotAllowedError" || error.name === "InvalidStateError");
        say(error && error.name === "InvalidStateError" ? "This device already has a passkey for the admin." : cancelled ? "Cancelled, nothing was added." : error.message, !cancelled);
        button.disabled = false;
      });
  });
})();
