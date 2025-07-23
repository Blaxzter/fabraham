import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BlendFunction } from "postprocessing";
import type { LightConfig } from "~/types/lights";

export const useSceneControlStore = defineStore("sceneControl", () => {
  // UI Controls
  const showControlsPanel = ref(true);

  // Collapsed sections state
  const collapsedSections = ref({
    camera: false,
    scene: true,
    lights: true,
    ascii: false,
  });

  // Scene Controls
  const showWireframe = ref(true);
  const showRotationAxis = ref(false);
  const enableASCII = ref(true);

  // Camera control - now controlled programmatically via scroll
  const cameraPosition = ref({ x: 0.06, y: 0.04, z: 0.51 });
  const cameraRotation = ref({ x: -0.09, y: 0.13, z: 0.01 });

  // Camera control mode
  const cameraControlMode = ref<"scroll" | "orbit">("scroll");

  // Light system controls
  const enableColoredLights = ref(true);
  const showLightHelpers = ref(false);

  // Dynamic lights dictionary
  const lights = ref<Record<string, LightConfig>>({
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
  });

  // Light management functions
  const addLight = (lightConfig: LightConfig) => {
    lights.value[lightConfig.id] = lightConfig;
  };

  const removeLight = (lightId: string) => {
    delete lights.value[lightId];
  };

  const updateLightProperty = (
    lightId: string,
    property: keyof LightConfig,
    value: any
  ) => {
    if (lights.value[lightId]) {
      (lights.value[lightId] as any)[property] = value;
    }
  };

  const toggleLight = (lightId: string) => {
    if (lights.value[lightId]) {
      lights.value[lightId].enabled = !lights.value[lightId].enabled;
    }
  };

  // Get light by ID
  const getLight = (lightId: string) => {
    return lights.value[lightId];
  };

  // Get all lights of a specific type
  const getLightsByType = (type: "point" | "spot" | "directional") => {
    return Object.values(lights.value).filter((light) => light.type === type);
  };

  // Get all enabled lights
  const getEnabledLights = () => {
    return Object.values(lights.value).filter((light) => light.enabled);
  };

  // ASCII Control Parameters
  const cellSize = ref(64);
  const useSceneColor = ref(true);
  const asciiColor = ref("#ffffff");
  const inverted = ref(false);
  const characters = ref(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890"
  );
  const font = ref("Arial");
  const fontSize = ref(10);
  const textureSize = ref(1024);
  const cellCount = ref(16);
  const opacity = ref(1);
  const blendFunction = ref(BlendFunction.NORMAL);

  // float effect
  const floatEffect = ref(false);
  const floatSpeed = ref(1);
  const floatFactor = ref(0);
  const floatRange = ref(0.1);

  // Computed effect props that update reactively
  const effectProps = computed(() => ({
    blendFunction: enableASCII.value ? blendFunction.value : BlendFunction.SKIP,
    opacity: opacity.value,
    cellSize: cellSize.value,
    inverted: inverted.value,
    color: asciiColor.value,
    useSceneColor: useSceneColor.value,
    asciiTexture: {
      characters: characters.value,
      font: font.value,
      fontSize: fontSize.value,
      size: textureSize.value,
      cellCount: cellCount.value,
    },
  }));

  // Blend function options for dropdown
  const blendOptions = [
    { label: "Normal", value: BlendFunction.NORMAL },
    { label: "Add", value: BlendFunction.ADD },
    { label: "Alpha", value: BlendFunction.ALPHA },
    { label: "Average", value: BlendFunction.AVERAGE },
    { label: "Color", value: BlendFunction.COLOR },
    { label: "Darken", value: BlendFunction.DARKEN },
    { label: "Difference", value: BlendFunction.DIFFERENCE },
    { label: "Exclusion", value: BlendFunction.EXCLUSION },
    { label: "Lighten", value: BlendFunction.LIGHTEN },
    { label: "Multiply", value: BlendFunction.MULTIPLY },
    { label: "Overlay", value: BlendFunction.OVERLAY },
    { label: "Screen", value: BlendFunction.SCREEN },
    { label: "Subtract", value: BlendFunction.SUBTRACT },
  ];

  return {
    // UI Controls
    showControlsPanel,
    collapsedSections,

    // Scene Controls
    showWireframe,
    showRotationAxis,
    enableASCII,

    // Camera control
    cameraPosition,
    cameraRotation,
    cameraControlMode,

    // Light system controls
    enableColoredLights,
    showLightHelpers,
    lights,

    // Light management functions
    addLight,
    removeLight,
    updateLightProperty,
    toggleLight,
    getLight,
    getLightsByType,
    getEnabledLights,

    // ASCII Controls
    cellSize,
    useSceneColor,
    asciiColor,
    inverted,
    characters,
    font,
    fontSize,
    textureSize,
    cellCount,
    opacity,
    blendFunction,

    // float effect
    floatEffect,
    floatSpeed,
    floatFactor,
    floatRange,

    // Computed
    effectProps,

    // Constants
    blendOptions,
  };
});
