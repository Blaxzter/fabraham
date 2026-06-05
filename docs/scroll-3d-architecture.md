# Scroll-Based 3D Scene Architecture

## Overview

This document details the architecture and implementation of the scroll-based 3D scene control system in the Fabraham portfolio. The system synchronizes user scrolling with 3D camera movements, ASCII text animations, and dynamic lighting effects to create an immersive, interactive experience.

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Component Breakdown](#component-breakdown)
3. [Store System](#store-system)
4. [Animation Pipeline](#animation-pipeline)
5. [Extending the System](#extending-the-system)
6. [Best Practices](#best-practices)

---

## Core Architecture

### High-Level Flow

```
User Scrolls
    ↓
Lenis (Smooth Scroll)
    ↓
ScrollAnimations Store
    ↓
    ├── Scene3D (Camera & ASCII)
    ├── ScrollableContent (Text Sections)
    └── Lights (Dynamic Lighting)
```

### Key Principles

1. **Centralized State Management**: All animation states are managed through Pinia stores
2. **Reactive Updates**: Vue's reactivity system propagates changes from stores to components
3. **Frame-based Animation**: Uses `requestAnimationFrame` for smooth 60fps animations
4. **Keyframe Interpolation**: GSAP utilities interpolate between defined keyframes

---

## Component Breakdown

### 1. `pages/index.vue`

**Purpose**: Main orchestrator that controls the boot sequence and component visibility.

**Key Features**:
- Manages boot screen transition
- Controls when 3D scene starts loading
- Shows scrollable content after boot completes
- Supports dev mode for faster iteration

**Important Logic**:
```vue
const shouldLoadScene = computed(() => {
  return (
    bootState.phase === "booting" ||
    bootState.phase === "loading-scene" ||
    bootState.bootCompleted
  );
});
```

The scene begins loading during the boot sequence to reduce perceived loading time.

---

### 2. `components/home/Scene3D.vue`

**Purpose**: Renders the 3D scene with a head model, lighting, and ASCII post-processing.

**Key Responsibilities**:
1. **Camera Management**: Syncs Three.js camera with store state
2. **Model Rendering**: Loads and displays 3D head model with DRACO compression
3. **Mouse Tracking**: Head rotation follows cursor with smooth lerping
4. **Mode Switching**: Supports both scroll and orbit control modes

**Store Integration**:
```javascript
const store = useSceneControlStore();

// Camera is controlled by store values
<TresPerspectiveCamera
  :position="[
    store.cameraPosition.x,
    store.cameraPosition.y,
    store.cameraPosition.z,
  ]"
  :rotation="[
    store.cameraRotation.x,
    store.cameraRotation.y,
    store.cameraRotation.z,
  ]"
/>
```

**Loop Function**:
The `onLoop` callback runs every frame:
- In **orbit mode**: Updates store from camera position (user controls camera)
- In **scroll mode**: Camera position is read-only (controlled by scroll)
- Always updates head rotation based on mouse position

---

### 3. `components/home/ScrollableContent.vue`

**Purpose**: Contains the scrollable HTML content sections that drive the animation.

**Key Features**:
- Uses `AsciiTextAnimation` component for the text reveal effect
- Contains placeholder divs with significant height (`h-[500vh]`) to enable scrolling
- Displays content sections (Introduction, Experience, Contact)
- Shows scroll indicator that fades out as user scrolls

**Store Integration**:
```javascript
const { startAnimationLoop } = useScrollAnimationsStore();
const { scrollProgress } = storeToRefs(useScrollAnimationsStore());

onMounted(() => {
    if (import.meta.client) {
        startAnimationLoop();
    }
});
```

**Layout Structure**:
1. **ASCII Animation Section** (200vh): First 2 viewport heights
2. **Scroll Buffer** (500vh): Empty space for camera animation
3. **Content Sections**: Regular HTML content at the end

---

### 4. `components/home/AsciiTextAnimation.vue`

**Purpose**: Animates ASCII text (name and title) that assembles character-by-character during scrolling.

**Animation Stages**:
1. **0-25% scroll**: First name assembles
2. **20-45% scroll**: Last name assembles (overlapping)
3. **40-70% scroll**: Title assembles
4. **70-100% scroll**: Text pushes up and out of view

**Key Features**:
- Random character cycling (idle animation)
- Progressive character revelation based on scroll
- Color interpolation during assembly
- Glitch effects for cyberpunk aesthetic
- Breathing effect when fully assembled

**Character Assembly Algorithm**:
```javascript
const charProgress = Math.max(
  0,
  Math.min(1, (lineProgress - index * 0.02) * 2)
);

if (charProgress >= 1) {
  // Fully revealed
  char.textContent = targetText[index];
} else {
  // Partially revealed - probabilistic
  if (Math.random() < charProgress) {
    char.textContent = targetText[index];
  } else {
    char.textContent = getRandomChar();
  }
}
```

---

### 5. `components/home/Lights.vue` & `Light.vue`

**Purpose**: Dynamic light system that can be animated based on scroll progress.

**Light Types Supported**:
- Point lights
- Spotlights
- Directional lights

**Animation Support**:
Lights can have `animationKeyframes` that define how their properties change:
```typescript
{
  progress: 0.5,
  position: { x: 2, y: 3, z: 2 },
  intensity: 2.0,
  color: "#ff0000"
}
```

---

## Store System

### 1. `stores/SceneControl.ts`

**Purpose**: Central configuration store for all 3D scene parameters.

**State Categories**:

#### Camera State
```typescript
cameraPosition: { x: 0.06, y: 0.04, z: 0.51 }
cameraRotation: { x: -0.09, y: 0.13, z: 0.01 }
cameraControlMode: "scroll" | "orbit"
```

#### Scene Controls
```typescript
showWireframe: boolean
showRotationAxis: boolean
enableASCII: boolean
```

#### ASCII Effect Parameters
```typescript
cellSize: number (9-45, animated during scroll)
fontSize: number (15-44, animated during scroll)
useSceneColor: boolean
asciiColor: string
inverted: boolean
characters: string
blendFunction: BlendFunction
```

#### Light System
```typescript
lights: Record<string, LightConfig>
enableColoredLights: boolean
showLightHelpers: boolean
```

**Key Methods**:
- `addLight()`, `removeLight()`, `toggleLight()`
- `updateLightProperty()`: Modify light properties dynamically
- `getLight()`, `getLightsByType()`, `getEnabledLights()`: Query lights

---

### 2. `stores/ScrollAnimations.ts`

**Purpose**: Orchestrates all scroll-based animations through a unified system.

**State**:
```typescript
isEnabled: boolean
scrollProgress: number (0-1, ASCII section progress)
cameraProgress: number (0-1, camera animation progress)
animationFrameId: number | null
```

**Configuration Constants**:
```typescript
CAMERA_START_VIEWPORTS = 2  // Camera starts moving after 2 viewports
CELL_SIZE_START = 45         // ASCII cell size at scroll start
CELL_SIZE_END = 9            // ASCII cell size at scroll end
FONT_SIZE_START = 15         // ASCII font size at start
FONT_SIZE_END = 44           // ASCII font size at end
```

**Camera Keyframes**:
Defines camera positions and rotations at different progress points:
```typescript
[
  {
    position: { x: 0.06, y: 0.04, z: 0.48 },
    rotation: { x: -0.15, y: 0.15, z: 0.02 },
    progress: 0,  // Start
  },
  {
    position: { x: 0.06, y: 0.04, z: 1.26 },
    rotation: { x: -0.06, y: 0.06, z: 0 },
    progress: 0.5,  // Middle - zoomed out
  },
  {
    position: { x: -0.81, y: 0.04, z: 1.53 },
    rotation: { x: -0.04, y: -0.16, z: -0.01 },
    progress: 1,  // End - moved to side
  },
]
```

**Core Functions**:

#### `updateAnimations()`
Main animation loop function called every frame via `requestAnimationFrame`:

```typescript
const updateAnimations = () => {
  const scroll = smoothScroll.lenis.value.scroll;
  const viewportHeight = window.innerHeight;
  const cameraStartPosition = viewportHeight * CAMERA_START_VIEWPORTS;

  if (scroll <= cameraStartPosition) {
    // Phase 1: ASCII Animation (0-2 viewports)
    const asciiProgress = scroll / cameraStartPosition;
    scrollProgress.value = asciiProgress;
    
    updateASCIIParams(asciiProgress);
    updateLights(asciiProgress);
    updateCamera(0);  // Keep camera at start
  } else {
    // Phase 2: Camera Animation (after 2 viewports)
    scrollProgress.value = 1;  // ASCII complete
    
    const scrollPastStart = scroll - cameraStartPosition;
    const remainingScrollHeight = totalScrollHeight - cameraStartPosition;
    const cameraProg = scrollPastStart / remainingScrollHeight;
    
    cameraProgress.value = cameraProg;
    
    updateASCIIParams(1);  // Keep ASCII at end values
    updateLights(totalProgress);
    updateCamera(cameraProg);
  }

  animationFrameId.value = requestAnimationFrame(updateAnimations);
};
```

#### `interpolateCamera(progress)`
Interpolates camera position/rotation between keyframes using GSAP:

```typescript
const interpolateCamera = (progress: number) => {
  // Find correct keyframe pair
  let fromKeyframe = cameraKeyframes[0];
  let toKeyframe = cameraKeyframes[1];

  for (let i = 0; i < cameraKeyframes.length - 1; i++) {
    if (progress >= cameraKeyframes[i].progress && 
        progress <= cameraKeyframes[i + 1].progress) {
      fromKeyframe = cameraKeyframes[i];
      toKeyframe = cameraKeyframes[i + 1];
      break;
    }
  }

  // Calculate local progress between keyframes
  const localProgress = (progress - fromKeyframe.progress) /
                        (toKeyframe.progress - fromKeyframe.progress);

  // Interpolate using GSAP utilities
  const position = {
    x: gsap.utils.interpolate(fromKeyframe.position.x, 
                               toKeyframe.position.x, 
                               localProgress),
    // ... y, z
  };

  return { position, rotation };
};
```

#### `updateASCIIParams(progress)`
Animates ASCII effect parameters:
```typescript
const updateASCIIParams = (progress: number) => {
  const newCellSize = gsap.utils.interpolate(
    CELL_SIZE_START,
    CELL_SIZE_END,
    progress
  );
  const newFontSize = gsap.utils.interpolate(
    FONT_SIZE_START,
    FONT_SIZE_END,
    progress
  );

  sceneControlStore.cellSize = Math.round(newCellSize);
  sceneControlStore.fontSize = Math.round(newFontSize);
};
```

#### `updateLights(progress)`
Animates lights that have `animationKeyframes` defined:
```typescript
const updateLights = (progress: number) => {
  const animatableLights = Object.values(sceneControlStore.lights)
    .filter(light => light.animatable && light.animationKeyframes);

  animatableLights.forEach((light) => {
    // Find keyframe pair
    // Calculate local progress
    // Interpolate position, intensity, color
  });
};
```

---

### 3. `stores/BootState.ts`

**Purpose**: Manages boot sequence state and transitions.

**Phases**:
- `init`: Initial state
- `booting`: Boot sequence running
- `easter-egg`: Easter egg display (optional)
- `menu`: Menu selection
- `loading-scene`: 3D scene loading
- `complete`: Boot complete, show main content

**Key Actions**:
- `setPhase()`: Transition between phases
- `markSceneReady()`: Called when 3D scene finishes loading
- `completeBootSequence()`: Transition to main experience

---

### 4. `composables/useSmoothScroll.ts`

**Purpose**: Provides smooth scrolling functionality using Lenis.

**Configuration**:
```typescript
new Lenis({
  duration: 1.2,  // Scroll duration
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
});
```

**Integration**:
The `ScrollAnimations` store accesses the Lenis instance:
```typescript
const scroll = smoothScroll.lenis.value.scroll;
```

---

## Animation Pipeline

### Detailed Flow

1. **User Scrolls**
   - Lenis captures scroll events
   - Applies smooth easing to scroll position

2. **ScrollAnimations Store (requestAnimationFrame loop)**
   ```
   updateAnimations()
     ↓
   Read scroll position from Lenis
     ↓
   Calculate progress values
     ↓
   ├── scrollProgress (0-1, ASCII section)
   └── cameraProgress (0-1, camera movement)
   ```

3. **Update Functions Called**
   ```
   updateASCIIParams(progress)
     → Updates cellSize, fontSize in SceneControl store
   
   updateLights(progress)
     → Interpolates light positions, intensities
   
   updateCamera(progress)
     → Interpolates camera position, rotation in SceneControl store
   ```

4. **Reactive Updates**
   ```
   Store values change
     ↓
   Vue reactivity triggers
     ↓
   Components re-render
     ↓
   ├── Scene3D: Camera moves, ASCII effect changes
   ├── AsciiTextAnimation: Characters assemble
   └── Lights: Light positions/intensities update
   ```

### Timeline Visualization

```
Scroll Position:
0vh    ────────────────────────────────────────────────────────────
       │ ASCII Text Animation (scrollProgress 0-1)                │
       │ - Characters assemble                                    │
       │ - Cell size: 45 → 9                                      │
       │ - Font size: 15 → 44                                     │
       │ - Camera: Fixed at start position                        │
200vh  ────────────────────────────────────────────────────────────
       │ Camera Animation (cameraProgress 0-1)                    │
       │ - Camera: Start → Middle → End                           │
       │ - ASCII: Locked at end values                            │
       │ - Lights: Continue animating                             │
~700vh ────────────────────────────────────────────────────────────
       │ Content Sections                                         │
       │ - Introduction                                           │
       │ - Experience                                             │
       │ - Contact                                                │
~1200vh ────────────────────────────────────────────────────────────
```

---

## Extending the System

### Adding New Camera Keyframes

1. **Edit `stores/ScrollAnimations.ts`**:
```typescript
const cameraKeyframes = [
  {
    position: { x: 0.06, y: 0.04, z: 0.48 },
    rotation: { x: -0.15, y: 0.15, z: 0.02 },
    progress: 0,
  },
  // Add new keyframe
  {
    position: { x: 0.20, y: 0.10, z: 0.80 },
    rotation: { x: -0.10, y: 0.10, z: 0.01 },
    progress: 0.25,  // At 25% of camera progress
  },
  {
    position: { x: 0.06, y: 0.04, z: 1.26 },
    rotation: { x: -0.06, y: 0.06, z: 0 },
    progress: 0.5,
  },
  // ... existing keyframes
];
```

2. **Test the animation**: The interpolation system automatically handles any number of keyframes.

### Adding Animated Scene Properties

#### Example: Animate Model Scale

1. **Add state to SceneControl store**:
```typescript
// stores/SceneControl.ts
const modelScale = ref(2.0);

return {
  // ... existing
  modelScale,
};
```

2. **Add keyframes configuration**:
```typescript
// stores/ScrollAnimations.ts
const modelScaleKeyframes = [
  { progress: 0, scale: 2.0 },
  { progress: 0.5, scale: 3.0 },
  { progress: 1, scale: 1.5 },
];
```

3. **Create update function**:
```typescript
const updateModelScale = (progress: number) => {
  // Find keyframe pair (similar to camera interpolation)
  let fromKeyframe = modelScaleKeyframes[0];
  let toKeyframe = modelScaleKeyframes[1];

  for (let i = 0; i < modelScaleKeyframes.length - 1; i++) {
    if (progress >= modelScaleKeyframes[i].progress && 
        progress <= modelScaleKeyframes[i + 1].progress) {
      fromKeyframe = modelScaleKeyframes[i];
      toKeyframe = modelScaleKeyframes[i + 1];
      break;
    }
  }

  const localProgress = (progress - fromKeyframe.progress) /
                        (toKeyframe.progress - fromKeyframe.progress);
  
  sceneControlStore.modelScale = gsap.utils.interpolate(
    fromKeyframe.scale,
    toKeyframe.scale,
    localProgress
  );
};
```

4. **Call in animation loop**:
```typescript
const updateAnimations = () => {
  // ... existing code
  
  updateModelScale(cameraProgress.value);
  
  // ... rest
};
```

5. **Use in component**:
```vue
<!-- Scene3D.vue -->
<primitive
  v-if="gltfScene"
  :object="gltfScene"
  :scale="[store.modelScale, store.modelScale, store.modelScale]"
/>
```

### Adding New Light Animations

1. **Add keyframes to a light**:
```typescript
// In component or boot sequence
sceneControlStore.updateLightProperty("red", "animationKeyframes", [
  {
    progress: 0,
    position: { x: 3, y: 2, z: 1 },
    intensity: 1.5,
    color: "#ff0000",
  },
  {
    progress: 0.5,
    position: { x: 0, y: 3, z: 2 },
    intensity: 3.0,
    color: "#ff6600",
  },
  {
    progress: 1,
    position: { x: -2, y: 4, z: 3 },
    intensity: 0.8,
    color: "#ff0000",
  },
]);
```

2. **Enable animation**:
```typescript
sceneControlStore.updateLightProperty("red", "animatable", true);
```

The `updateLights()` function in ScrollAnimations will automatically handle the animation.

### Adding New Sections to ScrollableContent

1. **Add HTML section**:
```vue
<!-- ScrollableContent.vue -->
<section class="h-screen flex items-center justify-center bg-transparent">
  <div class="text-center text-white bg-black/50 p-8 rounded-lg">
    <h2 class="text-3xl font-bold mb-4">My New Section</h2>
    <p class="text-lg opacity-80">Section content here</p>
  </div>
</section>
```

2. **Add corresponding camera keyframe** (if you want camera to move to a specific position for this section):
```typescript
{
  position: { x: 1.0, y: 0.2, z: 1.0 },
  rotation: { x: 0, y: 0.3, z: 0 },
  progress: 0.75,  // 75% through camera animation
}
```

### Creating Custom Animation Curves

The system uses GSAP's `interpolate` utility which provides linear interpolation. For custom easing:

```typescript
// Apply easing to progress before interpolation
const easedProgress = gsap.parseEase("power2.inOut")(progress);
const position = {
  x: gsap.utils.interpolate(from.x, to.x, easedProgress),
  // ...
};
```

Common easing functions:
- `power1.inOut`, `power2.inOut`, `power3.inOut`: Smooth acceleration/deceleration
- `elastic.out`: Bouncy effect
- `back.inOut`: Slight overshoot
- `expo.inOut`: Dramatic acceleration

### Adding Scroll-Triggered Events

For discrete events at specific scroll positions:

```typescript
const updateAnimations = () => {
  // ... existing code
  
  // Trigger event at 50% camera progress
  if (cameraProgress.value > 0.5 && !hasTriggeredEvent.value) {
    hasTriggeredEvent.value = true;
    // Do something (play sound, show notification, etc.)
    console.log("Halfway through camera animation!");
  }
  
  // ... rest
};
```

---

## Best Practices

### Performance Optimization

1. **Use `shallowRef` for Three.js objects** in Scene3D:
   ```typescript
   const modelRef = shallowRef<Object3D | null>(null);
   ```
   This prevents Vue from deeply watching complex 3D objects.

2. **Debounce expensive operations**:
   ```typescript
   let lastUpdate = 0;
   const updateThreshold = 16; // ~60fps
   
   const updateAnimations = () => {
     const now = Date.now();
     if (now - lastUpdate < updateThreshold) {
       animationFrameId.value = requestAnimationFrame(updateAnimations);
       return;
     }
     lastUpdate = now;
     
     // ... do updates
   };
   ```

3. **Round values** to reduce unnecessary renders:
   ```typescript
   store.cameraPosition.x = Math.round(position.x * 100) / 100;
   ```

### State Management

1. **Keep scroll logic in store**: Don't calculate scroll progress in components.

2. **Use computed properties** for derived state:
   ```typescript
   const effectProps = computed(() => ({
     cellSize: cellSize.value,
     fontSize: fontSize.value,
     // ... other props
   }));
   ```

3. **Avoid direct mutations**: Always use store actions or update functions.

### Animation Design

1. **Plan keyframes carefully**:
   - Start simple (2-3 keyframes)
   - Add more as needed
   - Test across different screen sizes

2. **Use overlapping animations**: Start next animation before previous completes for smoother transitions.

3. **Maintain consistent timing**:
   - ASCII animation: 0-70% of its section
   - Camera animation: After ASCII section completes

### Debugging

1. **Enable controls panel** in dev mode:
   ```typescript
   const devMode = ref(true);
   ```

2. **Use manual progress control**:
   ```typescript
   scrollAnimationsStore.setProgress(0.5); // Jump to 50%
   ```

3. **Log keyframe transitions**:
   ```typescript
   console.log(`Transitioning from keyframe ${i} to ${i+1}`);
   ```

4. **Visualize helpers**:
   ```typescript
   sceneControlStore.showLightHelpers = true;
   sceneControlStore.showWireframe = true;
   sceneControlStore.showRotationAxis = true;
   ```

### Code Organization

1. **Separate concerns**:
   - Scene3D: 3D rendering only
   - ScrollAnimations: Animation logic only
   - SceneControl: Configuration only

2. **Document keyframes** with comments:
   ```typescript
   const cameraKeyframes = [
     { /* Initial close-up view */ },
     { /* Zoom out for context */ },
     { /* Side angle for profile view */ },
   ];
   ```

3. **Extract magic numbers** to constants:
   ```typescript
   const CAMERA_START_VIEWPORTS = 2;
   const CELL_SIZE_START = 45;
   ```

### Testing Different Scroll Scenarios

1. **Fast scrolling**: Test with quick scroll to ensure smooth interpolation
2. **Scroll direction**: Test scrolling up and down
3. **Mobile**: Test touch scrolling and momentum
4. **Different viewports**: Test on various screen sizes (affects viewport height calculations)

---

## Advanced Topics

### Scroll Direction Detection

Add scroll direction tracking for direction-dependent effects:

```typescript
let lastScroll = 0;
const scrollDirection = ref<'up' | 'down'>('down');

const updateAnimations = () => {
  const scroll = smoothScroll.lenis.value.scroll;
  
  scrollDirection.value = scroll > lastScroll ? 'down' : 'up';
  lastScroll = scroll;
  
  // Use scrollDirection.value for conditional effects
};
```

### Parallax Layers

Add depth with multiple parallax speeds:

```typescript
const updateParallax = (progress: number) => {
  // Layer 1: Moves slowly (background)
  layer1Position.value = progress * 0.3;
  
  // Layer 2: Moves at normal speed
  layer2Position.value = progress * 1.0;
  
  // Layer 3: Moves quickly (foreground)
  layer3Position.value = progress * 1.5;
};
```

### Scroll Velocity Effects

Use scroll speed to influence animations:

```typescript
const scrollVelocity = ref(0);
let lastScrollTime = 0;
let lastScrollValue = 0;

const updateAnimations = () => {
  const now = Date.now();
  const scroll = smoothScroll.lenis.value.scroll;
  
  const deltaTime = now - lastScrollTime;
  const deltaScroll = scroll - lastScrollValue;
  
  scrollVelocity.value = deltaScroll / deltaTime;
  
  // Use velocity for effects (e.g., blur, motion distortion)
  const blurAmount = Math.min(10, Math.abs(scrollVelocity.value) * 5);
  
  lastScrollTime = now;
  lastScrollValue = scroll;
};
```

### Combining with GSAP Timelines

For complex sequences, use GSAP timelines:

```typescript
const createScrollTimeline = () => {
  const tl = gsap.timeline({ paused: true });
  
  tl.to(object, { x: 100, duration: 1 })
    .to(object, { y: 200, duration: 1 })
    .to(object, { rotation: Math.PI, duration: 1 });
  
  return tl;
};

const timeline = createScrollTimeline();

const updateAnimations = () => {
  timeline.progress(scrollProgress.value);
};
```

---

## Troubleshooting

### Common Issues

1. **Camera not moving**
   - Check `cameraControlMode` is set to `"scroll"`
   - Verify `startAnimationLoop()` is called
   - Ensure scroll position exceeds `CAMERA_START_VIEWPORTS`

2. **Jerky animations**
   - Check for expensive operations in animation loop
   - Ensure values are rounded appropriately
   - Verify `requestAnimationFrame` is being used

3. **ASCII not animating**
   - Verify `scrollProgress` is updating
   - Check `updateASCIIParams()` is being called
   - Ensure store values are reactive (using `ref`)

4. **Lights not animating**
   - Verify `animatable: true` is set on light
   - Check `animationKeyframes` array is defined
   - Ensure `updateLights()` is being called

---

## Conclusion

This scroll-based 3D animation system provides a flexible foundation for creating immersive web experiences. The key to its power is the separation of concerns:

- **Stores**: Manage state
- **Components**: Render based on state
- **Composables**: Provide utilities (smooth scroll)
- **Animation Loop**: Orchestrates updates

By understanding this architecture, you can extend the system with new effects, animations, and interactions while maintaining clean, maintainable code.

### Key Takeaways

1. All scroll-based animations flow through `ScrollAnimations` store
2. Use keyframes for defining animation points
3. GSAP interpolation handles smooth transitions
4. Reactive state propagates changes automatically
5. Separation of phases (ASCII → Camera) creates natural progression
6. Performance is maintained through shallow refs and rounding

### Next Steps

- Experiment with new camera keyframes
- Add custom scroll-triggered effects
- Create dynamic light shows
- Build interactive elements that respond to scroll
- Optimize for mobile performance

Happy coding! 🚀
