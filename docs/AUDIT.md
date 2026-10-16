# Audit

## Second round, 12 October 2026 (evening)

Changes after Reece's review, all run and checked on 12 October 2026:

| Check | Result |
| --- | --- |
| `npm run lint` | No problems |
| `npm test` | 125 of 125 pass (was 105), new: media library, admin login, uploads, file serving, error reports, Bridge and admin config checks |
| `npm run test:e2e`, dev assets | 144 pass, 8 skipped on purpose, 0 fail, now including /media |
| `npx playwright test --project=desktop --project=phone`, production assets | 73 pass, 3 skipped, 0 fail |
| axe on pages with a video (test clip), phone and desktop, both themes, plus the admin page | 0 violations, no sideways scrolling |
| `npm run site:check`, `npm run perf:check` (production build) | No errors, LCP 1.0 to 2.1 s, CLS 0 |
| Screen reader structure | Accessibility tree of 8 pages read through. Fixed: timeline headings now come before their dates, a stray landmark on the about page, project details now read with pauses ("Earth, Startup, Ongoing"). A real VoiceOver or NVDA pass is still open |

What changed: spacing between text blocks and above the footer on every page, legal pages laid out in boxes and
sections, hover fills with padding on links and project rows, Home in the navigation, no more mouse following on
the tree, RSV verse with its notice, Hetzner, Proton and Cloudflare in the legal pages, phone and GitHub,
Proton Mail Bridge support, a media library with password protected uploads and a /media page, the introduction
video slot on the home page with captions, transcript and music credits, self hosted error monitoring with
GlitchTip, MySQL tests, and a full server runbook in DEPLOYMENT.md.

Still open from this round:

- The introduction video itself is not in the site yet: the 130 MB file times out when copied from the Mac, so it
  waits for `prepare-video.command` to cut it into parts, or goes straight onto the server with
  `npm run media:add` (DEPLOYMENT.md step 11). The site is ready for it (tested with a generated clip)
- Tests on real MySQL wait for `setup-mysql.command` to run on the Mac
- Real screen reader pass, data processing agreements, everything else in PRE-LAUNCH.md

## First round, 12 October 2026

What was built, what was actually run to check it, what is still open and what needs Reece. Nothing below is
marked as tested unless the test was run in this build.

## Test results (all run on 12 October 2026)

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | No problems |
| Unit and integration tests | `npm test` | 105 of 105 pass |
| Browser tests, dev assets | `npm run test:e2e` | 136 pass, 8 skipped on purpose (desktop only or phone only tests), 0 fail |
| Browser tests, production assets | `npx playwright test --project=desktop --project=phone` | 69 pass, 3 skipped, 0 fail |
| Content check | `npm run content:check` | No errors, 23 warnings (open todos and one long summary) |
| Crawl | `npm run site:check` (production build) | 21 pages, 17 files, no errors |
| Lab performance | `npm run perf:check` (production build, throttled phone) | LCP 0.96 to 1.9 s, CLS 0.000 on every page, own JavaScript 3 to 7 KB |
| Production config | `NODE_ENV=production npm start` with the legal fields empty | Refuses to start, exit 78, lists the three missing legal fields |
| Production behaviour | scripted smoke test with filled config | https and www redirects, HSTS, hashed brotli assets with a year cache, `__Host-` CSRF cookie, no placeholders, no todo panels, index allowed |
| Static design audit | genjutsu `audit.py` on styles, scripts and rendered HTML | One false positive left (a project title counted as a call to action), the rest fixed or explained below |

The browser tests cover 14 pages at 1440 x 900, 820 x 1180, 390 x 844 and 844 x 390, each in light and dark: axe at
WCAG 2.2 AA plus best practice with zero violations, no console errors, no sideways scrolling. Also keyboard (skip
link, visible focus, phone menu with Escape), the theme switch, the full contact form with errors and success,
the site without JavaScript, and the live tree.

Lab numbers are not field data. Real Core Web Vitals come from the Chrome UX report after launch.

## Requirements

[x] done and verified, [~] done but needs Reece or an outside service, [ ] not done

### Stack and structure
- [x] Node.js 22, Express 5, Handlebars, Sass, Gulp 5, MySQL with Sequelize, vanilla JS, `.env` plus YAML. No React,
  Vite or TypeScript.
