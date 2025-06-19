import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BlendFunction } from "postprocessing";

export const useSceneControlStore = defineStore("sceneControl", () => {
  // UI Controls
  const showControlsPanel = ref(true);

  // Scene Controls
  const showWireframe = ref(true);
  const showRotationAxis = ref(false);
  const enableASCII = ref(true);

  // Camera control - now controlled programmatically via scroll
  const cameraPosition = ref({ x: 0.06, y: 0.04, z: 0.51 });
  const cameraRotation = ref({ x: -0.09, y: 0.13, z: 0.01 });

  // Camera control mode
  const cameraControlMode = ref<"scroll" | "orbit">("scroll");

  // Colored lights controls
  const enableColoredLights = ref(true);
  const showLightHelpers = ref(false);
  const redLight = ref({ enabled: true, intensity: 1.5, color: "#ff0000" });
  const greenLight = ref({ enabled: true, intensity: 1.5, color: "#00ff00" });
  const blueLight = ref({ enabled: true, intensity: 1.5, color: "#0088ff" });
  const yellowLight = ref({ enabled: true, intensity: 1.2, color: "#ffff00" });
  const purpleLight = ref({ enabled: true, intensity: 1.2, color: "#ff00ff" });
  const spotlight = ref({
    enabled: true,
    intensity: 2.0,
    color: "#ffffff",
    angle: Math.PI / 6,
  });

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

    // Scene Controls
    showWireframe,
    showRotationAxis,
    enableASCII,

    // Camera control
    cameraPosition,
    cameraRotation,
    cameraControlMode,

    // Colored lights controls
    enableColoredLights,
    showLightHelpers,
    redLight,
    greenLight,
    blueLight,
    yellowLight,
    purpleLight,
    spotlight,

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
