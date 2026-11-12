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
role: The idea and the design are mine, built by directing AI coding agents
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
de:
  title: Kino, eine Streaming-Plattform für meine Familie
  summary: >-
    Eine Streaming-Plattform, die ich für meine Familie betreibe, wie ein kleines Netflix: mit Profilen, Live-TV
    und Apps für Android TV und das iPhone. Der Code liegt auf GitHub.
  kind: Privat
  context: Privates Projekt
  period: Seit 10/2026
  status: Wird von meiner Familie genutzt
  role: >-
    Idee und Design stammen von mir, gebaut mit KI-Coding-Agenten, die ich angeleitet habe
  links:
    - label: "Der Code auf GitHub"
      url: https://github.com/reece-barker/kino
  body: |
    ## Was es ist

    Kino ist eine Streaming-Plattform, die ich für meine Familie betreibe. Jeder wählt ein Profil und bekommt sein eigenes
    Weiterschauen, eigene Bewertungen, eine eigene Merkliste und Empfehlungen aus dem, was er gesehen hat. Zwei Personen
    können ein Profil zusammenlegen, um gemeinsam zu schauen. Kinderprofile zeigen nur Titel für die ganze Familie.

    Kino spielt die Filme und Serien aus unserer eigenen Mediathek, Live-TV aus IPTV-Playlists und gemeinfreie Filme von
    archive.org. Es gibt Apps für Android-Handys, Android TV und Fire TV, das iPhone und den Desktop, und im Browser lässt
    sich Kino auch als App installieren.

    ## So ist es gebaut

    - **Der Server:** eine Python-App auf Basis von FastAPI mit SQLite, gestartet von systemd. Sie lauscht nur auf dem
      Server selbst, davor sitzt nginx.
    - **Wer hineinkommt:** Die Netzwerke der Familie stehen auf einer Zulassungsliste, und ein kleiner Helfer mit
      Root-Rechten schreibt die nginx-Liste um, wenn ein Netzwerk dazukommt. Geräte außerhalb dieser Netzwerke können
      Zugriff anfragen und freigegeben werden, nginx prüft sie bei jeder Anfrage über die App.
    - **Wiedergabe:** Die Android-App ist ein nativer Player auf Basis von ExoPlayer, der den Hardware-Decoder des Geräts
      nutzt und sich selbst aktualisiert. Live-TV-Streams, die noch kein HLS sind, werden beim Abspielen mit ffmpeg in HLS
      umgewandelt.
    - **Intro überspringen ohne Markierung:** Kino vergleicht den Ton am Anfang der Folgen einer Staffel und findet den
      Teil, den sie gemeinsam haben.
    - **Addons:** Kino spricht das Addon-Protokoll von Stremio für Kataloge, Details und Untertitel. Addon-Links, die auf
      eine private Adresse zeigen, werden abgelehnt, damit sich über ein Addon nicht der Server selbst erreichen lässt.
    - **Dauerbetrieb:** Ein Watchdog verbindet den Speicher neu, wenn er abbricht, ein Health-Check läuft per Timer, und
      die Datenbank wird jede Nacht gesichert, wobei die letzten 14 Nächte und 6 Monate aufbewahrt werden. Bei einer
      Wiederherstellung wird das Backup zuerst geprüft.
    - **Deployments:** Jeder Push auf GitHub deployt Kino, genauso wie diese Website.

    ## Stand

    Meine Familie nutzt Kino jeden Tag. Ich baue weiter daran, seit Ende Oktober 2026 sind es über 450 Commits.
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
