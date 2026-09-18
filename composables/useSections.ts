import { computed, watch, watchEffect } from "vue";
import { useWindowSize } from "@vueuse/core";
import type { BiographyMilestone, SetPieceName } from "~/types/section";
import { SECTION_DEFS, spineOf } from "~/components/home/sections/registry";
import {
  BIO_RAIL_MAX_PX,
  biographyHeadKeyframes,
  biographySpotKeyframes,
} from "~/components/home/sections/biography";
import type { BioFraming } from "~/components/home/sections/biography";
import { frameHalfAt } from "~/lib/frame";

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

/**
 * Generates the biography chapter's 3D choreography from the loaded milestones and
 * writes it into the editable stores: the head's swerve + gaze
 * (`sections.headKeyframes.biography`) and the key/fill beats that light it
 * (`spotlights` tracks). The formulas — and the reasoning behind every number —
 * live in `components/home/sections/biography.ts`, alongside the card layout the
 * DOM reads, so the cards and the gaze can never drift apart.
 *
 * Why this runs at runtime at all: the skills chapter can generate its tracks at
 * module-eval time because `SKILL_CLUSTERS.length` is a constant, but the
 * biography's cards are a `@nuxt/content` collection — count, sides and accents
 * only exist once the query resolves. So the generators are driven from here
 * instead of from `registry.ts` / `spotlights.ts`.
 *
 * The watcher is keyed on a SIGNATURE of everything the generators read (the cards
 * and the section layout that frames them), not on the milestone array itself, for
 * two reasons: it must not re-run on every reactive tick, and it must not clobber
 * live dev-panel keyframe edits — which it would, since both setters overwrite the
 * whole section's track.
 *
 * Called once, from `BiographySection.vue` — the component that already owns the
 * card layout and is mounted for the life of the page (SectionHost renders every
 * section unconditionally). Deliberately NOT a `watchEffect`: that would track the
 * stores it writes to.
 */
export function useBiographyChoreography() {
  const store = useSectionsStore();
  const spots = useSpotlightsStore();
  const { milestones } = useBiographyMilestones();

  const section = computed(() => {
    const i = store.sections.findIndex((s) => s.type === "biography");
    return i < 0 ? null : { id: store.sections[i]!.id, index: i };
  });

  // The viewport, as the two things the choreography actually needs from it: the
  // shape of the lens (which decides how much room the head has) and the width
  // (which decides which DOM layout the cards are in). `initialWidth/Height` are
  // given explicitly because @vueuse defaults them to `Infinity` on the server,
  // and `Infinity / Infinity` is NaN — during prerender this has to resolve to the
  // wide composition, which is also the one the static html is laid out for.
  const { width: winW, height: winH } = useWindowSize({
    initialWidth: 1920,
    initialHeight: 1080,
  });

  /**
   * Quantised on purpose. The signature below is a string compare, so every
   * distinct aspect regenerates the whole chapter's tracks — and on mobile Safari
   * `innerHeight` changes the moment the URL bar hides, mid-scroll. Rounding to
   * 0.02 collapses that (0.462 and 0.513 both land inside one step of each other's
   * composition, a difference of ~1% of the head's drop) while still telling
   * portrait from landscape and a phone from a tablet.
   */
  const aspect = computed(() => {
    const a = (winW.value || 1) / (winH.value || 1);
    return Math.round(a * 50) / 50;
  });

  // How the chapter is framed on the page AND in the lens — derived from the live
  // section weights so the gaze re-times itself if a section is inserted or
  // reweighted (exactly like every anchored keyframe does), and from the live
  // viewport so it re-composes when the screen is rotated or resized.
  const framing = computed<BioFraming | null>(() => {
    const s = section.value;
    if (!s) return null;
    const start = store.boundaries[s.index] ?? 0;
    const end = store.boundaries[s.index + 1] ?? 1;
    // The chapter's own camera distance: the frame the cards are measured against
    // is the one THIS section is shot at, so read it from the spine rather than
    // restating 1.3 anywhere (`registry.ts` owns that number).
    const camZ = store.sections[s.index]?.camera?.position?.z ?? 1.3;
    const half = frameHalfAt(aspect.value, camZ);
    return {
      start,
      span: end - start || 1,
      // SectionHost sizes each section at `weight * 100vh`, so the document is
      // exactly the summed weights tall, measured in viewport heights.
      pageVh: store.sections.reduce((a, x) => a + (x.weight || 1), 0) || 1,
      halfW: half.w,
      halfH: half.h,
      rail: winW.value <= BIO_RAIL_MAX_PX,
      viewportW: winW.value || 1,
    };
  });

  const signature = computed(() => {
    const s = section.value;
    const f = framing.value;
    const ms = milestones.value;
    if (!s || !f || !ms.length) return "";
    return [
      s.id,
      f.start.toFixed(5),
      f.span.toFixed(5),
      f.pageVh.toFixed(3),
      // The frame, on the same footing as the layout: a rotation changes where the
      // head can be just as surely as adding a section changes when it gets there.
      f.halfW.toFixed(4),
      f.halfH.toFixed(4),
      f.rail ? "rail" : "zigzag",
      // Only matters in the rail layout (it places the rail the head looks at),
      // and rounded to 20px so dragging a desktop window costs nothing.
      f.rail ? Math.round(f.viewportW / 20) : 0,
      ...ms.map(
        (m) => `${m.side}/${m.accent ?? ""}/${m.offset?.x ?? 0}/${m.offset?.y ?? 0}`
      ),
    ].join("|");
  });

  watch(
    signature,
    (sig) => {
      const s = section.value;
      const f = framing.value;
      if (!sig || !s || !f) return; // content not loaded / no biography section
      store.setHeadKeyframes(s.id, biographyHeadKeyframes(milestones.value, f));
      const lights = biographySpotKeyframes(milestones.value, f);
      spots.setSectionKeyframes("key", s.id, lights.key);
      spots.setSectionKeyframes("fill", s.id, lights.fill);
    },
    { immediate: true }
  );
}
