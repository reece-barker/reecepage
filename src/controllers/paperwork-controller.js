// Paperwork in the admin: letters, invoices, contracts, business cards, compliments slips and the email signature, with a form on the left and the live
// A4 preview on the right, numbered, kept with their revisions, and downloaded as PDF or a plain Word file.
// Your details and bank accounts come from the private lists My details and Payment accounts.
import { randomBytes } from "node:crypto";
import { cleanObject } from "../admin/schemas.js";
import { notFound } from "../middleware/errors.js";
import { KINDS, documentKind, fieldsFor } from "../documents/index.js";
import { businessDetails, missingRequired } from "../documents/business.js";
import { pageHtml, pdfFooterTemplate } from "../documents/page.js";
import { makeDocx } from "../documents/docx.js";
import { writeOut } from "../documents/contract.js";
import { signatureParts } from "../documents/stationery.js";
import { CvPdfError, printUrl } from "../services/cv-pdf.js";

const PREVIEW_MINUTES = 20;
const STATUS_LABELS = { draft: "Draft", final: "Sent", trash: "In the trash" };
const MISSING_LABELS = {
  full_name: "your full name", street: "your address", tax_number: "a tax number or VAT ID (needed on invoices)", btw_id: "your btw-id",
  seat: "the registered seat", register_court: "the register court", register_number: "the register number", directors: "the managing directors",
  kvk: "the KvK number", company_number: "the company number", registered_in: "where the company is registered", registered_office: "the registered office"
};

const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../repositories/paperwork-repository.js").PaperworkRepository} deps.paperwork
 * @param {import("../repositories/content-repository.js").ContentRepository} deps.repository
 * @param {object} deps.assets the asset manifest, for the stylesheet and logo addresses
 * @param {(res: object, view: string, section: string, title: string, data?: object) => void} deps.page renders an admin page
 */
