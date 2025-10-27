<script setup lang="ts">
interface Props {
  icon: string; // URL or component name for the tech logo
  title: string;
  proficiency: number; // 0-100
  description: string;
  delay?: number; // Animation delay
}

const props = withDefaults(defineProps<Props>(), {
  delay: 0,
});

// Format proficiency as percentage
const proficiencyPercent = computed(() => `${props.proficiency}%`);

// Get color based on proficiency level
const proficiencyColor = computed(() => {
  if (props.proficiency >= 80) return "from-green-500 to-emerald-600";
  if (props.proficiency >= 60) return "from-blue-500 to-cyan-600";
  if (props.proficiency >= 40) return "from-yellow-500 to-orange-600";
  return "from-red-500 to-pink-600";
});
</script>

<template>
  <div
    class="tech-card group relative bg-gradient-to-br from-gray-900/90 to-black/95 backdrop-blur-md border border-white/10 rounded-xl p-6 hover:border-white/30 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 min-w-[280px] max-w-[300px]"
  >
    <!-- Glow effect on hover -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-cyan-500/0 group-hover:from-purple-500/10 group-hover:to-cyan-500/10 rounded-xl transition-all duration-300 pointer-events-none"
    ></div>

    <!-- Content -->
    <div class="relative z-10">
      <!-- Icon Section -->
      <div class="flex items-center justify-center mb-4 h-24">
        <img
          :src="icon"
          :alt="`${title} logo`"
          class="w-20 h-20 object-contain filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
        />
      </div>

      <!-- Title -->
      <h3
        class="text-xl font-bold text-white mb-3 text-center group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-cyan-400 transition-all duration-300"
      >
        {{ title }}
      </h3>

      <!-- Proficiency Bar -->
      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-gray-400">Proficiency</span>
          <span class="text-sm font-semibold text-white">{{
            proficiencyPercent
          }}</span>
        </div>
        <div class="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            :style="{ width: proficiencyPercent }"
            :class="`h-full bg-gradient-to-r ${proficiencyColor} rounded-full transition-all duration-500 shadow-lg`"
          ></div>
        </div>
      </div>

      <!-- Description -->
      <p class="text-sm text-gray-400 leading-relaxed text-center">
        {{ description }}
      </p>
    </div>

    <!-- Corner accent -->
    <div
      class="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
    ></div>
  </div>
</template>

<style scoped>
.tech-card {
  /* Add a subtle 3D transform on hover */
  transform-style: preserve-3d;
}

.tech-card:hover {
  transform: translateY(-8px) rotateX(2deg);
}
</style>
