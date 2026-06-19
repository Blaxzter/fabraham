import type { SpotTrack } from "~/types/spotlights";

// The scroll-driven spotlight spine — the lighting analogue of the camera poses.
// Edited here in code (art-direction) or live in the dev panel; driven imperatively
// by components/home/ScrollSpotlights.vue. See types/spotlights.ts for the model.
//
// Each keyframe is ANCHORED to a section (by id) at a local position `t` (0..1),
// and biography keyframes can pin to a `milestone` (card index). The absolute
// scroll progress is derived from the live section layout (useSectionsStore().
// resolveAt), so adding/reordering/reweighting sections — or adding biography
// cards — keeps every beat on its mark. Section ids (registry.ts): identity (hero),
// pause (interlude), biography, contact.
//
// Targets are head-LOCAL by default (`targetAnchor` omitted → "head"), so each
// cone tracks the floating/turning head and keeps the face lit. Positions are
// world coords (the head sits at the origin).

const v3 = (x: number, y: number, z: number) => ({ x, y, z });

// Where each cone aims on the head (head-local): roughly the centre of the face,
// a touch up and forward (the face looks down +z).
const FACE = v3(0, 0.06, 0.12);

export const SPOTLIGHT_TRACKS: SpotTrack[] = [
  // ── KEY ──────────────────────────────────────────────────────────────────
  // The storyteller light: dark through the hero, snaps on at the interlude,
  // then visits the biography cards (milestone-anchored) and settles at the finale.
  {
    id: "key",
    keyframes: [
      // Dark through the hero — let the head emerge via the ASCII ramp alone.
      { section: "identity", t: 0, position: v3(0.4, 0.7, 0.9), target: FACE, intensity: 0, color: "#ffffff" },
      { section: "identity", t: 1, position: v3(0.4, 0.7, 0.9), target: FACE, intensity: 0, color: "#ffffff" },
      // TADA — the bulb kicks on mid-interlude, front-above, with a brief flicker.
      {
        section: "pause",
        t: 0.45,
        position: v3(0.32, 0.55, 0.85),
        target: FACE,
        intensity: 15,
        color: "#ffffff",
        angle: 0.5,
        penumbra: 0.45,
        effect: { type: "flicker", amount: 0.7, speed: 26 },
      },
      // Settle, full and clean, at the end of the interlude.
      { section: "pause", t: 1, position: v3(0.3, 0.5, 0.85), target: FACE, intensity: 13, color: "#ffffff", angle: 0.5, penumbra: 0.45 },
      // Biography — fly to the cards (anchored to milestones, so it tracks them
      // even as cards are added/removed), picking up the chapter's blue accent.
      {
        section: "biography",
        milestone: 0,
        t: 0.5,
        position: v3(-0.75, 0.45, 0.7),
        target: FACE,
        intensity: 12,
        color: "#9ad1ff",
        effect: { type: "sweep", amount: 0.18, speed: 0.9 },
      },
      { section: "biography", milestone: 2, t: 0.5, position: v3(0.78, 0.45, 0.7), target: FACE, intensity: 12, color: "#9ad1ff", effect: { type: "sweep", amount: 0.18, speed: 0.9 } },
      { section: "biography", milestone: 4, t: 0.5, position: v3(-0.6, 0.5, 0.72), target: FACE, intensity: 12, color: "#9ad1ff" },
      // Finale — the head sits on the left (camera panned right) addressing the
      // terminal; light it warm-green from the front, breathing gently.
      {
        section: "contact",
        t: 0.6,
        position: v3(0.7, 0.4, 0.85),
        target: FACE,
        intensity: 16,
        color: "#00ff9c",
        angle: 0.46,
        penumbra: 0.5,
        effect: { type: "breathe", amount: 0.22, speed: 1.3 },
      },
      { section: "contact", t: 1, position: v3(0.7, 0.4, 0.85), target: FACE, intensity: 16, color: "#00ff9c", angle: 0.46, penumbra: 0.5, effect: { type: "breathe", amount: 0.22, speed: 1.3 } },
    ],
  },

  // ── FILL ─────────────────────────────────────────────────────────────────
  // Soft counter-light from the opposite side of the key, lifts the shadow side.
  {
    id: "fill",
    keyframes: [
      { section: "identity", t: 0, position: v3(-0.6, 0.3, 0.8), target: FACE, intensity: 0, color: "#bcd6ff" },
      // Comes up just after the key for a layered reveal.
      { section: "pause", t: 0.6, position: v3(-0.55, 0.28, 0.8), target: FACE, intensity: 6, color: "#bcd6ff", angle: 0.6, penumbra: 0.7 },
      { section: "biography", t: 0.3, position: v3(0.55, 0.3, 0.78), target: FACE, intensity: 6, color: "#cfe6ff", angle: 0.6, penumbra: 0.7 },
      { section: "biography", t: 0.8, position: v3(-0.55, 0.3, 0.78), target: FACE, intensity: 6, color: "#cfe6ff", angle: 0.6, penumbra: 0.7 },
      { section: "contact", t: 0.6, position: v3(-0.55, 0.25, 0.8), target: FACE, intensity: 7, color: "#aef7da", angle: 0.6, penumbra: 0.7 },
      { section: "contact", t: 1, position: v3(-0.55, 0.25, 0.8), target: FACE, intensity: 7, color: "#aef7da", angle: 0.6, penumbra: 0.7 },
    ],
  },

  // ── RIM ──────────────────────────────────────────────────────────────────
  // Edge light from behind-above: separates the head from the dark background.
  {
    id: "rim",
    keyframes: [
      { section: "identity", t: 0, position: v3(0.0, 0.9, -0.7), target: FACE, intensity: 0, color: "#00ff9c" },
      {
        section: "pause",
        t: 0.8,
        position: v3(0.2, 0.95, -0.7),
        target: FACE,
        intensity: 9,
        color: "#00ff9c",
        angle: 0.55,
        penumbra: 0.6,
        effect: { type: "colorCycle", amount: 0.12, speed: 0.25 },
      },
      { section: "biography", t: 0.5, position: v3(-0.3, 0.95, -0.7), target: FACE, intensity: 9, color: "#9ad1ff", angle: 0.55, penumbra: 0.6, effect: { type: "colorCycle", amount: 0.12, speed: 0.25 } },
      { section: "contact", t: 0.6, position: v3(-0.4, 0.85, -0.6), target: FACE, intensity: 10, color: "#00ff9c", angle: 0.55, penumbra: 0.6 },
      { section: "contact", t: 1, position: v3(-0.4, 0.85, -0.6), target: FACE, intensity: 10, color: "#00ff9c", angle: 0.55, penumbra: 0.6 },
    ],
  },
];
