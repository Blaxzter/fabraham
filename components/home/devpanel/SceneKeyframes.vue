<script setup lang="ts">
// Per-scene keyframe editor (shown under each section in the scenes tab): the
// CAMERA, HEAD, and SPOTLIGHT keyframes ANCHORED to this section, edited live.
// Global rig knobs (master/cones/base) stay in the global Spotlights section.
//
// Anchors are handled in "section-fraction" space (0..1 across the scene) so that
// biography keyframes — whose stored anchor is (card, within-card t) — collide-
// check and seed correctly alongside plain section-t keyframes.
import { computed, ref } from "vue";
import DevPanelSection from "./DevPanelSection.vue";
import PoseKeyframeFields from "./PoseKeyframeFields.vue";
import SpotKeyframeFields from "./SpotKeyframeFields.vue";
import type { CameraKeyframe } from "~/types/section";
import type { SpotKeyframe } from "~/types/spotlights";

const props = defineProps<{ sectionId: string }>();
const sections = useSectionsStore();
const spots = useSpotlightsStore();

const pct = (v: number) => Math.round(v * 100);
const isBio = computed(
  () => sections.sections.find((s) => s.id === props.sectionId)?.type === "biography"
);

const camKfs = computed(() => sections.cameraKeyframes[props.sectionId] ?? []);
const headKfs = computed(() => sections.headKeyframes[props.sectionId] ?? []);
const spotTracks = computed(() =>
  spots.tracks.map((tr, ti) => ({
    ti,
    id: tr.id,
    items: tr.keyframes
      .map((k, ki) => ({ ki, k }))
      .filter((x) => x.k.section === props.sectionId),
  }))
);

// (card, within-card t) | plain t  ->  section-fraction, and back.
const fracOf = (k: { t?: number; milestone?: number }) =>
  isBio.value ? sections.bioFrac(k.milestone, k.t) : k.t ?? 0.5;
const anchorForFrac = (f: number): { t: number; milestone: number | undefined } =>
  isBio.value ? sections.bioAnchorFromFrac(f) : { t: f, milestone: undefined };
// The current scroll's position within THIS section (0.5 if scrolled elsewhere).
const hereFrac = () => sections.localFracAt(props.sectionId, sections.progress);

// Choose a section-fraction for a NEW keyframe: prefer the current scroll, but if
// it collides with an existing anchor drop it into the largest free gap (so a new
// keyframe is never a no-op duplicate sitting on top of another).
const pickFrac = (used: number[], pref: number): number => {
  if (used.every((u) => Math.abs(u - pref) >= 0.05)) return pref;
  const stops = [0, ...used, 1].sort((a, b) => a - b);
  let best = pref;
  let bestGap = -1;
  for (let i = 0; i < stops.length - 1; i++) {
    const gap = stops[i + 1]! - stops[i]!;
    if (gap > bestGap) {
      bestGap = gap;
      best = (stops[i]! + stops[i + 1]!) / 2;
    }
  }
  return best;
};
const nearestIndex = (used: number[], f: number): number => {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < used.length; i++) {
    const d = Math.abs(used[i]! - f);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};

const resolved = (k: { t?: number; milestone?: number }) =>
  sections.resolveAt({ section: props.sectionId, t: k.t, milestone: k.milestone });
const previewPose = (k: CameraKeyframe) => sections.setProgress(resolved(k));
const previewSpot = (k: SpotKeyframe) => sections.setProgress(sections.resolveAt(k));

// The section-fraction a new keyframe would get (kept in sync with the adders).
const nextPoseFrac = (kfs: CameraKeyframe[]) => pickFrac(kfs.map(fracOf), hereFrac());
const nextSpotFrac = (ti: number) =>
  pickFrac(
    (spots.tracks[ti]?.keyframes ?? []).filter((k) => k.section === props.sectionId).map(fracOf),
    hereFrac()
  );

const addPose = (
  kfs: CameraKeyframe[],
  add: (sectionId: string, kf: CameraKeyframe) => void,
  fallback: CameraKeyframe
) => {
  const used = kfs.map(fracOf);
  const f = pickFrac(used, hereFrac());
  const seed = kfs[nearestIndex(used, f)];
  const a = anchorForFrac(f);
  add(props.sectionId, {
    t: a.t,
    milestone: a.milestone,
    position: seed ? { ...seed.position } : { ...fallback.position },
    rotation: seed ? { ...seed.rotation } : { ...fallback.rotation },
  });
};
const addCam = () =>
  addPose(camKfs.value, sections.addCameraKeyframe, {
    position: { x: 0, y: 0.05, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
  });
const addHead = () =>
  addPose(headKfs.value, sections.addHeadKeyframe, {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: -0.44, z: 0 },
  });
const addSpot = (ti: number) => {
  const tr = spots.tracks[ti];
  if (!tr) return;
  const inSection = tr.keyframes.filter((k) => k.section === props.sectionId);
  const used = inSection.map(fracOf);
  const f = pickFrac(used, hereFrac());
  const seed = inSection[nearestIndex(used, f)] ?? tr.keyframes[0];
  if (!seed) return;
  const a = anchorForFrac(f);
  spots.addKeyframe(ti, { ...seed, section: props.sectionId, t: a.t, milestone: a.milestone });
};

