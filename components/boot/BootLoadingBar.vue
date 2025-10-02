<template>
  <div class="space-y-2">
    <BootText :text="message" color="green" />
    <div class="flex items-center gap-2">
      <div class="flex-1 border border-green-400 h-4 relative overflow-hidden">
        <div
          ref="progressBarRef"
          class="absolute inset-y-0 left-0 bg-green-400"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <BootText :text="`${Math.round(progress)}%`" color="green" bold />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message?: string
}>()

const progressBarRef = ref<HTMLElement | null>(null)
const progress = ref(0)

const { gsap } = useGsap()

onMounted(() => {
  if (import.meta.client) {
    gsap.to(progress, {
      value: 100,
      duration: 2,
      ease: 'power2.inOut'
    })
  }
})
</script>

