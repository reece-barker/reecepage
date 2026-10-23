// What each editable piece of content looks like, so the admin can build a form for it and check what comes back.
// The browser builds the form from these, the server validates against the same thing, so they can never drift.
//
// Field types: text, textarea, markdown, date, url, email, tel, select (with options), checkbox,
// strings (a list of short texts) and objects (a list of items with their own fields).

const BRANCHES = ["code", "earth", "faith"];
export const BRANCH_LABELS = { code: "Code", earth: "Earth", faith: "People" };

export const DATA_SCHEMAS = {
  timeline: {
    file: "timeline.yml",
    title: "Experience and education",
    help: "The timeline on the about page and the CV. Newest first. Drag order with the up and down buttons.",
    comment: "Education and work, newest first. when is free text on purpose: some things are known by year, some by age",
    root: { type: "objects", itemLabel: "title", fields: [
      { name: "when", label: "When", type: "text", required: true, help: "Free text: 2024 to 2026, Since 2024, From February 2027" },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "place", label: "Where", type: "text" },
      { name: "kind", label: "Kind", type: "select", options: ["education", "work"], required: true },
      { name: "text", label: "What it was", type: "textarea" },
      { name: "planned", label: "Planned, not started yet", type: "checkbox" },
      { name: "cv", label: "Show on the CV", type: "checkbox", default: true }
    ] }
  },
  now: {
    file: "now.yml",
    title: "Right now",
    help: "The Right now section on the home and about pages. Change the date whenever you change the list.",
    comment: "What Reece is working on right now. Change the date whenever this list changes, the page shows it",
    root: { type: "object", fields: [
      { name: "updated", label: "Last updated", type: "date", required: true },
      { name: "items", label: "Things I am doing", type: "objects", itemLabel: "title", fields: [
        { name: "title", label: "Title", type: "text", required: true },
        { name: "text", label: "Text", type: "textarea" },
        { name: "link", label: "Link (a page on this site, like /projects/...)", type: "url" }
      ] },
      { name: "next", label: "Coming next", type: "strings" }
    ] }
  },
  references: {
    file: "references.yml",
    title: "References and quotes",
    help: "Quotes from employers, teachers and partners. Only shown when you tick that they agreed to it. Their email and phone only appear on the site when they agreed to that too, otherwise they stay here and in the private CV.",
    comment: "References from people Reece worked with. Nothing here is public unless permission is ticked",
    root: { type: "objects", itemLabel: "name", fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "role", label: "Their role", type: "text", required: true, help: "For example Head of IT" },
      { name: "organisation", label: "Organisation", type: "text", required: true },
      { name: "relationship", label: "How you know each other", type: "text", help: "For example My manager at MIS, 2024 to 2026" },
      { name: "quote", label: "Quote", type: "textarea", help: "Their words, exactly as they gave them" },
      { name: "date", label: "Date of the quote", type: "date" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "linkedin", label: "LinkedIn", type: "url" },
      { name: "permission", label: "They agreed to the quote being published with their name", type: "checkbox" },
      { name: "contact_public", label: "They agreed to their email and phone being shown on the website", type: "checkbox" },
      { name: "on_cv", label: "List them as a referee on the CV", type: "checkbox" }
    ] }
  },
  cv: {
    file: "cv.yml",
    title: "CV",
    help: "The parts of the one page CV that do not come from elsewhere. Experience comes from the timeline, skills from the skills list, projects from the projects marked for the CV.",
    comment: "The one page CV at /cv. Experience, skills and projects come from their own files",
    root: { type: "object", fields: [
      { name: "headline", label: "Headline under your name", type: "text", required: true },
      { name: "profile", label: "Profile (three or four lines)", type: "textarea", required: true },
      { name: "location", label: "Location", type: "text" },
      { name: "availability", label: "Availability", type: "text", help: "For example Internship from September 2027" },
      { name: "show_phone", label: "Show the phone number on the CV", type: "checkbox" },
      { name: "languages", label: "Languages", type: "objects", itemLabel: "name", fields: [
        { name: "name", label: "Language", type: "text", required: true },
        { name: "level", label: "Level", type: "text", required: true }
      ] },
      { name: "projects", label: "Projects on the CV (slugs, best first, three or four)", type: "strings" },
      { name: "extras", label: "Other lines (awards, certificates, volunteering)", type: "strings" },
      { name: "interests", label: "Interests", type: "text" }
    ] }
  },
  skills: {
    file: "skills.yml",
    title: "Skills",
    help: "Grouped skills, each with the projects (slugs) that show it. The content check fails if a slug does not exist.",
    comment: "Skills with the work that shows them. No self ratings or percentage bars, the evidence links do the talking",
    root: { type: "objects", itemLabel: "group", fields: [
      { name: "group", label: "Group", type: "text", required: true },
      { name: "items", label: "Skills", type: "objects", itemLabel: "name", fields: [
        { name: "name", label: "Skill", type: "text", required: true },
        { name: "evidence", label: "Shown in (project slugs)", type: "strings" },
        { name: "note", label: "Note", type: "text" }
      ] }
    ] }
  },
  branches: {
    file: "branches.yml",
    title: "The three branches",
    help: "The code, earth and people texts next to the tree on the home page.",
    comment: "The three branches of the tree on the home page. limb is the index the tree script uses to light the right branch",
    fixedLength: true,
    root: { type: "objects", itemLabel: "title", fields: [
      { name: "id", label: "Id", type: "select", options: BRANCHES, required: true },
      { name: "limb", label: "Tree limb (0, 1 or 2)", type: "select", options: ["0", "1", "2"], required: true, number: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "text", label: "Text", type: "textarea", required: true }
    ] }
  }
};

