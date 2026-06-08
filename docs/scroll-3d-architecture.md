# Scroll-Based 3D Scene Architecture

## Overview

The home page is a **scroll-driven 3D scene**. As the visitor scrolls, a single
GLB head — quantized by an ASCII post-process — is flown through a sequence of
**sections** (hero → pause → biography → contact). Thin line/wireframe
"set-pieces" bloom around the head per section/milestone, and at the finale the
head turns to address the visitor.

The whole experience is driven by **one scroll signal**: a single GSAP
`ScrollTrigger` writes one number (`store.progress`, `0..1`), and everything else
— the camera, the ASCII parameters, the set-piece reveals, the hero text, the
head's gaze — derives from it. This is the result of the issue #4 refactor, which
removed the old hand-rolled `requestAnimationFrame` loop that used to live inside
a Pinia store.

> **Design constraint:** the entire scene passes through an ASCII post-process,
> so only **silhouettes, lines and points** read clearly — fine/solid geometry
> turns to mush. Every set-piece is therefore built from `LineSegments` / `Line`
> / `LineLoop` / `Points`, never solid meshes.

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
    │   onUpdate → store.setProgress(self.progress)
    ▼
store.progress   ← the single source of truth (Pinia ref, scroll-driven)
    │
    ├──► Scene3D @loop (TresJS useLoop):
    │       cameraAt(progress) → cam.position/rotation.set(...)   (imperative)
    │       head gaze: lerp(restingProfile → cursor, store.addressing)  (imperative)
    │       wireframe rotation applied imperatively to its group
    │
    ├──► SceneSetPieces: :reveal = revealFor(i) / subReveal(...) → each set-piece fades/scales
    │
    ├──► SceneControl.cellSize / fontSize (watch) → ASCII post-process uniforms
    │
    └──► AsciiTextAnimation: heroProgress → the name assembles char-by-char
