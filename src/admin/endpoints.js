// Every address the site answers, with what it is for. Shown on the private /admin link board. A test checks that
// every route in src/routes/index.js is listed here, so this can't quietly go out of date.

export const ENDPOINT_GROUPS = [
  {
    title: "Pages people visit",
    items: [
      { method: "GET", path: "/", what: "Home: the tree, the three branches, the introduction video, selected work, right now" },
      { method: "GET", path: "/about", what: "My story, experience and education timeline, skills with their evidence" },
      { method: "GET", path: "/projects", what: "All projects, filter with ?branch=code or ?branch=earth" },
      { method: "GET", path: "/projects/:slug", what: "One project (only projects with their own page)" },
      { method: "GET", path: "/writing", what: "All articles", feature: "writing" },
      { method: "GET", path: "/writing/:slug", what: "One article", feature: "writing" },
      { method: "GET", path: "/media", what: "The introduction video and the published pictures and videos", feature: "media" },
      { method: "GET", path: "/media/:slug", what: "One picture or video on its own page", feature: "media" },
      { method: "GET", path: "/cv", what: "The one page CV, built from the timeline, skills, projects and cv.yml" },
      { method: "GET", path: "/references", what: "Quotes from people I worked with, only those with permission ticked" },
      { method: "GET", path: "/contact", what: "Contact form and email address" },
      { method: "POST", path: "/contact", what: "Sends the contact form (CSRF, rate limit, honeypot, saved then emailed)" },
      { method: "GET", path: "/contact/thank-you", what: "Shown after sending, not indexed" },
      { method: "GET", path: "/status", what: "Public live status of the website, database, contact form and media", feature: "status_page" },
      { method: "GET", path: "/tools", what: "Tools directory, switched off until features.tools and content/tools", feature: "tools" },
      { method: "GET", path: "/tools/:slug", what: "One tool", feature: "tools" }
    ]
  },
  {
    title: "Legal",
    items: [
      { method: "GET", path: "/impressum", what: "Impressum under section 5 DDG, German and English" },
      { method: "GET", path: "/privacy", what: "Privacy policy, English and German" },
      { method: "GET", path: "/terms", what: "Terms of use" },
      { method: "GET", path: "/cookies", what: "Cookie list and settings" },
      { method: "POST", path: "/cookies", what: "Saves the cookie choice (only matters once analytics is on)" },
      { method: "GET", path: "/accessibility", what: "Accessibility statement" },
      { method: "GET", path: "/copyright", what: "Copyright, licences and music credits" }
    ]
  },
  {
    title: "Files and feeds",
    items: [
      { method: "GET", path: "/cv/reece-barker-cv.pdf", what: "The CV as a PDF to download (made with npm run cv:pdf or the button in the admin)" },
      { method: "GET", path: "/media/files/:name", what: "The uploaded files themselves, with byte ranges for video seeking" },
      { method: "GET", path: "/writing/feed.xml", what: "Atom feed of the articles, for feed readers", feature: "writing" },
      { method: "GET", path: "/sitemap.xml", what: "Every public page for search engines" },
      { method: "GET", path: "/robots.txt", what: "Crawler rules, blocks everything outside production" },
      { method: "GET", path: "/llms.txt", what: "A plain summary of the site for AI assistants" },
      { method: "GET", path: "/site.webmanifest", what: "App manifest (name, icons, colours)" },
      { method: "GET", path: "/.well-known/security.txt", what: "Where to report security problems" },
      { method: "GET", path: "/.well-known/tdmrep.json", what: "Text and data mining reservation" }
    ]
  },
  {
    title: "Machines and monitoring",
    items: [
      { method: "GET", path: "/health", what: "Is the Node process up (uptime monitors)" },
      { method: "GET", path: "/health/ready", what: "Process and database, 503 when the database is gone (load balancers, GlitchTip uptime)" },
      { method: "POST", path: "/errors", what: "Browser errors from the site's own script, forwarded to GlitchTip" }
    ]
  },
  {
    title: "Admin (password protected)",
    items: [
      { method: "GET", path: "/admin", what: "This link board, live status and shortcuts" },
      { method: "GET", path: "/admin/media", what: "Upload, describe, publish and delete pictures and videos" },
      { method: "PUT", path: "/admin/media/upload", what: "The upload itself (sent by the media page)" },
      { method: "PUT", path: "/admin/media/:id/captions", what: "Adds captions to a video" },
      { method: "PUT", path: "/admin/media/:id/poster", what: "Sets a video's poster picture" },
      { method: "POST", path: "/admin/media/:id", what: "Saves title, alt text, caption, published and featured" },
      { method: "POST", path: "/admin/media/:id/delete", what: "Deletes an item and its files" },
      { method: "GET", path: "/admin/content/:collection", what: "Projects or articles, list and editor" },
      { method: "GET", path: "/admin/content/:collection/new", what: "A new project or article" },
      { method: "GET", path: "/admin/content/:collection/:slug", what: "Edit one project or article" },
      { method: "POST", path: "/admin/content/:collection", what: "Saves a project or article to its Markdown file" },
      { method: "POST", path: "/admin/content/:collection/:slug/delete", what: "Deletes a project or article" },
      { method: "GET", path: "/admin/data/:name", what: "Edit the timeline, right now, references, CV, skills or branches" },
      { method: "POST", path: "/admin/data/:name", what: "Saves one of those files" },
      { method: "POST", path: "/admin/preview", what: "Renders Markdown for the editor preview" },
      { method: "POST", path: "/admin/cv-pdf", what: "Makes a new CV PDF (on your computer only)" }
    ]
  }
];

/** Places outside the site that belong to it, for the same board */
export const EXTERNAL_LINKS = [
  { label: "GlitchTip (errors and uptime)", url: "https://errors.reece.page" },
  { label: "Hetzner Cloud console", url: "https://console.hetzner.cloud" },
  { label: "Cloudflare dashboard", url: "https://dash.cloudflare.com" },
  { label: "Proton Mail", url: "https://mail.proton.me" },
  { label: "Google Search Console", url: "https://search.google.com/search-console" },
  { label: "Bing Webmaster Tools", url: "https://www.bing.com/webmasters" },
  { label: "GitHub", url: "https://github.com/reece-barker" }
];
