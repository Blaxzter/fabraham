<script setup lang="ts">
// The single dev-only control panel (the ⚙, top-right). One organized surface
// that merges the old /setup ControlsPanel (camera/positioning, scene debug,
// ASCII, lights — runtime config in useSceneControlStore) with the generic
// tuning layer (self-registered params via useTuning). Mounted dev-only from
// pages/index.vue; in production none of this instantiates.
//
// Layout is a SPLIT (issue: the panel had grown into one crammed box): a pinned
// keyframe/scene OVERVIEW (KeyframeOverview) always on top — the navigation map of
// the whole scroll — and a scrollable bottom pane that toggles between the
// per-scene EDITOR (SceneEditor, focused on the scene the scroll is on) and the
// GLOBAL tools (scene-wide knobs + tuning groups). The overview's clicks navigate
// the scroll, so the editor below always shows the scene you're looking at.
import DevPanelSection from "./devpanel/DevPanelSection.vue";
import CameraSection from "./devpanel/CameraSection.vue";
import SceneSection from "./devpanel/SceneSection.vue";
import AsciiSection from "./devpanel/AsciiSection.vue";
import LightsSection from "./devpanel/LightsSection.vue";
import SpotlightsSection from "./devpanel/SpotlightsSection.vue";
import TuningGroups from "./devpanel/TuningGroups.vue";
import KeyframeOverview from "./devpanel/KeyframeOverview.vue";
import SceneEditor from "./devpanel/SceneEditor.vue";
import { computed, ref, watch } from "vue";

// Panel open/closed state reuses the tuning store flag (shared with prod-safe
// no-op path), so there's one toggle for the whole panel.
const tuning = useTuningStore();
const sections = useSectionsStore();

// Two separate popovers: the OVERVIEW (the ⚙ panel, the navigation map) is the
// primary one; the EDITOR is a second, native HTML popover opened FROM it (the
// "edit ▸" trigger) and floats beside it. `editorOpen` mirrors the native
// popover's open state (via its toggle event) so the trigger reads as active.
const editorOpen = ref(false);
const onEditorToggle = (e: Event) => {
    editorOpen.value = (e as unknown as { newState: string }).newState === "open";
};
// Closing the whole panel removes the editor popover too — keep the flag honest.
watch(
    () => tuning.panelOpen,
    (open) => {
        if (!open) editorOpen.value = false;
    }
);

// The overview map collapses into the top control bar (▾/▸) so it stops
// overlaying the viewport when you only want the editor popover open.
const overviewCollapsed = ref(false);

// Editor popover mode: "edit" = the per-scene editor; "global" = scene-wide tools.
const pane = ref<"edit" | "global">("edit");

// The editor follows the scroll — it edits whichever scene is currently centered
// (the overview navigates there on click, so picking a scene = editing it).
const activeScene = computed(() => sections.sections[sections.activeIndex]);
const activeTitle = computed(
    () => activeScene.value?.title || activeScene.value?.id || "—"
);

const saveLabel = computed(() => {
    switch (tuning.saveState) {
        case "saving":
            return "saving…";
        case "saved":
            return "saved ✓";
        case "error":
            return "save failed — dev server running?";
        default:
            return "save to config file";
    }
});
</script>

