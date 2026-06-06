import { computed, watchEffect } from "vue";
import type {
  Align,
  BiographyMilestone,
  Section,
  SectionType,
  SetPieceName,
  Vec3,
} from "~/types/section";

const toVec3 = (tuple: unknown): Vec3 => {
  const [x = 0, y = 0, z = 0] = Array.isArray(tuple) ? (tuple as number[]) : [];
  return { x, y, z };
};

/**
 * Loads the `content/sections` collection and normalizes it into the shape the
 * 3D/animation layer needs, syncing it into the sections store. The markdown
 * bodies stay queryable for `<ContentRenderer>` (SSG-ready for SEO, #5).
 *
 * `useAsyncData` dedupes by key, so Scene3D and ScrollableContent can both call
 * this without double-fetching.
 */
export function useSections() {
  const store = useSectionsStore();

  const { data, pending, error, refresh } = useAsyncData("sections-data", () =>
    queryCollection("sections").order("order", "ASC").all()
  );

  const docs = computed(() => data.value ?? []);

  const sections = computed<Section[]>(() =>
    docs.value.map((doc) => ({
      id: doc.path ?? doc.id ?? doc.title,
      order: doc.order ?? 0,
      type: (doc.type as SectionType) ?? "interlude",
      title: doc.title ?? "",
      subtitle: doc.subtitle,
      weight: doc.weight ?? 1,
      layout: {
        align: (doc.align as Align) ?? "center",
        offset: doc.offset ?? undefined,
        maxWidth: doc.maxWidth,
      },
      setPiece: (doc.setPiece as SetPieceName[] | undefined) ?? [],
      setPieceVariant: doc.setPieceVariant ?? "",
      accent: doc.accent,
      camera: {
        position: toVec3(doc.cameraPosition),
        rotation: toVec3(doc.cameraRotation),
      },
      data: doc.data as Record<string, unknown> | undefined,
      path: doc.path,
    }))
  );

  // Keep the store in sync whenever the content (re)loads.
  watchEffect(() => store.setSections(sections.value));

  return { docs, sections, pending, error, refresh };
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
