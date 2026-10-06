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
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { ColorRepresentation } from "three";
import { useRenderQuality } from "~/composables/useRenderQuality";

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

/**
 * `hash01` with an avalanche — what you want for `prefix + index` seeds.
 *
 * FNV-1a XORs each character in and multiplies once, and that is the whole of it:
 * there is no final mixing step. For inputs that differ only in their last
 * character — which is exactly what `\`fy1${seed}\`` produces — the difference
 * reaches the output multiplied by the prime and nothing else scrambles it. The
 * result is not noise, it is a RAMP:
 *
 *     hash01("sr0"..."sr7")  ->  0.001 0.005 0.009 0.013 0.017 0.020 0.024 0.028
 *     hash01("fy1" + 0..14)  ->  spans 0.07 of the unit interval, total
 *
 * Read that second line again: fifteen "independent" seeded frequencies, all
 * within 7% of each other. Anything built on those moves as one — fifteen glyphs
 * bobbing at the same rate, a jitter that jitters everything the same way, a
 * seeded shuffle that returns the order it was given. It looks like a bug in
 * whatever is using the numbers, and every time it gets fixed in the wrong place.
 *
 * The finalizer is murmur3's `fmix32`, which is there for precisely this.
 *
 * `hash01` is deliberately left as it was. Every seeded layout in the set-pieces
 * is built on it and has been art-directed against the arrangement it produces —
 * fixing it in place would silently reshuffle all of them. New code, and anything
 * that actually needs its seeds decorrelated, should use this.
 */
export const rand01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
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
// Fat lines
// ---------------------------------------------------------------------------

/**
 * Lines with an actual width.
 *
 * `createLines` above cannot do this, and neither can any amount of tuning it.
 * From three's own source for `LineBasicMaterial.linewidth`:
 *
 *   > Can only be used with SVGRenderer. WebGL and WebGPU ignore this setting
 *   > and always render line primitives with a width of one pixel.
 *
 * That is a hard limit of the WebGL core profile, not a three shortcoming, and
 * it is why every set-piece in this folder is drawn in 1px hairlines. It is
 * fine — often better than fine — for a field of filaments: a latent space, a
 * signal, a wire-frame horizon all WANT to be thin. It is wrong for anything
 * that is supposed to have MASS. The projects vine spent a version braiding
 * four hairlines together to fake a thick stem, which is a workaround for this
 * exact limitation.
 *
 * `LineSegments2` is three's answer: each segment is drawn as an instanced
 * quad in the vertex shader, expanded to `linewidth` CSS pixels. A pixel width
 * is only meaningful against a resolution, but nothing here has to supply one —
 * `LineSegments2.onBeforeRender` reads it off the renderer's viewport, and
 * three keeps that viewport in CSS pixels (it is `setSize`'s arguments; the
 * device-pixel multiply happens later, on the way to GL). So a width authored
 * here is the same width on a retina screen as on a 1x one, which is the whole
 * reason to prefer this over driving the uniform by hand.
 *
 * Reach for this when a piece needs weight, and for `createLines` otherwise —
 * a hairline is one draw call and one vertex pair per segment, which is still
 * the right default for the dense fields most of these backdrops are made of.
 *
 * On a software rasteriser a fat line IS a hairline
 * ------------------------------------------------
 * The weight is paid for in the vertex shader: four runs of a long program per
 * segment, where a hairline is two runs of a trivial one. A GPU does not notice.
 * A CPU rasteriser does: the projects vine is ~18,000 segments, and drawing them
 * fat took it 75 ms a frame, five times everything else on screen put together.
 *
 * So where WebGL is being drawn on the CPU (`useRenderQuality().software`),
 * `createFatLines` hands back plain line segments behind the same interface.
 * Less is lost than it sounds, because that tier also renders at roughly half
 * the pixel ratio: one device pixel there is nearly two CSS pixels wide, which
 * is the width most of these fields ask for anyway. The thick ones (the stem's
 * core, the boughs) come out thinner, and that is the trade.
 */
export interface FatLineField {
  lines: LineSegments2 | LineSegments;
  /** `instanceCount` is the number of segments drawn, on either kind. */
  geometry: (LineSegmentsGeometry | BufferGeometry) & { instanceCount: number };
  material: LineMaterial | LineBasicMaterial;
  /** `[ax,ay,az, bx,by,bz, …]` — the live buffer. Mutate, then `flush()`. */
  position: Float32Array;
  segmentCount: number;
  /** Upload whatever this frame wrote. */
  flush(): void;
  dispose(): void;
}

