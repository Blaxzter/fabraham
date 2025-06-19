import { ref } from "vue";
import { gsap } from "gsap";
import { useSceneControlStore } from "~/stores/SceneControl";
import { useSmoothScroll } from "~/composables/useSmoothScroll";

// Configuration: Number of viewport heights before camera animation starts
const CAMERA_START_VIEWPORTS = 2;

// Animation configuration
const CELL_SIZE_START = 45;
const CELL_SIZE_END = 9;
const FONT_SIZE_START = 15;
const FONT_SIZE_END = 44;

export function useScrollAnimations() {
  const store = useSceneControlStore();
  const smoothScroll = useSmoothScroll();
  const isEnabled = ref(true);
  const scrollProgress = ref(0);
  const cameraProgress = ref(0);

  // Define camera keyframes for scroll animation
  const cameraKeyframes = [
    {
      // Start position
      position: { x: 0.06, y: 0.04, z: 0.48 },
      rotation: { x: -0.15, y: 0.15, z: 0.02 },
      progress: 0,
    },
    {
      // Middle position (zoom out)
      position: { x: 0.06, y: 0.04, z: 1.26 },
      rotation: { x: -0.06, y: 0.06, z: 0 },
      progress: 0.5,
    },
    {
      // End position (move to side)
      position: { x: -0.81, y: 0.04, z: 1.53 },
      rotation: { x: -0.04, y: -0.16, z: -0.01 },
      progress: 1,
    },
  ];

  // Interpolate between keyframes based on progress
  const interpolateCamera = (progress: number) => {
    // Clamp progress between 0 and 1
    progress = Math.max(0, Math.min(1, progress));

    let fromKeyframe = cameraKeyframes[0];
    let toKeyframe = cameraKeyframes[1];

    // Find the correct keyframe pair
    for (let i = 0; i < cameraKeyframes.length - 1; i++) {
      if (
        progress >= cameraKeyframes[i].progress &&
        progress <= cameraKeyframes[i + 1].progress
      ) {
        fromKeyframe = cameraKeyframes[i];
        toKeyframe = cameraKeyframes[i + 1];
        break;
      }
    }

    // Calculate local progress between the two keyframes
    const localProgress =
      (progress - fromKeyframe.progress) /
      (toKeyframe.progress - fromKeyframe.progress);

    // Interpolate position and rotation
    const position = {
      x: gsap.utils.interpolate(
        fromKeyframe.position.x,
        toKeyframe.position.x,
        localProgress
      ),
      y: gsap.utils.interpolate(
        fromKeyframe.position.y,
        toKeyframe.position.y,
        localProgress
      ),
      z: gsap.utils.interpolate(
        fromKeyframe.position.z,
        toKeyframe.position.z,
        localProgress
      ),
    };

    const rotation = {
      x: gsap.utils.interpolate(
        fromKeyframe.rotation.x,
        toKeyframe.rotation.x,
        localProgress
      ),
      y: gsap.utils.interpolate(
        fromKeyframe.rotation.y,
        toKeyframe.rotation.y,
        localProgress
      ),
      z: gsap.utils.interpolate(
        fromKeyframe.rotation.z,
        toKeyframe.rotation.z,
        localProgress
      ),
    };

    return { position, rotation };
  };

  // Animate ASCII parameters based on scroll progress
  const updateASCIIParams = (progress: number) => {
    // Animate cell size from 64 to 10
    const newCellSize = gsap.utils.interpolate(
      CELL_SIZE_START,
      CELL_SIZE_END,
      progress
    );

    // Animate font size from 10 to 44
    const newFontSize = gsap.utils.interpolate(
      FONT_SIZE_START,
      FONT_SIZE_END,
      progress
    );

    // Update store values
    store.cellSize = Math.round(newCellSize);
    store.fontSize = Math.round(newFontSize);
  };

  // Update camera based on scroll progress
  const updateCamera = (progress: number) => {
    if (!isEnabled.value || store.cameraControlMode !== "scroll") return;

    const { position, rotation } = interpolateCamera(progress);

    // Update store camera values
    store.cameraPosition.x = position.x;
    store.cameraPosition.y = position.y;
    store.cameraPosition.z = position.z;

    store.cameraRotation.x = rotation.x;
    store.cameraRotation.y = rotation.y;
    store.cameraRotation.z = rotation.z;
  };

  // Main update function that handles all scroll-based animations
  const updateAnimations = () => {
    if (!smoothScroll.lenis.value) return;

    // Get current scroll position
    const scroll = smoothScroll.lenis.value.scroll;
    const viewportHeight = window.innerHeight;
    const cameraStartPosition = viewportHeight * CAMERA_START_VIEWPORTS;

    if (scroll <= cameraStartPosition) {
      // We're still in ASCII section (first 2 viewport heights)
      const asciiProgress = Math.max(
        0,
        Math.min(1, scroll / cameraStartPosition)
      );
      scrollProgress.value = asciiProgress;
      cameraProgress.value = 0;

      // Update ASCII parameters during this section
      updateASCIIParams(asciiProgress);

      // Keep camera at start position
      updateCamera(0);
    } else {
      // We're past the ASCII section, start camera animation
      scrollProgress.value = 1;

      // Camera animation starts after ASCII section
      const scrollPastStart = scroll - cameraStartPosition;
      const totalScrollHeight =
        document.documentElement.scrollHeight - viewportHeight;
      const remainingScrollHeight = totalScrollHeight - cameraStartPosition;
      const cameraProg = Math.max(
        0,
        Math.min(1, scrollPastStart / remainingScrollHeight)
      );

      cameraProgress.value = cameraProg;

      // Keep ASCII parameters at end values
      updateASCIIParams(1);

      // Update camera based on remaining scroll
      updateCamera(cameraProg);
    }

    requestAnimationFrame(updateAnimations);
  };

  // Control functions
  const enable = () => {
    isEnabled.value = true;
    store.cameraControlMode = "scroll";
  };

  const disable = () => {
    isEnabled.value = false;
    store.cameraControlMode = "orbit";
  };

  const startAnimationLoop = () => {
    if (import.meta.client) {
      updateAnimations();
    }
  };

  // Manual progress control for debugging/controls
  const setProgress = (progress: number) => {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    scrollProgress.value = clampedProgress;

    // Update ASCII params based on progress
    updateASCIIParams(clampedProgress);

    // Update camera position
    updateCamera(clampedProgress);
  };

  return {
    isEnabled,
    scrollProgress,
    cameraProgress,
    enable,
    disable,
    updateAnimations,
    startAnimationLoop,
    setProgress,
    cameraKeyframes,
    CAMERA_START_VIEWPORTS,
    // Animation constants for external use
    CELL_SIZE_START,
    CELL_SIZE_END,
    FONT_SIZE_START,
    FONT_SIZE_END,
  };
}
