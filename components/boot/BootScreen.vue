<template>
  <div
    ref="screenRef"
    class="boot-root fixed inset-0 z-50"
    :class="{ 'is-lit': bootState.sceneReady, 'no-motion': reducedMotion }"
  >
    <!-- The room. Black until the scene behind it is ready, then it clears so
         the monitor is standing IN the scene rather than in front of it. -->
    <div class="boot-backdrop" />

    <!-- The monitor: a bezel, a tube, a picture on the tube. Power-on and
         switch-off are the tube's own animations (boot.css). -->
    <div class="monitor" :class="{ 'is-on': powered, 'is-off': switchingOff }">
      <div class="bezel">
        <div class="screen">
          <div class="tube">
            <div class="picture boot-screen screen-flicker text-green-400">
              <!-- POST -->
              <template v-if="bootState.phase === 'booting'">
                <!-- The vendor badge, where AMI and Award put theirs. -->
                <BrandMark class="bios-badge" :weight="2" />
                <div ref="bootSequenceRef" class="h-full">
                  <BootSequence
                    :mode="mode"
                    @complete="onBootSequenceComplete"
                    @easter-egg="onEasterEgg"
                    @boot-menu="onBootMenuRequested"
                  />
                </div>
              </template>

              <!-- DEL -->
              <div
                v-else-if="bootState.phase === 'easter-egg'"
                ref="easterEggRef"
                class="phase-scroll"
              >
                <BootEasterEgg @exit="onEasterEggExit" @continue="onEasterEggContinue" />
              </div>

              <!-- F10 -->
              <div v-else-if="bootState.phase === 'menu'" ref="menuRef" class="phase-scroll">
                <BootMenu @select="onMenuSelect" />
              </div>

              <!-- POST is done and the scene is not: the logo's own cursor, waiting. -->
              <div
                v-else-if="bootState.phase === 'loading-scene'"
                class="h-full flex items-center justify-center"
              >
                <span class="block-cursor" role="status" aria-label="Loading" />
              </div>
            </div>
            <BootCrtEffect />
          </div>
        </div>
        <span class="power-led" :class="{ 'is-on': powered }" aria-hidden="true" />
      </div>

      <!-- Key hints, under the set, only while POST runs -->
      <div v-if="bootState.phase === 'booting'" class="hints">
        <BootText text="DEL: BIOS Setup" color="white" />
        <BootText text="F10: Boot Menu" color="white" />
        <BootText text="Any key: Skip" color="white" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BOOTED_SESSION_KEY } from "~/stores/BootState";

withDefaults(defineProps<{ mode?: "auto" | "cold" | "warm" }>(), { mode: "auto" });

const bootState = useBootStateStore();
const { reducedMotion } = usePreferences();
const { gsap } = useGsap();

const screenRef = ref<HTMLElement | null>(null);
const bootSequenceRef = ref<HTMLElement | null>(null);
const easterEggRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);

const powered = ref(false);
const switchingOff = ref(false);
let finishing = false;

onMounted(() => {
  if (!import.meta.client) return;
  // Power on first; POST starts once the picture has mostly opened.
  requestAnimationFrame(() => {
    powered.value = true;
  });
  setTimeout(() => bootState.setPhase("booting"), reducedMotion.value ? 50 : 300);
});

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const fade = (el: HTMLElement, duration: number) =>
  gsap.to(el, { opacity: 0, duration: reducedMotion.value ? 0.1 : duration });

// The scene is loaded behind the monitor while POST runs; if it is not there
// yet the cursor waits for it.
const whenSceneReady = (then: () => void) => {
  if (bootState.sceneReady) return then();
  bootState.setPhase("loading-scene");
  const unwatch = watch(
    () => bootState.sceneReady,
    (ready) => {
      if (!ready) return;
      unwatch();
      then();
    }
  );
};

const onBootSequenceComplete = () => whenSceneReady(switchOff);

const onBootMenuRequested = async () => {
  if (bootSequenceRef.value) await fade(bootSequenceRef.value, 0.3);
  bootState.setPhase("menu");
};

const onEasterEgg = async () => {
  if (bootSequenceRef.value) await fade(bootSequenceRef.value, 0.3);
  bootState.setPhase("easter-egg");
};

const onEasterEggExit = async () => {
  if (easterEggRef.value) await fade(easterEggRef.value, 0.3);
  bootState.setPhase("booting");
};

const onEasterEggContinue = async () => {
  if (easterEggRef.value) await fade(easterEggRef.value, 0.3);
  bootState.setPhase("menu");
};

const onMenuSelect = async (route: string) => {
  if (menuRef.value) await fade(menuRef.value, 0.3);
  if (route === "/") {
    whenSceneReady(switchOff);
  } else {
    await navigateTo(route);
    switchOff();
  }
};

// Switch-off: the picture collapses to a line and a dot, the LED goes dark,
// then the set fades and the page takes over.
const switchOff = async () => {
  if (finishing) return;
  finishing = true;
  switchingOff.value = true;
  await sleepMs(reducedMotion.value ? 0 : 380);
  powered.value = false;
  if (screenRef.value) await fade(screenRef.value, 0.45);
  try {
    sessionStorage.setItem(BOOTED_SESSION_KEY, "1");
  } catch {
    // No storage (private mode): the next load boots cold, which is fine.
  }
  bootState.completeBootSequence();
};
</script>