<template>
    <div class="dvp" :class="{ open: tuning.panelOpen }">
        <!-- Top-right control bar. When open it holds the editor trigger and the
             overview collapse toggle next to the ×; when closed, just the ⚙. -->
        <div class="dvp-bar">
            <template v-if="tuning.panelOpen">
                <button
                    type="button"
                    class="dvp-btn dvp-pop-trigger"
                    :class="{ active: editorOpen }"
                    popovertarget="dvp-editor"
                    title="Open the editor popover"
                >
                    edit ▸
                </button>
                <button
                    type="button"
                    class="dvp-collapse"
                    :title="
                        overviewCollapsed
                            ? 'Show keyframe overview'
                            : 'Hide keyframe overview'
                    "
                    @click="overviewCollapsed = !overviewCollapsed"
                >
                    {{ overviewCollapsed ? "▸" : "▾" }}
                </button>
            </template>
            <button
                class="dvp-toggle"
                title="Dev panel"
                @click="tuning.panelOpen = !tuning.panelOpen"
            >
                {{ tuning.panelOpen ? "×" : "⚙" }}
            </button>
        </div>

        <!-- Two separate popovers. data-lenis-prevent on each scroll region keeps
             the page's Lenis smooth-scroll from hijacking wheel/touch inside, so
             they scroll natively wherever the cursor is. -->
        <template v-if="tuning.panelOpen">
            <!-- Popover 1 — OVERVIEW: the whole-scroll map (scenes + keyframes).
                 Click a scene/keyframe to preview the scroll there; the active
                 scene is highlighted, auto-revealed, and playheaded. Navigation
                 only — the per-scene editing lives in the editor popover. Collapse
                 it (▾/▸ in the bar) to stop overlaying the viewport. -->
            <div v-if="!overviewCollapsed" class="dvp-body" data-lenis-prevent>
                <p class="dvp-head">overview · scenes &amp; keyframes</p>

                <KeyframeOverview />

                <div class="dvp-foot">
                    <button
                        class="dvp-btn dvp-btn-block"
                        :disabled="tuning.saveState === 'saving'"
                        @click="tuning.saveToFile()"
                    >
                        {{ saveLabel }}
                    </button>
                    <p class="dvp-hint">
                        Writes <code>tuning.config.json</code> — commit it to ship
                        these values to everyone (the deployed source of truth).
                    </p>
                </div>
            </div>

            <!-- Popover 2 — EDITOR: a native popover opened from the bar, floating
                 beside the overview (or docked into the overview's spot when the
                 overview is collapsed, so it never floats with a gap beside an
                 empty map). Edits the scene the scroll is on, or the global tools.
                 `manual` so it stays put while you click the 3D scene (no light-
                 dismiss); the × closes it. -->
            <div
                id="dvp-editor"
                popover="manual"
                class="dvp-pop"
                :class="{ 'dvp-pop-docked': overviewCollapsed }"
                data-lenis-prevent
                @toggle="onEditorToggle"
            >
                <div class="dvp-head-row">
                    <div class="dvp-tabs dvp-tabs-inline">
                        <button
                            class="dvp-tab"
                            :class="{ active: pane === 'edit' }"
                            @click="pane = 'edit'"
                        >
                            edit
                        </button>
                        <button
                            class="dvp-tab"
                            :class="{ active: pane === 'global' }"
                            @click="pane = 'global'"
                        >
                            global
                        </button>
                    </div>
                    <button
                        type="button"
                        class="dvp-pop-close"
                        popovertarget="dvp-editor"
                        popovertargetaction="hide"
                        title="Close editor"
                    >
                        ×
                    </button>
                </div>

                <p class="dvp-pop-title">
                    {{ pane === "edit" ? `editing · ${activeTitle}` : "global tools" }}
                </p>

                <div class="dvp-pane-scroll" data-lenis-prevent>
                    <template v-if="pane === 'edit'">
                        <!-- :key gives each scene a fresh editor instance (resets
                             per-scene UI state like the open milestone). -->
                        <SceneEditor
                            v-if="activeScene"
                            :key="activeScene.id"
                            :section="activeScene"
                        />
                        <p v-else class="dvp-hint">No sections registered.</p>
                    </template>

                    <template v-else>
                        <DevPanelSection title="Camera" :default-open="true">
                            <CameraSection />
                        </DevPanelSection>

                        <DevPanelSection title="ASCII" :default-open="true">
                            <AsciiSection />
                        </DevPanelSection>

                        <DevPanelSection title="Scene">
                            <SceneSection />
                        </DevPanelSection>

                        <DevPanelSection title="Lights">
                            <LightsSection />
                        </DevPanelSection>

                        <DevPanelSection title="Spotlights">
                            <SpotlightsSection />
                        </DevPanelSection>

                        <!-- Global tuning groups (not tied to a scene). -->
                        <TuningGroups />
                    </template>
                </div>
            </div>
        </template>
    </div>
</template>

<!--
  Unscoped on purpose: these `.dvp-*` rules are the shared stylesheet for every
  section sub-component (DevPanel is the only root that mounts them, dev-only),
  so leaf sections carry no styles of their own. Namespaced under `.dvp` /
  `.dvp-*` so nothing leaks into the page.
-->
<style>
.dvp {
    position: fixed;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 100;
    font-family: "Courier New", monospace;
    color: #d6ffe9;
}
/* Top-right control bar holding the ⚙/× toggle (+ editor trigger & collapse
   when open). Absolute so it floats in the corner; the body clears it. */
