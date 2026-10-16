# Design system

The site is built on the dove brand pack (v1.3). Every value lives as a CSS custom property in
`styles/abstracts/_tokens.scss`, the dark theme only swaps values, and components never use raw colours.

## The idea

One tree, three branches: code, earth and faith. Every project grows from a branch and carries its colour as a
small square, the leaf. Leaves are square because it's a computer science tree, so squares show up everywhere:
bullets, branch marks, the busy dots on buttons, the corners of focus rings. Radii stay at 2 or 4 pixels.

## Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-bg` | Cream #f9f4e8 | Night #1e261a | Page |
| `--color-text` | Olive #33412a (9.9:1) | Cream (14.2:1) | Text |
| `--color-text-muted` | #5a6652 (5.5:1) | #b9c7ae (8.8:1) | Secondary text |
| `--color-accent` | Olive | Sage #9fb98f | Primary buttons |
| `--color-highlight` | Blush #efb9a4 | Blush | Link underlines, focus halo |
| `--branch-code` / `-earth` / `-faith` | #4a7f93 / #5e8a4e / #b8735c | lighter versions | Marks only, never text |

Contrast ratios are measured against the page background, the comments in the token file have the details. Branch
colours are only used for marks next to a text label, which carries the meaning (WCAG 1.4.1 and 1.4.11).

## Type

- **Young Serif** for headings. It has one weight, so headings never ask for bold.
- **Nunito Sans** (variable, 400 to 800) for everything else.
- Both are self hosted woff2, subset to Latin. Fallback faces with measured `size-adjust` keep the layout from
  jumping while the fonts load.
- Fluid scale from `--step--1` to `--step-5`, body line height 1.62, text measure 64 characters.

## Space and layout

4px base, `--space-1` (0.25rem) to `--space-9` (7rem). Page width 78rem, text width 44rem. Sections breathe with
`--section-space`. Lists are rows with hairlines, not cards.

## Motion

Two easings (`--ease-out`, `--ease-in-out`) and four durations (140, 260, 480, 820ms). With reduced motion every
duration becomes 0 and the tree draws one still frame.

| Moment | What happens |
| --- | --- |
| Home page load | The camera starts close on the top of the tree while it grows, then pulls back to show all of it |
| Scrolling the grove | The camera walks round the tree |
| Pointing at a branch in the text | That branch lights up, the others fade |
| Big headings | Words rise from behind a matte one after the other |
| Opening a project | The title you clicked stays in place and becomes the next page's title (view transitions) |
| About page timeline | The branch line grows as you scroll |
| Hover on buttons | The leaf turns |

## Things the site avoids on purpose

Purple gradients, pill buttons, Inter, glow, glass panels, gradient text, bento grids, thin outline icons, three
equal cards, numbered eyebrows. The icons are solid 20 by 20 shapes drawn for this site
(`src/helpers/icons.js`), no icon font and no brand logos.
