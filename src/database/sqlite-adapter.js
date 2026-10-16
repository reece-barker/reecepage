// Makes Node's built in node:sqlite look like the `sqlite3` npm package, which is what Sequelize expects for its
// sqlite dialect. Only used for tests and optional local development, production runs on MySQL.
//
// Why not just install sqlite3: it ships a native binary per platform and the sandbox this was built in cant
// download those. node:sqlite comes with Node 22 so theres nothing to compile or download at all.
import { DatabaseSync } from "node:sqlite";

// Same numbers as the sqlite3 package (and sqlite itself), Sequelize ORs them together
export const OPEN_READONLY = 0x00000001;
export const OPEN_READWRITE = 0x00000002;
export const OPEN_CREATE = 0x00000004;

// Extended sqlite result codes, mapped onto the string codes Sequelize looks for in formatError
const CONSTRAINT_CODES = new Map([
  [2067, "SQLITE_CONSTRAINT_UNIQUE"],
  [1555, "SQLITE_CONSTRAINT_PRIMARYKEY"],
  [787, "SQLITE_CONSTRAINT_FOREIGNKEY"],
  [1811, "SQLITE_CONSTRAINT_TRIGGER"],
  [19, "SQLITE_CONSTRAINT"],
  [1299, "SQLITE_CONSTRAINT_NOTNULL"],
  [275, "SQLITE_CONSTRAINT_CHECK"]
]);

function toSqliteError(error) {
  const wrapped = new Error(error.errstr ? `${error.errstr}: ${error.message}` : error.message);
  wrapped.message = error.message;
  wrapped.code = CONSTRAINT_CODES.get(error.errcode) || (error.errcode ? `SQLITE_ERROR_${error.errcode}` : "SQLITE_ERROR");
  wrapped.errno = error.errcode;
  return wrapped;
}

// node:sqlite only binds null, numbers, bigints, strings and bytes, the sqlite3 package also took booleans
function toBindable(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Sequelize checks `metaData.constructor.name === "Statement"` for bulk inserts, so the run() result has to be one
class Statement {
  constructor(lastID, changes) {
    this.lastID = lastID;
    this.changes = changes;
  }
}

function normaliseArgs(params, callback) {
  if (typeof params === "function") return { params: [], callback: params };
  return { params: params ?? [], callback: callback || (() => {}) };
}

function execute(db, method, sql, params) {
  const statement = db.prepare(sql);
  if (Array.isArray(params)) return statement[method](...params.map(toBindable));
  const named = {};
  for (const [key, value] of Object.entries(params)) named[key] = toBindable(value);
  return statement[method](named);
}

export class Database {
  /**
   * @param {string} filename path or ":memory:"
   * @param {number} [mode]
   * @param {(error: Error | null) => void} [callback]
   */
  constructor(filename, mode, callback) {
    if (typeof mode === "function") { callback = mode; mode = OPEN_READWRITE | OPEN_CREATE; }
    this.filename = filename;
    try {
      this.db = new DatabaseSync(filename, { readOnly: (mode & OPEN_READWRITE) === 0 });
      queueMicrotask(() => callback?.(null));
    } catch (error) {
      queueMicrotask(() => callback?.(toSqliteError(error)));
    }
  }

  // Everything is synchronous underneath so statements already run one after another
  serialize(fn) { if (fn) fn(); }

  run(sql, maybeParams, maybeCallback) {
    const { params, callback } = normaliseArgs(maybeParams, maybeCallback);
    let result;
    try {
      const info = execute(this.db, "run", sql, params);
      result = new Statement(Number(info.lastInsertRowid), Number(info.changes));
    } catch (error) {
      queueMicrotask(() => callback.call(new Statement(0, 0), toSqliteError(error)));
      return this;
    }
    queueMicrotask(() => callback.call(result, null));
    return this;
  }

  all(sql, maybeParams, maybeCallback) {
    const { params, callback } = normaliseArgs(maybeParams, maybeCallback);
    let rows;
    try {
      rows = execute(this.db, "all", sql, params).map((row) => ({ ...row }));
    } catch (error) {
      queueMicrotask(() => callback.call(new Statement(0, 0), toSqliteError(error)));
      return this;
    }
    queueMicrotask(() => callback.call(new Statement(0, 0), null, rows));
    return this;
  }

  get(sql, maybeParams, maybeCallback) {
    const { params, callback } = normaliseArgs(maybeParams, maybeCallback);
    this.all(sql, params, (error, rows) => callback(error, rows?.[0]));
    return this;
  }

  exec(sql, callback) {
    try { this.db.exec(sql); } catch (error) { queueMicrotask(() => callback?.(toSqliteError(error))); return this; }
    queueMicrotask(() => callback?.(null));
    return this;
  }

  close(callback) {
    try { if (this.db.isOpen) this.db.close(); } catch (error) { queueMicrotask(() => callback?.(toSqliteError(error))); return; }
    queueMicrotask(() => callback?.(null));
  }

  // sqlite3 is an event emitter, Sequelize only uses this for tracing which we dont need
  on() { return this; }
}

export default { Database, OPEN_READONLY, OPEN_READWRITE, OPEN_CREATE };
