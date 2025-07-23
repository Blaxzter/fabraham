# Dynamic Light System

This documentation explains the new dynamic light system that allows you to create, manage, and animate lights in your 3D scene.

## Overview

The light system has been completely refactored to support:

- **Dynamic light management** through a dictionary-based approach
- **Reusable Light component** for rendering different light types
- **Animation support** with keyframe-based light animations
- **Real-time debugging** with the LightDebugger component
- **Scroll-based animations** integration

## File Structure

```
stores/
  SceneControl.ts       # Main light configuration store
  ScrollAnimations.ts   # Scroll-based animation logic
components/home/
  Light.vue             # Reusable light component
  Lights.vue            # Main lights container
  LightDebugger.vue     # Debug interface for lights
lib/
  lightPresets.ts       # Predefined light configurations
types/
  lights.ts             # TypeScript type definitions
```

## Basic Usage

### 1. Adding a New Light Programmatically

```typescript
import { useSceneControlStore } from "~/stores/SceneControl";

const sceneStore = useSceneControlStore();

// Add a point light
sceneStore.addLight({
  id: "my_light",
  name: "My Custom Light",
  type: "point",
  enabled: true,
  position: { x: 2, y: 3, z: 1 },
  color: "#ff6b6b",
  intensity: 1.2,
  distance: 10,
  decay: 1,
  animatable: false,
});

// Add a spotlight
sceneStore.addLight({
  id: "my_spotlight",
  name: "My Spotlight",
  type: "spot",
  enabled: true,
  position: { x: 4, y: 6, z: 2 },
  color: "#ffffff",
  intensity: 2.0,
  angle: Math.PI / 4,
  penumbra: 0.3,
  target: { x: 0, y: 0, z: 0 },
  animatable: true,
});
```

### 2. Managing Lights

```typescript
// Update light properties
sceneStore.updateLightProperty("my_light", "intensity", 2.0);
sceneStore.updateLightProperty("my_light", "color", "#00ff00");

// Toggle light on/off
sceneStore.toggleLight("my_light");

// Remove a light
sceneStore.removeLight("my_light");

// Get light by ID
const light = sceneStore.getLight("my_light");

// Get all lights of a specific type
const pointLights = sceneStore.getLightsByType("point");

// Get all enabled lights
const enabledLights = sceneStore.getEnabledLights();
```

### 3. Adding Animation Keyframes

```typescript
sceneStore.updateLightProperty("my_light", "animationKeyframes", [
  {
    progress: 0,
    position: { x: 2, y: 3, z: 1 },
    intensity: 1.2,
    color: "#ff6b6b",
  },
  {
    progress: 0.5,
    position: { x: -2, y: 4, z: 2 },
    intensity: 2.0,
    color: "#4ecdc4",
  },
  {
    progress: 1,
    position: { x: 0, y: 2, z: -1 },
    intensity: 0.8,
    color: "#45b7d1",
  },
]);

// Enable animation for the light
sceneStore.updateLightProperty("my_light", "animatable", true);
```

## Light Types

### Point Light

- **position**: 3D position in space
- **color**: Light color (hex string)
- **intensity**: Light intensity (0-5)
- **distance**: Light range (optional)
- **decay**: Light falloff (optional)

### Spotlight

- **position**: 3D position in space
- **color**: Light color (hex string)
- **intensity**: Light intensity (0-5)
- **angle**: Cone angle in radians
- **penumbra**: Softness of light edge (0-1)
- **target**: 3D position the light points to (optional)
- **distance**: Light range (optional)
- **decay**: Light falloff (optional)

### Directional Light

- **position**: 3D position in space
- **color**: Light color (hex string)
- **intensity**: Light intensity (0-5)
- **direction**: Direction vector (optional)

## Animation System

The animation system uses keyframes with progress values (0-1) that correspond to scroll progress or other animation triggers.

### Keyframe Properties

- **progress**: Animation progress (0-1)
- **position**: 3D position at this keyframe (optional)
- **intensity**: Light intensity at this keyframe (optional)
- **color**: Light color at this keyframe (optional)

### Scroll Integration

The `ScrollAnimations` store automatically updates animatable lights based on scroll progress:

```typescript
import { useScrollAnimationsStore } from "~/stores/ScrollAnimations";

const scrollStore = useScrollAnimationsStore();

// Add example animation keyframes
scrollStore.addLightAnimationExample();

// Enable/disable scroll-based animations
scrollStore.enable();
scrollStore.disable();
```

## Development Tools

### LightDebugger Component

Use the `LightDebugger` component for real-time light manipulation during development:

```vue
<template>
  <div>
    <!-- Your 3D scene -->
    <Scene3D />

    <!-- Light debugger for development -->
    <LightDebugger v-if="isDev" />
  </div>
</template>

<script setup>
import LightDebugger from "~/components/home/LightDebugger.vue";

const isDev = process.dev;
</script>
```

The debugger provides:

- Real-time position adjustment with sliders
- Color picker for light colors
- Intensity controls
- Light type switching
- Animation toggle
- Export functionality to copy current configurations

### Debug Page

Visit `/debug` to access the light debugger in a dedicated page.

## Presets

Use predefined light configurations from `lib/lightPresets.ts`:

```typescript
import { lightPresets } from "~/lib/lightPresets";

// Apply dramatic lighting
lightPresets.dramatic();

// Apply soft lighting
lightPresets.soft();

// Reset to original lighting
lightPresets.original();
```

## Best Practices

1. **Performance**: Limit the number of lights to maintain good performance (typically 6-8 lights max)

2. **Naming**: Use descriptive IDs and names for lights to make debugging easier

3. **Animation**: Use smooth transitions between keyframes for natural-looking animations

4. **Debugging**: Use the LightDebugger during setup to find optimal positions and settings

5. **Export**: Use the export functionality to save good configurations for later use

## Example: Complete Light Setup

```typescript
import { useSceneControlStore } from "~/stores/SceneControl";

export const setupSceneLighting = () => {
  const store = useSceneControlStore();

  // Clear existing lights
  Object.keys(store.lights).forEach((id) => {
    store.removeLight(id);
  });

  // Add key light
  store.addLight({
    id: "key_light",
    name: "Key Light",
    type: "spot",
    enabled: true,
    position: { x: 5, y: 8, z: 3 },
    color: "#fff2e6",
    intensity: 2.5,
    angle: Math.PI / 6,
    penumbra: 0.2,
    target: { x: 0, y: 0, z: 0 },
    animatable: true,
    animationKeyframes: [
      { progress: 0, intensity: 2.5 },
      { progress: 1, intensity: 1.0 },
    ],
  });

  // Add fill light
  store.addLight({
    id: "fill_light",
    name: "Fill Light",
    type: "point",
    enabled: true,
    position: { x: -3, y: 2, z: 2 },
    color: "#e6f3ff",
    intensity: 0.8,
    distance: 15,
    decay: 2,
    animatable: false,
  });

  // Add rim light
  store.addLight({
    id: "rim_light",
    name: "Rim Light",
    type: "point",
    enabled: true,
    position: { x: 0, y: 1, z: -4 },
    color: "#ffe6f3",
    intensity: 1.2,
    distance: 8,
    decay: 1,
    animatable: true,
    animationKeyframes: [
      {
        progress: 0,
        position: { x: 0, y: 1, z: -4 },
        intensity: 1.2,
      },
      {
        progress: 1,
        position: { x: 2, y: 3, z: -2 },
        intensity: 0.6,
      },
    ],
  });
};
```

This system provides complete control over your scene lighting with the flexibility to create dynamic, animated lighting setups that respond to user interaction and scroll behavior.
