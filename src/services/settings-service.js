// Site settings, menus and the home page texts from the admin, laid over the defaults in config/application.yml and
// the templates. Anything left empty in the admin falls back to the default, so a half filled form never leaves a
// blank where a name or a link should be.

// The home page as it was before any of it was editable. An empty field in the admin means this text
export const HOME_DEFAULTS = Object.freeze({
  hero_lede: "Applied Computer Science student at Saxion. I build software and hardware, and co-founded Cognitive Atmospherics, an AI that runs the climate of a room with less wasted energy. Looking for an internship from September 2027.",
  hero_button: "See my projects",
  hero_cv: "My CV",
  hero_link: "Get in touch",
  branches_heading: "One tree, three branches",
  branches_intro: "Everything I do grows from one of these.",
  intro_heading: "Meet me",
  intro_text: "Where I grew up, what I study, what I have built and what I want to work on next, in one video.",
  work_heading: "Selected work",
  work_intro: "A startup, a robot production line, a sensor that listens to traffic, a tool for a school's IT team and a streaming platform I run for my family.",
  contact_heading: "Say hello",
  contact_lead: "Open to internships, green tech projects and good conversations about either.",
  contact_button: "Send a message"
});

// The same texts for the german pages, written for a german reader and not translated word by word. Texts saved in the
// admin under the german fields go on top of these just like for english
export const HOME_DEFAULTS_DE = Object.freeze({
  hero_lede: "Technische Informatik an der Saxion. Ich baue Software und Hardware und habe Cognitive Atmospherics mitgegründet, eine KI, die das Klima eines Raums regelt und dabei weniger Energie verschwendet. Ich suche ein Praktikum ab September 2027.",
  hero_button: "Meine Projekte ansehen",
  hero_cv: "Mein Lebenslauf",
  hero_link: "Kontakt aufnehmen",
  branches_heading: "Ein Baum, drei Äste",
  branches_intro: "Alles, was ich mache, wächst aus einem davon.",
  intro_heading: "Lernen Sie mich kennen",
  intro_text: "Wo ich aufgewachsen bin, was ich studiere, was ich gebaut habe und woran ich als Nächstes arbeiten möchte, in einem Video.",
  work_heading: "Ausgewählte Projekte",
  work_intro: "Ein Startup, eine Roboter-Produktionslinie, ein Sensor, der dem Verkehr zuhört, ein Werkzeug für das IT-Team einer Schule und eine Streaming-Plattform, die ich für meine Familie betreibe.",
  contact_heading: "Sagen Sie Hallo",
  contact_lead: "Offen für Praktika, Green-Tech-Projekte und gute Gespräche über beides.",
  contact_button: "Nachricht senden"
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

  /** The home page texts in one language: the defaults, then what was saved in the admin (german under its own de block) */
  home(lang = "en") {
    const saved = this.content.data("home") || {};
    const german = lang === "de";
    const local = german ? saved.de || {} : {};
    const out = { ...(german ? HOME_DEFAULTS_DE : HOME_DEFAULTS) };
    for (const key of Object.keys(HOME_DEFAULTS)) {
      if (filled(local[key])) out[key] = local[key];
      // A german page never shows an english text Reece wrote in the english field cause that would be a hole in the page
      else if (!german && filled(saved[key])) out[key] = saved[key];
    }
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
