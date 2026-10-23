// Builds form fields from the field lists in src/admin/schemas.js, the same lists the server checks against, so the
// form and the checks can never drift apart. Used by the list editors (timeline, settings and so on) and by the
// details panel in the post editor. Everything is made with createElement and textContent, nothing typed is ever
// run as HTML.
//
//   AdminFields.build(field, value, onChange) -> { node, get }
//   AdminFields.buildFields(fields, value, onChange) -> { node, get }
(function () {
  "use strict";

  var uid = 0;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (key === "text") node.textContent = value;
      else if (key === "className") node.className = value;
      else if (value !== false && value != null) node.setAttribute(key, value === true ? "" : value);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function nextId() { uid += 1; return "af" + uid; }

  function smallButton(label, onClick, extraClass) {
    var b = el("button", { type: "button", className: "button button--secondary button--small" + (extraClass ? " " + extraClass : ""), text: label });
    b.addEventListener("click", onClick);
    return b;
  }

  /* Each builder returns { node, get } where get() reads the current value back out */

  function buildScalar(field, value, changed, fallback) {
    var id = nextId();
    var input;
    var help = field.help ? el("p", { className: "hint", id: id + "-hint", text: field.help }) : null;
    if (field.type === "checkbox") {
      input = el("input", { type: "checkbox", id: id, "aria-describedby": help ? id + "-hint" : false });
      input.checked = value === undefined || value === null ? field.default === true : value === true;
      input.addEventListener("change", changed);
      var label = el("label", { className: "check", for: id }, [input, el("span", { text: field.label })]);
      return { node: el("div", { className: "field" }, [label, help]), get: function () { return input.checked; } };
    }
    if (field.type === "select") {
      input = el("select", { className: "select", id: id, "aria-describedby": help ? id + "-hint" : false });
      if (!field.required) input.appendChild(el("option", { value: "", text: "None" }));
      field.options.forEach(function (option) {
        input.appendChild(el("option", { value: option, text: field.labels && field.labels[option] ? field.labels[option] : option }));
      });
      input.value = value == null ? (field.required ? field.options[0] : "") : String(value);
    } else if (field.type === "textarea" || field.type === "markdown") {
      input = el("textarea", { className: "textarea", id: id, rows: field.type === "markdown" ? 18 : 3, maxlength: field.max || false, "aria-describedby": help ? id + "-hint" : false });
      input.value = value == null ? "" : String(value);
    } else {
      var types = { date: "date", url: "text", email: "email", tel: "tel" };
      input = el("input", {
        className: "input", id: id, type: types[field.type] || "text", maxlength: field.max || false,
        "aria-describedby": help ? id + "-hint" : false, inputmode: field.number ? "numeric" : false,
        spellcheck: field.type === "url" || field.type === "email" ? "false" : false
      });
      input.value = value == null ? "" : String(value);
    }
    input.addEventListener("input", changed);
    input.addEventListener("change", changed);
    if (field.required) input.setAttribute("required", "");
    // What the site shows while this is empty
    if (typeof fallback === "string" && fallback && input.tagName !== "SELECT") input.setAttribute("placeholder", fallback);
    var labelText = field.label + (field.required ? "" : " (optional)");
    return {
      node: el("div", { className: "field" }, [el("label", { className: "label", for: id, text: labelText }), help, input]),
      get: function () { return input.value; }
    };
  }

  function buildStrings(field, value, changed) {
    var list = el("ol", { className: "editor-strings", role: "list" });
    var getters = [];
    function addRow(text) {
      var input = el("input", { className: "input", id: nextId(), type: "text", "aria-label": field.label + " " + (getters.length + 1) });
      input.value = text || "";
      input.addEventListener("input", changed);
      var entry = { get: function () { return input.value; } };
      var row = el("li", { className: "editor-strings__row" }, [input]);
      row.appendChild(iconButton("trash", "Remove this line", function () {
        getters.splice(getters.indexOf(entry), 1);
        row.remove();
        changed();
      }, "qbutton--danger"));
      getters.push(entry);
      list.appendChild(row);
      return input;
    }
    (Array.isArray(value) ? value : []).forEach(function (text) { addRow(text); });
    var add = iconButton("plus", "Add a line", function () { addRow("").focus(); changed(); }, "", true);
    var group = el("fieldset", { className: "editor-strings-group" }, [el("legend", { className: "label", text: field.label }), field.help ? el("p", { className: "hint", text: field.help }) : null, list, add]);
    return { node: group, get: function () { return getters.map(function (g) { return g.get(); }); } };
  }

  function buildFields(fields, value, changed, defaults) {
    changed = changed || function () {};
    var wrap = el("div", { className: "editor-fields" });
    var getters = {};
    fields.forEach(function (field) {
      var built = build(field, value ? value[field.name] : undefined, changed, defaults ? defaults[field.name] : undefined);
      getters[field.name] = built.get;
      wrap.appendChild(built.node);
    });
    return { node: wrap, get: function () { var out = {}; Object.keys(getters).forEach(function (k) { out[k] = getters[k](); }); return out; } };
  }

  function buildObject(field, value, changed, defaults) {
    var inner = buildFields(field.fields, value, changed, defaults);
    var group = el("fieldset", { className: "editor-group" }, [el("legend", { className: "editor-group__title", text: field.label }), field.help ? el("p", { className: "hint", text: field.help }) : null, inner.node]);
    return { node: group, get: inner.get };
  }

  // A few icons for the list controls, the same shapes as src/helpers/icons.js
  var ICONS = {
    up: "M10 3l7 7.5-1.7 1.6L11.2 7.8V17H8.8V7.8l-4.1 4.3L3 10.5z",
    down: "M10 17l-7-7.5 1.7-1.6 4.1 4.3V3h2.4v9.2l4.1-4.3L17 9.5z",
    trash: "M7 1h6v2h5v2.4H2V3h5zM3.4 7h13.2L15.6 19H4.4z",
    plus: "M8.8 2h2.4v6.8H18v2.4h-6.8V18H8.8v-6.8H2V8.8h6.8z",
    chevron: "M6.5 3.5L8.2 1.8 16.4 10l-8.2 8.2-1.7-1.7L13 10z"
  };
  function icon(name) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = document.createElementNS(ns, "path");
    path.setAttribute("d", ICONS[name]);
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }

  /** A quiet button with an icon, the label is read out even when only the icon shows */
  function iconButton(name, label, onClick, extraClass, showLabel) {
    var b = el("button", { type: "button", className: "qbutton" + (extraClass ? " " + extraClass : ""), "aria-label": showLabel ? false : label, title: showLabel ? false : label });
    b.appendChild(icon(name));
    if (showLabel) b.appendChild(el("span", { text: label }));
    b.addEventListener("click", onClick);
    return b;
  }

  // A list of things like jobs or links: each one is a row you open to edit, with its title and a short line
  // (field.itemMeta names the fields for that line) so the closed list still says what's in it
  function buildObjects(field, value, changed, opts) {
    opts = opts || {};
    changed = changed || function () {};
    var list = el("ol", { className: "editor-items", role: "list" });
    var entries = [];
    function titleOf(item) { return (item && field.itemLabel && item[field.itemLabel]) || "New " + (field.singular || "item"); }
    function metaOf(item) {
      if (!item || !field.itemMeta) return "";
      return field.itemMeta.map(function (name) { return item[name]; }).filter(function (v) { return v && typeof v !== "object"; }).join(", ");
    }
    function refresh() {
      entries.forEach(function (entry, i) {
        entry.number.textContent = String(i + 1);
        if (entry.up) entry.up.disabled = i === 0;
        if (entry.down) entry.down.disabled = i === entries.length - 1;
      });
      empty.hidden = entries.length > 0;
    }
    function move(entry, step) {
      var i = entries.indexOf(entry);
      var j = i + step;
      if (j < 0 || j >= entries.length) return;
      entries.splice(i, 1);
      entries.splice(j, 0, entry);
      if (step < 0) list.insertBefore(entry.node, entries[j + 1].node); else list.insertBefore(entry.node, entries[j - 1].node.nextSibling);
      refresh();
      (step < 0 ? entry.up : entry.down).focus();
      if ((step < 0 ? entry.up : entry.down).disabled) entry.toggle.focus();
      changed();
    }
    function addItem(item, atStart) {
      var inner = buildFields(field.fields, item, changed);
      var bodyId = nextId();
      var number = el("span", { className: "editor-item__number" });
      var heading = el("span", { className: "editor-item__title", text: titleOf(item) });
      var meta = el("span", { className: "editor-item__meta", text: metaOf(item) });
      var toggle = el("button", { type: "button", className: "editor-item__toggle", "aria-expanded": "false", "aria-controls": bodyId }, [
        number, el("span", { className: "editor-item__text" }, [heading, meta]), icon("chevron")
      ]);
      var body = el("div", { className: "editor-item__body", id: bodyId, hidden: true }, [inner.node]);
      var bar = el("div", { className: "editor-item__bar" }, [toggle]);
      var node = el("li", { className: "editor-item" }, [bar, body]);
      var entry = { get: inner.get, node: node, number: number, toggle: toggle };
      function setOpen(open) {
        body.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        node.classList.toggle("is-open", open);
      }
      toggle.addEventListener("click", function () { setOpen(body.hidden); });
      if (!opts.fixedLength) {
        var controls = el("div", { className: "editor-item__controls" });
        entry.up = iconButton("up", "Move " + titleOf(item) + " up", function () { move(entry, -1); });
        entry.down = iconButton("down", "Move " + titleOf(item) + " down", function () { move(entry, 1); });
        var remove = iconButton("trash", "Remove", function () {
          if (remove.getAttribute("data-armed") !== "true") {
            remove.setAttribute("data-armed", "true");
            remove.lastChild.textContent = "Press again to remove";
            setTimeout(function () { remove.removeAttribute("data-armed"); remove.lastChild.textContent = "Remove"; }, 4000);
            return;
          }
          entries.splice(entries.indexOf(entry), 1);
          node.remove();
          refresh();
          changed();
        }, "qbutton--danger", true);
        controls.appendChild(entry.up);
        controls.appendChild(entry.down);
        bar.appendChild(controls);
        body.appendChild(el("div", { className: "editor-item__foot" }, [remove]));
      }
      // Keeps the closed row in step with what's typed
      body.addEventListener("input", function () {
        var now = inner.get();
        heading.textContent = titleOf(now);
        meta.textContent = metaOf(now);
      });
      if (!item || opts.open) setOpen(true);
      if (atStart) { entries.unshift(entry); list.insertBefore(node, list.firstChild); } else { entries.push(entry); list.appendChild(node); }
      refresh();
      return body;
    }
    var empty = el("p", { className: "editor-items__empty", text: "Nothing here yet." });
    (Array.isArray(value) ? value : []).forEach(function (item) { addItem(item); });
    var addTop = iconButton("plus", "Add at the top", function () { addItem(null, true).querySelector("input, textarea, select").focus(); changed(); }, "", true);
    var addEnd = iconButton("plus", "Add at the end", function () { addItem(null, false).querySelector("input, textarea, select").focus(); changed(); }, "", true);
    var head = el("div", { className: "editor-items__head" }, [
      el("div", {}, [
        opts.root ? null : el("span", { className: "label", text: field.label }),
        field.help && !opts.root ? el("p", { className: "hint", text: field.help }) : null
      ]),
      opts.fixedLength ? null : addTop
    ]);
    var group = el(opts.root ? "div" : "fieldset", { className: "editor-objects" + (opts.root ? " editor-objects--root" : "") }, [
      opts.root ? head : el("legend", { className: "visually-hidden", text: field.label }),
      opts.root ? null : head,
      list, empty, opts.fixedLength ? null : el("div", { className: "editor-items__add" }, [addEnd])
    ]);
    refresh();
    return { node: group, get: function () { return entries.map(function (e) { return e.get(); }); } };
  }

  function build(field, value, changed, fallback) {
    changed = changed || function () {};
    if (field.type === "objects") return buildObjects(field, value, changed);
    if (field.type === "object") return buildObject(field, value, changed, fallback);
    if (field.type === "strings") return buildStrings(field, value, changed);
    return buildScalar(field, value, changed, fallback);
  }

  /** A box listing what the server said needs fixing, focused so a screen reader reads it out */
  function errorBox(title, errors) {
    var list = el("ul", {}, (errors || []).map(function (message) { return el("li", { text: message }); }));
    return el("div", { className: "alert alert--error", role: "alert", tabindex: "-1" }, [el("div", {}, [el("p", {}, [el("strong", { text: title })]), errors && errors.length ? list : null])]);
  }

  window.AdminFields = { el: el, icon: icon, iconButton: iconButton, build: build, buildFields: buildFields, buildObjects: buildObjects, smallButton: smallButton, errorBox: errorBox };
})();
