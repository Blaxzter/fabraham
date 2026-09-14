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

> **Design constraint:** the head and backdrop pass through an ASCII
> post-process, so only **silhouettes, lines and points** read clearly there —
> fine or solid geometry turns to mush. Set-pieces are therefore built from
> `LineSegments` / `Line` / `LineLoop` / `Points`.
>
> Strictly, set-pieces are drawn in the [selective-render
> overlay](#selective-render-overlay-issue-17) and never reach the ASCII pass, so
> shaded solids *would* render. Keeping them line-only is a **style** decision —
> the scene reads as one drawing. The one sanctioned mesh is a `colorWrite: false`
> body used purely as a depth occluder (`StackFlight`, and the head itself in
> `SceneSetPieces`); it paints nothing.

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
| `components/home/SceneSetPieces.vue` | Maps each section's + each milestone's `setPiece[]` to its 3D component, passing `:reveal`, `:variant`, `:position` — plus `:cardProgress` for pieces that opt in. Owns the selective-render overlay (see below). |
| `components/home/setpieces/*.vue` | The line set-pieces: `Lattice` (a latent space being queried; GAN→embeddings→RAG), `BerlinSkyline` (an extruded city), `RouteArc` (Berlin→Maastricht flown across a real map), `ThreadBoard` (a detective's pinboard), `DocumentGrid` (retrieval composing a cited answer), `StaffLines` (a page of the hymnal, playing), `StackFlight` (the stack flying past the head), `SignalField` (the finale broadcast). |
| `scripts/make-germany-svg.py` | Cuts `public/setpieces/germany.svg` from Natural Earth. Run by hand, output committed — see [the map](#the-map-berlin-to-maastricht-routearc). |
| `components/home/setpieces/lineArt.ts` | The shared vocabulary every backdrop is built from: deterministic layout, the draw-on, line fields, and the dot shader. See "The line-art vocabulary" below. |
| `components/home/ScrollSpotlights.vue` | The scroll-driven **spotlight rig**: keyframed `THREE.SpotLight`s that light the ASCII'd head, driven imperatively in `onBeforeRender`. Dark through the hero, then "tada" on at the interlude, then follow the scroll. See [Scroll-driven spotlights](#scroll-driven-spotlights). |
| `components/home/AsciiTextAnimation.vue` | The hero: the name assembles character-by-character across the hero section's scroll range. |

### Selective-render overlay (issue #17)

The ASCII `EffectComposer` quantizes the **whole** rendered scene, so thin lines
rendered the normal way get mangled into the character grid. Set-pieces instead
live on dedicated three.js **layers** the composer's RenderPass (camera on layer
0) never sees; then, in the same render loop (`onRender`, right after the
composer), they're re-drawn crisp on top:

1. on-top backdrops (route arc, thread-board, signal rings, …) draw over the
   ASCII'd head;
2. the head is stamped into the depth buffer (depth only);
3. depth-occluded pieces (the lattice cloud, the stack logos, the Berlin skyline)
   draw depth-tested against it, so the head hides whatever sits behind it — the
   face reads *inside* the graph, and *in front of* the horizon.

No second rAF, no per-frame layout reads, nothing allocated per frame (issue #4).

### `reveal` is a bloom — for an entrance, ask for `cardProgress`

`reveal` ramps over only `REVEAL_FADE` (0.25) of a beat's window, holds, then
ramps back out. So **any entrance hung off `reveal` finishes in a quarter of its
beat** — at the biography's weight that is ~118px of scroll, about one notch of a
mouse wheel, and it reads as a flicker rather than an animation. (`StackFlight`
hit this first; see the `weight` note in the skills chapter.)

`SceneSetPieces` therefore also hands a piece its beat's **raw local travel** —
0 as the window opens, 1 as it closes, unshaped — as an optional `cardProgress`
prop. It spans the same window `reveal` fades over, so `reveal` still owns the
fade in/out while the piece spends the *whole* window assembling. Pieces opt in
by name (`PROGRESS_DRIVEN`), and it is bound with `v-bind` rather than as a plain
attribute: a stray `card-progress` falling through to a non-declaring set-piece's
root `<TresGroup>` would be patched onto the `Object3D` by TresJS's `patchProp`.

Being scroll-driven rather than time-driven, such an entrance is **reversible** —
scrolling back up un-draws it.

### Set-piece contract

Every set-piece follows the same shape (see `Lattice.vue` / `SignalField.vue`):

- props `SetPieceProps` from `setpieces/lineArt.ts`
  (`{ reveal?, variant?, position?, cardProgress? }`)
- geometry built once (seeded PRNG where random; deterministic otherwise)
- only line/point primitives; additive, `transparent`, `depthWrite:false`, `opacity:0`
- a `useLoop().onBeforeRender` that gates on `reveal` (visibility/scale/opacity)
  and adds ambient motion via `delta`/`elapsed`
- `onBeforeUnmount` disposes every geometry and material it created

### The line-art vocabulary (`setpieces/lineArt.ts`)

The milestone backdrops were, for a while, five variations on *scatter some
points, wire the near ones together, spin it*. That shape is quick to write and
it reads as filler, for reasons worth naming because they recur:

1. **Uniform noise has no silhouette.** Points spread evenly over a shell look
   the same in every direction, so there is nothing for the eye to hold. Give a
   field *structure* — clusters, a grid, a shelf, a staff — and the negative
   space does half the work.
2. **Proximity wiring makes a hairball.** "Connect everything within r" is dense
   in the middle and stray at the edges. **k-nearest-neighbour** wiring draws
   filaments you can follow, and it is what a vector index actually does.
3. **`PointsMaterial` draws squares.** Untextured points are hard-edged squares
   at one fixed size for the whole field. `createDots` is the smallest shader
   that fixes it: a radial falloff, a per-point `size` attribute (so a graph can
   have hubs and leaves) and a per-point `glow` the piece drives to light
   individual nodes.
4. **A turntable is not an animation.** A constant spin plus a global sine says
   nothing. Every piece now runs a recurring **event** instead — a query probing
   a latent space, a lead travelling a thread, a retrieval composing a cited
   answer, a playhead reading a page — with a beginning, an arrival and a decay.
5. **Nothing answered the cursor.** Only the skyline did. Every piece now turns
   with the pointer, which is also what makes depth (the extrusion, the ranks,
   the tilt of a board) visible at all.

The module carries the shared moves: `mulberry32` / `hash01` (deterministic
layout), `drawFraction` + `orderSegments` (the draw-on — the order segments are
written in *is* the animation), `createLines` / `createLinkPool` (static
structure vs. the live wires a piece flashes over it), and `createDots` /
`setDotScale`.

**Size the piece to the frame it plays in.** At the biography camera (z ≈ 1.3,
fov 45) the visible world is only about **1.9 × 1.1 units**. Several pieces were
authored at 2.4–2.8 units wide and ran off both edges — tolerable when they were
sparse dot fields, wrong once they carry legible content (notes, pages,
notation). Each now has a `STAGE_SCALE` at the top of the file, and
`SLOT_OFFSETS` pushes a stacked piece **back** rather than far to the side,
since depth widens the frame a piece is composed into and sideways travel does
not.

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

### Yaw 0 is face-on (`faceYaw`, the model correction)

**Everywhere in this codebase, head yaw 0 means looking straight down the lens**,
and positive means screen-right. Author gazes, resting poses and keyframes around
0 and they will do what they say.

That is not free, because **`head.glb` is authored already turned** — about 41° to
its own left, so its own face-on yaw is ~-0.72. Rather than make every author and
every generator remember that offset (they will not — the skills gaze was built
around 0 and spent the chapter showing an ear), it is corrected **exactly once**,
in `Scene3D`, on the way to the `Object3D`:

```ts
headGroupRef.value?.rotation.set(
  headRotationX.value,
  headRotationY.value + faceYaw.value,   // the only line that knows
  headRotationZ.value
);
```

Everything upstream — the keyframe tracks, `skillsHeadKeyframes`,
`biographyHeadKeyframes`, the addressing pose, the cursor parallax, the dev
panel's scenes tab — works in face-on space and never sees the offset. Adding it
after the smoothing rather than before keeps the smoothing in the same space too.

**`faceYaw` is tunable, not a constant** (dev panel → global → Head model), so a
new head model needs no animation changes at all: dial "Face-on yaw" until the
resting head looks straight at you, export, done. That is the whole reason it
lives in one place.

**Re-measuring it for a new model.** The nose is a head's most protruding feature,
so the frontal yaw is the one that maximises the mesh's forward extent: sweep yaw,
take the max `+z` over all vertices, find the peak. Two cautions — take the peak
*nearest* face-on rather than the global maximum (the back of the skull sticks out
further from the centre than the nose does), and don't try it for pitch, because a
head is taller than it is deep so tilting brings the crown or chin forward and
there is no interior peak. Confirm with a render at the candidate ±0.3: dead-on in
the middle, mirror-image three-quarters either side.

**If you ever change the convention**, these are all the places that author a head
yaw and must move together: `DEFAULT_HEAD_YAW` (store), `REST_YAW` in both
`skills.ts` and `biography.ts`, the first-frame seed and `addressYaw` default in
`Scene3D`, the dev panel's new-head-keyframe default, and the saved `addressYaw`
in `tuning.config.json`. Persisted dev-panel edits in localStorage are in the old
space and should be cleared.

**Amplitude and responsiveness are different problems.** They are easy to confuse
when a turn feels wrong, and they have different fixes.

*Amplitude* is how far the head turns, and it wants to be modest: the skills cards
alternate sides, so the head travels *twice* `GAZE_MAX_YAW` between consecutive
cards, across the narrow gap between their windows. At 0.62 that was a 71° whip
that read as snapping rather than watching. Two numbers fix it together — lower
the maximum (now 0.4, ~23°), and *raise* the saturation reference (`GAZE_REF_VW`)
so a card only reaches full yaw at the very start of its run instead of pinning
there for most of the pass.

*Responsiveness* is how quickly the head gets to wherever the track is pointing,
and it is a single number: `turnSpeed` (dev panel → global → Head model), the
per-frame chase factor in `Scene3D`. At 0.12 the head lagged the scroll by ~90ms
and read as sluggish, as though it noticed each card late; 0.28 is ~35ms, so the
turn lands *with* the card without the swing getting any wider. It stays damped
rather than instant because the contact beat rides raw cursor input on top of it.
The factor is re-based onto each frame's real delta, so the feel is identical at
30, 60 or 144fps.

### The head can fade (`HeadKeyframe.opacity`)

A head keyframe carries an **`opacity`** (default 1) alongside its pose. It rides
the same track, interpolated by the same sampler — but **linearly, not eased**: a
fade wants a straight ramp, and easing makes the head linger at the edges of its
own cut.

This exists because a pose track can only ever *interpolate*. To get the head
from the left of the frame back to the right, it has to visibly fly across.
Fading to 0 at the end of a pass and back in at the start of the next lets it
leave and reappear instead — the travel still happens, just unseen. Reach for it
whenever a scene needs the head to *cut* rather than travel. (No shipped chapter
does today: skills used to, back when the head rode a conveyor across the frame
with each card; now it stays put and the cards come to it.)

`Scene3D` applies it by collecting the model's materials **once per load** (the
loop only writes numbers — issue #4) and, at 0, hiding the head group outright.
Hiding matters: it also drops the head from the depth-occluder pass, so
set-pieces aren't masked by an invisible head. `depthWrite` is deliberately left
alone — turning it off mid-fade makes the back of the head show through the
front. Editable per keyframe in the dev panel (scenes → Head → opacity).

**A fade at a section's first keyframe bleeds backwards.** The track spans the
whole page, so an `opacity: 0` at the start of a section interpolates from the
*previous* section's keyframe — starting the skills chapter faded made the head
dissolve through the last stretch of the biography. Hold opacity 1 at the
boundary and do the fading inside the section.

### Generated keyframes: the skills chapter's gaze

The `skills` scene shows what the anchored model buys you. Its four cluster cards
fly through a pinned stage — each one arrives larger than life on top of the
viewer, then recedes along the line of sight into the face — and where a card is
at any moment is a pure function of `store.progress`. So the head's gaze is one
too: "the head watches the cards arrive" needs no tracking code, no DOM
measurement and nothing per-frame. `components/home/sections/skills.ts` owns the
flight formula (`skillCenter` / `skillHalfWindow` / `skillTravel` →
`skillScale` / `skillOffset`) and **generates** three tracks from it:

| Generator | Consumed by | Effect |
| --- | --- | --- |
| `skillsHeadKeyframes()` | `registry.ts` → `headKeyframes` | `GAZE_SAMPLES` poses per card, each read off the card's real position, resting yaw either end |
| `skillsSpotKeyframes()` | `spotlights.ts` → the **key** track | the light swings on the *same* beats, so the head is lit from the side the incoming card is on |
| `skillsCameraKeyframes()` | `registry.ts` → `cameraKeyframes` | a near-static hold, pulled back so the head sits small and low and the cards have the upper frame to come in through |

`samplePose`'s `power2.inOut` turns the gap between one card landing and the next
one appearing into a smooth swing across — watching traffic, not a snap. Because
all three read one formula, adding or removing a cluster re-derives the cards,
the gaze and the light together. This is the same one-formula-two-consumers trick
the biography uses with `bioMilestoneCenter`.

**Two poses per card is not enough.** `samplePose` eases *every* adjacent pair
with `power2.inOut`, so a two-pose sweep races through the middle of its arc
while the card flies in at a steady rate — the head lurches rather than tracks.
Sampling the card's actual position several times across the tracked stretch
makes the eased track follow it closely. This applies to any keyframed motion
that has to stay in step with something moving linearly.

**Both sign conventions matter, and they are not symmetrical.**

- `rotation.y > 0` → looking screen-**right** (the finale's `addressYaw: 0.45`
  turns the head toward the CLI card on the right).
- `rotation.x > 0` → looking **down**. `Scene3D` adds
  `pointer.y * maxPitch`, and `pointer.y` is
  `clientY / innerHeight * 2 - 1` — *screen* space, positive at the bottom. So
  tracking anything above the head needs a **negative** pitch.

### Pacing the biography: one card at a time

Three numbers set how much room a milestone gets, and they are easy to get
wrong in opposite directions:

| Number | Where | What it does |
| --- | --- | --- |
| `weight` | `registry.ts` | how tall the section is, so how far apart the cards are |
| `BIO_TOP_PAD` / `BIO_RANGE` | `stores/sections.ts` | where the cluster sits inside it — the lead-in and the tail |
| `BIO_PIECE_SPAN` | `stores/sections.ts` | how much wider a set-piece's window is than its card's anchor window |

At `weight: 4` the six cards sat ~0.54 viewports apart. On a 900px screen that is
~480px — **shorter than a card is tall**, so there were always two cards on
screen and each milestone's artwork was squeezed into the gap between them.
`weight: 7` puts them just under a viewport apart: a card arrives, holds the
frame with its own backdrop, and leaves before the next comes up.

Stretching a chapter exposes whatever was tiling exactly inside it. Two things
were:

- **The lead-in.** `BIO_TOP_PAD` is a fraction of the section, so at weight 7 the
  old `0.13` became a full viewport of headline and bare connector before the
  first card. Trimmed to `0.08`, with `BIO_RANGE` widened to match, so the height
  the reweight bought goes into the gaps between cards and not into dead air at
  the ends.
- **The handover.** `subReveal`'s bloom used the same half-window that
  milestone-pinned keyframes are anchored across — exactly half the spacing, so
  one backdrop reached zero at the precise point the next started from zero.
  There was always an instant with neither drawn; at the old spacing it passed
  unnoticed, at the new one it is a near-empty viewport. `BIO_PIECE_SPAN` (1.35)
  widens the **piece** window only, so the windows overlap by about a third of a
  spacing and the outgoing milestone's art is still there as the next arrives.

**Why that is a separate number and not just a wider half-window.** The anchor
window also defines the span the head's generated gaze samples are laid out
across (`GAZE_TRACK`, the middle 60% of it). Widening *that* would shrink the gap
the head swings across between cards from 40% of a spacing to about 10% — the
swerve would snap instead of swing, and past ~0.83 the combined pose track stops
being sorted in `t` at all. The set-piece bloom has no such constraint, so it
gets its own factor.

### Generated at runtime: the biography's swerve

The biography chapter plays the same trick, with one structural difference that
drives its whole design. Its cards **swerve the head to the opposite side**: card
on the left → the head slides right (`HEAD_SWERVE_X`) and yaws *left* to look
back at it, lit by a key that swings onto the card's side. As in skills, one
module — `components/home/sections/biography.ts` — owns the formula and
everything else is generated from it:

| Generator | Consumed by | Effect |
| --- | --- | --- |
| `bioCardAnchors()` | `BiographySection.vue` | places the nodes, cards and connector spline |
| `biographyHeadKeyframes()` | `sections` store → `headKeyframes.biography` | the swerve + gaze, `GAZE_SAMPLES` poses per card |
| `biographySpotKeyframes()` | `spotlights` store → the **key** + **fill** tracks | the key lights from the card's side, the fill counters it |

**The difference from skills: the card count is a runtime value.** `skills.ts`
can generate at module-eval time because `SKILL_CLUSTERS.length` is a constant;
the biography's cards are a `@nuxt/content` collection whose count, sides and
accents only exist once the query resolves. So the generators run from
`useBiographyChoreography()` (`composables/useSections.ts`), called once from
`BiographySection.vue` — the one component that already reads the milestone list
and is mounted for the life of the page (`SectionHost` renders every section
unconditionally). Nothing is authored for this section in `registry.ts` or
`spotlights.ts`; both carry a comment saying why.

It is a `watch` on a **signature** of everything the generators read (section id,
start/span/pageVh, and each milestone's side/accent/offset) — deliberately not a
`watchEffect` (which would track the stores it writes into) and not the milestone
array (which would re-run on every reactive tick). Both setters *overwrite* the
whole section's track, so re-running carelessly would clobber live dev-panel
edits.

**Generated tracks double as their section's reset baseline.** They can't live on
the registry spine, so `sections.setHeadKeyframes` and
`spotlights.setSectionKeyframes` each record what they wrote — otherwise the dev
panel's *reset*, which reseeds from the committed spine, would silently drop
every generated beat until the next reload. `setSectionKeyframes` replaces only
the named section's keyframes, so the hand-off keyframes on either side
(`pause` / `skills`) survive.

#### The screen ↔ world identity

The cards are DOM and the head is 3D, so the gaze needs exactly one bridge: where
a card is *on screen* at the scroll position a keyframe is being placed at. That
has a closed form. Progress is normalised over (document − one viewport) and
every section is `weight * 100vh` tall, so a card's document position in viewport
heights is `pageVh * anchorP` — its milestone anchor is literally the fraction of
the page it sits at. Hence, with 0 = top of viewport and 1 = bottom:

```
screenY(p) = anchorP + (anchorP − p) * (pageVh − 1)
```

Two consequences, and they set every number in the module:

- At its own beat a card sits `anchorP` down the viewport — with the shipped
  weights, ~28–48%, i.e. **above** the head, so tracking it needs a **negative**
  pitch. The last card creeps just below centre and the formula flips the sign on
  its own.
- Across its own window a card sweeps only ~25% of the viewport upward, because
  the page scrolls almost exactly as fast as the card rises. So the same
  "**two poses per card is not enough**" rule applies here as in skills, for a
  subtler reason: one pose per card would leave the head permanently mid-swing.

This is the quantitative form of the camera-anchors-vs-pixel-positions caveat
under [Notes / known limitations](#notes--known-limitations).

#### Mixing accent colours into a light

Each milestone carries its own accent, and tinting the key with it is tempting.
Keep the mix **shallow** (`KEY_ACCENT_MIX` is 0.18): half the accents are warm,
and warm averaged with the chapter's blue in sRGB passes straight through
**neutral grey** (`#ffd479` → `#b8d2d7` at 0.3). Nudge the hue or change it
outright; don't average across the wheel. The full accent still reads on the card
itself, which is where it belongs.

**If a light must change hue outright, change it in the dark.** The skills
chapter lights each cluster in that cluster's own colour, and a spotlight track
*interpolates* — so a keyframe of amber followed by one of mint takes the head
through exactly the neutral grey above, in full view, on every card change.
`skillsSpotKeyframes` (and `skillsRimKeyframes`) therefore put a **dark beat** in
every hand-off: two keyframes in the gap at `intensity: 2`, the first still on the
outgoing hue and the second already on the incoming one, so the whole transit
happens where nobody can see it. It pays for itself twice — the key now
*re-strikes* for each cluster instead of sliding continuously, which is a better
beat than the slide was.

Two supporting rules, both in `skills.ts`:

- **Order the palette around the wheel.** `SKILL_CLUSTERS` runs amber → mint →
  ice → violet, so consecutive steps are short even before the dark beat helps.
- **The fill goes neutral.** A warm fill was fine under one amber key; under four
  rotating hues it fought three of them. `#dfe6ef` sits under any of them.

### The DOM beam: soft alpha, never `clip-path` + `filter`

`SkillsSection`'s light shaft is a `conic-gradient` (angular falloff) multiplied
by a `radial-gradient` mask (distance falloff), with no blend mode. An earlier
version clipped a rectangle with `clip-path` and softened it with
`filter: blur()`, which visibly **boxed** the beam for two compounding reasons:
filters apply *before* clipping, so the clip puts perfectly hard edges back onto
the blurred result; and `filter` + `mix-blend-mode` promote the element to its
own composited layer whose rectangle shows as a seam against the ASCII grid
behind it. Build glows out of soft alpha instead — there is then no edge to box.

Use `color-mix(in srgb, var(--accent) N%, transparent)` rather than bare
`transparent` in colour gradients: the `transparent` keyword is *transparent
black*, which fringes dark when interpolated. Mask gradients are exempt — they
read alpha only.

**Corollary:** `color-mix(in srgb, C 0%, transparent)` resolves to that same
transparent black, so it is *not* a safe way to end a colour ramp at nothing. End
the colour ramp at ~1% and let a **mask** take it to zero.

#### The lit biography card (`BiographyCard`)

The same discipline, applied to DOM: each milestone card is lit rather than
merely tinted — a light pool spilling off its inner edge onto the scene, a ramp
across its face, the accent rim burning up, and its own shadow thrown the *other*
way (the shadow's direction sells "lit from over there" more than the glow does).
It is the DOM half of the beat where the head swerves away and turns back to look
at it.

Three things worth keeping if you touch it:

- **One sign property, every asymmetric value in `calc()`.** `--lit-dir` is set
  from the card's `side`, and the pool insets, gradient centres, ramp angle and
  both shadow offsets all derive from it — which is what stops the rim, pool,
  ramp and shadow drifting onto different edges. The mobile breakpoint flips it,
  because there the rim moves to the left for *every* card.
- **A light ramp across a card face must be diagonal.** A purely horizontal one
  reads as a two-tone panel cut down the middle; a diagonal one pooling in the
  far-*bottom* corner reads as a surface lit from above and to one side.
- **"Which card is active" is a second `useElementVisibility`** with a negative
  `rootMargin` band across the middle of the viewport — distinct from the
  entrance observer. A cheap way to get a scroll-position-like active state in a
  DOM component without reaching for `store.progress`. The band is deliberately
  taller than a card so the light crossfades between cards instead of blinking
  out; `threshold: 0` rather than a ratio, because card height varies with prose.

The lighting layers are `z-index: -1` pseudo-elements inside an explicit
`isolation: isolate` — they must paint above the card's background but under its
text, and that only holds inside a stacking context. Don't rely on the
`transform` to provide one: reduced-motion drops it.

#### The skills flight: let the projection draw the path (`SkillsSection`)

The four cluster cards used to ride a conveyor right→left across the pinned
stage. They now fly **at you and past into the depth**: each arrives larger than
life on top of the viewer, then recedes along the line of sight until the head
swallows it.

**A card's in-plane position never changes** — only its `translateZ`. The stage
puts `perspective-origin` on the face, so the browser's own projection does the
rest: a card at `z → −∞` converges *exactly* on that point, and one approaching
`z → +perspective` blows up and sails off frame. That is the whole trick, and it
is the part to keep if you retune this. Animating x, y and scale toward a
vanishing point by hand gives you three numbers that can drift apart and a
convergence that is never quite exact.

Four consequences worth knowing:

- **`faceY` is one number with one meaning.** It is the `perspective-origin`, the
  `top` the slots are anchored on, *and* the apex the light cone pivots around.
  If the head moves on screen, retune it once (dev panel → skills → Skills
  flight).
- **The depth ramp is geometric, not linear** (`skillScale`). Something receding
  at a steady rate halves in apparent size over equal steps of depth. A linear
  ramp on `translateZ` races through the near half, where apparent size changes
  fastest, and crawls through the far half — the card flicks past the readable
  window and then loiters as a dot.
- **The maths are written in apparent size, not in `z`.** `skillTranslateZ(s, p)`
  inverts the browser's own `scale = p / (p − z)`, so a card's projected offset is
  exactly `home × scale` — the one number the gaze, the key light, the DOM beam
  and `StackFlight` all consume — and `perspective` stays a free knob that changes
  only how the cards' own tilt is foreshortened.
- **The camera has to hold still** (`skillsCameraKeyframes`). The cards aim at a
  fixed *screen* point, so a camera move that shifts or resizes the head pulls the
  face off the point its own cards are converging on. The finale's pan waits until
  `t: 0.88`, by which time the last card has landed.

`transform-style: preserve-3d` on the track is what makes the cards **sort by
depth** against each other — with the flight windows overlapping, the one still
coming at you has to occlude the one on its way out, and no `z-index` can express
that. The track is still flattened as a whole into the stage, so its own
`z-index` is what orders it against the beam (behind) and the heading (in front).

The near end of a run is deliberately **unreadable**: part off frame, turned
toward the viewer, and blurred (`near²` — a shallow depth of field). Put that blur
on the card *inside* the slot, never on the slot itself: `filter` is a grouping
property and the slot is the element carrying the 3D transform. A card outside its
window also parks at the near end of the ramp, where the blur is heaviest, so it
gets `visibility: hidden` at zero opacity rather than being left to composite a
full-frame filtered layer on every tick.

### The backdrop: the stack flying past you (`StackFlight`)

The chapter's set-piece used to be a conveyor: the brand marks stroked flat onto
three horizontal rails, with tick gates, a dot belt and two vertical descent
guides. It moved *sideways* while the cards moved *at you*, and the vertical
guides were the most conspicuous thing in the frame. All of it is gone. Everything
in the backdrop now travels the card's own axis — launching in front of the lens
and running away into the depth.

Two populations share that path, and the mix is the point:

| | what it is | how it reads |
| --- | --- | --- |
| **Marks** | the real brand SVGs of the cluster on the mark, **extruded** into solids | full section hue, and a depth body hides their own back edges — objects you could pick up |
| **Shards** | tech debris — ICs with pin legs, angle brackets, hex nuts, crystals, cube frames, flat circuit traces | **open frames** (no body, you see the far side) pulled toward cold slate by `shardTint` — weather, not content |

Both travel the same path; only the register differs. That split is deliberate and
is what stops the debris competing with the thing it is supposed to frame. The
shards do carry a small face wash (`shardFill`, default 0.12) so the field is not
pure line-art — but unlike the marks' fill it does **not write depth**, so you
still see a shard's far side through it and the distinction survives.

**Nothing in the field keeps formation.** Three things were uniform and all three
read as mechanical:

- *Same speed.* Everything rides one scroll signal, so with a shared cycle rate
  the whole field slid past like one rigid sheet. Each shard now runs its cycle at
  its own rate (`paceSpread`), which scales `dd/dflow` directly — about 1.8×
  between the slowest and fastest pieces at the default. The first attempt bent
  each piece's `u → depth` curve by a per-shard exponent instead; that changes
  *when* a piece is at a depth but not how fast it is moving once there, and
  measured out at 1.12× — invisible. The lever has to be on the rate, not the
  curve.
- *Same moment.* `u` maps straight to depth, so "draws itself in over u 0.02→0.20"
  means "draws itself in at **that distance**" — every piece performing the same
  wipe at the same place, forever. Only `trace` of them draw in at all now (0.3),
  and those start at their own point of the run (`drawVar` over `DRAW_SPREAD`).
  The rest are simply there, fully formed, arriving on the fade.
- *Same colour history.* Already handled — each piece wears the hue current when
  **it** launched, so a cluster change arrives with the new arrivals. The
  look-back is per piece (`uFlow / (SHARD_CYCLES * rate)`), which is why the rate
  has to be threaded through it: a slow shard given a fast one's look-back gets
  the wrong chapter's colour.

**The paths are nearly PARALLEL to the view axis** — they are not aimed at the
head. An earlier version gave each flyer its own target scattered around the face;
from a small launch ring that diverges hard, and it read exactly like someone
lobbing shapes at the camera rather than like flight. Parallel paths give the
opposite read — you are moving through a field that stays put — and they still
converge on the face **on screen**, because the vanishing point of a line parallel
to the view axis is the centre of frame, which is where the head sits. Perspective
does it, not arithmetic, and perspective is what the eye believes.

Which piece hits the head is then decided by **one number**: how far off-axis it
launches. Inside about a third of a unit its path runs through the face and the
head's depth stamp eats it; further out it passes beside. That is the whole
"some of them fly into it" mechanism.

The flight is the **same law as the cards**: straight-line motion through space,
paced *geometrically* in distance-from-camera. `place()` solves depth first
(`d = d0·(d1/d0)^u`), then lerps the lateral position by how far through the
depth run it has got. Honest 3D travel, apparent size falling off the way a real
object's does.

Four things will bite if you retune it:

- **The visible SHRINK is what sells recession.** The eye judges "going away" by
  how much a thing gets smaller, and that is the ratio `END_D / LAUNCH_D` across
  the stretch where the piece is actually visible. An early version faded out at
  `u = 0.7` of a short run — only a 2.5× shrink — and the field read as
  evaporating in mid-air rather than going anywhere. It now holds opacity to
  `u = 0.84` of a ~11× run. If it stops reading as depth, this is the number.
- **Don't launch closer than about half a unit.** At fov 45 anything nearer is
  wider than the frame, and because the pace is geometric roughly a third of every
  run is spent in the nearest octave — at `LAUNCH_D = 0.34` the field filled the
  screen with giant near-field wireframe and read as noise.
- **Stagger by REMAPPING the run, not by offsetting it.** A cluster's marks launch
  one after another. Subtracting the offset from `u` is the obvious way and is
  wrong: the last mark only ever reaches `u = 1 - stagger` before its cluster's
  window closes, so it was cut off mid-flight at half opacity and popped out of
  existence. `clamp01((travel - start) / (1 - start))` gives every mark a complete
  0..1 run — it starts later, flies slightly faster, and always fades out properly.
- **The depth body is `colorWrite: false`.** Each extruded piece carries a mesh
  that writes *depth only*, so its own back edges are hidden and it reads as a
  solid — without punching a dark plate through the scene behind it. It needs
  `polygonOffset`, or the outline z-fights the body it belongs to, and it must be
  hidden whenever the piece is (an invisible body still occludes).
- **Shards and marks share one draw-on window.** Shards run continuously while a
  cluster's marks only start at their own beat, so a slower mark wipe left the
  icons visibly trailing the debris they were supposed to arrive with. Both now
  use `DRAW_START` / `DRAW_WINDOW` over their own run.

#### The head is an obstacle, not a hole

Parallel paths all aim at the same vanishing point, and that point is the head —
so with `spread = 1` the entire field funnelled into the silhouette and vanished
behind it. Two things fix that, and both are live-tunable (dev panel → skills →
**Stack flight**, shipped via `tuning.config.json`):

- **`spread`** fans the paths apart as they recede. The depth ramp still outruns
  it by roughly 11× to 1, so the field converges on screen — it just arrives
  spread across the frame instead of stacked on the face.
- **`headClear` / `bounce` / `tumble`** make the head a body the pieces
  **collide** with. See below.

#### Colliding with the head

The head is a sphere the field bounces off, not a force field it bends around. A
field bends *everything* near it and the eye reads that as magnetism; a collision
splits the population in two, and that is what sells it — about a quarter of the
pieces connect and the rest sail past untouched.

Because a flight is a straight line (both the depth ramp and the fan are linear in
`s`), "does this hit" is an exact **ray-sphere test**, not anything stepped or
simulated. And it all stays a **pure function of `u`**: scrolling back up has to
run the collision backwards exactly, so there is no state and no integration — the
impact is *solved for*, every frame, from scratch. A piece that remembered it had
been hit would smear on the way out.

On contact the piece **leaves the straight path entirely** and flies from the
point of impact: the tangential part of its motion is kept, the part heading into
the head is reversed, and `bounce` throws it outward along the normal. `tumble`
jumps its spin rate, and a short spark fires at the moment of contact.

**The veer has to outrun the perspective.** On screen a piece sits at `X / d`, and
`d` grows *geometrically* down a run — more than twentyfold. So an outward push
that grows linearly loses: the piece gains a little sideways offset and still
converges on the vanishing point, which is to say it still sails off behind the
head as if nothing had hit it. `KICK_GROWTH` (1.3) makes the kick scale as a power
of `d / dHit` instead, so the screen offset *grows* and the piece leaves frame.
Measured: every bounced piece ends further from the vanishing point than it was
mid-flight, and every piece that missed still converges on it.

**The share that collides is SOLVED, not drawn.** Left to chance it was ~9% — two
shards out of twenty-two, each bouncing once, somewhere off to the side:
implemented, working, and far too rare to read as anything. `grazeFor()` bisects
for the widest launch radius at which a given flyer still strikes the head, and
`hitShare` of the field is placed inside it while the rest are placed outside. The
guarantee then survives tuning — change the head radius, the spread or the run
depth and the same share still connects.

Solve it **per flyer**, not once for the field. An earlier version used the mean
fan and ignored the field's rise; only 6 of 17 supposedly-aimed pieces connected
and 5 supposedly-missing ones hit anyway. The per-flyer fan varies by a quarter
either way and multiplies the whole outward angle, so a mean is nowhere near good
enough to promise anything with. Per flyer it is exact (17/17 and 0/23), and it
costs ~12 cheap iterations per visible flyer per frame, which is nothing next to
drawing them.

**A launch can be inside the head.** `headClear` goes past `LAUNCH_Z` at the top
of its slider, and then a piece starts embedded: the near root sits *behind* the
launch plane, every flyer reads as a clean miss, and the aimed/unaimed split
collapses silently while pieces further out still collide. Treat "already inside"
as striking at `s = 0`. Worth a guard because it is reachable from the panel, and
because the failure is invisible — the field still looks busy, it just stops
bouncing.

Four more things that are easy to get wrong here, all of them found by measuring
rather than by looking:

- **Add the kick to the rebound, not to the straight path.** Adding it to the
  straight continuation is the obvious shortcut and looks fine for glancing hits.
  It is badly wrong for square ones: the straight path carries on *through* the
  head and out the far side, so it crosses the axis, the outward bearing flips,
  and the piece snaps through 180°. Rebounding from the contact point cannot cross
  the axis, because the radial component only ever points away.
- **A kink is not a jump.** A head-on bounce genuinely reverses direction by
  180° — that is what bouncing *is* — so a large direction change is not evidence
  of a bug. The thing to test for is a discontinuity in *position*: sample the run
  and compare the worst step against the median. A real crease sits at a few times
  the median; a discontinuity sits at hundreds.
- **The tumble compounds with the depth ramp.** `ds/du` reaches ~2.6 by the end of
  a run, so the late spin rate is roughly `1 + t + 3.1t` times the pre-impact one.
  At `tumble: 4` that is a ~17× blur rather than a tumble; 1.2 lands near 5×,
  which reads as knocked spinning while the piece is still legible.

A hard clamp to the sphere's cross-section at each depth stays as a backstop
(nothing may ever be *inside* the head), and `headClear: 0` disables the whole
thing and restores the pass-through.

**Every cluster has its own hue** (`SkillCluster.accent`, read through
`skillAccent`), and **the whole frame wears one hue at a time**. One value drives
the DOM card's rim and chips, the light cone under it, the key and rim spots on
the head, and every piece in the 3D field — so the scene changes register as a
cluster arrives rather than holding a mixed palette.

Giving each *piece* its own colour was the obvious first try and was wrong: four
hues on screen at once reads as confetti, where a frame that changes as a whole
reads as a new chapter. The field therefore takes the **current** cluster's hue,
crossfaded in **HSL, not RGB** — an RGB lerp between two hues this far apart
passes through desaturated grey, the same trap the spotlight hand-offs dodge with
a dark beat. `Color.lerpHSL` goes the short way round the wheel instead. The
crossfade holds each colour through the middle of its band and swings across in
the gap, so the hue belongs to the cluster rather than sliding continuously.

To collapse the chapter back to a single colour, set all four
`SKILL_CLUSTERS[].accent` to the same value — nothing else needs touching.

See [Mixing accent colours into a light](#mixing-accent-colours-into-a-light) for
the rule that makes a rotating key hue survive interpolation.

Each mark still **draws itself in** via `setDrawRange` — the motif the flat marks
had. One wrinkle the outlines did not have: `EdgesGeometry` emits segments in face
order, which is arbitrary, so drawing that range straight sparkles random edges on
instead of drawing the shape. `sortEdgesUpward()` re-sorts the buffer once at build
time so the reveal is an upward wipe. The body only joins once the wipe is complete,
or it would occlude the half of the outline that has not been drawn yet.

Extrusion is also why the SVG pipeline differs from `BerlinSkyline`'s:
`SVGLoader.createShapes(path)` resolves each glyph's **holes**, which flat
polylines never had to. (Set-pieces bypass the ASCII pass entirely — see the
selective-render overlay — so shaded solids *would* render here. Line art is a
style decision, not a technical limit.)

**Pace is set by the section's `weight`, not by the individual animations.**
Every beat here is a fraction of the section's scroll range, so `weight` is the
one lever that slows all of them together. At `weight: 3` a mark drew itself in
over ~150px — about one notch of a mouse wheel — and read as a flicker; at 5 the
cards arrived so far apart that the chapter dragged between them. `4` is the
current setting. Reach for `weight` before retuning individual windows.

The second lever is **`HALF_FACTOR`** (`skills.ts`), which widens each card's
window so consecutive cards OVERLAP — one still receding into the face while the
next is already arriving. That is what makes the chapter read as a continuous run
rather than four separate events. Its ceiling is `GAZE_TRACK`: a gap has to remain
between one card's last gaze sample and the next card's first, or the generated
pose track stops being sorted in `t` and folds back on itself.

The marks appear **twice, in different registers** — extruded solids flying past
in 3D, small flat glyphs in the DOM chips (masked with `currentColor`, so they
inherit the chip's tint for free). The backdrop's list is *derived* from the chips
via `clusterLogos()`, so the two can never drift apart.

`FIELD_RISE` drifts the whole field up as you scroll down. It is the chapter's
only remaining "you are still going down the page" cue now that the descent ladder
is gone — one line, and no vertical furniture in the frame.

The head **stays put** here and is the thing being flown at, which is why it no
longer fades: it leans toward each incoming card (`HEAD_SWAY_X`) and flinches
back from one that is right on top of it (`HEAD_RECOIL_Z`), but it must not
travel. It is the vanishing point, and that point is a fixed spot on screen.

The gaze is derived from the card's **projected** offset — the same number that
decides where the card is drawn — so it is honest for free: wide and tilted up
while the card is huge and off to one side, easing square to camera as the card
shrinks onto the face. Every card therefore ends its run with the head looking
straight down the lens, which is the beat: it catches the thing thrown at it.
Change the flight and the gaze follows without being touched.

### The horizon: the Berlin skyline

`BerlinSkyline` uses the same SVG → lines → `setDrawRange` pipeline as
`StackFlight`, plus four decisions that are easy to undo by accident:

- **The draw order *is* the animation.** `setDrawRange` walks the position buffer
  front to back, so the order segments are *written* in is the order the pen
  takes them. Each group's segments are therefore sorted **once at build time**:
  buildings bottom-up **across sub-paths** (so a building grows out of the ground
  rather than having its several outlines traced in turn), the ground line
  left→right (so the horizon draws across before anything stands on it). Sky
  extras keep their authored order — a plane reads best traced the way it was
  drawn.
- **It is driven by `cardProgress`, not `reveal`** (see the bloom note above), so
  the assembly spans the card's whole window instead of a quarter of it. The
  schedule finishes by ~0.72 on purpose: `reveal` starts fading the piece back
  out at 0.75, and a part still drawing while it dims reads as a glitch. As
  everywhere else, section `weight` is the one lever that slows all of it.
- **It is a horizon, not a mask.** It is in `OCCLUDED_PIECES`, so the head is
  depth-stamped first and the skyline tests against it; and it is anchored by its
  **bottom centre** (`horizon`, tunable with a gizmo) rather than its centre, so
  the value reads as "where the city stands" and survives an SVG whose bounding
  box changes. Nothing assumes the head is at x = 0 — it swerves across the
  biography cards, and a wide, centred, depth-occluded horizon works wherever it
  goes.

- **The buildings are extruded.** The art is a flat drawing, so each building
  carries a second copy of its own outline set back in z, with rungs tying the
  two together every `CONNECT_EVERY` segments, and the buildings sit at slightly
  different ranks front to back. It is *not* `ExtrudeGeometry`: every "line" in
  this SVG is a filled hairline sliver, so extruding for real would thicken 974
  ribbons rather than raise 20 buildings. The back copy and the rungs are dimmed
  through a **vertex colour**, which `LineBasicMaterial` multiplies by
  `material.color` — so the dawn sweep and the cursor's warm pool still tint the
  whole part with one animated colour. The cost is paid for by dropping
  `CURVE_DIVISIONS` from 24 to 10, which the drawing never needed at this scale.
  Depth you cannot see is depth you did not add, so the stage also **yaws** (with
  the cursor, and slowly across the card's travel): that is what walks each back
  copy out from behind its front one. Set `yaw` to 0 and the city collapses into
  a flat drawing wearing a faint echo.

Cursor response comes from giving the flat drawing **real stage-local z** per
role (`ROLE_DEPTH`): the foreground water line swings furthest against the
pointer, the sky barely moves. That is what makes it read as depth rather than a
slide. The cursor also drags a warm light pool along the skyline — the same
machinery as the perpetual dawn sweep, under the visitor's control — the beacon
blinks harder near it, and the plane chases its height and banks into it.

### The map: Berlin to Maastricht (`RouteArc`)

The "move" card's backdrop is the same SVG → lines → `setDrawRange` pipeline
pointed at a **real map**: `public/setpieces/germany.svg`, Germany and the
Netherlands cut from Natural Earth 1:50m (public domain) by
`scripts/make-germany-svg.py`. Run that script to re-cut the art (different
resolution, more neighbours, a different window); the output is committed, so it
is not part of the build.

The one idea worth keeping: **the SVG's coordinate system IS the projection.**
The generator writes the artwork as

    x =  lon * LON_SCALE      (equirectangular, standard parallel 51 N)
    y = -lat * LAT_SCALE

so a city's real coordinates, pushed through the same normalisation the artwork
gets, land exactly on the coastline — no lookup table, no hand-placed markers, no
drift when the map is re-cut. Berlin and Maastricht are therefore placed by
their actual lat/lon, and **the border crossing is solved, not authored**: the
flight path is intersected with the real German outline (the same points that
were just drawn) and the last crossing becomes the gate that flares as the
traveller passes through it. Those two constants are repeated in a comment at
the top of the SVG *and* in `RouteArc.vue`, and must move together.

Two further decisions:

- **The scroll flies it.** The route's draw fraction *is* the traveller's
  position, so the dot and the line it is drawing are one event, and scrolling
  back up flies it home. Only once it has landed does the route start looping on
  its own clock. Coupling the one moving thing in a piece to the thing the
  visitor is doing beats any amount of ambient animation.
- **Altitude, not a curve on paper.** The map is tipped back and the arc bows out
  of the map *plane*, with a ground track and altitude lines dropped to it — so
  the flight has height over the country rather than being a line drawn on it.

Placement is tunable with a gizmo, because this piece draws **on top** (it is not
in `OCCLUDED_PIECES`) and the head swerves across this chapter: where the map
sits is the only thing keeping a whole country outline off the face.

---

## State & composables

| File | Responsibility |
| --- | --- |
| `stores/sections.ts` | **Shared state only** (issue #4): `progress`, the `sections` spine, `milestoneCount`, the editable per-section `cameraKeyframes` + `headKeyframes` maps (seeded from the registry; `cameraAt`/`headAt` read them, so scenes-tab edits move camera/head live), and the derived getters — `boundaries`, `anchors`, `activeIndex`, `localProgress`, `heroProgress`, `cameraAt`, `headAt`, `revealFor`, `subReveal`, `asciiCellSize/FontSize`, `addressing`. Owns **no** rAF loop. Hosts the shared **anchor resolver** `resolveAt` / `anchorAt` + the biography `bioFrac`/`bioAnchorFromFrac`/`localFracAt` position transforms, plus the keyframe interpolator (`buildPoseTrack`/`samplePose`) shared by camera + head. `setHeadKeyframes` replaces a whole section's head track for the runtime generators, recording it as that section's reset baseline. |
| `composables/useSections.ts` | Sources the section sequence from `registry.ts` into the store (`useSections`); loads + normalizes the `content/biography` collection (`useBiographyMilestones`); generates the biography chapter's head + spotlight tracks from the loaded cards (`useBiographyChoreography`, see [the biography's swerve](#generated-at-runtime-the-biographys-swerve)). |
| `composables/usePointer.ts` | The cursor as -1..1 screen coords — **one** listener for the whole app, refcounted, shared by the head's addressing parallax and the skyline's depth parallax. Viewport size is read per pointer *move*, never per frame. `y` is +1 at the **bottom**. |
| `composables/useScrollTimeline.ts` | Owns the Lenis singleton (driven by `gsap.ticker`), the single `ScrollTrigger`, and their teardown. |
| `stores/SceneControl.ts` | Scene/ASCII config (cell size, font size, lights, control mode). Edited in dev via the **Dev Panel** (`components/home/DevPanel.vue`); see [Dev Panel and tuning](#dev-panel-and-tuning). |
| `stores/spotlights.ts` | The live, editable spotlight rig: global knobs + the keyframe `tracks` (seeded from `SPOTLIGHT_TRACKS`). Read by `ScrollSpotlights` + Scene3D's base lights, edited by the dev panel's Spotlights section. `setSectionKeyframes` replaces just one section's keyframes in a track (for the runtime generators), keeping them as the reset baseline so *reset* doesn't drop them. See [Scroll-driven spotlights](#scroll-driven-spotlights). |
| `stores/BootState.ts` | Boot sequence phases. |
| `composables/usePreferences.ts` | Visitor preferences (reduced-motion, skip boot intro), set on `/setup`, persisted to `localStorage`. Theme is owned by `useColorMode`. |

---

## Dev Panel and tuning

> **Persisted tuning shadows code defaults.** Precedence is localStorage
> (`fab:tuning`) → `tuning.config.json` → the inline default. So changing a default
> in code does *nothing* in a browser that has ever saved that group from the
> panel — the old value keeps winning, silently, and you will be looking at a
> build that does not behave like the source. Reset the group in the panel (or
> clear `fab:tuning`) after changing defaults. This matters doubly for any value
> whose MEANING changed — a persisted `addressYaw` written before the face-on
> refactor is a number in the old space, and will keep pointing the head wrong.

A single, dev-only panel (the **⚙**, top-right of the homepage) that merges two
things:

1. The **generic tuning layer** — **live-tuning hard-to-eyeball values** (3D
   anchor points, angles, radii, timings) that any component registers with one
   line via `useTuning`. You drag sliders, watch the scene update, then **save them
   to the config file** — and they ship to everyone.
2. The **scene controls** — camera mode + live pose readout (the positioning
   workflow), scene-debug toggles, the ASCII post-process params, the colored
   lights, and the per-scene camera / head / spotlight **keyframe editors**. These
   are real runtime config held in `stores/SceneControl.ts` (plus `stores/sections.ts`
   for the camera/head keyframes and `stores/spotlights.ts` for the rig); the panel
   is just their editing surface.

The subsections below describe the generic tuning layer (#1). The scene-control
editors (#2) are covered under [Components](#components), [Scroll-driven
spotlights](#scroll-driven-spotlights), and [Head keyframes](#head-keyframes) —
note that unlike tuned values, keyframe edits are **not** persisted to the config
file; you **copy** them to code (`registry.ts` / `spotlights.ts`) to ship.

> **`tuning.config.json` is the deployed source of truth.** Tuned values live in a
> committed JSON file that ships in the build, so **every visitor sees the same
> values — no per-user calibration.** Precedence when a component reads a value:
>
> ```
> localStorage (dev scratchpad)  →  tuning.config.json (committed)  →  inline default (fallback)
> ```
>
> - **inline default** — the value passed to `useTuning(...)` in the component;
>   the factory fallback if the config file has nothing for that key.
> - **`tuning.config.json`** — what you've *saved* from the panel; what production
>   reads. Commit it to deploy.
> - **`localStorage` (`fab:tuning`)** — dev-only scratch: your in-progress drags,
>   not yet saved. Cleared on save. **This layer is why a tuned value can look
>   different in dev vs the deployed site** — until you hit *save to config file*.
>
> In production there is no store, panel, or `localStorage` — components read the
> config file (or the inline default), at zero runtime cost.

### Files

| File | Role |
| --- | --- |
| `tuning.config.json` | **The committed source of truth.** `group → key → value`, written by the panel's *save*, read by `useTuning` (dev + prod). Commit it to ship. |
| `server/api/_tuning.post.ts` | Dev-only Nitro route that the panel POSTs to; merges + writes `tuning.config.json` on disk. Absent in the static prod build. |
| `composables/useTuning.ts` | The API components call. Dev → store-backed; prod → plain refs reading the config file, else the inline default. |
| `stores/tuning.ts` | The dev store: registered groups/fields/values, config-file + `localStorage` precedence, `saveToFile()`. |
| `components/home/DevPanel.vue` | The DOM panel shell (⚙, top-right) + the **global / scenes** tabs + shared `.dvp-*` styles + the *save to config file* button. Mounted dev-only in `pages/index.vue` as `<HomeDevPanel>`. |
| `components/home/devpanel/*.vue` | The panel content: scene-control sections (`CameraSection`, `SceneSection`, `AsciiSection`, `LightsSection`, `SpotlightsSection`), the global `TuningGroups` list, the per-scene keyframe editors (`SceneEditor`, `SceneKeyframes` + `PoseKeyframeFields` / `SpotKeyframeFields`, `KeyframeOverview` / `OverviewGroup`), and shared renderers `TuningGroupFields` / `TuningGroupBlock`, all in a collapsible `DevPanelSection`. |
| `composables/useDevPanelGroups.ts` | Routes each tuning group to the global tab or to a scene/milestone (by set-piece name or explicit `section` tag). |
| `components/home/TuningGizmos.vue` | 3D markers for `vec3` points flagged `gizmo`. Mounted dev-only inside the canvas (`Scene3D`). |

### Using it in a component

```ts
const t = useTuning("signalField", "Signal Field"); // group id, panel label

// a number → returns Ref<number>; read p.value
const period = t.num("period", 2.6, { min: 0.5, max: 8, step: 0.1, label: "Stream period (s)" });

// a 3D point → returns a reactive { x, y, z }; read pt.x / pt.y / pt.z
const forehead = t.vec3("forehead", { x: 0, y: 0.33, z: 0.22 }, {
  min: -1, max: 1, step: 0.01,
  label: "Forehead (head-local)",
  gizmo: true,      // show a 3D marker at this point
  anchor: "head",   // doc hint: this is an offset from the head, not world space
});

// also: t.color("c", "#00ff9c"), t.bool("on", true)
```

Read the handles wherever you need them — including inside a `useLoop`
render callback (reading a reactive value per frame is fine; it's just a number).
The first arg of every method is a **stable key** (used for persistence + the
config-file lookup); the value you pass is the inline fallback default.

### The panel

- Toggle with the **⚙** button (top-right). Closed by default so it never covers
  the scene.
- Each registered group is a section with sliders / x-y-z controls / colour /
  checkbox, plus:
  - **copy** — puts the group's current values on the clipboard as JSON (handy for
    diffs / pasting elsewhere).
  - **reset** — restores the committed baseline (config-file value, else the inline
    default).
- **save to config file** (panel footer) — writes *all* current values to
  `tuning.config.json` via the dev server, then clears the `localStorage` scratch.
  This is the step that makes dev == deployed.
- Edits persist to `localStorage` (`fab:tuning`) as you drag, so reloads keep your
  in-progress tweaks until you save, reset, or clear storage.

### Tabs: global vs. scenes

The panel body has two tabs:

- **global** — the scene-wide tools: camera, ASCII, scene-debug, lights, spotlight
  globals, and any tuning group that isn't tied to a scene (e.g. *Head addressing*).
- **scenes** — one row per scroll section, **sourced live from `SECTION_DEFS`
  (`registry.ts`)** — so adding/removing a section there updates this list
  automatically; there is **nothing to maintain in the panel by hand.** It's a
  single-open accordion that *follows the scroll*: the section you're scrolled to
  auto-opens (and you can click any other open). Each row shows the section's
  camera pose, accent, set-pieces, its camera / head / spotlight keyframes, and the
  tuning groups that belong to it.
  - **The biography section ("the path so far") expands into its individual
    milestones** (`content/biography/*.md`), each a sub-beat with its own
    set-piece; scrolling through the section follows down to the active milestone.

#### How a tuning group lands under a scene

You don't tag scenes by hand. Routing (see `composables/useDevPanelGroups.ts`):

1. **Set-pieces — name the group after the set-piece.** A group whose **id equals
   a set-piece name** (`useTuning("lattice", "Lattice")` ↔ `setPiece: ["lattice"]`)
   shows up beside **every** section/milestone that renders that set-piece. This is
   the normal case — the section↔set-piece mapping already lives in `registry.ts` /
   the milestone frontmatter, so the panel reuses it.
2. **Non-set-piece groups — pass a section id** as the third arg of `useTuning`
   (`useTuning("headAddress", "Head addressing", "contact")`) to pin the group to
   that scene's id (`registry.ts`).
3. **Everything else is global** (no section id, not a set-piece used anywhere).

> So to make a set-piece tunable, add `useTuning` calls inside its component and
> name the group after the set-piece — its controls appear under the right
> milestone(s) with no extra wiring. `SignalField` and `BerlinSkyline` are wired
> up (the latter exposes its horizon anchor as a gizmo, plus stage scale and
> cursor parallax, under the Berlin milestone); the other set-pieces (`Lattice`,
> `RouteArc`, `ThreadBoard`, `DocumentGrid`, `StaffLines`) still carry hard-coded
> constants ripe for this treatment.

### Workflow

1. Run the dev server, scroll to the beat you're tuning.
2. Open **⚙**, drag the relevant sliders, watch it update live (3D `gizmo` points
   show a marker; many values also self-visualize — e.g. the finale rings).
3. Hit **save to config file** — `tuning.config.json` updates on disk.
4. **Commit `tuning.config.json`.** That's what production reads, so the deployed
   site now matches what you tuned (no per-visitor calibration).

### Anchoring patterns (don't tune absolute world coords)

Static world coordinates fight anything that moves. Prefer **relative** anchors;
the finale (`SignalField`) uses both:

- **Model-relative** — store an offset and transform it by an object's live world
  matrix each frame, so it follows that object's rotation/float:

  ```ts
  const head = scene.value?.getObjectByName("headGroup"); // tag the group's name
  head?.updateWorldMatrix(true, false);
  worldPoint.set(offset.x, offset.y, offset.z).applyMatrix4(head.matrixWorld);
  ```

- **Screen-relative** — publish a DOM element's on-screen position as NDC and
  project it into the scene through the camera, so it tracks the element across
  viewport/scroll:

  ```ts
  // publisher (DOM component): useElementBounding -> NDC -> store
  store.setContactAnchor({ x: (px / vw) * 2 - 1, y: -((py / vh) * 2 - 1) });

  // consumer (in-canvas): NDC -> ray -> plane intersection
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, outWorldPoint);
  ```

In both cases the **tunable value is the small relative offset/nudge**, not the
absolute position — so a good value stays good as the scene moves. This is the same
anchor discipline the spotlight rig and `SignalField` follow at runtime (see
[The finale (contact)](#the-finale-contact)).

### Zero production cost

`useTuning` checks `import.meta.dev`. In production it returns plain refs of the
config-file value (or the inline default) and never imports the store, so
`DevPanel`/`TuningGizmos` (mounted behind `v-if="isDev"`) never instantiate it.
Nothing to strip manually.

---

## How to…

### …add or reorder a section

Edit `components/home/sections/registry.ts`: add a `SectionDef` (pick an `order`
between two existing ones; choose `cameraPosition`/`cameraRotation` to continue
the arc; set `weight`, `setPiece`, `mode`, and the `component`). The camera path,
scroll length, set-pieces and rendering all derive from it.

### …add a biography milestone

Create `content/biography/NN-slug.md` with the frontmatter (title, subtitle,
order, location, side, setPiece). It joins the biography cluster automatically —
and because the chapter's choreography is generated from the same card layout,
its `side` / `accent` / `offset` also re-derive the head's swerve and gaze, the
key/fill beats that light it, and the card's own DOM lighting. Nothing to
hand-place.

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
  [Dev Panel and tuning](#dev-panel-and-tuning)); the resting pose itself is now a head keyframe.
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
dev tuning layer — see **[Dev Panel and tuning](#dev-panel-and-tuning)**.

---

## Notes / known limitations

- **SSR is off** (`ssr: false`). The section/milestone prose is authored as real
  DOM, so it is **SSG-ready**, but only prerenders to indexable HTML once SSR/SSG
  is enabled (issue #5). Until then the 3D canvas is `<ClientOnly>` so it never
  runs during prerender.
- Camera anchors are derived from section **weights**, while the DOM cards sit at
  pixel positions; because progress is a fraction of *max scroll* (document minus
  one viewport) the two align closely but not exactly — good enough that the
  camera "settles" as each card centers. Where a section needs its beats to land
  inside the window where its stage is actually *pinned*, absorb the offset in the
  section's own layout constants (`BIO_TOP_PAD`/`BIO_RANGE`,
  `SKILLS_TOP_PAD`/`SKILLS_RANGE`) rather than in each keyframe.
- **Never bind `usePreferences().reducedMotion` straight into a template.** It
  reads localStorage, so it is `false` during SSR and can be `true` on the
  client's first render — and Vue only *warns* about class/style hydration
  mismatches, it does not repair them, so the DOM silently keeps the server's
  version. Gate it behind an `onMounted` flag (see `SkillsSection.vue`'s `still`)
  so the first client render matches the server and the swap lands as a normal
  update. Reading it inside the render loop (as `Scene3D` does) is fine.
- In dev, the TresJS devtools performance panel logs a one-off
  `Cannot read properties of undefined (reading 'count')` while traversing the
  non-indexed line geometries. It is a devtools-only path (disabled in
  `nuxt generate`) and does not affect rendering.
