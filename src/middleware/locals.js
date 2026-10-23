// Puts what every template needs on res.locals: site details, navigation, the current path, consent state and the
// analytics settings. Page specific things come from the controllers.

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
    const site = settings.site();
    const menus = settings.menus();
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
      // Only the current path is used as a return address after the cookie banner, never anything from the query
      returnTo: req.path,
      // The browser only sends its errors when there is somewhere for them to go
      errorReporting: Boolean(config.monitoring?.dsn && config.monitoring?.browser)
    });

    // The banner contains a small form, so it needs a CSRF token, but only when it is actually shown
    if (askForConsent) return csrf.provideToken(req, res, next);
    next();
  };
}
