// npm run content:apply -- --since <commit>
//
// The deploy runs this after git pull with the commit the server was on before. Every file in content/ that changed
// between that commit and now goes into the database, unless it was edited in the admin in the meantime, those
// are left alone and listed. See src/services/content-apply.js for the rules. --dry-run only prints the plan.
//
// It never stops a deploy: a conflict or a file that doesnt save is printed and the rest carries on
import { execFileSync } from "node:child_process";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/lib/logger.js";
import { createDatabase } from "../src/database/index.js";
import { ContentRepository } from "../src/repositories/content-repository.js";
import { applyPlan, databaseText, planApply } from "../src/services/content-apply.js";
import { recordForPath } from "../src/services/content-records.js";

const args = process.argv.slice(2);
const since = args[args.indexOf("--since") + 1];
const dryRun = args.includes("--dry-run");
const git = (...gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

if (!args.includes("--since") || !since || since.startsWith("--")) {
  console.error("Say which commit to compare with: npm run content:apply -- --since <commit>");
  process.exit(1);
}

let changed;
try {
  git("cat-file", "-e", `${since}^{commit}`);
  changed = git("diff", "--name-only", "-z", "--no-renames", since, "HEAD", "--", "content/").split("\0").filter(Boolean);
} catch {
  // A shallow clone or a rewritten history, theres nothing safe to compare with so nothing is touched
  console.log(`Commit ${since} isnt in this checkout, no content was applied.`);
  process.exit(0);
}

const show = (rev, file) => {
  try { return git("show", `${rev}:${file}`); } catch { return null; }
};
const changes = changed.filter((file) => recordForPath(file)).map((file) => ({ path: file, before: show(since, file), after: show("HEAD", file) }));
if (!changes.length) {
  console.log("No content files changed.");
  process.exit(0);
}

const config = loadConfig();
const logger = createLogger({ ...config, logLevel: "warn" });
const database = createDatabase(config, logger);
if (!database) {
  console.log("No database is configured, nothing to apply.");
  process.exit(0);
}

try {
  const repository = new ContentRepository(database);
  const current = new Map();
  for (const change of changes) current.set(change.path, await databaseText(repository, recordForPath(change.path)));
  const plan = planApply(changes, (record, change) => current.get(change.path));

  for (const file of plan.same) console.log(`  same      ${file}`);
  for (const item of plan.apply) console.log(`  ${dryRun ? "would add" : "applying "} ${item.path}`);
  for (const file of plan.conflicts) console.log(`  CONFLICT  ${file} was changed in the admin since, left alone. Make the change there.`);
  for (const file of plan.deleted) console.log(`  deleted   ${file} is gone from the repo but still on the site, move it to the trash in the admin if thats right.`);

  if (!dryRun) {
    const result = await applyPlan(repository, plan);
    for (const line of result.failed) console.log(`  FAILED    ${line}`);
    console.log(`Content: ${result.written.length} applied, ${plan.same.length} allready there, ${plan.conflicts.length} conflicts, ${result.failed.length} failed.`);
  }
} catch (error) {
  console.error(`Content apply stopped: ${error.message}`);
} finally {
  await database.close();
}

