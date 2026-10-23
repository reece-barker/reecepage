// Puts the files from content/ into the database. Runs on its own the first time the app starts with empty content
// tables (so the first deploy just works), and by hand with npm run content:import to pull the files from git into
// your local database after a git pull. Each file is checked the same way as a save in the admin, a broken file
// is reported and skipped instead of stopping the rest.
import { readContentFolder } from "./content-records.js";
import { buildEntry } from "./content-service.js";

/**
 * @param {object} options
 * @param {import("../repositories/content-repository.js").ContentRepository} options.repository
 * @param {string} options.contentDir
 * @param {boolean} [options.overwrite] replace what is in the database with the file version, default only adds new
 * @returns {Promise<{ added: string[], updated: string[], skipped: string[], failed: string[] }>}
 */
export async function importContent({ repository, contentDir, overwrite = false }) {
  const { entries, documents } = readContentFolder(contentDir);
  const report = { added: [], updated: [], skipped: [], failed: [] };

  for (const entry of entries) {
    const label = `${entry.type}/${entry.slug}`;
    try {
      buildEntry(entry);
    } catch (error) {
      report.failed.push(`${label}: ${error.problem || error.message}`);
      continue;
    }
    const existing = await repository.findEntry(entry.type, entry.slug);
    if (existing && !overwrite) { report.skipped.push(label); continue; }
    await repository.saveEntry({ ...entry, id: existing?.id }, { reason: "import" });
    (existing ? report.updated : report.added).push(label);
  }

  for (const [name, data] of Object.entries(documents)) {
    const label = `data/${name}`;
    const existing = await repository.getDocument(name);
    if (existing !== null && !overwrite) { report.skipped.push(label); continue; }
    await repository.saveDocument(name, data, { reason: "import" });
    (existing !== null ? report.updated : report.added).push(label);
  }
  return report;
}

/** The first start: only when there is nothing at all in the content tables */
export async function importIfEmpty({ repository, contentDir, logger }) {
  if (!(await repository.isEmpty())) return null;
  const report = await importContent({ repository, contentDir });
  logger?.info({ added: report.added.length, failed: report.failed }, "content imported from content/ into the database");
  return report;
}
