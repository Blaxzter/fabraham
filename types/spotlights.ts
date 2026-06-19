// Type definitions for the scroll-driven spotlight rig.
//
// A spotlight is a TRACK of keyframes, each ANCHORED to a section (and optionally
// a biography milestone) at a local position `t` — exactly like the camera's
// keyframes. The absolute scroll progress is derived from the live section layout
// (see useSectionsStore().resolveAt), so inserting / reordering / reweighting
// sections (or adding biography cards) keeps every beat where it belongs: the
// "tada" stays mid-interlude, the sweep stays on its cards, the finale stays at
// the finale — plus an optional time-based effect active around each keyframe.
//
// Driven imperatively in the TresJS render loop (components/home/ScrollSpotlights),
// so — like the camera and the head — nothing here is patched through Vue
// reactivity per frame (issue #4). The per-keyframe spine is art-direction, edited
// in code (components/home/sections/spotlights.ts) or live in the dev panel.

import type { Vec3, Anchor } from "./section";

/**
 * A time-based modulation layered on top of a keyframe's static pose. Evaluated
 * from the render clock (`elapsed`), so it animates on its own while the base
 * pose stays scroll-driven. The *nearest* keyframe's effect is the active one,
 * so different beats can carry different effects. Dropped under reduced-motion.
 */
export type SpotEffectType =
  | "none"
  | "flicker" // stuttering intensity — "the bulb kicking on" (the tada)
  | "pulse" // intensity throbs up and down
  | "breathe" // slow, gentle intensity swell (ambient, finale)
  | "sweep" // cone scans side-to-side (visiting the cards)
  | "orbit" // light circles the head on its Y axis
  | "colorCycle" // hue rotates through the spectrum
  | "strobe"; // hard on/off

export interface SpotEffect {
  type: SpotEffectType;
  /** Depth of the modulation (0 = none). Meaning depends on type. */
  amount?: number;
  /** Speed of the modulation (rad/s-ish for the sine-based effects). */
  speed?: number;
}

/**
 * One art-directed beat of a single spotlight, anchored to a section (`section`
 * + local `t`, optional `milestone`) via the shared `Anchor` — resolved to
 * absolute scroll progress by the sections store.
 */
export interface SpotKeyframe extends Anchor {
  /** World position of the light. */
  position: Vec3;
  /**
   * The point the cone aims at. With `targetAnchor: "head"` (the default) this is
   * a head-LOCAL offset transformed by the head's live world matrix each frame —
   * so the cone tracks the floating/turning head and keeps lighting the face.
   * With `"world"` it is a fixed world point (useful for a light that sweeps past).
   */
  target: Vec3;
  targetAnchor?: "world" | "head";
  intensity: number;
  color: string;
  /** Cone half-angle in radians. Default ~PI/7. */
  angle?: number;
  /** Soft edge 0..1. Default 0.4. */
  penumbra?: number;
  /** Falloff distance. Default 8. */
  distance?: number;
  effect?: SpotEffect;
}

/** One spotlight: a list of anchored keyframes the rig resolves + interpolates. */
export interface SpotTrack {
  id: string;
  keyframes: SpotKeyframe[];
}
