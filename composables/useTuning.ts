import { reactive, ref } from "vue";
import type { Ref } from "vue";
import type { TuneMeta, Vec3Val } from "~/stores/tuning";
import tuningConfig from "~/tuning.config.json";

const config = tuningConfig as Record<string, Record<string, unknown>>;

/**
 * Register tunable params for a component and get back reactive handles.
 *
 *   const t = useTuning("signalField", "Signal Field", "contact");
 *   const forehead = t.vec3("forehead", { x: 0.08, y: 0.3, z: 0.2 }, { gizmo: true });
 *   const period   = t.num("period", 2.6, { min: 0.5, max: 8, step: 0.1 });
 *   // read forehead.x / period.value — live-editable via the dev panel in dev.
 *
 * The optional third arg ties the group to a scroll-section id (registry.ts) so
 * the dev panel shows it under that scene; omit it for global groups.
 *
 * In dev these are backed by the tuning store (panel-editable, persisted,
 * exportable). In production the composable returns plain refs — no store, no
 * panel, no persistence — reading the committed `tuning.config.json` if it has a
 * value for the key, else the inline default. So the deployed values are whatever
 * was saved from the panel (config file), with the inline defaults as fallback,
 * at zero runtime cost.
 */
export interface TuningHandle {
  num: (key: string, def: number, meta?: TuneMeta) => Ref<number>;
  vec3: (key: string, def: Vec3Val, meta?: TuneMeta) => Vec3Val;
  color: (key: string, def: string, meta?: TuneMeta) => Ref<string>;
  bool: (key: string, def: boolean, meta?: TuneMeta) => Ref<boolean>;
}

export function useTuning(
  groupId: string,
  groupLabel?: string,
  groupSection?: string
): TuningHandle {
  if (!import.meta.dev) {
    const g = config[groupId];
    return {
      num: (key, def) => ref((g?.[key] as number) ?? def),
      vec3: (key, def) =>
        reactive({ ...def, ...((g?.[key] as Partial<Vec3Val>) ?? {}) }),
      color: (key, def) => ref((g?.[key] as string) ?? def),
      bool: (key, def) => ref((g?.[key] as boolean) ?? def),
    };
  }
  const store = useTuningStore();
  return {
    num: (key, def, meta) =>
      store.num(groupId, groupLabel, key, def, meta, groupSection),
    vec3: (key, def, meta) =>
      store.vec3(groupId, groupLabel, key, def, meta, groupSection),
    color: (key, def, meta) =>
      store.color(groupId, groupLabel, key, def, meta, groupSection),
    bool: (key, def, meta) =>
      store.bool(groupId, groupLabel, key, def, meta, groupSection),
  };
}
