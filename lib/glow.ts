import { CanvasTexture } from "three";

/**
 * A soft radial falloff, drawn into a canvas — the sprite map every glowing
 * thing in the scene is built from (the cursor orb and its sparks, the coda's
 * planets).
 *
 * White, so each material's `color` (or, for a point cloud, its vertex colour)
 * is what tints it: a core keeps it nearly white, a halo takes the accent, and
 * additive blending stacks them into a hot centre with a coloured bloom. A flat
 * `MeshBasicMaterial` sphere would just be a disc of one colour — no falloff,
 * and a hard-edged disc is the one thing an ASCII ramp can make nothing of.
 *
 * The stops matter as much as the shape. Everything drawn with this goes through
 * the ASCII pass, where a glyph is chosen from a cell's luminance: the long,
 * shallow tail from 0.34 out to 1.0 is what gives the ramp something to walk
 * DOWN, so a glow resolves as a dense core thinning into sparser characters
 * rather than as a single blob of the same glyph.
 *
 * A FACTORY, not a shared instance, on purpose: the texture is ~64KB and every
 * consumer disposes what it made on unmount. A module-level singleton would mean
 * the first component to unmount disposes the texture the others are still
 * drawing with — a bug that only shows up on the route change that tears one of
 * them down.
 *
 * Returns `null` during SSR (there is no canvas); callers pass that straight to
 * a material's `map`, which is the same as having no map until the client takes
 * over.
 */
export const createGlowTexture = (): CanvasTexture | null => {
  if (!import.meta.client) return null;
  const px = 128;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.88)");
  g.addColorStop(0.34, "rgba(255,255,255,0.26)");
  g.addColorStop(0.68, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  return new CanvasTexture(canvas);
};
