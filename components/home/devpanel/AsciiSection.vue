<script setup lang="ts">
// The ASCII post-processing params. These are real runtime config (read every
// frame via store.effectProps in Scene3D), so they stay in useSceneControlStore;
// this is just the editing surface.
const store = useSceneControlStore();
</script>

<template>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Enable ASCII</span>
    <input v-model="store.enableASCII" type="checkbox" />
  </label>

  <template v-if="store.enableASCII">
    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Cell size</span>
        <span class="dvp-val">{{ store.cellSize }}</span>
      </label>
      <input v-model.number="store.cellSize" type="range" min="2" max="64" step="1" />
    </div>

    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Opacity</span>
        <span class="dvp-val">{{ store.opacity.toFixed(1) }}</span>
      </label>
      <input v-model.number="store.opacity" type="range" min="0" max="1" step="0.1" />
    </div>

    <label class="dvp-row dvp-clickable">
      <span class="dvp-label">Use scene color</span>
      <input v-model="store.useSceneColor" type="checkbox" />
    </label>

    <label v-if="!store.useSceneColor" class="dvp-row">
      <span class="dvp-label">ASCII color</span>
      <input v-model="store.asciiColor" type="color" />
    </label>

    <label class="dvp-row dvp-clickable">
      <span class="dvp-label">Inverted</span>
      <input v-model="store.inverted" type="checkbox" />
    </label>

    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Blend mode</span>
      </label>
      <select v-model="store.blendFunction" class="dvp-select dvp-select-block">
        <option
          v-for="option in store.blendOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Font size</span>
        <span class="dvp-val">{{ store.fontSize }}</span>
      </label>
      <input v-model.number="store.fontSize" type="range" min="10" max="100" step="1" />
    </div>

    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Texture size</span>
        <span class="dvp-val">{{ store.textureSize }}</span>
      </label>
      <input
        v-model.number="store.textureSize"
        type="range"
        min="256"
        max="2048"
        step="128"
      />
    </div>

    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Cell count</span>
        <span class="dvp-val">{{ store.cellCount }}</span>
      </label>
      <input v-model.number="store.cellCount" type="range" min="4" max="64" step="1" />
    </div>

    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Characters</span>
      </label>
      <textarea v-model="store.characters" class="dvp-textarea" rows="2" />
    </div>

    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Font</span>
      </label>
      <select v-model="store.font" class="dvp-select dvp-select-block">
        <option value="Arial">Arial</option>
        <option value="monospace">Monospace</option>
        <option value="Courier New">Courier New</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="sans-serif">Sans-serif</option>
      </select>
    </div>
  </template>
</template>
