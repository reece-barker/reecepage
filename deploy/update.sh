#!/usr/bin/env bash
# Pulls the latest main from github and puts it live. GitHub Actions runs this after every push to main, through a
# key on the server that can only run this script and nothing else (same as kino). You can also run it by hand
# on the server with: sudo reece-page-update
#
# This copy gets installed as /usr/local/sbin/reece-page-update, it only fetches the code and then hands over to
# deploy/release.sh from the repo, so the actual steps always come from the commit thats being deployed
set -euo pipefail
REPO=/srv/reece-page
APP_USER=deploy

# The secrets from GitHub (sign in and the GitHub sync) come in on stdin as KEY=value lines, never on a command
# line where ps could show them. Only these names are taken, anything else is ignored. Run by hand theres nothing
# on stdin and the .env stays as it is
SECRET_KEYS="SIMPLELOGIN_CLIENT_ID SIMPLELOGIN_CLIENT_SECRET ADMIN_SIMPLELOGIN_ID GITHUB_SYNC_TOKEN"
if [ ! -t 0 ]; then
  while IFS= read -r -t 10 line; do
    key="${line%%=*}"; value="${line#*=}"
    case " $SECRET_KEYS " in *" $key "*) [ -n "$value" ] && export "$key=$value" ;; esac
  done || true
fi

# Only one deploy at a time, if two merges land close together the second one waits for the first
exec 9>/run/reece-page-update.lock
flock -w 900 9

cd "$REPO"
# Anything a sudo command left owned by root goes back to the app user first, that is what broke the deploy on
# 9 November 2026 (npm and git couldnt touch files root had made)
chown -R "$APP_USER:$APP_USER" "$REPO"

as_app() { sudo -u "$APP_USER" -H "$@"; }

# The commit the site was on before, so content changes in this deploy can be told apart from admin edits
BEFORE=$(as_app git -C "$REPO" rev-parse HEAD)
as_app git -C "$REPO" fetch -q origin main
# reset not pull, so a file changed by hand on the server can never block a deploy. .env, var/ and node_modules
# arent tracked by git so they stay as they are
as_app git -C "$REPO" reset -q --hard origin/main
echo "Deploying $(as_app git -C "$REPO" log -1 --format='%h %s'), was ${BEFORE:0:7}"

exec bash "$REPO/deploy/release.sh" "$BEFORE"
