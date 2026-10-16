# Architecture

## The short version

Every page is rendered on the server. The browser gets finished HTML, one stylesheet and one small script, plus
three.js on the home page only. There's no client side framework and nothing depends on JavaScript to show content.

```
request
  -> request id and CSP nonce      src/middleware/request-context.js
  -> access log (pino-http)
  -> security headers (helmet)     src/middleware/security.js
  -> noindex outside production    src/middleware/canonical.js
  -> compression
  -> canonical redirects           https, the real host, no trailing slash, old paths from config
  -> precompressed assets          .br / .gz copies made by the build
  -> static files                  public/ (hashed files cached for a year)
  -> site rate limit               300 requests a minute per address
  -> cookies, form body (20 kB max)
  -> template locals               site details, nav, consent state
  -> router                        src/routes/index.js, one file with every url
  -> 404 and error handlers        src/middleware/errors.js
```

`src/app.js` builds the app and never listens on a port, `src/server.js` does that plus shutdown handling. That
split is what lets the tests create a fresh app per test with an in memory database and a fake mail transport.

## Layers

| Layer | Folder | Job |
| --- | --- | --- |
| Config | `src/config` | Reads `config/application.yml` and the environment once, checks it and freezes it. Production refuses to start with anything missing (exit code 78 and a list of problems). |
| Controllers | `src/controllers` | Turn a request into a template and its data. No queries, no business rules. |
| Services | `src/services` | Content, SEO, consent, mail, contact form logic. |
| Repositories | `src/repositories` | The only place that queries the database. |
| Models and migrations | `src/models`, `src/database` | Sequelize models, Umzug migrations and seeders. |
| Views | `views` | Handlebars. Helpers in `src/helpers/handlebars.js`. |
| Browser code | `assets/js` | `main.js` (menu, theme, reveals, form helpers, consent, match cuts) and `tree.js` (the home page tree). |

## Content

Projects, articles and pages are Markdown with front matter, lists like the timeline and skills are YAML. The
content service reads everything at start up and throws a `ContentError` naming the file if something is wrong, so
a broken file stops a deploy instead of breaking a page. In development the cache is off and edits show on refresh.

Projects with `page: false` are listed but have no page of their own. Anything still unknown about a project goes
in its `todo` list, which shows on the page in development only and in `npm run content:check`.

## Database

Only contact messages are stored. One table, `contact_messages`, with the submission id unique so pressing send
twice saves one message. Visitors' IP addresses are never stored, only a keyed hash used to spot floods. A daily
job inside the app deletes messages older than `contact.retention_days` (365), as the privacy policy says.

Production uses MySQL. Development and tests use SQLite through `src/database/sqlite-adapter.js`, a small adapter
from Sequelize to Node's built in `node:sqlite`, so there is no native module to compile. Migrations are written
for both. SQLite databases migrate themselves on start, MySQL only ever migrates when `npm run db:migrate` runs.

## The contact form

1. `GET /contact` sets a CSRF cookie and renders a hidden CSRF token and a signed form token (time plus a random
   submission id).
2. `POST /contact` goes through the contact rate limit (5 an hour per address), then CSRF, then the service.
3. The service checks the honeypot field, validates the fields, checks the form token (too fast, expired or
   tampered means "press send again"), stores the message and emails it. Either one succeeding is enough.
4. Success is a 303 to `/contact/thank-you`, so a refresh never posts twice.

## Security

- Content Security Policy with a fresh nonce per request, no inline styles or style attributes, no framing,
  `object-src 'none'`, `base-uri 'none'`, form actions only to this site. Analytics hosts are only added when
  analytics is switched on.
- HSTS in production only. Permissions Policy turns off camera, microphone, location, payment and USB.
- CSRF double submit cookies (`__Host-` prefixed in production) on the two forms.
- Rate limits for the whole site and stricter ones for the form. `TRUST_PROXY` must match the number of proxies
  in front of the app or every visitor looks like the same address.
- Logs redact cookies, authorization headers and form fields with personal data.
- Error pages never show stack traces or error messages, those only go to the log with the request id.

## Motion

- The tree: three.js, lazy loaded, sleeps when hidden, one still frame with reduced motion, a poster without WebGL.
- Headings reveal word by word behind a matte (`views` use the `matteWords` helper, delays come from nth-child
  rules because the CSP blocks style attributes).
- Clicking a project title keeps it in place while the next page loads round it (cross document view transitions).
- The timeline on the about page grows as you scroll, using scroll driven animations where the browser has them.
- Everything respects `prefers-reduced-motion`.
