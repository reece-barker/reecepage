import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContact, MESSAGE_MIN } from "../../src/validators/contact-validator.js";
import { CONTACT_LIMITS } from "../../src/models/contact-message.js";

const topics = ["An internship or a job", "Something else"];
const good = { name: "Ada Lovelace", email: "Ada@Example.org", topic: "Something else", message: "Hello, I liked the tree on your site." };

test("a normal message passes and gets tidied", () => {
  const { values, errors } = validateContact({ ...good, name: "  Ada Lovelace ", message: "Line one\r\nLine two is here" }, { topics });
  assert.deepEqual(errors, {});
  assert.equal(values.name, "Ada Lovelace");
  assert.equal(values.email, "ada@example.org");
  assert.equal(values.message, "Line one\nLine two is here");
});

test("missing fields each get their own message", () => {
  const { errors } = validateContact({}, { topics });
  assert.deepEqual(Object.keys(errors).sort(), ["email", "message", "name", "topic"]);
});

test("email addresses are checked loosely but header tricks are refused", () => {
  for (const email of ["ada@example.org", "a.b+c@sub.example.co.uk", "ünï@exämple.de"]) {
    assert.equal(validateContact({ ...good, email }, { topics }).errors.email, undefined, email);
  }
  for (const email of ["ada", "ada@", "@example.org", "ada@example", "a b@example.org", "ada@example.org\nBcc: x@y.z", "<ada@example.org>"]) {
    assert.ok(validateContact({ ...good, email }, { topics }).errors.email, email);
  }
});

test("only the listed topics are accepted", () => {
  assert.ok(validateContact({ ...good, topic: "Free money" }, { topics }).errors.topic);
});

test("length limits match the database columns", () => {
  assert.ok(validateContact({ ...good, name: "x".repeat(CONTACT_LIMITS.name + 1) }, { topics }).errors.name);
  assert.ok(validateContact({ ...good, message: "x".repeat(CONTACT_LIMITS.message + 1) }, { topics }).errors.message);
  assert.ok(validateContact({ ...good, message: "x".repeat(MESSAGE_MIN - 1) }, { topics }).errors.message);
  assert.equal(validateContact({ ...good, message: "x".repeat(MESSAGE_MIN) }, { topics }).errors.message, undefined);
});

test("control characters and line breaks in a name are refused", () => {
  assert.ok(validateContact({ ...good, name: "Ada\nLovelace" }, { topics }).errors.name);
  assert.ok(validateContact({ ...good, name: "Ada\u0000" }, { topics }).errors.name);
  assert.ok(validateContact({ ...good, message: "Hello there \u0007 bell" }, { topics }).errors.message);
});

test("non string values never crash it", () => {
  const { errors } = validateContact({ name: ["a"], email: { x: 1 }, topic: 5, message: null }, { topics });
  assert.equal(Object.keys(errors).length, 4);
});
