<script setup lang="ts">
// GLOBAL spotlight rig knobs (global tab). The per-keyframe editing lives in the
// scenes tab, under each scene (SceneKeyframes) — keyframes are section-anchored,
// so they belong with their scene. This section keeps only what isn't per-scene:
// master / enable / cones / base lighting + add/remove track + export.
import { ref } from "vue";

const store = useSpotlightsStore();

const copied = ref(false);
const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(store.exportJson());
    copied.value = true;
    setTimeout(() => (copied.value = false), 1300);
  } catch {
    /* clipboard blocked — ignore */
  }
};
</script>

<template>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Enable spotlights</span>
    <input v-model="store.enabled" type="checkbox" />
  </label>
  <div class="dvp-field">
    <label class="dvp-row">
      <span class="dvp-label">Master intensity</span>
      <span class="dvp-val">{{ store.master.toFixed(2) }}</span>
    </label>
    <input v-model.number="store.master" type="range" min="0" max="4" step="0.05" />
  </div>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Show beam cones</span>
    <input v-model="store.showCones" type="checkbox" />
  </label>
  <div v-if="store.showCones" class="dvp-field">
    <label class="dvp-row">
      <span class="dvp-label">Cone opacity</span>
      <span class="dvp-val">{{ store.coneOpacity.toFixed(2) }}</span>
    </label>
    <input v-model.number="store.coneOpacity" type="range" min="0" max="0.5" step="0.01" />
  </div>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Show markers (dev)</span>
    <input v-model="store.showHelpers" type="checkbox" />
  </label>
  <div class="dvp-field">
    <label class="dvp-row">
      <span class="dvp-label">Base fill</span>
      <span class="dvp-val">{{ store.baseFill.toFixed(2) }}</span>
    </label>
    <input v-model.number="store.baseFill" type="range" min="0" max="2" step="0.01" />
  </div>
  <div class="dvp-field">
    <label class="dvp-row">
      <span class="dvp-label">Base ambient</span>
      <span class="dvp-val">{{ store.baseAmbient.toFixed(2) }}</span>
    </label>
    <input v-model.number="store.baseAmbient" type="range" min="0" max="1" step="0.01" />
  </div>

  <div class="dvp-light-actions">
    <button class="dvp-btn" @click="store.addTrack()">+ add spot</button>
    <button class="dvp-btn" @click="copyJson">{{ copied ? "copied" : "copy JSON" }}</button>
    <button class="dvp-btn" @click="store.resetTracks()">reset</button>
  </div>
  <p class="dvp-hint">
    Per-keyframe editing (anchor, position, aim, effect) is in the
    <strong>scenes</strong> tab, under each scene. <code>copy JSON</code> exports all
    tracks to paste into <code>spotlights.ts</code>.
  </p>
</template>
