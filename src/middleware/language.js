// Works out wich language a request is for, german pages live under /de and this strips the prefix before the router
// sees the url so every route is only written once and works in both languages. req.lang tells wich one it was
import { alternatePath, hasGermanVersion, LANGUAGE_INFO, localePath, splitLanguage, translator } from "../lib/i18n.js";

/** Pages that only exist in english (admin, legal, media...) send a /de adress back to the normal one */
export function languageRouting() {
  return (req, res, next) => {
    const { lang, path } = splitLanguage(req.path);
    // The german cv was there before the switch, it has its own adress and is german all the way even the menus
    req.lang = lang === "en" && path === "/lebenslauf" ? "de" : lang;
    if (lang === "en") return next();

    const query = req.url.slice(req.path.length);
    if (!hasGermanVersion(path)) {
      // Only for reading pages, a POST to a made up german adress is just a 404
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      return res.redirect(302, `${localePath("de", path)}${query}`);
    }
    req.url = `${path}${query}`;
    next();
  };
}

/**
 * Puts the language stuff every template needs on res.locals, lang and the html lang attribute and the two links the
 * dropdown shows. The t and lp helpers in the templates read lang from in here
 */
export function languageLocals() {
  return (req, res, next) => {
    const lang = req.lang || "en";
    const here = alternatePath(lang, req.path);
    // Same page and same filter so /projects?branch=code stays on code when you switch
    const query = hasGermanVersion(req.path) ? req.url.slice(req.path.length) : "";
    const t = translator(lang);
    res.locals.lang = lang;
    res.locals.htmlLang = LANGUAGE_INFO[lang].html;
    res.locals.languageLinks = ["en", "de"].map((code) => ({
      code,
      name: LANGUAGE_INFO[code].name,
      short: LANGUAGE_INFO[code].short,
      href: `${here[code]}${query}`,
      current: code === lang
    }));
    res.locals.languageName = LANGUAGE_INFO[lang].name;
    res.locals.languageShort = LANGUAGE_INFO[lang].short;
    res.locals.languageLabel = t("language.current", { name: LANGUAGE_INFO[lang].name });
    next();
  };
}
