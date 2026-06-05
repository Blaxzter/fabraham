# Scroll-Based 3D Timeline Architecture

## Overview

The home page is a **data-driven 3D biographical timeline**. As the visitor
scrolls, a single GLB head — quantized by an ASCII post-process — is flown
through a sequence of chapters (Berlin → Maastricht → Berlin), each accompanied
by thin line/wireframe "set-pieces" and a prose card authored in markdown.

The whole experience is driven by **one scroll signal**: a single GSAP
`ScrollTrigger` writes one number (`timeline.progress`, `0..1`), and everything
else — the camera, the ASCII parameters, the set-piece reveals, the hero text —
derives from it. This is the result of the issue #4 refactor, which removed the
old hand-rolled `requestAnimationFrame` loop that used to live inside a Pinia
store.

> **Design constraint:** the entire scene passes through an ASCII post-process,
> so only **silhouettes, lines and points** read clearly — fine/solid geometry
> turns to mush. Every set-piece is therefore built from `LineSegments` / `Line`
> / `Points`, never solid meshes.

---

## Data flow

```
User scrolls
    │
    ▼
Lenis (smooth scroll, driven by gsap.ticker — no standalone rAF)
    │   lenis.on('scroll', ScrollTrigger.update)
    ▼
GSAP ScrollTrigger (start:0, end:'max')
    │   onUpdate → timeline.setProgress(self.progress)
    ▼
timeline.progress   ← the single source of truth (Pinia ref, scroll-driven)
    │
    ├──► Scene3D @loop (TresJS useLoop):
    │       cameraAt(progress) → cam.position.set(...) / cam.rotation.set(...)   (imperative)
    │       head + wireframe rotation applied imperatively to their groups
    │
    ├──► SceneSetPieces: :reveal = revealFor(chapterIndex) → each set-piece fades/scales
    │
    ├──► SceneControl.cellSize / fontSize (watch) → ASCII post-process uniforms
    │
    └──► AsciiTextAnimation: heroProgress → the name assembles char-by-char
```

