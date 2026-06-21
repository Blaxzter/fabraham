<script setup lang="ts">
// The dynamically-registered tuning groups that are NOT tied to a scene (global
// params, e.g. head addressing). Scene/set-piece groups are shown under their
// scene in SceneEditor instead (see useDevPanelGroups for the routing). Each
// global group is its own collapsible section with copy/reset actions.
import DevPanelSection from "./DevPanelSection.vue";
import TuningGroupFields from "./TuningGroupFields.vue";

const { copied, copyGroup, resetGroup } = useTuningGroupCopy();
const { globalGroups } = useDevPanelGroups();
</script>

<template>
  <DevPanelSection
    v-for="group in globalGroups"
    :key="group.id"
    :title="group.label"
  >
    <template #actions>
      <button class="dvp-btn" @click.stop="copyGroup(group.id)">
        {{ copied === group.id ? "copied" : "copy" }}
      </button>
      <button class="dvp-btn" @click.stop="resetGroup(group.id)">reset</button>
    </template>

    <TuningGroupFields :group="group" />
  </DevPanelSection>
</template>
