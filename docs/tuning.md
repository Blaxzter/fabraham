# Dev Tuning Layer

A small, dev-only system for **live-tuning hard-to-eyeball values** — 3D anchor
points, angles, radii, timings — without editing code and reloading. You drag
sliders in a panel, watch the scene update in real time, then **copy the values
back into the typed defaults** when you're happy.

> **Code stays the source of truth.** The defaults registered in code are
> canonical and ship in the build. The panel is a dev aid that overrides them at
> runtime (persisted to `localStorage`) and exports them for pasting back. In
> production the whole thing is a **no-op** — components read their baked defaults,
> no store, no panel, no persistence, zero cost.

## Files

| File | Role |
| --- | --- |
| `composables/useTuning.ts` | The API components call. Dev → store-backed; prod → plain refs of the defaults. |
| `stores/tuning.ts` | The dev store: registered groups/fields/values, `localStorage` persistence, export. |
| `components/home/TuningPanel.vue` | The DOM panel (⚙, top-right). Mounted dev-only in `pages/index.vue`. |
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
The first arg of every method is a **stable key** (used for persistence); the
defaults you pass are what ships.

## The panel

- Toggle with the **⚙** button (top-right). Closed by default so it never covers
  the scene.
- Each registered group is a section with sliders / x-y-z controls / colour /
  checkbox, plus:
  - **copy** — puts the group's current values on the clipboard as JSON, to paste
    back into the code defaults.
  - **reset** — restores the registered defaults.
- Edits persist to `localStorage` (`fab:tuning`), so reloads keep your tweaks
  until you reset or clear storage.

## Workflow

1. Run the dev server, scroll to the beat you're tuning.
2. Open **⚙**, drag the relevant sliders, watch it update live (3D `gizmo` points
   show a marker; many values also self-visualize — e.g. the finale rings).
3. **copy** the group, paste the numbers into that component's `useTuning`
   defaults, and (optionally) **reset** / clear `localStorage`.

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
defaults and never imports the store, so `TuningPanel`/`TuningGizmos` (mounted
behind `v-if="isDev"`) never instantiate it. Nothing to strip manually.
