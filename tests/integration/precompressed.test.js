import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { brotliCompressSync, gzipSync, brotliDecompressSync } from "node:zlib";
import express from "express";
import request from "supertest";
import { precompressedAssets } from "../../src/middleware/precompressed.js";

let dir;
let app;
const css = "body { color: olive; }\n".repeat(100);

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "rp-public-"));
  mkdirSync(path.join(dir, "assets/css"), { recursive: true });
  const file = path.join(dir, "assets/css/main.0123456789.css");
  writeFileSync(file, css);
  writeFileSync(`${file}.br`, brotliCompressSync(css));
  writeFileSync(`${file}.gz`, gzipSync(css));
  writeFileSync(path.join(dir, "assets/css/plain.css"), css);
  app = express();
  app.use(precompressedAssets({ publicDir: dir }));
  app.use(express.static(dir));
});

after(() => rmSync(dir, { recursive: true, force: true }));

test("brotli is preferred when the browser takes it", async () => {
  const res = await request(app).get("/assets/css/main.0123456789.css").set("Accept-Encoding", "gzip, br")
    .buffer(true).parse((r, cb) => { const chunks = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => cb(null, Buffer.concat(chunks))); });
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-encoding"], "br");
  assert.match(res.headers["content-type"], /text\/css/);
  assert.equal(res.headers.vary, "Accept-Encoding");
  assert.match(res.headers["cache-control"], /immutable/);
  // Newer superagent versions unpack brotli by themselves, older ones hand over the raw bytes
  const text = res.body.toString() === css ? css : brotliDecompressSync(res.body).toString();
  assert.equal(text, css);
});

test("gzip when that is all the browser takes, and the plain file otherwise", async () => {
  const gz = await request(app).get("/assets/css/main.0123456789.css").set("Accept-Encoding", "gzip");
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.equal(gz.text, css);
  const plain = await request(app).get("/assets/css/main.0123456789.css").set("Accept-Encoding", "identity");
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(plain.text, css);
});

test("files without a compressed copy and path tricks fall through", async () => {
  const res = await request(app).get("/assets/css/plain.css").set("Accept-Encoding", "br");
  assert.equal(res.headers["content-encoding"], undefined);
  await request(app).get("/assets/..%2F..%2Fetc%2Fpasswd.css").set("Accept-Encoding", "br").expect(404);
});
