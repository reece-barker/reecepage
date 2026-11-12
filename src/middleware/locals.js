// Puts what every template needs on res.locals: site details, navigation, the current path, consent state and the
// analytics settings. Page specific things come from the controllers.

import { localePath, translator } from "../lib/i18n.js";

// The site name, menus and profiles come from the settings in the admin (laid over config/application.yml), so a
// change there shows on the next page view without a restart

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../services/consent-service.js").ConsentService} deps.consent
 * @param {ReturnType<import("./csrf.js").createCsrf>} deps.csrf
 * @param {import("../services/settings-service.js").SettingsService} deps.settings
 */
export function templateLocals({ config, consent, csrf, settings }) {
  return (req, res, next) => {
    const lang = req.lang || "en";
    const t = translator(lang);
    const site = settings.site();
    const menus = localiseMenus(settings.menus(), lang, t);
    const profiles = Object.entries(site.profiles || {})
      .filter(([, url]) => url)
      .map(([name, url]) => ({ name: name === "github" ? "GitHub" : name === "linkedin" ? "LinkedIn" : name, url }));
    const choice = consent.read(req);
    const askForConsent = consent.hasOptionalServices && !choice.decided;

    Object.assign(res.locals, {
      site,
      baseUrl: config.baseUrl,
      env: config.env,
      isProduction: config.isProduction,
      features: config.features,
      primaryNav: menus.primary,
      legalNav: menus.legal,
      moreNav: menus.more,
      profiles,
      currentPath: req.path,
      consent: { ...choice, ask: askForConsent, hasOptional: consent.hasOptionalServices },
      analytics: consent.hasOptionalServices && choice.analytics ? config.analytics : null,
      // What the banner script needs to load analytics straight after a yes, without reloading the page
      analyticsSetup: consent.hasOptionalServices ? config.analytics : null,
      // Only the current path is used as a return address after the cookie banner, never anything from the query.
      // A german page goes back to the german page
      returnTo: localePath(lang, req.path),
      // The browser only sends its errors when there is somewhere for them to go
      errorReporting: Boolean(config.monitoring?.dsn && config.monitoring?.browser)
    });

    // The banner contains a small form, so it needs a CSRF token, but only when it is actually shown
    if (askForConsent) return csrf.provideToken(req, res, next);
    next();
  };
}

/**
 * The menus in the visitors language. Each link keeps the path it has in English (path, for marking the current page)
 * and gets the address in this language (href). A label Reece changed himself in the admin is left alone, only the
 * built in names (Projects, About...) are translated, because he wrote the others in his own words
 */
function localiseMenus(menus, lang, t) {
  if (lang === "en") {
    const plain = (links) => links.map((link) => ({ ...link, path: link.href }));
    return { primary: plain(menus.primary), more: plain(menus.more), legal: plain(menus.legal) };
  }
  const english = translator("en");
  const one = (link) => {
    const key = `nav.${String(link.href).replace(/^\//, "")}`;
    const builtIn = t.has(key) && link.label === english(key);
    return { ...link, path: link.href, href: localePath(lang, link.href), label: builtIn ? t(key) : link.label };
  };
  return { primary: menus.primary.map(one), more: menus.more.map(one), legal: menus.legal.map(one) };
}
