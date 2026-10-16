// The SQLite adapter is my own glue between Sequelize and node:sqlite, so it gets tested through Sequelize itself
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../../src/database/index.js";
import { createMigrator } from "../../src/database/migrator.js";
import { ContactMessageRepository } from "../../src/repositories/contact-message-repository.js";

let database;
let repo;

before(async () => {
  database = createDatabase({ database: { dialect: "sqlite", storage: ":memory:", logQueries: false } }, null);
  await createMigrator(database, null).up();
  repo = new ContactMessageRepository(database.models);
});

after(async () => { await database.close(); });

const message = (over = {}) => ({ name: "Ada", email: "ada@example.org", topic: "Something else", message: "Hello there, this is a test.", submissionId: `id-${Math.random()}`, ipHash: "abc", ...over });

test("ping works", async () => {
  await database.ping();
});

test("create returns the row with an id and dates", async () => {
  const { message: row, duplicate } = await repo.create(message());
  assert.equal(duplicate, false);
  assert.ok(row.id > 0);
  assert.ok(row.createdAt instanceof Date);
});

test("the same submission twice is a duplicate, not an error", async () => {
  const first = await repo.create(message({ submissionId: "same-one" }));
  const second = await repo.create(message({ submissionId: "same-one", message: "A different body" }));
  assert.equal(second.duplicate, true);
  assert.equal(second.message.id, first.message.id);
});

test("notified and failed markers, and listing the unnotified ones", async () => {
  const { message: row } = await repo.create(message());
  await repo.markNotificationFailed(row.id, "x".repeat(400));
  let pending = await repo.listUnnotified();
  const failed = pending.find((m) => m.id === row.id);
  assert.equal(failed.notificationError.length, 255);
  await repo.markNotified(row.id);
  pending = await repo.listUnnotified();
  assert.ok(!pending.some((m) => m.id === row.id));
});

test("purge deletes only old rows", async () => {
  const { message: old } = await repo.create(message());
  await database.models.ContactMessage.update({ createdAt: new Date(Date.now() - 400 * 86400000) }, { where: { id: old.id }, silent: true });
  const removed = await repo.deleteOlderThan(new Date(Date.now() - 365 * 86400000));
  assert.equal(removed, 1);
  assert.ok((await repo.listRecent(100)).length >= 3);
});

test("migrations roll back cleanly and come back", async () => {
  const migrator = createMigrator(database, null);
  await migrator.down({ to: 0 });
  assert.equal((await migrator.executed()).length, 0);
  await migrator.up();
  assert.equal((await migrator.pending()).length, 0);
});
