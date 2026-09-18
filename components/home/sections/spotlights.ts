import type { SpotTrack } from "~/types/spotlights";
import { ORBIT_RISE } from "~/stores/sections";
import { skillAccent, skillsRimKeyframes, skillsSpotKeyframes } from "./skills";

// The scroll-driven spotlight spine — the lighting analogue of the camera poses.
// Edited here in code (art-direction) or live in the dev panel; driven imperatively
// by components/home/ScrollSpotlights.vue. See types/spotlights.ts for the model.
//
// Each keyframe is ANCHORED to a section (by id) at a local position `t` (0..1),
// and biography keyframes can pin to a `milestone` (card index). The absolute
// scroll progress is derived from the live section layout (useSectionsStore().
// resolveAt), so adding/reordering/reweighting sections — or adding biography
// cards — keeps every beat on its mark. Section ids (registry.ts): identity (hero),
// pause (interlude), biography, skills, contact.
//
// Two chapters' keyframes are GENERATED from the same layout their cards and the
// head's gaze use, so the light swings with the head onto whichever card is
// centre stage:
//   • skills    — spread into the key track below at module-eval time (./skills.ts),
//                 since the cluster list is a compile-time constant;
//   • biography — written into the key + fill tracks at RUNTIME by
//                 `useBiographyChoreography` (./biography.ts), since the cards
//                 come from the @nuxt/content collection. Nothing is authored for
//                 that section here; see the note in the key track.
//
// Targets are head-LOCAL by default (`targetAnchor` omitted → "head"), so each
// cone tracks the floating/turning head and keeps the face lit. Positions are
// world coords (the head sits at the origin).

const v3 = (x: number, y: number, z: number) => ({ x, y, z });

/**
 * THE CODA: the rig steps back and lets the planets light the head.
 *
 * Every track used to clamp to its contact keyframe and hold it to the bottom of
 * the page (tracks sample their last keyframe forever — see ScrollSpotlights), so
 * the outro inherited the finale's rig intact: a 16-intensity green key, a
 * pale-green fill and a green rim, all on the face at once. That is the right
 * light for the terminal beat and the wrong one for the beat after it. Three
 * saturated green sources do not sit UNDER five coloured planets, they repaint
 * whatever the planets land on — the system ends up circling a head that is
 * already green from every direction, which is no system at all.
 *
 * So each track now fades to this: dim, and hueless. What is left is a floor that
 * keeps the head from vanishing between passes (with the base directional in
 * Scene3D) while contributing no colour of its own, so the only hue in the frame
 * is the one a planet is casting. Everything ends on the same neutral, which is
 * also why it is one constant rather than three.
 *
 * The fade runs from the contact keyframes to `ORBIT_RISE` — the exact `t` the
 * planets are fully up at, imported from the sections store so the two halves of
 * the swap cannot drift apart.
 */
