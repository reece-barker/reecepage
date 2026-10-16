---
title: How this site is built
summary: A server rendered Express site with Handlebars, Sass and a little three.js. Why I picked boring tools, and where I spent the effort instead.
date: 2026-10-12
tags: [Web, Node.js, Accessibility]
todo:
  - Drafted by Claude from the code. Read it, change anything that does not sound like you, then remove this line
---

Most portfolio sites are a single page built with whatever framework is popular that year. I wanted something
I could keep for years, add to without fear, and that would still work if a visitor's browser blocked every script.
So this one is deliberately plain underneath, and the effort went into the parts people actually see.

## The stack

The site is a Node.js application running Express. Pages are rendered on the server with Handlebars templates, so
every page arrives as finished HTML. Styles are written in Sass and the build is a small Gulp pipeline. Stored data,
which for now is only messages from the contact form, lives in MySQL through Sequelize.

There is no front end framework. The browser gets one small script for the menu, the theme switch and a few other
helpers, and the home page loads three.js for the tree. Everything works without JavaScript; the scripts only make
it nicer.

## Content is just files

Projects, articles and the about page are Markdown files with a block of settings at the top. Lists like the
timeline, the skills and the "right now" section are YAML files. The server reads them all at start up and checks
them, so a missing date or a typo in a branch name stops the deploy instead of breaking a page in front of someone.

Every skill on the about page links to the project that shows it. If a project is renamed, a check fails until the
link is fixed.

## The tree

The tree on the home page is drawn with three.js: one trunk, three boughs for code, earth and faith, and recursive
branches ending in square leaves. It uses a seeded random number generator, so it grows the same way on every visit.

It is also careful about cost. three.js only loads after the page has finished its own work, the drawing loop stops
when the tree is off screen or the tab is hidden, and with reduced motion switched on it draws one still frame.
Without WebGL a still picture of the same tree stays in its place.

## Accessibility and speed

The site aims for WCAG 2.2 AA. That means real headings in order, labels on every field, an error summary that
links to each problem in the contact form, visible focus, enough contrast in both themes and no motion for people
who asked their system for less.

The fonts are subset to Latin and served from this domain. Stylesheets and scripts get a content hash in their
name, so browsers can keep them for a year and still pick up a new version the moment it changes.

## Security and privacy

The server sends a strict content security policy: scripts only from this site or with a one time code on each
page, no inline styles, no framing. Forms carry a CSRF token, the contact form has a rate limit and a hidden field
that only bots fill in, and addresses of visitors are never stored, only a keyed hash used to spot floods.

There are no tracking cookies. If I ever switch on privacy friendly visitor counting, it only starts after a clear
yes, and saying no is exactly as easy as saying yes.

## Tests

Before anything goes live it has to pass the unit and integration tests, which run every page through the real
application and check status codes, metadata, structured data and the whole contact form flow, plus browser tests
with automated accessibility checks at phone, tablet and desktop sizes.
