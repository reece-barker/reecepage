---
title: Scan Assistant
summary: >-
  A Chrome extension I built for the IT team at Munich International School. It scans the school's iPads in and out,
  matches them against class lists and turns the result into a report automatically.
branch: code
kind: Work
context: Munich International School, IT
period: 2026
sort_date: 2026-09
status: In use
role: Designed and built it on my own
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

## Choices along the way

There are no pop up dialogs anywhere in the scanning flow, so nothing interrupts a run of scans. Messages appear
in the extension's own panel instead. Class lists are uploaded as CSV files.
