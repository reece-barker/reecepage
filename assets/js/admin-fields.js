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

  function buildScalar(field, value, changed) {
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
      row.appendChild(smallButton("Remove", function () {
        getters.splice(getters.indexOf(entry), 1);
        row.remove();
        changed();
      }));
      getters.push(entry);
      list.appendChild(row);
      return input;
    }
    (Array.isArray(value) ? value : []).forEach(function (text) { addRow(text); });
    var add = smallButton("Add a line", function () { addRow("").focus(); changed(); });
    var group = el("fieldset", { className: "editor-group" }, [el("legend", { className: "label", text: field.label }), field.help ? el("p", { className: "hint", text: field.help }) : null, list, add]);
    return { node: group, get: function () { return getters.map(function (g) { return g.get(); }); } };
  }

  function buildFields(fields, value, changed) {
    changed = changed || function () {};
    var wrap = el("div", { className: "editor-fields" });
    var getters = {};
    fields.forEach(function (field) {
      var built = build(field, value ? value[field.name] : undefined, changed);
      getters[field.name] = built.get;
      wrap.appendChild(built.node);
    });
    return { node: wrap, get: function () { var out = {}; Object.keys(getters).forEach(function (k) { out[k] = getters[k](); }); return out; } };
  }

  function buildObject(field, value, changed) {
    var inner = buildFields(field.fields, value, changed);
    var group = el("fieldset", { className: "editor-group" }, [el("legend", { className: "label", text: field.label }), field.help ? el("p", { className: "hint", text: field.help }) : null, inner.node]);
    return { node: group, get: inner.get };
  }

  function buildObjects(field, value, changed, opts) {
    opts = opts || {};
    changed = changed || function () {};
    var list = el("ol", { className: "editor-items", role: "list" });
    var entries = [];
    function titleOf(item) { return (item && field.itemLabel && item[field.itemLabel]) || "New item"; }
    function refreshNumbers() {
      entries.forEach(function (entry, i) { entry.number.textContent = (i + 1) + ". "; });
    }
    function move(entry, step) {
      var i = entries.indexOf(entry);
      var j = i + step;
      if (j < 0 || j >= entries.length) return;
      entries.splice(i, 1);
      entries.splice(j, 0, entry);
      if (step < 0) list.insertBefore(entry.node, entries[j + 1].node); else list.insertBefore(entry.node, entries[j - 1].node.nextSibling);
      refreshNumbers();
      entry.node.querySelector("summary").focus();
      changed();
    }
    function addItem(item, atStart) {
      var inner = buildFields(field.fields, item, changed);
      var number = el("span", { className: "editor-item__number" });
      var heading = el("span", { text: titleOf(item) });
      var details = el("details", { className: "editor-item" }, [el("summary", {}, [number, heading]), inner.node]);
      if (!item || opts.open) details.open = true;
      var entry = { get: inner.get, node: null, number: number };
      var controls = el("div", { className: "editor-item__controls cluster" });
      if (!opts.fixedLength) {
        controls.appendChild(smallButton("Move up", function () { move(entry, -1); }));
        controls.appendChild(smallButton("Move down", function () { move(entry, 1); }));
        var remove = smallButton("Remove", function () {
          if (remove.getAttribute("data-armed") !== "true") {
            remove.setAttribute("data-armed", "true");
            remove.textContent = "Press again to remove";
            setTimeout(function () { remove.removeAttribute("data-armed"); remove.textContent = "Remove"; }, 4000);
            return;
          }
          entries.splice(entries.indexOf(entry), 1);
          entry.node.remove();
          refreshNumbers();
          changed();
        }, "button--danger");
        controls.appendChild(remove);
      }
      details.appendChild(controls);
      // Keeps the summary line in step with the title while typing
      details.addEventListener("input", function () { heading.textContent = titleOf(inner.get()); });
      entry.node = el("li", {}, [details]);
      if (atStart) { entries.unshift(entry); list.insertBefore(entry.node, list.firstChild); } else { entries.push(entry); list.appendChild(entry.node); }
      refreshNumbers();
      return details;
    }
    (Array.isArray(value) ? value : []).forEach(function (item) { addItem(item); });
    var group = el("fieldset", { className: "editor-group" }, [el("legend", { className: "label", text: field.label }), field.help ? el("p", { className: "hint", text: field.help }) : null]);
    if (!opts.fixedLength) {
      group.appendChild(el("div", { className: "cluster" }, [
        smallButton("Add at the top", function () { addItem(null, true).querySelector("input, textarea, select").focus(); changed(); }),
        smallButton("Add at the bottom", function () { addItem(null, false).querySelector("input, textarea, select").focus(); changed(); })
      ]));
    }
    group.appendChild(list);
    return { node: group, get: function () { return entries.map(function (e) { return e.get(); }); } };
  }

  function build(field, value, changed) {
    changed = changed || function () {};
    if (field.type === "objects") return buildObjects(field, value, changed);
    if (field.type === "object") return buildObject(field, value, changed);
    if (field.type === "strings") return buildStrings(field, value, changed);
    return buildScalar(field, value, changed);
  }

  /** A box listing what the server said needs fixing, focused so a screen reader reads it out */
  function errorBox(title, errors) {
    var list = el("ul", {}, (errors || []).map(function (message) { return el("li", { text: message }); }));
    return el("div", { className: "alert alert--error", role: "alert", tabindex: "-1" }, [el("div", {}, [el("p", {}, [el("strong", { text: title })]), errors && errors.length ? list : null])]);
  }

  window.AdminFields = { el: el, build: build, buildFields: buildFields, buildObjects: buildObjects, smallButton: smallButton, errorBox: errorBox };
})();
