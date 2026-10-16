// Sets up Sequelize from the config. Returns null when no database is configured (DB_DIALECT=none), the rest of
// the app checks for that and switches the bits that need storage off instead of crashing.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Sequelize } from "sequelize";
import sqliteAdapter from "./sqlite-adapter.js";
import { defineModels } from "../models/index.js";

/**
 * @param {ReturnType<import("../config/index.js").loadConfig>} config
 * @param {import("pino").Logger} logger
 * @returns {{ sequelize: Sequelize, models: ReturnType<typeof defineModels>, ping: () => Promise<void>, close: () => Promise<void> } | null}
 */
export function createDatabase(config, logger) {
  const db = config.database;
  if (db.dialect === "none") return null;

  const logging = db.logQueries ? (sql) => logger.debug({ sql }, "sql") : false;
  const common = {
    logging,
    define: { underscored: true, timestamps: true },
    // Everything is stored in UTC, the templates format dates for display
    timezone: "+00:00"
  };

  // The SQLite file lives in var/, which isnt in git, so make the folder the first time
  if (db.dialect === "sqlite" && db.storage !== ":memory:") mkdirSync(path.dirname(db.storage), { recursive: true });

  const sequelize = db.dialect === "sqlite"
    ? new Sequelize({ ...common, dialect: "sqlite", storage: db.storage, dialectModule: sqliteAdapter })
    : new Sequelize(db.name, db.user, db.password, {
      ...common,
      dialect: "mysql",
      host: db.host,
      port: db.port,
      pool: db.pool,
      dialectOptions: {
        charset: "utf8mb4",
        connectTimeout: 10000,
        ...(db.ssl ? { ssl: { rejectUnauthorized: true } } : {})
      }
    });

  const models = defineModels(sequelize);

  return {
    sequelize,
    models,
    dialect: db.dialect,
    async ping() { await sequelize.authenticate({ logging: false }); },
    async close() { await sequelize.close(); }
  };
}
