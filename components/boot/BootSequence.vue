<template>
  <div ref="containerRef" class="space-y-0.5 overflow-auto">
    <BootLine v-for="(line, index) in visibleLines" :key="index">
      <component :is="line" />
    </BootLine>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'

const emit = defineEmits<{
  complete: []
  easterEgg: []
  bootMenu: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const visibleLines = ref<any[]>([])
let bootTimeline: gsap.core.Timeline | null = null

// ===== DEBUG CONFIGURATION =====
// Global speed multiplier - adjust to make entire boot faster/slower
const SPEED_MULTIPLIER = 1.0 // 0.5 = 2x faster, 2.0 = 2x slower

// Disable auto-boot to home screen (stays at end of boot sequence)
const DISABLE_AUTO_BOOT = true // Set to true for debugging

// Disable "press any key to skip" functionality
const DISABLE_SKIP = true // Set to true to force watching full boot sequence
// ===============================

// Resolve the BootText component for use in h()
const BootTextComponent = resolveComponent('BootText')

// Boot sequence messages with timing delays (in seconds after previous message)
// Format: { message: () => VNode, delay: number }
const bootMessages = [
  { message: () => h(BootTextComponent, { text: 'FABRAHAM BIOS v3.14.2025', color: 'cyan', bold: true }), delay: 0 },
  { message: () => h(BootTextComponent, { text: 'Copyright (C) 2025, Fabraham Systems', color: 'white' }), delay: 0.1 },
  { message: () => h('br'), delay: 0.3 },
  
  // Hardware detection - slower
  { message: () => h(BootTextComponent, { text: 'Detecting hardware configuration...', color: 'white' }), delay: 0.5 },
  { message: () => h(BootTextComponent, { text: 'CPU: Neural Processing Unit @4.2GHz [OK]', color: 'green' }), delay: 0.4 },
  { message: () => h(BootTextComponent, { text: 'GPU: WebGL Rendering Engine v2.0 [OK]', color: 'green' }), delay: 0.3 },
  { message: () => h(BootTextComponent, { text: 'Memory: 32GB DDR5-6000 [OK]', color: 'green' }), delay: 0.3 },
  { message: () => h('br'), delay: 0.2 },
  
  // Memory test - fast
  { message: () => h(BootTextComponent, { text: 'Testing system memory...', color: 'white' }), delay: 0.3 },
  { message: () => h(BootTextComponent, { text: 'Testing: 16MB', color: 'white' }), delay: 0.05 },
  { message: () => h(BootTextComponent, { text: 'Testing: 512MB', color: 'white' }), delay: 0.05 },
  { message: () => h(BootTextComponent, { text: 'Testing: 4GB', color: 'white' }), delay: 0.05 },
  { message: () => h(BootTextComponent, { text: 'Testing: 16GB', color: 'white' }), delay: 0.05 },
  { message: () => h(BootTextComponent, { text: 'Testing: 32GB [OK]', color: 'green' }), delay: 0.05 },
  { message: () => h('br'), delay: 0.2 },
  
  // Loading components - medium speed
  { message: () => h(BootTextComponent, { text: 'Loading system components...', color: 'white' }), delay: 0.4 },
  { message: () => h(BootTextComponent, { text: '  → Vue.js Framework', color: 'green' }), delay: 0.15 },
  { message: () => h(BootTextComponent, { text: '  → Nuxt.js Runtime', color: 'green' }), delay: 0.15 },
  { message: () => h(BootTextComponent, { text: '  → Three.js Engine', color: 'green' }), delay: 0.15 },
  { message: () => h(BootTextComponent, { text: '  → GSAP Animation Library', color: 'green' }), delay: 0.15 },
  { message: () => h(BootTextComponent, { text: '  → TresJS Integration', color: 'green' }), delay: 0.15 },
  { message: () => h('br'), delay: 0.2 },
  
  // Initializing - slower for 3D stuff
  { message: () => h(BootTextComponent, { text: 'Initializing 3D Environment...', color: 'cyan' }), delay: 0.5 },
  { message: () => h(BootTextComponent, { text: '  → Setting up WebGL context', color: 'white' }), delay: 0.3 },
  { message: () => h(BootTextComponent, { text: '  → Loading GLTF models', color: 'white' }), delay: 0.6 },
  { message: () => h(BootTextComponent, { text: '  → Compiling shaders', color: 'white' }), delay: 0.4 },
  { message: () => h(BootTextComponent, { text: '  → Initializing post-processing', color: 'white' }), delay: 0.3 },
  { message: () => h(BootTextComponent, { text: '  → Setting up lighting', color: 'white' }), delay: 0.2 },
  { message: () => h(BootTextComponent, { text: '  → Configuring camera', color: 'white' }), delay: 0.2 },
  { message: () => h('br'), delay: 0.3 },
  
  // Final checks - medium
  { message: () => h(BootTextComponent, { text: 'Running system diagnostics...', color: 'white' }), delay: 0.4 },
  { message: () => h(BootTextComponent, { text: '  → Render pipeline: OK', color: 'green' }), delay: 0.2 },
  { message: () => h(BootTextComponent, { text: '  → Animation system: OK', color: 'green' }), delay: 0.2 },
  { message: () => h(BootTextComponent, { text: '  → Asset loader: OK', color: 'green' }), delay: 0.2 },
  { message: () => h('br'), delay: 0.3 },
  
  { message: () => h(BootTextComponent, { text: 'All systems operational.', color: 'green', bold: true }), delay: 0.5 },
  { message: () => h(BootTextComponent, { text: 'Booting to home screen...', color: 'cyan' }), delay: 0.8 },
]

const { gsap } = useGsap()

onMounted(() => {
  if (import.meta.client) {
    animateBootSequence()
    
    // Add keyboard listener (check for DELETE key)
    if (!DISABLE_SKIP) {
      window.addEventListener('keydown', handleKeydown)
      // Allow skipping with click
      window.addEventListener('click', () => skipBootSequence())
    } else {
      // Even with skip disabled, still listen for DEL/F10
      window.addEventListener('keydown', handleSpecialKeys)
    }
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keydown', handleSpecialKeys)
    window.removeEventListener('click', () => skipBootSequence())
  }
})

const handleKeydown = (e: KeyboardEvent) => {
  skipBootSequence(e)
}

const handleSpecialKeys = (e: KeyboardEvent) => {
  // Only handle DEL and F10 when skip is disabled
  if (e.key === 'Delete' || e.key === 'F10') {
    skipBootSequence(e)
  }
}

const skipBootSequence = (e?: KeyboardEvent) => {
  // Check for DELETE key - easter egg (BIOS)
  if (e?.key === 'Delete') {
    if (bootTimeline) {
      bootTimeline.kill()
    }
    emit('easterEgg')
    return
  }
  
  // Check for F10 key - boot menu
  if (e?.key === 'F10') {
    if (bootTimeline) {
      bootTimeline.kill()
    }
    emit('bootMenu')
    return
  }
  
  // Normal skip behavior (any other key)
  if (bootTimeline) {
    bootTimeline.progress(1) // Jump to end
  }
}

const animateBootSequence = () => {
  bootTimeline = gsap.timeline({
    onComplete: () => {
      // Only emit complete if auto-boot is enabled
      if (!DISABLE_AUTO_BOOT) {
        emit('complete')
      }
      // If auto-boot disabled, sequence just stops at the end
    }
  })

  // Add each line with variable timing for realism
  let cumulativeDelay = 0
  bootMessages.forEach(({ message, delay }) => {
    cumulativeDelay += delay * SPEED_MULTIPLIER // Apply global speed multiplier
    bootTimeline!.call(() => {
      visibleLines.value.push(message)
      
      // Auto-scroll to bottom
      nextTick(() => {
        if (containerRef.value) {
          containerRef.value.scrollTop = containerRef.value.scrollHeight
        }
      })
    }, [], cumulativeDelay)
  })
}
</script>

