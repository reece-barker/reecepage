# Content

Everything a visitor reads lives in `content/`. Restart the server after changes in production (development picks
them up on refresh). Run `npm run content:check` after editing, it catches broken front matter, em dashes and
links to pages that don't exist.

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
text as a guess. The startup stays unnamed until it has a public name. No gaming wording on anything an employer
reads.

## The admin, editing without touching files

Run `npm run dev` and open http://localhost:3000/admin. On your computer the login is user `reece`, password
`reece-dev` (set `ADMIN_DEV_PASSWORD` in .env to change it). On the server it uses `ADMIN_PASSWORD_HASH`, make one with
`npm run admin:password`.

- **Link board**: every address the site answers and what its for, live status, links to Hetzner, Cloudflare, GlitchTip
- **Projects and Writing**: list, new, edit, delete. The editor has a preview and a menu to drop media codes in
- **Timeline** (experience and education), **Right now**, **Skills**, **References**, **CV**, **Branches**: forms for
  each data file, saving writes the yml in content/data so it still goes in git like before
- **Media**: upload, describe, publish, feature

Editing is on by default on your computer and off in production (`CONTENT_EDITING=true` switches it on there, but the
better way is edit locally, commit, deploy).

## The CV

/cv is built from cv.yml, the timeline (entries with `cv: false` are left off), skills and the projects listed in
cv.yml. Its one A4 page, keep it that way. After changes run `npm run cv:pdf` (or the button in the admin CV editor)
to make content/cv/reece-barker-cv.pdf, the download on the site.

## References

content/data/references.yml or the admin References form. Only people with `permission: true` and a quote show on
/references. Their email and phone only show with `contact_public: true`, otherwise it says available on request.
Never add anyone without asking them first.

## Media inbox

Drop files in media-inbox/ and run `npm run media:import`, see media-inbox/README.md. The intro video is set up
already in media-inbox/intro-video.yml, it points at the original in ~/Movies/Reece videos.

## Pictures and videos (the media library)

Upload on https://reece.page/admin/media (log in with `ADMIN_USER` and the password behind `ADMIN_PASSWORD_HASH`):

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
