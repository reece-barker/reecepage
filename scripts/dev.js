// npm run dev: builds the assets, keeps rebuilding them when a style or script changes, and restarts the server
// when server code, templates or content change. Ctrl+C stops both.
import { spawn } from "node:child_process";
import { ROOT_DIR } from "../src/config/index.js";

const children = [];

function run(command, args, name) {
  const child = spawn(command, args, { cwd: ROOT_DIR, stdio: "inherit", env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "development" } });
  child.on("exit", (code, signal) => {
    if (signal !== "SIGTERM") console.log(`[dev] ${name} stopped (${signal || code})`);
    stop(code || 0);
  });
  children.push(child);
  return child;
}

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300).unref();
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// One full build first, so the server never starts without a manifest or css
const build = spawn(process.execPath, ["node_modules/gulp/bin/gulp.js", "build"], { cwd: ROOT_DIR, stdio: "inherit" });
build.on("exit", (code) => {
  if (code) {
    console.error("[dev] the first build failed, fix the error above and run npm run dev again");
    process.exit(code);
  }
  run(process.execPath, ["node_modules/gulp/bin/gulp.js", "watch"], "gulp watch");
  run(process.execPath, [
    "--disable-warning=ExperimentalWarning",
    "--watch-path=src", "--watch-path=views", "--watch-path=content", "--watch-path=config",
    "src/server.js"
  ], "server");
});
