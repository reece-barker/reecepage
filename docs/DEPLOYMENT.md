# Going live: Hetzner, Cloudflare, nginx, the app

The whole road from an empty Hetzner account to reece.page running, in order. Commands are for Ubuntu 24.04 LTS.
Anything in `<angle brackets>` is yours to fill in. Tick things off in [PRE-LAUNCH.md](PRE-LAUNCH.md) as you go.

How the pieces fit:

```
visitor -> Cloudflare (DNS, TLS, cache, DDoS) -> Hetzner server
                                                 nginx :443 (Cloudflare origin certificate)
                                                   reece.page        -> Node app on 127.0.0.1:3000 -> MySQL
                                                   errors.reece.page -> GlitchTip on 127.0.0.1:8000 (Docker)
                                                 Proton Mail Bridge on 127.0.0.1:1025 (or Proton SMTP tokens)
```

## 1. Hetzner server

1. In the Hetzner Cloud console, create a project `reece-page`.
2. Add your SSH public key (Security, SSH keys). On the Mac: `cat ~/.ssh/id_ed25519.pub`, or make one with
   `ssh-keygen -t ed25519`.
3. Create a server:
   - Location: Nuremberg or Falkenstein (Germany, matches `legal.hosting.server_location`)
   - Image: Ubuntu 24.04
   - Type: CX22 (2 vCPU, 4 GB) is plenty for the site plus GlitchTip. CX32 if you want headroom
   - Networking: public IPv4 and IPv6
   - SSH key: yours. Backups: on (daily, kept 7 days, about 20 % of the server price)
   - Name: `reece-page-1`
