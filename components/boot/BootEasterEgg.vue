<template>
  <div class="space-y-4 font-mono text-sm">
    <!-- Header -->
    <div class="border-2 border-red-500 p-4 bg-red-900/20">
      <div class="flex items-center justify-between">
        <BootText text="⚠ DEVELOPER MODE ACTIVATED ⚠" color="red" bold />
        <BootText text="[DEL]" color="yellow" />
      </div>
    </div>

    <!-- Warning Message -->
    <div class="space-y-2 p-4 border border-yellow-400 bg-yellow-900/10">
      <BootText text="WARNING: You have entered a restricted area." color="yellow" bold />
      <BootText text="Only authorized personnel should be here. But since you found it..." color="white" />
    </div>

    <!-- System Info Grid -->
    <div ref="contentRef" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <!-- Left Column - System Stats -->
      <div class="space-y-2 p-4 border border-green-400 bg-green-900/10">
        <BootText text="=== SYSTEM DIAGNOSTICS ===" color="green" bold />
        <div class="mt-3 space-y-1 text-xs">
          <div><BootText text="Boot Attempts: 42,069" color="white" /></div>
          <div><BootText text="Coffee Consumed: ∞" color="white" /></div>
          <div><BootText text="Bugs Fixed: 127" color="white" /></div>
          <div><BootText text="Bugs Created: 128" color="white" /></div>
          <div><BootText text="Code Quality: Questionable" color="white" /></div>
          <div><BootText text="Deadline Status: What deadline?" color="white" /></div>
        </div>
      </div>

      <!-- Right Column - ASCII Art -->
      <div class="space-y-2 p-4 border border-cyan-400 bg-cyan-900/10">
        <BootText text="=== DEVELOPER PROFILE ===" color="cyan" bold />
        <pre class="text-cyan-400 text-xs mt-3 leading-tight">
    __________
   /          \\
  |  O    O   |
  |     ^     |
  |   \\_____/  |
   \\__________/
   FABRAHAM.DEV
        </pre>
      </div>

      <!-- Bottom Left - Tech Stack -->
      <div class="space-y-2 p-4 border border-cyan-400 bg-cyan-900/10">
        <BootText text="=== TECH STACK DETECTED ===" color="cyan" bold />
        <div class="mt-3 space-y-1 text-xs">
          <div><BootText text="✓ Vue.js 3.5.15" color="green" /></div>
          <div><BootText text="✓ Nuxt.js 3.17.4" color="green" /></div>
          <div><BootText text="✓ Three.js 0.177.0" color="green" /></div>
          <div><BootText text="✓ GSAP 3.13.0" color="green" /></div>
          <div><BootText text="✓ TresJS 4.3.5" color="green" /></div>
          <div><BootText text="✓ Caffeine: Maximum" color="yellow" /></div>
        </div>
      </div>

      <!-- Bottom Right - Fun Facts -->
      <div class="space-y-2 p-4 border border-yellow-400 bg-yellow-900/10">
        <BootText text="=== RANDOM FACTS ===" color="yellow" bold />
        <div class="mt-3 space-y-1 text-xs">
          <div><BootText text="• This easter egg was found!" color="white" /></div>
          <div><BootText text="• You're a curious one" color="white" /></div>
          <div><BootText text="• Made with ❤ and ☕" color="white" /></div>
          <div><BootText text="• No AI was harmed" color="white" /></div>
          <div><BootText text="• Retro vibes only" color="white" /></div>
          <div><BootText text="• DEL key = best key" color="white" /></div>
        </div>
      </div>
    </div>

    <!-- Footer with Options -->
    <div class="mt-6 pt-4 border-t border-gray-700 text-center space-y-2">
      <BootText text="Press ESC to return to boot sequence" color="yellow" />
      <BootText text="Press ENTER to continue to boot menu" color="yellow" />
    </div>

    <!-- Blinking Cursor -->
    <div class="text-green-400 cursor-blink inline-block">_</div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  exit: []
  continue: []
}>()

const contentRef = ref<HTMLElement | null>(null)
const { gsap } = useGsap()

onMounted(() => {
  if (import.meta.client) {
    // Animate entrance
    if (contentRef.value) {
      gsap.from(contentRef.value.children, {
        opacity: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.3,
        ease: 'power2.out'
      })
    }

    // Add keyboard listeners
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeydown)
  }
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('exit')
  } else if (e.key === 'Enter') {
    e.preventDefault()
    emit('continue')
  }
}
</script>

