#!/usr/bin/env bash
# The steps that put a commit live, run as root by reece-page-update (deploy/update.sh) after it fetched the code.
# Everything that touches the app runs as the app user so no file in /srv/reece-page ends up owned by root, only the
# system bits (Chromiums libraries, the restart, reinstalling the update command) run as root.
set -euo pipefail
REPO=/srv/reece-page
APP_USER=deploy
BEFORE="${1:-}"

step() { printf '\n== %s\n' "$*"; }
as_app() { sudo -u "$APP_USER" -H bash -c "cd '$REPO' && $1"; }

step "Release number and secrets"
# RELEASE is the commit thats live, /status and every error report show it. The secrets update.sh read from GitHub
# go into .env the same way, an empty or missing one leaves whats there alone
sudo -u "$APP_USER" -H --preserve-env=SIMPLELOGIN_CLIENT_ID,SIMPLELOGIN_CLIENT_SECRET,ADMIN_SIMPLELOGIN_ID,GITHUB_SYNC_TOKEN \
  bash -c "cd '$REPO' && RELEASE=\$(git rev-parse --short HEAD) node scripts/env-set.js"

step "Packages and build"
as_app 'npm ci --no-audit --no-fund'
as_app 'npm run build'
as_app 'npm prune --omit=dev --no-audit --no-fund'

step "Chromium for the PDFs"
# The browser itself goes in the app users home and only downloads when the version changed. Its system libraries
# need root, apt skips them quickly when theyre already there. Neither stops a deploy, the PDF button says whats wrong
as_app 'npx --no-install playwright-core install chromium' || echo "chromium download failed, the PDF buttons wont work until it does"
(cd "$REPO" && npx --no-install playwright-core install-deps chromium >/dev/null 2>&1) || echo "chromium system libraries couldnt be installed, run: cd $REPO && sudo npx --no-install playwright-core install-deps chromium"

step "Database"
as_app 'npm run db:migrate'

step "Content from the pull request"
# Content files changed in this deploy go into the database, unless that page or list was edited in the admin since.
# It prints any clash and never stops the deploy
if [ -n "$BEFORE" ]; then
  as_app "npm run content:apply -- --since '$BEFORE'" || echo "content apply failed, the site still deploys, check the lines above"
fi

step "Restart"
# root ran npx above, make sure nothing it left behind is owned by root before the app starts
chown -R "$APP_USER:$APP_USER" "$REPO"
systemctl restart reece-page
# Up to 30 seconds for the site to say its ready, a broken release fails the github run here so you see it
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/health/ready; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3000/health/ready >/dev/null || { echo "The site didnt come back, check: journalctl -u reece-page -n 50"; exit 1; }

# The update command itself comes from the repo too, so a change to it lands with the next deploy
install -m 755 "$REPO/deploy/update.sh" /usr/local/sbin/reece-page-update

step "Live: $(sudo -u "$APP_USER" git -C "$REPO" log -1 --format='%h %s')"