// The other documents: settings, menus and the home page texts. Anything left empty falls back to the default
// that is built into the site (config/application.yml or the template), so an empty form never breaks a page
const LINK_FIELDS = [
  { name: "label", label: "Label", type: "text", required: true, max: 40 },
  { name: "href", label: "Address", type: "url", required: true, help: "A page on this site like /projects, or a full https:// address" }
];

Object.assign(DATA_SCHEMAS, {
  settings: {
    title: "Site settings",
    help: "Your name, description, email and profiles as they appear in the header, footer, search results and share cards. Leave a field empty to use the built in default.",
    root: { type: "object", fields: [
      { name: "name", label: "Site name", type: "text", max: 60, help: "Shown in the header, the browser tab and search results" },
      { name: "short_name", label: "Short name", type: "text", max: 30, help: "Used where space is tight, like a phone home screen" },
      { name: "description", label: "Description", type: "textarea", max: 300, help: "The one or two sentences search engines and share cards show for the home page" },
      { name: "email", label: "Public email", type: "email" },
      { name: "profiles", label: "Profiles", type: "object", fields: [
        { name: "linkedin", label: "LinkedIn", type: "url" },
        { name: "github", label: "GitHub", type: "url" }
      ] },
      { name: "knows_about", label: "Topics you know about (for search engines)", type: "strings" },
      { name: "legal_updated", label: "Legal pages last updated", type: "date", help: "The Stand date at the bottom of the legal pages. Change it whenever you change one of them" },
      { name: "pages", label: "Descriptions of the built in pages", type: "object", fields: [
        { name: "about", label: "About", type: "textarea", max: 300 },
        { name: "projects", label: "Projects", type: "textarea", max: 300 },
        { name: "writing", label: "Writing", type: "textarea", max: 300 },
        { name: "media", label: "Media", type: "textarea", max: 300 },
        { name: "cv", label: "CV", type: "textarea", max: 300 },
        { name: "references", label: "References", type: "textarea", max: 300 },
        { name: "contact", label: "Contact", type: "textarea", max: 300 }
      ] }
    ] }
  },
  menus: {
    title: "Menus",
    help: "The links in the header and footer. Links to sections that are switched off (like writing) are hidden automatically.",
    root: { type: "object", fields: [
      { name: "primary", label: "Header menu", type: "objects", itemLabel: "label", fields: LINK_FIELDS },
      { name: "more", label: "Extra footer links", type: "objects", itemLabel: "label", fields: LINK_FIELDS },
      { name: "legal", label: "Legal links in the footer", type: "objects", itemLabel: "label", fields: LINK_FIELDS }
    ] }
  },
  home: {
    title: "Home page",
    help: "The texts on the home page. The tree branches, the selected projects (tick On the home page on a project) and Right now have their own editors.",
    root: { type: "object", fields: [
      { name: "hero_lede", label: "Intro under your name", type: "textarea", max: 400 },
      { name: "hero_button", label: "Main button", type: "text", max: 40 },
      { name: "hero_link", label: "Second link", type: "text", max: 40 },
      { name: "branches_heading", label: "Tree heading", type: "text", max: 80 },
      { name: "branches_intro", label: "Tree intro", type: "textarea", max: 300 },
      { name: "intro_heading", label: "Video heading", type: "text", max: 80 },
      { name: "intro_text", label: "Video text (when the video has no caption)", type: "textarea", max: 300 },
      { name: "work_heading", label: "Selected work heading", type: "text", max: 80 },
      { name: "work_intro", label: "Selected work intro", type: "textarea", max: 300 },
      { name: "contact_heading", label: "Contact heading", type: "text", max: 80 },
      { name: "contact_lead", label: "Contact text", type: "textarea", max: 300 },
      { name: "contact_button", label: "Contact button", type: "text", max: 40 }
    ] }
  }
});

