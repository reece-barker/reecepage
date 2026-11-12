---
title: My servers and home lab
summary: >-
  The servers behind this website and Kino: a server running nginx in front of my apps, deploys from GitHub on every
  push, network storage for the media library, and a server at home.
branch: code
kind: Personal
context: Personal project
period: 2026
sort_date: 2026-10
status: Running
role: Set up and run on my own
featured: false
order: 9
stack:
  - Linux
  - nginx
  - systemd
  - SSH
  - Cloudflare DNS
  - GitHub Actions
  - fail2ban
todo:
  - What the server at home runs and on what hardware
  - A simple diagram of what runs where
de:
  title: Meine Server und mein Home-Lab
  summary: >-
    Die Server hinter dieser Website und hinter Kino: ein Server mit nginx vor meinen Apps, Deployments aus GitHub
    bei jedem Push, Netzwerkspeicher für die Mediathek und ein Server bei mir zu Hause.
  kind: Privat
  context: Privates Projekt
  period: "2026"
  status: Läuft
  role: Allein eingerichtet und betrieben
  body: |
    ## Was wo läuft

    Ein Server betreibt nginx vor allem anderen. Jede App, diese Website (Node.js) und [Kino](/de/projects/kino) (Python),
    lauscht nur auf dem Server selbst, nginx ist die einzige Tür nach außen. Die Domains liegen bei Cloudflare DNS. Die
    Mediathek liegt auf einem Netzwerkspeicher, der per SSH eingebunden ist, und die nächtlichen Backups von Kino landen
    ebenfalls dort.

    Zu Hause betreibe ich außerdem einen eigenen Server.

    ## Deployments

    Beide Seiten deployen sich selbst. Jeder Push auf main startet zuerst die Prüfungen in GitHub Actions und meldet sich
    dann mit einem Schlüssel an, der nur einen einzigen Update-Befehl ausführen darf, sonst nichts. Dieser Befehl holt den
    Code, baut ihn, startet die App neu und lässt den Lauf fehlschlagen, wenn die Seite danach nicht wieder erreichbar ist.

    ## Sicherheit

    - SSH nur mit Schlüsseln, und fail2ban bei wiederholten fehlgeschlagenen Anmeldungen.
    - Kein App-Port ist im Internet offen, nur nginx.
    - Kino ist nur für Personen aus einer Liste erlaubter Netzwerke oder Geräte erreichbar.
---

## What runs where

One server runs nginx in front of everything. Each app, this website (Node.js) and [Kino](/projects/kino) (Python),
only listens on the server itself, nginx is the one door in. The domains are on Cloudflare DNS. The media library
sits on network storage mounted over SSH, and Kino's nightly backups go there too.

At home I run my own server as well.

## Deploys

Both sites deploy themselves. Every push to main runs the checks in GitHub Actions first, then logs in with a key that
can only run one update command, nothing else. That command pulls the code, builds it, restarts the app and fails the
run if the site doesnt come back.

## Keeping it safe

- SSH with keys only, and fail2ban for repeated failed logins.
- No app port is open to the internet, only nginx.
- Kino is only for people on an allow list of networks or devices.
