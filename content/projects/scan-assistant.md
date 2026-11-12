---
title: Scan Assistant
summary: >-
  A Chrome extension for the IT team at Munich International School. It scans the school's iPads in and out, matches
  them against class lists and turns the result into a report automatically.
branch: code
kind: Work
context: Munich International School, IT
period: 2026
sort_date: 2026-09
status: In use
role: The idea, the design and the prototype were mine, built by directing AI coding agents
featured: true
order: 4
stack:
  - Chrome extension
  - JavaScript
  - Snipe-IT
  - Barcode scanning
  - Speech synthesis
todo:
  - A screenshot with student names blurred or replaced
  - How many devices it has been used for
de:
  title: Scan Assistant
  summary: >-
    Eine Chrome-Erweiterung für das IT-Team der Munich International School. Sie scannt die iPads der Schule ein
    und aus, gleicht sie mit Klassenlisten ab und macht daraus automatisch einen Bericht.
  kind: Arbeit
  context: Munich International School, IT
  period: "2026"
  status: Im Einsatz
  role: >-
    Idee, Design und Prototyp stammen von mir, gebaut mit KI-Coding-Agenten, die ich angeleitet habe
  body: |
    ## Das Problem

    Das IT-Team verwaltet die iPads der Schule in Snipe-IT, einem Asset-Management-System. Einen Klassensatz ein- oder
    auszubuchen hieß, jedes Gerät einzeln zu suchen, Seriennummern von Hand einzutippen und das Ergebnis danach mit der
    Klassenliste abzugleichen.

    ## Was es kann

    - **Ein- und Ausbuchen** per Barcode-Scan, mit gesprochener Bestätigung, damit der Blick schon beim nächsten Gerät sein
      kann.
    - **Homeroom-Abfrage,** um zu sehen, welche Geräte zu welcher Klasse gehören.
    - **Abgleich mit der Klassenliste,** der zeigt, welche Schülerinnen und Schüler ein Gerät haben, bei wem eines fehlt und
      welche Geräte dort aufgetaucht sind, wo sie nicht hingehören.
    - **Farbcodierte Excel-Berichte** am Ende eines Durchlaufs.
    - **Namensabgleich, der mit deutschen Umlauten zurechtkommt,** sodass Namen zusammenpassen, egal wie sie getippt wurden.

    ## Wie es entstanden ist

    Die Idee und der erste Prototyp stammen von mir: Ich habe entworfen, wie ein Scan-Durchlauf ablaufen soll und was das
    Team dafür braucht. Gebaut habe ich es dann, indem ich KI-Coding-Agenten angeleitet habe: Ich habe entschieden, was es
    tun soll, die Anweisungen geschrieben, nach denen sie gearbeitet haben, und geprüft, was zurückkam.

    ## Entscheidungen unterwegs

    Im gesamten Scan-Ablauf gibt es keine Pop-up-Dialoge, damit nichts eine Scan-Reihe unterbricht. Meldungen erscheinen
    stattdessen im eigenen Bereich der Erweiterung. Klassenlisten werden als CSV-Dateien hochgeladen.
---

## The problem

The IT team tracks the school's iPads in Snipe-IT, an asset management system. Checking a class set in or out
meant finding each device and typing serial numbers by hand, then comparing the result against the class list.

## What it does

- **Check in and check out** by scanning a device's barcode, with a spoken confirmation so you can keep your eyes on
  the next device.
- **Homeroom lookup** to see which devices belong to which class.
- **Class list comparison** that shows which students have a device, which are missing one, and which devices
  turned up where they should not.
- **Colour coded Excel reports** at the end of a run.
- **Name matching that copes with German umlauts,** so names match however they were typed.

## How it was made

The idea and the first prototype were mine: I designed how a scanning run should work and what the team needed
from it. I then built it by directing AI coding agents: I decided what it should do, wrote the instructions they worked from
and checked what came back.

## Choices along the way

There are no pop up dialogs anywhere in the scanning flow, so nothing interrupts a run of scans. Messages appear
in the extension's own panel instead. Class lists are uploaded as CSV files.
