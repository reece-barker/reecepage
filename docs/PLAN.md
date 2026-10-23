# reece.page implementation plan

This is the working plan and requirements checklist. It is updated as the build moves on, the final state is in
`docs/AUDIT.md`.

## 1. What existed before this build (audit, 12 October 2026)

| Thing | Where | What happens to it |
| --- | --- | --- |
| Dove brand pack v1.3 (Olive, Sage, Blush, Cream, Young Serif, Nunito Sans, dove symbol, wordmark, leaf pattern; the slogan was dropped in October 2026) | brand pack `01-logo`, `03-typography`, `08-pattern` | Kept. It is the visual identity, the site builds on it instead of inventing a new look. |
| 3D tree home page prototype (three.js r160, one tree, three branches: Code, Earth, Faith, pixel leaves, scroll walks round the tree, mouse moves the sun) | brand pack `12-homepage/index.html` | Kept as the home page centrepiece (he chose to keep it). Ported into a module, loads lazily, pauses when hidden, gets a static poster for no-JS. |
| Static web kit (Python builder, pages, legal templates, CSS tokens, contact form that opened the mail program) | brand pack `09-web-kit` | Content and legal templates are ported to Handlebars. The Python builder is replaced by Express, Handlebars, Sass and Gulp as required. |
| Biography and project facts | approved long-form video script (October 2026), memory, old site content in the web kit | Used as the only source of facts. Nothing is invented, missing details are listed per page as `todo` in front matter. |
| Instagram promo video | made in another session, the video files are not in this workspace | Not reviewed here. Its scenes (dove building itself, tree, greenhouse, code folding into leaves) come from the same brand and are described in the chat history, so the motion language follows the same ideas. |
| Photos (portrait, maze robot, certificate) | used in the video session, not in this workspace | Not available. Pages use typographic fallbacks, `cover` fields are ready for real photos. |

## 2. Baseline

1. **Communicates:** who Reece is (Applied Computer Science student at Saxion, raised in Munich, co-founder of an AI
   microclimate startup, sustainability ambassador), what he has built, and how to reach him.
2. **Audiences:** primary are internship and graduate employers (BMW, Microsoft and green tech companies are named
   goals, not shown publicly), Saxion staff and collaborators. Secondary are people looking at the startup and
   people who find his writing.
3. **Distinctive:** the living tree and its three branches. Every project grows from a branch (Code or Earth) and
   carries that branch's colour. Leaves are square pixels because it is a computer science tree. The dove is the mark.
4. **Decisions already made:** brand, slogan, legal name Reece Norman Barker with "Reece" as the brand name, keep the
   3D tree, no gaming wording in anything employer facing, startup stays unnamed, MIS role is "on contract,
   supporting IT and building on the Power Platform" (not IT administrator).
5. **Now:** portfolio, about, projects, writing, contact with a real form, legal pages, SEO, consent aware analytics
   (off by default), health checks. **Later (feature flags, off):** tools directory, accounts, payments, AI tools,
   status page.
6. **Retained:** brand assets, tree code (refactored), legal texts (updated for the new data processing), copy.
7. **Missing before launch:** hosting provider and server location, email provider and SMTP details, data protection
   authority, decision on publishing the mobile number, real photos, project details marked `todo`, a lawyer's read
   of the legal texts, GitHub and LinkedIn URLs confirmed.

## 3. Key decisions

- **Stack** exactly as required: Node.js 22, Express 5, Handlebars (express-handlebars 8), Sass, Gulp 5, MySQL with
  Sequelize 6. ES modules because every dependency supports them and Node 22 is the target.
- **Content** (projects, writing, tools) lives in Markdown files with YAML front matter. It is versioned with the
  code, needs no admin panel and no database. The database only stores what visitors send (contact messages).
- **Database for tests:** MySQL is not available in the build sandbox. Sequelize runs against SQLite in tests and
  optional local development, through a small adapter over Node's built-in `node:sqlite`, so no native module is
  needed. Production uses MySQL. Migrations are written to work on both.
- **No client framework.** Vanilla JS, CSS scroll driven animation, Web Animations API, cross document View
  Transitions for match cuts. three.js only on the home page, loaded after the page is usable.
- **Analytics:** none by default. Plausible or Umami can be switched on in config, and only load after opt in.
- **Mail:** SMTP via Nodemailer. Proton Mail Bridge is a desktop app and not suitable on a server, see
  `docs/EMAIL.md`.
- **Security:** Helmet with a nonce based CSP, CSRF double submit tokens, rate limits, honeypot and time trap on the
  form, hashed IPs only, no sessions until accounts exist.

## 4. Requirements checklist

Status: [x] done and verified, [~] done but needs his input or an external service, [ ] open.

The final status of every item is in `docs/AUDIT.md`, and what still needs doing before launch is in `docs/PRE-LAUNCH.md`.