const copied = ref("");
const copy = async (which: string, text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = which;
    setTimeout(() => (copied.value = ""), 1300);
  } catch {
    /* clipboard blocked — ignore */
  }
};
</script>

<template>
  <!-- Camera -->
  <DevPanelSection title="Camera" :default-open="true">
    <template #actions>
      <button class="dvp-btn" @click.stop="copy('cam', sections.exportCameraKeyframes(sectionId))">
        {{ copied === "cam" ? "copied" : "copy" }}
      </button>
      <button class="dvp-btn" @click.stop="sections.resetCameraKeyframes(sectionId)">reset</button>
    </template>
    <div v-for="(ckf, i) in camKfs" :key="i" class="dvp-kf-block">
      <div class="dvp-row">
        <span class="dvp-label">kf {{ i }} · {{ pct(resolved(ckf)) }}% scroll</span>
        <span class="dvp-kf-acts">
          <button class="dvp-btn" @click="previewPose(ckf)">view</button>
          <button class="dvp-btn dvp-btn-danger" :disabled="camKfs.length <= 1" @click="sections.removeCameraKeyframe(sectionId, i)">✕</button>
        </span>
      </div>
      <PoseKeyframeFields kind="camera" :section-id="sectionId" :index="i" />
    </div>
    <button class="dvp-btn dvp-btn-block" @click="addCam">
      + camera keyframe @ {{ pct(nextPoseFrac(camKfs)) }}%
    </button>
  </DevPanelSection>

  <!-- Head -->
  <DevPanelSection title="Head">
    <template #actions>
      <button class="dvp-btn" @click.stop="copy('head', sections.exportHeadKeyframes(sectionId))">
        {{ copied === "head" ? "copied" : "copy" }}
      </button>
      <button class="dvp-btn" @click.stop="sections.resetHeadKeyframes(sectionId)">reset</button>
    </template>
    <div v-for="(hkf, i) in headKfs" :key="i" class="dvp-kf-block">
      <div class="dvp-row">
        <span class="dvp-label">kf {{ i }} · {{ pct(resolved(hkf)) }}% scroll</span>
        <span class="dvp-kf-acts">
          <button class="dvp-btn" @click="previewPose(hkf)">view</button>
          <button class="dvp-btn dvp-btn-danger" :disabled="headKfs.length <= 1" @click="sections.removeHeadKeyframe(sectionId, i)">✕</button>
        </span>
      </div>
      <PoseKeyframeFields kind="head" :section-id="sectionId" :index="i" />
    </div>
    <button class="dvp-btn dvp-btn-block" @click="addHead">
      + head keyframe @ {{ pct(nextPoseFrac(headKfs)) }}%
    </button>
    <p class="dvp-hint">
      Position offsets the head; rotation is its resting aim (the finale still turns it
      to the terminal). Move it per scene to fly the head across.
    </p>
  </DevPanelSection>

  <!-- Spotlights -->
  <DevPanelSection title="Spotlights" :default-open="true">
    <div v-for="tr in spotTracks" :key="tr.ti" class="dvp-kf-track">
      <div class="dvp-row"><span class="dvp-light-name">{{ tr.id }}</span></div>
      <div v-for="it in tr.items" :key="it.ki" class="dvp-kf-block">
        <div class="dvp-row">
          <span class="dvp-label">{{ pct(sections.resolveAt(it.k)) }}% · int {{ it.k.intensity.toFixed(0) }}</span>
          <span class="dvp-kf-acts">
            <button class="dvp-btn" @click="previewSpot(it.k)">view</button>
            <button class="dvp-btn dvp-btn-danger" :disabled="spots.tracks[tr.ti]!.keyframes.length <= 1" @click="spots.removeKeyframe(tr.ti, it.ki)">✕</button>
          </span>
        </div>
        <SpotKeyframeFields :ti="tr.ti" :ki="it.ki" />
      </div>
      <p v-if="!tr.items.length" class="dvp-hint">No keyframes in this scene.</p>
      <button class="dvp-btn dvp-btn-block" @click="addSpot(tr.ti)">
        + {{ tr.id }} @ {{ pct(nextSpotFrac(tr.ti)) }}%
      </button>
    </div>
  </DevPanelSection>
</template>

<style>
/* A keyframe's controls grouped with a faint frame (dvp-namespaced). */
.dvp-kf-block {
  border: 1px solid rgba(0, 255, 156, 0.14);
  border-radius: 0.35rem;
  padding: 0.4rem;
  margin-bottom: 0.45rem;
}
.dvp-kf-track {
  border-top: 1px solid rgba(0, 255, 156, 0.12);
  margin-top: 0.4rem;
  padding-top: 0.4rem;
}
.dvp-kf-acts {
  display: inline-flex;
  gap: 0.3rem;
}
</style>
