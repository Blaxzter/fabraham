import { ref } from "vue";

/**
 * Shared "copy / reset" actions for a tuning group, used by the dev panel's
 * global group list and the per-scene group list. `copied` holds the id of the
 * group whose values were just copied (for the transient "copied" label).
 */
export function useTuningGroupCopy() {
  const store = useTuningStore();
  const copied = ref<string | null>(null);

  const copyGroup = async (id: string) => {
    try {
      await navigator.clipboard.writeText(store.exportGroup(id));
      copied.value = id;
      setTimeout(() => (copied.value = null), 1300);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return { copied, copyGroup, resetGroup: store.resetGroup };
}