Two key properties of this design (the issue #4 goals):

1. **No per-frame layout reads.** `window.innerHeight` /
   `document.scrollHeight` are read by `ScrollTrigger` only on refresh/resize,
   never every frame.
2. **No reactive props on the camera.** The camera (and the head/wireframe
   groups) are mutated **imperatively** inside the TresJS render loop, not
   patched through Vue reactivity.

---

## The data-driven chapter model

Chapters live in `content/timeline/*.md` (a `@nuxt/content` collection defined
in `content.config.ts`). Adding a milestone = adding a markdown file.

```yaml
---
title: "Maastricht University — M.Sc. Artificial Intelligence"
subtitle: "2020–2022 · the bet on generative AI"
order: 30                       # sort key (filenames use gapped prefixes: 10, 20, 30…)
location: "Maastricht"
weight: 1                       # relative scroll length AND camera segment width
setPiece: ["lattice"]           # line set-pieces stacked on this chapter (may be several)
setPieceVariant: "gan"          # variant for the lattice motif: gan → embeddings → rag
accent: "#c4a0ff"               # chapter card accent colour
cameraPosition: [-0.55, 0.06, 1.0]   # camera pose the camera settles into here
cameraRotation: [-0.06, -0.3, -0.01]
---

## Maastricht University — M.Sc. Artificial Intelligence

…markdown body (rendered as the chapter card prose; SSG-ready for SEO, #5)…
```

`composables/useTimelineChapters.ts` loads the collection (`useAsyncData`,
deduped) and normalizes it into `TimelineChapter[]` (see `types/timeline.ts`),
syncing it into the timeline store. The same `weight` value drives **both** the
DOM section height (`<Chapter>`) and the camera segment boundaries — one source
of truth.

Chapter 0 (`00-identity.md`) is special: it is rendered as the ASCII hero
(`AsciiTextAnimation`) plus a visually-hidden `<ContentRenderer>` (so its H1 +
intro stay live for SEO and screen readers).

---

## Components

| File | Role |
| --- | --- |
| `pages/index.vue` | Orchestrator. Boot screen + `<HomeScene3D>` are client-only (`<ClientOnly>`) for SSG-compatibility; dev (`import.meta.dev`) skips the boot screen. |
| `components/home/Scene3D.vue` | The `<TresCanvas>`. Loads the head (DRACO GLB), drives the camera/head/wireframe imperatively in `@loop`, renders the ASCII effect and `<SceneSetPieces>`. |
| `components/home/ScrollableContent.vue` | Owns the scroll → progress lifecycle (`useScrollTimeline`), renders the hero + a `<Chapter>` per chapter. |
| `components/home/Chapter.vue` | One chapter's prose card (`<ContentRenderer>`), centered/sticky, fading in via `useElementVisibility`. Height = `weight × 100vh`. |
| `components/home/SceneSetPieces.vue` | Maps each chapter's `setPiece[]` to its 3D component, passing `:reveal`, `:variant`, and a deterministic `:position` offset so stacked pieces don't collide. |
| `components/home/setpieces/*.vue` | The line set-pieces: `Lattice` (the recurring GAN→embeddings→RAG motif), `BerlinSkyline`, `RouteArc`, `ThreadBoard`, `DocumentGrid`, `StaffLines`. |
| `components/home/AsciiTextAnimation.vue` | The hero: the name assembles character-by-character across the first chapter's scroll range. |

### Set-piece contract

Every set-piece follows the same shape (see `Lattice.vue` as the reference):

- props `{ reveal?: number; variant?: string; position?: [number,number,number] }`
- geometry built once with a **seeded** PRNG (deterministic, stable across reloads)
- only line/point primitives; additive, `transparent`, `depthWrite:false`, `opacity:0`
- a `useLoop().onBeforeRender` that gates on `reveal` (visibility/scale/opacity)
  and adds ambient motion via `delta`/`elapsed`
- `onBeforeUnmount` disposes every geometry and material it created

---

## State & composables

| File | Responsibility |
| --- | --- |
| `stores/timeline.ts` | **Shared state only** (issue #4): `progress`, the `chapters` config, and the derived getters — `boundaries`, `anchors`, `activeIndex`, `localProgress`, `heroProgress`, `cameraAt`, `revealFor`, `asciiCellSize/FontSize`. Owns **no** rAF loop. Contains the single keyframe interpolator reused for camera + ASCII + reveal. |
| `composables/useScrollTimeline.ts` | Owns the Lenis singleton (driven by `gsap.ticker`), the single `ScrollTrigger`, and their teardown (`ctx.revert()` + `lenis.destroy()` + ticker cleanup + `lagSmoothing` restore). Refreshes the trigger when chapter count changes. |
| `composables/useTimelineChapters.ts` | Loads + normalizes the `content/timeline` collection into the store. |
| `stores/SceneControl.ts` | Scene/ASCII config (cell size, font size, lights, control mode). |
| `stores/BootState.ts` | Boot sequence phases. |

---

## How to…

### …add a chapter

Create `content/timeline/NN-slug.md` with the frontmatter above (pick an `order`
between two existing ones; choose `cameraPosition`/`cameraRotation` to continue
the arc; set `setPiece`/`setPieceVariant`). That's it — the camera path, scroll
length, set-pieces and prose all update from the file.

### …add a set-piece

1. Create `components/home/setpieces/MyPiece.vue` following the set-piece
   contract above.
2. Register it in `SceneSetPieces.vue`'s `SET_PIECES` map and add its key to the
   `SetPieceName` union in `types/timeline.ts` + the zod enum in
   `content.config.ts`.
3. Reference it from any chapter's `setPiece` array.

### …tune the camera path

Edit the `cameraPosition` / `cameraRotation` in the chapter frontmatter. The
camera interpolates (eased) between each chapter's pose as you scroll; poses are
anchored at the **center** of each chapter's scroll range.

---

## Notes / known limitations

- **SSR is off** (`ssr: false`). The chapter prose is authored as real markdown
  and rendered with `<ContentRenderer>`, so it is **SSG-ready**, but it will only
  prerender to indexable HTML once SSR/SSG is enabled (issue #5). Until then the
  3D canvas is wrapped in `<ClientOnly>` so it never runs during prerender.
- Camera anchors are derived from chapter **weights**, while the DOM cards sit at
  pixel positions; because progress is a fraction of *max scroll* (document minus
  one viewport) the two align closely but not exactly. Good enough that the
  camera "settles" as each card centers.
- In dev, the TresJS devtools performance panel logs a one-off
  `Cannot read properties of undefined (reading 'count')` while traversing the
  non-indexed line geometries. It is a devtools-only path (disabled in
  `nuxt generate`) and does not affect rendering.
