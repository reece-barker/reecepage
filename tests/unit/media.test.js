import { test } from "node:test";
import assert from "node:assert/strict";
import { sniff, imageSize, toWebVtt, renderMediaShortcodes } from "../../src/services/media-service.js";
import { mediaFigure, isoDuration } from "../../src/helpers/media-html.js";

const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000280000001e00806000000", "hex");

test("files are recognised by their bytes, not their names", () => {
  assert.equal(sniff(png).mime, "image/png");
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])).mime, "image/jpeg");
  assert.equal(sniff(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")).mime, "image/webp");
  assert.equal(sniff(Buffer.from("\0\0\0\x20ftypisom\0\0\0\0", "latin1")).mime, "video/mp4");
  assert.equal(sniff(Buffer.from("\0\0\0\x20ftypavif\0\0\0\0", "latin1")).mime, "image/avif");
  assert.equal(sniff(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0])).mime, "video/webm");
  // Things that must never get in
  for (const bad of ["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "<!doctype html><script>", "%PDF-1.7", "\0\0\0\x20ftypqt  ", "MZ\x90\0"]) {
    assert.equal(sniff(Buffer.from(bad.padEnd(16, " "), "latin1")), null, bad);
  }
});

test("picture sizes come from the header", () => {
  assert.deepEqual(imageSize(png, "image/png"), { width: 640, height: 480 });
  assert.deepEqual(imageSize(Buffer.alloc(10), "image/jpeg"), { width: null, height: null });
});

test("SRT captions become WebVTT and a transcript", () => {
  const { vtt, transcript } = toWebVtt("1\r\n00:00:01,000 --> 00:00:03,500\r\nHello, I'm Reece.\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\nI grew up in Munich.\r\n");
  assert.ok(vtt.startsWith("WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nHello, I'm Reece."));
  assert.equal(transcript, "Hello, I'm Reece. I grew up in Munich.");
  assert.throws(() => toWebVtt("just some text"), /WebVTT or SRT/);
});

test("figures escape everything and videos get captions and a transcript", () => {
  const html = mediaFigure({ isVideo: true, src: "/media/files/a.mp4", mime: "video/mp4", posterSrc: "/media/files/a.jpg", captionsSrc: "/media/files/a.vtt", title: "Hi \"there\"", transcript: "<b>words</b>", width: 1920, height: 1080 });
  assert.match(html, /<track kind="captions" src="\/media\/files\/a.vtt" srclang="en" label="English" default>/);
  assert.match(html, /aria-label="Hi &quot;there&quot;"/);
  assert.match(html, /&lt;b&gt;words&lt;\/b&gt;/);
  const img = mediaFigure({ isVideo: false, src: "/media/files/b.png", alt: "A <robot>", width: 10, height: 5 });
  assert.match(img, /alt="A &lt;robot&gt;" width="10" height="5" loading="lazy"/);
  assert.equal(isoDuration(396), "PT6M36S");
});

test("article codes are swapped for figures, unknown ones disappear", async () => {
  const fake = { bySlugs: async (slugs) => new Map(slugs.filter((s) => s === "known").map((s) => [s, { isVideo: false, src: "/x.png", alt: "x" }])) };
  const out = await renderMediaShortcodes("<p>Before</p>\n<p>[[media:known]]</p>\n<p>[[media:missing]]</p>", fake, mediaFigure);
  assert.match(out, /<figure class="media-figure"><img src="\/x.png"/);
  assert.ok(!out.includes("missing"));
});
