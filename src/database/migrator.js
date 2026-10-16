// Runs the migrations in src/database/migrations with Umzug and keeps track of them in the SequelizeMeta table,
// the same table sequelize-cli uses, so either tool can read the history later.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Umzug, SequelizeStorage } from "umzug";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const SEEDERS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "seeders");

function createUmzug(database, logger, { directory, tableName }) {
  return new Umzug({
    migrations: {
      glob: ["*.js", { cwd: directory }],
      resolve: ({ name, path: file, context }) => ({
        name,
        up: async () => (await import(pathToFileURL(file).href)).up({ context }),
        down: async () => (await import(pathToFileURL(file).href)).down({ context })
      })
    },
    context: database.sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize: database.sequelize, tableName }),
    logger: logger
      ? { info: (m) => logger.info(m, "migration"), warn: (m) => logger.warn(m, "migration"), error: (m) => logger.error(m, "migration"), debug: (m) => logger.debug(m, "migration") }
      : undefined
  });
}

export function createMigrator(database, logger) {
  return createUmzug(database, logger, { directory: MIGRATIONS_DIR, tableName: "SequelizeMeta" });
}

export function createSeeder(database, logger) {
  return createUmzug(database, logger, { directory: SEEDERS_DIR, tableName: "SequelizeData" });
}
