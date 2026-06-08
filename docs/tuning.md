# Dev Panel (tuning + scene controls)

A single, dev-only panel (the **⚙**, top-right of the homepage) that merges two
things:

1. The **generic tuning layer** — **live-tuning hard-to-eyeball values** (3D
   anchor points, angles, radii, timings) that any component registers with one
   line via `useTuning`. You drag sliders, watch the scene update, then **save them
   to the config file** — and they ship to everyone.
2. The **scene controls** — camera mode + live pose readout (the positioning
   workflow), scene-debug toggles, the ASCII post-process params, and the colored
   lights. These are real runtime config held in `stores/SceneControl.ts`; the
   panel is just their editing surface.

The rest of this doc describes the generic tuning layer (#1).

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

## Files

| File | Role |
| --- | --- |
| `tuning.config.json` | **The committed source of truth.** `group → key → value`, written by the panel's *save*, read by `useTuning` (dev + prod). Commit it to ship. |
| `server/api/_tuning.post.ts` | Dev-only Nitro route that the panel POSTs to; merges + writes `tuning.config.json` on disk. Absent in the static prod build. |
| `composables/useTuning.ts` | The API components call. Dev → store-backed; prod → plain refs reading the config file, else the inline default. |
| `stores/tuning.ts` | The dev store: registered groups/fields/values, config-file + `localStorage` precedence, `saveToFile()`. |
| `components/home/DevPanel.vue` | The DOM panel shell (⚙, top-right) + shared `.dvp-*` styles + the *save to config file* button. Mounted dev-only in `pages/index.vue` as `<HomeDevPanel>`. |
| `components/home/devpanel/*.vue` | The panel sections: `CameraSection`, `SceneSection`, `AsciiSection`, `LightsSection` (bound to `SceneControl`) and `TuningGroups` (the generic `useTuning` renderer), wrapped in a collapsible `DevPanelSection`. |
| `components/home/TuningGizmos.vue` | 3D markers for `vec3` points flagged `gizmo`. Mounted dev-only inside the canvas (`Scene3D`). |

## Using it in a component

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

## The panel

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

## Workflow

1. Run the dev server, scroll to the beat you're tuning.
2. Open **⚙**, drag the relevant sliders, watch it update live (3D `gizmo` points
   show a marker; many values also self-visualize — e.g. the finale rings).
3. Hit **save to config file** — `tuning.config.json` updates on disk.
4. **Commit `tuning.config.json`.** That's what production reads, so the deployed
   site now matches what you tuned (no per-visitor calibration).

## Anchoring patterns (don't tune absolute world coords)

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
absolute position — so a good value stays good as the scene moves.

## Adding zero production cost

`useTuning` checks `import.meta.dev`. In production it returns plain refs of the
config-file value (or the inline default) and never imports the store, so
`DevPanel`/`TuningGizmos` (mounted behind `v-if="isDev"`) never instantiate it.
Nothing to strip manually.
