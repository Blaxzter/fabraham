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

// "On a keyframe" detection: is the live scroll sitting ON one of a track's
// keyframes (so what you edit is the pose you see), or BETWEEN them (the pose is
// interpolated and there's nothing here to grab)? Compared in section-fraction
// space so camera / head / spotlights share one rule. Only meaningful while this
// is the scene the scroll is in — the editor follows the scroll, so it normally
// is, but guard anyway. Drives the per-track "● here" / "no keyframe here" hint,
// so e.g. parking on a head keyframe flags that the camera has none at this spot.
//
// KNOWN LIMITATION — keyframes pinned at exactly t === 1 (a section's very end):
// resolveAt maps t=1 to the section's upper boundary, which is RIGHT-EXCLUSIVE in
// the store (activeIndex uses `p < end`), so that boundary belongs to the NEXT
// section. Clicking "view" on such a keyframe parks the scroll there and the
// editor (which follows the active scene) hops to that next section — so the
// "● here" badge never lands on the t=1 keyframe itself. Harmless in practice:
// scrolling to within HERE_EPS of it still highlights it, camera/head default to
// t=0.5 (only the spotlight "settle" keyframes sit at t=1), and the next section
// shows its own correct indicators. Deliberately NOT worked around here: the only
// real fixes touch the 3D resolver (resolveAt) or degrade "view" preview accuracy,
// both out of scope for a display-only hint. See PR/commit for the full analysis.
const HERE_EPS = 0.02; // within 2% of the section counts as "on" the keyframe
const isActiveSection = computed(
  () => sections.sections[sections.activeIndex]?.id === props.sectionId
);
const onIndex = (fracs: number[]): number => {
  if (!isActiveSection.value || !fracs.length) return -1;
  const h = hereFrac();
  let best = -1;
  let bestD = HERE_EPS;
  fracs.forEach((f, i) => {
    const d = Math.abs(f - h);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
};
const camOn = computed(() => onIndex(camKfs.value.map(fracOf)));
const headOn = computed(() => onIndex(headKfs.value.map(fracOf)));
const spotOnByTrack = computed(() =>
  spotTracks.value.map((tr) => onIndex(tr.items.map((it) => fracOf(it.k))))
);

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
    <div v-for="(ckf, i) in camKfs" :key="i" class="dvp-kf-block" :class="{ 'dvp-kf-here': i === camOn }">
      <div class="dvp-row">
        <span class="dvp-label">
          kf {{ i }} · {{ pct(resolved(ckf)) }}% scroll
          <span v-if="i === camOn" class="dvp-kf-badge">● here</span>
        </span>
        <span class="dvp-kf-acts">
          <button class="dvp-btn" @click="previewPose(ckf)">view</button>
          <button class="dvp-btn dvp-btn-danger" :disabled="camKfs.length <= 1" @click="sections.removeCameraKeyframe(sectionId, i)">✕</button>
        </span>
      </div>
      <PoseKeyframeFields kind="camera" :section-id="sectionId" :index="i" />
    </div>
    <p v-if="isActiveSection && camOn === -1" class="dvp-kf-none">
      ○ no camera keyframe here — the camera is interpolated. Add one to pin it:
    </p>
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
    <div v-for="(hkf, i) in headKfs" :key="i" class="dvp-kf-block" :class="{ 'dvp-kf-here': i === headOn }">
      <div class="dvp-row">
        <span class="dvp-label">
          kf {{ i }} · {{ pct(resolved(hkf)) }}% scroll
          <span v-if="i === headOn" class="dvp-kf-badge">● here</span>
        </span>
        <span class="dvp-kf-acts">
          <button class="dvp-btn" @click="previewPose(hkf)">view</button>
          <button class="dvp-btn dvp-btn-danger" :disabled="headKfs.length <= 1" @click="sections.removeHeadKeyframe(sectionId, i)">✕</button>
        </span>
      </div>
      <PoseKeyframeFields kind="head" :section-id="sectionId" :index="i" />
    </div>
    <p v-if="isActiveSection && headOn === -1" class="dvp-kf-none">
      ○ no head keyframe here — the head is interpolated. Add one to pin it:
    </p>
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
    <div v-for="(tr, tIdx) in spotTracks" :key="tr.ti" class="dvp-kf-track">
      <div class="dvp-row"><span class="dvp-light-name">{{ tr.id }}</span></div>
      <div
        v-for="(it, idx) in tr.items"
        :key="it.ki"
        class="dvp-kf-block"
        :class="{ 'dvp-kf-here': idx === spotOnByTrack[tIdx] }"
      >
        <div class="dvp-row">
          <span class="dvp-label">
            {{ pct(sections.resolveAt(it.k)) }}% · int {{ it.k.intensity.toFixed(0) }}
            <span v-if="idx === spotOnByTrack[tIdx]" class="dvp-kf-badge">● here</span>
          </span>
          <span class="dvp-kf-acts">
            <button class="dvp-btn" @click="previewSpot(it.k)">view</button>
            <button class="dvp-btn dvp-btn-danger" :disabled="spots.tracks[tr.ti]!.keyframes.length <= 1" @click="spots.removeKeyframe(tr.ti, it.ki)">✕</button>
          </span>
        </div>
        <SpotKeyframeFields :ti="tr.ti" :ki="it.ki" />
      </div>
      <p v-if="!tr.items.length" class="dvp-hint">No keyframes in this scene.</p>
      <p v-else-if="isActiveSection && spotOnByTrack[tIdx] === -1" class="dvp-kf-none">
        ○ no {{ tr.id }} keyframe here — interpolated. Add one to pin it:
      </p>
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
/* The keyframe the live scroll is sitting on (editing it changes the pose you
   see), and the badge marking it. */
.dvp-kf-block.dvp-kf-here {
  border-color: rgba(0, 255, 156, 0.5);
  background: rgba(0, 255, 156, 0.06);
}
.dvp-kf-badge {
  margin-left: 0.3rem;
  color: #00ff9c;
  font-size: 0.6rem;
  white-space: nowrap;
}
/* "Nothing pinned here" nudge: shown for a track that has no keyframe at the
   current scroll, so the pose is interpolated (e.g. on a head kf, camera has
   none). Amber to read as an actionable hint above the add button. */
.dvp-kf-none {
  margin: 0.2rem 0 0.3rem;
  opacity: 0.75;
  font-size: 0.62rem;
  line-height: 1.3;
  color: #ffd27d;
}
</style>