.dvp-bar {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.3rem;
}
.dvp-toggle {
    display: flex;
    justify-content: center;
    align-items: center;
    padding-top: 0.2rem; /* optical centering for the ⚙ glyph */
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(0, 255, 156, 0.5);
    background: rgba(4, 10, 8, 0.8);
    color: #00ff9c;
    cursor: pointer;
    font-size: 1rem;
    line-height: 0;
}
/* The overview collapse toggle (▾ shown / ▸ hidden), next to the ×. */
.dvp-collapse {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.8rem;
    height: 1.8rem;
    padding: 0;
    border-radius: 0.35rem;
    border: 1px solid rgba(0, 255, 156, 0.4);
    background: rgba(4, 10, 8, 0.8);
    color: #9fe;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
    line-height: 0;
}
.dvp-collapse:hover {
    color: #00ff9c;
    background: rgba(0, 255, 156, 0.12);
}
/* The body is a fixed-height flex column: a pinned head + overview + pane label,
   a flex-growing scrollable pane, and a pinned footer. Only the inner regions
   scroll (overview, pane), so the map and the save button never scroll away. */
.dvp-body {
    margin-top: 2.2rem;
    width: 18rem;
    max-height: 86vh;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow: hidden;
    overscroll-behavior: contain;
    padding: 0.5rem;
    border-radius: 0.6rem;
    border: 1px solid rgba(0, 255, 156, 0.4);
    background: rgba(4, 10, 8, 0.86);
    backdrop-filter: blur(6px);
    font-size: 0.72rem;
}
.dvp-head {
    flex: none;
    margin: 0; /* the body's flex gap handles spacing */
    font-size: 0.65rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    opacity: 0.55;
}
.dvp-head-row {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

/* Pane mode toggle (edit / global) + the old generic tab styling it reuses. */
.dvp-tabs {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
}
.dvp-tabs-inline {
    width: auto;
    margin: 0;
    flex: none;
}
.dvp-tab {
    flex: 1;
    padding: 0.25rem;
    border-radius: 0.3rem;
    border: 1px solid rgba(0, 255, 156, 0.25);
    background: transparent;
    color: #9fe;
    cursor: pointer;
    font: inherit;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.65;
}
.dvp-tabs-inline .dvp-tab {
    flex: none;
    padding: 0.15rem 0.55rem;
}
.dvp-tab:hover {
    opacity: 1;
}
.dvp-tab.active {
    background: rgba(0, 255, 156, 0.12);
    border-color: rgba(0, 255, 156, 0.55);
    color: #00ff9c;
    opacity: 1;
}

/* The "open editor" trigger in the control bar (reads as active while the editor
   popover is open). Opaque dark base so its label stays legible over the scene. */
.dvp-pop-trigger {
    display: inline-flex;
    align-items: center;
    flex: none;
    height: 1.8rem;
    padding: 0 0.55rem;
    background: rgba(4, 10, 8, 0.8);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.dvp-pop-trigger.active {
    background: rgba(4, 12, 9, 0.92);
    border-color: rgba(0, 255, 156, 0.6);
    color: #00ff9c;
}

/* Popover 2 — the EDITOR: a native popover floating just left of the overview.
   Override the UA popover chrome (centered, bordered box) and dress it as a
   sibling panel of .dvp-body. `display` is only set when open so the UA
   display:none (closed) still hides it. */
.dvp-pop {
    position: fixed;
    inset: auto;
    top: 3rem; /* aligns with the overview body (.dvp top .75rem + margin 2.2rem) */
    right: 19.25rem; /* just left of the 18rem overview (.75 + 18 + .5 gap) */
    margin: 0;
    width: 18.5rem;
    max-height: 86vh;
    overflow: hidden;
    padding: 0.5rem;
    border-radius: 0.6rem;
    border: 1px solid rgba(0, 255, 156, 0.4);
    background: rgba(4, 10, 8, 0.92);
    backdrop-filter: blur(6px);
    color: #d6ffe9;
    font: 0.72rem/1.3 "Courier New", monospace;
    transition: right 0.15s ease;
}
.dvp-pop:popover-open {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
/* When the overview is collapsed there's no map to sit beside — dock the editor
   into the overview's top-right spot instead of leaving a gap. */
.dvp-pop-docked {
    right: 0.75rem;
}
.dvp-pop-title {
    flex: none;
    margin: 0;
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.5;
}
.dvp-pop-close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    padding: 0;
    border-radius: 0.3rem;
    border: 1px solid rgba(0, 255, 156, 0.35);
    background: transparent;
    color: #9fe;
    cursor: pointer;
    font: inherit;
    font-size: 0.95rem;
    line-height: 1;
}
.dvp-pop-close:hover {
    background: rgba(0, 255, 156, 0.12);
    color: #00ff9c;
}

/* The flex-growing, scrollable editor-popover body (editor or global tools). */
.dvp-pane-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 255, 156, 0.3) transparent;
}

