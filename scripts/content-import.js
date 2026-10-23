// npm run content:import             adds anything in content/ that isnt in the database yet
// npm run content:import -- --force  makes the database match content/ for every file in there
//
// Use it on your Mac after a git pull, the admin on the live site commits everything it publishes to GitHub so
// content/ is the newest published version. --force overwrites local edits to those entries, drafts that only
// exist in your local database are left alone either way. It never deletes anything
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/lib/logger.js";
import { createDatabase } from "../src/database/index.js";
import { createMigrator } from "../src/database/migrator.js";
import { ContentRepository } from "../src/repositories/content-repository.js";
import { importContent } from "../src/services/content-import.js";

const overwrite = process.argv.includes("--force");
const config = loadConfig();
const logger = createLogger({ ...config, logLevel: "warn" });
const database = createDatabase(config, logger);
if (!database) {
  console.error("No database is configured (DB_DIALECT=none), theres nothing to import into.");
  process.exit(1);
}
try {
  if (database.dialect === "sqlite") await createMigrator(database, null).up();
  const report = await importContent({ repository: new ContentRepository(database), contentDir: config.paths.content, overwrite });
  console.log(`Added ${report.added.length}, updated ${report.updated.length}, left alone ${report.skipped.length}.`);
  for (const line of report.failed) console.log(`  Not imported, ${line}`);
  if (report.skipped.length && !overwrite) console.log("Things that were already in the database were left alone, add -- --force to replace them with the file version.");
  if (report.failed.length) process.exitCode = 1;
} catch (error) {
  console.error(`Import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
