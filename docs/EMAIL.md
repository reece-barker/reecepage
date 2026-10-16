# Email

The site sends one kind of email: a notification to `me@reece.page` when someone uses the contact form, with their
address as Reply-To so answering is one click. It never emails visitors, so there is no confirmation email a bot
could use to send spam to other people. Messages are stored in the database first, so a mail problem loses nothing,
and `npm run contact:retry` sends whatever did not go out.

The provider is Proton Mail (Proton AG, Switzerland). There are two ways to send through it, both work.

## Option 1: Proton Mail Bridge on the server

Bridge runs headless on Linux with its command line interface and gives the server a local SMTP server on
127.0.0.1:1025. Setup is in [DEPLOYMENT.md, step 9](DEPLOYMENT.md#9-email-with-proton). Settings:

```
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_ALLOW_SELF_SIGNED=true     # Bridge uses its own certificate, accepted for 127.0.0.1 only
SMTP_USER=<from bridge "info">
SMTP_PASSWORD=<from bridge "info">
MAIL_FROM="reece.page <website@reece.page>"
```

Things to keep in mind: Bridge is a long running process holding a logged in session, so it gets its own systemd
service with `Restart=always`, and after a Proton password change it has to be logged in again. `/health/ready`
does not check mail, so if notifications stop, `npm run mail:verify` is the first thing to run.

## Option 2: Proton SMTP submission tokens

No extra process on the server. A token can only send, not read the mailbox, and can be revoked on its own. Needs a
paid Proton plan with the custom domain.

```
SMTP_HOST=smtp.protonmail.ch
SMTP_PORT=587
SMTP_SECURE=false               # 587 uses STARTTLS, the app insists on TLS
SMTP_USER=website@reece.page
SMTP_PASSWORD=<the token, shown once when it is made>
MAIL_FROM="reece.page <website@reece.page>"
```

## Either way

- `website@reece.page` has to exist as an address (or alias) on the Proton account, Proton refuses to send as an
  address it doesn't know.
- SPF, DKIM and DMARC records from Proton's domain settings must be in Cloudflare (DNS only), otherwise
  notifications can land in spam.
- `npm run mail:verify -- --send` tests the login and sends a test email.
- GlitchTip's alert emails can use the same Bridge or a second token (`EMAIL_URL` in deploy/glitchtip/.env).

Source for the token settings: [Proton support, SMTP submission](https://proton.me/support/smtp-submission)