// Documents that never go to GitHub. references holds people's private email addresses and phone numbers until
// they agree to them being public, the repository is public, so it stays in the database only
export const PRIVATE_DOCUMENTS = ["references"];

// Posts, pages, projects, tools and the legal pages. title and the body are edited in the main area of the editor,
// these fields go in the sidebar next to it. editor is "blocks" (the block editor with Markdown) or "template"
// (the Handlebars source, for the legal pages)
const SEO_DESCRIPTION = { name: "description", label: "Search description", type: "textarea", max: 160, help: "What search engines show under the title. Leave empty to use the summary", group: "seo" };

export const ENTRY_SCHEMAS = {
  writing: {
    title: "Posts",
    singular: "post",
    publicPath: (slug) => `/writing/${slug}`,
    titleMax: 100,
    editor: "blocks",
    fields: [
      { name: "summary", label: "Summary", type: "textarea", required: true, max: 220, help: "One or two sentences, shown in lists and the feed" },
      { name: "date", label: "Published date", type: "date", help: "Leave empty and it becomes the day it goes live" },
      { name: "updated", label: "Updated date", type: "date" },
      { name: "tags", label: "Tags", type: "strings" },
      SEO_DESCRIPTION,
      { name: "todo", label: "Still missing (only you see this)", type: "strings", group: "notes" }
    ]
  },
  pages: {
    title: "Pages",
    singular: "page",
    publicPath: (slug) => `/${slug}`,
    titleMax: 120,
    editor: "blocks",
    fields: [
      { name: "lead", label: "Intro line", type: "textarea", max: 300, help: "The larger line under the title" },
      SEO_DESCRIPTION
    ]
  },
  projects: {
    title: "Projects",
    singular: "project",
    publicPath: (slug) => `/projects/${slug}`,
    titleMax: 80,
    editor: "blocks",
    fields: [
      { name: "summary", label: "Summary", type: "textarea", required: true, max: 220, help: "One or two sentences, about 160 characters" },
      { name: "branch", label: "Branch", type: "select", options: BRANCHES, labels: { code: "Code", earth: "Earth", faith: "People" }, required: true },
      { name: "kind", label: "Kind", type: "text", required: true, help: "Startup, Course project, Work, Freelance, Personal" },
      { name: "context", label: "Context", type: "text" },
      { name: "period", label: "Period as shown", type: "text", required: true, help: "2026, or 2026 to February 2027" },
      { name: "sort_date", label: "Sort date (newest first)", type: "text", required: true, help: "2026-09" },
      { name: "role", label: "My role", type: "text" },
      { name: "team", label: "Team", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "stack", label: "Tools and methods", type: "strings" },
      { name: "facts", label: "At a glance", type: "objects", itemLabel: "label", fields: [
        { name: "label", label: "Label", type: "text", required: true },
        { name: "value", label: "Value", type: "text", required: true }
      ] },
      { name: "links", label: "Links", type: "objects", itemLabel: "label", fields: [
        { name: "label", label: "Label", type: "text", required: true },
        { name: "url", label: "Address", type: "url", required: true }
      ] },
      { name: "featured", label: "On the home page", type: "checkbox" },
      { name: "order", label: "Order on the home page (1 first)", type: "text", number: true },
      { name: "page", label: "Has its own page", type: "checkbox", default: true },
      SEO_DESCRIPTION,
      { name: "todo", label: "Still missing (only you see this)", type: "strings", group: "notes" }
    ]
  },
  tools: {
    title: "Tools",
    singular: "tool",
    feature: "tools",
    publicPath: (slug) => `/tools/${slug}`,
    titleMax: 80,
    editor: "blocks",
    fields: [
      { name: "summary", label: "Summary", type: "textarea", required: true, max: 220 },
      { name: "status", label: "Status", type: "text" },
      { name: "launch_url", label: "Launch address", type: "url" },
      { name: "order", label: "Order (1 first)", type: "text", number: true },
      SEO_DESCRIPTION,
      { name: "todo", label: "Still missing (only you see this)", type: "strings", group: "notes" }
    ]
  },
  legal: {
    title: "Legal pages",
    singular: "legal page",
    publicPath: (slug) => `/${slug}`,
    titleMax: 120,
    editor: "template",
    fixed: true,
    fields: [
      { name: "description", label: "Search description", type: "textarea", required: true, max: 200 }
    ]
  }
};

