// Gets content changes made in a code pull request into the live database on deploy, without ever overwriting
// something that was edited in the admin in the meantime.
//
// The database is the real copy and the admin mirrors every save to content/ on GitHub. So when a PR changes a
// file in content/ the deploy compares three versions of it: the file before the deploy, the file after, and what
// the database holds right now.
//
//   database == new file   nothing to do, its allready there (this is every mirror commit from the admin)
//   database == old file   nobody touched it in the admin, so the PR's version goes in
//   anything else          it was changed in the admin since, left alone and listed as a conflict
//
// Files are compared in the admin's own format (canonicalText) so spacing or quoting in a hand written file
// doesnt count as a change. Files a PR deletes are never deleted from the database, theyre listed so you can bin
// them in the admin where theres a trash and revisions.
import { buildEntry, isLive } from "./content-service.js";
import { PRIVATE_DOCUMENTS } from "../admin/schemas.js";
import { canonicalText, documentToFile, entryFromText, entryToFile, plainDates, recordForPath } from "./content-records.js";
import { load as parseYaml } from "js-yaml";

/**
 * Works out what to do with each changed file. Pure, so its easy to test
 *
 * @param {Array<{ path: string, before: string|null, after: string|null }>} changes file texts before and after
 * @param {(record: object, change: object) => string|null} currentText the database version of a record in file form, null when theres none
 * @returns {{ apply: object[], same: string[], conflicts: string[], deleted: string[], ignored: string[] }}
 */
export function planApply(changes, currentText) {
  const plan = { apply: [], same: [], conflicts: [], deleted: [], ignored: [] };
  for (const change of changes) {
    const record = recordForPath(change.path);
    if (!record || (record.kind === "document" && PRIVATE_DOCUMENTS.includes(record.name))) { plan.ignored.push(change.path); continue; }
    const before = canonicalText(change.path, change.before);
    const after = canonicalText(change.path, change.after);
    const now = currentText(record, change);
    if (now === after) { plan.same.push(change.path); continue; }
    if (now !== before) { plan.conflicts.push(change.path); continue; }
    if (change.after === null) { plan.deleted.push(change.path); continue; }
    plan.apply.push({ path: change.path, record, text: change.after });
  }
  return plan;
}

/** The database version of a record as file text, the same way the GitHub mirror writes it */
export async function databaseText(repository, record, now = new Date()) {
  if (record.kind === "document") {
    const data = await repository.getDocument(record.name);
    return data === null ? null : documentToFile(record.name, data);
  }
  const entry = await repository.findEntry(record.type, record.slug);
  if (!entry) return null;
  // A draft, a scheduled one or one in the trash is there but not live. That never matches a file, so a PR that
  // adds a file with the same address counts as a conflict instead of bringing it back
  return isLive(entry, now) ? entryToFile(entry) : `\u0000${entry.status}`;
}

/**
 * Applies a plan. Each record is checked the same way as a save in the admin first, one that wouldnt save is
 * reported and skipped. Returns what was written and what failed
 */
export async function applyPlan(repository, plan) {
  const written = [];
  const failed = [];
  for (const item of plan.apply) {
    try {
      if (item.record.kind === "document") {
        await repository.saveDocument(item.record.name, plainDates(parseYaml(item.text)), { reason: "deploy" });
      } else {
        const entry = entryFromText(item.record.type, item.record.slug, item.text);
        if (item.record.type !== "legal") buildEntry(entry);
        const existing = await repository.findEntry(item.record.type, item.record.slug);
        await repository.saveEntry({ ...entry, id: existing?.id }, { reason: "deploy" });
      }
      written.push(item.path);
    } catch (error) {
      failed.push(`${item.path}: ${error.problem || error.message}`);
    }
  }
  return { written, failed };
}
