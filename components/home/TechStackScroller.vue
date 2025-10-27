<script setup lang="ts">
import TechCard from "./TechCard.vue";

interface TechItem {
  icon: string;
  title: string;
  proficiency: number;
  description: string;
}

interface Props {
  title?: string;
  techStack?: TechItem[];
  angle?: number; // Angle of descent in degrees (positive = down, negative = up)
  duration?: number; // Animation duration (deprecated - kept for compatibility)
  stagger?: number; // Stagger between cards (deprecated - kept for compatibility)
  scrubSmoothing?: number; // Smoothness of scroll animation (0.5 = snappy, 3 = very smooth)
  staggerSpacing?: number; // Spacing between card animations in viewport % (10 = close, 20 = far)
}

const props = withDefaults(defineProps<Props>(), {
  title: "Tech Stack",
  angle: 5, // Default 5 degrees downward
  duration: 1.2,
  stagger: 0.15,
  scrubSmoothing: 1.5,
  staggerSpacing: 15,
  techStack: () => [
    {
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg",
      title: "Vue.js",
      proficiency: 90,
      description: "Building reactive UIs with Composition API",
    },
    {
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nuxtjs/nuxtjs-original.svg",
      title: "Nuxt 3",
      proficiency: 85,
      description: "Full-stack framework for modern web apps",
    },
    {
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
      title: "TypeScript",
      proficiency: 88,
      description: "Type-safe JavaScript development",
    },
    {
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
      title: "Node.js",
      proficiency: 82,
      description: "Server-side JavaScript runtime",
    },
    {
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      title: "Python",
      proficiency: 80,
      description: "Backend development and data processing",
    },
    {
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
      title: "PostgreSQL",
      proficiency: 75,
      description: "Advanced relational database management",
    },
  ],
});

const containerRef = ref<HTMLElement | null>(null);
const titleRef = ref<HTMLElement | null>(null);
const cardsRef = ref<HTMLElement[]>([]);

const { gsap, ScrollTrigger } = useGsap();

onMounted(async () => {
  if (!import.meta.client || !containerRef.value) return;

  // Wait for next tick to ensure DOM is fully rendered
  await nextTick();

  // Calculate the Y offset based on angle
  // For a card moving from left to right, we want it to move down (or up) based on the angle
  const yOffset = Math.tan((props.angle * Math.PI) / 180) * window.innerWidth;

  // Animate title linked to scroll
  if (titleRef.value) {
    gsap.from(titleRef.value, {
      x: -200,
      y: -500,
      opacity: 0,
      rotation: -10,
      ease: "none",
      scrollTrigger: {
        trigger: containerRef.value,
        start: "top bottom", // Start when top of element hits bottom of viewport
        end: "top center", // End when top of element hits center of viewport
        scrub: props.scrubSmoothing * 0.7, // Title animates slightly faster
        // markers: true, // Uncomment for debugging
      },
    });
  }

  // Filter out any null refs and animate cards
  const validCards = cardsRef.value.filter(
    (card) => card !== null && card !== undefined
  );

  console.log(`TechStackScroller: Animating ${validCards.length} cards`);

  validCards.forEach((card, index) => {
    // Calculate stagger offset for start position
    const staggerOffset = index * props.staggerSpacing; // Percentage of viewport height per card

    gsap.from(card, {
      x: -window.innerWidth - 300, // Start from off-screen left
      y: -yOffset, // Start from higher/lower based on angle
      rotation: props.angle * -1, // Slight rotation for effect
      ease: "power2.out",
      opacity: 0,
      scrollTrigger: {
        trigger: containerRef.value,
        start: `top ${80 - staggerOffset}%`, // Stagger the start of each card
        end: `top ${20 - staggerOffset}%`, // Stagger the end of each card
        scrub: props.scrubSmoothing, // Smooth scrubbing linked to scroll position
        // markers: true, // Uncomment for debugging
      },
    });
  });
});

// Cleanup on unmount
onUnmounted(() => {
  if (import.meta.client) {
    ScrollTrigger.getAll().forEach((trigger) => {
      if (
        trigger.vars.trigger === containerRef.value ||
        trigger.vars.trigger === titleRef.value
      ) {
        trigger.kill();
      }
    });
  }
});

const setCardRef = (el: any, index: number) => {
  if (el) {
    cardsRef.value[index] = el;
  }
};
</script>

<template>
  <div ref="containerRef" class="tech-stack-scroller py-20">
    <!-- Title with tilt -->
    <div class="mb-16 flex justify-center">
      <h2
        ref="titleRef"
        class="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 transform -rotate-2 relative inline-block"
        :style="{ transform: `rotate(${-props.angle}deg)` }"
      >
        {{ title }}
        <!-- Underline accent -->
        <div
          class="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
        ></div>
      </h2>
    </div>

    <!-- Cards Container -->
    <div class="relative">
      <!-- Horizontal scroll wrapper -->
      <div
        class="flex gap-8 items-start px-8 md:px-16 lg:px-24 flex-wrap justify-center"
        :style="{ transform: `rotate(${-props.angle}deg)` }"
      >
        <div
          v-for="(tech, index) in techStack"
          :key="tech.title"
          :ref="(el) => setCardRef(el, index)"
          class="tech-card-item"
        >
          <TechCard
            :icon="tech.icon"
            :title="tech.title"
            :proficiency="tech.proficiency"
            :description="tech.description"
            :delay="stagger * index"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tech-stack-scroller {
  position: relative;
  min-height: 60vh;
}
</style>
