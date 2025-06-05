<template>
  <div class="ascii-demo">
    <div id="info">
      <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a>
      - effects - ascii (TresJs v3) - {{ debugInfo }}
    </div>

    <TresCanvas v-bind="gl" ref="canvasRef">
      <TresPerspectiveCamera
        ref="cameraRef"
        :position="[0, 150, 500]"
        :fov="70"
        :aspect="aspect"
        :near="1"
        :far="1000"
      />

      <TresScene :background="new THREE.Color(0, 0, 0)">
        <!-- Ambient Light -->
        <TresAmbientLight :color="0x404040" :intensity="0.5" />

        <!-- Directional Light -->
        <TresDirectionalLight
          :color="0xffffff"
          :intensity="1"
          :position="[1, 1, 1]"
        />

        <!-- Point Lights -->
        <TresPointLight
          :color="0xffffff"
          :intensity="2"
          :position="[500, 500, 500]"
        />

        <!-- Animated Sphere -->
        <TresMesh
          ref="sphereRef"
          :position="[0, sphereY, 0]"
          :rotation="[sphereRotationX, 0, sphereRotationZ]"
        >
          <TresSphereGeometry :args="[200, 20, 10]" />
          <TresMeshLambertMaterial :color="0xffffff" :emissive="0x111111" />
        </TresMesh>

        <!-- Ground Plane -->
        <TresMesh :position="[0, -200, 0]" :rotation="[-Math.PI / 2, 0, 0]">
          <TresPlaneGeometry :args="[400, 400]" />
          <TresMeshLambertMaterial :color="0x808080" />
        </TresMesh>
      </TresScene>
    </TresCanvas>

    <!-- ASCII Effect Container -->
    <div ref="asciiContainer" class="ascii-container" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from "vue";
import { TresCanvas } from "@tresjs/core";

// @ts-expect-error - Three.js types not available
import * as THREE from "three";
// @ts-expect-error - AsciiEffect types not available
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";
// @ts-expect-error - TrackballControls types not available
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

// Reactive state
const canvasRef = ref();
const cameraRef = ref();
const sphereRef = ref();
const asciiContainer = ref();
const debugInfo = ref("Initializing...");

const start = Date.now();
const aspect = ref(
  typeof window !== "undefined"
    ? window.innerWidth / window.innerHeight
    : 16 / 9
);

// Animation state
const sphereY = ref(0);
const sphereRotationX = ref(0);
const sphereRotationZ = ref(0);

// Canvas configuration
const gl = reactive({
  clearColor: "#000000",
  shadows: false,
  alpha: false,
  powerPreference: "high-performance",
  antialias: false,
});

// Variables for effect and controls
let effect: AsciiEffect | null = null;
let controls: TrackballControls | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let animationId: number | null = null;

// Animation loop
let animate = () => {
  if (!renderer || !scene || !camera) {
    animationId = requestAnimationFrame(animate);
    return;
  }

  const timer = Date.now() - start;

  // Update sphere animation
  sphereY.value = Math.abs(Math.sin(timer * 0.002)) * 150;
  sphereRotationX.value = timer * 0.0003;
  sphereRotationZ.value = timer * 0.0002;

  // Update controls
  if (controls) {
    controls.update();
  }

  // Render with ASCII effect or normal renderer
  if (effect) {
    effect.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }

  animationId = requestAnimationFrame(animate);
};

const setupAsciiEffect = async () => {
  if (typeof window === "undefined") return;

  debugInfo.value = "Waiting for TresJS initialization...";

  // Wait for TresJS to fully initialize
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Try to find the canvas element directly
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    debugInfo.value = "No canvas found";
    return;
  }

  debugInfo.value = "Canvas found, creating Three.js scene...";

  try {
    // Create our own renderer that shares the canvas
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Create camera
    camera = new THREE.PerspectiveCamera(70, aspect.value, 1, 1000);
    camera.position.set(0, 150, 500);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0xffffff, 2);
    pointLight1.position.set(500, 500, 500);
    scene.add(pointLight1);

    // Create sphere
    const sphereGeometry = new THREE.SphereGeometry(200, 20, 10);
    const sphereMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0x111111,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);

    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(400, 400);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -200;
    scene.add(ground);

    debugInfo.value = "Creating ASCII effect...";

    // Create ASCII effect
    effect = new AsciiEffect(renderer, " .:-+*=%@#", { invert: true });
    effect.setSize(window.innerWidth, window.innerHeight);
    effect.domElement.style.color = "white";
    effect.domElement.style.backgroundColor = "black";
    effect.domElement.style.fontFamily = "'Courier New', Courier, monospace";
    effect.domElement.style.fontSize = "12px";
    effect.domElement.style.lineHeight = "12px";

    // Hide the original canvas and show ASCII effect
    canvas.style.display = "none";
    if (asciiContainer.value) {
      asciiContainer.value.appendChild(effect.domElement);
    }

    // Setup controls
    controls = new TrackballControls(camera, effect.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;

    debugInfo.value = "ASCII effect ready!";

    // Update sphere position in our scene
    const updateSphere = () => {
      if (sphere) {
        sphere.position.y = sphereY.value;
        sphere.rotation.x = sphereRotationX.value;
        sphere.rotation.z = sphereRotationZ.value;
      }
    };

    // Start animation loop
    const originalAnimate = animate;
    animate = () => {
      originalAnimate();
      updateSphere();
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (typeof window === "undefined") return;

      const newAspect = window.innerWidth / window.innerHeight;
      aspect.value = newAspect;

      if (camera) {
        camera.aspect = newAspect;
        camera.updateProjectionMatrix();
      }

      if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
      }

      if (effect) {
        effect.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    onUnmounted(() => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }

      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }

      if (controls) {
        controls.dispose();
      }

      if (canvas) {
        canvas.style.display = "block";
      }
    });
  } catch (error) {
    console.error("Failed to setup ASCII effect:", error);
    debugInfo.value = `Error: ${error.message}`;
  }
};

onMounted(() => {
  debugInfo.value = "Component mounted";
  setupAsciiEffect();
});
</script>

<style scoped>
.ascii-demo {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: "Courier New", Courier, monospace;
  background: black;
}

.ascii-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
}

#info {
  position: absolute;
  top: 10px;
  width: 100%;
  text-align: center;
  z-index: 100;
  display: block;
  color: white;
  font-size: 12px;
  pointer-events: none;
}

#info a {
  color: #ffffff;
  font-weight: bold;
  text-decoration: underline;
  pointer-events: all;
}
</style>
