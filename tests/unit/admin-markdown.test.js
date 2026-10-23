// The editor's Blocks and Markdown switch: going from Markdown to blocks and back must never change what the page
// looks like. Checked with every real body in content/ plus the tricky cases, using the same marked as the site
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { marked } from "marked";
import { ROOT_DIR } from "../../src/config/index.js";
import { readContentFolder } from "../../src/services/content-records.js";
import { renderMarkdown } from "../../src/services/content-service.js";

function load() {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(path.join(ROOT_DIR, "assets/js/admin-markdown.js"), "utf8"), context);
  return context.window.RPMarkdown;
}
const M = load();
const roundTrip = (markdown) => M.blocksToMarkdown(M.markdownToBlocks(markdown, marked));
// What the visitor sees: the HTML with whitespace between tags evened out
const rendered = (markdown) => renderMarkdown(markdown).html.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();

test("every body in content/ looks exactly the same after going through the blocks", () => {
  const { entries } = readContentFolder(path.join(ROOT_DIR, "content"));
  const markdown = entries.filter((entry) => entry.type !== "legal");
  assert.ok(markdown.length > 5);
  for (const entry of markdown) {
    const once = roundTrip(entry.body);
    assert.equal(rendered(once), rendered(entry.body), `${entry.type}/${entry.slug} renders differently after the round trip`);
    assert.equal(roundTrip(once), once, `${entry.type}/${entry.slug} keeps changing on every round trip`);
  }
});

const CASES = {
  "inline formatting": "Some **bold**, *italic*, `code with * star`, a [link](https://example.org/a_(b)) and https://bare.example.",
  "characters that mean something": "2 * 3 = 6, a_b_c stays, _this_ isnt emphasis, \\[not a link\\] and AT&T stays as it is. Ends with a backslash \\\\",
  "line starts": "1\\. not a list\n\n\\- not a list either\n\n\\# not a heading\n\n\\:::not a callout",
  "headings": "## Two\n\n### Three\n\n#### Four",
  "lists": "- one\n- two\n  - nested\n  - nested too\n- three\n\n1. first\n2. second\n   1. inner\n\n- [ ] todo\n- [x] done",
  "quotes": "> A plain quote\n> on two lines\n\n:::quote cite=\"Someone, their role\"\nWhat they said.\n\nAnd more.\n:::",
  "code": "```\nconst a = `b`;\n```\n\n````\nhas ``` inside\n````",
  "table": "| Name | Value |\n| --- | --- |\n| a \\| b | **c** |",
  "blocks": "[[media:my-photo-1a2b3c size=wide caption=\"A \\\"quoted\\\" caption\"]]\n\n[[media:small-one size=small align=right]]\n\n[[gallery:one,two,three columns=3 caption=\"Three\"]]\n\n[[button href=\"/contact\" label=\"Get in touch\"]]\n\n:::note title=\"Good to know\"\nInside the **callout**.\n:::\n\n:::warning\nCareful.\n:::",
  "things blocks cant show stay as they are": "# A top heading\n\n![A plan](/x.png \"800x600\")\n\n<div class=\"x\">raw html</div>\n\n```js\nlet a = 1;\n```\n\n:::tip\n- a list in a callout\n:::",
  "divider and line breaks": "One<br>two\n\n---\n\nAfter"
};

for (const [name, markdown] of Object.entries(CASES)) {
  test(`round trip: ${name}`, () => {
    const once = roundTrip(markdown);
    assert.equal(rendered(once), rendered(markdown), `renders differently:\n${once}`);
    assert.equal(roundTrip(once), once);
  });
}

test("the block syntax comes out as the site expects", () => {
  const blocks = M.markdownToBlocks("[[media:pic size=small align=left caption=\"Hi\"]]\n\n[[button href=\"/x\" label=\"Go\" style=secondary]]", marked);
  // The blocks come from another vm context, so compare them as plain JSON
  assert.equal(JSON.stringify(blocks.map((b) => b.type)), JSON.stringify(["rpMedia", "rpButton"]));
  assert.equal(blocks[0].data.align, "left");
  assert.equal(M.blocksToMarkdown([{ type: "rpMedia", data: { slug: "pic", size: "text", align: "left", caption: "" } }]), "[[media:pic]]\n");
});
