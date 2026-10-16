// Database jobs from the command line.
//
//   npm run db:migrate     run every migration that hasnt run yet
//   npm run db:rollback    undo the last migration (asks no questions, so think first in production)
//   npm run db:status      list which migrations have run and which are waiting
//   npm run db:seed        put example messages in a development database (refuses in production)
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/lib/logger.js";
import { createDatabase } from "../src/database/index.js";
import { createMigrator, createSeeder } from "../src/database/migrator.js";

const command = process.argv[2];
const config = loadConfig();
const logger = createLogger({ ...config, logLevel: "warn" });
const database = createDatabase(config, logger);

if (!database) {
  console.error("No database is configured (DB_DIALECT=none). Set the DB_* values in .env first.");
  process.exit(1);
}

try {
  await database.ping();
  const migrator = createMigrator(database, null);
  switch (command) {
    case "migrate": {
      const done = await migrator.up();
      console.log(done.length ? `Ran ${done.length}: ${done.map((m) => m.name).join(", ")}` : "Nothing to run, the database is up to date.");
      break;
    }
    case "rollback": {
      const undone = await migrator.down();
      console.log(undone.length ? `Rolled back ${undone[0].name}` : "Nothing to roll back.");
      break;
    }
    case "status": {
      const executed = await migrator.executed();
      const pending = await migrator.pending();
      console.log(`Database: ${config.database.dialect}${config.database.dialect === "mysql" ? ` ${config.database.name}@${config.database.host}` : ` ${config.database.storage}`}`);
      for (const m of executed) console.log(`  done     ${m.name}`);
      for (const m of pending) console.log(`  waiting  ${m.name}`);
      if (!executed.length && !pending.length) console.log("  no migrations found");
      break;
    }
    case "seed": {
      // Seed data is fake on purpose and would end up in the contact list, so never in production
      if (config.isProduction) throw new Error("Seeding is only for development and test databases.");
      await migrator.up();
      const done = await createSeeder(database, null).up();
      console.log(done.length ? `Seeded: ${done.map((m) => m.name).join(", ")}` : "Seeds already in.");
      break;
    }
    default:
      console.error("Use one of: migrate, rollback, status, seed");
      process.exitCode = 1;
  }
} catch (error) {
  console.error(`Database job failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
