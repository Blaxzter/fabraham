<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useWindowSize } from "@vueuse/core";
import type { Section } from "~/types/section";
import type { ComponentPublicInstance } from "vue";
import BudCard from "./BudCard.vue";
import VineCard from "./VineCard.vue";
import {
  CARD_T,
  cardsFitFrame,
  registerCard,
  registerLabel,
  TEASERS,
} from "./projectsTeaser";

/**
 * The projects chapter's DOM half: four things growing on the vine that coils
 * around the head, and — hanging in the bush the vine ends in — the way through
 * to the full timeline.
 *
 * Everything here is REAL HTML — readable, crawlable, prerendered — but it is
 * positioned from inside the canvas. `ProjectVine` projects each bud (and the
 * shield's ring) through the live camera every frame and writes the transform
 * straight onto these nodes; it also writes `--born`, which is what each
 * vessel's own chrome stages off (see BudCard.vue). The bridge is a plain
 * module array rather than a store, for the reason `projectsTeaser.ts` gives.
 *
 * Which means: with no JavaScript, or before the scene mounts, these must still
 * be a sensible piece of page. They are — a plain stacked list with the link
 * under it, laid out by ordinary flow. The fixed-position, camera-driven mode
 * is opt-in, switched on only once the scene is actually driving them.
 */
const props = defineProps<{ section?: Section; visible?: boolean }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();

const store = useSectionsStore();

// The same collection the /projects page reads, so this teaser can never
// disagree with the timeline it is pointing at.
const { data } = await useAsyncData("projects-teaser", () =>
  queryCollection("projects").all()
);
/**
 * The curated few, in bud order — see `TEASERS`.
 *
 * Matched on the content file stem rather than on title or repo, because those
 * are prose and can be reworded; the filename is the stable handle. A slug with
 * no document drops out silently, so the list can name a project before it
 * exists without breaking the section.
 */
type ProjectDoc = NonNullable<typeof data.value>[number];
const bySlug = computed(() => {
  const map = new Map<string, ProjectDoc>();
  for (const d of data.value ?? []) {
    const slug = String(d.path ?? "").split("/").filter(Boolean).pop();
    if (slug) map.set(slug, d);
  }
  return map;
});
const picks = computed(() =>
  TEASERS.map((x) => {
    const doc = bySlug.value.get(x.slug);
    return { ...x, doc: doc && localizeProject(doc, locale.value) };
  })
    .filter((p): p is typeof p & { doc: ProjectDoc } => !!p.doc)
    .slice(0, CARD_T.length)
);

/**
 * The years the record covers, for the hanging label.
 *
 * Read off the collection rather than written down, so it cannot go stale the
 * next time `scripts/fetch-github-projects.mjs` adds a repository.
 */
const span = computed(() => {
  const years = (data.value ?? [])
    .map((d) => Number(String(d.date).slice(0, 4)))
    .filter((y) => Number.isFinite(y) && y > 1990);
  return years.length
    ? { from: Math.min(...years), to: Math.max(...years) }
    : { from: undefined, to: undefined };
});

/** Captured by `scripts/shoot-project-screens.mjs`; absent until it has been run. */
const shotOf = (path?: string) => {
  const slug = String(path ?? "").split("/").filter(Boolean).pop();
  return slug ? `/projects/${slug}.webp` : "";
};

const els = ref<(HTMLElement | null)[]>([]);
const label = ref<HTMLElement | null>(null);
const driven = ref(false);
const mounted = ref(false);

/** A template ref that may be a component instance or a bare element. */
type Reffed = Element | ComponentPublicInstance | null;
const nodeOf = (el: Reffed): HTMLElement | null => {
  if (!el) return null;
  const node = "$el" in el ? (el as ComponentPublicInstance).$el : el;
  // NOT a formality. A component whose template has anything before its root
  // element — even an eslint pragma comment — compiles to a FRAGMENT, and then
  // `$el` is that comment node rather than the anchor. It fails silently: the
  // scene is handed nothing, the cards keep the stylesheet's `opacity: 0`, and
  // the chapter renders a vine with three invisible holes in it.
  return node instanceof HTMLElement ? node : null;
};

