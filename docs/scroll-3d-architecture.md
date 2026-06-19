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
    ├──► ScrollSpotlights @onBeforeRender: sample each spotlight's keyframe track at
    │       progress → position/aim/intensity/colour/cone written onto real SpotLights
    │       (imperative); aim anchored to the head's live matrix; effects from `elapsed`
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
| `components/home/ScrollSpotlights.vue` | The scroll-driven **spotlight rig**: keyframed `THREE.SpotLight`s that light the ASCII'd head, driven imperatively in `onBeforeRender`. Dark through the hero, then "tada" on at the interlude, then follow the scroll. See [Scroll-driven spotlights](#scroll-driven-spotlights). |
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

## Scroll-driven spotlights

The head used to be lit only by a constant directional + ambient + a handful of
dim coloured point lights, so it read dark and flat. The **spotlight rig** now
owns face lighting; the legacy coloured lights (`HomeLights`, driven by
`SceneControl.enableColoredLights`) therefore **default off** so the head is
genuinely dark through the hero and the rig's reveal reads — flip them back on in
the dev panel's Lights section for the multicolour atmosphere. The rig shares the
camera's keyframe model: a spotlight is a **track of keyframes, each anchored to a
section** (by id) at a local position `t` (0..1) — and, for the biography section,
optionally to a specific `milestone` (card). The absolute scroll position is
*derived* from the live section layout (`useSectionsStore().resolveAt`), so
inserting / reordering / reweighting sections — or adding biography cards — keeps
every beat on its mark (the "tada" stays mid-interlude, the sweep stays on its
cards, the finale stays at the finale). This is the same reason the camera never
breaks on a section insert; the lights and the **camera** (which can now hold
several `cameraKeyframes` per section) ride the exact same anchor model.

```
SPOTLIGHT_TRACKS (spotlights.ts)              ScrollSpotlights.vue @onBeforeRender
  key:  [ {identity,t0 …off}, {pause,t.45 …on,flicker}, {biography,milestone2 …}, … ]
  fill: [ … ]                  ──────►   resolveAt(section,t,milestone) → absolute %
  rim:  [ … ]                            → sort → bracket by store.progress → ease →
                                         lerp pose → head-anchored aim → effect →
                                         write onto a real THREE.SpotLight
```

- **The spine lives in `components/home/sections/spotlights.ts`** (`SPOTLIGHT_TRACKS`)
  — typed art-direction, exactly like the camera poses in `registry.ts`. It seeds
  the editable `useSpotlightsStore` (the live source the rig + dev panel share).
  Each `SpotKeyframe` carries its **anchor** (`section` + local `t`, optional
  `milestone`), `position` (world), `target` (head-LOCAL by default, so the cone
  tracks the floating/turning head and keeps lighting the face — or
  `targetAnchor:"world"`), `intensity`, `color`, `angle`/`penumbra`/`distance`, and
  an optional time-based `effect`. The store resolves each anchor to an absolute
  scroll % on read; the rig re-caches when the section layout / card count changes.
- **`ScrollSpotlights.vue` is a set-piece-shaped component** (mirrors `SignalField`):
  it builds one `THREE.SpotLight` (+ aim target + dev marker) per track *once*, then
  in `useLoop().onBeforeRender` interpolates each track by `store.progress`, resolves
  head-anchored aim against `getObjectByName("headGroup").matrixWorld`, layers the
  active keyframe's effect, and writes the result straight onto the light —
  imperatively, allocating nothing per frame (issue #4). It reads the keyframes
  from `useSpotlightsStore` and rebuilds its pre-parsed runtime cache (Vector3/
  Color) only when the store changes (dev edits) — never per frame; the `SpotLight`
  objects are pooled and reused, never recreated on a value edit. The lights sit on
  the default **layer 0**, so they light the head/backdrop the ASCII composer
  renders (a brighter face resolves more characters out of the dark); the
  selective-render overlay (layers 1/2/3) is untouched. Everything is disposed on
  unmount.
- **Visible beam cones (optional).** With `showCones` on, each spot also draws a
  volumetric **beam**: an additive cone mesh, apex at the source, sized by the real
  cone angle, oriented down the aim each frame, vertex-coloured bright→faded so it
  glows from the source and dissolves toward the face. It's depth-tested (the head
  occludes the beam behind it) and ASCII'd like everything on layer 0, so it reads
  as a coherent shaft. Off by default; `coneOpacity` controls it.
