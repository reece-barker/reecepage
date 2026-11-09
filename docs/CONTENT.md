# Content

Everything a visitor reads is kept in the database and edited in the admin at /admin (see below). The files in
`content/` are a copy of it: the admin commits every save back to them on GitHub, they fill an empty database on
the first start (`npm run content:import`, `-- --force` to overwrite), and the site falls back to them if the
database is down. Run `npm run content:check` after editing files, it catches broken front matter, em dashes and
links to pages that don't exist.

## Content changes in a pull request

A file in `content/` changed in a pull request goes live with the deploy. The deploy compares three versions of
every changed file: before the pull, after it, and what the database holds now.

- Database the same as the new file: nothing to do (every mirror commit from the admin is like this).
- Database the same as the old file: nobody touched it in the admin, the new version goes in.
- Anything else: it was edited in the admin since, so it is left alone and the deploy log says `CONFLICT` with the
  file. Make that change in the admin instead.

A file deleted in a pull request is never deleted from the site, the log lists it so you can move it to the trash
in the admin. Try it on your Mac first with `npm run content:apply -- --since <commit> --dry-run`.

## A new project

Make `content/projects/<slug>.md`. The slug is the address: lowercase words joined by hyphens.

```markdown
---
title: An example project                   # 80 characters max
summary: One or two sentences for lists and search results.   # 220 max, aim for 160
branch: code                                 # code, earth or faith (faith shows as People)
kind: Course project                         # Startup, Work, Personal, Freelance product...
context: Where it happened                  # optional
period: 2026                                 # shown as written, "2026 to February 2027" is fine
sort_date: 2026-05                           # decides the order, newest first
role: What I did                            # optional
team: Who else was in it                    # optional
status: Finished                             # optional
featured: true                               # on the home page (the first four by order)
order: 3
stack: [Tool one, Tool two]
facts:                                       # optional "at a glance" lines
  - { label: Result, value: What came out of it }
links:
  - { label: Source code, url: https://github.com/... }
cover: images/projects/example.webp          # reserved for a photo, templates dont show it yet
page: true                                   # false lists it without a page of its own
draft: false                                 # true hides it everywhere
todo:                                        # what is still missing, shows in development only
  - A photo of it
---

## Why

Markdown from here. Headings at level 2 build the "On this page" list.
```

Images in Markdown can carry their size so the page doesn't jump: `![What it shows](/assets/... "1200x800")`.

After adding a project with a page, run `npm run images:og` for its share picture.

## A new article

`content/writing/<slug>.md` with `title`, `summary`, `date` (and `updated` when you change it later), optional
`tags` and `todo`. It shows on /writing, in the feed and in the sitemap straight away.

## Lists

- `content/data/branches.yml`: the three branches on the home page
- `content/data/now.yml`: "Right now" on the home and about pages, change `updated` when you edit it
- `content/data/timeline.yml`: experience and education
- `content/data/skills.yml`: each skill lists the project slugs that show it, the check fails if one disappears

## House rules

British English, no em dashes, nothing invented. If something isn't known yet it goes in `todo`, never into the
text as a guess. The startup is Cognitive Atmospherics (named since November 2026), its prototype is only described in general terms. No gaming wording on anything an employer
reads.

## The admin, editing without touching files

https://reece.page/admin. Signing in is SimpleLogin (Proton) or a passkey, theres no sign up, only one account gets
in. On your computer `npm run dev` gives a one click development sign in instead.

Setting up the sign in, once. The secrets live in GitHub (repo, Settings, Secrets and variables, Actions) and the
deploy writes them into the server .env, so theres no need to ssh in:

1. On https://app.simplelogin.io/developer make an app, redirect address
   `https://reece.page/admin/login/simplelogin/callback` (and `http://localhost:3000/admin/login/simplelogin/callback`
   for your computer). Add its AppID and AppSecret as the secrets `SIMPLELOGIN_CLIENT_ID` and
   `SIMPLELOGIN_CLIENT_SECRET`, then run the deploy from the Actions tab (Deploy reece.page, Run workflow).
2. Sign in once. It refuses you but shows your SimpleLogin id. Add it as the secret `ADMIN_SIMPLELOGIN_ID` and run
   the deploy again.
3. Sign in, go to Account and add a passkey, the backup if SimpleLogin is ever down.
4. For the GitHub commits add the token as the secret `SYNC_TOKEN` (GitHub doesnt allow secret names starting
   with GITHUB_, the deploy puts it in .env as `GITHUB_SYNC_TOKEN`).

An empty secret leaves the line in .env alone, so editing .env by hand still works too.

What's in it:

- **Writing, Pages, Projects, Tools**: drafts, publishing, scheduling (a publish time in the future), the trash,
  and revisions with restore. The editor is blocks (type `/` for the menu: headings, lists, quotes, code, tables,
  callouts, buttons, pictures, galleries) with a switch to Markdown, and a live preview at phone, fit and desktop
  widths. Ctrl or Cmd + S saves, it also autosaves every 30 seconds without changing what's live.
- **Pictures**: drag the corner to resize (small, medium, text width, wide, edge to edge), float left or right, a
  caption and a link. They're shrunk and stripped of location data before uploading, and the site serves the right
  size for each screen.