- [x] Controllers, services, repositories, models, middleware, helpers, config in their own layers
- [x] Migrations and seeders with Umzug, rollback tested
- [~] MySQL itself: the code and migrations target it, but MySQL could not be run in this sandbox. Tests use SQLite
  through the same Sequelize models. First `npm run db:migrate` against real MySQL is the first real test.
- [x] Gulp: Sass, Terser, SVGO, content hashing with a manifest, CSS url rewriting, Brotli and gzip copies, no
  production source maps, served precompressed by the app

### Design and motion
- [x] Built on the dove brand pack, tokens for both themes, no generic AI look (see DESIGN-SYSTEM.md)
- [x] Camera pull back on the tree, matte word reveals, match cut page transitions, scroll storytelling round the
  tree and on the timeline, all off with reduced motion
- [x] Tree posters generated from the real tree for no WebGL and no JavaScript

### Pages
- [x] Home, about (with timeline and skills linked to evidence), projects with filters, 9 project pages, writing
  with one article and a feed, contact, thank you, impressum, privacy, terms, cookies, accessibility, copyright,
  404 and error pages
- [x] Tools, accounts, payments, status page: behind flags, off, nothing fake built (FUTURE.md has the plans)

### SEO
- [x] Unique titles and descriptions, canonical, robots meta and header, Open Graph and Twitter tags, JSON-LD
  (WebSite, Person, WebPage or ProfilePage, BreadcrumbList, CreativeWork, BlogPosting)
- [x] Share images: a default one and one per project page and article, 1200 x 630
- [x] robots.txt (blocks everything outside production), sitemap, llms.txt, feed, manifest, security.txt,
  TDM reservation (meta tag and tdmrep.json)
- [~] Search Console and Bing submission after launch

### Accessibility
- [x] WCAG 2.2 AA checked with axe on every page, size and theme. Skip link, landmarks, one h1, labelled fields,
  error summary with links, visible focus, reduced motion, works without JavaScript
- [ ] A manual screen reader pass (VoiceOver or NVDA) has not been done, automated checks don't catch everything

### Security and privacy
- [x] Helmet with a nonce CSP and no inline styles, HSTS in production, Permissions Policy, CSRF on both forms,
  rate limits, honeypot and time token, hashed IPs, 20 kB body limit, redacted logs, safe error pages
- [x] Found and fixed during testing: the cookie page set two CSRF cookies so the banner's form would have failed,
  an open redirect risk in the trailing slash redirect, a timeline overlap and the TOC showing after the text on
  phones
- [x] No analytics by default. Plausible or Umami load only after an equal choice in the banner, revisitable on
  /cookies
- [x] Contact messages deleted after 365 days by a daily job and `npm run contact:purge`
- [ ] `npm audit` could not run here (the npm registry is blocked in this sandbox), run it once on the Mac
- [ ] Error monitoring service (Sentry EU or GlitchTip) not connected. The integration point is the error handler
  in `src/middleware/errors.js` and the process handlers in `src/server.js`, logs already carry request ids

### Email
- [~] Notifications over SMTP with timeouts, required TLS and Reply-To, messages stored first and retryable.
  Proton Mail Bridge ruled out for a server, Proton SMTP submission suggested (EMAIL.md). Needs a token from
  Proton, SPF, DKIM and DMARC.

### Operations
- [x] `/health` and `/health/ready`, graceful shutdown, timeouts, config validation, systemd and nginx examples,
  backups and update process documented
- [~] Hosting not chosen, nothing deployed

## Needs Reece before launch

The full list is in PRE-LAUNCH.md. The ones only he can answer:

1. Hosting provider and server location, mail provider, and whether any data leave the EEA (the app won't start in
   production without these three)
2. Whether the phone number goes on the impressum (hidden now, and moved out of the committed YAML into `.env`)
3. The GitHub profile URL, or leave it hidden
4. The 21 project todos: founding date of the startup, his part in team projects, stacks, photos and screenshots
5. Reading the drafted article "How this site is built" and making it his
6. One wording change made without asking: the home page faith branch no longer starts with "I follow Jesus", to
   match the edit he made on the about page. Easy to put back in `content/data/branches.yml`
7. A lawyer's read of the legal pages

## Not available in this build

- The Instagram promo video files and the photos (portrait, maze robot, certificate) were not in this workspace,
  so pages use type instead of photos for now
- Live services: nothing was connected, no real email was sent, no payment or analytics account touched
