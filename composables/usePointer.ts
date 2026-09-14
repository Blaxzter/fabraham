import { getCurrentScope, onScopeDispose, shallowRef } from "vue";

/**
 * The cursor, normalised to -1..1 across the viewport — shared by everything in
 * the scene that reacts to it (the head's addressing parallax in `Scene3D`, the
 * Berlin skyline's depth parallax, …).
 *
 * This used to be a private `shallowRef` + its own `mousemove` handler inside
 * `Scene3D`, which meant a second consumer implied a second listener and a
 * second `innerWidth`/`innerHeight` read per pointer move. The state is now
 * module-level and there is exactly **one** listener for the whole app.
 *
 * The viewport size is read in the *handler*, not in the render loop: a layout
 * read per pointer move is fine, one per frame is not (issue #4). Consumers read
 * `pointer.value.x / .y` — two numbers — wherever they like, including inside a
 * `useLoop` callback.
 *
 * **Both sign conventions matter, and they are not symmetrical** (the same trap
 * the head keyframes document):
 *   - `x` → `-1` at the left edge, `+1` at the right.
 *   - `y` → `-1` at the **top**, `+1` at the bottom — *screen* space, not world
 *     space. Mapping it to anything that points up in the scene needs a sign flip.
 *
 * `mousemove` (not `pointermove`) on purpose: touch/pen would otherwise teleport
 * the value on every tap, which reads as a glitch on the head's parallax.
 */
const pointer = shallowRef({ x: 0, y: 0 });

let refs = 0;
let listening = false;

const onMove = (event: MouseEvent) => {
  // Replace rather than mutate: consumers hold a shallowRef, so a new object is
  // what makes reads reactive. Two numbers per move, no allocation per frame.
  pointer.value = {
    x: (event.clientX / window.innerWidth) * 2 - 1,
    y: (event.clientY / window.innerHeight) * 2 - 1,
  };
};

const release = () => {
  refs = Math.max(0, refs - 1);
  if (refs > 0 || !listening) return;
  window.removeEventListener("mousemove", onMove);
  listening = false;
};

export function usePointer() {
  if (import.meta.client && !listening) {
    window.addEventListener("mousemove", onMove, { passive: true });
    listening = true;
  }
  // The listener's lifetime is tied to its consumers: it detaches with the last
  // one, so nothing stays bound to a page that has gone away. Called outside a
  // component/effect scope there is nothing to release it and it simply lives
  // for the session — harmless, it is a single handler.
  if (import.meta.client && getCurrentScope()) {
    refs++;
    onScopeDispose(release);
  }
  return { pointer };
}
