import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  Points,
  ShaderMaterial,
} from "three";
import type { ColorRepresentation } from "three";

/**
 * Shared vocabulary for the line-art set-pieces.
 *
 * Every backdrop in the scene is built from the same three moves, and before
 * this module each one carried its own copy of them (five separate
 * `mulberry32`s, five hand-rolled `PointsMaterial`s, five different ideas of
 * what "fade in" means). They are collected here so a change of house style —
 * how a dot looks, how a piece assembles — happens once:
 *
 *   1. **Deterministic layout.** `mulberry32` / `hash01`: a piece looks
 *      hand-placed but is identical on every reload, so it can be art-directed.
 *   2. **Draw-on, not fade-in.** `drawFraction` walks a geometry's own vertex
 *      buffer with `setDrawRange` — the 3D equivalent of animating
 *      `stroke-dashoffset`. Because the pieces are driven by SCROLL
 *      (`cardProgress`, see SceneSetPieces) rather than by time, scrolling back
 *      up un-draws them. The order segments are written in IS the animation, so
 *      `orderSegments` sorts them once, at build time.
 *   3. **Dots that are dots.** `createDots` replaces `PointsMaterial`, which
 *      draws flat squares of one fixed size — the single biggest reason the
 *      graph pieces read as cheap. These are round, soft-edged, sized per point
 *      (so a graph can have hubs and leaves) and carry a per-point `glow` the
 *      pieces drive to light individual nodes.
 *
 * Everything is additive with `depthWrite: false`, matching the rest of the
 * set-piece layer, and every factory returns a `dispose()` the caller must call
 * on unmount (set-piece contract — see docs/scroll-3d-architecture.md).
 */

// ---------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------

/** Deterministic PRNG, so a "scattered" layout is the same on every reload. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Stable string to 0..1, for per-part phases that must not drift across reloads. */
export const hash01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

/** Ease used for anything that ARRIVES: fast out of the gate, settling in. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** Shortest distance on a wrapped [0,1] axis (a looping sweep, a playhead). */
export const wrapDist = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return d < 0.5 ? d : 1 - d;
};

/** Frame-rate-independent lerp factor: `x += (target - x) * approach(0.08, dt)`. */
export const approach = (rate: number, delta: number) =>
  1 - Math.pow(1 - rate, delta * 60);

// ---------------------------------------------------------------------------
// Draw-on
// ---------------------------------------------------------------------------

/**
 * Reveal `t` (0..1) of a LineSegments' buffer. `setDrawRange` counts VERTICES
 * and LineSegments eats them in pairs, so the count is always rounded to an
 * even number — an odd one drops the segment being drawn and the assembly
 * stutters.
 */
export const drawFraction = (
  geo: BufferGeometry,
  vertexCount: number,
  t: number
) => {
  geo.setDrawRange(0, Math.floor((vertexCount / 2) * clamp01(t)) * 2);
};

/**
 * Reorder a flat `[ax,ay,az, bx,by,bz, …]` segment buffer by a key taken from
 * each segment's midpoint, so `drawFraction` walks it in a deliberate order:
 * a horizon drawn left to right, a building grown bottom-up, a graph assembled
 * outward from its centre.
 */
