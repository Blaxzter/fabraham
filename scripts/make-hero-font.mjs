/**
 * Subset a typeface JSON down to the characters the hero name can display.
 *
 * Run by hand; the output is committed (same deal as `make-germany-svg.py`):
 *
 *   node scripts/make-hero-font.mjs
 *
 * Why subset at all
 * -----------------
 * `HeroGlyphs` builds one EXTRUDED geometry per character at mount, which needs
 * the glyph outlines on the client. three ships Droid Sans Mono as a typeface
 * JSON — the right face for this site, and already a dependency — but it carries
 * 591 glyphs at 188KB, and the hero can only ever show about forty of them.
 * Subsetting drops that to a few KB, which is small enough to import directly
 * into the bundle instead of fetching at runtime (the geometries are built
 * synchronously on mount; an async font fetch would mean a hero that pops in).
 *
 * The source is Apache-2.0 (see three/examples/fonts/droid/NOTICE), so the
 * subset ships the same notice alongside it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SOURCE = resolve(
  root,
  "node_modules/three/examples/fonts/droid/droid_sans_mono_regular.typeface.json"
);
const OUT = resolve(root, "components/home/hero/heroFont.json");

// Must stay a superset of NAME_CHARS + NOISE_CHARS in hero/glyphGeometry.ts.
const KEEP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 #$%&*+=<>?@[]{}|/\\^~-.,:";

const font = JSON.parse(readFileSync(SOURCE, "utf8"));

const glyphs = {};
const missing = [];
for (const ch of KEEP) {
  if (font.glyphs[ch]) glyphs[ch] = font.glyphs[ch];
  else missing.push(ch);
}

// Everything except `glyphs` is metrics the FontLoader needs; it is tiny, so it
// is copied wholesale rather than cherry-picked.
const out = {
  ...font,
  glyphs,
  original_font_information: {
    ...font.original_font_information,
    subset_note: `Subset of ${font.familyName} for the hero name — see scripts/make-hero-font.mjs`,
  },
};

writeFileSync(OUT, JSON.stringify(out));

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(
  `${font.familyName}: ${Object.keys(font.glyphs).length} glyphs ` +
    `(${kb(readFileSync(SOURCE).length)}) -> ${Object.keys(glyphs).length} glyphs ` +
    `(${kb(readFileSync(OUT).length)})`
);
if (missing.length) console.warn(`missing from source: ${missing.join(" ")}`);
