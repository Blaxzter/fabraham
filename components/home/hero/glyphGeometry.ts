import { Box3, Vector3 } from "three";
import type { BufferGeometry } from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import heroFont from "./heroFont.json";

/**
 * The hero name's characters, as extruded 3D geometry.
 *
 * This replaces a textured quad per character, which was the obvious build and
 * had one fatal property: a flat plane seen edge-on is a zero-area sliver, so a
 * tumbling character vanished twice per turn. No amount of `DoubleSide` fixes
 * that — the glyph has to have thickness.
 *
 * The objection to `TextGeometry` was never the class, it was REBUILDING it: the
 * hero scrambles, so the character changes several times a second, and
 * regenerating an extruded mesh at that rate would be absurd. The charset is
 * fixed and tiny, though, so every glyph it can ever show is built once here and
 * the scramble becomes `mesh.geometry = glyphs.geometryFor(...)` — a pointer
 * assignment. Nothing is generated after mount.
 *
 * The font is a subset of three's own Droid Sans Mono, cut down to these
 * characters by `scripts/make-hero-font.mjs` (186KB → 16KB) so it can be
 * imported straight into the bundle. It has to be synchronous: the geometries
 * are built on mount, and fetching a font first would mean a hero that pops in
 * a beat late.
 *
 * Contract matches the line set-pieces (`setpieces/lineArt.ts`): a factory
 * returning a disposable, deterministic object whose `dispose()` the caller MUST
 * call on unmount.
 */

/** Everything the name itself can spell. */
const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

/**
 * What an unsettled character churns through.
 *
 * Kept disjoint from the letters on purpose: a scrambling glyph must never
 * accidentally show a real letter of the name early, which is the tell that
 * makes a decode look fake.
 */
const NOISE_CHARS = "#$%&*+=<>?@[]{}|/\\^~";

/** Curve subdivision. These are ~4mm tall on screen and then re-sampled onto a
 *  character grid by the ASCII pass, so smoothness past this is invisible. */
const CURVE_SEGMENTS = 2;

export interface GlyphGeometrySet {
  /** Geometry for a character of the name. `null` for a space (nothing to draw). */
  geometryFor: (ch: string) => BufferGeometry | null;
  /** A noise glyph, deterministic in (seed, step) — see the note in HeroGlyphs. */
  noiseFor: (seed: number, step: number) => BufferGeometry;
  dispose: () => void;
}

const font = new Font(heroFont);

/**
 * Build one geometry per character.
 *
 * `depth` is in the same units as the glyph height (1), so it is a RATIO: the
 * caller scales the whole mesh, and the extrusion scales with it.
 */
export const createGlyphGeometries = (depth = 0.22): GlyphGeometrySet => {
  const cache = new Map<string, BufferGeometry>();
  const box = new Box3();
  const centre = new Vector3();

  const build = (ch: string): BufferGeometry | null => {
    if (ch === " ") return null;
    const geo = new TextGeometry(ch, {
      font,
      size: 1,
      depth,
      curveSegments: CURVE_SEGMENTS,
      bevelEnabled: false,
    });

    // Centre on the glyph's own box in X and Z, so a character spins about
    // itself rather than about its baseline origin — an off-centre pivot is what
    // makes a tumble look like a wobble. Y is centred on a SHARED reference
    // (below) so swapping characters never makes the line hop.
    geo.computeBoundingBox();
    box.copy(geo.boundingBox!);
    box.getCenter(centre);
    geo.translate(-centre.x, 0, -centre.z);
    return geo;
  };

  // The vertical reference every glyph is centred against: cap height, measured
  // once from a full-height letter. Using each glyph's own box instead would sit
  // a "." on the same centre line as an "A" and the name would jitter as
  // characters churned.
  const reference = new TextGeometry("H", {
    font,
    size: 1,
    depth,
    curveSegments: CURVE_SEGMENTS,
    bevelEnabled: false,
  });
  reference.computeBoundingBox();
  const capMid = (reference.boundingBox!.max.y + reference.boundingBox!.min.y) * 0.5;
  reference.dispose();

  for (const ch of NAME_CHARS + NOISE_CHARS) {
    const geo = build(ch);
    if (geo) {
      geo.translate(0, -capMid, 0);
      cache.set(ch, geo);
    }
  }

  const noise: BufferGeometry[] = [];
  for (const ch of NOISE_CHARS) {
    const geo = cache.get(ch);
    if (geo) noise.push(geo);
  }

  return {
    geometryFor: (ch) => cache.get(ch) ?? null,
    noiseFor: (seed, step) => {
      // Deterministic in (seed, step): the hero is scrubbed, and a glyph that
      // rolled fresh randomness every frame would un-scramble into different
      // noise than it scrambled from.
      const i = Math.abs(Math.imul(seed * 131 + step * 7919 + 5, 2246822507)) % noise.length;
      return noise[i]!;
    },
    dispose: () => {
      for (const geo of cache.values()) geo.dispose();
      cache.clear();
      noise.length = 0;
    },
  };
};
