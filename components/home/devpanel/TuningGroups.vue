<script setup lang="ts">
// Renders the dynamically-registered tuning groups (anything any component
// registered via useTuning): numbers / vec3 points / colors / bools. Ported
// verbatim from the old TuningPanel; edits the tuning store, which the
// components read. "copy" exports a group's values to paste back into defaults.
import { ref } from "vue";
import type { Vec3Val } from "~/stores/tuning";
import DevPanelSection from "./DevPanelSection.vue";

const store = useTuningStore();

const asNum = (g: string, k: string) => store.values[g]?.[k] as number;
const asVec = (g: string, k: string) => store.values[g]?.[k] as Vec3Val;
const asStr = (g: string, k: string) => store.values[g]?.[k] as string;
const asBool = (g: string, k: string) => store.values[g]?.[k] as boolean;

const setNum = (g: string, k: string, v: string) => {
  if (store.values[g]) store.values[g]![k] = parseFloat(v);
};
const setVec = (g: string, k: string, axis: "x" | "y" | "z", v: string) => {
  const vec = store.values[g]?.[k] as Vec3Val | undefined;
  if (vec) vec[axis] = parseFloat(v);
};
const setStr = (g: string, k: string, v: string) => {
  if (store.values[g]) store.values[g]![k] = v;
};
const setBool = (g: string, k: string, v: boolean) => {
  if (store.values[g]) store.values[g]![k] = v;
};

const hasRange = (min?: number, max?: number) =>
  typeof min === "number" && typeof max === "number";

const copied = ref<string | null>(null);
const copyGroup = async (g: string) => {
  try {
    await navigator.clipboard.writeText(store.exportGroup(g));
    copied.value = g;
    setTimeout(() => (copied.value = null), 1300);
  } catch {
    /* clipboard blocked — ignore */
  }
};

const AXES = ["x", "y", "z"] as const;
</script>

<template>
  <DevPanelSection
    v-for="group in store.groups"
    :key="group.id"
    :title="group.label"
  >
    <template #actions>
      <button class="dvp-btn" @click.stop="copyGroup(group.id)">
        {{ copied === group.id ? "copied" : "copy" }}
      </button>
      <button class="dvp-btn" @click.stop="store.resetGroup(group.id)">reset</button>
    </template>

    <div v-for="f in group.fields" :key="f.key" class="dvp-field">
      <!-- number -->
      <template v-if="f.kind === 'number'">
        <label class="dvp-row">
          <span class="dvp-label">{{ f.label || f.key }}</span>
          <span class="dvp-val">{{ asNum(group.id, f.key)?.toFixed(2) }}</span>
        </label>
        <input
          v-if="hasRange(f.min, f.max)"
          type="range"
          :min="f.min"
          :max="f.max"
          :step="f.step ?? 0.01"
          :value="asNum(group.id, f.key)"
          @input="setNum(group.id, f.key, ($event.target as HTMLInputElement).value)"
        />
        <input
          v-else
          type="number"
          :step="f.step ?? 0.01"
          :value="asNum(group.id, f.key)"
          @input="setNum(group.id, f.key, ($event.target as HTMLInputElement).value)"
        />
      </template>

      <!-- vec3 -->
      <template v-else-if="f.kind === 'vec3'">
        <div class="dvp-row">
          <span class="dvp-label">
            {{ f.label || f.key }}
            <span v-if="f.anchor === 'head'" class="dvp-tag">head</span>
            <span v-if="f.gizmo" class="dvp-tag">gizmo</span>
          </span>
        </div>
        <div v-for="axis in AXES" :key="axis" class="dvp-axis">
          <span class="dvp-axis-k">{{ axis }}</span>
          <input
            type="range"
            :min="f.min ?? -2"
            :max="f.max ?? 2"
            :step="f.step ?? 0.01"
            :value="asVec(group.id, f.key)?.[axis]"
            @input="setVec(group.id, f.key, axis, ($event.target as HTMLInputElement).value)"
          />
          <span class="dvp-axis-v">{{ asVec(group.id, f.key)?.[axis]?.toFixed(2) }}</span>
        </div>
      </template>

      <!-- color -->
      <template v-else-if="f.kind === 'color'">
        <label class="dvp-row">
          <span class="dvp-label">{{ f.label || f.key }}</span>
          <input
            type="color"
            :value="asStr(group.id, f.key)"
            @input="setStr(group.id, f.key, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- bool -->
      <template v-else-if="f.kind === 'bool'">
        <label class="dvp-row dvp-clickable">
          <span class="dvp-label">{{ f.label || f.key }}</span>
          <input
            type="checkbox"
            :checked="asBool(group.id, f.key)"
            @change="setBool(group.id, f.key, ($event.target as HTMLInputElement).checked)"
          />
        </label>
      </template>
    </div>
  </DevPanelSection>
</template>
