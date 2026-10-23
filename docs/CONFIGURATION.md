# Configuration

There are two places, on purpose:

- `config/application.yml` holds everything that's safe to commit: site details, navigation, feature flags, form
  rules, legal facts, SEO defaults. The `environments` block at the bottom overrides values per `NODE_ENV`.
- `.env` (copied from `.env.example`) holds secrets and anything that changes per machine. Real environment
  variables always win over `.env`.

Nothing else reads `process.env`. `src/config/index.js` builds one frozen object and checks it.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | development | development, test or production |
| `PORT`, `HOST` | 3000, 0.0.0.0 | |
| `BASE_URL` | http://localhost:PORT | Required in production, must be https and the real domain |
| `TRUST_PROXY` | 0 | Number of proxies in front (nginx = 1). Wrong values break rate limits and https detection |
| `LOG_LEVEL` | from YAML | fatal, error, warn, info, debug, trace, silent |
| `APP_SECRET` | dev only value | Required in production, 32+ characters, `npm run secret` makes one |
| `DB_DIALECT` | sqlite outside production | mysql, sqlite or none |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `DB_POOL_MAX` | | MySQL |
| `DB_STORAGE` | var/dev.sqlite (test: memory) | SQLite file |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | | See EMAIL.md |
| `CONTACT_NOTIFY_TO` | site.email | Where notifications go |
| `SMTP_ALLOW_SELF_SIGNED` | false | true for Proton Mail Bridge on 127.0.0.1 (refused for any other host) |
| `LEGAL_PHONE` | empty | The phone number on the impressum (`legal.owner.show_phone` is on, so production needs it) |
| `SIMPLELOGIN_CLIENT_ID`, `SIMPLELOGIN_CLIENT_SECRET` | empty | The SimpleLogin app for signing in to /admin, see CONTENT.md |
| `ADMIN_SIMPLELOGIN_ID` | empty | The one SimpleLogin account allowed in. The sign in page shows the id the first time |
| `ADMIN_SESSION_DAYS`, `ADMIN_IDLE_DAYS` | 14, 3 | How long a sign in lasts at most, and without using the admin |
| `ADMIN_DEV_LOGIN` | true in development | The one click sign in on your own computer. Never on in production |
| `GITHUB_SYNC_TOKEN` | empty | Fine grained token, Contents read and write on the repo. Empty means saves arent committed |
| `GITHUB_SYNC_REPO`, `GITHUB_SYNC_BRANCH` | reece-barker/reecepage, main | Where the admin commits the content files |
| `MEDIA_DIR` | var/media | Where uploaded pictures and videos live, back it up |
| `MEDIA_MAX_IMAGE_MB`, `MEDIA_MAX_VIDEO_MB` | 20, 1024 | Upload limits |
| `ERROR_DSN` | empty | GlitchTip project DSN, empty switches error reporting off |
| `RELEASE` | reece-page@version | Shown with every error report |
| `ERROR_REPORT_BROWSER` | true | Also forward errors from visitors' browsers |
| `FEATURE_*` | from YAML | Overrides a feature flag, for example `FEATURE_TOOLS=true` |
| `ANALYTICS_PROVIDER` | from YAML | none, plausible or umami |

## Feature flags (`features` in the YAML)

| Flag | Default | What it switches |
| --- | --- | --- |
| `writing` | on | /writing, the feed, the nav link |
| `media` | on | /media, the video on the home page, media in articles (needs the database) |
| `contact_form` | on | The form on /contact. Off, the page shows the email address only |
| `tools` | off | /tools. Also needs at least one file in `content/tools` |
| `analytics` | off | Also needs `analytics.provider`. Loads only after consent, the banner only exists while this is on |
| `accounts`, `payments`, `status_page` | off | Reserved, nothing is built behind them yet, see FUTURE.md |

## What production refuses

`npm start` with `NODE_ENV=production` exits with code 78 and a list when any of these is true:

- `BASE_URL` missing, not https, localhost or a vercel.app preview
- `APP_SECRET` shorter than 32 characters
- SQLite as the database, or no database while `contact.store_messages` is on
- `contact.send_notifications` on without `SMTP_HOST` and `MAIL_FROM`
- the contact form on with neither storing nor emailing
- any of `legal.owner` name, street, postcode, city, country, email empty
- `legal.hosting.name` or `legal.hosting.server_location` empty
- `legal.third_country_transfer.en` or `.de` empty
- `legal.mail_provider.name` empty while notifications are on
- `legal.owner.show_phone` on without `LEGAL_PHONE`
- only one of `SIMPLELOGIN_CLIENT_ID` and `SIMPLELOGIN_CLIENT_SECRET` set, or an `ADMIN_SIMPLELOGIN_ID` that isnt an id
- `GITHUB_SYNC_REPO` not like owner/repository, or `ADMIN_SESSION_DAYS`/`ADMIN_IDLE_DAYS` out of range
- `SMTP_ALLOW_SELF_SIGNED` on with an SMTP host that isn't this machine

This is deliberate: the privacy policy and impressum print these values, publishing them half empty is worse than
not starting.

## Legal facts in the YAML

`legal.owner` (name and address for the impressum), `legal.hosting` (Hetzner), `legal.mail_provider` (Proton) and
`legal.cdn` (Cloudflare, switch `enabled` off if the DNS records are ever set to DNS only), all named in the privacy
policy, `legal.third_country_transfer` (a sentence in English and German about whether data leave the EEA),
`legal.supervisory_authority` (BayLDA, the authority for private individuals in Bavaria), `legal.server_log_days`
and `legal.updated` (the date printed on the legal pages, change it whenever the texts change).
