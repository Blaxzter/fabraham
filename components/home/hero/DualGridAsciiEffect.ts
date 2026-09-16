import { ASCIITexture, Effect } from "postprocessing";
import { Color, DataTexture, Uniform, Vector2, Vector4 } from "three";
import type { Texture } from "three";
import { heroExit } from "./glyphBuffer";

/**
 * The ASCII post-process, with a second grid for the hero name.
 *
 * Why not `ASCIIPmndrs`
 * --------------------
 * `ASCIIEffect` takes ONE cell size, because it is one effect over one buffer —
 * and that is the exact thing the hero cannot live with. The face's cell size is
 * the narrative: coarse and abstract at the top of the scroll, resolving into a
 * face as it shrinks. Any name sharing that grid is unreadable for the first
 * half of the page, which is fine for a face that is supposed to be a puzzle and
 * useless for a name that is supposed to be a name.
 *
 * So this runs the same maths twice. The scene (the composer's `inputBuffer`)
 * gets the face's scroll-driven cell; the hero glyph buffer — filled by
 * `HeroGlyphs` from its own layer, before the composer runs — gets its own,
 * finer, constant cell. One extra buffer read in one existing pass; both grids
 * were already screen-space, so the frame cost is close to nothing.
 *
 * The maths, the defines and the character lookup are deliberately kept
 * identical to pmndrs' `ASCIIEffect` (postprocessing 6.38) so the face renders
 * exactly as it did before this component existed — the only new behaviour is
 * the second grid and the composite at the end.
 */

