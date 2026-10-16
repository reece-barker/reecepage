# Future: tools, accounts, payments and AI

None of this is built. The flags exist (all off) so the structure is ready, and so nobody wires a login page by
accident. This is the plan for when it's wanted.

## Tools (`features.tools`)

Routes, controller, templates and a content collection already exist. Put a Markdown file per tool in
`content/tools/` (`title`, `summary`, `status`, `launch_url`, `order`), switch the flag on and /tools appears in the
sitemap. A tool that runs in the browser goes under `assets/js/tools/` and is loaded only on its own page. Tools that
need the server get their own router file and their own rate limit.

## Accounts (`features.accounts`)

Only once something actually needs a login (saved tool settings, paid tools).

- Sessions in MySQL (express-session with a Sequelize store), cookie `__Host-` prefixed, HttpOnly, SameSite Lax.
- Passwords with argon2id, or email login links to avoid storing passwords at all.
- New tables through migrations: `users`, `sessions`, `login_tokens`.
- CSRF switches from double submit to session bound tokens (csrf-csrf supports both, change
  `getSessionIdentifier`).
- The privacy policy needs a new section before launch, and a way to delete an account and its data.

## Payments (`features.payments`)

Stripe Checkout, so card details never touch this server.

- Server creates a Checkout Session, the browser is redirected to Stripe, Stripe calls a webhook.
- Webhook route gets the raw body (mounted before the urlencoded parser) and checks Stripe's signature.
- Store only Stripe ids and what was bought, never card data. A `payments` table with the event id unique so a
  repeated webhook is harmless.
- CSP: add `https://js.stripe.com` only on payment pages, or only use the hosted Checkout page and add nothing.
- Needs: Impressum business details (VAT or Kleinunternehmer status), terms of sale, withdrawal notice
  (Widerrufsbelehrung), and a check with a tax adviser. Don't switch this on without those.

## AI tools

- Calls to a model API happen on the server only, the key stays in `.env`.
- Per visitor and global rate limits, a monthly spend limit in the config, and a kill switch flag.
- Say clearly on the page that text is sent to an AI provider, name it in the privacy policy, and don't store
  prompts unless the visitor is told and agrees.

## Status page (`features.status_page`)

Only worth it once there are several services. It would read `/health/ready` of each and show a simple history.
