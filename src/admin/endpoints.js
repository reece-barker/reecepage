// Every address the site answers, with what it is for. Shown on the private /admin/system page. A test checks that
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
      { method: "GET", path: "/tools/:slug", what: "One tool", feature: "tools" },
      { method: "GET", path: "/:slug", what: "A page made in the admin, at its own address" }
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
      { method: "GET", path: "/admin/login", what: "Sign in: SimpleLogin (with its Proton button), a passkey, or the development sign in on your computer" },
      { method: "POST", path: "/admin/login/simplelogin", what: "Starts Sign in with SimpleLogin" },
      { method: "GET", path: "/admin/login/simplelogin/callback", what: "Where SimpleLogin sends you back to, checks the account is yours" },
      { method: "POST", path: "/admin/login/passkey/options", what: "The challenge for signing in with a passkey" },
      { method: "POST", path: "/admin/login/passkey", what: "Checks a passkey and signs in" },
      { method: "POST", path: "/admin/login/dev", what: "One click sign in, only in development" },
      { method: "POST", path: "/admin/logout", what: "Signs this browser out" },
      { method: "GET", path: "/admin", what: "Dashboard: new post buttons, whats scheduled, drafts, recent changes, GitHub" },
      { method: "GET", path: "/admin/account", what: "Passkeys and signed in browsers" },
      { method: "POST", path: "/admin/account/passkeys/options", what: "The challenge for adding a passkey" },
      { method: "POST", path: "/admin/account/passkeys", what: "Adds a passkey" },
      { method: "POST", path: "/admin/account/passkeys/:key/rename", what: "Renames a passkey" },
      { method: "POST", path: "/admin/account/passkeys/:key/remove", what: "Removes a passkey" },
      { method: "POST", path: "/admin/account/sessions/others", what: "Signs every other browser out" },
      { method: "GET", path: "/admin/media", what: "Upload, describe, publish and delete pictures and videos" },
      { method: "GET", path: "/admin/media/library.json", what: "The media library for the picker in the editor" },
      { method: "PUT", path: "/admin/media/upload", what: "The upload itself (sent by the media page and the editor)" },
      { method: "PUT", path: "/admin/media/:id/captions", what: "Adds captions to a video" },
      { method: "PUT", path: "/admin/media/:id/poster", what: "Sets a video's poster picture" },
      { method: "PUT", path: "/admin/media/:id/variant", what: "A smaller copy of a picture for phones (made in the browser when uploading)" },
      { method: "POST", path: "/admin/media/:id", what: "Saves title, alt text, caption, published and featured" },
      { method: "POST", path: "/admin/media/:id/delete", what: "Deletes an item and its files" },
      { method: "POST", path: "/admin/preview", what: "Keeps what the editor has for the live preview, nothing is saved" },
      { method: "GET", path: "/admin/preview/:key", what: "The live preview, the real page with the unsaved text" },
      { method: "GET", path: "/admin/lists/:name", what: "Edit the timeline, skills, CV, references, right now, branches, home page, menus or settings" },
      { method: "POST", path: "/admin/lists/:name", what: "Saves one of those" },
      { method: "GET", path: "/admin/lists/:name/revisions", what: "Earlier versions of one of those" },
      { method: "POST", path: "/admin/lists/:name/revisions/:rev/restore", what: "Brings an earlier version back" },
      { method: "GET", path: "/admin/sync", what: "The GitHub sync: whats been committed, problems, Sync now" },
      { method: "POST", path: "/admin/sync", what: "Runs the GitHub sync now" },
      { method: "GET", path: "/admin/system", what: "This page: live status, every address and links to the services behind the site" },
      { method: "GET", path: "/admin/:type", what: "Posts, pages, projects, tools or the legal pages, with drafts, scheduled and the trash" },
      { method: "GET", path: "/admin/:type/new", what: "A new post, page, project or tool" },
      { method: "POST", path: "/admin/:type/save", what: "Saves from the editor: draft, publish (now or at a time), update or autosave" },
      { method: "GET", path: "/admin/:type/:id", what: "The editor" },
      { method: "GET", path: "/admin/:type/:id/revisions", what: "Every saved version" },
      { method: "POST", path: "/admin/:type/:id/revisions/:rev/restore", what: "Brings an earlier version back" },
      { method: "POST", path: "/admin/:type/:id/trash", what: "Moves to the trash (off the site)" },
      { method: "POST", path: "/admin/:type/:id/restore", what: "Out of the trash as a draft" },
      { method: "POST", path: "/admin/:type/:id/delete", what: "Deletes for good, only from the trash" },
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
