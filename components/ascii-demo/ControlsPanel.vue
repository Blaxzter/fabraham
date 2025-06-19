<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Settings2Icon, XIcon } from "lucide-vue-next";
import { useSceneControlStore } from "~/stores/SceneControl";
import { useScrollAnimations } from "~/composables/useScrollAnimations";

const store = useSceneControlStore();
const scrollAnimations = ref<ReturnType<typeof useScrollAnimations> | null>(
  null
);

// Initialize on client side only
onMounted(() => {
  if (import.meta.client) {
    scrollAnimations.value = useScrollAnimations();
  }
});
</script>

<template>
  <!-- Toggle Button -->
  <button
    class="fixed top-4 right-4 z-50 bg-black/90 hover:bg-black text-white p-2 rounded-lg transition-colors"
    :title="store.showControlsPanel ? 'Hide Controls' : 'Show Controls'"
    @click="store.showControlsPanel = !store.showControlsPanel"
  >
    <XIcon v-if="store.showControlsPanel" class="w-5 h-5" />
    <Settings2Icon v-else class="w-5 h-5" />
  </button>

  <!-- Controls Panel -->
  <div
    v-if="store.showControlsPanel"
    class="fixed top-16 right-4 z-40 bg-black/90 p-4 rounded-lg text-white space-y-3 max-h-[85vh] overflow-y-auto w-80"
  >
    <h3 class="text-lg font-semibold mb-2">Controls</h3>

    <!-- Camera Information and Controls -->
    <div class="space-y-2">
      <h4 class="text-sm font-medium text-gray-300">Camera</h4>

      <!-- Camera Control Mode -->
      <div class="space-y-1">
        <label class="text-xs text-gray-400">Control Mode</label>
        <select
          v-model="store.cameraControlMode"
          class="w-full p-1 bg-gray-700 border border-gray-600 rounded text-sm"
        >
          <option value="scroll">Scroll Controlled</option>
          <option value="orbit">Orbit Controls</option>
        </select>
      </div>

      <!-- Scroll Progress (when in scroll mode) -->
      <div v-if="store.cameraControlMode === 'scroll'" class="space-y-1">
        <div class="text-xs text-gray-400 space-y-1">
          <div>
            Position: ({{ store.cameraPosition.x.toFixed(2) }},
            {{ store.cameraPosition.y.toFixed(2) }},
            {{ store.cameraPosition.z.toFixed(2) }})
          </div>
          <div>
            Rotation: ({{ store.cameraRotation.x.toFixed(2) }},
            {{ store.cameraRotation.y.toFixed(2) }},
            {{ store.cameraRotation.z.toFixed(2) }})
          </div>
        </div>
      </div>

      <!-- Scene Controls -->
      <div class="space-y-2 pt-2 border-t border-gray-600">
        <h4 class="text-sm font-medium text-gray-300">Scene</h4>
        <div class="flex items-center space-x-2">
          <input
            id="wireframe"
            v-model="store.showWireframe"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="wireframe" class="text-sm">Show Wireframe</label>
        </div>
        <div class="flex items-center space-x-2">
          <input
            id="rotationAxis"
            v-model="store.showRotationAxis"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="rotationAxis" class="text-sm">Show Rotation Axis</label>
        </div>
      </div>

      <!-- Colored Lights Controls -->
      <div class="space-y-2 pt-2 border-t border-gray-600">
        <h4 class="text-sm font-medium text-gray-300">Colored Lights</h4>

        <div class="flex items-center space-x-2">
          <input
            id="coloredLights"
            v-model="store.enableColoredLights"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="coloredLights" class="text-sm"
            >Enable Colored Lights</label
          >
        </div>

        <div class="flex items-center space-x-2">
          <input
            id="lightHelpers"
            v-model="store.showLightHelpers"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="lightHelpers" class="text-sm">Show Light Helpers</label>
        </div>

        <div v-if="store.enableColoredLights" class="space-y-3">
          <!-- Red Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="redLight"
                v-model="store.redLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="redLight" class="text-sm">Red Light</label>
            </div>
            <div v-if="store.redLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400">
                Intensity: {{ store.redLight.intensity.toFixed(1) }}
              </label>
              <input
                v-model="store.redLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="store.redLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Green Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="greenLight"
                v-model="store.greenLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="greenLight" class="text-sm">Green Light</label>
            </div>
            <div v-if="store.greenLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400">
                Intensity: {{ store.greenLight.intensity.toFixed(1) }}
              </label>
              <input
                v-model="store.greenLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="store.greenLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Blue Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="blueLight"
                v-model="store.blueLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="blueLight" class="text-sm">Blue Light</label>
            </div>
            <div v-if="store.blueLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400">
                Intensity: {{ store.blueLight.intensity.toFixed(1) }}
              </label>
              <input
                v-model="store.blueLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="store.blueLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Yellow Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="yellowLight"
                v-model="store.yellowLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="yellowLight" class="text-sm">Yellow Light</label>
            </div>
            <div v-if="store.yellowLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400">
                Intensity: {{ store.yellowLight.intensity.toFixed(1) }}
              </label>
              <input
                v-model="store.yellowLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="store.yellowLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Purple Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="purpleLight"
                v-model="store.purpleLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="purpleLight" class="text-sm">Purple Light</label>
            </div>
            <div v-if="store.purpleLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400">
                Intensity: {{ store.purpleLight.intensity.toFixed(1) }}
              </label>
              <input
                v-model="store.purpleLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="store.purpleLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Spotlight -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="spotlight"
                v-model="store.spotlight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="spotlight" class="text-sm">Spotlight</label>
            </div>
            <div v-if="store.spotlight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400">
                Intensity: {{ store.spotlight.intensity.toFixed(1) }}
              </label>
              <input
                v-model="store.spotlight.intensity"
                type="range"
                min="0"
                max="3"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <label class="text-xs text-gray-400">
                Angle:
                {{ ((store.spotlight.angle * 180) / Math.PI).toFixed(0) }}°
              </label>
              <input
                v-model="store.spotlight.angle"
                type="range"
                min="0.1"
                max="1.57"
                step="0.05"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="store.spotlight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ASCII Controls -->
      <div class="space-y-2 pt-2 border-t border-gray-600">
        <h4 class="text-sm font-medium text-gray-300">ASCII Effect</h4>

        <div class="flex items-center space-x-2">
          <input
            id="ascii"
            v-model="store.enableASCII"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="ascii" class="text-sm">Enable ASCII</label>
        </div>

        <div v-if="store.enableASCII" class="space-y-3">
          <!-- Cell Size -->
          <div>
            <label class="text-xs text-gray-400">
              Cell Size: {{ store.cellSize }}
            </label>
            <input
              v-model="store.cellSize"
              type="range"
              min="2"
              max="64"
              step="1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Opacity -->
          <div>
            <label class="text-xs text-gray-400">
              Opacity: {{ store.opacity.toFixed(1) }}
            </label>
            <input
              v-model="store.opacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Use Scene Color -->
          <div class="flex items-center space-x-2">
            <input
              id="useSceneColor"
              v-model="store.useSceneColor"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="useSceneColor" class="text-sm">Use Scene Color</label>
          </div>

          <!-- ASCII Color -->
          <div v-if="!store.useSceneColor">
            <label class="text-xs text-gray-400">ASCII Color</label>
            <input
              v-model="store.asciiColor"
              type="color"
              class="w-full h-8 rounded cursor-pointer"
            />
          </div>

          <!-- Inverted -->
          <div class="flex items-center space-x-2">
            <input
              id="inverted"
              v-model="store.inverted"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="inverted" class="text-sm">Inverted</label>
          </div>

          <!-- Blend Function -->
          <div>
            <label class="text-xs text-gray-400">Blend Mode</label>
            <select
              v-model="store.blendFunction"
              class="w-full p-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option
                v-for="option in store.blendOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <!-- Font Size -->
          <div>
            <label class="text-xs text-gray-400">
              Font Size: {{ store.fontSize }}
            </label>
            <input
              v-model="store.fontSize"
              type="range"
              min="10"
              max="100"
              step="1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Texture Size -->
          <div>
            <label class="text-xs text-gray-400">
              Texture Size: {{ store.textureSize }}
            </label>
            <input
              v-model="store.textureSize"
              type="range"
              min="256"
              max="2048"
              step="128"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Cell Count -->
          <div>
            <label class="text-xs text-gray-400">
              Cell Count: {{ store.cellCount }}
            </label>
            <input
              v-model="store.cellCount"
              type="range"
              min="4"
              max="64"
              step="1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Characters -->
          <div>
            <label class="text-xs text-gray-400">Characters</label>
            <textarea
              v-model="store.characters"
              class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm resize-none"
              rows="2"
            />
          </div>

          <!-- Font -->
          <div>
            <label class="text-xs text-gray-400">Font</label>
            <select
              v-model="store.font"
              class="w-full p-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="Arial">Arial</option>
              <option value="monospace">Monospace</option>
              <option value="Courier New">Courier New</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="sans-serif">Sans-serif</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