- **The beats.** Spots stay dark through the hero (the head still emerges via the
  ASCII cell-size ramp alone), then snap on at the **interlude** with a brief flicker
  — the "tada, that's me" — settle on the face, swing across the biography cards
  (picking up the chapter accent), and resolve onto the face at the finale.
- **Effects** are time-based modulations layered on the interpolated pose, evaluated
  from the render clock so they animate on their own: `flicker` (bulb kicking on),
  `pulse`/`breathe` (intensity swell), `sweep` (cone scans side-to-side), `orbit`
  (circles the head), `colorCycle` (hue drift), `strobe`. The *nearest* keyframe's
  effect is the active one, so different beats carry different motion. All effect
  motion is dropped under `prefers-reduced-motion`; the scroll-driven base pose stays.
- **Tuning lives in two places, by what it controls.** The **global tab →
  Spotlights** section holds only what isn't per-scene: `enabled`, `master`,
  `showCones` + `coneOpacity`, `showHelpers`, `baseFill`/`baseAmbient`, **+ add /
  remove track** and **copy JSON** (export all tracks to paste into
  `spotlights.ts`). The per-keyframe editing is in the **scenes tab, under each
  scene** (`SceneKeyframes`) — keyframes are section-anchored, so they belong with
  their scene: each scene shows its **camera** keyframes and its **spotlight**
  keyframes (grouped by track), with full controls (anchor `t` + biography-card
  dropdown; position, aim, intensity, colour, cone, effect), **add/remove**, and a
  **view** button that parks the scroll at that keyframe so you tune it live. Edits
  aren't persisted (like the colored-lights tab) — export to code to ship.

---

## Head keyframes

The head rides the **same anchored-keyframe model** as the camera: a per-section
track of poses (`position` offset + `rotation`), interpolated by scroll
(`store.headAt`), editable per-scene in the dev panel (scenes tab → **Head**).
Position offsets `headGroup` so the head can physically **fly** between scenes (its
SignalField forehead, depth-occluder layer, and addressing all ride along, since
they read `headGroup`'s live matrix). Rotation is the head's resting aim.

`Scene3D` composes it with the finale beat: each frame it sets the head position
from `headAt`, then blends the keyframed **rotation** toward the contact
`addressYaw`/`addressPitch` as `store.addressing` ramps `0 → 1` (plus cursor
parallax). So the keyframes own the resting/travel pose and the finale still turns
the head to the terminal. The default keyframe (no translation, resting yaw
`-0.44`) reproduces the original look until you tune a scene. Internally `headAt`
shares the camera's `buildPoseTrack`/`samplePose` (separate scratch poses, so the
two never clobber and neither allocates per frame).

---

## State & composables

