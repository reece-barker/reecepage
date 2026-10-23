// The deploy step that copies the sign in secrets from GitHub into .env: only those keys change, empty ones are
// left alone, and nothing else in the file moves
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "node:util";
import { setEnvValues } from "../../scripts/env-set.js";

const before = "# The database\nDB_PASSWORD=secret\nSIMPLELOGIN_CLIENT_ID=old-id\n# Mail\nMAIL_FROM=\"reece.page <website@reece.page>\"\n";

test("replaces a key where it is and adds new ones at the end", () => {
  const { text, changed } = setEnvValues(before, { SIMPLELOGIN_CLIENT_ID: "portfolio-abc", SIMPLELOGIN_CLIENT_SECRET: "s3cret", DB_PASSWORD: "ignored" });
  assert.deepEqual(changed, ["SIMPLELOGIN_CLIENT_ID", "SIMPLELOGIN_CLIENT_SECRET"]);
  assert.equal(text, "# The database\nDB_PASSWORD=secret\nSIMPLELOGIN_CLIENT_ID=portfolio-abc\n# Mail\nMAIL_FROM=\"reece.page <website@reece.page>\"\nSIMPLELOGIN_CLIENT_SECRET=s3cret\n");
});

test("empty or missing values leave the file alone", () => {
  const { text, changed } = setEnvValues(before, { SIMPLELOGIN_CLIENT_ID: "", GITHUB_SYNC_TOKEN: "  " });
  assert.deepEqual(changed, []);
  assert.equal(text, before);
});

test("odd characters are quoted so Node reads back the same value, duplicates are removed", () => {
  const value = "a b#c\"d\\e'f";
  const { text } = setEnvValues("GITHUB_SYNC_TOKEN=one\nGITHUB_SYNC_TOKEN=two\n", { GITHUB_SYNC_TOKEN: value });
  assert.equal(text.match(/GITHUB_SYNC_TOKEN/g).length, 1);
  assert.equal(parseEnv(text).GITHUB_SYNC_TOKEN, value);
});
