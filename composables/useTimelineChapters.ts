import { computed, watchEffect } from "vue";
import type { TimelineChapter, Vec3 } from "~/types/timeline";

const toVec3 = (tuple: unknown): Vec3 => {
  const [x = 0, y = 0, z = 0] = Array.isArray(tuple) ? (tuple as number[]) : [];
  return { x, y, z };
};

/**
 * Loads the `content/timeline` collection and normalizes it into the shape the
 * 3D/animation layer needs, syncing it into the timeline store. The markdown
 * bodies stay queryable for `<ContentRenderer>` (SEO once SSG lands, #5).
 *
 * `useAsyncData` dedupes by key, so Scene3D and ScrollableContent can both call
 * this without double-fetching. Returns the raw docs (for ContentRenderer) and
 * the normalized chapters.
 */
export function useTimelineChapters() {
  const timeline = useTimelineStore();

  const { data, pending, error, refresh } = useAsyncData("timeline-chapters", () =>
    queryCollection("timeline").order("order", "ASC").all()
  );

  const docs = computed(() => data.value ?? []);

  const chapters = computed<TimelineChapter[]>(() =>
    docs.value.map((doc) => ({
      id: doc.path ?? doc.id ?? doc.title,
      order: doc.order ?? 0,
      title: doc.title ?? "",
      subtitle: doc.subtitle,
      location: doc.location,
      weight: doc.weight ?? 1,
      setPiece: doc.setPiece ?? [],
      setPieceVariant: doc.setPieceVariant ?? "",
      accent: doc.accent,
      camera: {
        position: toVec3(doc.cameraPosition),
        rotation: toVec3(doc.cameraRotation),
      },
      path: doc.path,
    }))
  );

  // Keep the store in sync whenever the content (re)loads.
  watchEffect(() => timeline.setChapters(chapters.value));

  return { docs, chapters, pending, error, refresh };
}
