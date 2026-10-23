// Puts the admin sign in secrets from GitHub into the server .env, the deploy workflow runs it after git pull so
// you dont have to ssh in and edit the file by hand everytime. Only these keys are ever touched, everything else
// in .env stays exactly how it is, and a key thats empty in GitHub is left alone instead of being wiped.
//
//   node scripts/env-set.js            (reads the values from the environment, the workflow passes them in)
//
// It only prints the names of what changed, never the values, the deploy log is visible on GitHub
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MANAGED_KEYS = ["SIMPLELOGIN_CLIENT_ID", "SIMPLELOGIN_CLIENT_SECRET", "ADMIN_SIMPLELOGIN_ID", "GITHUB_SYNC_TOKEN"];

// Plain when its safe, otherwise in quotes. Nodes own .env reader has no escaping inside quotes, so it picks a
// quote character the value doesnt contain, secrets never have all three anyway
function formatValue(value) {
  if (/^[\w.\-/+=:@]*$/.test(value)) return value;
  const quote = ["'", "`"].find((q) => !value.includes(q));
  if (!quote || value.includes("\n")) throw new Error("this value cant be written to .env safely, it has quotes of every kind or a line break");
  return `${quote}${value}${quote}`;
}

/**
 * Sets the keys in the text of a .env file. A line thats already there is replaced where it is (so comments
 * around it stay), a new one goes at the end.
 * @param {string} text the .env file as it is
 * @param {Record<string, string|undefined>} values only non empty values of MANAGED_KEYS are used
 * @returns {{ text: string, changed: string[] }}
 */
export function setEnvValues(text, values) {
  const lines = text.length ? text.replace(/\n$/, "").split("\n") : [];
  const changed = [];
  for (const key of MANAGED_KEYS) {
    const value = values[key];
    if (typeof value !== "string" || value.trim() === "") continue;
    const line = `${key}=${formatValue(value.trim())}`;
    const at = lines.findIndex((l) => new RegExp(`^\\s*(export\\s+)?${key}\\s*=`).test(l));
    if (at === -1) { lines.push(line); changed.push(key); continue; }
    if (lines[at] !== line) { lines[at] = line; changed.push(key); }
    // Any second copy of the same key further down would win when the file is read, so those go
    for (let i = lines.length - 1; i > at; i -= 1) {
      if (new RegExp(`^\\s*(export\\s+)?${key}\\s*=`).test(lines[i])) lines.splice(i, 1);
    }
  }
  return { text: `${lines.join("\n")}\n`, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.resolve(fileURLToPath(new URL("..", import.meta.url)), ".env");
  if (!existsSync(file)) {
    console.error(`${file} doesnt exist, make it first (see docs/DEPLOYMENT.md)`);
    process.exit(1);
  }
  const { text, changed } = setEnvValues(readFileSync(file, "utf8"), process.env);
  if (changed.length) {
    // Written in place so the file keeps its owner and permissions
    writeFileSync(file, text);
    console.log(`.env updated: ${changed.join(", ")}`);
  } else {
    console.log(".env already up to date");
  }
}
