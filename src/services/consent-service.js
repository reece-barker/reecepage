// Reads and writes the visitor's cookie choice. The choice itself is stored in a small first party cookie, that cookie
// is strictly necessary (it remembers a no just as much as a yes) so it needs no consent of its own.
//
// Cookie value looks like "1.analytics" or "1.none": the consent version, then the optional services that were allowed.
// When the version in config goes up (a new optional service is added) everyone is asked again.

const OPTIONAL_SERVICES = ["analytics"];

export class ConsentService {
  /** @param {{ config: object }} deps */
  constructor({ config }) {
    this.config = config;
    this.cookieName = config.consent.cookie_name;
    this.version = String(config.consent.version);
    this.maxAgeMs = config.consent.max_age_days * 24 * 60 * 60 * 1000;
  }

  /** True when some optional service is actually switched on, otherwise there is nothing to ask about */
  get hasOptionalServices() {
    return this.config.features.analytics && this.config.analytics.provider !== "none";
  }

  /** @returns {{ decided: boolean, analytics: boolean }} */
  read(req) {
    const raw = req.cookies?.[this.cookieName];
    if (typeof raw !== "string") return { decided: false, analytics: false };
    const [version, ...services] = raw.split(".");
    if (version !== this.version) return { decided: false, analytics: false };
    const allowed = new Set(services.filter((service) => OPTIONAL_SERVICES.includes(service)));
    return { decided: true, analytics: allowed.has("analytics") };
  }

  /** @param {{ analytics: boolean }} choices */
  write(res, choices) {
    const services = OPTIONAL_SERVICES.filter((service) => choices[service]);
    const value = [this.version, ...(services.length ? services : ["none"])].join(".");
    res.cookie(this.cookieName, value, {
      maxAge: this.maxAgeMs,
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.isProduction,
      path: "/"
    });
    return value;
  }
}
