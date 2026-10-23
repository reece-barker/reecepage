// Compiles the legal page templates with the app's own Handlebars, so they get the same helpers ({{lv}}, {{eq}},
// {{longDate}} and so on) and partials ({{> breadcrumbs}}) as the files in views/. Compiled templates are kept by
// their source text, a new version from the admin is simply a new key
export class LegalTemplates {
  /** @param {{ hbs: import("express-handlebars").ExpressHandlebars }} deps */
  constructor({ hbs }) {
    this.hbs = hbs;
    this.cache = new Map();
  }

  compile(source) {
    let template = this.cache.get(source);
    if (!template) {
      template = this.hbs.handlebars.compile(source, { strict: false });
      if (this.cache.size > 50) this.cache.clear();
      this.cache.set(source, template);
    }
    return template;
  }

  async render(source, data) {
    const partials = await this.hbs.getPartials();
    return this.compile(source)(data, { helpers: this.hbs.helpers, partials, allowProtoPropertiesByDefault: false });
  }

  /** Throws with Handlebars' own message (it names the line) if the source wont compile or render */
  async check(source, data) {
    const partials = await this.hbs.getPartials();
    this.hbs.handlebars.compile(source, { strict: false })(data, { helpers: this.hbs.helpers, partials });
  }
}
