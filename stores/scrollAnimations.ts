import { defineStore } from "pinia";
import { ref, computed } from "vue";
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

export const useScrollAnimationsStore = defineStore("scrollAnimations", () => {
    // State
    const isEnabled = ref(true);
    const scrollProgress = ref(0);
    const cameraProgress = ref(0);
    const animationFrameId = ref<number | null>(null);

    // Store dependencies
    const sceneControlStore = useSceneControlStore();
    const smoothScroll = useSmoothScroll();

    // Getters (computed properties)
    const cameraStartViewports = computed(() => CAMERA_START_VIEWPORTS);
    const cellSizeStart = computed(() => CELL_SIZE_START);
    const cellSizeEnd = computed(() => CELL_SIZE_END);
    const fontSizeStart = computed(() => FONT_SIZE_START);
    const fontSizeEnd = computed(() => FONT_SIZE_END);
    const getCameraKeyframes = computed(() => cameraKeyframes);

    // Actions (functions)

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
        // Animate cell size from 45 to 9
        const newCellSize = gsap.utils.interpolate(
            CELL_SIZE_START,
            CELL_SIZE_END,
            progress
        );

        // Animate font size from 15 to 44
        const newFontSize = gsap.utils.interpolate(
            FONT_SIZE_START,
            FONT_SIZE_END,
            progress
        );

        // Update store values
        sceneControlStore.cellSize = Math.round(newCellSize);
        sceneControlStore.fontSize = Math.round(newFontSize);
    };

    // Update camera based on scroll progress
    const updateCamera = (progress: number) => {
        if (
            !isEnabled.value ||
            sceneControlStore.cameraControlMode !== "scroll"
        )
            return;

        const { position, rotation } = interpolateCamera(progress);

        // Update store camera values
        sceneControlStore.cameraPosition.x = position.x;
        sceneControlStore.cameraPosition.y = position.y;
        sceneControlStore.cameraPosition.z = position.z;

        sceneControlStore.cameraRotation.x = rotation.x;
        sceneControlStore.cameraRotation.y = rotation.y;
        sceneControlStore.cameraRotation.z = rotation.z;
    };

    // Main update function that handles all scroll-based animations
    const updateAnimations = () => {
        if (!isEnabled.value || !smoothScroll.lenis.value) {
            animationFrameId.value = null;
            return;
        }

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
            const remainingScrollHeight =
                totalScrollHeight - cameraStartPosition;
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

        animationFrameId.value = requestAnimationFrame(updateAnimations);
    };

    // Control functions
    const enable = () => {
        console.log("Enabling scroll animations");
        isEnabled.value = true;
        sceneControlStore.cameraControlMode = "scroll";

        // Start animation loop if not already running
        if (!animationFrameId.value && import.meta.client) {
            animationFrameId.value = requestAnimationFrame(updateAnimations);
        }
    };

    const disable = () => {
        console.log("Disabling scroll animations");
        isEnabled.value = false;
        sceneControlStore.cameraControlMode = "orbit";

        // Cancel animation frame if running
        if (animationFrameId.value) {
            cancelAnimationFrame(animationFrameId.value);
            animationFrameId.value = null;
        }
    };

    const startAnimationLoop = () => {
        if (import.meta.client && isEnabled.value && !animationFrameId.value) {
            animationFrameId.value = requestAnimationFrame(updateAnimations);
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

    // Cleanup function
    const cleanup = () => {
        if (animationFrameId.value) {
            cancelAnimationFrame(animationFrameId.value);
            animationFrameId.value = null;
        }
    };

    // Return everything that should be exposed
    return {
        // State
        isEnabled,
        scrollProgress,
        cameraProgress,
        animationFrameId,

        // Getters
        cameraStartViewports,
        cellSizeStart,
        cellSizeEnd,
        fontSizeStart,
        fontSizeEnd,
        getCameraKeyframes,

        // Actions
        interpolateCamera,
        updateASCIIParams,
        updateCamera,
        updateAnimations,
        enable,
        disable,
        startAnimationLoop,
        setProgress,
        cleanup,

        // Constants (for backward compatibility)
        CAMERA_START_VIEWPORTS,
        CELL_SIZE_START,
        CELL_SIZE_END,
        FONT_SIZE_START,
        FONT_SIZE_END,
        cameraKeyframes,
    };
});
