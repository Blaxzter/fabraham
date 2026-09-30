<template>
  <!-- Fills the tube it is drawn in, not the viewport (the boot screen is a
       monitor now, see BootScreen). -->
  <div class="font-mono flex items-center justify-center min-h-full py-4">
    <div class="w-full max-w-6xl px-4 space-y-8">
      <!-- Menu Header -->
      <div class="text-center">
        <div class="inline-block border-2 border-cyan-400 px-8 py-4 mb-2">
          <BootText :text="t('shell.menu.title')" color="cyan" bold />
        </div>
        <div class="text-xs mt-4">
          <BootText :text="t('shell.menu.subtitle')" color="white" />
        </div>
      </div>

      <!-- Menu Options - Responsive Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-12">
        <div
          v-for="(option, index) in menuOptions"
          :key="option.id"
          ref="optionRefs"
          class="relative group cursor-pointer transition-all duration-300 opacity-0"
          :class="{ 
            'scale-105': selectedIndex === index,
          }"
          @click="selectOption(index)"
          @mouseenter="selectedIndex = index"
        >
          <!-- Card Border with Glow Effect -->
          <div 
            class="border-2 transition-all duration-300 p-6 md:p-8 h-full flex flex-col items-center justify-center text-center relative"
            :class="[
              selectedIndex === index 
                ? 'border-cyan-400 bg-cyan-900/20 shadow-lg shadow-cyan-500/50' 
                : 'border-gray-600 bg-gray-900/50 hover:border-cyan-600'
            ]"
          >
            <!-- Selection Indicator -->
            <div 
              v-if="selectedIndex === index" 
              class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-black px-3 py-1 border border-cyan-400 whitespace-nowrap"
            >
              <BootText :text="t('shell.menu.selected')" color="cyan" bold />
            </div>

            <!-- Icon/Number -->
            <div 
              class="text-4xl md:text-5xl font-bold mb-4 transition-colors"
              :class="selectedIndex === index ? 'text-cyan-400' : 'text-gray-500'"
            >
              {{ index + 1 }}
            </div>

            <!-- Title -->
            <div class="text-base md:text-lg mb-2">
              <BootText 
                :text="option.title" 
                :color="selectedIndex === index ? 'cyan' : 'white'" 
                bold 
              />
            </div>

            <!-- Description -->
            <div class="text-xs text-gray-400 mt-2">
              <BootText 
                :text="option.description" 
                :color="selectedIndex === index ? 'white' : 'white'" 
              />
            </div>

            <!-- Keyboard Shortcut Hint -->
            <div class="absolute bottom-2 right-2 text-xs opacity-50">
              <BootText :text="`[${index + 1}]`" color="yellow" />
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="text-center mt-8 pt-6 border-t border-gray-700 text-xs space-y-1">
        <div class="hidden md:block">
          <BootText :text="t('shell.menu.instructions')" color="yellow" />
        </div>
        <div class="md:hidden space-y-1">
          <div><BootText :text="t('shell.menu.instructionsTouch1')" color="yellow" /></div>
          <div><BootText :text="t('shell.menu.instructionsTouch2')" color="yellow" /></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  select: [route: string]
}>()

const selectedIndex = ref(0)
const optionRefs = ref<HTMLElement[]>([])

const { t } = useI18n()

// `route` is the unprefixed path; BootScreen localizes it when it navigates.
const menuOptions = computed(() =>
  (['home', 'projects', 'setup'] as const).map((id) => ({
    id,
    title: t(`shell.menu.${id}.title`),
    description: t(`shell.menu.${id}.description`),
    route: id === 'home' ? '/' : `/${id}`,
  }))
)

const { gsap } = useGsap()

const selectOption = (index: number) => {
  selectedIndex.value = index
  bootToOption()
}

const bootToOption = () => {
  const selected = menuOptions.value[selectedIndex.value]
  if (!selected) return
  emit('select', selected.route)
}

// Keyboard navigation
onMounted(() => {
  if (import.meta.client) {
    // Ensure first item is selected
    selectedIndex.value = 0
    
    // Animate menu entrance with staggered cards
    gsap.to(optionRefs.value, {
      opacity: 1,
      y: 0,
      scale: 1,
      stagger: 0.15,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        // Add a subtle pulse to the selected item after animation completes
        if (optionRefs.value[0]) {
          gsap.to(optionRefs.value[0], {
            scale: 1.05,
            duration: 0.3,
            ease: 'power2.inOut'
          })
        }
      }
    })

    window.addEventListener('keydown', handleKeydown, true)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeydown, true)
  }
})

const handleKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault()
      e.stopPropagation()
      selectedIndex.value = Math.max(0, selectedIndex.value - 1)
      break
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault()
      e.stopPropagation()
      selectedIndex.value = Math.min(menuOptions.value.length - 1, selectedIndex.value + 1)
      break
    case 'Enter':
      e.preventDefault()
      e.stopPropagation()
      bootToOption()
      break
    case '1':
      e.preventDefault()
      e.stopPropagation()
      selectOption(0)
      break
    case '2':
      e.preventDefault()
      e.stopPropagation()
      selectOption(1)
      break
    case '3':
      e.preventDefault()
      e.stopPropagation()
      selectOption(2)
      break
  }
}
</script>

