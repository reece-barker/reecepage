# Operations

## Health

- `GET /health`: the process is up. For uptime monitors.
- `GET /health/ready`: also pings the database (3 second timeout). 503 when it fails, for load balancers.

Neither shows versions, hostnames or error text.

## Logs

JSON lines from pino on stdout, one per request with a request id. Error pages show the same id, so a visitor can
quote it. Cookies, authorization headers and personal form fields are redacted. Static files and health checks
aren't logged. With systemd: `journalctl -u reece-page -f`. Pretty output while developing:
`npm run dev | npx pino-pretty` (install it first if you want it).

## Errors

Server errors (500s), crashes and errors in visitors' browsers go to GlitchTip at https://errors.reece.page when
`ERROR_DSN` is set. Each report carries the request id, which also shows on the error page and in the logs.
Nothing personal is sent (no IP, cookies, form contents, emails are scrubbed). GlitchTip keeps events 30 days.
Update GlitchTip by changing the image tag in `/srv/glitchtip/compose.yml`, then `docker compose pull && docker compose up -d`.

## Media

Uploaded files live in `MEDIA_DIR` (var/media), the database only knows about them. Back up both together.
`.incoming/` holds uploads in progress, anything old in there is a failed upload and can be deleted.

## Contact messages

| Task | Command |
| --- | --- |
| Read the newest | `npm run contact:list` (or `-- 50` for more) |
| Resend notifications that failed | `npm run contact:retry` |
| Delete old ones now | `npm run contact:purge` (the app also does this daily) |

## Database

- Back up the MySQL database daily (`mysqldump --single-transaction`), keep backups no longer than the retention
  period so deleted messages really go.
- `npm run db:status` shows which migrations ran. `npm run db:rollback` undoes the last one, take a backup first.

## When something breaks

| Symptom | Look at |
| --- | --- |
| Server exits with code 78 | Config problem, the message lists what is missing |
| Every visitor rate limited at once | `TRUST_PROXY` is wrong, so all requests look like the proxy |
| Form says "could not be sent" | Database and SMTP both failing, check `/health/ready` and `npm run mail:verify` |
| Notifications stop, messages still stored | SMTP token revoked or expired, `npm run mail:verify` |
| A page 500s after editing content | Shouldn't happen (saves are checked), look at the log, restore a revision |
| Admin saves don't show on GitHub | Sync page in the admin, it shows the last error. Token expired or wrong repo |
| Sync says it's waiting | More than five files would be deleted, press Sync now if that's right |
| Can't sign in | SimpleLogin down: use the passkey. Refused: `ADMIN_SIMPLELOGIN_ID` must match the id the sign in page shows |
| New CSS not showing | Rebuild with `npm run build`, then restart so the manifest reloads |

## Updating dependencies

Monthly: `npm outdated`, update, `npm run check`, `npm run test:e2e`, deploy. `npm audit` for security fixes
straight away. three.js is vendored in `assets/vendor/three-r160`, update it by replacing the folder (and its
licence file) and testing the home page.