// `initialWidth/Height` explicitly: @vueuse defaults them to Infinity on the
// server, and Infinity / Infinity is NaN — during prerender this has to resolve
// to the wide composition, which is the one the static HTML is laid out for.
const { width, height } = useWindowSize({ initialWidth: 1920, initialHeight: 1080 });

/** Narrow or short frames cannot hold every card; see `cardsFitFrame`. */
/**
 * …except on a portrait screen, where they always pin: the camera there rides
 * the vine bud to bud (`projectsPortraitCameraKeyframes`), so the frame each card
 * has to fit is one framed around its own bud rather than the whole coil.
 */
const canPin = computed(
  () =>
    mounted.value &&
    (store.portrait || cardsFitFrame(width.value / height.value, width.value))
);

/**
 * Hand the nodes to the scene — but only when there is both a scene to drive
 * them and room to put them. Otherwise they stay in ordinary flow layout, which
 * is also what a no-JS render gets.
 *
 * Unregistering is not enough on its own. The scene writes its transform,
 * opacity, visibility and `--born` as INLINE styles, and inline styles outrank
 * the stylesheet — so a node handed back mid-session would keep whatever the
 * last frame left on it and sit invisible in the middle of the flow layout.
 * Whoever takes a node out of the scene's hands has to clean up after it.
 */
const SCENE_PROPS = [
  "transform",
  "opacity",
  "visibility",
  "pointer-events",
  "--born",
  "--sap",
];
const release = (el: HTMLElement | null) => {
  if (!el) return;
  for (const p of SCENE_PROPS) el.style.removeProperty(p);
};

function sync() {
  const on = canPin.value;
  const list = els.value;
  for (let i = 0; i < CARD_T.length; i++) {
    const el = list[i] ?? null;
    if (on) registerCard(i, el);
    else {
      registerCard(i, null);
      release(el);
    }
  }
  if (on) registerLabel(label.value);
  else {
    registerLabel(null);
    release(label.value);
  }
  driven.value = on;
}
onMounted(() => {
  mounted.value = true;
  sync();
});
watch([picks, canPin], () => nextTick(sync));
onBeforeUnmount(() => {
  for (let i = 0; i < CARD_T.length; i++) registerCard(i, null);
  registerLabel(null);
});

const accent = computed(() => props.section?.accent ?? "#00ff9c");

/**
 * Let the shoot finish before the route changes.
 *
 * Short on purpose. The visitor has already decided — this is the follow-through
 * on a click, not an animation to sit through — and the thing worth watching is
 * on the other side, where the vine draws itself down the page. Long enough to
 * read as "it kept growing", not long enough to feel like the link is broken.
 *
 * Skipped outright under reduced motion, and if anything throws the navigation
 * still happens: the shield is a plain anchor with a real `href`, and this only
 * prevents the default once it owns the timer.
 */
const HANDOFF_MS = 260;
const leaving = ref(false);
const router = useRouter();
const { reducedMotion } = usePreferences();

function onHandoff(e: MouseEvent) {
  // Leave modified clicks (new tab, new window) completely alone.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  if (reducedMotion.value || leaving.value) return;
  e.preventDefault();
  leaving.value = true;
  setTimeout(() => router.push(localePath("/projects")), HANDOFF_MS);
}

onBeforeUnmount(() => {
  leaving.value = false;
});

// The chapter's own travel, for the heading — the cards and the shield get
// theirs from the vine's drawing tip instead.
const entered = computed(() => {
  const i = store.sections.findIndex((s) => s.type === "projects");
  if (i < 0) return props.visible ?? false;
  const start = store.boundaries[i] ?? 0;
  const end = store.boundaries[i + 1] ?? 1;
  return store.progress >= start - 0.03 && store.progress <= end + 0.02;
});
</script>

