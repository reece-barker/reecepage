// Home, about and the project and writing pages. Each handler collects what its template needs and nothing else.
import { existsSync } from "node:fs";
import path from "node:path";
import { notFound } from "../middleware/errors.js";
import { renderMediaShortcodes } from "../services/media-service.js";
import { mediaFigure } from "../helpers/media-html.js";
import { localePath, translator } from "../lib/i18n.js";
import { localiseBranches, localiseNow, localisePage, localiseProject, localiseSkills, localiseTimeline } from "../services/localise.js";

const BRANCH_FILTERS = ["code", "earth"];

/**
 * @param {object} deps
 * @param {import("../services/content-service.js").ContentService} deps.content
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {object} deps.config
 */
export function createPagesController({ content, seo, config, media, settings }) {
  const siteSettings = () => settings?.site() || config.site;
  const pageDescription = (name, fallback) => settings?.pageDescription(name) || fallback;

  /**
   * Swaps the media and gallery codes in a body for the real pictures and videos. Pictures in a post show whether
   * or not they're also listed on the media page, that tick is only for the gallery there. A database hiccup
   * leaves the text without the pictures rather than taking the page down
   */
  async function withMedia(html, req) {
    if (!media?.available || (!html.includes("<!--rp-media:") && !html.includes("[[media:"))) return html;
    try {
      return await renderMediaShortcodes(html, media, mediaFigure, { publishedOnly: false });
    } catch (error) {
      req.log?.warn({ err: { message: error.message } }, "media in the text not loaded");
      return html;
    }
  }
  // Projects and articles can have their own share picture (npm run images:og makes them). Without one the default
  // picture from the config is used
  const ogDir = path.join(config.rootDir, "assets/images/og");
  function shareImage(kind, slug) {
    const name = `images/og/${kind}/${slug}.png`;
    return existsSync(path.join(ogDir, kind, `${slug}.png`)) ? name : undefined;
  }

  /** Turns the slugs in skills.yml into real links, a slug that doesnt exist anymore is dropped quietly */
  function resolveSkills(lang = "en") {
    return localiseSkills(content.data("skills") || [], lang).map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        evidence: (item.evidence || []).map((slug) => content.getProject(slug)).filter(Boolean).map((project) => localiseProject(project, lang))
      }))
    }));
  }

  return {
    async home(req, res) {
      const latest = config.features.writing ? content.listArticles()[0] || null : null;
      // The introduction video, when one is uploaded, published and marked featured. A database hiccup must never
      // take the home page down, it just shows without the video
      let intro = null;
      if (config.features.media && media?.available) {
        try { intro = await media.featuredVideo(); } catch (error) { req.log?.warn({ err: { message: error.message } }, "featured video not loaded"); }
      }
      const lang = req.lang || "en";
      res.render("pages/home", {
        meta: seo.build({ isHome: true, title: siteSettings().name, description: lang === "de" ? translator("de")("home.description") : siteSettings().description, path: "/", language: lang }),
        home: settings?.home(lang) || {},
        bodyClass: "page-home",
        featured: content.featuredProjects(5).map((project) => localiseProject(project, lang)),
        now: localiseNow(content.data("now"), lang),
        latest,
        intro,
        introHtml: intro ? mediaFigure(intro, { showCaption: false }) : "",
        scripts: ["js/tree.js"]
      });
    },

    async about(req, res, next) {
      const lang = req.lang || "en";
      const t = translator(lang);
      const english = content.page("about");
      if (!english) return next(notFound());
      const page = localisePage(english, lang);
      res.render("pages/about", {
        // The three branches used to sit on the home page between the intro and the work, here they explain him
        branches: localiseBranches(content.data("branches"), lang),
        home: settings?.home(lang) || {},
        meta: seo.build({
          title: lang === "de" ? page.title : "About",
          description: lang === "de"
            ? page.description || t("about.description")
            : page.description || pageDescription("about", t("about.description")),
          path: "/about",
          pageType: "ProfilePage",
          language: lang,
          breadcrumbs: [{ label: lang === "de" ? page.title : "About", href: "/about" }]
        }),
        bodyClass: "page-about",
        page: { ...page, html: await withMedia(page.html, req) },
        timeline: localiseTimeline(content.data("timeline"), lang),
        skills: resolveSkills(lang),
        now: localiseNow(content.data("now"), lang)
      });
    },

    projects(req, res) {
      // Only known values are accepted, anything else shows everything (and is not repeated back into the page)
      const lang = req.lang || "en";
      const t = translator(lang);
      const branch = BRANCH_FILTERS.includes(req.query.branch) ? req.query.branch : null;
      const all = content.listProjects().map((project) => localiseProject(project, lang));
      const shown = branch ? all.filter((project) => project.branch === branch) : all;
      res.render("pages/projects", {
        meta: seo.build({
          title: branch ? t("projects.filteredTitle", { branch: t(`branch.${branch}`) }) : t("projects.title"),
          description: lang === "de" ? t("projects.description") : pageDescription("projects", t("projects.description")),
          // The filtered views are the same list cut down, so they all point search engines at /projects
          path: "/projects",
          language: lang,
          breadcrumbs: [{ label: t("projects.title"), href: "/projects" }]
        }),
        bodyClass: "page-projects",
        branch,
        filters: [
          { label: t("projects.all"), href: localePath(lang, "/projects"), active: !branch, count: all.length },
          ...BRANCH_FILTERS.map((id) => ({
            id,
            label: t(`branch.${id}`),
            href: `${localePath(lang, "/projects")}?branch=${id}`,
            active: branch === id,
            count: all.filter((project) => project.branch === id).length
          }))
        ],
        withPages: shown.filter((project) => project.hasPage),
        smaller: shown.filter((project) => !project.hasPage)
      });
    },

    async project(req, res, next) {
      const project = content.getProject(req.params.slug);
      if (!project) return next(notFound());
      try { await renderProject(req, res, project); } catch (error) { next(error); }
    },

    writing(req, res, next) {
      if (!config.features.writing) return next(notFound());
      const lang = req.lang || "en";
      const t = translator(lang);
      res.render("pages/writing", {
        meta: seo.build({
          title: t("writing.title"),
          description: lang === "de" ? t("writing.description") : pageDescription("writing", t("writing.description")),
          path: "/writing",
          language: lang,
          breadcrumbs: [{ label: t("writing.title"), href: "/writing" }]
        }),
        bodyClass: "page-writing",
        articles: content.listArticles()
      });
    },

    async article(req, res, next) {
      if (!config.features.writing) return next(notFound());
      const article = content.getArticle(req.params.slug);
      if (!article) return next(notFound());
      try { await renderArticle(req, res, article); } catch (error) { next(error); }
    },

    tools(req, res, next) {
      if (!config.features.tools || content.listTools().length === 0) return next(notFound());
      res.render("pages/tools", {
        meta: seo.build({ title: "Tools", description: "Small tools by Reece Barker.", path: "/tools", breadcrumbs: [{ label: "Tools", href: "/tools" }] }),
        bodyClass: "page-tools",
        tools: content.listTools()
      });
    },

    async tool(req, res, next) {
      if (!config.features.tools) return next(notFound());
      const tool = content.getTool(req.params.slug);
      if (!tool) return next(notFound());
      try { await renderTool(req, res, tool); } catch (error) { next(error); }
    },

    /** Pages made in the admin, at /their-address. Anything else falls through to the 404 */
    async page(req, res, next) {
      const page = content.page(req.params.slug);
      if (!page || page.slug === "about") return next();
      try { await renderPage(req, res, page); } catch (error) { next(error); }
    },

    // The same renderers for the admin preview, so a preview is exactly what the page will look like
    render: { project: (...a) => renderProject(...a), article: (...a) => renderArticle(...a), tool: (...a) => renderTool(...a), page: (...a) => renderPage(...a), about: (req, res, page) => renderAbout(req, res, page) }
  };

  async function renderAbout(req, res, page) {
    res.render("pages/about", {
      meta: seo.build({ title: "About", description: page.description || "About", path: "/about", noindex: true, breadcrumbs: [{ label: "About", href: "/about" }] }),
      bodyClass: "page-about",
      page: { ...page, html: await withMedia(page.html, req) },
      timeline: content.data("timeline"),
      skills: resolveSkills(),
      now: content.data("now")
    });
  }

  async function renderPage(req, res, page, { preview = false } = {}) {
    res.render("pages/page", {
      meta: seo.build({ title: page.title, description: page.description || page.lead || siteSettings().description, path: page.url, noindex: preview, breadcrumbs: [{ label: page.title, href: page.url }] }),
      bodyClass: "page-custom",
      page,
      html: await withMedia(page.html, req)
    });
  }

  async function renderProject(req, res, english, { preview = false } = {}) {
    const lang = req.lang || "en";
    const t = translator(lang);
    const project = localiseProject(english, lang);
    const near = preview ? { previous: null, next: null } : content.neighbours(english.slug);
    const previous = near.previous ? localiseProject(near.previous, lang) : null;
    const following = near.next ? localiseProject(near.next, lang) : null;
    res.render("pages/project", {
      meta: seo.build({
        title: project.title,
        description: project.description,
        path: project.url,
        type: "article",
        language: lang,
        image: shareImage("projects", project.slug),
        imageAlt: shareImage("projects", project.slug)
          ? (lang === "de" ? `${project.title}, ein Projekt von Reece Barker` : `${project.title}, a project by Reece Barker`)
          : undefined,
        breadcrumbs: [{ label: t("projects.title"), href: "/projects" }, { label: project.title, href: project.url }],
        schema: [seo.projectSchema(project)]
      }),
      bodyClass: `page-project branch-${project.branch}`,
      project: { ...project, html: await withMedia(project.html, req) },
      previous,
      following,
      showTodo: (preview || !config.isProduction) && project.todo.length > 0
    });
  }

  async function renderArticle(req, res, article, { preview = false } = {}) {
    const lang = req.lang || "en";
    const t = translator(lang);
    res.render("pages/article", {
      html: await withMedia(article.html, req),
      meta: seo.build({
        title: article.title,
        description: article.description,
        path: article.url,
        type: "article",
        language: lang,
        article: { published: article.date, modified: article.updated },
        image: shareImage("writing", article.slug),
        imageAlt: shareImage("writing", article.slug) ? `${article.title}, an article by Reece Barker` : undefined,
        breadcrumbs: [{ label: t("writing.title"), href: "/writing" }, { label: article.title, href: article.url }],
        schema: [seo.articleSchema(article)]
      }),
      bodyClass: "page-article",
      article,
      showTodo: (preview || !config.isProduction) && article.todo.length > 0
    });
  }

  async function renderTool(req, res, tool) {
    res.render("pages/tool", {
      meta: seo.build({
        title: tool.title,
        description: tool.description,
        path: tool.url,
        breadcrumbs: [{ label: "Tools", href: "/tools" }, { label: tool.title, href: tool.url }],
        schema: [{ "@type": "SoftwareApplication", name: tool.title, description: tool.summary, applicationCategory: "UtilitiesApplication", operatingSystem: "Web browser", url: seo.absoluteUrl(tool.url) }]
      }),
      bodyClass: "page-tool",
      tool: { ...tool, html: await withMedia(tool.html, req) }
    });
  }
}
