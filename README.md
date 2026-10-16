# reece.page

The personal website of Reece Barker. It's a server rendered Node.js site with Express, Handlebars, Sass and Gulp,
with MySQL (through Sequelize) for the only thing that needs storing, which is messages from the contact form.
Content is Markdown and YAML in `content/`, so adding a project is adding a file.

## Quick start

You need Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env        # the defaults work for local development
npm run dev                 # builds the assets, watches them and restarts the server on changes
```

Then open http://localhost:3000. Locally the database is SQLite in `var/dev.sqlite`, it's created and migrated on
start so the contact form works straight away. Without SMTP details the messages are stored but not emailed, run
`npm run contact:list` to read them.

## Admin

`npm run dev`, then http://localhost:3000/admin (user `reece`, password `reece-dev` on your computer). Projects,
articles, timeline, skills, references, CV, media, status and a board of every endpoint. See docs/CONTENT.md.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development: build, watch and restart |
| `npm start` | Start the server (production uses this) |
| `npm run build` | Production asset build: minified, hashed, precompressed, no source maps |
| `npm run build:dev` | Development asset build |
| `npm test` | Unit and integration tests (Node's test runner and Supertest) |
| `npm run test:e2e` | Browser tests with Playwright and axe: four screen sizes, both themes, keyboard, the contact form |
| `npm run lint` | ESLint |
| `npm run check` | Lint, tests and the content check together, run this before every deploy |
| `npm run content:check` | Checks every content file: front matter, em dashes, broken internal links, open todos |
| `npm run site:check` | Crawls the whole running site for broken links, missing titles, alt texts and more |
| `npm run perf:check` | Lab check of LCP, CLS and script size on a throttled phone against the budgets |
| `npm run screenshots` | Full page screenshots of the main pages at phone and desktop size in both themes |
| `npm run db:migrate` / `db:rollback` / `db:status` / `db:seed` | Database migrations and development seed data |
| `npm run contact:list` / `contact:purge` / `contact:retry` | Read stored messages, delete old ones, resend failed notifications |
| `npm run mail:verify` | Tests the SMTP login (add `-- --send` for a test email) |
| `npm run secret` | Prints a random value for `APP_SECRET` |
| `npm run images:tree` / `images:og` | Regenerates the tree posters and the share images |
| `npm run media:add -- file --title "..."` | Adds a picture or video to the media library from the command line |
| `npm run admin:password` | Makes the password hash for the /admin/media upload page |

Also: `npm run cv:pdf` (makes the CV PDF), `npm run media:import` (imports media-inbox/).

## Where things are

```
config/application.yml   settings that are safe to commit (site details, features, legal facts, retention)
.env                     secrets and per machine settings (never committed, see .env.example)
content/                 projects, writing, pages and data files (Markdown and YAML)
views/                   Handlebars layouts, partials and pages
styles/                  Sass, tokens first (styles/abstracts/_tokens.scss)
assets/                  browser JavaScript, fonts, images, vendored three.js
src/                     the server: config, middleware, controllers, services, models, database
scripts/                 command line jobs and the Gulp tasks
tests/                   unit, integration and e2e tests
deploy/glitchtip/        Docker Compose for the self hosted error monitor
docs/                    everything else, start with docs/ARCHITECTURE.md
```

## Docs

- [Architecture](docs/ARCHITECTURE.md): how a request moves through the app and why it's built this way
- [Configuration](docs/CONFIGURATION.md): every setting and where it comes from
- [Design system](docs/DESIGN-SYSTEM.md): tokens, type, motion and the rules behind them
- [Content](docs/CONTENT.md): adding projects and articles
- [Email](docs/EMAIL.md): contact notifications through Proton (Bridge or SMTP tokens)
- [Deployment](docs/DEPLOYMENT.md): Hetzner, Cloudflare, nginx, the app, Proton, GlitchTip and backups, step by step
- [Operations](docs/OPERATIONS.md): logs, errors, media, contact messages, when something breaks
- [Pre-launch checklist](docs/PRE-LAUNCH.md): what has to happen before the site goes live
- [Audit](docs/AUDIT.md): what was built, tested and what is still open
- [Future](docs/FUTURE.md): tools, accounts, payments and AI, and how they plug in later

## Licence

All rights reserved, see `/copyright` on the site. Fonts are under the SIL Open Font License and three.js under the
MIT licence, their licence files ship with them.