| File | Responsibility |
| --- | --- |
| `stores/sections.ts` | **Shared state only** (issue #4): `progress`, the `sections` spine, `milestoneCount`, the editable per-section `cameraKeyframes` + `headKeyframes` maps (seeded from the registry; `cameraAt`/`headAt` read them, so scenes-tab edits move camera/head live), and the derived getters — `boundaries`, `anchors`, `activeIndex`, `localProgress`, `heroProgress`, `cameraAt`, `headAt`, `revealFor`, `subReveal`, `asciiCellSize/FontSize`, `addressing`. Owns **no** rAF loop. Hosts the shared **anchor resolver** `resolveAt` / `anchorAt` + the biography `bioFrac`/`bioAnchorFromFrac`/`localFracAt` position transforms, plus the keyframe interpolator (`buildPoseTrack`/`samplePose`) shared by camera + head. |
| `composables/useSections.ts` | Sources the section sequence from `registry.ts` into the store (`useSections`); loads + normalizes the `content/biography` collection (`useBiographyMilestones`). |
| `composables/useScrollTimeline.ts` | Owns the Lenis singleton (driven by `gsap.ticker`), the single `ScrollTrigger`, and their teardown. |
| `stores/SceneControl.ts` | Scene/ASCII config (cell size, font size, lights, control mode). Edited in dev via the **Dev Panel** (`components/home/DevPanel.vue`); see [tuning.md](./tuning.md). |
| `stores/spotlights.ts` | The live, editable spotlight rig: global knobs + the keyframe `tracks` (seeded from `SPOTLIGHT_TRACKS`). Read by `ScrollSpotlights` + Scene3D's base lights, edited by the dev panel's Spotlights section. See [Scroll-driven spotlights](#scroll-driven-spotlights). |
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

Live: dev panel **scenes** tab → open the scene → **Camera** → edit its keyframe(s),
`+ camera keyframe @ NN%` to add one anchored at the current scroll, **view** to
preview, and **grab current orbit pose** (switch to Orbit first, frame the shot,
grab). A scene with one keyframe behaves exactly like a single `camera` pose held
at its centre; add more to pan the camera **through several poses** as you scroll
the scene. **copy** exports that scene's `cameraKeyframes` to paste into its
registry entry. In the **biography** scene the anchor is a single "position in
section" slider — the card it lands on is shown read-only and matched
automatically (it still rides that card if cards change). The camera interpolates
(eased) between all keyframes by resolved scroll position, so the path re-times
automatically when sections change.

### …move the head per scene

Live: dev panel **scenes** tab → open the scene → **Head** → edit its keyframe(s):
`position` offsets the head (fly it across), `rotation` is its resting aim, with the
same anchor controls (and biography position slider) as the camera. **view** to
preview, `+ head keyframe`, ✕ to remove, **copy** to export `headKeyframes` for
`registry.ts`. The finale still turns the head to the terminal on top of this. See
[Head keyframes](#head-keyframes).

### …light a scroll location (spotlights)

Live: dev panel **scenes** tab → open the scene → **Spotlights** → each track shows
its keyframes for that scene; edit anchor (position-in-section slider; biography
auto-matches the card) / position / aim / intensity / colour / effect, **view** to
preview, `+ <track> @ NN%` to add one anchored here, ✕ to remove. Global knobs
(master, beam cones, base fill) and add/remove track are in the **global** tab →
Spotlights. When happy, **copy JSON** (global tab) and paste into `SPOTLIGHT_TRACKS`
in `components/home/sections/spotlights.ts` to ship (edits don't persist across
reloads). Because keyframes are section-anchored, inserting a new section won't
break your beats. To flare a light on at a beat, put an `intensity: 0` keyframe
just before the lit one. See [Scroll-driven spotlights](#scroll-driven-spotlights).

---

## The finale (contact)

The last section is the payoff — a transmission from the visitor to the head:

- **The head turns to address you.** Through the whole journey the head holds the
  base pose from its **head keyframe track** (see [Head keyframes](#head-keyframes))
  — by default a resting profile gazing into its own data. As the contact beat
  centers, `store.addressing` ramps `0 → 1` and `Scene3D` blends the head's rotation
  from that keyframed pose toward the terminal card, with a gentle cursor parallax
  on top. Reduced-motion drops the parallax but still turns. The finale-overlay
  angles (`addressYaw`/`addressPitch`/cursor ranges) are live-tunable (see
  [tuning.md](./tuning.md)); the resting pose itself is now a head keyframe.
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
