# Boot Screen System

A DOS/BIOS-inspired boot screen system that displays while Three.js and 3D assets are loading.

## Overview

The boot screen system provides a nostalgic, retro computing experience that serves both aesthetic and functional purposes:
- Displays immediately while heavy assets load
- Provides visual feedback during initialization
- Offers navigation through a boot menu
- Fully animated using GSAP

## Architecture

### Store: `BootState`
**Location:** `stores/BootState.ts`

Manages the boot sequence state with the following phases:
- `init` - Initial state
- `booting` - Boot sequence animation running
- `menu` - Boot menu displayed
- `loading-scene` - 3D scene is loading
- `complete` - Boot completed, main app visible

### Components

#### `BootScreen.vue`
**Location:** `components/boot/BootScreen.vue`

Main container component that:
- Manages the boot sequence flow
- Handles phase transitions
- Applies CRT/scanline effects
- Coordinates with the router for navigation

#### `BootSequence.vue`
**Location:** `components/boot/BootSequence.vue`

Displays the scrolling boot messages:
- Animates boot text line by line
- Allows skipping via any key press or click
- Emits `complete` event when done
- Fully customizable boot messages

#### `BootMenu.vue`
**Location:** `components/boot/BootMenu.vue`

Interactive boot menu:
- Keyboard navigation (arrow keys + Enter)
- Mouse navigation (hover + click)
- Routes to different sections:
  - Home (3D Portfolio)
  - Projects Archive
  - Setup & Configuration

#### `BootText.vue`
**Location:** `components/boot/BootText.vue`

Simple text component with color variants:
- Colors: `green`, `white`, `cyan`, `yellow`, `red`
- Optional `bold` prop
- Consistent styling across boot screen

#### `BootLine.vue`
**Location:** `components/boot/BootLine.vue`

Wrapper for boot lines ensuring consistent:
- Font family (monospace)
- Text size
- Line height

#### `BootLoadingBar.vue`
**Location:** `components/boot/BootLoadingBar.vue`

Animated progress bar shown during scene loading:
- Animates from 0-100%
- Customizable message
- DOS-style border and styling

## Usage

### Integration

The boot screen is integrated in `pages/index.vue`:

```vue
<template>
  <div class="relative">
    <!-- Boot Screen -->
    <BootScreen v-if="!bootState.bootCompleted" />

    <!-- 3D Scene loads when needed -->
    <div v-if="shouldLoadScene" class="fixed inset-0 w-full h-screen">
      <HomeScene3D />
    </div>

    <!-- Main content after boot -->
    <HomeScrollableContent v-if="bootState.bootCompleted" />
  </div>
</template>
```

### Scene Loading

The `Scene3D` component signals when it's ready:

```typescript
// In Scene3D.vue
const bootState = useBootStateStore();

// After loading GLTF model
if (import.meta.client) {
  bootState.markSceneReady();
}
```

## Customization

### Boot Messages

Edit `BootSequence.vue` to customize boot messages:

```typescript
const bootMessages = [
  () => h(BootText, { text: 'Your message', color: 'cyan', bold: true }),
  () => h('br'), // Line break
  // ... more messages
]
```

### Menu Options

Edit `BootMenu.vue` to add/modify menu options:

```typescript
const menuOptions = [
  { id: 'home', label: 'Boot to Home Screen', route: '/' },
  { id: 'custom', label: 'Your Custom Option', route: '/custom' },
]
```

### Timing

Adjust animation timing in components:
- `BootSequence.vue`: Change `0.15` in the stagger delay
- `BootLoadingBar.vue`: Modify `duration: 2` for progress bar
- `BootScreen.vue`: Adjust fade timings in transitions

## Styling

### CSS Classes

Custom CSS in `assets/css/boot.css`:
- `.boot-screen` - Base boot screen styling
- `.scanline` - Animated CRT scanline effect
- `.cursor-blink` - Blinking cursor animation
- `.screen-flicker` - Subtle screen flicker
- `.text-glow-green` / `.text-glow-cyan` - Glow effects

### Visual Effects

The boot screen includes:
1. **CRT Monitor Effect** - Curved screen simulation
2. **Scanlines** - Animated horizontal lines
3. **Screen Flicker** - Subtle opacity variations
4. **Text Glow** - DOS-style text shadows
5. **Cursor Blink** - Classic terminal cursor

## Flow Diagram

```
User Loads Page
    ↓
[init] Boot screen appears instantly
    ↓
[booting] Boot sequence animation plays
    ↓ (user can skip by pressing any key)
    ↓
[menu] Boot menu appears
    ↓ (user selects option)
    ↓
[loading-scene] If Home selected:
    ↓            - Show loading bar
    ↓            - Start loading Scene3D
    ↓            - Wait for scene ready
    ↓
[complete] Fade out boot screen → Main app visible
```

## Best Practices

1. **Keep boot messages concise** - They appear quickly, make them readable
2. **Small components** - Each component has a single responsibility
3. **Reusable pieces** - `BootText` and `BootLine` can be used elsewhere
4. **Performance** - Scene only loads when needed, not on initial page load
5. **Accessibility** - Keyboard navigation fully supported

## Troubleshooting

### Boot screen doesn't appear
- Check that `BootState` store is imported correctly
- Verify Nuxt auto-imports are working (restart dev server)

### Scene loads too quickly
- Increase delay in `BootSequence.vue` stagger timing
- Add more boot messages

### Menu navigation not working
- Check that keyboard event listeners are attached
- Verify no other components are capturing keyboard events

## Future Enhancements

Potential additions:
- BIOS beep sounds
- More menu options (settings, themes, etc.)
- Save last boot selection
- "Safe mode" option for performance
- Custom boot logos/ASCII art

