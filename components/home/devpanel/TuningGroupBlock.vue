<script setup lang="ts">
// One tuning group as a labelled block (group name + copy/reset + its fields),
// used inline under a scene or milestone in the scenes tab. The collapsible
// "global" groups use DevPanelSection instead; this is the flatter nested form.
import type { TuneGroup } from "~/stores/tuning";
import TuningGroupFields from "./TuningGroupFields.vue";

defineProps<{ group: TuneGroup }>();

const { copied, copyGroup, resetGroup } = useTuningGroupCopy();
</script>

<template>
  <div class="dvp-scene-group">
    <div class="dvp-sec-head">
      <span class="dvp-sec-title">{{ group.label }}</span>
      <span class="dvp-sec-actions">
        <button class="dvp-btn" @click.stop="copyGroup(group.id)">
          {{ copied === group.id ? "copied" : "copy" }}
        </button>
        <button class="dvp-btn" @click.stop="resetGroup(group.id)">reset</button>
      </span>
    </div>
    <TuningGroupFields :group="group" />
  </div>
</template>
