---
title: Kino, a streaming platform for my family
summary: >-
  A streaming platform I run for my family, like a small Netflix: profiles, live TV and apps for Android TV and the
  iPhone. The code is on GitHub.
branch: code
kind: Personal
context: Personal project
period: Since 10/2026
sort_date: 2026-10
status: In use by my family
role: The idea and the design are mine, built largely with AI coding tools
featured: true
order: 5
stack:
  - Python
  - FastAPI
  - SQLite
  - nginx
  - systemd
  - ffmpeg
  - Android (Java, ExoPlayer)
  - iOS
  - Electron
links:
  - label: The code on GitHub
    url: https://github.com/reece-barker/kino
todo:
  - A screenshot of the home screen and one of the Android TV app
---

## What it is

Kino is a streaming platform I run for my family. Everyone picks a profile and gets their own continue watching,
ratings, My List and recommendations from what they watched. Two people can join into one profile to watch together.
Kids profiles only show family titles.

It plays the films and shows in our own library, live TV from IPTV playlists, and public domain films from
archive.org. There are apps for Android phones, Android TV and Fire TV, the iPhone and the desktop, and it installs
as an app from the browser too.

## How it's built

- **The server:** a Python app on FastAPI with SQLite, run by systemd. It only listens on the server itself, nginx sits
  in front of it.
- **Who gets in:** family networks are on an allow list, and a small root helper rewrites nginx's list when a network is
  added. Devices outside those networks can ask for access and get approved, nginx checks them with the app on every
  request.
- **Playback:** the Android app is a native player on ExoPlayer that uses the device's hardware decoder and updates
  itself. Live TV streams that arent already HLS are turned into HLS with ffmpeg as they play.
- **Skip intro without marking it:** Kino compares the audio at the start of episodes in a season and finds the part
  they share.
- **Addons:** it speaks the Stremio addon protocol for catalogues, details and subtitles. Addon links that point at a
  private address are refused, so an addon cant be used to reach the server itself.
- **Keeping it running:** a watchdog reconnects the storage when it drops, a health check runs on a timer, and the
  database is backed up every night with the last 14 nights and 6 months kept. A restore checks the backup first.
- **Deploys:** every push to GitHub deploys it, the same way as this website.

## Where it stands

My family uses it every day. I keep adding to it, over 450 commits since the end of October 2026.
