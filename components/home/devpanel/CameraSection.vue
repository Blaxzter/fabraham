<script setup lang="ts">
// The camera / positioning workflow: switch between scroll-driven and free
// orbit, read the live pose, and copy it as a registry-ready snippet to paste
// into a section's `camera` in components/home/sections/registry.ts.
import { computed, ref } from "vue";

const store = useSceneControlStore();
const timeline = useSectionsStore();

// Scroll mode → the timeline owns the camera; orbit mode → OrbitControls do.
// Toggling enable/disable mirrors the old ControlsPanel behaviour exactly.
const onModeChange = () => {
  if (store.cameraControlMode === "scroll") timeline.enable();
  else timeline.disable();
};

const fmt = (n: number) => n.toFixed(2);

// The section (+ biography card) + local position the current scroll falls in —
// so a copied camera keyframe is anchored where you are (paste into that section's
// cameraKeyframes). Drives both the snippet AND its label, so they always agree.
const here = computed(() => timeline.anchorAt(timeline.progress));
const hereLabel = computed(() => {
  const a = here.value;
  const card = a.milestone != null ? ` card ${a.milestone}` : "";
  return `${a.section || "?"}${card} ${Math.round(a.t * 100)}%`;
});

const copied = ref<"" | "pose" | "kf">("");
const flash = (which: "pose" | "kf") => {
  copied.value = which;
  setTimeout(() => (copied.value = ""), 1300);
};
const write = async (text: string, which: "pose" | "kf") => {
  try {
    await navigator.clipboard.writeText(text);
    flash(which);
  } catch {
    /* clipboard blocked — ignore */
  }
};

// Single pose for a section's `camera:` field (held at the section centre).
const copyPose = () => {
  const p = store.cameraPosition;
  const r = store.cameraRotation;
  write(
    `camera: { position: v3(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}), rotation: v3(${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.z)}) },`,
    "pose"
  );
};

// One entry for a section's `cameraKeyframes` — anchored at the current local t
// so the camera pans THROUGH it as you scroll the section it belongs to.
const copyKeyframe = () => {
  const p = store.cameraPosition;
  const r = store.cameraRotation;
  const a = here.value;
  const ms = a.milestone != null ? ` milestone: ${a.milestone},` : "";
  write(
    `{ t: ${fmt(a.t)},${ms} position: v3(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}), rotation: v3(${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.z)}) },`,
    "kf"
  );
};
</script>

<template>
  <div class="dvp-field">
    <label class="dvp-row">
      <span class="dvp-label">Mode</span>
      <select
        v-model="store.cameraControlMode"
        class="dvp-select"
        @change="onModeChange"
      >
        <option value="scroll">Scroll</option>
        <option value="orbit">Orbit (free)</option>
      </select>
    </label>
  </div>

  <div class="dvp-field dvp-readout">
    <div class="dvp-row">
      <span class="dvp-label">pos</span>
      <span class="dvp-val">
        {{ fmt(store.cameraPosition.x) }}, {{ fmt(store.cameraPosition.y) }},
        {{ fmt(store.cameraPosition.z) }}
      </span>
    </div>
    <div class="dvp-row">
      <span class="dvp-label">rot</span>
      <span class="dvp-val">
        {{ fmt(store.cameraRotation.x) }}, {{ fmt(store.cameraRotation.y) }},
        {{ fmt(store.cameraRotation.z) }}
      </span>
    </div>
  </div>

  <button class="dvp-btn dvp-btn-block" @click="copyPose">
    {{ copied === "pose" ? "copied pose" : "copy camera pose" }}
  </button>
  <button class="dvp-btn dvp-btn-block" @click="copyKeyframe">
    {{ copied === "kf" ? "copied keyframe" : `copy keyframe @ ${hereLabel}` }}
  </button>
  <p class="dvp-hint">
    <strong>pose</strong> → a section's <code>camera</code> (held at its centre).
    <strong>keyframe</strong> → an entry in that section's <code>cameraKeyframes</code>
    (the camera pans through several as you scroll the section). Anchored to where
    you are now: <code>{{ hereLabel }}</code>.
  </p>
</template>