/* ── Keyframe / scene OVERVIEW (the pinned navigation map) ───────────── */
.dvp-ov {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 255, 156, 0.3) transparent;
}
.dvp-ov-scene {
    /* a left accent for the active scene without a layout-shifting margin */
    border-left: 2px solid transparent;
    padding-left: 0.35rem;
}
.dvp-ov-scene.active {
    border-left-color: #00ff9c;
    background: rgba(0, 255, 156, 0.06);
}
.dvp-ov-tl {
    position: relative;
    height: 0.5rem;
    margin: 0.3rem 0;
    border-radius: 0.2rem;
    background: rgba(0, 255, 156, 0.08);
}
.dvp-ov-tick {
    position: absolute;
    top: 50%;
    width: 2px;
    height: 0.6rem;
    margin-left: -1px;
    transform: translateY(-50%);
    border-radius: 1px;
    background: #00ff9c; /* camera (is-cam) */
}
.dvp-ov-tick.is-head {
    background: #57d4ff;
}
.dvp-ov-tick.is-spot {
    height: 0.5rem;
    opacity: 0.85;
}
.dvp-ov-playhead {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 0;
    border-left: 1px solid #fff;
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.7);
}
.dvp-ov-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    margin: 0.12rem 0;
}
.dvp-ov-k {
    flex: none;
    width: 2.7rem;
    opacity: 0.5;
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.dvp-ov-kf {
    padding: 0 0.3rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(0, 255, 156, 0.35);
    background: transparent;
    color: #9fe;
    cursor: pointer;
    font: inherit;
    font-size: 0.6rem;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
}
.dvp-ov-kf:hover {
    background: rgba(0, 255, 156, 0.14);
    color: #00ff9c;
}
.dvp-ov-kf-spot {
    border-left-width: 3px;
}

/* Biography milestone sub-rows: each set-piece card rendered as its own keyframe
   scope, indented under the biography scene (mirrors the editor's milestone
   nesting). The active card is accented like the active scene. */
.dvp-ov-sub {
    margin: 0.3rem 0 0 0.5rem;
    padding: 0.1rem 0 0.1rem 0.5rem;
    border-left: 1px solid rgba(0, 255, 156, 0.18);
}
.dvp-ov-sub.active {
    border-left: 2px solid #00ff9c;
    background: rgba(0, 255, 156, 0.06);
}
.dvp-ov-sub-head {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
    padding: 0.1rem 0;
    background: transparent;
    border: 0;
    color: #d6ffe9;
    font: inherit;
    cursor: pointer;
    text-align: left;
}
.dvp-ov-sub-title {
    color: #9fe;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.dvp-ov-sub-pieces {
    flex: none;
    margin-left: auto;
    display: inline-flex;
    gap: 0.2rem;
}
.dvp-ov-empty {
    margin: 0.1rem 0 0.2rem;
    opacity: 0.4;
    font-size: 0.6rem;
    font-style: italic;
}

/* Section (collapsible) */
.dvp-sec {
    border-top: 1px solid rgba(0, 255, 156, 0.18);
    padding: 0.45rem 0 0.2rem;
}
.dvp-sec-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
}
.dvp-sec-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    padding: 0.1rem 0;
    background: transparent;
    border: 0;
    color: #00ff9c;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
}
.dvp-caret {
    width: 0.7rem;
    opacity: 0.7;
}
.dvp-sec-title {
    color: #00ff9c;
}
.dvp-sec-actions {
    display: flex;
    gap: 0.3rem;
}
.dvp-sec-body {
    padding: 0.4rem 0 0.5rem 0.1rem;
}

/* Scene labels — shared by the overview map (scene rows) and the editor's
   biography milestones. The active-scene accent itself lives on `.dvp-ov-scene`
   (overview) and `.dvp-milestone` (editor), which don't bleed past their box. */
.dvp-scene-type {
    margin-left: 0.4rem;
    font-size: 0.55rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.45;
    font-weight: 400;
}
.dvp-scene-live {
    font-size: 0.6rem;
    color: #00ff9c;
    font-variant-numeric: tabular-nums;
    opacity: 0.8;
}
.dvp-scene-group {
    border-top: 1px solid rgba(0, 255, 156, 0.14);
    margin-top: 0.4rem;
    padding-top: 0.4rem;
}
.dvp-swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 0.2rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Biography milestones, nested under their section */
.dvp-milestone {
    margin-left: 0.5rem;
    padding-left: 0.5rem;
    border-top: 1px solid rgba(0, 255, 156, 0.12);
    border-left: 1px solid rgba(0, 255, 156, 0.12);
}
.dvp-milestone.active {
    border-left: 2px solid #00ff9c;
    background: rgba(0, 255, 156, 0.05);
}
.dvp-milestone .dvp-sec-title {
    font-weight: 400;
    font-size: 0.7rem;
}

