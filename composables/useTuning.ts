import { reactive, ref } from "vue";
import type { Ref } from "vue";
import type { TuneMeta, Vec3Val } from "~/stores/tuning";

/**
 * Register tunable params for a component and get back reactive handles.
 *
 *   const t = useTuning("signalField", "Signal Field");
 *   const forehead = t.vec3("forehead", { x: 0.08, y: 0.3, z: 0.2 }, { gizmo: true });
 *   const period   = t.num("period", 2.6, { min: 0.5, max: 8, step: 0.1 });
 *   // read forehead.x / period.value — live-editable via the TuningPanel in dev.
 *
 * In dev these are backed by the tuning store (panel-editable, persisted,
 * exportable). In production the composable returns plain refs of the defaults —
 * no store, no panel, no persistence — so the registered defaults ARE the values
 * and there is zero runtime cost.
 */
export interface TuningHandle {
  num: (key: string, def: number, meta?: TuneMeta) => Ref<number>;
  vec3: (key: string, def: Vec3Val, meta?: TuneMeta) => Vec3Val;
  color: (key: string, def: string, meta?: TuneMeta) => Ref<string>;
  bool: (key: string, def: boolean, meta?: TuneMeta) => Ref<boolean>;
}

export function useTuning(groupId: string, groupLabel?: string): TuningHandle {
  if (!import.meta.dev) {
    return {
      num: (_k, def) => ref(def),
      vec3: (_k, def) => reactive({ ...def }),
      color: (_k, def) => ref(def),
      bool: (_k, def) => ref(def),
    };
  }
  const store = useTuningStore();
  return {
    num: (key, def, meta) => store.num(groupId, groupLabel, key, def, meta),
    vec3: (key, def, meta) => store.vec3(groupId, groupLabel, key, def, meta),
    color: (key, def, meta) => store.color(groupId, groupLabel, key, def, meta),
    bool: (key, def, meta) => store.bool(groupId, groupLabel, key, def, meta),
  };
}