const CODA_NEUTRAL = "#c8d4e4";

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
      // TADA — the bulb kicks on mid-reveal, front-above, with a brief flicker.
      {
        section: "reveal",
        t: 0.45,
        position: v3(0.32, 0.55, 0.85),
        target: FACE,
        intensity: 15,
        color: "#ffffff",
        angle: 0.5,
        penumbra: 0.45,
        effect: { type: "flicker", amount: 0.7, speed: 26 },
      },
      // Settle, full and clean, at the end of the reveal.
      { section: "reveal", t: 1, position: v3(0.3, 0.5, 0.85), target: FACE, intensity: 13, color: "#ffffff", angle: 0.5, penumbra: 0.45 },
      // Biography — the key visits every card, from the card's side, on the same
      // beats the head's gaze uses. GENERATED at runtime (see ./biography.ts and
      // `useBiographyChoreography`) and spliced in here, because the cards come
      // from the @nuxt/content collection and aren't known at module-eval time.
      // Nothing is authored for this section on purpose: if the content never
      // loads the key simply crossfades from the interlude to the skills hand-off
      // below, which is a graceful nothing rather than a wrong pose.
      //
      // Skills — hand the chapter's blue off INSIDE the section (without this the
      // biography→contact pair would just cross-fade blue to green straight
      // through it), then swing with the gaze, card by card. Every keyframe
      // between these two is GENERATED, and each cluster is lit in its own hue;
      // the bookends borrow the first and last cluster's colour so the joins do
      // not cross the wheel either.
      { section: "skills", t: 0.02, position: v3(-0.5, 0.5, 0.78), target: FACE, intensity: 11, color: "#9ad1ff", angle: 0.48, penumbra: 0.45 },
      ...skillsSpotKeyframes(),
      { section: "skills", t: 0.99, position: v3(-0.2, 0.45, 0.82), target: FACE, intensity: 14, color: skillAccent(-1), angle: 0.48, penumbra: 0.45 },
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
      // Coda — down to the neutral floor (see CODA_NEUTRAL). 2.5 is about a sixth
      // of the finale's key: enough that the face never drops out entirely on the
      // frames when every planet is round the back, dim enough that the planet
      // nearest the camera is unambiguously the light source. The breathe goes
      // with it — a residual has no business pulsing.
      { section: "outro", t: ORBIT_RISE, position: v3(0.7, 0.4, 0.85), target: FACE, intensity: 2.5, color: CODA_NEUTRAL, angle: 0.46, penumbra: 0.5 },
    ],
  },

  // ── FILL ─────────────────────────────────────────────────────────────────
  // Soft counter-light from the opposite side of the key, lifts the shadow side.
  {
    id: "fill",
    keyframes: [
      { section: "identity", t: 0, position: v3(-0.6, 0.3, 0.8), target: FACE, intensity: 0, color: "#bcd6ff" },
      // Comes up just after the key for a layered reveal.
      { section: "reveal", t: 0.6, position: v3(-0.55, 0.28, 0.8), target: FACE, intensity: 6, color: "#bcd6ff", angle: 0.6, penumbra: 0.7 },
      // Biography — counter-side to the swinging key (i.e. the side the head has
      // swerved to), so the shadow side never goes black as the key crosses over.
      // GENERATED with the key; see the note in the key track above.
      // Skills: counter-side to the swinging key, so the shadow side never goes
      // fully black while the key is off across the stage. NEUTRAL on purpose —
      // the key now cycles through four hues, and the old warm fill fought three
      // of them. A near-white fill sits under any of them.
      { section: "skills", t: 0.15, position: v3(-0.6, 0.3, 0.78), target: FACE, intensity: 6, color: "#dfe6ef", angle: 0.6, penumbra: 0.7 },
      { section: "skills", t: 0.85, position: v3(0.6, 0.3, 0.78), target: FACE, intensity: 6, color: "#dfe6ef", angle: 0.6, penumbra: 0.7 },
      { section: "contact", t: 0.6, position: v3(-0.55, 0.25, 0.8), target: FACE, intensity: 7, color: "#aef7da", angle: 0.6, penumbra: 0.7 },
      { section: "contact", t: 1, position: v3(-0.55, 0.25, 0.8), target: FACE, intensity: 7, color: "#aef7da", angle: 0.6, penumbra: 0.7 },
      // Coda — nearly out. The fill exists to lift the side the key is not on,
      // and in the coda that job belongs to whichever planet is over there; what
      // is left is just enough to keep the shadow side from going to pure black.
      { section: "outro", t: ORBIT_RISE, position: v3(-0.55, 0.25, 0.8), target: FACE, intensity: 1.2, color: CODA_NEUTRAL, angle: 0.6, penumbra: 0.7 },
    ],
  },

  // ── RIM ──────────────────────────────────────────────────────────────────
  // Edge light from behind-above: separates the head from the dark background.
  {
    id: "rim",
    keyframes: [
      { section: "identity", t: 0, position: v3(0.0, 0.9, -0.7), target: FACE, intensity: 0, color: "#00ff9c" },
      {
        section: "reveal",
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
      // Skills — GENERATED with the key, one beat per cluster in the cluster's
      // own hue (see ./skills.ts).
      ...skillsRimKeyframes(),
      { section: "skills", t: 0.99, position: v3(-0.1, 0.9, -0.65), target: FACE, intensity: 10, color: skillAccent(-1), angle: 0.55, penumbra: 0.6 },
      { section: "contact", t: 0.6, position: v3(-0.4, 0.85, -0.6), target: FACE, intensity: 10, color: "#00ff9c", angle: 0.55, penumbra: 0.6 },
      { section: "contact", t: 1, position: v3(-0.4, 0.85, -0.6), target: FACE, intensity: 10, color: "#00ff9c", angle: 0.55, penumbra: 0.6 },
      // Coda — the one the rig keeps most of, and the only one worth arguing
      // about. The rim is behind-above: it draws the silhouette rather than
      // lighting the face, so it costs the planets nothing and it is what stops
      // the head dissolving into the dark backdrop when the traffic is all on the
      // far side. Neutral like the rest — the green edge is the finale's
      // signature, and the coda's signature is five colours moving.
      { section: "outro", t: ORBIT_RISE, position: v3(-0.4, 0.85, -0.6), target: FACE, intensity: 3, color: CODA_NEUTRAL, angle: 0.55, penumbra: 0.6 },
    ],
  },
];
