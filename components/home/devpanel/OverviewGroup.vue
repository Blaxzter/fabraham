<script setup lang="ts">
// One "group" of the keyframe overview: a mini-timeline + the clickable keyframe
// chips (camera / head / each spotlight track) for ONE scope — a whole scene OR a
// single biography milestone. Factored out so a top-level scene and a milestone
// sub-section render identically (the whole point: a milestone is "kinda a scene"
// with its own keyframes). Navigation-only — a chip parks the scroll at its
// keyframe (setProgress, by absolute scroll); the % shown is LOCAL to the scope
// (0..1 across the scene or the milestone's card window), so a centered keyframe
// reads 50% regardless of where the scope sits in the page.
type Chip = { resolved: number; frac: number; color?: string };
type Track = { id: string; chips: Chip[] };

defineProps<{
  camera: Chip[];
  head: Chip[];
  tracks: Track[];
  // 0..1 position of the live scroll within this scope, or null when the scroll
  // is elsewhere (then no playhead is drawn).
  playhead?: number | null;
}>();

const sections = useSectionsStore();
const pct = (v: number) => Math.round(v * 100);
const go = (resolved: number) => sections.setProgress(resolved);
const byResolved = (chips: Chip[]) => [...chips].sort((a, b) => a.resolved - b.resolved);
</script>

<template>
  <!-- mini timeline: keyframe ticks at LOCAL fraction; live playhead when here -->
  <div class="dvp-ov-tl">
    <span
      v-for="(c, ci) in camera"
      :key="`c${ci}`"
      class="dvp-ov-tick is-cam"
      :style="{ left: `${c.frac * 100}%` }"
    />
    <span
      v-for="(c, ci) in head"
      :key="`h${ci}`"
      class="dvp-ov-tick is-head"
      :style="{ left: `${c.frac * 100}%` }"
    />
    <template v-for="tr in tracks" :key="`tk-${tr.id}`">
      <span
        v-for="(c, ci) in tr.chips"
        :key="`${tr.id}-${ci}`"
        class="dvp-ov-tick is-spot"
        :style="{ left: `${c.frac * 100}%`, background: c.color }"
      />
    </template>
    <span
      v-if="playhead != null"
      class="dvp-ov-playhead"
      :style="{ left: `${playhead * 100}%` }"
    />
  </div>

  <!-- clickable chips — % is LOCAL to this scope; click navigates by abs scroll -->
  <div v-if="camera.length" class="dvp-ov-row">
    <span class="dvp-ov-k">cam</span>
    <button
      v-for="(c, ci) in byResolved(camera)"
      :key="ci"
      class="dvp-ov-kf"
      :title="`camera · ${pct(c.frac)}% local · ${pct(c.resolved)}% scroll`"
      @click="go(c.resolved)"
    >
      {{ pct(c.frac) }}%
    </button>
  </div>
  <div v-if="head.length" class="dvp-ov-row">
    <span class="dvp-ov-k">head</span>
    <button
      v-for="(c, ci) in byResolved(head)"
      :key="ci"
      class="dvp-ov-kf"
      :title="`head · ${pct(c.frac)}% local · ${pct(c.resolved)}% scroll`"
      @click="go(c.resolved)"
    >
      {{ pct(c.frac) }}%
    </button>
  </div>
  <div v-for="tr in tracks" :key="tr.id" class="dvp-ov-row">
    <span class="dvp-ov-k">{{ tr.id }}</span>
    <button
      v-for="(c, ci) in byResolved(tr.chips)"
      :key="ci"
      class="dvp-ov-kf dvp-ov-kf-spot"
      :style="{ borderColor: c.color }"
      :title="`${tr.id} · ${pct(c.frac)}% local · ${pct(c.resolved)}% scroll`"
      @click="go(c.resolved)"
    >
      {{ pct(c.frac) }}%
    </button>
  </div>
</template>
