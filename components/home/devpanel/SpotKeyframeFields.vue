<script setup lang="ts">
// Controls for ONE spotlight keyframe, addressed by its store coordinates
// (track index + keyframe index) so it edits the spotlights store directly (we
// mutate the store object, never a prop). Used by SceneKeyframes under each scene.
import { computed } from "vue";
import { SPOT_EFFECT_TYPES } from "~/stores/spotlights";

const props = defineProps<{ ti: number; ki: number }>();
const store = useSpotlightsStore();
const sections = useSectionsStore();
const { milestones } = useBiographyMilestones();

const AXES = ["x", "y", "z"] as const;
// Non-null asserted: the parent only renders this for existing keyframes.
const kf = () => store.tracks[props.ti]!.keyframes[props.ki]!;

// The keyframe's section is fixed by the scene it's shown under (re-home it by
// removing here + adding in another scene). In biography the anchor is a single
// "position in section" slider — the card it lands on is derived automatically
// (so it matches the scroll); other scenes use a plain local-t slider.
const isBio = computed(
  () => sections.sections.find((s) => s.id === kf().section)?.type === "biography"
);
const bioPos = computed({
  get: () => sections.bioFrac(kf().milestone, kf().t),
  set: (frac: number) => {
    const a = sections.bioAnchorFromFrac(frac);
    const k = kf();
    k.milestone = a.milestone;
    k.t = a.t;
  },
});
// The card the current position lands on (works whether or not the keyframe is
// pinned yet; dragging the slider pins it to this card).
const bioCard = computed(() => {
  const j = sections.bioAnchorFromFrac(bioPos.value).milestone;
  return { j, title: milestones.value[j]?.title ?? "" };
});
</script>

<template>
  <template v-if="isBio">
    <div class="dvp-row">
      <span class="dvp-label">position in section</span>
      <span class="dvp-val">{{ Math.round(bioPos * 100) }}%</span>
    </div>
    <input v-model.number="bioPos" type="range" min="0" max="1" step="0.005" />
    <div class="dvp-row">
      <span class="dvp-label">↳ card (auto)</span>
      <span class="dvp-val">{{ bioCard.j }} · {{ bioCard.title }}</span>
    </div>
  </template>
  <template v-else>
    <div class="dvp-row">
      <span class="dvp-label">local pos</span>
      <span class="dvp-val">{{ Math.round((kf().t ?? 0.5) * 100) }}</span>
    </div>
    <input v-model.number="kf().t" type="range" min="0" max="1" step="0.005" />
  </template>

  <div class="dvp-row">
    <span class="dvp-label">intensity</span>
    <span class="dvp-val">{{ kf().intensity.toFixed(1) }}</span>
  </div>
  <input v-model.number="kf().intensity" type="range" min="0" max="30" step="0.5" />

  <label class="dvp-row">
    <span class="dvp-label">color</span>
    <input v-model="kf().color" type="color" />
  </label>

  <div class="dvp-row"><span class="dvp-label">position</span></div>
  <div v-for="axis in AXES" :key="`p${axis}`" class="dvp-axis">
    <span class="dvp-axis-k">{{ axis }}</span>
    <input v-model.number="kf().position[axis]" type="range" min="-2" max="2" step="0.01" />
    <span class="dvp-axis-v">{{ kf().position[axis].toFixed(2) }}</span>
  </div>

  <div class="dvp-row">
    <span class="dvp-label">aim</span>
    <span v-if="kf().targetAnchor === 'head'" class="dvp-tag">head</span>
  </div>
  <div v-for="axis in AXES" :key="`t${axis}`" class="dvp-axis">
    <span class="dvp-axis-k">{{ axis }}</span>
    <input v-model.number="kf().target[axis]" type="range" min="-1.5" max="1.5" step="0.01" />
    <span class="dvp-axis-v">{{ kf().target[axis].toFixed(2) }}</span>
  </div>

  <div class="dvp-row">
    <span class="dvp-label">cone angle</span>
    <span class="dvp-val">{{ (kf().angle ?? 0).toFixed(2) }}</span>
  </div>
  <input v-model.number="kf().angle" type="range" min="0.05" max="1.4" step="0.01" />

  <div class="dvp-row">
    <span class="dvp-label">penumbra</span>
    <span class="dvp-val">{{ (kf().penumbra ?? 0).toFixed(2) }}</span>
  </div>
  <input v-model.number="kf().penumbra" type="range" min="0" max="1" step="0.02" />

  <label class="dvp-row">
    <span class="dvp-label">effect</span>
    <select v-model="kf().effect!.type" class="dvp-select">
      <option v-for="opt in SPOT_EFFECT_TYPES" :key="opt" :value="opt">{{ opt }}</option>
    </select>
  </label>
  <template v-if="kf().effect && kf().effect!.type !== 'none'">
    <div class="dvp-row">
      <span class="dvp-label">· amount</span>
      <span class="dvp-val">{{ (kf().effect!.amount ?? 0).toFixed(2) }}</span>
    </div>
    <input v-model.number="kf().effect!.amount" type="range" min="0" max="1.5" step="0.02" />
    <div class="dvp-row">
      <span class="dvp-label">· speed</span>
      <span class="dvp-val">{{ (kf().effect!.speed ?? 0).toFixed(1) }}</span>
    </div>
    <input v-model.number="kf().effect!.speed" type="range" min="0" max="40" step="0.5" />
  </template>
</template>
