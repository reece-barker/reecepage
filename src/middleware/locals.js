// Puts what every template needs on res.locals: site details, navigation, the current path, consent state and the
// analytics settings. Page specific things come from the controllers.

function visibleLinks(links, features) {
  return (links || []).filter((link) => !link.feature || features[link.feature]);
}

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../services/consent-service.js").ConsentService} deps.consent
 * @param {ReturnType<import("./csrf.js").createCsrf>} deps.csrf
 */
export function templateLocals({ config, consent, csrf }) {
  const primaryNav = visibleLinks(config.navigation.primary, config.features);
  const legalNav = visibleLinks(config.navigation.legal, config.features);
  const moreNav = visibleLinks(config.navigation.more, config.features);
  const profiles = Object.entries(config.site.profiles || {})
    .filter(([, url]) => url)
    .map(([name, url]) => ({ name: name === "github" ? "GitHub" : name === "linkedin" ? "LinkedIn" : name, url }));

  return (req, res, next) => {
    const choice = consent.read(req);
    const askForConsent = consent.hasOptionalServices && !choice.decided;

    Object.assign(res.locals, {
      site: config.site,
      baseUrl: config.baseUrl,
      env: config.env,
      isProduction: config.isProduction,
      features: config.features,
      primaryNav,
      legalNav,
      moreNav,
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
