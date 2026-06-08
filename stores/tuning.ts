import { defineStore } from "pinia";
import { reactive, ref, computed, watch } from "vue";
import type { Ref } from "vue";
import tuningConfig from "~/tuning.config.json";

/**
 * Generic dev-only tuning layer.
 *
 * Any component registers tunable params (numbers, 3D points, colours, bools)
 * with one line via the `useTuning(group)` composable; the dev panel renders
 * live controls for all of them and `vec3` points flagged `gizmo` get a 3D marker
 * (TuningGizmos). Code stays the source of truth: the registered defaults are
 * canonical, edits persist to localStorage so reloads keep them, and the panel
 * "Copy" exports the current values to paste back into the config/consts.
 *
 * This store only exists in dev (the composable no-ops to plain values in prod),
 * so there is zero production cost and no behaviour change in the built site.
 */
export type TuneKind = "number" | "vec3" | "color" | "bool";

export interface Vec3Val {
  x: number;
  y: number;
  z: number;
}

export interface TuneMeta {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  /** vec3 only: render a 3D marker at this point so you can place it by eye. */
  gizmo?: boolean;
  /** vec3 only: interpret as an offset from the head centre rather than world. */
  anchor?: "world" | "head";
}

export interface TuneField extends TuneMeta {
  key: string;
  kind: TuneKind;
}

export interface TuneGroup {
  id: string;
  label: string;
  fields: TuneField[];
}

const LS_KEY = "fab:tuning";

// The committed config file is the deployed source of truth — what every visitor
// gets. It's a layer between the inline `useTuning` defaults and the dev-only
// localStorage scratchpad (see precedence in `register`). Same shape: group → key
// → value. Edited via the panel's "save to config file" (writes it on disk in dev).
type TuneConfig = Record<string, Record<string, unknown>>;
const config = tuningConfig as TuneConfig;

const clone = <T>(v: T): T =>
  typeof v === "object" && v !== null ? ({ ...v } as T) : v;

export const useTuningStore = defineStore("tuning", () => {
  const groups = reactive<Record<string, TuneGroup>>({});
  const values = reactive<Record<string, Record<string, unknown>>>({});
  // The "committed" baseline a `reset` returns to: config-file value if present,
  // else the inline default. (NOT the inline default alone — reset should go back
  // to what ships, not the factory fallback.)
  const defaults: Record<string, Record<string, unknown>> = {};

  const panelOpen = ref(false); // opens via the ⚙ toggle (so it never blocks the scene)

  // Persisted overrides loaded once (client only).
  let overrides: Record<string, Record<string, unknown>> = {};
  if (import.meta.client) {
    try {
      overrides = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      overrides = {};
    }
  }

  const ensureGroup = (id: string, label?: string) => {
    if (!groups[id]) groups[id] = { id, label: label || id, fields: [] };
    if (!values[id]) values[id] = {};
    if (!defaults[id]) defaults[id] = {};
  };

  const register = (
    groupId: string,
    groupLabel: string | undefined,
    key: string,
    kind: TuneKind,
    def: unknown,
    meta?: TuneMeta
  ) => {
    ensureGroup(groupId, groupLabel);
    // Reset baseline = committed config value if present, else the inline default.
    const cfg = config[groupId]?.[key];
    defaults[groupId]![key] = clone(cfg !== undefined ? cfg : def);
    if (!groups[groupId]!.fields.some((f) => f.key === key)) {
      groups[groupId]!.fields.push({ key, kind, ...meta });
    }
    if (values[groupId]![key] === undefined) {
      // Precedence: localStorage scratchpad (dev edits) → config file → inline default.
      const ov = overrides[groupId]?.[key];
      values[groupId]![key] =
        ov !== undefined
          ? clone(ov)
          : cfg !== undefined
            ? clone(cfg)
            : clone(def);
    }
  };

  const num = (
    groupId: string,
    groupLabel: string | undefined,
    key: string,
    def: number,
    meta?: TuneMeta
  ): Ref<number> => {
    register(groupId, groupLabel, key, "number", def, meta);
    return computed(() => values[groupId]![key] as number);
  };
  const vec3 = (
    groupId: string,
    groupLabel: string | undefined,
    key: string,
    def: Vec3Val,
    meta?: TuneMeta
  ): Vec3Val => {
    register(groupId, groupLabel, key, "vec3", def, meta);
    return values[groupId]![key] as Vec3Val; // reactive object
  };
  const color = (
    groupId: string,
    groupLabel: string | undefined,
    key: string,
    def: string,
    meta?: TuneMeta
  ): Ref<string> => {
    register(groupId, groupLabel, key, "color", def, meta);
    return computed(() => values[groupId]![key] as string);
  };
  const bool = (
    groupId: string,
    groupLabel: string | undefined,
    key: string,
    def: boolean,
    meta?: TuneMeta
  ): Ref<boolean> => {
    register(groupId, groupLabel, key, "bool", def, meta);
    return computed(() => values[groupId]![key] as boolean);
  };

  const resetGroup = (groupId: string) => {
    const d = defaults[groupId];
    if (!d) return;
    for (const k in d) values[groupId]![k] = clone(d[k]);
  };

  const exportGroup = (groupId: string) =>
    JSON.stringify(values[groupId] ?? {}, null, 2);

  // Write the current values to the committed tuning.config.json via the dev-only
  // endpoint, so they ship to everyone (no per-visitor calibration). On success
  // the saved values become the new reset baseline and the localStorage scratch is
  // dropped — the file is now the single source of truth. Dev-only by construction
  // (the panel that calls this never mounts in prod).
  const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
  const saveToFile = async () => {
    saveState.value = "saving";
    try {
      const payload = JSON.parse(JSON.stringify(values)) as typeof config;
      await $fetch("/api/_tuning", { method: "POST", body: payload });
      for (const g in payload) {
        defaults[g] ??= {};
        for (const k in payload[g]!) defaults[g]![k] = clone(payload[g]![k]);
      }
      if (import.meta.client) localStorage.removeItem(LS_KEY);
      saveState.value = "saved";
      setTimeout(() => (saveState.value = "idle"), 1500);
    } catch {
      saveState.value = "error";
      setTimeout(() => (saveState.value = "idle"), 2500);
    }
  };

  // Points (vec3 + gizmo) to mark in the 3D scene.
  const gizmoFields = computed(() => {
    const out: { group: string; field: TuneField; value: Vec3Val }[] = [];
    for (const gid in groups) {
      for (const f of groups[gid]!.fields) {
        if (f.kind === "vec3" && f.gizmo) {
          out.push({ group: gid, field: f, value: values[gid]![f.key] as Vec3Val });
        }
      }
    }
    return out;
  });

  // Persist edits (client).
  if (import.meta.client) {
    watch(
      values,
      () => {
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(values));
        } catch {
          /* quota / privacy mode — ignore */
        }
      },
      { deep: true }
    );
  }

  return {
    groups,
    values,
    panelOpen,
    num,
    vec3,
    color,
    bool,
    resetGroup,
    exportGroup,
    saveToFile,
    saveState,
    gizmoFields,
  };
});
