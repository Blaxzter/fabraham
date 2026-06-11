<script setup lang="ts">
// The single dev-only control panel (the ⚙, top-right). One organized surface
// that merges the old /setup ControlsPanel (camera/positioning, scene debug,
// ASCII, lights — runtime config in useSceneControlStore) with the generic
// tuning layer (self-registered params via useTuning). Mounted dev-only from
// pages/index.vue; in production none of this instantiates.
import DevPanelSection from "./devpanel/DevPanelSection.vue";
import CameraSection from "./devpanel/CameraSection.vue";
import SceneSection from "./devpanel/SceneSection.vue";
import AsciiSection from "./devpanel/AsciiSection.vue";
import LightsSection from "./devpanel/LightsSection.vue";
import TuningGroups from "./devpanel/TuningGroups.vue";
import ScenesTab from "./devpanel/ScenesTab.vue";
import { computed, ref } from "vue";

// Panel open/closed state reuses the tuning store flag (shared with prod-safe
// no-op path), so there's one toggle for the whole panel.
const tuning = useTuningStore();

// Two tabs: "global" = scene-wide tools (camera, ASCII, scene, lights + global
// tuning groups); "scenes" = per-section controls that follow the scroll.
const tab = ref<"global" | "scenes">("global");

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
        <button
            class="dvp-toggle"
            title="Dev panel"
            @click="tuning.panelOpen = !tuning.panelOpen"
        >
            {{ tuning.panelOpen ? "×" : "⚙" }}
        </button>

        <!-- data-lenis-prevent: keep the page's Lenis smooth-scroll from
             hijacking wheel/touch inside the panel so it scrolls natively. -->
        <div v-if="tuning.panelOpen" class="dvp-body" data-lenis-prevent>
            <p class="dvp-head">dev panel</p>

            <div class="dvp-tabs">
                <button
                    class="dvp-tab"
                    :class="{ active: tab === 'global' }"
                    @click="tab = 'global'"
                >
                    global
                </button>
                <button
                    class="dvp-tab"
                    :class="{ active: tab === 'scenes' }"
                    @click="tab = 'scenes'"
                >
                    scenes
                </button>
            </div>

            <template v-if="tab === 'global'">
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

                <!-- Global tuning groups (not tied to a scene). -->
                <TuningGroups />
            </template>

            <ScenesTab v-else />

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
.dvp-toggle {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    padding-top: 0.2rem; /* optical centering for the ⚙ glyph */
    top: 0;
    right: 0;
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
.dvp-body {
    margin-top: 2.2rem;
    width: 18rem;
    max-height: 86vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.6rem 0.7rem 0.8rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(0, 255, 156, 0.4);
    background: rgba(4, 10, 8, 0.86);
    backdrop-filter: blur(6px);
    font-size: 0.72rem;
    scrollbar-width: thin;
}
.dvp-head {
    margin: 0 0 0.5rem;
    font-size: 0.65rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    opacity: 0.55;
}

/* Tabs (global / scenes) */
.dvp-tabs {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
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
.dvp-tab:hover {
    opacity: 1;
}
.dvp-tab.active {
    background: rgba(0, 255, 156, 0.12);
    border-color: rgba(0, 255, 156, 0.55);
    color: #00ff9c;
    opacity: 1;
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

/* Scenes tab */
.dvp-scene.active {
    /* accent the scene the scroll is currently on */
    margin: 0 -0.7rem;
    padding-left: 0.7rem;
    padding-right: 0.7rem;
    border-left: 2px solid #00ff9c;
    background: rgba(0, 255, 156, 0.06);
}
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
    border-top: 1px solid rgba(0, 255, 156, 0.22);
    margin-top: 0.5rem;
    padding-top: 0.6rem;
}
.dvp-btn-block[disabled] {
    opacity: 0.5;
    cursor: default;
}
.dvp-body::-webkit-scrollbar {
    width: 6px;
}
.dvp-body::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 156, 0.3);
    border-radius: 3px;
}
</style>