4. Firewall (Firewalls, create): inbound TCP 22 from your home IP only if it is fixed (otherwise any), TCP 80 and
   443 from anywhere (or only Cloudflare's ranges, see step 6). Apply it to the server.
5. Conclude Hetzner's data processing agreement (Auftragsverarbeitungsvertrag, AVV) in your Hetzner account
   (accounts.hetzner.com, it is in the account area, search for "AVV" if the menu has moved). The privacy policy says
   it exists.
6. Note the IPv4 and IPv6 addresses.

## 2. First login and hardening

```bash
ssh root@<ipv4>
apt update && apt full-upgrade -y
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
timedatectl set-timezone Europe/Berlin
# Swap, so a big build or a busy GlitchTip never kills the box
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Log in again as `deploy` in a second window before closing the root one, then:

```bash
sudo nano /etc/ssh/sshd_config.d/10-hardening.conf
#   PermitRootLogin no
#   PasswordAuthentication no
#   KbdInteractiveAuthentication no
sudo systemctl restart ssh
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' 2>/dev/null || sudo ufw allow 80,443/tcp
sudo ufw enable
sudo dpkg-reconfigure -plow unattended-upgrades   # say yes
```

## 3. Software

```bash
# Node.js 22 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx mysql-server ffmpeg
node -v   # 22.12 or newer

# Docker, only for GlitchTip
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy   # log out and in again
```

## 4. MySQL

```bash
sudo mysql_secure_installation          # remove anonymous users and the test database
sudo mysql
```

```sql
CREATE DATABASE reece_page CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'reece_page'@'localhost' IDENTIFIED BY '<long random password, openssl rand -hex 24>';
GRANT ALL PRIVILEGES ON reece_page.* TO 'reece_page'@'localhost';
FLUSH PRIVILEGES;
```

MySQL only listens on 127.0.0.1 by default on Ubuntu, leave it like that.

## 5. Cloudflare

1. Add the site `reece.page` in Cloudflare (Free plan is fine) and let it scan the existing DNS records.
2. At the registrar of reece.page, change the nameservers to the two Cloudflare shows. Wait until Cloudflare says the
   site is active (minutes to a few hours).
3. DNS records:

   | Type | Name | Content | Proxy |
   | --- | --- | --- | --- |
   | A | `@` | `<ipv4>` | Proxied (orange) |
   | AAAA | `@` | `<ipv6>` | Proxied |
   | CNAME | `www` | `reece.page` | Proxied |
   | A | `errors` | `<ipv4>` | Proxied |
   | MX, TXT, CNAME | as Proton shows them (step 9) | | DNS only (grey) |

   Mail records are always DNS only. If you ever switch the website records to DNS only (grey), Cloudflare no longer
   sees visitors and `legal.cdn.enabled` in `config/application.yml` can be set to false.
4. SSL/TLS:
   - Overview: Full (strict)
   - Origin Server: Create Certificate, RSA, hostnames `reece.page, *.reece.page`, 15 years. Save the certificate as
     `/etc/ssl/cloudflare/reece.page.pem` and the key as `/etc/ssl/cloudflare/reece.page.key` on the server
     (`sudo mkdir -p /etc/ssl/cloudflare && sudo chmod 700 /etc/ssl/cloudflare`)
   - Edge Certificates: Always Use HTTPS on, Minimum TLS 1.2, Automatic HTTPS Rewrites on. Leave HSTS off here, the
     app sends it itself
5. Turn these off, they inject scripts the site's security policy blocks: Scrape Shield, Email Address Obfuscation;
   Speed, Rocket Loader. Leave Auto Minify off.
6. Caching, Cache Rules: one rule "Bypass admin": URI path starts with `/admin` -> Bypass cache. Everything else can
   use the default (the app already sends the right cache headers).
7. Security: Bot Fight Mode on is fine. Under Settings, set Security Level to Medium.
8. Make sure Cloudflare's Data Processing Addendum applies to your account (for self serve plans it is part of the
   terms, the current version is linked from cloudflare.com/cloudflare-customer-dpa). Keep a copy with your records.

## 6. nginx

`/etc/nginx/sites-available/reece.page`:

```nginx
# Real visitor addresses from Cloudflare, so rate limits and logs see people, not Cloudflare
# The full list: https://www.cloudflare.com/ips/ (refresh it now and then)
include /etc/nginx/snippets/cloudflare-real-ip.conf;

server {
  listen 80;
  listen [::]:80;
  server_name reece.page www.reece.page errors.reece.page;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name www.reece.page;
  ssl_certificate     /etc/ssl/cloudflare/reece.page.pem;
  ssl_certificate_key /etc/ssl/cloudflare/reece.page.key;
  return 301 https://reece.page$request_uri;
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name reece.page;
  ssl_certificate     /etc/ssl/cloudflare/reece.page.pem;
  ssl_certificate_key /etc/ssl/cloudflare/reece.page.key;

  access_log /var/log/nginx/reece.page.access.log;
  client_max_body_size 64k;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    # After real_ip, $remote_addr is the visitor. One proxy in front of the app, so TRUST_PROXY=1
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }

  # Video and picture uploads on the admin page go up as one request, so this one place allows big bodies.
  # Cloudflare's free plan caps a request at 100 MB: upload bigger videos with scp and npm run media:add instead
  location /admin/media/ {
    client_max_body_size 1100m;
    proxy_request_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name errors.reece.page;
  ssl_certificate     /etc/ssl/cloudflare/reece.page.pem;
  ssl_certificate_key /etc/ssl/cloudflare/reece.page.key;
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

`/etc/nginx/snippets/cloudflare-real-ip.conf` (one `set_real_ip_from` line per range listed on cloudflare.com/ips):

```nginx
set_real_ip_from 173.245.48.0/20;
# ... every IPv4 and IPv6 range from https://www.cloudflare.com/ips/
real_ip_header CF-Connecting-IP;
```

```bash
sudo ln -s /etc/nginx/sites-available/reece.page /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Keep nginx access logs for 7 days (the privacy policy says so): in `/etc/logrotate.d/nginx` set `daily` and
`rotate 7`.

## 7. The app

```bash
sudo mkdir -p /srv/reece-page && sudo chown deploy:deploy /srv/reece-page
git clone https://github.com/reece-barker/reece-page.git /srv/reece-page   # or rsync it up from the Mac
cd /srv/reece-page
npm ci
npm run build
npm prune --omit=dev
cp .env.example .env && chmod 600 .env && nano .env
```

`.env` for production:

```
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
BASE_URL=https://reece.page
TRUST_PROXY=1
APP_SECRET=<npm run secret>
DB_DIALECT=mysql
DB_HOST=127.0.0.1
DB_NAME=reece_page
DB_USER=reece_page
DB_PASSWORD=<from step 4>
SMTP_HOST=127.0.0.1                 # Proton Mail Bridge, see step 9
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_ALLOW_SELF_SIGNED=true
SMTP_USER=<bridge username>
SMTP_PASSWORD=<bridge password>
MAIL_FROM="reece.page <website@reece.page>"
CONTACT_NOTIFY_TO=me@reece.page
LEGAL_PHONE="<your phone number>"
# SIMPLELOGIN_CLIENT_ID, SIMPLELOGIN_CLIENT_SECRET, ADMIN_SIMPLELOGIN_ID and GITHUB_SYNC_TOKEN are written in
# by the deploy from the GitHub secrets, see CONTENT.md
ERROR_DSN=<from GlitchTip, step 10>
RELEASE=<git rev-parse --short HEAD, the deploy script can fill this>
```

```bash
npm run db:migrate
npm run mail:verify -- --send       # after step 9
mkdir -p var/media
```

systemd unit `/etc/systemd/system/reece-page.service`:

```ini
[Unit]
Description=reece.page
After=network.target mysql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/reece-page
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning src/server.js
Restart=on-failure
RestartSec=5
# A config error exits with 78, restarting would only repeat it
RestartPreventExitStatus=78
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/srv/reece-page/var
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now reece-page
sudo systemctl status reece-page
curl -s http://127.0.0.1:3000/health/ready
```

If it exits straight away, `journalctl -u reece-page -n 50` shows the list of what is missing.

## 8. Every deploy after that

```bash
cd /srv/reece-page
git pull
npm ci && npm run check && npm run build && npm prune --omit=dev
npm run db:migrate
sudo systemctl restart reece-page
curl -fsS https://reece.page/health/ready
```

Then purge the Cloudflare cache for `/` if the home page changed (Caching, Configuration, Purge Everything is fine,
hashed assets are unaffected).

## 9. Email with Proton

Pick one:

**Proton Mail Bridge on the server** (works headless, you have run it before):

```bash
# Download the .deb for Linux from proton.me/mail/bridge, then
sudo apt install -y ./protonmail-bridge_*.deb pass gnupg
gpg --batch --passphrase '' --quick-gen-key 'bridge@reece-page' default default never
pass init bridge@reece-page
protonmail-bridge --cli
#   login         (your Proton account)
#   info          shows the SMTP username and password for .env, port 1025, STARTTLS
#   exit
```

Run it as a service (`/etc/systemd/system/proton-bridge.service`, `User=deploy`,
`ExecStart=/usr/bin/protonmail-bridge --noninteractive`, `Restart=always`). It listens on 127.0.0.1 only.
`SMTP_ALLOW_SELF_SIGNED=true` lets the app accept Bridge's own certificate, and only for 127.0.0.1.

**Or Proton SMTP submission tokens** (no Bridge process): Proton Settings, IMAP/SMTP, SMTP tokens, create one for
`website@reece.page`. Then `SMTP_HOST=smtp.protonmail.ch`, `SMTP_PORT=587`, `SMTP_USER=website@reece.page`,
`SMTP_PASSWORD=<token>`, and no `SMTP_ALLOW_SELF_SIGNED`.

DNS for the domain (Proton, Settings, Domain names shows the exact values): MX records, the SPF TXT record
(`v=spf1 include:_spf.protonmail.ch ~all`), the three DKIM CNAMEs and a DMARC TXT record
(`_dmarc`, `v=DMARC1; p=quarantine; rua=mailto:me@reece.page`). All DNS only in Cloudflare.

Test: `npm run mail:verify -- --send`, then send yourself a message through the contact form.

## 10. Error monitoring (GlitchTip)

```bash
sudo mkdir -p /srv/glitchtip && sudo chown deploy:deploy /srv/glitchtip
cp /srv/reece-page/deploy/glitchtip/compose.yml /srv/glitchtip/
cp /srv/reece-page/deploy/glitchtip/.env.example /srv/glitchtip/.env && chmod 600 /srv/glitchtip/.env
nano /srv/glitchtip/.env           # SECRET_KEY and POSTGRES_PASSWORD with openssl rand -hex 32
cd /srv/glitchtip && docker compose up -d
docker compose run --rm migrate ./manage.py createsuperuser
```

Open https://errors.reece.page, sign in, create an organisation and a project "reece-page" (platform Node.js),
copy its DSN into `ERROR_DSN` in the app's `.env`, restart the app. Then set `ENABLE_USER_REGISTRATION=False` in
GlitchTip's `.env` and `docker compose up -d` again. In GlitchTip, Uptime Monitors, add
`https://reece.page/health/ready` every minute, with an email alert, that is the uptime monitoring done too.

To check it works: `curl -X POST https://reece.page/errors -H 'Content-Type: application/json' -d '{"message":"test from curl","page":"/"}'`
shows up in GlitchTip within seconds.

## 11. Media and the introduction video

```bash
# From the Mac, the video and its captions:
scp "reece-barker-long-form-v3.mp4" "reece-barker-long-form-v3.srt" deploy@<ipv4>:/tmp/
# On the server:
cd /srv/reece-page && npm run media:add -- /tmp/reece-barker-long-form-v3.mp4 --faststart \
  --title "Meet Reece" --captions /tmp/reece-barker-long-form-v3.srt --feature \
  --caption "Where I grew up, what I study, what I have built and what I want to work on next." \
  --credit "Music composed for this video. Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0). Strings and percussion: VSCO 2 Community Edition (CC0). Full credits on the copyright page."
```

Smaller pictures and clips can go through https://reece.page/admin/media in the browser.

## 12. Backups

- Hetzner server backups (step 1) cover the whole disk daily.
- Database and media separately, so a single thing can be restored. A nightly cron as `deploy`:

```bash
# crontab -e
15 3 * * * mysqldump --single-transaction reece_page | gzip > /srv/backups/db-$(date +\%F).sql.gz && find /srv/backups -name 'db-*.sql.gz' -mtime +30 -delete
```

  (put the database login in `~/.my.cnf` with `chmod 600`). Copy `/srv/backups` and `/srv/reece-page/var/media` off
  the server, for example to a Hetzner Storage Box with `restic` or `rsync`. Keep database backups no longer than the
  365 day retention, so deleted messages really disappear.
- Try a restore once: import a dump into a scratch database and check the messages are there.

## 13. Going live checklist

- https://reece.page loads, http and www redirect to it, the padlock shows
- https://reece.page/health/ready answers `{"status":"ok", ...}`
- `curl -sI https://reece.page | grep -i -E 'strict-transport|content-security'` shows both headers
- robots.txt allows crawling and lists the sitemap, the sitemap opens
- A message sent through the contact form arrives, `npm run contact:list` shows it
- An error test shows in GlitchTip, the uptime monitor is green
- Google Search Console: add the domain property (DNS TXT record in Cloudflare), submit `https://reece.page/sitemap.xml`.
  Same in Bing Webmaster Tools (it can import from Search Console)
- Post the link in a private chat to check the share picture
