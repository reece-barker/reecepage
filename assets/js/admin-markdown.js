// Turns Markdown into the editor's blocks and back again. Markdown is what gets saved (and committed to GitHub), the
// blocks are just a nicer way to edit it, so this is what makes the Blocks and Markdown switch in the editor safe.
// No DOM in here on purpose, the tests run it in Node with the real marked to check that going round in a circle
// gives the same text back.
//
// The extra block syntax ([[media:...]], [[gallery:...]], [[button ...]], :::note and :::quote) is the same as in
// src/services/content-blocks.js, wich turns it into HTML on the site.
(function (root) {
  "use strict";

  // Helpers

  function parseAttributes(text) {
    var out = {};
    var pattern = /([a-z][a-z0-9_-]*)=(?:"((?:[^"\\]|\\.)*)"|([^\s"\]]+))/gi;
    var match;
    while ((match = pattern.exec(String(text || "")))) {
      out[match[1].toLowerCase()] = match[2] !== undefined ? match[2].replace(/\\(.)/g, "$1") : match[3];
    }
    return out;
  }

  function formatAttributes(pairs) {
    return pairs
      .filter(function (pair) { return pair[1] !== undefined && pair[1] !== null && pair[1] !== ""; })
      .map(function (pair) {
        var value = String(pair[1]);
        return /^[a-z0-9-]+$/i.test(value) ? pair[0] + "=" + value : pair[0] + "=\"" + value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
      })
      .join(" ");
  }

  var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'", apos: "'", nbsp: "\u00a0" };
  function decode(text) {
    return String(text).replace(/&(amp|lt|gt|quot|#39|apos|nbsp|#(\d+)|#x([0-9a-f]+));/gi, function (whole, name, dec, hex) {
      if (dec) return String.fromCharCode(Number(dec));
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      return ENTITIES[name.toLowerCase()] || whole;
    }).replace(/\u00a0/g, " ");
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Text that is meant literally, so Markdown doesnt read it as formatting */
  function escapeText(text) {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/([`*[\]<>~])/g, "\\$1")
      .replace(/&(?=#?[a-z0-9]+;)/gi, "\\&")
      // Underscores only at the edge of a word, snake_case reads fine and isnt emphasis in GitHub Markdown
      .replace(/_/g, function (underscore, at, whole) {
        var word = function (c) { return Boolean(c) && /[A-Za-z0-9]/.test(c); };
        return word(whole[at - 1]) && word(whole[at + 1]) ? "_" : "\\_";
      });
  }

  /** Things that only mean something at the start of a line: #, -, +, 1., >, ::: */
  function escapeLineStart(text) {
    return text
      .replace(/^(\s*)(#{1,6}\s|[-+]\s|>|:::)/gm, "$1\\$2")
      .replace(/^(\s*)(\d+)([.)]\s)/gm, "$1$2\\$3");
  }

  // Inline HTML (what the editor makes: b, i, a, code, br) to Markdown

  function inlineToMarkdown(html) {
    var out = "";
    var stack = [];
    var pattern = /<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi;
    var match;
    var source = String(html || "");
    while ((match = pattern.exec(source))) {
      if (match[4] !== undefined) {
        var text = decode(match[4]);
        var top = stack[stack.length - 1];
        if (top && top.tag === "code") out += text;
        else if (top && top.tag === "a") top.text += text;
        else out += escapeText(text);
        continue;
      }
      var closing = match[1] === "/";
      var tag = match[2].toLowerCase();
      var attrs = match[3] || "";
      if (tag === "strong") tag = "b";
      if (tag === "em") tag = "i";
      if (tag === "br") { out += "<br>"; continue; }
      if (!closing) {
        if (tag === "a") {
          var href = /href\s*=\s*"([^"]*)"/i.exec(attrs) || /href\s*=\s*'([^']*)'/i.exec(attrs);
          stack.push({ tag: "a", href: href ? decode(href[1]) : "", text: "", start: out.length });
        } else if (tag === "b" || tag === "i" || tag === "code") {
          var marker = tag === "b" ? "**" : tag === "i" ? "*" : "`";
          out += marker;
          stack.push({ tag: tag, marker: marker, start: out.length });
        } else {
          stack.push({ tag: tag, ignored: true });
        }
        continue;
      }
      // Close the nearest matching tag, anythin left open in between is closed with it
      for (var i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag !== tag) continue;
        var open = stack.splice(i);
        for (var j = open.length - 1; j >= 0; j -= 1) closeTag(open[j]);
        break;
      }
    }
    while (stack.length) closeTag(stack.pop());
    return out;

    function closeTag(item) {
      if (item.ignored) return;
      if (item.marker) {
        var inner = out.slice(item.start);
        var opening = out.slice(0, item.start - item.marker.length);
        // Nothing inside: drop the pair. Spaces just inside go outside, "**word **" wouldnt be bold in Markdown
        if (!inner.trim()) { out = opening + inner; return; }
        var lead = /^\s*/.exec(inner)[0];
        var trail = /\s*$/.exec(inner)[0];
        out = opening + lead + item.marker + inner.trim() + item.marker + trail;
        return;
      }
      if (item.tag === "a") {
        var label = escapeText(item.text);
        // A link thats just its own address is written as the address, GitHub Markdown links it by itself
        out += item.text === item.href && /^https?:\/\//.test(item.href) ? item.href : "[" + label + "](" + item.href.replace(/[()\s]/g, function (c) { return encodeURIComponent(c); }) + ")";
      }
    }
  }

  /** Markdown inline to the HTML the editor understands (b and i instead of strong and em) */
  function inlineToHtml(markdown, marked) {
    var html = marked.parseInline(String(markdown || ""), { gfm: true });
    return html
      .replace(/<strong>/g, "<b>").replace(/<\/strong>/g, "</b>")
      .replace(/<em>/g, "<i>").replace(/<\/em>/g, "</i>")
      .replace(/<code>/g, "<code class=\"inline-code\">");
  }

  // Splitting the extra block syntax out before marked sees the rest

  var LINE_MEDIA = /^\[\[(media|gallery):([a-z0-9,-]{1,800})(?:\s+([^\]\n]*))?\]\]\s*$/;
  var LINE_BUTTON = /^\[\[button\s+([^\]\n]*)\]\]\s*$/;
  var CONTAINER_OPEN = /^:::(note|tip|warning|quote)([^\n]*)$/;

  function splitSpecial(markdown) {
    var lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    var parts = [];
    var buffer = [];
    var fence = null;
    function flush() {
      if (buffer.length) parts.push({ kind: "md", text: buffer.join("\n") });
      buffer = [];
    }
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (fence) {
        buffer.push(line);
        if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length && /^\s{0,3}[`~]+\s*$/.test(line)) fence = null;
        continue;
      }
      if (fenceMatch) { fence = fenceMatch[1]; buffer.push(line); continue; }
      var m = LINE_MEDIA.exec(line);
      if (m) { flush(); parts.push({ kind: m[1], slugs: m[2].split(",").filter(Boolean), attrs: parseAttributes(m[3]) }); continue; }
      var b = LINE_BUTTON.exec(line);
      if (b) { flush(); parts.push({ kind: "button", attrs: parseAttributes(b[1]) }); continue; }
      var c = CONTAINER_OPEN.exec(line);
      if (c) {
        var end = -1;
        for (var k = i + 1; k < lines.length; k += 1) if (/^:::\s*$/.test(lines[k])) { end = k; break; }
        if (end > i) {
          flush();
          parts.push({ kind: "container", name: c[1], attrs: parseAttributes(c[2]), inner: lines.slice(i + 1, end).join("\n") });
          i = end;
          continue;
        }
      }
      buffer.push(line);
    }
    flush();
    return parts;
  }

  // Markdown to blocks

  function listItems(tokens, marked) {
    return tokens.map(function (item) {
      var nested = [];
      var text = [];
      (item.tokens || []).forEach(function (token) {
        if (token.type === "list") nested = listItems(token.items, marked);
        else if (token.type === "text" || token.type === "paragraph") text.push(token.text);
        else if (token.type === "checkbox") return;
        else if (token.raw) text.push(token.raw.trim());
      });
      return { content: inlineToHtml(text.join(" ").replace(/^\[[ xX]\]\s+/, ""), marked), meta: item.task ? { checked: Boolean(item.checked) } : {}, items: nested };
    });
  }

  function hasImage(tokens) {
    return (tokens || []).some(function (token) { return token.type === "image" || (token.tokens && hasImage(token.tokens)); });
  }

  /** Raw is for anything the blocks cant show, it keeps the Markdown exactly as it was */
  function raw(text) { return { type: "rpRaw", data: { markdown: text.replace(/\s+$/, "") } }; }

  function tokensToBlocks(tokens, marked) {
    var blocks = [];
    tokens.forEach(function (token) {
      switch (token.type) {
        case "space":
          return;
        case "heading":
          blocks.push({ type: "header", data: { text: inlineToHtml(token.text, marked), level: Math.min(4, Math.max(2, token.depth)) } });
          if (token.depth === 1 || token.depth > 4) blocks[blocks.length - 1] = raw(token.raw);
          return;
        case "paragraph":
          if (hasImage(token.tokens)) { blocks.push(raw(token.raw)); return; }
          blocks.push({ type: "paragraph", data: { text: inlineToHtml(token.text, marked) } });
          return;
        case "list": {
          var task = token.items.some(function (item) { return item.task; });
          var data = { style: task ? "checklist" : token.ordered ? "ordered" : "unordered", meta: {}, items: listItems(token.items, marked) };
          if (token.ordered && token.start && token.start !== 1) data.meta.start = token.start;
          blocks.push({ type: "list", data: data });
          return;
        }
        case "blockquote": {
          var simple = token.tokens.every(function (t) { return t.type === "paragraph" || t.type === "space"; });
          if (!simple) { blocks.push(raw(token.raw)); return; }
          var lines = token.tokens.filter(function (t) { return t.type === "paragraph"; }).map(function (t) { return inlineToHtml(t.text, marked); });
          blocks.push({ type: "quote", data: { text: lines.join("<br><br>"), caption: "", alignment: "left" } });
          return;
        }
        case "code":
          if (token.lang) { blocks.push(raw(token.raw)); return; }
          blocks.push({ type: "code", data: { code: token.text } });
          return;
        case "hr":
          blocks.push({ type: "delimiter", data: {} });
          return;
        case "table": {
          var head = token.header.map(function (cell) { return inlineToHtml(cell.text, marked); });
          var rows = token.rows.map(function (row) { return row.map(function (cell) { return inlineToHtml(cell.text, marked); }); });
          blocks.push({ type: "table", data: { withHeadings: true, content: [head].concat(rows) } });
          return;
        }
        default:
          blocks.push(raw(token.raw));
      }
    });
    return blocks;
  }

  function markdownToBlocks(markdown, marked) {
    var blocks = [];
    splitSpecial(markdown).forEach(function (part) {
      if (part.kind === "md") {
        if (part.text.trim()) blocks = blocks.concat(tokensToBlocks(marked.lexer(part.text, { gfm: true }), marked));
        return;
      }
      var a = part.attrs || {};
      if (part.kind === "media") {
        blocks.push({ type: "rpMedia", data: { slug: part.slugs[0], size: a.size || "text", align: a.align || "center", caption: a.caption || "", link: a.link || "" } });
      } else if (part.kind === "gallery") {
        blocks.push({ type: "rpGallery", data: { slugs: part.slugs, columns: a.columns || (part.slugs.length >= 3 ? "3" : "2"), caption: a.caption || "" } });
      } else if (part.kind === "button") {
        blocks.push({ type: "rpButton", data: { label: a.label || "", href: a.href || "", style: a.style === "secondary" ? "secondary" : "primary" } });
      } else if (part.kind === "container" && part.name === "quote") {
        var paragraphs = marked.lexer(part.inner, { gfm: true }).filter(function (t) { return t.type === "paragraph"; });
        blocks.push({ type: "quote", data: { text: paragraphs.map(function (t) { return inlineToHtml(t.text, marked); }).join("<br><br>"), caption: escapeHtml(a.cite || ""), alignment: "left" } });
      } else if (part.kind === "container") {
        var inner = marked.lexer(part.inner, { gfm: true });
        var plain = inner.every(function (t) { return t.type === "paragraph" || t.type === "space"; });
        if (plain) {
          blocks.push({ type: "rpCallout", data: { kind: part.name, title: a.title || "", text: inner.filter(function (t) { return t.type === "paragraph"; }).map(function (t) { return inlineToHtml(t.text, marked); }).join("<br><br>") } });
        } else {
          blocks.push(raw(":::" + part.name + (part.attrs && a.title ? " " + formatAttributes([["title", a.title]]) : "") + "\n" + part.inner + "\n:::"));
        }
      }
    });
    return blocks;
  }

  // Blocks to Markdown

  function paragraphsToMarkdown(html) {
    // <br><br> is a new paragraph inside quotes and callouts, a single <br> stays a line break
    return String(html || "").split(/(?:<br\s*\/?>\s*){2,}|<\/?(?:p|div)[^>]*>/i)
      .map(function (part) { return escapeLineStart(inlineToMarkdown(part).trim()); })
      .filter(Boolean)
      .join("\n\n");
  }

  function listToMarkdown(items, style, depth, start) {
    var lines = [];
    var number = start || 1;
    items.forEach(function (item) {
      var marker = style === "ordered" ? number + ". " : style === "checklist" ? (item.meta && item.meta.checked ? "- [x] " : "- [ ] ") : "- ";
      number += 1;
      var indent = new Array(depth + 1).join(style === "ordered" ? "   " : "  ");
      var text = inlineToMarkdown(typeof item === "string" ? item : item.content).replace(/<br>/g, " ").trim();
      lines.push(indent + marker + text);
      var children = (item && item.items) || [];
      if (children.length) lines.push(listToMarkdown(children, style, depth + 1, 1));
    });
    return lines.join("\n");
  }

  function fenceFor(code) {
    var longest = 0;
    (String(code).match(/`+/g) || []).forEach(function (run) { longest = Math.max(longest, run.length); });
    return new Array(Math.max(3, longest + 1) + 1).join("`");
  }

  function blockToMarkdown(block) {
    var d = block.data || {};
    switch (block.type) {
      case "paragraph": {
        var text = escapeLineStart(inlineToMarkdown(d.text).trim());
        return text;
      }
      case "header":
        return new Array(Math.min(4, Math.max(2, Number(d.level) || 2)) + 1).join("#") + " " + inlineToMarkdown(d.text).replace(/<br>/g, " ").trim();
      case "list":
        return listToMarkdown(d.items || [], d.style, 0, d.meta && d.meta.start);
      case "quote": {
        var body = paragraphsToMarkdown(d.text);
        var cite = decode(String(d.caption || "").replace(/<[^>]+>/g, "")).trim();
        if (!body) return "";
        if (cite) return ":::quote " + formatAttributes([["cite", cite]]) + "\n" + body + "\n:::";
        return body.split("\n").map(function (line) { return line ? "> " + line : ">"; }).join("\n");
      }
      case "code": {
        var fence = fenceFor(d.code || "");
        return fence + "\n" + String(d.code || "").replace(/\s+$/, "") + "\n" + fence;
      }
      case "delimiter":
        return "---";
      case "table": {
        var rows = (d.content || []).filter(function (row) { return row && row.length; });
        if (!rows.length) return "";
        var width = Math.max.apply(null, rows.map(function (row) { return row.length; }));
        var cell = function (html) { return inlineToMarkdown(html).replace(/<br>/g, " ").replace(/\|/g, "\\|").trim() || " "; };
        var line = function (row) { var cells = []; for (var i = 0; i < width; i += 1) cells.push(cell(row[i] || "")); return "| " + cells.join(" | ") + " |"; };
        var out = [line(rows[0]), "|" + new Array(width + 1).join(" --- |")];
        rows.slice(1).forEach(function (row) { out.push(line(row)); });
        return out.join("\n");
      }
      case "rpMedia":
        if (!d.slug) return "";
        return "[[media:" + d.slug + (function () {
          var attrs = formatAttributes([["size", d.size && d.size !== "text" ? d.size : ""], ["align", (d.size === "small" || d.size === "medium") && d.align && d.align !== "center" ? d.align : ""], ["caption", d.caption], ["link", d.link]]);
          return attrs ? " " + attrs : "";
        })() + "]]";
      case "rpGallery":
        if (!d.slugs || !d.slugs.length) return "";
        return "[[gallery:" + d.slugs.join(",") + (function () {
          var attrs = formatAttributes([["columns", d.columns], ["caption", d.caption]]);
          return attrs ? " " + attrs : "";
        })() + "]]";
      case "rpButton":
        if (!d.label || !d.href) return "";
        return "[[button " + formatAttributes([["href", d.href], ["label", d.label], ["style", d.style === "secondary" ? "secondary" : ""]]) + "]]";
      case "rpCallout": {
        var inner = paragraphsToMarkdown(d.text);
        var kind = ["note", "tip", "warning"].indexOf(d.kind) >= 0 ? d.kind : "note";
        var head = ":::" + kind + (d.title ? " " + formatAttributes([["title", decode(String(d.title).replace(/<[^>]+>/g, "")).trim()]]) : "");
        return inner || d.title ? head + "\n" + (inner || " ") + "\n:::" : "";
      }
      case "rpRaw":
        return String(d.markdown || "").replace(/\s+$/, "");
      default:
        return "";
    }
  }

  function blocksToMarkdown(blocks) {
    return (blocks || []).map(blockToMarkdown).filter(function (text) { return text && text.trim(); }).join("\n\n") + "\n";
  }

  root.RPMarkdown = {
    parseAttributes: parseAttributes,
    formatAttributes: formatAttributes,
    inlineToMarkdown: inlineToMarkdown,
    inlineToHtml: inlineToHtml,
    markdownToBlocks: markdownToBlocks,
    blocksToMarkdown: blocksToMarkdown,
    splitSpecial: splitSpecial
  };
})(typeof window !== "undefined" ? window : globalThis);
