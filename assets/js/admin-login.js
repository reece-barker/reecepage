// The passkey button on the sign in page. Shown only when this browser can do passkeys and at least one has been
// added, otherwise the page is just the SimpleLogin button
(function () {
  "use strict";

  var box = document.querySelector("[data-passkey-signin]");
  var lib = window.SimpleWebAuthnBrowser;
  if (!box || !lib || !lib.browserSupportsWebAuthn()) return;
  box.hidden = false;
  var button = box.querySelector("[data-passkey-button]");
  var status = box.querySelector("[data-passkey-status]");

  function say(text, isError) {
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  }

  button.addEventListener("click", function () {
    button.disabled = true;
    say("Waiting for your passkey...");
    window.RP.send("/admin/login/passkey/options", { next: box.getAttribute("data-next") })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "Passkey sign in isnt available right now.");
        return lib.startAuthentication({ optionsJSON: result.data.options });
      })
      .then(function (response) { return window.RP.send("/admin/login/passkey", { response: response }); })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "That passkey didnt work.");
        say("Signed in");
        window.location.assign(result.data.redirect || "/admin");
      })
      .catch(function (error) {
        // Closing the passkey window is a NotAllowedError, thats not a problem worth shouting about
        say(error && error.name === "NotAllowedError" ? "Cancelled, press the button to try again." : error.message, error && error.name !== "NotAllowedError");
        button.disabled = false;
      });
  });
})();
