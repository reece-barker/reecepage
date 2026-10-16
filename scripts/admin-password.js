// npm run admin:password: asks for a password (it isnt shown while you type) and prints the line for .env.
// Pick something long, it protects the upload page. The password itself is never saved anywhere.
import { createInterface } from "node:readline";
import { hashPassword } from "../src/middleware/admin-auth.js";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = (text) => { if (!muted) rl.output.write(text); };

function ask(question) {
  return new Promise((resolve) => {
    muted = false;
    rl.question(question, (answer) => { rl.output.write("\n"); resolve(answer); });
    muted = true;
  });
}

const first = await ask("New admin password: ");
const second = await ask("Same again: ");
rl.close();
if (first !== second) { console.error("They did not match, nothing changed."); process.exit(1); }
if (first.length < 14) { console.error("Use at least 14 characters."); process.exit(1); }
console.log(`\nPut this line in .env on the server (and restart the site):\n\nADMIN_PASSWORD_HASH=${hashPassword(first)}\n`);
