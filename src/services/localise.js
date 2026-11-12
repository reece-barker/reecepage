// Puts the german text on top of the english content when a page is shown in german. The german is stored next to the
// english in the same entry (a de: block in the front matter like the cv timeline allready did it) and anything
// without a german version just stays english so a half translated site never has holes in it.
import { truncate } from "../utils/text.js";

/** "Since 2024" -> "Seit 2024" and "2026 to 2027" -> "2026 bis 2027", only used when no german version was written */
export function germanWhen(when) {
  return String(when || "").replace(/^Since\b/, "Seit").replace(/^From\b/, "Ab").replace(/\bto\b/g, "bis").replace(/\band\b/g, "und").replace(/^Summers?\b/, "Sommer");
}

const filled = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));

/** Projects, translated says if the long text is german too and the page shows a note when its not */
export function localiseProject(project, lang) {
  if (lang !== "de") return { ...project, translated: true };
  const de = project.de || {};
  return {
    ...project,
    title: de.title || project.title,
    summary: de.summary || project.summary,
    description: de.description || (de.summary ? truncate(de.summary, 160) : project.description),
    kind: de.kind || project.kind,
    context: de.context || project.context,
    period: de.period || germanWhen(project.period),
    role: de.role || project.role,
    team: de.team || project.team,
    status: de.status || project.status,
    facts: filled(de.facts) ? de.facts : project.facts,
    links: filled(de.links) ? de.links : project.links,
    html: de.html || project.html,
    headings: de.html ? de.headings : project.headings,
    translated: Boolean(de.html)
  };
}

/** Pages made in the admin and the about page */
export function localisePage(page, lang) {
  if (!page || lang !== "de") return page ? { ...page, translated: true } : page;
  const de = page.de || {};
  return {
    ...page,
    title: de.title || page.title,
    lead: de.lead || page.lead,
    description: de.description || page.description,
    html: de.html || page.html,
    headings: de.html ? de.headings : page.headings,
    translated: Boolean(de.html)
  };
}

export function localiseTimeline(timeline, lang) {
  if (lang !== "de") return timeline;
  return (timeline || []).map((item) => ({
    ...item,
    when: item.de?.when || germanWhen(item.when),
    title: item.de?.title || item.title,
    place: item.de?.place || item.place,
    text: item.de?.text || item.text
  }));
}

export function localiseSkills(groups, lang) {
  if (lang !== "de") return groups;
  return (groups || []).map((group) => ({
    ...group,
    group: group.group_de || group.group,
    items: (group.items || []).map((item) => ({ ...item, name: item.name_de || item.name, note: item.note_de || item.note }))
  }));
}

export function localiseBranches(branches, lang) {
  if (lang !== "de") return branches;
  return (branches || []).map((branch) => ({ ...branch, title: branch.de?.title || branch.title, text: branch.de?.text || branch.text }));
}

export function localiseNow(now, lang) {
  if (!now || lang !== "de") return now;
  return {
    ...now,
    items: (now.items || []).map((item) => ({ ...item, title: item.de?.title || item.title, text: item.de?.text || item.text })),
    next: filled(now.de?.next) ? now.de.next : now.next
  };
}

/** Articles stay english, only the stuff around them is german */
export function localiseArticle(article) {
  return article;
}
