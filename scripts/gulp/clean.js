import { rm } from "node:fs/promises";
import { PATHS } from "./settings.js";

/** Every build starts from an empty public/assets so stale hashed files never linger */
export async function clean() {
  await rm(PATHS.out, { recursive: true, force: true });
}