const fragmentShader = /* glsl */ `
uniform sampler2D asciiTexture;
uniform vec4 cellCount;

uniform sampler2D glyphBuffer;
uniform vec4 glyphCellCount;
uniform float glyphGain;
uniform float faceDuck;
uniform float nameFeather;
uniform float nameFeatherSpread;
uniform float nameDissolve;
uniform float nameDissolveReach;
uniform float nameDissolveSpread;
uniform float nameDissolveRise;

#ifdef USE_COLOR
uniform vec3 color;
#endif

/** Cheap per-cell noise — the classic sin/fract hash. Precision is beside the
 *  point here; we are seeding ash. */
float cellHash(const in vec2 cell, const in float salt) {
  return fract(sin(dot(cell, vec2(12.9898, 78.233)) + salt) * 43758.5453);
}

/**
 * The name's texel at a cell, feathered.
 *
 * One tap at the cell centre answers "is this cell's centre inside a letter",
 * which is a yes or a no — so the letterform ends on a full-density character
 * and the next cell is empty. Mixing in four neighbours a cell away turns that
 * into COVERAGE: an edge cell comes out part lit, the ramp hands it a sparser
 * character, and the cell just outside picks up a trace of the letter it sits
 * against. Soft edge, in the grid's own vocabulary rather than over the top of
 * it.
 *
 * The whole texel is blurred, not just its luminance. The composite multiplies
 * the name's own colour by the character it picked, so feathering the luminance
 * alone would choose characters for a fringe and then paint them black.
 */
vec4 glyphTexel(const in vec2 uv) {
  vec4 sharp = texture(glyphBuffer, uv);
  if (nameFeather <= 0.0) return sharp;

  vec2 r = glyphCellCount.zw * nameFeatherSpread;
  vec4 soft = sharp * 0.4;
  soft += texture(glyphBuffer, uv + vec2(r.x, 0.0)) * 0.15;
  soft += texture(glyphBuffer, uv - vec2(r.x, 0.0)) * 0.15;
  soft += texture(glyphBuffer, uv + vec2(0.0, r.y)) * 0.15;
  soft += texture(glyphBuffer, uv - vec2(0.0, r.y)) * 0.15;
  return mix(sharp, soft, nameFeather);
}

// Luminance -> the character that stands for it, sampled from the ramp sheet.
// Lifted from ASCIIEffect so the face is pixel-identical to the old effect.
float asciiCharacter(const in vec2 uv, const in vec4 cc, const in float lum) {
  float characterIndex = floor(CHAR_COUNT_MINUS_ONE * lum);
  vec2 characterPosition = vec2(
    mod(characterIndex, TEX_CELL_COUNT),
    floor(characterIndex * INV_TEX_CELL_COUNT)
  );
  vec2 offset = vec2(characterPosition.x, -characterPosition.y) * INV_TEX_CELL_COUNT;
  vec2 characterUv = mod(uv * (cc.xy * INV_TEX_CELL_COUNT), INV_TEX_CELL_COUNT);
  characterUv = characterUv - vec2(0.0, INV_TEX_CELL_COUNT) + offset;
  return texture(asciiTexture, characterUv).r;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // --- the face, on the scroll-driven grid ---------------------------------
  vec2 faceUv = cellCount.zw * (0.5 + floor(uv * cellCount.xy));
  vec4 faceTexel = texture(inputBuffer, faceUv);
  float faceLum = min(luminance(faceTexel.rgb), 1.0);

  #ifdef INVERTED
  faceLum = 1.0 - faceLum;
  #endif

  float faceChar = asciiCharacter(uv, cellCount, faceLum);

  // --- the name, on its own grid -------------------------------------------
  // Every CELL of the name's grid is a fleck of it. While nameDissolve runs,
  // each one is somewhere along its own going: nameFrom is where it came from,
  // nameLeft how much of it is still here. At rest this is the plain cell.
  vec2 cell = floor(uv * glyphCellCount.xy);
  vec2 nameFrom = uv;
  float nameLeft = 1.0;

  if (nameDissolve > 0.0) {
    // Staggered by a per-cell roll, so the line comes APART — all cells on one
    // clock would slide the whole name off in formation, which is the thing this
    // replaced.
    float phase = clamp(
      nameDissolve * (1.0 + nameDissolveSpread) - cellHash(cell, 0.0) * nameDissolveSpread,
      0.0,
      1.0
    );

    // A fleck travels along drift, so the cell being shaded pulls its ink from
    // BEHIND itself — looking backward along the travel is what carries a letter
    // outward instead of smearing it sideways. Seeded angle, shared rise: the ash
    // scatters, but it goes up as one cloud.
    //
    // Deliberately not normalised. The varying length is what sends some flecks
    // further than others, and normalising a vector whose two halves can cancel
    // is a NaN waiting for the one frame where they do.
    float spin = cellHash(cell, 17.0) * 6.2831853;
    vec2 drift = vec2(cos(spin), sin(spin)) * (1.0 - nameDissolveRise)
      + vec2(0.0, nameDissolveRise);

    // Reach is in CELLS, so the ash keeps its size whatever the grid is set to.
    nameFrom = uv - drift * phase * nameDissolveReach * glyphCellCount.zw;
    nameLeft = 1.0 - phase;
  }

  vec2 nameUv = glyphCellCount.zw * (0.5 + floor(nameFrom * glyphCellCount.xy));
  // Dimming a fleck is not a fade to nothing: the ramp hands a darker cell a
  // sparser character, so a fleck THINS — solid, then sketchy, then gone.
  vec4 nameTexel = glyphTexel(nameUv) * nameLeft;
  float nameLum = min(luminance(nameTexel.rgb), 1.0);
  float nameChar = asciiCharacter(uv, glyphCellCount, nameLum);

  // Coverage of the letterform itself, BEFORE the glyph mask — i.e. "is there a
  // letter here", not "is there ink here". Used to duck the face rather than add
  // to it: two bright things added together both saturate to the ramp's last
  // character, and the name dissolves into the cheek it is crossing.
  float nameMask = smoothstep(0.015, 0.14, nameLum);

  #ifdef USE_COLOR
  vec3 faceRgb = color * faceChar;
  vec3 nameRgb = color * nameChar;
  #else
  vec3 faceRgb = faceTexel.rgb * faceChar;
  vec3 nameRgb = nameTexel.rgb * nameChar;
  #endif

  outputColor = vec4(
    faceRgb * (1.0 - faceDuck * nameMask) + nameRgb * glyphGain,
    inputColor.a
  );
}
`;

