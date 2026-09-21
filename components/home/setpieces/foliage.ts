import type { Vector3 } from "three";

/**
 * Leaves, as line art.
 *
 * The projects vine used to grow two straight ribs per node and call them
 * foliage. They read as thorns: a rib has no silhouette, and a silhouette is
 * the entire reason a leaf is recognisable at a glance. This module draws a
 * real blade instead — margin, midrib, veins, petiole — in a LOCAL frame, so
 * the vine can stamp the same profile onto sixty different points of a curve
 * with a different size, twist and droop at each.
 *
 * Local space is deliberately normalised to a unit leaf, because the vine
 * rewrites every open blade every frame (they unfurl as the stem passes them,
 * and then they breathe). Keeping the profile in local coordinates means a
 * frame's work is one basis multiply per vertex and no trigonometry per leaf:
 *
 *   world = origin + U·(u·len) + V·(v·len·width) + W·(w·len + droop·u²·len)
 *
 *   u — along the leaf, 0 at the stem, 1 at the tip
 *   v — across it, ± the half-width profile
 *   w — out of the blade's plane (the cup), plus the runtime droop
 *
 * The `width` factor is what makes the unfurl read: a young leaf is written at
 * width ≈ 0.1 — rolled up along its own midrib, which is how a leaf actually
 * opens — and widens to 1 as it matures.
 */

/** Segments in one blade: 18 of margin, 3 of midrib, 4 veins, 1 petiole. */
export const LEAF_SEGMENTS = 26;
/** Floats one blade occupies in a segment buffer (2 vertices × 3 per segment). */
export const LEAF_FLOATS = LEAF_SEGMENTS * 6;

/** Where the blade starts; below this the leaf is stalk. */
const PETIOLE = 0.15;
/**
 * Samples per side of the margin.
 *
 * Was 6, which is where the first version's leaves got their faceted, shard-like
 * look: at nine chords for a whole outline the widest part of the blade turns
 * into a pair of straight cuts, and the eye reads a crystal rather than a leaf.
 * The margin is the ONLY part of a leaf that carries its identity, so it is the
 * last place to save segments.
 */
const SIDE = 9;

export interface LeafShape {
  /** (u,v,w) per vertex, `LEAF_SEGMENTS * 2` of them. */
  local: Float32Array;
}

/**
 * One blade profile.
 *
 * `width`  half-width at the widest point, as a fraction of length.
 * `sharp`  >1 pushes the widest point toward the tip (a lance), <1 toward the
 *          base (a heart). 1 is a symmetric almond.
 * `cup`    how far the margins lift out of the blade's plane. A flat leaf is a
 *          shape; a cupped one catches the light differently along its length,
 *          which is what stops sixty of them reading as stickers.
 */
export function buildLeafShape(width: number, sharp: number, cup: number): LeafShape {
  const local = new Float32Array(LEAF_SEGMENTS * 6);
  let o = 0;

  /** The margin at blade-fraction s (0 base → 1 tip), on side ±1. */
  const halfWidth = (s: number) =>
    width * Math.pow(Math.sin(Math.PI * Math.pow(s, sharp)), 0.85);
  const uOf = (s: number) => PETIOLE + (1 - PETIOLE) * s;
  const put = (u: number, v: number, w: number) => {
    local[o++] = u;
    local[o++] = v;
    local[o++] = w;
  };
  const edge = (s: number, side: number) => {
    const hw = halfWidth(s);
    put(uOf(s), side * hw, cup * (hw / width) * (hw / width));
  };

  // Margin: base → tip up one side, tip → base down the other. Drawn as
  // consecutive segments so the outline closes.
  for (const side of [1, -1]) {
    for (let i = 0; i < SIDE; i++) {
      const a = side > 0 ? i / SIDE : 1 - i / SIDE;
      const b = side > 0 ? (i + 1) / SIDE : 1 - (i + 1) / SIDE;
      edge(a, side);
      edge(b, side);
    }
  }

  // Midrib, in three segments so the droop bends it rather than tilting it.
  for (let i = 0; i < 3; i++) {
    put(uOf(i / 3), 0, 0);
    put(uOf((i + 1) / 3), 0, 0);
  }

  // Veins: off the midrib, angled toward the tip, stopping short of the margin.
  for (const s of [0.26, 0.54]) {
    for (const side of [1, -1]) {
      const s2 = Math.min(0.97, s + 0.26);
      put(uOf(s), 0, 0);
      const hw = halfWidth(s2) * 0.78;
      put(uOf(s2), side * hw, cup * (hw / width) * (hw / width) * 0.7);
    }
  }

  // Petiole: the stalk from the stem's surface to the blade's base.
  put(0, 0, 0);
  put(PETIOLE, 0, 0);

  return { local };
}

/**
 * Stamp one blade into a segment buffer.
 *
 * `at` is a FLOAT offset (leaf index × `LEAF_FLOATS`). The basis vectors are
 * expected to be unit-length and roughly orthogonal; the vine builds them from
 * the curve's own parallel-transported frame, so they are.
 */
export function writeLeaf(
  out: Float32Array,
  at: number,
  shape: LeafShape,
  origin: Vector3,
  U: Vector3,
  V: Vector3,
  W: Vector3,
  len: number,
  width: number,
  droop: number
) {
  const l = shape.local;
  for (let i = 0; i < l.length; i += 3) {
    const lu = l[i]!;
    const u = lu * len;
    const v = l[i + 1]! * len * width;
    const w = (l[i + 2]! + droop * lu * lu) * len;
    out[at + i] = origin.x + U.x * u + V.x * v + W.x * w;
    out[at + i + 1] = origin.y + U.y * u + V.y * v + W.y * w;
    out[at + i + 2] = origin.z + U.z * u + V.z * v + W.z * w;
  }
}

/**
 * Collapse a blade to a point.
 *
 * Kept only as a warning, and deliberately not used by `ProjectVine` any more.
 *
 * The idea is borrowed from `createLinkPool`, whose unused slots collapse to a
 * point "which draws nothing" — and that is true of a native GL line. It is NOT
 * true of a fat one. `LineSegments2` expands every segment into a quad and caps
 * the ends, so a segment of zero length renders as a round dot `linewidth`
 * across. Collapsing a whole leaf stacks `LEAF_SEGMENTS` of those on one point,
 * additively, which is a bright speck rather than nothing at all.
 *
 * If a blade must be hidden, do not park it: leave it out of the draw. The vine
 * sorts its leaves by the moment they open so the visible ones are a prefix, and
 * sets `instanceCount` to cover just that prefix.
 */
export function collapseLeaf(out: Float32Array, at: number, origin: Vector3) {
  for (let i = 0; i < LEAF_FLOATS; i += 3) {
    out[at + i] = origin.x;
    out[at + i + 1] = origin.y;
    out[at + i + 2] = origin.z;
  }
}