export const createFatLines = (
  positions: Float32Array,
  opts: {
    color: ColorRepresentation;
    opacity?: number;
    /** CSS pixels. Needs `setLineResolution` to mean anything. */
    width?: number;
  }
): FatLineField => {
  if (useRenderQuality().software.value) return createThinLines(positions, opts);

  const geometry = new LineSegmentsGeometry();
  // `setPositions` keeps a Float32Array BY REFERENCE (it only wraps it in an
  // InstancedInterleavedBuffer, and the interleaved layout is exactly the
  // xyz/xyz pairs we already build), so the piece can keep writing into the
  // same array every frame and just flag it — no re-upload of a new buffer.
  geometry.setPositions(positions);

  const material = new LineMaterial({
    color: new Color(opts.color),
    linewidth: opts.width ?? 2,
    worldUnits: false,
    transparent: true,
    opacity: opts.opacity ?? 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const lines = new LineSegments2(geometry, material);
  lines.frustumCulled = false; // drawn in the overlay pass, not on the main camera

  return {
    lines,
    geometry,
    material,
    position: positions,
    segmentCount: positions.length / 6,
    flush() {
      const attr = geometry.getAttribute("instanceStart");
      // Setting `needsUpdate` on an InterleavedBufferAttribute forwards to the
      // shared buffer, so this covers instanceEnd too.
      if (attr) attr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
};

/**
 * `createFatLines`' stand-in on a software rasteriser: the same buffer as
 * one-pixel line segments.
 *
 * The fat geometry is instanced, and pieces reveal it by writing
 * `geometry.instanceCount`. A plain geometry has a draw range instead, so it is
 * given an `instanceCount` of its own that sets one: two vertices per segment.
 */
const createThinLines = (
  positions: Float32Array,
  opts: { color: ColorRepresentation; opacity?: number }
): FatLineField => {
  const field = createLines(positions, opts);
  const segmentCount = positions.length / 6;
  let shown = segmentCount;
  const geometry = Object.defineProperty(field.geometry, "instanceCount", {
    get: () => shown,
    set: (count: number) => {
      shown = Math.max(0, Math.min(segmentCount, Math.floor(count)));
      field.geometry.setDrawRange(0, shown * 2);
    },
  }) as BufferGeometry & { instanceCount: number };

  return {
    lines: field.lines,
    geometry,
    material: field.material,
    position: positions,
    segmentCount,
    flush() {
      field.attr.needsUpdate = true;
    },
    dispose: field.dispose,
  };
};

/**
 * `drawFraction` for fat lines.
 *
 * The geometry is INSTANCED — one instance per segment — so the draw-on is a
 * change of `instanceCount`, not of a draw range over vertices. Same idea, same
 * reversibility, different lever.
 */
export const drawFatFraction = (field: FatLineField, t: number) => {
  field.geometry.instanceCount = Math.floor(field.segmentCount * clamp01(t));
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
  /**
   * Per-point colour, multiplied into `uColor` — only on a field created with
   * `tinted: true` (everyone else pays nothing for it). Starts white, so an
   * untouched tint is `uColor` exactly.
   */
  tint?: Float32Array;
  tintAttr?: BufferAttribute;
  /** Upload whatever this frame wrote (position + glow by default). */
  flush(opts?: { position?: boolean; size?: boolean; glow?: boolean; tint?: boolean }): void;
  dispose(): void;
}

const DOT_VERT = /* glsl */ `
attribute float size;
attribute float glow;
uniform float uScale;
varying float vGlow;
#ifdef TINTED
attribute vec3 tint;
varying vec3 vTint;
#endif
void main() {
  vGlow = glow;
#ifdef TINTED
  vTint = tint;
#endif
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
#ifdef TINTED
varying vec3 vTint;
#endif
void main() {
  // gl_PointCoord is 0..1 across the sprite; r is 0 at the centre, 1 at the rim.
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  // A tight core inside a wide halo: additive blending turns the overlap into a
  // bloom, so a lit node reads as a light source and not as a bigger square.
  float core = smoothstep(1.0, 0.15, r);
  float halo = pow(1.0 - r, 2.5);
#ifdef TINTED
  vec3 tint = mix(uColor * vTint, uHot, vGlow);
#else
  vec3 tint = mix(uColor, uHot, vGlow);
#endif
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
    /** Give every point its own colour (see `DotField.tint`). */
    tinted?: boolean;
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
  const tint = opts.tinted ? new Float32Array(count * 3).fill(1) : undefined;
  const tintAttr = tint ? new BufferAttribute(tint, 3) : undefined;
  if (tintAttr) geometry.setAttribute("tint", tintAttr);

  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(opts.color) },
      uHot: { value: new Color(opts.hot ?? "#ffffff") },
      uOpacity: { value: opts.opacity ?? 0 },
      uScale: { value: 400 },
    },
    defines: opts.tinted ? { TINTED: "" } : {},
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
    tint,
    tintAttr,
    flush(o) {
      if (!o || o.position !== false) posAttr.needsUpdate = true;
      if (o?.size) sizeAttr.needsUpdate = true;
      if (!o || o.glow !== false) glowAttr.needsUpdate = true;
      if (o?.tint && tintAttr) tintAttr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
};

/**
 * Point size attenuates against the canvas height (three's convention).
 *
 * `heightPx` is the height in CSS pixels, which is what every piece has to hand,
 * and `gl_PointSize` is in DEVICE pixels. `renderScale` covers the case where
 * those have been pulled apart on purpose: a quality tier or the governor has
 * cut the canvas' pixel ratio below the display's (see `useRenderQuality`), and
 * without it every dot on the page would grow by exactly that cut. Reactive, so
 * a caller inside a `watchEffect` re-runs when the ratio changes.
 */
export const setDotScale = (field: DotField, heightPx: number) => {
  field.material.uniforms.uScale!.value =
    Math.max(1, heightPx) * 0.5 * useRenderQuality().renderScale.value;
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