export const orderSegments = (
  src: Float32Array,
  key: (mx: number, my: number, mz: number, index: number) => number
) => {
  const n = src.length / 6;
  const keys = new Float32Array(n);
  const order = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    keys[i] = key(
      (src[o]! + src[o + 3]!) / 2,
      (src[o + 1]! + src[o + 4]!) / 2,
      (src[o + 2]! + src[o + 5]!) / 2,
      i
    );
    order[i] = i;
  }
  order.sort((a, b) => keys[a]! - keys[b]!);
  const out = new Float32Array(src.length);
  for (let i = 0; i < n; i++) {
    out.set(src.subarray(order[i]! * 6, order[i]! * 6 + 6), i * 6);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Line fields
// ---------------------------------------------------------------------------

export interface LineField {
  lines: LineSegments;
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  /** xyz per vertex — writable for fields that move (`attr.needsUpdate = true`). */
  position: Float32Array;
  attr: BufferAttribute;
  vertexCount: number;
  dispose(): void;
}

/** A static or mutable set of line segments in the house style. */
export const createLines = (
  positions: Float32Array,
  opts: { color: ColorRepresentation; opacity?: number }
): LineField => {
  const geometry = new BufferGeometry();
  const attr = new BufferAttribute(positions, 3);
  geometry.setAttribute("position", attr);
  const material = new LineBasicMaterial({
    color: new Color(opts.color),
    transparent: true,
    opacity: opts.opacity ?? 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const lines = new LineSegments(geometry, material);
  lines.frustumCulled = false; // drawn in the overlay pass, not on the main camera
  return {
    lines,
    geometry,
    material,
    position: positions,
    attr,
    vertexCount: positions.length / 3,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
};

/**
 * A fixed-size pool of segments whose ENDPOINTS are rewritten every frame — the
 * live wires a piece flashes on top of its static structure (a retrieval's
 * matched edges, a citation beam, the pulse travelling a string). Unused slots
 * collapse to a point, which draws nothing.
 */
export interface LinkPool extends LineField {
  capacity: number;
  /** Reset the write cursor. Call once per frame, before any `push`. */
  begin(): void;
  push(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number
  ): void;
  /** Collapse the unwritten remainder and upload. */
  end(): void;
}

export const createLinkPool = (
  capacity: number,
  opts: { color: ColorRepresentation; opacity?: number }
): LinkPool => {
  const field = createLines(new Float32Array(capacity * 6), opts);
  let cursor = 0;
  return {
    ...field,
    capacity,
    begin() {
      cursor = 0;
    },
    push(ax, ay, az, bx, by, bz) {
      if (cursor >= capacity) return;
      const o = cursor++ * 6;
      const p = field.position;
      p[o] = ax;
      p[o + 1] = ay;
      p[o + 2] = az;
      p[o + 3] = bx;
      p[o + 4] = by;
      p[o + 5] = bz;
    },
    end() {
      field.position.fill(0, cursor * 6);
      field.attr.needsUpdate = true;
    },
  };
};

// ---------------------------------------------------------------------------
// Dots
// ---------------------------------------------------------------------------

/**
 * Round, soft, per-point-sized dots.
 *
 * `PointsMaterial` draws an untextured point as a hard SQUARE at one size for
 * the whole field, which is most of why a scatter of nodes reads as programmer
 * art. This is the smallest shader that fixes both: a radial falloff for the
 * shape, a `size` attribute so a graph can show hierarchy, and a `glow`
 * attribute the piece drives per node — a lit node both brightens and warms
 * toward `hot`, which is what makes "these three nodes matched" legible.
 *
 * `uScale` carries the drawing buffer height so size attenuates with distance
 * the way `PointsMaterial`'s `sizeAttenuation` does (three uses height / 2);
 * `setDotScale` is the one place that convention lives.
 */
export interface DotField {
  points: Points;
  geometry: BufferGeometry;
  material: ShaderMaterial;
  count: number;
  position: Float32Array;
  size: Float32Array;
  glow: Float32Array;
  posAttr: BufferAttribute;
  sizeAttr: BufferAttribute;
  glowAttr: BufferAttribute;
  /** Upload whatever this frame wrote (position + glow by default). */
  flush(opts?: { position?: boolean; size?: boolean; glow?: boolean }): void;
  dispose(): void;
}

const DOT_VERT = /* glsl */ `
attribute float size;
attribute float glow;
uniform float uScale;
varying float vGlow;
void main() {
  vGlow = glow;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.0001, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const DOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uOpacity;
varying float vGlow;
void main() {
  // gl_PointCoord is 0..1 across the sprite; r is 0 at the centre, 1 at the rim.
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  // A tight core inside a wide halo: additive blending turns the overlap into a
  // bloom, so a lit node reads as a light source and not as a bigger square.
  float core = smoothstep(1.0, 0.15, r);
  float halo = pow(1.0 - r, 2.5);
  vec3 tint = mix(uColor, uHot, vGlow);
  float a = uOpacity * (core * (0.45 + 0.55 * vGlow) + halo * (0.25 + 0.75 * vGlow));
  if (a <= 0.002) discard;
  gl_FragColor = vec4(tint, a);
}
`;

export const createDots = (
  count: number,
  opts: {
    color: ColorRepresentation;
    /** Colour a fully-lit (`glow` = 1) dot warms to. Defaults to white. */
    hot?: ColorRepresentation;
    opacity?: number;
  }
): DotField => {
  const position = new Float32Array(count * 3);
  const size = new Float32Array(count).fill(1);
  const glow = new Float32Array(count);

  const geometry = new BufferGeometry();
  const posAttr = new BufferAttribute(position, 3);
  const sizeAttr = new BufferAttribute(size, 1);
  const glowAttr = new BufferAttribute(glow, 1);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("size", sizeAttr);
  geometry.setAttribute("glow", glowAttr);

  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(opts.color) },
      uHot: { value: new Color(opts.hot ?? "#ffffff") },
      uOpacity: { value: opts.opacity ?? 0 },
      uScale: { value: 400 },
    },
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    geometry,
    material,
    count,
    position,
    size,
    glow,
    posAttr,
    sizeAttr,
    glowAttr,
    flush(o) {
      if (!o || o.position !== false) posAttr.needsUpdate = true;
      if (o?.size) sizeAttr.needsUpdate = true;
      if (!o || o.glow !== false) glowAttr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
};

/** Point size attenuates against the drawing buffer height (three's convention). */
export const setDotScale = (field: DotField, heightPx: number) => {
  field.material.uniforms.uScale!.value = Math.max(1, heightPx) * 0.5;
};

/** The props every milestone backdrop takes (see SceneSetPieces). */
export interface SetPieceProps {
  /** The bloom: 0 → 1 → 0 as the beat passes. Owns the piece's fade in/out. */
  reveal?: number;
  variant?: string;
  position?: [number, number, number];
  /** 0..1 across the beat's WHOLE scroll window, unshaped — the assembly drive. */
  cardProgress?: number;
}