/* Fields */
.dvp-field {
    margin-bottom: 0.45rem;
}
.dvp-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.2rem;
}
.dvp-clickable {
    cursor: pointer;
}
.dvp-label {
    opacity: 0.85;
}
.dvp-val,
.dvp-axis-v {
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
    min-width: 2.4rem;
    text-align: right;
}
.dvp-readout {
    border: 1px solid rgba(0, 255, 156, 0.18);
    border-radius: 0.3rem;
    padding: 0.3rem 0.4rem;
}
.dvp-readout .dvp-val {
    min-width: 0;
}
.dvp-hint {
    margin: 0.3rem 0 0;
    opacity: 0.5;
    font-size: 0.62rem;
    line-height: 1.3;
}
.dvp-hint code {
    color: #9fe;
}
.dvp-tag {
    margin-left: 0.25rem;
    padding: 0 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.55rem;
    background: rgba(0, 255, 156, 0.15);
    color: #00ff9c;
}

/* Axis rows */
.dvp-axis {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}
.dvp-axis-k {
    width: 0.8rem;
    opacity: 0.5;
    text-transform: uppercase;
}

/* Buttons */
.dvp-btn {
    padding: 0.1rem 0.45rem;
    border-radius: 0.3rem;
    border: 1px solid rgba(0, 255, 156, 0.4);
    background: transparent;
    color: #9fe;
    cursor: pointer;
    font: inherit;
    font-size: 0.65rem;
}
.dvp-btn:hover {
    background: rgba(0, 255, 156, 0.12);
}
.dvp-btn-block {
    width: 100%;
    margin-top: 0.2rem;
    padding: 0.25rem;
}
.dvp-btn-danger {
    border-color: rgba(255, 90, 90, 0.5);
    color: #ff9a9a;
}

/* Lights */
.dvp-light-actions {
    display: flex;
    gap: 0.3rem;
    margin: 0.3rem 0 0.5rem;
}
.dvp-light {
    border: 1px solid rgba(0, 255, 156, 0.18);
    border-radius: 0.35rem;
    padding: 0.4rem;
    margin-bottom: 0.45rem;
}
.dvp-light-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
}
.dvp-light-name {
    color: #00ff9c;
    font-weight: 700;
}
.dvp-light-controls {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.dvp-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    opacity: 0.8;
}

/* Inputs */
.dvp input[type="range"] {
    flex: 1;
    accent-color: #00ff9c;
    min-width: 0;
}
.dvp input[type="number"],
.dvp .dvp-textarea,
.dvp .dvp-select {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(0, 255, 156, 0.3);
    color: #d6ffe9;
    border-radius: 0.25rem;
    padding: 0.1rem 0.3rem;
    font: inherit;
}
.dvp input[type="number"] {
    width: 100%;
}
.dvp .dvp-textarea {
    width: 100%;
    resize: none;
}
.dvp .dvp-select-block {
    width: 100%;
}
.dvp input[type="color"] {
    width: 2.4rem;
    height: 1.2rem;
    padding: 0;
    border: 1px solid rgba(0, 255, 156, 0.3);
    border-radius: 0.25rem;
    background: transparent;
    cursor: pointer;
}
.dvp input[type="checkbox"] {
    accent-color: #00ff9c;
}
.dvp-foot {
    flex: none;
}
.dvp-btn-block[disabled] {
    opacity: 0.5;
    cursor: default;
}
/* Subtle padded-pill scrollbars: a thin green thumb floating in a transparent
   track (the 3px transparent border + padding-box clip makes it read slim),
   instead of the chunky default block. */
.dvp-pane-scroll::-webkit-scrollbar,
.dvp-ov::-webkit-scrollbar {
    width: 10px;
}
.dvp-pane-scroll::-webkit-scrollbar-track,
.dvp-ov::-webkit-scrollbar-track {
    background: transparent;
}
.dvp-pane-scroll::-webkit-scrollbar-thumb,
.dvp-ov::-webkit-scrollbar-thumb {
    background-color: rgba(0, 255, 156, 0.25);
    border: 3px solid transparent;
    border-radius: 999px;
    background-clip: padding-box;
}
.dvp-pane-scroll::-webkit-scrollbar-thumb:hover,
.dvp-ov::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 255, 156, 0.5);
}
</style>