/** A 1×1 black texture, so the glyph sampler is always bound even before the
 *  hero mounts (an unbound sampler is undefined behaviour, not a black frame). */
const createEmptyTexture = () => {
  const tex = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
};

export interface DualGridAsciiOptions {
  asciiTexture?: ASCIITexture;
  /** The face's cell size, in device pixels. Driven by scroll. */
  cellSize?: number;
  /** The hero name's cell size, in device pixels. Constant per breakpoint. */
  glyphCellSize?: number;
  color?: Color | string | number | null;
  inverted?: boolean;
  /** How hard the name brightens over the face. */
  glyphGain?: number;
  /** How hard the name darkens the face behind it (0 = pure additive). */
  faceDuck?: number;
  /** How much of the name's edge is coverage rather than a hard cell (0 = off). */
  nameFeather?: number;
  /** How far the feather reaches, in name cells. */
  nameFeatherSpread?: number;
  /** How far a fleck of the name travels as it goes, in name cells. */
  nameDissolveReach?: number;
  /** How staggered the cells are (0 = the whole name goes at once). */
  nameDissolveSpread?: number;
  /** How much of a fleck's travel is a shared rise rather than a seeded scatter. */
  nameDissolveRise?: number;
}

export class DualGridAsciiEffect extends Effect {
  private _cellSize = -1;
  private _glyphCellSize = -1;
  private readonly res = new Vector2();
  private readonly emptyGlyphTexture = createEmptyTexture();

