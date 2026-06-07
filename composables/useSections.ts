import { computed, watchEffect } from "vue";
import type { BiographyMilestone, SetPieceName } from "~/types/section";
import { SECTION_DEFS, spineOf } from "~/components/home/sections/registry";

/**
 * The top-level section sequence + scene spine, sourced from the typed registry
 * (`components/home/sections/registry.ts`) and synced into the sections store.
 *
 * The spine is config every section needs (order, type, weight, camera pose,
 * set-pieces, layout) — not content — so it lives in code, not markdown
 * frontmatter. Each def names its own dedicated component, so app-like sections
 * (hero, contact) are no longer forced through a `content/*.md` body. Markdown
 * is reserved for the biography milestones (`useBiographyMilestones`).
 *
 * Returns the full `defs` (component + layout mode) for the renderer, and keeps
 * only the store-held spine in Pinia (no Vue component in shared state).
 */
export function useSections() {
  const store = useSectionsStore();

  const defs = computed(() =>
    [...SECTION_DEFS].sort((a, b) => a.order - b.order)
  );

  // Keep the store's shared state in sync (single source for camera/reveal math).
  watchEffect(() => store.setSections(defs.value.map(spineOf)));

  return { defs };
}

/**
 * Loads the biographical milestones (rendered as one artistic cluster by the
 * biography section). Pure content — does not feed the camera store.
 */
export function useBiographyMilestones() {
  const { data, pending, error } = useAsyncData("biography-milestones", () =>
    queryCollection("biography").order("order", "ASC").all()
  );

  const docs = computed(() => data.value ?? []);

  const milestones = computed<BiographyMilestone[]>(() =>
    docs.value.map((doc) => ({
      id: doc.path ?? doc.id ?? doc.title,
      order: doc.order ?? 0,
      title: doc.title ?? "",
      subtitle: doc.subtitle,
      location: doc.location,
      accent: doc.accent,
      side: (doc.side as "left" | "right" | "auto") ?? "auto",
      offset: doc.offset ?? undefined,
      setPiece: (doc.setPiece as SetPieceName[] | undefined) ?? [],
      setPieceVariant: doc.setPieceVariant ?? "",
      path: doc.path,
    }))
  );

  return { docs, milestones, pending, error };
}
