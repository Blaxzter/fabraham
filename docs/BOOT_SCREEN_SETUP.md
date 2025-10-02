# Boot Screen Setup - Quick Start

## What Was Built

A complete DOS/BIOS-style boot screen system that displays while your Three.js scene loads, consisting of:

### 7 New Components (Small & Focused)
1. **BootScreen.vue** - Main container with CRT effects
2. **BootSequence.vue** - Animated boot messages
3. **BootMenu.vue** - Interactive navigation menu
4. **BootText.vue** - Reusable colored text
5. **BootLine.vue** - Consistent line formatting
6. **BootLoadingBar.vue** - Progress indicator
7. **BootEasterEgg.vue** - Secret developer mode (press DEL!) 🥚

### 1 New Store
- **BootState.ts** - Manages boot phases and state

### Styling
- **boot.css** - CRT/DOS visual effects (scanlines, flicker, glow)

## How It Works

1. **Page loads** → Boot screen appears instantly (black screen with green text)
2. **Boot sequence plays** → Realistic scrolling messages with variable timing
   - 3D scene loads in background during boot sequence
   - Hardware detection (slow), memory test (fast), component loading (medium)
   - Total ~10 seconds of authentic boot animation
3. **Auto-boot to home** → After boot sequence completes, automatically loads home screen
4. **Boot screen fades** → Main app appears with 3D scene ready

### Alternative Paths:
- **Press DEL** during boot → Enter BIOS Setup (easter egg)
- **Press F10** during boot → Open Boot Menu (choose Projects/Setup)
- **Press any other key** → Skip to end of boot sequence

## Testing

```bash
# Start the dev server
pnpm run dev

# Navigate to http://localhost:3000
# You should see the boot screen immediately!
```

### Expected Behavior:
1. ✅ Instant black screen with green text (no white flash)
2. ✅ Boot messages scroll with realistic variable timing
   - Some lines fast (0.05s), some slow (0.6s) for authenticity
   - Memory test blazes through, 3D loading takes longer
3. ✅ Fixed footer shows: "DEL: BIOS Setup | F10: Boot Menu"
4. ✅ 3D scene loads in background during boot (parallel loading)
5. ✅ Boot completes → Automatically goes to home screen
6. ✅ **Special keys:**
   - DELETE → Secret BIOS easter egg 🥚
   - F10 → Boot menu (Projects/Setup)
   - Any other key → Skip boot animation
7. ✅ Boot screen fades → Main portfolio with 3D head model appears

## Key Features

### User Experience
- **Instant load** - No white flash, boot screen shows immediately
- **Realistic timing** - Variable speed like real BIOS (fast memory tests, slow 3D init)
- **Skippable** - Press any key to fast-forward
- **Always visible keys** - DEL/F10 hints fixed at bottom
- **Parallel loading** - Scene loads during boot for optimal performance
- **Auto-boot** - Directly to home screen after sequence (like a real PC)
- **Retro aesthetic** - Authentic DOS/BIOS styling

### Technical
- **Clean code** - Small, focused components
- **GSAP animations** - Smooth, hardware-accelerated
- **Lazy loading** - Scene3D only loads when needed
- **State management** - Pinia store tracks boot progress

## Customization Quick Reference

### Change Boot Messages
Edit: `components/boot/BootSequence.vue`
```typescript
const bootMessages = [
  { 
    message: () => h(BootTextComponent, { text: 'YOUR TEXT', color: 'cyan', bold: true }), 
    delay: 0.5  // seconds after previous line
  },
]
```
**Timing tips:**
- Fast lines: 0.05-0.1s (memory tests, file checks)
- Medium lines: 0.2-0.3s (loading components)
- Slow lines: 0.5-0.8s (3D initialization, diagnostics)

### Add Menu Options
Edit: `components/boot/BootMenu.vue`
```typescript
const menuOptions = [
  { id: 'new', label: 'New Option', route: '/new-page' },
]
```

### Adjust Timing
- Boot sequence: `BootSequence.vue` → Change `delay` values in bootMessages array
- Individual line speed: Adjust each message's delay (0.05 = fast, 0.8 = slow)
- Fade out speed: `BootScreen.vue` → `duration: 0.5`

## Visual Effects

The boot screen includes authentic CRT monitor effects:
- 📺 **Scanlines** - Moving horizontal lines
- ✨ **Screen flicker** - Subtle opacity changes
- 💚 **Text glow** - Green phosphor-like glow
- 📍 **Blinking cursor** - Bottom-right corner
- 🖥️ **Radial gradient** - Simulated screen curvature

## File Structure

```
/components/boot/
  ├── BootScreen.vue       # Main container
  ├── BootSequence.vue     # Boot messages
  ├── BootMenu.vue         # Navigation menu
  ├── BootEasterEgg.vue    # Secret easter egg (DEL key)
  ├── BootText.vue         # Text component
  ├── BootLine.vue         # Line wrapper
  └── BootLoadingBar.vue   # Progress bar

/stores/
  └── BootState.ts         # State management

/assets/css/
  └── boot.css             # Visual effects

/docs/
  └── BOOT_SCREEN.md       # Full documentation
```

## Integration Points

### pages/index.vue
Shows boot screen until completed, starts loading 3D scene during boot sequence

### components/home/Scene3D.vue
Signals when model is loaded via `bootState.markSceneReady()`

### nuxt.config.ts
Includes boot.css in global styles

## Boot Flow Diagram

```
User Loads Page
    ↓
[init] Boot screen appears instantly
    ↓
[booting] Boot sequence plays (variable timing ~10s)
    |     → 3D Scene loads in PARALLEL (background)
    |     → Footer shows: "DEL: BIOS Setup | F10: Boot Menu"
    |
    ├─ Press DEL → [easter-egg] BIOS Setup
    |               ├─ ESC → back to boot
    |               └─ ENTER → skip to menu
    |
    ├─ Press F10 → [menu] Boot Menu
    |               └─ Select option → navigate/load
    |
    └─ Complete → [loading-scene] Wait for 3D ready
                        ↓
                  [complete] Fade out → Home screen with 3D
```

## Troubleshooting

### Issue: Boot screen doesn't appear
**Fix:** Restart dev server to regenerate Nuxt auto-imports
```bash
# Stop server (Ctrl+C), then:
pnpm run dev
```

### Issue: TypeScript errors about `useBootStateStore`
**Fix:** This is auto-imported by Nuxt. Restart dev server or run:
```bash
pnpm run postinstall
```

### Issue: Boot screen appears on every page
**Expected:** Boot screen only appears on home page (`/`). Other pages load normally.

### Issue: Can't skip boot sequence
**Check:** Are there other components capturing keyboard events?

## Performance

The boot screen actually **improves** perceived performance by:
1. Showing content instantly (no white screen)
2. Providing visual feedback during load
3. Delaying heavy Three.js initialization
4. Only loading 3D scene when user chooses it

## Next Steps

You can now:
- ✅ Customize boot messages for your brand
- ✅ Add more menu options
- ✅ Adjust timing to match your load times
- ✅ Add sound effects (optional)
- ✅ Implement "remember last choice" feature
- ✅ Add ASCII art/logo to boot sequence

Enjoy your retro boot experience! 🖥️✨