  constructor({
    asciiTexture = new ASCIITexture(),
    cellSize = 16,
    glyphCellSize = 6,
    color = null,
    inverted = false,
    glyphGain = 1.25,
    faceDuck = 0.85,
    nameFeather = 0.5,
    nameFeatherSpread = 1,
    nameDissolveReach = 12,
    nameDissolveSpread = 0.7,
    nameDissolveRise = 0.55,
  }: DualGridAsciiOptions = {}) {
    super("DualGridAsciiEffect", fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ["asciiTexture", new Uniform(null)],
        ["cellCount", new Uniform(new Vector4())],
        ["glyphBuffer", new Uniform(null)],
        ["glyphCellCount", new Uniform(new Vector4())],
        ["glyphGain", new Uniform(glyphGain)],
        ["faceDuck", new Uniform(faceDuck)],
        ["nameFeather", new Uniform(nameFeather)],
        ["nameFeatherSpread", new Uniform(nameFeatherSpread)],
        ["nameDissolve", new Uniform(0)],
        ["nameDissolveReach", new Uniform(nameDissolveReach)],
        ["nameDissolveSpread", new Uniform(nameDissolveSpread)],
        ["nameDissolveRise", new Uniform(nameDissolveRise)],
        ["color", new Uniform(new Color())],
      ]),
    });

    this.uniforms.get("glyphBuffer")!.value = this.emptyGlyphTexture;
    this.asciiTexture = asciiTexture;
    this.cellSize = cellSize;
    this.glyphCellSize = glyphCellSize;
    this.color = color;
    this.inverted = inverted;
  }

  get asciiTexture(): ASCIITexture {
    return this.uniforms.get("asciiTexture")!.value as ASCIITexture;
  }

  set asciiTexture(value: ASCIITexture) {
    const current = this.uniforms.get("asciiTexture")!.value as ASCIITexture | null;
    this.uniforms.get("asciiTexture")!.value = value;
    if (current !== null && current !== value) current.dispose();

    if (value) {
      const cellCount = value.cellCount;
      this.defines.set("CHAR_COUNT_MINUS_ONE", (value.characterCount - 1).toFixed(1));
      this.defines.set("TEX_CELL_COUNT", cellCount.toFixed(1));
      this.defines.set("INV_TEX_CELL_COUNT", (1 / cellCount).toFixed(9));
      this.setChanged();
    }
  }

  /** The hero name's offscreen buffer. Owned by `HeroGlyphs`, never disposed here. */
  set glyphBuffer(value: Texture | null) {
    this.uniforms.get("glyphBuffer")!.value = value ?? this.emptyGlyphTexture;
  }

  get glyphGain(): number {
    return this.uniforms.get("glyphGain")!.value as number;
  }

  set glyphGain(value: number) {
    this.uniforms.get("glyphGain")!.value = value;
  }

  get faceDuck(): number {
    return this.uniforms.get("faceDuck")!.value as number;
  }

  set faceDuck(value: number) {
    this.uniforms.get("faceDuck")!.value = value;
  }

  get nameFeather(): number {
    return this.uniforms.get("nameFeather")!.value as number;
  }

  set nameFeather(value: number) {
    this.uniforms.get("nameFeather")!.value = value;
  }

  get nameFeatherSpread(): number {
    return this.uniforms.get("nameFeatherSpread")!.value as number;
  }

  set nameFeatherSpread(value: number) {
    this.uniforms.get("nameFeatherSpread")!.value = value;
  }

  get nameDissolveReach(): number {
    return this.uniforms.get("nameDissolveReach")!.value as number;
  }

  set nameDissolveReach(value: number) {
    this.uniforms.get("nameDissolveReach")!.value = value;
  }

  get nameDissolveSpread(): number {
    return this.uniforms.get("nameDissolveSpread")!.value as number;
  }

  set nameDissolveSpread(value: number) {
    this.uniforms.get("nameDissolveSpread")!.value = value;
  }

  get nameDissolveRise(): number {
    return this.uniforms.get("nameDissolveRise")!.value as number;
  }

  set nameDissolveRise(value: number) {
    this.uniforms.get("nameDissolveRise")!.value = value;
  }

  /**
   * Pull the name's exit off the hero's own channel.
   *
   * It changes every scroll frame, so it cannot come down the reactive path the
   * other settings use — and this is the hook postprocessing provides for exactly
   * that, called by the EffectPass right before the fullscreen draw. Reading it
   * here rather than in a render-loop callback also means it is always THIS
   * frame's value, whatever order the components mounted in.
   */
  override update() {
    this.uniforms.get("nameDissolve")!.value = heroExit.progress;
  }

  get color(): Color | null {
    return this.uniforms.get("color")!.value as Color;
  }

  set color(value: Color | string | number | null) {
    if (value !== null) this.uniforms.get("color")!.value.set(value);

    if (this.defines.has("USE_COLOR") && value === null) {
      this.defines.delete("USE_COLOR");
      this.setChanged();
    } else if (!this.defines.has("USE_COLOR") && value !== null) {
      this.defines.set("USE_COLOR", "1");
      this.setChanged();
    }
  }

  get inverted(): boolean {
    return this.defines.has("INVERTED");
  }

  set inverted(value: boolean) {
    if (this.inverted === value) return;
    if (value) this.defines.set("INVERTED", "1");
    else this.defines.delete("INVERTED");
    this.setChanged();
  }

  get cellSize(): number {
    return this._cellSize;
  }

  set cellSize(value: number) {
    if (this._cellSize === value) return;
    this._cellSize = value;
    this.updateCellCount("cellCount", value);
  }

  get glyphCellSize(): number {
    return this._glyphCellSize;
  }

  set glyphCellSize(value: number) {
    if (this._glyphCellSize === value) return;
    this._glyphCellSize = value;
    this.updateCellCount("glyphCellCount", value);
  }

  /** cellCount = (cols, rows, 1/cols, 1/rows) — the form the shader wants. */
  private updateCellCount(uniform: string, cellSize: number) {
    const v = this.uniforms.get(uniform)!.value as Vector4;
    const size = Math.max(1e-6, cellSize);
    v.x = this.res.width / size;
    v.y = this.res.height / size;
    v.z = 1 / v.x;
    v.w = 1 / v.y;
  }

  override setSize(width: number, height: number) {
    this.res.set(width, height);
    this.updateCellCount("cellCount", this._cellSize);
    this.updateCellCount("glyphCellCount", this._glyphCellSize);
  }

  override dispose() {
    this.asciiTexture?.dispose();
    this.emptyGlyphTexture.dispose();
    super.dispose();
  }
}
