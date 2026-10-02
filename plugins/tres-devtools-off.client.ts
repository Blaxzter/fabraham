/**
 * Keep TresJS's devtools bridge idle unless it is asked for (`?tresdevtools`).
 *
 * @tresjs/core (5.2 through at least 5.9) registers it in every browser, build
 * mode notwithstanding, and its frame loop then walks the whole scene graph to
 * estimate geometry memory and posts the full context to `window.__TRES__DEVTOOLS__`
 * — every frame, for a devtools panel no visitor has. It used to die on its
 * first frame (a geometry-less mesh in Scene3D, "reading 'count'"), which is why
 * the console showed that error and also why the cost went unnoticed; with the
 * mesh fixed it would run for real, in dev as well.
 *
 * The loop returns early while that global is unset, and setup only creates it
 * when it is missing. So pinning it to `undefined` before the canvas mounts turns
 * the whole bridge into one property read per frame.
 */
export default defineNuxtPlugin(() => {
  if (import.meta.dev && new URLSearchParams(location.search).has("tresdevtools")) return;
  Object.defineProperty(window, "__TRES__DEVTOOLS__", {
    configurable: true,
    get: () => undefined,
    set: () => {},
  });
});
