// Site settings, menus and the home page texts from the admin, laid over the defaults in config/application.yml and
// the templates. Anything left empty in the admin falls back to the default, so a half filled form never leaves a
// blank where a name or a link should be.

// The home page as it was before any of it was editable. An empty field in the admin means this text
export const HOME_DEFAULTS = Object.freeze({
  hero_lede: "I grew up in Munich and study Applied Computer Science at Saxion in Enschede. I write software, build hardware and co-founded a startup whose AI runs the climate of a room, so it stays comfortable and wastes less energy.",
  hero_button: "See my projects",
  hero_link: "Get in touch",
  branches_heading: "One tree, three branches",
  branches_intro: "Everything I do grows from one of these.",
  intro_heading: "Meet me",
  intro_text: "Where I grew up, what I study, what I have built and what I want to work on next, in one video.",
  work_heading: "Selected work",
  work_intro: "A startup, a robot production line, a sensor that listens to traffic and a tool for a school's IT team.",
  contact_heading: "Say hello",
  contact_lead: "Open to internships, green tech projects and good conversations about either.",
  contact_button: "Send a message"
});

// Links to a part of the site that can be switched off, hidden while it is
const FEATURE_PATHS = { "/writing": "writing", "/media": "media", "/status": "status_page", "/tools": "tools", "/contact": "contact_form" };

const filled = (value) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && !value.length);

export class SettingsService {
  /**
   * @param {object} deps
   * @param {object} deps.config
   * @param {import("./content-service.js").ContentService} deps.content
   */
  constructor({ config, content }) {
    this.config = config;
    this.content = content;
  }

  /** config.site with the admin's settings on top. Built per call, its a handful of keys */
  site() {
    const base = this.config.site;
    const saved = this.content.data("settings") || {};
    const out = { ...base };
    for (const key of ["name", "short_name", "description", "email", "knows_about"]) if (filled(saved[key])) out[key] = saved[key];
    if (saved.profiles) {
      out.profiles = { ...base.profiles };
      for (const [key, value] of Object.entries(saved.profiles)) if (filled(value)) out.profiles[key] = value;
    }
    return out;
  }

  pageDescription(name) {
    const saved = this.content.data("settings")?.pages || {};
    return filled(saved[name]) ? saved[name] : null;
  }

  home() {
    const saved = this.content.data("home") || {};
    const out = { ...HOME_DEFAULTS };
    for (const key of Object.keys(HOME_DEFAULTS)) if (filled(saved[key])) out[key] = saved[key];
    return out;
  }

  /** The three menus, from the admin when saved there, otherwise the config. Switched off sections are left out */
  menus() {
    const saved = this.content.data("menus") || {};
    const pick = (name) => (filled(saved[name]) ? saved[name] : this.config.navigation[name] || []);
    const visible = (links) => links.filter((link) => {
      const feature = link.feature || FEATURE_PATHS[link.href];
      return !feature || this.config.features[feature];
    });
    return { primary: visible(pick("primary")), more: visible(pick("more")), legal: visible(pick("legal")) };
  }
}
