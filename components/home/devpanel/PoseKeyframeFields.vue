<script setup lang="ts">
// Controls for ONE pose keyframe (camera OR head), addressed by store coordinates
// (kind + section id + index) so it edits the sections store's editable map
// directly (mutate the store object, never a prop). Used by SceneKeyframes.
//
// In the biography scene the anchor is a single "position in section" slider — the
// card it lands on is derived automatically and shown read-only (so it matches the
// scroll); the keyframe still rides that card if cards are added/removed. Other
// scenes use a plain local-t slider. `grab` (capture the live orbit pose) is
// camera-only.
import { computed } from "vue";

const props = defineProps<{ kind: "camera" | "head"; sectionId: string; index: number }>();
const sections = useSectionsStore();
const scene = useSceneControlStore();
const { milestones } = useBiographyMilestones();

const AXES = ["x", "y", "z"] as const;
const map = () => (props.kind === "camera" ? sections.cameraKeyframes : sections.headKeyframes);
// Non-null asserted: the parent only renders this for existing keyframes.
const kf = () => map()[props.sectionId]![props.index]!;

const isBiography = computed(
  () => sections.sections.find((s) => s.id === props.sectionId)?.type === "biography"
);
// Biography: one "position in section" value ⇄ (nearest card, within-card t).
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

// Capture the current (orbit-mode) camera pose into a CAMERA keyframe — the
// natural workflow: switch to Orbit, frame the shot, grab.
const grabPose = () => {
  const k = kf();
  k.position.x = scene.cameraPosition.x;
  k.position.y = scene.cameraPosition.y;
  k.position.z = scene.cameraPosition.z;
  k.rotation.x = scene.cameraRotation.x;
  k.rotation.y = scene.cameraRotation.y;
  k.rotation.z = scene.cameraRotation.z;
};
</script>

<template>
  <!-- Anchor -->
  <template v-if="isBiography">
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

  <div class="dvp-row"><span class="dvp-label">position</span></div>
  <div v-for="axis in AXES" :key="`p${axis}`" class="dvp-axis">
    <span class="dvp-axis-k">{{ axis }}</span>
    <input v-model.number="kf().position[axis]" type="range" min="-3" max="3" step="0.01" />
    <span class="dvp-axis-v">{{ kf().position[axis].toFixed(2) }}</span>
  </div>

  <div class="dvp-row"><span class="dvp-label">rotation</span></div>
  <div v-for="axis in AXES" :key="`r${axis}`" class="dvp-axis">
    <span class="dvp-axis-k">{{ axis }}</span>
    <input v-model.number="kf().rotation[axis]" type="range" min="-1.57" max="1.57" step="0.01" />
    <span class="dvp-axis-v">{{ kf().rotation[axis].toFixed(2) }}</span>
  </div>

  <button v-if="kind === 'camera'" class="dvp-btn dvp-btn-block" @click="grabPose">
    grab current orbit pose
  </button>
</template>
