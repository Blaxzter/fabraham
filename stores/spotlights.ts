import { defineStore } from "pinia";
import { ref } from "vue";
import { SPOTLIGHT_TRACKS } from "~/components/home/sections/spotlights";
import type { SpotKeyframe, SpotTrack, SpotEffectType } from "~/types/spotlights";

/**
 * Live, editable source of truth for the scroll-driven spotlight rig.
 *
 * Seeded from the committed `SPOTLIGHT_TRACKS` spine (components/home/sections/
 * spotlights.ts); the dev panel's Spotlights section edits this store in place,
 * the rig (ScrollSpotlights.vue) reads it and rebuilds its runtime cache on
 * change. Each keyframe is ANCHORED to a section (+ optional milestone) at a local
 * `t`; the sections store resolves that to absolute scroll progress, so beats ride
 * their section as content changes. Edits are NOT persisted (like the colored-
 * lights debugger) — they reset to the code defaults on reload; "copy JSON"
 * exports the current tracks to paste back into spotlights.ts so they ship.
 */
export const SPOT_EFFECT_TYPES: SpotEffectType[] = [
  "none",
  "flicker",
  "pulse",
  "breathe",
  "sweep",
  "orbit",
  "colorCycle",
  "strobe",
];

const DEF_ANGLE = Math.PI / 7;

// Fill optional fields so the panel controls always have a value to bind to.
const normalizeKf = (k: SpotKeyframe): SpotKeyframe => ({
  section: k.section,
  t: k.t ?? 0.5,
  milestone: k.milestone, // undefined ⇒ anchored to the whole section
  position: { x: k.position.x, y: k.position.y, z: k.position.z },
  target: { x: k.target.x, y: k.target.y, z: k.target.z },
  targetAnchor: k.targetAnchor ?? "head",
  intensity: k.intensity,
  color: k.color,
  angle: k.angle ?? DEF_ANGLE,
  penumbra: k.penumbra ?? 0.4,
  distance: k.distance ?? 8,
  effect: {
    type: k.effect?.type ?? "none",
    amount: k.effect?.amount ?? 0.4,
    speed: k.effect?.speed ?? 6,
  },
});

// Authoring order is kept as-is; the rig sorts by RESOLVED scroll position.
const seedTracks = (): SpotTrack[] =>
  SPOTLIGHT_TRACKS.map((t) => ({
    id: t.id,
    keyframes: t.keyframes.map(normalizeKf),
  }));

export const useSpotlightsStore = defineStore("spotlights", () => {
  // Global rig knobs (read by the rig + Scene3D's base lights).
  const enabled = ref(true);
  const master = ref(1);
  const showHelpers = ref(false); // dev marker dots at each light source
  const showCones = ref(false); // volumetric beam cones
  const coneOpacity = ref(0.12);
  const baseFill = ref(0.5); // constant directional the rig sits on top of
  const baseAmbient = ref(0.1);

  // The editable keyframe tracks.
  const tracks = ref<SpotTrack[]>(seedTracks());

  // Add a (pre-built, anchored) keyframe to a track. The dev panel seeds it from
  // the currently-edited keyframe and the current scroll anchor.
  const addKeyframe = (ti: number, kf: SpotKeyframe) => {
    tracks.value[ti]?.keyframes.push(normalizeKf(kf));
  };

  const removeKeyframe = (ti: number, ki: number) => {
    const tr = tracks.value[ti];
    if (tr && tr.keyframes.length > 1) tr.keyframes.splice(ki, 1);
  };

  const addTrack = () => {
    // Smallest free `spotN` — length-based ids collide after a remove+add.
    const used = new Set(tracks.value.map((t) => t.id));
    let n = 1;
    while (used.has(`spot${n}`)) n++;
    tracks.value.push({
      id: `spot${n}`,
      keyframes: [
        normalizeKf({ section: "identity", t: 0, position: { x: 0, y: 0.7, z: 0.9 }, target: { x: 0, y: 0.06, z: 0.12 }, intensity: 0, color: "#ffffff" }),
        normalizeKf({ section: "pause", t: 0.5, position: { x: 0, y: 0.6, z: 0.9 }, target: { x: 0, y: 0.06, z: 0.12 }, intensity: 10, color: "#ffffff" }),
      ],
    });
  };

  const removeTrack = (ti: number) => {
    if (tracks.value.length > 1) tracks.value.splice(ti, 1);
  };

  const resetTracks = () => {
    tracks.value = seedTracks();
  };

  // Pasteable into SPOTLIGHT_TRACKS (spotlights.ts) to ship the tuned values.
  const exportJson = () => JSON.stringify(tracks.value, null, 2);

  return {
    enabled,
    master,
    showHelpers,
    showCones,
    coneOpacity,
    baseFill,
    baseAmbient,
    tracks,
    addKeyframe,
    removeKeyframe,
    addTrack,
    removeTrack,
    resetTracks,
    exportJson,
  };
});