- **Pages**: new pages at their own address like /uses. Addresses the site already uses are refused.
- **Legal**: the impressum, privacy and the rest are Handlebars templates, the facts come from the YAML and
  .env. A template with a mistake is refused instead of breaking the page.
- **Lists**: timeline, skills, CV, references, right now, branches, the home page texts, menus and site settings.
- **Media**, **Sync** (the GitHub commits), **Account** (passkeys, sessions) and **System** (every address).

Every save is committed to GitHub a moment later (`[skip ci]`, so it doesn't redeploy). Pull before you push code:
`git pull --rebase`. Needs `GITHUB_SYNC_TOKEN`, a fine grained token with Contents read and write on the repo only.
More than five deleted files in one go waits for Sync now in the admin, so a mistake can't wipe the folder.

Block codes in the Markdown, if you write it by hand:

```
[[media:slug size=small|medium|text|wide|full align=left|center|right caption="..." link="..."]]
[[gallery:slug-one,slug-two,slug-three columns=2|3|4 caption="..."]]
[[button href="/contact" label="Get in touch" style=secondary]]
:::note title="Optional title"        (also tip and warning)
Text
:::
:::quote cite="Who said it"
Text
:::
```

## The CV

Two versions from the same lists: /cv in English and /lebenslauf in German. cv.yml has the headline, profile,
projects with their own CV lines, languages and a `de` part with the German text. Every timeline entry has a `de`
part too (when, title, place, text), and skills have `group_de` and `name_de`. Anything without German falls back
to the English, so check /lebenslauf after adding something. Dates are MM/YYYY.

It is one column with the dates on the left, the way application systems read it best, and the photo in
assets/images/cv (switch it off with `photo` in cv.yml). It is one page, keep it that way: each timeline entry has
`cv_points`, one to three short points (Stichpunkte, not sentences) used on the CV instead of the longer text on the
about page, and each CV project has a line of its own, two lines at most. The admin says how many pages the PDFs
came out at, if it says 2, shorten something.

The PDFs: the button "Save, then make new PDFs" in the admin CV editor prints both pages from the live site into
var/cv (see DEPLOYMENT.md for the one time Chromium setup on the server). `npm run cv:pdf` does the same on your
computer from the files and saves them in content/cv to commit. The site serves whichever is newer.

## References

content/data/references.yml or the admin References form. Only people with `permission: true` and a quote show on
/references. Their email and phone only show with `contact_public: true`, otherwise it says available on request.
Never add anyone without asking them first.

## Media inbox

Drop files in media-inbox/ and run `npm run media:import`, see media-inbox/README.md. The intro video is set up
already in media-inbox/intro-video.yml, it points at the original in ~/Movies/Reece videos.

## Pictures and videos (the media library)

Upload on https://reece.page/admin/library, or straight from a picture block in the editor:

1. Pick the file, give it a title, and for pictures a description of what it shows (alt text, required).
2. It arrives unpublished. Tick Published and save, and it shows on /media.
3. Each item has an article code like `[[media:robot-arm-3f2a1c]]`. Put it on its own line in an article's
   Markdown and the picture or video appears there, with its caption and credit.
4. Videos can get captions (.srt or .vtt, these also become the transcript under the video) and a poster picture.
   Ticking Featured makes a video the one on the home page.

Big videos are easier from the command line: copy the file to the server and run
`npm run media:add -- file.mp4 --title "..." --captions file.srt --web --publish` (`--web` re-encodes it for
browsers with ffmpeg). Files live in `MEDIA_DIR`, not in git, so they need their own backup.

Only JPEG, PNG, WebP and AVIF pictures and MP4 and WebM videos are accepted, checked by their content, not the
file name. SVG and HTML are refused on purpose, a browser would run scripts inside them.

## The Atom feed

`/writing/feed.xml` lists the articles for feed readers (Feedly, NetNewsWire, Thunderbird and so on), so people can
follow new writing without social media. Nothing to set up, it updates itself when an article is added. It is not an
upload tool, uploads go through the media library above.

## Paperwork: letters and invoices

/admin/paperwork. The old Stationery and Contract Builders from the brand pack, moving into the admin one kind at
a time. Letters and invoices are here now, contracts and cards follow.

1. Once: fill in **My details** (business type, name, address, tax numbers) and **Payment accounts** (the IBAN is
   checked when you save). Both are private: never on GitHub, never on the site.
2. New letter or New invoice gives the next number for that kind and year (RP-L-2026-0001, RP-I-2026-0001).
   Numbers are never reused, not even from the trash.
3. Type in the form, the A4 page on the right follows. It saves on its own while you type, Ctrl or Cmd + S saves
   straight away. [Square brackets] are marked as still to fill in.
4. PDF prints the same page with Chromium on the server (same setup as the CV PDFs, see DEPLOYMENT.md), with the
   fine print and Page x of y on every page. Word gives a plain Word file to edit.
5. Mark as sent when it went out. Every save is kept, so a sent invoice can always be looked up as it was.

The business type decides what is printed: nothing extra for a private person, tax number or VAT ID on invoices for
a freelancer, register court, number and directors on every letter for a GmbH. If something required is missing the
editor says so. Your personal Steuer-IdNr. has no field anywhere on purpose. Invoices are worked out in whole cents,
VAT per rate over the net totals. A small business (§ 19 UStG) gets no VAT and the note that says why.

The code is in src/documents/ (one file per kind), the layout in styles/paperwork.scss.
