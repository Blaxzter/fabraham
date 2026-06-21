<script setup lang="ts">
// One scene's editable body, lifted out of the old ScenesTab so the dev panel's
// Editor pane can show it on its own (focused on the scene the scroll is on).
// Renders the scene meta + its Camera/Head/Spotlight keyframes (SceneKeyframes)
// and the tuning groups routed to this scene / its set-pieces. The biography
// scene additionally expands into its milestones (each a sub-beat with its own
// set-piece tuning), following the scroll down to the active one — exactly as the
// scenes accordion did, just scoped to a single section.
import { computed, ref, watch } from "vue";
import { bioMilestoneCenter } from "~/stores/sections";
import type { Section } from "~/types/section";
import TuningGroupBlock from "./TuningGroupBlock.vue";
import SceneKeyframes from "./SceneKeyframes.vue";

const props = defineProps<{ section: Section }>();
const sections = useSectionsStore();
const { milestones } = useBiographyMilestones();
const { groupsFor } = useDevPanelGroups();

const isBiography = computed(() => props.section.type === "biography");
const activeId = computed(() => sections.sections[sections.activeIndex]?.id);
// Milestone highlighting only means anything while THIS biography scene is active.
const biographyActive = computed(
  () => isBiography.value && activeId.value === props.section.id
);

// The active biography milestone (nearest milestone center to the in-section
// progress) — only meaningful while biography is the active section.
const bioActiveIndex = computed(() => {
  const n = milestones.value.length;
  if (!n) return -1;
  const lp = sections.localProgress;
  let best = 0;
  let bestDist = Infinity;
  for (let j = 0; j < n; j++) {
    const dist = Math.abs(lp - bioMilestoneCenter(j, n));
    if (dist < bestDist) {
      bestDist = dist;
      best = j;
    }
  }
  return best;
});

// Milestone-level accordion (nested), follows the active milestone while you
// scroll through the biography section; a manual click pins another.
const openMilestoneId = ref<string | undefined>();
watch(
  () =>
    biographyActive.value ? milestones.value[bioActiveIndex.value]?.id : undefined,
  (id) => {
    if (id) openMilestoneId.value = id;
  }
);
const toggleMilestone = (id: string) =>
  (openMilestoneId.value = openMilestoneId.value === id ? undefined : id);
</script>

<template>
  <!-- scene meta -->
  <div class="dvp-row">
    <span class="dvp-label">order · weight</span>
    <span class="dvp-val">{{ section.order }} · {{ section.weight }}</span>
  </div>
  <div v-if="section.accent" class="dvp-row">
    <span class="dvp-label">accent</span>
    <span class="dvp-inline">
      <span class="dvp-swatch" :style="{ background: section.accent }" />
      <span class="dvp-val">{{ section.accent }}</span>
    </span>
  </div>
  <div v-if="section.setPiece?.length" class="dvp-row">
    <span class="dvp-label">set-pieces</span>
    <span>
      <span v-for="p in section.setPiece" :key="p" class="dvp-tag">{{ p }}</span>
    </span>
  </div>

  <!-- Editable camera + head + spotlight keyframes anchored to this scene. -->
  <SceneKeyframes :section-id="section.id" />

  <!-- the biography section expands into its individual milestones -->
  <template v-if="isBiography">
    <p class="dvp-hint">Milestones (each a sub-beat of this section):</p>
    <section
      v-for="(m, j) in milestones"
      :key="m.id"
      class="dvp-sec dvp-milestone"
      :class="{ active: biographyActive && j === bioActiveIndex }"
    >
      <header class="dvp-sec-head">
        <button class="dvp-sec-toggle" @click="toggleMilestone(m.id)">
          <span class="dvp-caret">{{ openMilestoneId === m.id ? "▾" : "▸" }}</span>
          <span class="dvp-sec-title">{{ m.title || m.id }}</span>
        </button>
      </header>
      <div v-if="openMilestoneId === m.id" class="dvp-sec-body">
        <div v-if="m.setPiece?.length" class="dvp-row">
          <span class="dvp-label">set-pieces</span>
          <span>
            <span v-for="p in m.setPiece" :key="p" class="dvp-tag">{{ p }}</span>
          </span>
        </div>
        <TuningGroupBlock
          v-for="group in groupsFor(undefined, m.setPiece)"
          :key="group.id"
          :group="group"
        />
        <p v-if="!groupsFor(undefined, m.setPiece).length" class="dvp-hint">
          No tunable params for this milestone's set-pieces yet.
        </p>
      </div>
    </section>
  </template>

  <!-- tuning groups for a regular (non-biography) scene -->
  <template v-else>
    <TuningGroupBlock
      v-for="group in groupsFor(section.id, section.setPiece)"
      :key="group.id"
      :group="group"
    />
    <p v-if="!groupsFor(section.id, section.setPiece).length" class="dvp-hint">
      No tunable params for this scene yet.
    </p>
  </template>
</template>
