<template>
  <div class="space-y-4 font-mono text-sm">
    <!-- Header -->
    <div class="border-2 border-red-500 p-4 bg-red-900/20">
      <div class="flex items-center justify-between">
        <BootText :text="t('shell.egg.header')" color="red" bold />
        <BootText text="[DEL]" color="yellow" />
      </div>
    </div>

    <!-- Warning Message -->
    <div class="space-y-2 p-4 border border-yellow-400 bg-yellow-900/10">
      <BootText :text="t('shell.egg.warning')" color="yellow" bold />
      <BootText :text="t('shell.egg.warningSub')" color="white" />
    </div>

    <!-- System Info Grid -->
    <div ref="contentRef" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <!-- Left Column - System Stats -->
      <div class="space-y-2 p-4 border border-green-400 bg-green-900/10">
        <BootText :text="t('shell.egg.diagnostics')" color="green" bold />
        <div class="mt-3 space-y-1 text-xs">
          <div v-for="line in list('shell.egg.stats')" :key="line"><BootText :text="line" color="white" /></div>
        </div>
      </div>

      <!-- Right Column - ASCII Art -->
      <div class="space-y-2 p-4 border border-cyan-400 bg-cyan-900/10">
        <BootText :text="t('shell.egg.profile')" color="cyan" bold />
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
        <BootText :text="t('shell.egg.stack')" color="cyan" bold />
        <div class="mt-3 space-y-1 text-xs">
          <div><BootText text="✓ Vue.js 3.5.15" color="green" /></div>
          <div><BootText text="✓ Nuxt.js 3.17.4" color="green" /></div>
          <div><BootText text="✓ Three.js 0.177.0" color="green" /></div>
          <div><BootText text="✓ GSAP 3.13.0" color="green" /></div>
          <div><BootText text="✓ TresJS 4.3.5" color="green" /></div>
          <div><BootText :text="t('shell.egg.caffeine')" color="yellow" /></div>
        </div>
      </div>

      <!-- Bottom Right - Fun Facts -->
      <div class="space-y-2 p-4 border border-yellow-400 bg-yellow-900/10">
        <BootText :text="t('shell.egg.facts')" color="yellow" bold />
        <div class="mt-3 space-y-1 text-xs">
          <div v-for="line in list('shell.egg.factList')" :key="line"><BootText :text="line" color="white" /></div>
        </div>
      </div>
    </div>

    <!-- Footer with Options -->
    <div class="mt-6 pt-4 border-t border-gray-700 text-center space-y-2">
      <BootText :text="t('shell.egg.esc')" color="yellow" />
      <BootText :text="t('shell.egg.enter')" color="yellow" />
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

const { t, tm, rt } = useI18n()
// A message array, resolved in the current locale.
const list = (key: string) => (tm(key) as unknown[]).map((m) => rt(m as Parameters<typeof rt>[0]))

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