export function createPaperworkController({ config, paperwork, repository, assets, page, site = () => config.site }) {
  const previews = new Map();
  // Pages waiting to be printed by Chromium: an unguessable key, used once, gone after a minute. Chromium has no
  // admin session, so this is how it gets to see the page
  const toPrint = new Map();
  let printing = null;

  async function context() {
    const [business, accounts] = await Promise.all([repository.getDocument("business"), repository.getDocument("payment_accounts")]);
    return {
      details: businessDetails(business, config.legal.owner),
      accounts: Array.isArray(accounts) ? accounts : [],
      hasDetails: Boolean(business && business.full_name)
    };
  }

  /** The page as HTML, the same for the preview and the PDF (preview only adds the desk and the footer under it) */
  function renderPage(kind, record, ctx, { preview = false } = {}) {
    const def = documentKind(kind);
    const logo = assets.url("images/brand/reece-dove-long-horizontal-colour.svg");
    // profiles: LinkedIn and GitHub from the site settings, the business card can show them
    const out = def.render(record.data, { ...ctx, number: record.number, logo, preview, asset: (p) => assets.url(p), baseUrl: config.baseUrl, profiles: site()?.profiles || {} });
    const html = pageHtml({ title: out.title, lang: record.data.lang, body: out.body, footer: out.footer, stylesheet: assets.url("css/paperwork.css"), preview });
    return { html, out };
  }

  /** Whats in the form, checked against the kind's fields. Drafts dont need everything filled in yet */
  // A few things are picked when the document is made and never come from the form (a contract's type), those are
  // kept from whats saved
  function cleanData(record, raw, accounts) {
    const def = documentKind(record.kind);
    const fields = fieldsFor(record.kind, accounts, record.data);
    const { value } = cleanObject(fields, raw, "", { lenient: true });
    for (const key of def.fixed || []) if (record.data[key] !== undefined) value[key] = record.data[key];
    return value;
  }

  function present(record) {
    const def = documentKind(record.kind);
    return {
      id: record.id,
      kind: record.kind,
      kindLabel: def?.label || record.kind,
      number: record.number,
      title: record.title,
      lang: record.lang,
      status: record.status,
      statusLabel: STATUS_LABELS[record.status] || record.status,
      updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null
    };
  }

  async function load(req, res, next) {
    const record = await paperwork.get(req.params.id);
    if (!record || !documentKind(record.kind)) { next(notFound()); return null; }
    return record;
  }

  const filename = (record, ext) => `${record.number}${record.title ? `-${record.title.toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40)}` : ""}.${ext}`;

  return {
    async list(req, res, next) {
      try {
        const kind = Object.hasOwn(KINDS, req.query.kind) ? req.query.kind : "";
        const status = ["all", "draft", "final", "trash"].includes(req.query.status) ? req.query.status : "all";
        const search = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
        const [items, ctx] = await Promise.all([paperwork.list({ kind, status, search }), context()]);
        page(res, "paperwork", "paperwork", "Documents", {
          items: items.map(present),
          kinds: Object.values(KINDS).map((k) => ({ kind: k.kind, label: k.label, help: k.help, choices: k.choices, current: k.kind === kind })),
          kind,
          status,
          search,
          hasDetails: ctx.hasDetails,
          hasAccounts: ctx.accounts.length > 0,
          notice: req.query.notice
        });
      } catch (error) { next(error); }
    },

    async create(req, res, next) {
      const def = documentKind(req.params.kind);
      if (!def) return next(notFound());
      // A contract needs its type, the form on the list page sends it
      const choice = typeof req.body?.type === "string" ? req.body.type : "";
      if (def.choices && !def.choices.some((c) => c.id === choice)) return next(notFound());
      try {
        const ctx = await context();
        const lang = ["de", "en", "nl"].includes(req.body?.lang) ? req.body.lang : ctx.details.entity.startsWith("uk") || ctx.details.entity.startsWith("us") ? "en" : ctx.details.entity.startsWith("nl") ? "nl" : "de";
        const data = def.defaults(ctx.details, lang, ctx.accounts, { type: choice });
        const record = await paperwork.create({ kind: def.kind, title: def.title(data), lang, data, prefix: ctx.details.prefix, code: def.code, year: new Date().getFullYear() });
        res.redirect(303, `/admin/paperwork/${record.id}`);
      } catch (error) { next(error); }
    },

    async editor(req, res, next) {
      try {
        const record = await load(req, res, next);
        if (!record) return;
        const ctx = await context();
        const def = documentKind(record.kind);
        const missing = missingRequired(ctx.details, record.kind).map((key) => MISSING_LABELS[key] || key);
        page(res, "paperwork-editor", "paperwork", `${def.label} ${record.number}`, {
          bodyClass: "admin-editor-page",
          doc: present(record),
          help: def.help,
          missing,
          hasAccounts: ctx.accounts.length > 0,
          // what this kind can be downloaded as, the signature is copied instead of printed
          hasPdf: !def.outputs || def.outputs.includes("pdf"),
          hasWord: Boolean(def.plain),
          isSignature: record.kind === "signature",
          editorJson: safeJson({
            id: record.id,
            kind: record.kind,
            saveUrl: `/admin/paperwork/${record.id}`,
            previewUrl: "/admin/paperwork/preview",
            fields: fieldsFor(record.kind, ctx.accounts, record.data),
            writeOutUrl: record.kind === "contract" ? `/admin/paperwork/${record.id}/write-out` : null,
            signatureUrl: record.kind === "signature" ? `/admin/paperwork/${record.id}/signature` : null,
            value: record.data,
            updatedAt: record.updatedAt
          }),
          scripts: ["js/admin-fields.js", "js/admin-paperwork.js"]
        });
      } catch (error) { next(error); }
    },

    async save(req, res) {
      try {
        const record = await paperwork.get(req.params.id);
        if (!record || !documentKind(record.kind)) return res.status(404).json({ ok: false, error: "Not found" });
        if (record.status === "trash") return res.status(409).json({ ok: false, error: "Its in the trash, restore it first" });
        const ctx = await context();
        const data = cleanData(record, req.body?.value, ctx.accounts);
        const def = documentKind(record.kind);
        const saved = await paperwork.save(record.id, { title: def.title(data), lang: data.lang || record.lang, data });
        res.json({ ok: true, doc: present(saved) });
      } catch (error) {
        req.log?.error({ err: error }, "paperwork save failed");
        res.status(500).json({ ok: false, error: "Saving failed on the server, it has been logged. Your text is still in the form." });
      }
    },

    /** Stores a rendered preview for a few minutes and says where to load it, the iframe then shows it */
    async createPreview(req, res) {
      try {
        const record = await paperwork.get(req.body?.id);
        if (!record || !documentKind(record.kind)) return res.status(404).json({ ok: false, error: "Not found" });
        const ctx = await context();
        const data = cleanData(record, req.body?.value, ctx.accounts);
        const { html } = renderPage(record.kind, { ...record, data }, ctx, { preview: true });
        const now = Date.now();
        for (const [key, value] of previews) if (value.expires < now) previews.delete(key);
        const key = randomBytes(12).toString("hex");
        previews.set(key, { html, expires: now + PREVIEW_MINUTES * 60000 });
        res.json({ ok: true, url: `/admin/paperwork/preview/${key}` });
      } catch (error) {
        req.log?.error({ err: error }, "paperwork preview failed");
        res.status(500).json({ ok: false, error: "The preview could not be drawn" });
      }
    },

    /**
     * A contract's clauses as text in the form, from whats in the form right now. Nothing is saved here, the editor
     * puts them in the form and the normal autosave takes it from there
     */
    async writeOut(req, res) {
      try {
        const record = await paperwork.get(req.params.id);
        if (!record || record.kind !== "contract") return res.status(404).json({ ok: false, error: "Not found" });
        const ctx = await context();
        const data = cleanData(record, req.body?.value, ctx.accounts);
        res.json({ ok: true, value: { ...data, ...writeOut(data, ctx.details, ctx.accounts) } });
      } catch (error) {
        req.log?.error({ err: error }, "writing out the clauses failed");
        res.status(500).json({ ok: false, error: "The clauses could not be written out, it has been logged" });
      }
    },

    /**
     * The email signature as html and plain text, from what's saved. The editor copies it from here, and with
     * ?download=1 its an html file to open in a browser and copy from, or to import into a mail app
     */
    async signature(req, res, next) {
      try {
        const record = await load(req, res, next);
        if (!record) return;
        if (record.kind !== "signature") return next(notFound());
        const ctx = await context();
        const parts = signatureParts(record.data, ctx.details, { baseUrl: config.baseUrl });
        res.set("Cache-Control", "no-store");
        if (req.query.download) {
          const page = `<!doctype html>\n<html lang="${record.data.lang === "en" ? "en-GB" : record.data.lang || "de"}">\n<head>\n<meta charset="utf-8">\n<title>Email signature</title>\n</head>\n<body>\n${parts.html}\n</body>\n</html>\n`;
          return res.attachment(filename(record, "html")).type("html").send(page);
        }
        res.json({ ok: true, html: parts.html, text: parts.text });
      } catch (error) { next(error); }
    },

    /** The page Chromium prints, once, with the key the PDF button just made */
    showPrint(req, res, next) {
      const key = String(req.params.key);
      const item = toPrint.get(key);
      toPrint.delete(key);
      for (const [k, v] of toPrint) if (v.expires < Date.now()) toPrint.delete(k);
      if (!item || item.expires < Date.now()) return next(notFound());
      res.set("Cache-Control", "no-store").type("html").send(item.html);
    },

    showPreview(req, res, next) {
      const item = previews.get(String(req.params.key));
      if (!item || item.expires < Date.now()) return next(notFound());
      res.set("Cache-Control", "no-store").type("html").send(item.html);
    },

    async pdf(req, res, next) {
      try {
        const record = await load(req, res, next);
        if (!record) return;
        const def = documentKind(record.kind);
        if (def.outputs && !def.outputs.includes("pdf")) return next(notFound());
        if (printing) return res.status(409).type("text").send("A PDF is being made already, try again in a few seconds.");
        const ctx = await context();
        const { html, out } = renderPage(record.kind, record, ctx);
        const key = randomBytes(24).toString("hex");
        toPrint.set(key, { html, expires: Date.now() + 60000 });
        // cards and slips have no footer, theyre too small for one and the page size comes from their own @page
        const footerTemplate = def.pdfFooter === false ? "" : pdfFooterTemplate({ lang: record.data.lang, footer: out.footer, number: record.number });
        printing = printUrl({ url: `http://127.0.0.1:${config.port}/admin/paperwork/print/${key}`, footerTemplate });
        const { pdf } = await printing;
        res.set("Cache-Control", "no-store");
        res.attachment(filename(record, "pdf")).type("application/pdf").send(Buffer.from(pdf));
      } catch (error) {
        if (error instanceof CvPdfError) return res.status(503).type("text").send(`The PDF could not be made: ${error.message}`);
        next(error);
      } finally {
        printing = null;
      }
    },

    async docx(req, res, next) {
      try {
        const record = await load(req, res, next);
        if (!record) return;
        const ctx = await context();
        const def = documentKind(record.kind);
        if (!def.plain) return next(notFound());
        const buffer = makeDocx(def.plain(record.data, { ...ctx, number: record.number }), { lang: record.data.lang, title: record.title });
        res.set("Cache-Control", "no-store");
        res.attachment(filename(record, "docx")).type("application/vnd.openxmlformats-officedocument.wordprocessingml.document").send(buffer);
      } catch (error) { next(error); }
    },

    async duplicate(req, res, next) {
      try {
        const record = await load(req, res, next);
        if (!record) return;
        const ctx = await context();
        const def = documentKind(record.kind);
        const copy = await paperwork.create({ kind: record.kind, title: record.title, lang: record.lang, data: record.data, prefix: ctx.details.prefix, code: def.code, year: new Date().getFullYear() });
        res.redirect(303, `/admin/paperwork/${copy.id}`);
      } catch (error) { next(error); }
    },

    /** Draft, sent (final) or the trash. The number stays with it either way, an invoice number is never reused */
    async setStatus(req, res, next) {
      try {
        const record = await load(req, res, next);
        if (!record) return;
        const status = ["draft", "final", "trash"].includes(req.body?.status) ? req.body.status : null;
        if (!status) return res.redirect(303, `/admin/paperwork/${record.id}`);
        await paperwork.setStatus(record.id, status);
        res.redirect(303, status === "trash" ? "/admin/paperwork?notice=trashed" : `/admin/paperwork/${record.id}?notice=${status}`);
      } catch (error) { next(error); }
    }
  };
}
