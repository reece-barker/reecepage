// What each editable piece of content looks like, so the admin can build a form for it and check what comes back.
// The browser builds the form from these, the server validates against the same thing, so they can never drift.
//
// Field types: text, textarea, markdown, date, url, email, tel, select (with options), checkbox,
// strings (a list of short texts) and objects (a list of items with their own fields).

const BRANCHES = ["code", "earth", "faith"];

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
    help: "The code, earth and faith texts next to the tree on the home page.",
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

export const DOCUMENT_SCHEMAS = {
  projects: {
    title: "Projects",
    singular: "project",
    help: "Each project is a Markdown file in content/projects. Headings with ## build the On this page list. Put pictures and videos in with their [[media:...]] code from the media library.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 80 },
      { name: "summary", label: "Summary (one or two sentences, about 160 characters)", type: "textarea", required: true, max: 220 },
      { name: "branch", label: "Branch", type: "select", options: BRANCHES, required: true },
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
      { name: "draft", label: "Draft (hidden everywhere)", type: "checkbox" },
      { name: "todo", label: "Still missing (only shown while developing)", type: "strings" }
    ]
  },
  writing: {
    title: "Writing",
    singular: "article",
    help: "Each article is a Markdown file in content/writing. Headings with ## build the On this page list. Pictures and videos go in with their [[media:...]] code on a line of their own.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 100 },
      { name: "summary", label: "Summary (one or two sentences)", type: "textarea", required: true, max: 220 },
      { name: "date", label: "Published", type: "date", required: true },
      { name: "updated", label: "Updated", type: "date" },
      { name: "tags", label: "Tags", type: "strings" },
      { name: "draft", label: "Draft (hidden everywhere)", type: "checkbox" },
      { name: "todo", label: "Still missing (only shown while developing)", type: "strings" }
    ]
  }
};

const MAX_TEXT = 20000;

/**
 * Checks and cleans a value against a field list. Unknown keys are dropped, empty optional values left out, so the
 * files stay tidy. Returns { value, errors } with errors as "path: message" strings
 */
export function cleanValue(field, raw, path = field.label || field.name) {
  const errors = [];
  const t = field.type;
  if (t === "objects") {
    const list = Array.isArray(raw) ? raw : [];
    const value = list.map((item, i) => {
      const out = cleanObject(field.fields, item, `${path} ${i + 1}`);
      errors.push(...out.errors);
      return out.value;
    });
    return { value, errors };
  }
  if (t === "object") return cleanObject(field.fields, raw, path);
  if (t === "strings") {
    const value = (Array.isArray(raw) ? raw : []).map((s) => String(s ?? "").trim()).filter(Boolean).map((s) => s.slice(0, 500));
    return { value, errors };
  }
  if (t === "checkbox") return { value: raw === true || raw === "on" || raw === "true", errors };
  let value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
  if (value.length > (field.max || MAX_TEXT)) errors.push(`${path}: is longer than ${field.max || MAX_TEXT} characters`);
  if (field.required && !value) errors.push(`${path}: is required`);
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

export function cleanObject(fields, raw, path = "") {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const value = {};
  const errors = [];
  for (const field of fields) {
    const out = cleanValue(field, source[field.name], path ? `${path}, ${field.label}` : field.label);
    errors.push(...out.errors);
    const v = out.value;
    const empty = v === "" || v === false || (Array.isArray(v) && v.length === 0);
    // Checkboxes that default to on (like "Has its own page") must be written when they are off
    if (field.type === "checkbox" && field.default === true) { if (v === false) value[field.name] = false; continue; }
    if (!empty) value[field.name] = v;
  }
  return { value, errors };
}
