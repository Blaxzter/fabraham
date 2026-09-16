import { shallowRef } from "vue";
import { LinearFilter, WebGLRenderTarget } from "three";

/**
 * The offscreen buffer the hero name is drawn into, shared by the two halves of
 * the two-grid hero: `HeroGlyphs` writes it, `HeroAscii` reads it.
 *
 * Why a buffer and not just "more scene"
 * --------------------------------------
 * A post-process samples ONE buffer at ONE cell size. That is the whole reason
 * the name can't simply be geometry in the scene: it would land on the face's
 * grid, which is deliberately coarse for most of the hero. Rendering the name to
 * its own target lets the effect run the ASCII maths twice — once per grid — and
 * composite them in a single pass.
 *
 * It lives in a module rather than a store on purpose: this is a GPU resource,
 * not shared UI state, and Pinia has no business making it reactive (issue #4).
 * The `shallowRef` exists only so the effect component can notice the target
 * being created or resized; nothing ever reads INTO it reactively.
 */
export const glyphTarget = shallowRef<WebGLRenderTarget | null>(null);

/**
 * How far the name is into its exit, 0..1 — written by `HeroGlyphs` every frame
 * and read by the ASCII pass on the same one, where it drives the dissolve that
 * takes the name apart (`nameDissolve` in `DualGridAsciiEffect`).
 *
 * It rides with the buffer because it is the same hand-off: the name's pixels
 * and how much of the name is left are one message, sent once a frame from the
 * same place. And it is a plain object rather than a ref for the same reason the
 * buffer is not in a store — this changes with every scroll frame, and making it
 * reactive would run Vue's effect graph sixty times a second to move one float
 * into one uniform (issue #4).
 */
export const heroExit = { progress: 0 };

/**
 * Ensure the target exists at the renderer's current drawing-buffer size.
 *
 * Called every frame from the render loop, so it must be allocation-free in the
 * common case — it only touches the GPU when the size actually changed.
 */
export const ensureGlyphTarget = (
  width: number,
  height: number
): WebGLRenderTarget => {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));

  let target = glyphTarget.value;
  if (!target) {
    target = new WebGLRenderTarget(w, h, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      // No depth buffer: the name is a handful of coplanar quads drawn additively
      // with `depthWrite: false`. Nothing in here occludes anything else.
      depthBuffer: false,
      stencilBuffer: false,
    });
    glyphTarget.value = target;
    return target;
  }

  if (target.width !== w || target.height !== h) target.setSize(w, h);
  return target;
};

/** Drop the buffer. The component that created it owns this (set-piece contract). */
export const disposeGlyphTarget = () => {
  glyphTarget.value?.dispose();
  glyphTarget.value = null;
};
