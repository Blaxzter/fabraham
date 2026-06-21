<script setup lang="ts">
// The keyframe / scene OVERVIEW — a compact, navigation-first map of the whole
// scroll. Every scene (in scroll order, top→bottom = scroll direction) shows the
// keyframes anchored to it: camera, head, and each spotlight track, as a mini
// timeline + clickable chips (see OverviewGroup). The biography ("the path so far")
// scene additionally expands into its MILESTONES — each set-piece card is "kinda a
// scene" with its OWN keyframes (those anchored to that milestone), rendered the
// same way and labelled with its set-piece(s), so you can navigate into a card and
// tune the keyframes that live there. Keyframe %s are LOCAL to their scope (the
// scene, or the milestone's card window). Clicking a header/keyframe parks the
// scroll there (setProgress). The active scene/milestone is highlighted and kept
// in view, with a live playhead. No deep editing — that's the Editor popover.
import { computed, nextTick, ref, watch } from "vue";
import type { CameraKeyframe } from "~/types/section";
import type { SpotKeyframe } from "~/types/spotlights";
import OverviewGroup from "./OverviewGroup.vue";

const sections = useSectionsStore();
const spots = useSpotlightsStore();
const { milestones } = useBiographyMilestones();

const pct = (v: number) => Math.round(v * 100);

type Chip = { resolved: number; frac: number; color?: string };
type Track = { id: string; chips: Chip[] };
type Group = { camera: Chip[]; head: Chip[]; tracks: Track[]; hasAny: boolean };

// Build the camera/head/spotlight chips of one scope: the keyframes of `sectionId`
// kept by `include` (used to split a section's keyframes between the whole-section
// scope and each milestone). The chip's `frac` is the keyframe's local position
// (its raw `t` — section fraction for a plain anchor, within-card fraction for a
// milestone anchor); `resolved` is the absolute scroll it navigates to.
const buildGroup = (sectionId: string, include: (k: CameraKeyframe | SpotKeyframe) => boolean): Group => {
  const poseChips = (kfs: CameraKeyframe[]) =>
    kfs.filter(include).map((k) => ({
      resolved: sections.resolveAt({ section: sectionId, t: k.t, milestone: k.milestone }),
      frac: k.t ?? 0.5,
    }));
  const camera = poseChips(sections.cameraKeyframes[sectionId] ?? []);
  const head = poseChips(sections.headKeyframes[sectionId] ?? []);
  const tracks = spots.tracks
    .map((tr) => ({
      id: tr.id,
      chips: tr.keyframes
        .filter((k) => k.section === sectionId && include(k))
        .map((k) => ({ resolved: sections.resolveAt(k), frac: k.t ?? 0.5, color: k.color })),
    }))
    .filter((t) => t.chips.length);
  return { camera, head, tracks, hasAny: !!(camera.length || head.length || tracks.length) };
};

// One row per scene, resolved once from the live stores (recomputes when the
// layout / keyframes / spotlight tracks / milestones change — never per frame).
const scenes = computed(() =>
  sections.sections.map((s, i) => {
    const bio = s.type === "biography";
    // Biography: the whole-section scope keeps only keyframes NOT pinned to a card
    // (the rest belong to their milestone sub-row); other scenes keep everything.
    const main = buildGroup(s.id, bio ? (k) => k.milestone == null : () => true);

    const subs = bio
      ? milestones.value.map((m, j) => ({
          j,
          title: m.title || m.id,
          pieces: m.setPiece ?? [],
          resolved: sections.resolveAt({ section: s.id, t: 0.5, milestone: j }),
          group: buildGroup(s.id, (k) => k.milestone === j),
        }))
      : [];

    return {
      s,
      i,
      range: [sections.boundaries[i] ?? 0, sections.boundaries[i + 1] ?? 1] as [number, number],
      main,
      subs,
    };
  })
);

const go = (resolved: number) => sections.setProgress(resolved);
const goScene = (i: number) => sections.setProgress(sections.anchors[i] ?? 0);

// The live scroll's position inside the active BIOGRAPHY section as (card, within-
// card t) — drives the active-milestone highlight + that milestone's playhead.
// Null unless biography is the active section. Recomputes per frame (cheap), but
// the heavy `scenes` map above does not (it never reads progress).
const bioCursor = computed(() => {
  const i = sections.activeIndex;
  if (sections.sections[i]?.type !== "biography") return null;
  return sections.bioAnchorFromFrac(sections.localProgress);
});
const isActiveMilestone = (sceneIndex: number, j: number) =>
  sceneIndex === sections.activeIndex && bioCursor.value?.milestone === j;

// Keep the active scene/milestone visible inside the bounded overview: when the
// scroll moves to a new section/card, scroll the map (and ONLY the map — never the
// page) just enough to bring the active row into view. No-op if already visible.
const scroller = ref<HTMLElement | null>(null);
const revealActive = () => {
  const c = scroller.value;
  if (!c) return;
  const el =
    c.querySelector<HTMLElement>(".dvp-ov-sub.active") ??
    c.querySelector<HTMLElement>(".dvp-ov-scene.active");
  if (!el) return;
  const cr = c.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (er.top < cr.top) c.scrollTop -= cr.top - er.top + 4;
  else if (er.bottom > cr.bottom) c.scrollTop += er.bottom - cr.bottom + 4;
};
watch(
  () => `${sections.activeIndex}:${bioCursor.value?.milestone ?? ""}`,
  () => nextTick(revealActive),
  { immediate: true }
);
</script>

<template>
  <div ref="scroller" class="dvp-ov" data-lenis-prevent>
    <p v-if="!sections.sections.length" class="dvp-hint">No sections registered.</p>

    <section
      v-for="sc in scenes"
      :key="sc.s.id"
      class="dvp-sec dvp-ov-scene"
      :class="{ active: sc.i === sections.activeIndex }"
    >
      <header class="dvp-sec-head">
        <button class="dvp-sec-toggle" @click="goScene(sc.i)">
          <span class="dvp-sec-title">{{ sc.s.title || sc.s.id }}</span>
          <span class="dvp-scene-type">{{ sc.s.type }}</span>
        </button>
        <span class="dvp-scene-live">
          <template v-if="sc.i === sections.activeIndex">
            {{ Math.round(sections.localProgress * 100) }}%
          </template>
          <template v-else>{{ pct(sc.range[0]) }}–{{ pct(sc.range[1]) }}%</template>
        </span>
      </header>

      <OverviewGroup
        :camera="sc.main.camera"
        :head="sc.main.head"
        :tracks="sc.main.tracks"
        :playhead="sc.i === sections.activeIndex ? sections.localProgress : null"
      />

      <!-- biography milestones — each set-piece card as its own keyframe scope -->
      <div
        v-for="sub in sc.subs"
        :key="sub.j"
        class="dvp-ov-sub"
        :class="{ active: isActiveMilestone(sc.i, sub.j) }"
      >
        <button class="dvp-ov-sub-head" @click="go(sub.resolved)">
          <span class="dvp-ov-sub-title">{{ sub.title }}</span>
          <span class="dvp-ov-sub-pieces">
            <span v-for="p in sub.pieces" :key="p" class="dvp-tag">{{ p }}</span>
          </span>
        </button>
        <OverviewGroup
          v-if="sub.group.hasAny"
          :camera="sub.group.camera"
          :head="sub.group.head"
          :tracks="sub.group.tracks"
          :playhead="isActiveMilestone(sc.i, sub.j) ? bioCursor?.t ?? null : null"
        />
        <p v-else class="dvp-ov-empty">no keyframes — click to set here</p>
      </div>
    </section>
  </div>
</template>
