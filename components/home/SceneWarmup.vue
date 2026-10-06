<script setup lang="ts">
import { useLoop, useTresContext } from "@tresjs/core";
import type { EffectComposer } from "postprocessing";
import type { Material } from "three";

/**
 * Compiles the scene's shaders behind the boot screen, then reports the scene
 * ready.
 *
 * three compiles a program the first time something that needs it is DRAWN, and
 * almost nothing in this scene is drawn at the top of the page: every set-piece
 * is hidden until its chapter, the orb until the finale, the planets until the
 * coda. Left alone, a dozen programs were compiled one by one down the scroll,
 * each on the frame its piece first appeared. On a desktop GPU that is a few
 * milliseconds a time; on an integrated one, going through ANGLE's shader
 * translation, each is a visible hitch on exactly the beat the piece enters.
 *
 * So everything is compiled once, here, while the POST screen is still showing
 * "Compiling shaders...", and the boot's handover waits for it (`sceneReady`).
 *
 * The details that make it the SAME programs the frame will ask for: a program
 * is keyed on the number of lights the pass sees and on whether it renders to
 * the canvas or to a buffer, for every material, lit or not. So each pass is
 * compiled the way it is drawn:
 *
 *   - the overlay (the set-pieces): to the canvas, on a layer no light is on;
 *   - the lit pass (head, backdrop, orb, planets, beams): into the composer's
 *     buffer, on layer 0 with the lights;
 *   - the head once more as transparent, which is what its fade switches to.
 *
 * Programs are shared between materials of the same kind, so pieces that build
 * their geometry later (the skyline's SVG, the stack's logos) find theirs here.
 */
const props = defineProps<{ composer: EffectComposer | null }>();

const bootState = useBootStateStore();
const { scene, renderer } = useTresContext();
const rawCamera = useRawCamera();

/** Any layer without a light on it; this is the overlay's own (SceneSetPieces). */
const OVERLAY_LAYER = 1;
/** Frames to let the scene draw first, so its late children are mounted. */
const SETTLE_FRAMES = 3;
/** The boot waits on this. A stuck compile must not be able to hold it. */
const GIVE_UP_MS = 4000;

// The renderer and the scene come back from TresJS typed against the other of
// @types/three's two Object3D declarations (the quirk SceneSetPieces documents),
// so the few calls here go through a structural handle.
interface Layers {
  mask: number;
  set(layer: number): void;
  test(layers: Layers): boolean;
}
interface Node3D {
  name: string;
  layers: Layers;
  children: Node3D[];
  material?: Material | Material[];
  getObjectByName(name: string): Node3D | undefined;
  traverse(fn: (o: Node3D) => void): void;
}
interface Compiler {
  compileAsync?(object: Node3D, camera: unknown, scene: Node3D): Promise<unknown>;
  getRenderTarget(): unknown;
  setRenderTarget(target: unknown): void;
}

const compileAll = (): Promise<unknown> => {
  const gl = renderer.instance as unknown as Compiler | null;
  const scn = scene.value as unknown as Node3D | null;
  const cam = rawCamera() as unknown as { layers: Layers } | undefined;
  const composer = props.composer;
  if (!gl?.compileAsync || !scn || !cam || !composer) return Promise.resolve();

  const mask = cam.layers.mask;
  const target = gl.getRenderTarget();
  const jobs: Promise<unknown>[] = [];
  try {
    const pieces = scn.getObjectByName("setPieces");
    if (pieces) {
      gl.setRenderTarget(null);
      cam.layers.set(OVERLAY_LAYER);
      jobs.push(gl.compileAsync(pieces, cam, scn));
    }

    gl.setRenderTarget(composer.inputBuffer);
    cam.layers.set(0);
    for (const child of scn.children) {
      // The hero name is on a layer of its own and drawn from the first frame.
      if (child === pieces || !child.layers.test(cam.layers)) continue;
      jobs.push(gl.compileAsync(child, cam, scn));
    }

    const head = scn.getObjectByName("headGroup");
    if (head) {
      const flipped: [Material, boolean][] = [];
      head.traverse((o) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          flipped.push([m, m.transparent]);
          m.transparent = !m.transparent;
          m.needsUpdate = true;
        }
      });
      jobs.push(gl.compileAsync(head, cam, scn));
      for (const [m, was] of flipped) {
        m.transparent = was;
        m.needsUpdate = true;
      }
    }
  } finally {
    cam.layers.mask = mask;
    gl.setRenderTarget(target);
  }
  return Promise.all(jobs);
};

const warm = async () => {
  try {
    await Promise.race([compileAll(), new Promise((resolve) => setTimeout(resolve, GIVE_UP_MS))]);
  } catch (error) {
    // Nothing is lost but the head start: the programs compile on first use.
    if (import.meta.dev) console.warn("[scene] shader warm-up failed", error);
  }
  bootState.markSceneReady();
};

let frames = 0;
let started = false;
const { onRender } = useLoop();
onRender(() => {
  if (started || !props.composer) return;
  if (++frames < SETTLE_FRAMES) return;
  started = true;
  warm();
});
</script>

<template>
  <!-- Nothing to draw: this exists for its place in the render loop. -->
  <slot />
</template>