<template>
  <div
    class="projects"
    :class="{ 'is-driven': driven, portrait: store.portrait }"
    :style="{ '--accent': accent }"
  >
    <header class="head" :class="{ 'is-in': entered }">
      <p v-if="section?.subtitle" class="eyebrow">{{ t(`home.sections.${section.id}.subtitle`) }}</p>
      <h2 v-if="section?.title">{{ t(`home.sections.${section.id}.title`) }}</h2>
      <p class="lede">{{ t("home.projects.lede") }}</p>
    </header>

    <div class="cards">
      <BudCard
        v-for="(p, i) in picks"
        :key="p.slug"
        :ref="(el) => (els[i] = nodeOf(el as Reffed))"
        class="bud-card"
        :vessel="p.vessel"
        :href="p.doc.home || p.doc.url"
        :title="p.doc.title"
        :spec="p.doc.spec"
        :year="String(p.doc.date).slice(0, 4)"
        :shot="shotOf(p.doc.path)"
        :accent="p.doc.accent"
      />
    </div>

    <!-- The handoff. Not a button that happens to link somewhere: the thing the
         vine grew down into, tied to its last node. -->
    <VineCard
      :ref="(el) => (label = nodeOf(el as Reffed))"
      class="label-slot"
      :count="(data ?? []).length"
      :from="span.from"
      :to="span.to"
      :accent="accent"
      :leaving="leaving"
      @click="onHandoff"
    />
  </div>
</template>

<style scoped>
.projects {
  position: relative;
  height: 100%;
  pointer-events: none;
}

.head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(1.5rem, 6vh, 4rem) 1.5rem 1.5rem;
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.head.is-in { opacity: 1; transform: none; }
/* The face behind this is a field of small bright glyphs: per-letter shadows
   can't quiet it, so the whole block gets a soft, edgeless pool of dark. */
.head::before {
  content: "";
  position: absolute;
  top: -10%;
  bottom: -10%;
  left: 50%;
  width: min(56rem, 100%);
  transform: translateX(-50%);
  z-index: -1;
  background: radial-gradient(closest-side, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.45) 55%, transparent);
  pointer-events: none;
}
.eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.85), 0 0 22px rgba(0, 0, 0, 0.6);
}
h2 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.05;
  color: #fff;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.9), 0 0 44px rgba(0, 0, 0, 0.6);
}
.lede {
  max-width: 34rem;
  margin: 0.75rem 0 0;
  font-size: clamp(0.95rem, 1.4vw, 1.1rem);
  line-height: 1.5;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.94);
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.9), 0 0 22px rgba(0, 0, 0, 0.6);
}

/* ── Flow layout: what this is before the scene takes over ───────────────── */
/* Sticky is for the DRIVEN composition, where the heading holds the top of the
   frame while the scene plays under it. In flow — a phone, a short window — the
   cards are ordinary stacked content and a heading pinned over them just lands
   on whichever vessel is passing. */
.projects:not(.is-driven) .head { position: relative; }
/* Portrait, too: the camera is riding the vine underneath, and a heading pinned
   over the top third of a narrow frame sits on the bud it is riding to. It opens
   the chapter and scrolls away. */
.projects.portrait .head { position: relative; }
.cards {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: center;
  gap: 1.5rem 1rem;
  padding: 2rem 1.5rem 1rem;
}
.bud-card { pointer-events: auto; }
.label-slot {
  margin: 0 auto 3rem;
  pointer-events: auto;
}

/* ── Driven layout: the scene owns every transform ───────────────────────── */
/* `left/top: 0` because the transform written from the render loop is an
   absolute translate3d in canvas pixels — the node is moved entirely by it, and
   anchored by a point the scene picks (a card by its vessel's foot, the shield
   by its ring). */
.is-driven .cards {
  display: block;
  padding: 0;
}
.is-driven .bud-card,
.is-driven .label-slot {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 3;
  margin: 0;
  opacity: 0;
  will-change: transform, opacity;
}
/* Behind the bud cards: by the time the label arrives the camera has left them
   above the frame, but on the way down they pass each other. */
.is-driven .label-slot { z-index: 2; }

@media (prefers-reduced-motion: reduce) {
  .head { transition: none; }
}
</style>
