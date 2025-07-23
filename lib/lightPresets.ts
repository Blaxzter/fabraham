// Example configuration for adding custom lights programmatically
import { useSceneControlStore } from "~/stores/SceneControl";

export const setupCustomLights = () => {
  const sceneStore = useSceneControlStore();

  // Example 1: Add a moving accent light
  sceneStore.addLight({
    id: "accent_1",
    name: "Accent Light 1",
    type: "point",
    enabled: true,
    position: { x: 1.5, y: 3, z: 2 },
    color: "#ff6b6b",
    intensity: 0.8,
    distance: 8,
    decay: 2,
    animatable: true,
    animationKeyframes: [
      {
        progress: 0,
        position: { x: 1.5, y: 3, z: 2 },
        intensity: 0.8,
        color: "#ff6b6b",
      },
      {
        progress: 0.5,
        position: { x: -1.5, y: 4, z: 1 },
        intensity: 1.2,
        color: "#4ecdc4",
      },
      {
        progress: 1,
        position: { x: 0, y: 2, z: -2 },
        intensity: 0.5,
        color: "#45b7d1",
      },
    ],
  });

  // Example 2: Add a dramatic rim light
  sceneStore.addLight({
    id: "rim_light",
    name: "Rim Light",
    type: "spot",
    enabled: true,
    position: { x: -4, y: 4, z: -2 },
    color: "#feca57",
    intensity: 1.5,
    distance: 12,
    decay: 1,
    angle: Math.PI / 4,
    penumbra: 0.5,
    target: { x: 0, y: 0, z: 0 },
    animatable: true,
    animationKeyframes: [
      {
        progress: 0,
        intensity: 1.5,
      },
      {
        progress: 0.3,
        intensity: 2.2,
      },
      {
        progress: 0.7,
        intensity: 0.8,
      },
      {
        progress: 1,
        intensity: 1.0,
      },
    ],
  });

  // Example 3: Add a subtle fill light
  sceneStore.addLight({
    id: "fill_light",
    name: "Fill Light",
    type: "directional",
    enabled: true,
    position: { x: 2, y: 6, z: 4 },
    color: "#ffffff",
    intensity: 0.4,
    direction: { x: -1, y: -2, z: -2 },
    animatable: true,
    animationKeyframes: [
      {
        progress: 0,
        intensity: 0.4,
      },
      {
        progress: 1,
        intensity: 0.1,
      },
    ],
  });

  console.log("Custom lights added successfully!");
};

// Example of light presets for different moods
export const lightPresets = {
  dramatic: () => {
    const sceneStore = useSceneControlStore();

    // Disable all current lights
    Object.keys(sceneStore.lights).forEach((lightId) => {
      sceneStore.updateLightProperty(lightId, "enabled", false);
    });

    // Add dramatic lighting setup
    sceneStore.addLight({
      id: "key_light",
      name: "Key Light",
      type: "spot",
      enabled: true,
      position: { x: 5, y: 8, z: 3 },
      color: "#ff4757",
      intensity: 3.0,
      angle: Math.PI / 8,
      penumbra: 0.2,
      target: { x: 0, y: 0, z: 0 },
      animatable: false,
    });

    sceneStore.addLight({
      id: "back_light",
      name: "Back Light",
      type: "point",
      enabled: true,
      position: { x: -2, y: 2, z: -4 },
      color: "#3742fa",
      intensity: 2.0,
      distance: 15,
      decay: 1,
      animatable: false,
    });
  },

  soft: () => {
    const sceneStore = useSceneControlStore();

    // Disable all current lights
    Object.keys(sceneStore.lights).forEach((lightId) => {
      sceneStore.updateLightProperty(lightId, "enabled", false);
    });

    // Add soft lighting setup
    sceneStore.addLight({
      id: "ambient_1",
      name: "Soft Ambient 1",
      type: "point",
      enabled: true,
      position: { x: 2, y: 4, z: 2 },
      color: "#ffeaa7",
      intensity: 0.8,
      distance: 20,
      decay: 2,
      animatable: false,
    });

    sceneStore.addLight({
      id: "ambient_2",
      name: "Soft Ambient 2",
      type: "point",
      enabled: true,
      position: { x: -2, y: 4, z: -2 },
      color: "#74b9ff",
      intensity: 0.6,
      distance: 20,
      decay: 2,
      animatable: false,
    });
  },

  original: () => {
    const sceneStore = useSceneControlStore();

    // Reset to original lights
    sceneStore.lights = {
      red: {
        id: "red",
        name: "Red Light",
        type: "point",
        enabled: true,
        position: { x: 3, y: 2, z: 1 },
        color: "#ff0000",
        intensity: 1.5,
        distance: 10,
        decay: 1,
        animatable: true,
      },
      green: {
        id: "green",
        name: "Green Light",
        type: "point",
        enabled: true,
        position: { x: -3, y: 2, z: 1 },
        color: "#00ff00",
        intensity: 1.5,
        distance: 10,
        decay: 1,
        animatable: true,
      },
      blue: {
        id: "blue",
        name: "Blue Light",
        type: "point",
        enabled: true,
        position: { x: 0, y: 2, z: -3 },
        color: "#0088ff",
        intensity: 1.5,
        distance: 10,
        decay: 1,
        animatable: true,
      },
      yellow: {
        id: "yellow",
        name: "Yellow Light",
        type: "point",
        enabled: true,
        position: { x: 0, y: 1, z: 3 },
        color: "#ffff00",
        intensity: 1.2,
        distance: 8,
        decay: 1,
        animatable: true,
      },
      purple: {
        id: "purple",
        name: "Purple Light",
        type: "point",
        enabled: true,
        position: { x: 0, y: 4, z: 0 },
        color: "#ff00ff",
        intensity: 1.2,
        distance: 10,
        decay: 1,
        animatable: true,
      },
      spotlight: {
        id: "spotlight",
        name: "Main Spotlight",
        type: "spot",
        enabled: true,
        position: { x: 4, y: 6, z: 2 },
        color: "#ffffff",
        intensity: 2.0,
        distance: 15,
        decay: 1,
        angle: Math.PI / 6,
        penumbra: 0.3,
        target: { x: 0, y: 0, z: 0 },
        animatable: true,
      },
    };
  },
};
