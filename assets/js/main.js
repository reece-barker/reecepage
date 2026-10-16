// Small enhancements for every page. Everything here is optional: the site works without it, this only makes it
// nicer (menu folding, theme switch, reveals, the contact form helpers, the cookie banner, match cuts).
// Plain browser JavaScript, no build step needed beyond minifying.
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $all(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }

  /* Menu on small screens. Escape closes it and puts focus back on the button */
  function setupMenu() {
    var button = $("[data-menu-button]");
    var list = $("#site-nav-list");
    if (!button || !list) return;
    function setOpen(open) {
      button.setAttribute("aria-expanded", String(open));
      list.classList.toggle("is-open", open);
    }
    button.addEventListener("click", function () {
      setOpen(button.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        button.focus();
      }
    });
    document.addEventListener("click", function (event) {
      if (button.getAttribute("aria-expanded") === "true" && !event.target.closest(".site-nav")) setOpen(false);
    });
  }

  /* Theme switch. With no saved choice the system setting wins, the button flips to the other one and remembers it */
  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function setupThemeToggle() {
    var button = $("[data-theme-toggle]");
    if (!button) return;
    function label() {
      button.setAttribute("aria-label", currentTheme() === "dark" ? "Use the light theme" : "Use the dark theme");
    }
    button.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("rp-theme", next); } catch (error) { /* private mode, it still works for this page */ }
      label();
      document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", label);
    label();
  }

  /* Things slide up into place the first time they scroll into view. Siblings follow each other by 60ms */
  function setupReveals() {
    var items = $all("[data-reveal]");
    if (!items.length) return;
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.classList.add("is-revealed"); });
      return;
    }
    items.forEach(function (item) {
      var siblings = $all(":scope > [data-reveal]", item.parentElement);
      item.style.setProperty("--reveal-index", String(Math.min(siblings.indexOf(item), 6)));
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(function (item) { observer.observe(item); });
  }

  /* Fallback for the header line where scroll driven animations dont exist yet */
  function setupHeader() {
    var header = $(".site-header");
    if (!header || (window.CSS && CSS.supports("animation-timeline: scroll()"))) return;
    var ticking = false;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* Copy the email address */
  function setupCopy() {
    $all("[data-copy]").forEach(function (button) {
      var status = $("[data-copy-status]");
      button.addEventListener("click", function () {
        var text = button.getAttribute("data-copy");
        var done = function () { if (status) status.textContent = "Copied " + text; };
        var failed = function () { if (status) status.textContent = "Could not copy, please select the address above"; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, failed);
        else failed();
      });
    });
  }

  /* Contact form: character counter, focus on the error summary, and no double sending */
  function setupContactForm() {
    var form = $("[data-contact-form]");
    if (!form) return;
    var summary = $("[data-error-summary]");
    if (summary) summary.focus();

    var textarea = $("[data-count-chars]", form);
    var counter = $("[data-char-count]", form);
    if (textarea && counter) {
      var max = Number(textarea.getAttribute("maxlength")) || 5000;
      var update = function () {
        var left = max - textarea.value.length;
        counter.textContent = left >= 0 ? left.toLocaleString("en-GB") + " characters left" : "Too long by " + (-left).toLocaleString("en-GB");
        counter.classList.toggle("is-over", left < 0);
      };
      textarea.addEventListener("input", update);
      update();
    }

    form.addEventListener("submit", function () {
      var button = $("[data-submit]", form);
      var label = $("[data-submit-label]", form);
      if (button.getAttribute("aria-busy") === "true") return;
      button.setAttribute("aria-busy", "true");
      if (label) label.textContent = "Sending";
    });
  }

  /* Analytics, only ever called after consent. Events never include what someone typed */
  function loadAnalytics(holder) {
    var provider = holder.getAttribute("data-analytics-provider");
    var src = holder.getAttribute("data-analytics-src");
    if (!src || document.querySelector("script[data-analytics]")) return;
    var script = document.createElement("script");
    script.defer = true;
    script.src = src;
    script.setAttribute("data-analytics", provider);
    if (provider === "plausible") {
      script.setAttribute("data-domain", holder.getAttribute("data-analytics-domain"));
      script.setAttribute("data-api", holder.getAttribute("data-analytics-api"));
    }
    if (provider === "umami") {
      script.setAttribute("data-website-id", holder.getAttribute("data-analytics-website-id"));
      script.setAttribute("data-do-not-track", "true");
    }
    document.body.appendChild(script);
  }

  function track(name) {
    if (typeof window.plausible === "function") window.plausible(name);
    else if (window.umami && typeof window.umami.track === "function") window.umami.track(name);
  }

  function setupAnalyticsEvents() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-track]");
      if (target) track(target.getAttribute("data-track"));
    });
    if (document.body.classList.contains("page-thank-you")) {
      // The script loads with defer, give it a moment
      window.addEventListener("load", function () { track("Contact sent"); });
    }
  }

  /* The cookie banner sends its choice in the background so the page doesnt reload */
  function setupConsent() {
    var banner = $("[data-consent]");
    var form = $("[data-consent-form]");
    if (!banner || !form || !window.fetch) return;
    form.addEventListener("submit", function (event) {
      var submitter = event.submitter;
      if (!submitter) return;
      event.preventDefault();
      var body = new URLSearchParams(new FormData(form));
      body.set("choice", submitter.value);
      fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "fetch", "X-CSRF-Token": form.elements._csrf.value },
        body: body.toString(),
        credentials: "same-origin"
      }).then(function (response) {
        if (!response.ok) throw new Error("status " + response.status);
        return response.json();
      }).then(function (result) {
        if (result.analytics) loadAnalytics(banner);
        banner.remove();
      }).catch(function () {
        form.submit(); // the normal form post still works, it just reloads
      });
    });
  }

  /* Match cuts: the title you click keeps its place and becomes the title of the next page.
     The project and article pages give their h1 the same view transition name in CSS */
  function setupMatchCuts() {
    if (!("onpagereveal" in window) && !document.startViewTransition) return;
    document.addEventListener("click", function (event) {
      var link = event.target.closest("a[data-match-cut]");
      if (!link || reduceMotion.matches) return;
      $all("[data-match-cut]").forEach(function (other) { other.style.viewTransitionName = ""; });
      link.style.viewTransitionName = "match-cut";
    });
    // Coming back from a project: give the matching row the name so the title flies back into the list
    window.addEventListener("pagereveal", function (event) {
      if (!event.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
      var from = new URL(navigation.activation.from.url);
      var link = $all("a[data-match-cut]").filter(function (a) { return new URL(a.href).pathname === from.pathname; })[0];
      if (!link) return;
      link.style.viewTransitionName = "match-cut";
      event.viewTransition.finished.then(function () { link.style.viewTransitionName = ""; });
    });
  }

  /* On this page: marks the section being read */
  function setupToc() {
    var links = $all(".toc a[href^='#']");
    if (!links.length || !("IntersectionObserver" in window)) return;
    var byId = {};
    links.forEach(function (link) { byId[decodeURIComponent(link.hash.slice(1))] = link; });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) { link.classList.remove("is-current"); link.removeAttribute("aria-current"); });
        var link = byId[entry.target.id];
        if (link) { link.classList.add("is-current"); link.setAttribute("aria-current", "location"); }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(byId).forEach(function (id) {
      var heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    });
  }

  /* Script errors go to our own server, which passes them to the self hosted error monitor. Only the message, the
     error type, the stack and the page path are sent, at most five per page, and only when the site has monitoring on */
  function setupErrorReporting() {
    if (!root.hasAttribute("data-error-reporting") || !navigator.sendBeacon) return;
    var sent = 0;
    var seen = {};
    function report(message, type, stack) {
      var key = String(message).slice(0, 120);
      if (sent >= 5 || seen[key]) return;
      seen[key] = true;
      sent += 1;
      var body = JSON.stringify({ message: String(message).slice(0, 500), type: type || "Error", stack: String(stack || "").slice(0, 4000), page: location.pathname });
      navigator.sendBeacon("/errors", new Blob([body], { type: "application/json" }));
    }
    window.addEventListener("error", function (event) {
      // Errors from scripts on other sites only arrive as "Script error." with nothing useful in them
      if (!event.error && /^Script error\.?$/.test(event.message)) return;
      report(event.message, event.error && event.error.name, event.error && event.error.stack);
    });
    window.addEventListener("unhandledrejection", function (event) {
      var reason = event.reason || {};
      report(reason.message || String(reason), reason.name || "UnhandledRejection", reason.stack);
    });
  }

  function start() {
    setupErrorReporting();
    setupMenu();
    setupThemeToggle();
    setupReveals();
    setupHeader();
    setupCopy();
    setupContactForm();
    setupConsent();
    setupAnalyticsEvents();
    setupMatchCuts();
    setupToc();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
