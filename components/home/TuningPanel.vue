<script setup lang="ts">
import { ref } from "vue";
import type { Vec3Val } from "~/stores/tuning";

// Dev-only live tuning panel. Renders controls for every param any component
// registered via useTuning(), edits the store (which the components read), and
// exports the current values to paste back into the typed defaults. Edits persist
// to localStorage so reloads keep them.
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
  <div class="tuning" :class="{ open: store.panelOpen }">
    <button class="tuning-toggle" title="Tuning panel" @click="store.panelOpen = !store.panelOpen">
      {{ store.panelOpen ? "×" : "⚙" }}
    </button>

    <div v-if="store.panelOpen" class="tuning-body">
      <p class="tuning-head">tuning · dev</p>

      <section v-for="group in store.groups" :key="group.id" class="grp">
        <header class="grp-head">
          <span class="grp-title">{{ group.label }}</span>
          <span class="grp-actions">
            <button @click="copyGroup(group.id)">
              {{ copied === group.id ? "copied" : "copy" }}
            </button>
            <button @click="store.resetGroup(group.id)">reset</button>
          </span>
        </header>

        <div v-for="f in group.fields" :key="f.key" class="field">
          <!-- number -->
          <template v-if="f.kind === 'number'">
            <label class="f-row">
              <span class="f-label">{{ f.label || f.key }}</span>
              <span class="f-val">{{ asNum(group.id, f.key)?.toFixed(2) }}</span>
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
            <div class="f-row">
              <span class="f-label">
                {{ f.label || f.key }}
                <span v-if="f.anchor === 'head'" class="tag">head</span>
                <span v-if="f.gizmo" class="tag">gizmo</span>
              </span>
            </div>
            <div v-for="axis in AXES" :key="axis" class="axis">
              <span class="axis-k">{{ axis }}</span>
              <input
                type="range"
                :min="f.min ?? -2"
                :max="f.max ?? 2"
                :step="f.step ?? 0.01"
                :value="asVec(group.id, f.key)?.[axis]"
                @input="setVec(group.id, f.key, axis, ($event.target as HTMLInputElement).value)"
              />
              <span class="axis-v">{{ asVec(group.id, f.key)?.[axis]?.toFixed(2) }}</span>
            </div>
          </template>

          <!-- color -->
          <template v-else-if="f.kind === 'color'">
            <label class="f-row">
              <span class="f-label">{{ f.label || f.key }}</span>
              <input
                type="color"
                :value="asStr(group.id, f.key)"
                @input="setStr(group.id, f.key, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </template>

          <!-- bool -->
          <template v-else-if="f.kind === 'bool'">
            <label class="f-row clickable">
              <span class="f-label">{{ f.label || f.key }}</span>
              <input
                type="checkbox"
                :checked="asBool(group.id, f.key)"
                @change="setBool(group.id, f.key, ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </template>
        </div>
      </section>

      <p v-if="!Object.keys(store.groups).length" class="empty">
        no tunable params registered yet
      </p>
    </div>
  </div>
</template>

<style scoped>
.tuning {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 100;
  font-family: "Courier New", monospace;
  color: #d6ffe9;
}
.tuning-toggle {
  position: absolute;
  top: 0;
  right: 0;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(0, 255, 156, 0.5);
  background: rgba(4, 10, 8, 0.8);
  color: #00ff9c;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.tuning-body {
  margin-top: 2.2rem;
  width: 17rem;
  max-height: 84vh;
  overflow-y: auto;
  padding: 0.6rem 0.7rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(0, 255, 156, 0.4);
  background: rgba(4, 10, 8, 0.86);
  backdrop-filter: blur(6px);
  font-size: 0.72rem;
  scrollbar-width: thin;
}
.tuning-head {
  margin: 0 0 0.5rem;
  font-size: 0.65rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  opacity: 0.55;
}
.grp {
  margin-bottom: 0.7rem;
  border-top: 1px solid rgba(0, 255, 156, 0.18);
  padding-top: 0.45rem;
}
.grp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}
.grp-title {
  color: #00ff9c;
  font-weight: 700;
}
.grp-actions button {
  margin-left: 0.3rem;
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  border: 1px solid rgba(0, 255, 156, 0.4);
  background: transparent;
  color: #9fe;
  cursor: pointer;
  font-size: 0.65rem;
}
.field {
  margin-bottom: 0.4rem;
}
.f-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
}
.f-row.clickable {
  cursor: pointer;
}
.f-label {
  opacity: 0.85;
}
.f-val,
.axis-v {
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
  min-width: 2.4rem;
  text-align: right;
}
.tag {
  margin-left: 0.25rem;
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.55rem;
  background: rgba(0, 255, 156, 0.15);
  color: #00ff9c;
}
.axis {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.axis-k {
  width: 0.8rem;
  opacity: 0.5;
  text-transform: uppercase;
}
input[type="range"] {
  flex: 1;
  accent-color: #00ff9c;
  min-width: 0;
}
input[type="number"] {
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 255, 156, 0.3);
  color: #d6ffe9;
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
}
.empty {
  opacity: 0.5;
}
</style>
