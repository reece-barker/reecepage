// Builds the <head> metadata and the structured data for every page from one place, so titles, canonical urls and
// social previews are always made the same way. Controllers only say what is special about their page.
import { truncate } from "../utils/text.js";
import { isoDate } from "../utils/dates.js";

export class SeoService {
  /**
   * @param {{ config: object, assets: import("./asset-manifest.js").AssetManifest }} deps
   */
  constructor({ config, assets }) {
    this.config = config;
    this.assets = assets;
    this.site = config.site;
  }

  absoluteUrl(pathname = "/") {
    if (/^https?:\/\//.test(pathname)) return pathname;
    return `${this.config.baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  }

  /** The person, used on the home and about pages and as author everywhere else */
  person() {
    const { site } = this;
    const sameAs = Object.values(site.profiles || {}).filter(Boolean);
    return {
      "@type": "Person",
      "@id": this.absoluteUrl("/#person"),
      name: site.name,
      alternateName: site.legal_name,
      url: this.absoluteUrl("/"),
      email: `mailto:${site.email}`,
      jobTitle: "Applied Computer Science student",
      description: site.description.trim(),
      knowsAbout: site.knows_about,
      knowsLanguage: ["en", "de"],
      ...(site.education?.studying ? { affiliation: { "@type": "CollegeOrUniversity", name: site.education.studying.name, url: site.education.studying.url } } : {}),
      ...(site.education?.finished?.length ? { alumniOf: site.education.finished.map((org) => ({ "@type": "EducationalOrganization", name: org.name, url: org.url })) } : {}),
      ...(sameAs.length ? { sameAs } : {})
    };
  }

  website() {
    return {
      "@type": "WebSite",
      "@id": this.absoluteUrl("/#website"),
      url: this.absoluteUrl("/"),
      name: this.site.domain,
      description: this.site.description.trim(),
      inLanguage: "en-GB",
      publisher: { "@id": this.absoluteUrl("/#person") }
    };
  }

  breadcrumbList(crumbs) {
    return {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.label,
        item: this.absoluteUrl(crumb.href)
      }))
    };
  }

  /**
   * @param {object} page
   * @param {string} page.title short title, the site name is added after it
   * @param {string} page.description
   * @param {string} page.path canonical path, always without query string
   * @param {string} [page.type] og:type, website or article
   * @param {string} [page.image] asset name of a 1200x630 image
   * @param {string} [page.imageAlt]
   * @param {boolean} [page.noindex]
   * @param {boolean} [page.isHome]
   * @param {{ label: string, href: string }[]} [page.breadcrumbs] without the home crumb, its added here
   * @param {object[]} [page.schema] extra JSON-LD nodes for this page
   * @param {{ published?: Date, modified?: Date }} [page.article]
   */
  build(page) {
    const isHome = Boolean(page.isHome);
    const fullTitle = isHome ? this.site.name : `${page.title} | ${this.site.name}`;
    const description = truncate(page.description || this.site.description, 160);
    const canonical = this.absoluteUrl(page.path);
    const imageUrl = this.absoluteUrl(this.assets.url(page.image || this.config.seo.default_image));
    const imageAlt = page.imageAlt || this.config.seo.default_image_alt;
    const crumbs = page.breadcrumbs?.length ? [{ label: "Home", href: "/" }, ...page.breadcrumbs] : null;

    const graph = [];
    if (isHome) graph.push(this.website(), this.person());
    graph.push({
      "@type": page.pageType || "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: page.title,
      description,
      inLanguage: "en-GB",
      isPartOf: { "@id": this.absoluteUrl("/#website") },
      ...(page.pageType === "ProfilePage" ? { mainEntity: this.person() } : {}),
      ...(crumbs ? { breadcrumb: this.breadcrumbList(crumbs) } : {})
    });
    for (const node of page.schema || []) graph.push(node);

    return {
      title: fullTitle,
      shortTitle: page.title,
      description,
      canonical,
      robots: this.config.isProduction && !page.noindex ? "index, follow, max-image-preview:large" : "noindex, nofollow",
      og: {
        type: page.type || "website",
        title: isHome ? fullTitle : page.title,
        description,
        url: canonical,
        image: imageUrl,
        imageAlt,
        siteName: this.site.domain,
        locale: this.site.locale
      },
      article: page.article ? { published: isoDate(page.article.published), modified: isoDate(page.article.modified || page.article.published) } : null,
      breadcrumbs: crumbs,
      jsonLd: { "@context": "https://schema.org", "@graph": graph }
    };
  }

  projectSchema(project) {
    return {
      "@type": "CreativeWork",
      "@id": `${this.absoluteUrl(project.url)}#project`,
      name: project.title,
      description: project.summary,
      url: this.absoluteUrl(project.url),
      creator: { "@id": this.absoluteUrl("/#person") },
      genre: project.kind,
      ...(project.stack?.length ? { keywords: project.stack.join(", ") } : {})
    };
  }

  articleSchema(article) {
    return {
      "@type": "BlogPosting",
      "@id": `${this.absoluteUrl(article.url)}#article`,
      headline: article.title,
      description: article.summary,
      url: this.absoluteUrl(article.url),
      mainEntityOfPage: this.absoluteUrl(article.url),
      datePublished: isoDate(article.date),
      dateModified: isoDate(article.updated || article.date),
      author: { "@id": this.absoluteUrl("/#person"), "@type": "Person", name: this.site.name, url: this.absoluteUrl("/about") },
      image: this.absoluteUrl(this.assets.url(this.config.seo.default_image)),
      inLanguage: "en-GB",
      ...(article.tags?.length ? { keywords: article.tags.join(", ") } : {})
    };
  }
}
