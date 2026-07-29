# Stack logos

Official brand marks, used as **line art** in the `skills` chapter's 3D
backdrop (`components/home/setpieces/StackLogos.vue`, via three's `SVGLoader`).

- **Source:** [Simple Icons](https://simpleicons.org), vendored from
  `cdn.jsdelivr.net/npm/simple-icons/icons/<slug>.svg`. Copied in rather than
  fetched at runtime so the page has no external dependency and the files can
  be served from our own origin.
- **Simple Icons licence:** CC0-1.0.
- **The marks themselves remain the trademarks of their respective owners.**
  They appear here only to identify the tools actually used — nominative use on
  a personal portfolio. No affiliation or endorsement is implied.

Each file is a single-path 24×24 glyph. `StackLogos` strokes the path outline
rather than filling it, because the ASCII post-process only resolves lines (see
`docs/scroll-3d-architecture.md` → set-piece contract).

They are used **twice**, in deliberately different registers, so the two read as
the same mark rather than a duplicate:

- large, drawn-in **line art** in the 3D backdrop (`StackLogos`);
- small, solid **glyphs** inside the DOM chips (`SkillsSection`), masked with
  `currentColor` so they inherit the chip's tint — including the warm-up as the
  card catches the beam — without a second rule.

To add one: drop `<slug>.svg` in here and set `logo: "<slug>"` on the matching
chip in `components/home/sections/skills.ts`. The backdrop's list is *derived*
from the chips (`clusterLogos`), so the two can't drift apart.