// Addresses a page made in the admin cant have, because something else already lives there
export const RESERVED_SLUGS = [
  "admin", "about", "projects", "writing", "tools", "media", "cv", "references", "status", "contact", "impressum", "privacy",
  "terms", "accessibility", "copyright", "cookies", "robots-txt", "sitemap-xml", "llms-txt", "health", "errors", "assets",
  "icons", "well-known", "feed", "search", "login", "logout", "api"
];

const MAX_TEXT = 20000;

/**
 * Checks and cleans a value against a field list. Unknown keys are dropped, empty optional values left out, so the
 * files stay tidy. Returns { value, errors } with errors as "path: message" strings
 */
export function cleanValue(field, raw, path = field.label || field.name, { lenient = false } = {}) {
  const errors = [];
  const t = field.type;
  if (t === "objects") {
    const list = Array.isArray(raw) ? raw : [];
    const value = list.map((item, i) => {
      const out = cleanObject(field.fields, item, `${path} ${i + 1}`, { lenient });
      errors.push(...out.errors);
      return out.value;
    });
    return { value, errors };
  }
  if (t === "object") return cleanObject(field.fields, raw, path, { lenient });
  if (t === "strings") {
    const value = (Array.isArray(raw) ? raw : []).map((s) => String(s ?? "").trim()).filter(Boolean).map((s) => s.slice(0, 500));
    return { value, errors };
  }
  if (t === "checkbox") return { value: raw === true || raw === "on" || raw === "true", errors };
  let value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
  if (value.length > (field.max || MAX_TEXT)) errors.push(`${path}: is longer than ${field.max || MAX_TEXT} characters`);
  if (field.required && !value && !lenient) errors.push(`${path}: is required`);
  if (value && t === "select" && !field.options.includes(value)) errors.push(`${path}: must be one of ${field.options.join(", ")}`);
  if (value && t === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push(`${path}: must be a date like 2026-10-12`);
  if (value && t === "url" && !/^(https?:\/\/|\/)[^\s]*$/.test(value)) errors.push(`${path}: must start with https:// or /`);
  if (value && t === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${path}: is not an email address`);
  if (field.number && value) {
    if (!/^-?\d+$/.test(value)) errors.push(`${path}: must be a whole number`);
    else value = Number(value);
  }
  return { value, errors };
}

/** lenient skips the "is required" checks, for drafts that are still being written */
export function cleanObject(fields, raw, path = "", { lenient = false } = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const value = {};
  const errors = [];
  for (const field of fields) {
    const out = cleanValue(field, source[field.name], path ? `${path}, ${field.label}` : field.label, { lenient });
    errors.push(...out.errors);
    const v = out.value;
    const empty = v === "" || v === false || (Array.isArray(v) && v.length === 0) || (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
    // Checkboxes that default to on (like "Has its own page") must be written when they are off
    if (field.type === "checkbox" && field.default === true) { if (v === false) value[field.name] = false; continue; }
    if (!empty) value[field.name] = v;
  }
  return { value, errors };
}
