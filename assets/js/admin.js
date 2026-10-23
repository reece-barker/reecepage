// Small things every admin page needs: the menu button on small screens, the theme switch, two press buttons
// (the first press arms it and says what the second will do, no browser popups), times shown in your own time
// zone, and window.RP with the CSRF token and a fetch helper the other admin scripts use.
(function () {
  "use strict";

  var body = document.body;
  var csrf = body.getAttribute("data-csrf") || "";

  /** POST (or PUT) JSON with the CSRF token, always resolves with { ok, status, data } */
  function send(url, payload, method) {
    return fetch(url, {
      method: method || "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, Accept: "application/json" },
      body: JSON.stringify(payload || {}),
      credentials: "same-origin"
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok && data.ok !== false, status: response.status, data: data };
      });
    }, function () {
      return { ok: false, status: 0, data: { error: "The server couldnt be reached, check your connection. Nothing was lost, try again." } };
    });
  }

  window.RP = { csrf: csrf, send: send };

  // Menu on small screens and on the editor page
  var menu = document.querySelector("[data-admin-menu]");
  var nav = document.getElementById("admin-nav");
  if (menu && nav) {
    menu.addEventListener("click", function () {
      var open = menu.getAttribute("aria-expanded") !== "true";
      menu.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
  }

  // Theme switch, the same rp-theme setting as the public site
  var themeButton = document.querySelector("[data-theme-toggle]");
  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var root = document.documentElement;
      var dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("rp-theme", root.dataset.theme); } catch (e) { /* Private mode, it just isnt remembered */ }
    });
  }

  // Two press buttons. Five seconds to press again, then it goes back to normal
  document.querySelectorAll("[data-confirm-form]").forEach(function (form) {
    var button = form.querySelector("[data-confirm-label]");
    if (!button) return;
    var original = button.textContent;
    var timer = null;
    form.addEventListener("submit", function (event) {
      if (button.getAttribute("data-armed") === "true") return;
      event.preventDefault();
      button.setAttribute("data-armed", "true");
      button.textContent = button.getAttribute("data-confirm-label");
      clearTimeout(timer);
      timer = setTimeout(function () {
        button.removeAttribute("data-armed");
        button.textContent = original;
      }, 5000);
    });
  });

  // Times come from the server in UTC, these show them in your time zone, like "23 Oct 2026, 15:40"
  var format = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  window.RP.formatTime = function (value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? "" : format.format(date);
  };
  document.querySelectorAll("[data-local-time]").forEach(function (node) {
    var text = window.RP.formatTime(node.getAttribute("datetime"));
    if (text) node.textContent = text;
  });
})();
