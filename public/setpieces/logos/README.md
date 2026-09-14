# Stack logos

Official brand marks, used as **line art** in the `skills` chapter's 3D
backdrop (`components/home/setpieces/StackFlight.vue`, via three's `SVGLoader`).

- **Source:** [Simple Icons](https://simpleicons.org), vendored from
  `cdn.jsdelivr.net/npm/simple-icons/icons/<slug>.svg`. Copied in rather than
  fetched at runtime so the page has no external dependency and the files can
  be served from our own origin.
- **Simple Icons licence:** CC0-1.0.
- **The marks themselves remain the trademarks of their respective owners.**
  They appear here only to identify the tools actually used — nominative use on
  a personal portfolio. No affiliation or endorsement is implied.

Each file is a single-path 24×24 glyph. `StackFlight` resolves it with
`SVGLoader.createShapes` (which gives proper shapes **with their holes**),
EXTRUDES it into a solid, and draws the result as edges — so the mark has real
depth as it flies, while still reading as line art like the rest of the scene.

They are used **twice**, in deliberately different registers, so the two read as
the same mark rather than a duplicate:

- large **extruded solids**, drawn in as they launch, flying past the head in 3D
  (`StackFlight`);
- small, solid **glyphs** inside the DOM chips (`SkillsSection`), masked with
  `currentColor` so they inherit the chip's tint — including the warm-up as the
  card catches the beam — without a second rule.

To add one: drop `<slug>.svg` in here and set `logo: "<slug>"` on the matching
chip in `components/home/sections/skills.ts`. The backdrop's list is *derived*
from the chips (`clusterLogos`), so the two can't drift apart.
