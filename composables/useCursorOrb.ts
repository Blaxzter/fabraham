/**
 * Where the cursor orb is **on screen**, for anything in the scene that should
 * look at the orb rather than at the cursor.
 *
 * `CursorOrb` writes it; `Scene3D` reads it to aim the head. It is published in
 * screen space rather than as a world position because that is what the head's
 * gaze has always been driven by — the addressing parallax takes a -1..1 pair and
 * scales it by `maxYaw`/`maxPitch`, and handing it the orb's position in exactly
 * the same shape as `usePointer`'s means the whole tuned overlay keeps working
 * with the input swapped underneath it. It also puts the projection where the
 * camera has just been updated (inside the orb's own `onBeforeRender`) instead of
 * making every consumer redo it.
 *
 * **Deliberately not reactive.** This is rewritten every frame, and a `ref`
 * written at 60Hz would schedule 60 re-renders a second for values only ever read
 * inside a render loop — the thing issue #4 is about. It is a plain object,
 * mutated in place and read in place, and nothing here allocates.
 *
 * Conventions, matching `usePointer` exactly so the two are interchangeable:
 *   - `x` → `-1` at the left edge, `+1` at the right.
 *   - `y` → `-1` at the **top**, `+1` at the bottom. Screen space, not NDC and
 *     not world space (the orb does the sign flip on the way in).
 *   - `influence` → 0..1, how much of an orb there is to look at. It follows the
 *     orb's own fade, so it is 0 whenever the orb is not on screen at all
 *     (before the contact beat, under reduced motion, or with no real cursor) and
 *     consumers can blend back to the raw pointer with it.
 *
 * Write it from the orb and nowhere else; everyone else treats it as read-only.
 */
const gaze = { x: 0, y: 0, influence: 0 };

export function useCursorOrb() {
  return gaze;
}
