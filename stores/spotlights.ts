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

  // Swap out every keyframe a track holds for one section. This is how the
  // runtime GENERATORS land in the rig: the biography's key/fill beats are derived
  // from the loaded milestones (components/home/sections/biography.ts) and so
  // can't be authored in the spine, but they are still *only* that section's — the
  // hand-off keyframes on either side (anchored to `pause` / `skills`) must
  // survive. The replacement takes the place of the old ones (appended if the
  // section had none authored); either way only the raw `exportJson` order is
  // affected — the rig sorts by RESOLVED scroll position and the panel groups by
  // section, so neither depends on where in the array these land.
  //
  // Only call this when the generator's inputs actually changed: it overwrites,
  // so calling it per tick would wipe live dev-panel edits. Note the rig
  // (ScrollSpotlights) only deep-watches the tracks in dev — in production it
  // re-caches off `milestoneCount`/`boundaries` instead, which is the very thing
  // that changes when this is called, and both land in the same flush.
  // Generated keyframes double as the reset BASELINE for the sections they cover
  // (`trackId → sectionId → keyframes`). Without this, `resetTracks` — which
  // reseeds from the committed spine — would silently drop every generated beat
  // until the next reload, because the spine deliberately authors none for them.
  // Same reasoning as the sections store's `generatedHeadKeyframes`.
  const generated = ref<Record<string, Record<string, SpotKeyframe[]>>>({});

  const applySectionKeyframes = (
    trackId: string,
    sectionId: string,
    kfs: SpotKeyframe[]
  ) => {
    const tr = tracks.value.find((t) => t.id === trackId);
    if (!tr) return;
    const at = tr.keyframes.findIndex((k) => k.section === sectionId);
    const kept = tr.keyframes.filter((k) => k.section !== sectionId);
    const insert = at < 0 ? kept.length : at;
    tr.keyframes = [
      ...kept.slice(0, insert),
      ...kfs.map(normalizeKf),
      ...kept.slice(insert),
    ];
  };

  const setSectionKeyframes = (
    trackId: string,
    sectionId: string,
    kfs: SpotKeyframe[]
  ) => {
    (generated.value[trackId] ??= {})[sectionId] = kfs.map(normalizeKf);
    applySectionKeyframes(trackId, sectionId, kfs);
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
        normalizeKf({ section: "reveal", t: 0.5, position: { x: 0, y: 0.6, z: 0.9 }, target: { x: 0, y: 0.06, z: 0.12 }, intensity: 10, color: "#ffffff" }),
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
    setSectionKeyframes,
    removeKeyframe,
    addTrack,
    removeTrack,
    resetTracks,
    exportJson,
  };
});
