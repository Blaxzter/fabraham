import type { Ref } from "vue";
import type { TuneMeta, Vec3Val } from "~/stores/tuning";

/**
 * Register tunable params for a component and get back reactive handles.
 *
 *   const t = useTuning("signalField", "Signal Field", "contact");
 *   const forehead = t.vec3("forehead", { x: 0.08, y: 0.3, z: 0.2 }, { gizmo: true });
 *   const period   = t.num("period", 2.6, { min: 0.5, max: 8, step: 0.1 });
 *   // read forehead.x / period.value — live-editable via the dev panel.
 *
 * The optional third arg ties the group to a scroll-section id (registry.ts) so
 * the dev panel shows it under that scene; omit it for global groups.
 *
 * Always backed by the tuning store, in production too: explore mode opens the
 * panel to visitors ("behind the scenes"), and a panel with no store behind it
 * would have nothing to show. Values come from the committed
 * `tuning.config.json` where it has the key, else the inline default; edits
 * live in memory until a reload. The cost over the old plain-ref path is a few
 * hundred reactive values, read through computeds.
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