```

Two key properties of this design (the issue #4 goals):

1. **No per-frame layout reads.** `window.innerHeight` / `document.scrollHeight`
   are read by `ScrollTrigger` only on refresh/resize, never every frame.
2. **No reactive props on the camera.** The camera (and the head/wireframe
   groups) are mutated **imperatively** inside the TresJS render loop, not patched
   through Vue reactivity.

---

## The section model: spine in code, content in markdown

A **section** is a content piece paired with a 3D scene state (a camera pose +
set-pieces). The scroll engine interpolates the camera between sections as you
scroll. There are two kinds of data here, and they live in two different places —
this split is deliberate:

### The scene spine → `components/home/sections/registry.ts` (typed TS)

The section **sequence + spine** (order, type, weight, camera pose, set-pieces,
accent, layout, and the dedicated component + layout mode) is config that *every*
section needs — not content. It is declared as a typed `SECTION_DEFS: SectionDef[]`
array. Each entry names its own component, so app-like sections (the hero, the
contact finale) are dedicated components, **not** driven by a markdown body.

```ts
{
  id: "contact",
  order: 70,
  type: "contact",
  component: markRaw(ContactSection),
  mode: "pinned",                                  // flow | pinned | bare
  weight: 1.5,                                     // scroll length AND camera segment width
  accent: "#00ff9c",
  setPiece: ["signalField"],
  setPieceVariant: "",
  layout: { align: "center" },
  camera: { position: v3(0, 0.04, 1.85), rotation: v3(-0.04, 0, 0) },
}
```

`composables/useSections.ts` sorts the defs by `order` and syncs their spine into
the sections store (the component is `markRaw`'d and kept out of the store — the
store holds *shared state only*, issue #4). The same `weight` drives **both** the
DOM section height (`SectionHost`) and the camera segment boundaries.

Layout `mode` controls how `SectionHost` renders the section's component:

| mode | layout | used by |
| --- | --- | --- |
| `bare` | just a height spacer; the component positions itself | hero (`AsciiTextAnimation` is `position:fixed`) |
| `pinned` | a sticky, centered card using `layout` align/offset/maxWidth | pause, contact |
| `flow` | the component fills the section height | biography cluster |

### Genuinely content-shaped data → `content/biography/*.md` (markdown)

The biographical **milestones** are the one place markdown earns its keep: many
short, content-shaped, prose entries (add a milestone = add a file). They are a
`@nuxt/content` collection (`content.config.ts`), loaded + normalized by
`composables/useSections.ts → useBiographyMilestones()`, and rendered as one
connected cluster by `BiographySection`. They have no camera spine of their own —
that belongs to the biography *section* in the registry.

> The hero's visible name is JS-injected into a fixed overlay (not crawlable), so
> `HeroSection` also renders the identity H1 + intro as real `sr-only` HTML for
> screen readers and crawlers (SSG-ready, #5). The contact finale's prose + CTAs
> are likewise real, crawlable DOM.

---

## Components

| File | Role |
| --- | --- |
| `pages/index.vue` | Orchestrator. Boot screen + `<HomeScene3D>` are client-only (`<ClientOnly>`) for SSG-compatibility; dev (`import.meta.dev`) skips the boot screen. |
| `components/home/Scene3D.vue` | The `<TresCanvas>`. Loads the head (DRACO GLB), drives the camera/head/wireframe imperatively in `@loop`, renders the ASCII effect and `<SceneSetPieces>`. Owns the **head addressing** beat (turns to face + follow the cursor at the finale). |
| `components/home/ScrollableContent.vue` | Owns the scroll → progress lifecycle (`useScrollTimeline`); renders every section via `<SectionHost>`. |
| `components/home/SectionHost.vue` | Renders one section's dedicated component in its layout `mode` (flow/pinned/bare); provides scroll length + alignment. |
| `components/home/sections/registry.ts` | `SECTION_DEFS` — the typed section sequence + scene spine. |
| `components/home/sections/*.vue` | The section components: `HeroSection` (ASCII identity), `InterludeSection` (camera-only beat), `BiographySection` (+ `BiographyCard`), `ContactSection` (the terminal finale). |
| `components/home/SceneSetPieces.vue` | Maps each section's + each milestone's `setPiece[]` to its 3D component, passing `:reveal`, `:variant`, `:position`. Owns the selective-render overlay (see below). |
| `components/home/setpieces/*.vue` | The line set-pieces: `Lattice` (GAN→embeddings→RAG), `BerlinSkyline`, `RouteArc`, `ThreadBoard`, `DocumentGrid`, `StaffLines`, `SignalField` (the finale broadcast). |
| `components/home/AsciiTextAnimation.vue` | The hero: the name assembles character-by-character across the hero section's scroll range. |

### Selective-render overlay (issue #17)

The ASCII `EffectComposer` quantizes the **whole** rendered scene, so thin lines
rendered the normal way get mangled into the character grid. Set-pieces instead
live on dedicated three.js **layers** the composer's RenderPass (camera on layer
0) never sees; then, in the same render loop (`onRender`, right after the
composer), they're re-drawn crisp on top:

1. on-top backdrops (skyline, signal rings, …) draw over the ASCII'd head;
2. the head is stamped into the depth buffer (depth only);
3. depth-occluded pieces (the lattice cloud) draw depth-tested against it, so the
   head occludes the back half and the face sits *inside* the graph.

No second rAF, no per-frame layout reads, nothing allocated per frame (issue #4).

### Set-piece contract

Every set-piece follows the same shape (see `Lattice.vue` / `SignalField.vue`):

- props `{ reveal?: number; variant?: string; position?: [number,number,number] }`
- geometry built once (seeded PRNG where random; deterministic otherwise)
- only line/point primitives; additive, `transparent`, `depthWrite:false`, `opacity:0`
- a `useLoop().onBeforeRender` that gates on `reveal` (visibility/scale/opacity)
  and adds ambient motion via `delta`/`elapsed`
- `onBeforeUnmount` disposes every geometry and material it created

---

## State & composables

| File | Responsibility |
| --- | --- |
| `stores/sections.ts` | **Shared state only** (issue #4): `progress`, the `sections` spine, and the derived getters — `boundaries`, `anchors`, `activeIndex`, `localProgress`, `heroProgress`, `cameraAt`, `revealFor`, `subReveal`, `asciiCellSize/FontSize`, and `addressing` (how strongly the head faces the visitor). Owns **no** rAF loop. Contains the single keyframe interpolator reused for camera + reveal. |
| `composables/useSections.ts` | Sources the section sequence from `registry.ts` into the store (`useSections`); loads + normalizes the `content/biography` collection (`useBiographyMilestones`). |
| `composables/useScrollTimeline.ts` | Owns the Lenis singleton (driven by `gsap.ticker`), the single `ScrollTrigger`, and their teardown. |
| `stores/SceneControl.ts` | Scene/ASCII config (cell size, font size, lights, control mode). Edited in dev via the **Dev Panel** (`components/home/DevPanel.vue`); see [tuning.md](./tuning.md). |
| `stores/BootState.ts` | Boot sequence phases. |
| `composables/usePreferences.ts` | Visitor preferences (reduced-motion, skip boot intro), set on `/setup`, persisted to `localStorage`. Theme is owned by `useColorMode`. |

---

## How to…

### …add or reorder a section

Edit `components/home/sections/registry.ts`: add a `SectionDef` (pick an `order`
between two existing ones; choose `cameraPosition`/`cameraRotation` to continue
the arc; set `weight`, `setPiece`, `mode`, and the `component`). The camera path,
scroll length, set-pieces and rendering all derive from it.

### …add a biography milestone

Create `content/biography/NN-slug.md` with the frontmatter (title, subtitle,
order, location, side, setPiece). It joins the biography cluster automatically.

### …add a set-piece

1. Create `components/home/setpieces/MyPiece.vue` following the contract above.
2. Register it in `SceneSetPieces.vue`'s `SET_PIECES` map and add its key to the
   `SetPieceName` union in `types/section.ts` (+ the zod enum in
   `content.config.ts` if a biography milestone will reference it).
3. Reference it from a section's `setPiece` (registry) or a milestone's frontmatter.

### …tune the camera path

Edit the `camera` pose in the section's registry entry. The camera interpolates
(eased) between each section's pose; poses are anchored at the **center** of each
section's scroll range.

---

## The finale (contact)

The last section is the payoff — a transmission from the visitor to the head:

- **The head turns to address you.** Through the whole journey the head holds a
  resting profile (gazing into its own data). As the contact beat centers,
  `store.addressing` ramps `0 → 1` and `Scene3D` blends the head's gaze from that
  profile toward the terminal card, with a gentle cursor parallax on top.
  Reduced-motion drops the parallax but still turns. The angles
  (`restingYaw`/`addressYaw`/…) are live-tunable (see [tuning.md](./tuning.md)).
- **An interactive terminal.** `ContactSection` is a CLI/terminal card that types
  itself in (CSS-only, reduced-motion aware, with an ambient inner-glow breathe).
  Beyond the static, crawlable session + GitHub/Respeak `<a>` CTAs, it's a **real
  shell**: `help`, `ls`, `cat`, `open`, command history (↑/↓), and easter eggs
  (`sudo …`, `vim`, `matrix`, …).
- **The signal streams in.** `SignalField` is a transmission, not a broadcast:
  ripples are born at the terminal and stream up a link line, shrinking, until
  they converge into the head's forehead. Both ends are **anchored to real
  things, not fixed world coords**:
  - the **forehead** is a head-local offset transformed by the head's live world
    matrix each frame, so it rotates and floats *with* the head (the head group is
    tagged `name="headGroup"` so the set-piece can find it);
  - the **emitter** is the terminal card's on-screen rect (published by
    `ContactSection` via `useElementBounding` → `store.contactAnchor` as NDC) ray-
    cast through the camera onto a plane, so it tracks the card across
    viewport/scroll.
- **CLI ↔ scene.** Every typed command bumps `store.pulseSeq`; `SignalField`
  edge-detects it and fires a bright, fast ripple along the same path, while the
  terminal flashes its glow — so the CLI visibly *sends* the signal the head
  receives.

The finale's positions are art-directed, so the values above are wired through the
dev tuning layer — see **[tuning.md](./tuning.md)**.

---

## Notes / known limitations

- **SSR is off** (`ssr: false`). The section/milestone prose is authored as real
  DOM, so it is **SSG-ready**, but only prerenders to indexable HTML once SSR/SSG
  is enabled (issue #5). Until then the 3D canvas is `<ClientOnly>` so it never
  runs during prerender.
- Camera anchors are derived from section **weights**, while the DOM cards sit at
  pixel positions; because progress is a fraction of *max scroll* (document minus
  one viewport) the two align closely but not exactly — good enough that the
  camera "settles" as each card centers.
- In dev, the TresJS devtools performance panel logs a one-off
  `Cannot read properties of undefined (reading 'count')` while traversing the
  non-indexed line geometries. It is a devtools-only path (disabled in
  `nuxt generate`) and does not affect rendering.
