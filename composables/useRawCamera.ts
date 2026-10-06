import { toRaw } from "vue";
import { useTresContext } from "@tresjs/core";

/**
 * The active camera as three.js made it, not as Vue wrapped it.
 *
 * TresJS keeps its cameras in a deep `ref([])`, so `camera.activeCamera.value`
 * is a reactive Proxy of the PerspectiveCamera, and every read under it goes
 * through a proxy trap: `cam.matrixWorldInverse.elements[i]` is three traps,
 * and each one wraps what it returns. That is harmless for a watcher and ruinous
 * in a render loop. Handed to `renderer.render()`, the proxy is read for every
 * object drawn (model-view matrix, layer test, uniform upload); in the skills
 * chapter, at ~480 draw calls, that was a third of the frame. `v.project(cam)`
 * per mote cost AmbientMotes ~3 ms a frame on every section of the page.
 *
 * So anything that reads the camera per frame, or passes it to three, takes it
 * from here. Call the composable in setup and the getter in the loop: which
 * camera is active can change, the unwrapping is one WeakMap lookup.
 */
export function useRawCamera() {
  const { camera } = useTresContext();
  return () => toRaw(camera.activeCamera.value);
}
