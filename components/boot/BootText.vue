<template>
  <span :class="textClass">{{ displayedText }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{
  text: string
  color?: 'green' | 'white' | 'cyan' | 'yellow' | 'red'
  bold?: boolean
  animate?: boolean // Allow disabling animation if needed
  speed?: number // Characters per second (default: 100)
}>()

const displayedText = ref('')
const typewriterSpeed = props.speed || 100 // characters per second
let interval: ReturnType<typeof setInterval> | null = null

const textClass = computed(() => {
  const classes: string[] = []
  
  switch (props.color) {
    case 'green':
      classes.push('text-green-400')
      break
    case 'cyan':
      classes.push('text-cyan-400')
      break
    case 'yellow':
      classes.push('text-yellow-400')
      break
    case 'red':
      classes.push('text-red-400')
      break
    default:
      classes.push('text-white')
  }
  
  if (props.bold) {
    classes.push('font-bold')
  }
  
  return classes.join(' ')
})

onMounted(() => {
  if (import.meta.client && props.animate !== false) {
    // Typewriter effect - reveal text character by character
    const chars = props.text.split('')
    const msPerChar = 1000 / typewriterSpeed
    
    console.log('Starting typewriter:', props.text, 'speed:', typewriterSpeed, 'msPerChar:', msPerChar)
    
    let currentIndex = 0
    interval = setInterval(() => {
      if (currentIndex < chars.length) {
        displayedText.value += chars[currentIndex]
        currentIndex++
      } else {
        if (interval) {
          clearInterval(interval)
          interval = null
        }
      }
    }, msPerChar)
  } else {
    // No animation - show full text immediately
    displayedText.value = props.text
  }
})

onUnmounted(() => {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
})
</script>

