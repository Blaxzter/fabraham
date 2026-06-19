<script setup lang="ts">
// The "scenes" tab: one collapsible row per scroll section (the scene spine in
// the sections store). It's a single-open accordion that FOLLOWS the scroll —
// whenever the active section changes (derived from scroll progress) the panel
// opens that scene — while still letting you click any scene open manually.
//
// The biography section ("the path so far") is one scroll section but renders
// several milestones, each with its own set-piece; we expand it into its
// individual milestones here (and follow the scroll down to the active one).
//
// Each scene / milestone shows its camera pose, its set-pieces, and the tuning
// groups that belong to it (routed by set-piece name / section tag in
// useDevPanelGroups). A set-piece's controls appear wherever it's used.
import { computed, ref, watch } from "vue";
import { bioMilestoneCenter } from "~/stores/sections";
import TuningGroupBlock from "./TuningGroupBlock.vue";
import SceneKeyframes from "./SceneKeyframes.vue";

const sections = useSectionsStore();
const { milestones } = useBiographyMilestones();
const { groupsFor } = useDevPanelGroups();

const activeId = computed(() => sections.sections[sections.activeIndex]?.id);

// Scene-level accordion: follows the active scene, manual click pins another.
const openId = ref<string | undefined>(activeId.value);
watch(activeId, (id) => (openId.value = id));
const toggle = (id: string) => (openId.value = openId.value === id ? undefined : id);

const isBiography = (type: string) => type === "biography";

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
const biographyActive = computed(
  () => sections.sections[sections.activeIndex]?.type === "biography"
);

// Milestone-level accordion (nested), follows the active milestone while you
// scroll through the biography section.
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
  <p v-if="!sections.sections.length" class="dvp-hint">No sections registered.</p>

  <section
    v-for="(s, i) in sections.sections"
    :key="s.id"
    class="dvp-sec dvp-scene"
    :class="{ active: i === sections.activeIndex }"
  >
    <header class="dvp-sec-head">
      <button class="dvp-sec-toggle" @click="toggle(s.id)">
        <span class="dvp-caret">{{ openId === s.id ? "▾" : "▸" }}</span>
        <span class="dvp-sec-title">{{ s.title || s.id }}</span>
        <span class="dvp-scene-type">{{ s.type }}</span>
      </button>
      <span v-if="i === sections.activeIndex" class="dvp-scene-live">
        {{ Math.round(sections.localProgress * 100) }}%
      </span>
    </header>

    <div v-if="openId === s.id" class="dvp-sec-body">
      <!-- scene meta -->
      <div class="dvp-row">
        <span class="dvp-label">order · weight</span>
        <span class="dvp-val">{{ s.order }} · {{ s.weight }}</span>
      </div>
      <div v-if="s.accent" class="dvp-row">
        <span class="dvp-label">accent</span>
        <span class="dvp-inline">
          <span class="dvp-swatch" :style="{ background: s.accent }" />
          <span class="dvp-val">{{ s.accent }}</span>
        </span>
      </div>
      <div v-if="s.setPiece?.length" class="dvp-row">
        <span class="dvp-label">set-pieces</span>
        <span>
          <span v-for="p in s.setPiece" :key="p" class="dvp-tag">{{ p }}</span>
        </span>
      </div>

      <!-- Editable camera + spotlight keyframes anchored to this scene. -->
      <SceneKeyframes :section-id="s.id" />

      <!-- the biography section expands into its individual milestones -->
      <template v-if="isBiography(s.type)">
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
          v-for="group in groupsFor(s.id, s.setPiece)"
          :key="group.id"
          :group="group"
        />
        <p v-if="!groupsFor(s.id, s.setPiece).length" class="dvp-hint">
          No tunable params for this scene yet.
        </p>
      </template>
    </div>
  </section>
</template>
