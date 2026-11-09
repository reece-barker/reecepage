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
