<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold mb-2 text-cyan-400">GSAP Animation Playground</h1>
        <p class="text-gray-400">Test and experiment with different GSAP animations</p>
        <NuxtLink to="/" class="text-cyan-400 hover:underline text-sm mt-2 inline-block">
          ← Back to Home
        </NuxtLink>
      </div>

      <!-- Animation Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Fade In/Out -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Fade In/Out</h3>
          <div ref="fadeBox" class="w-full h-32 bg-cyan-600 rounded flex items-center justify-center mb-4">
            Fade Box
          </div>
          <div class="flex gap-2">
            <button @click="animateFadeIn" class="btn-primary">Fade In</button>
            <button @click="animateFadeOut" class="btn-secondary">Fade Out</button>
          </div>
        </div>

        <!-- Slide -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Slide X/Y</h3>
          <div ref="slideBox" class="w-full h-32 bg-purple-600 rounded flex items-center justify-center mb-4">
            Slide Box
          </div>
          <div class="flex gap-2 flex-wrap">
            <button @click="animateSlideLeft" class="btn-primary">← Left</button>
            <button @click="animateSlideRight" class="btn-primary">Right →</button>
            <button @click="animateSlideUp" class="btn-secondary">↑ Up</button>
            <button @click="animateSlideDown" class="btn-secondary">Down ↓</button>
          </div>
        </div>

        <!-- Scale -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Scale</h3>
          <div ref="scaleBox" class="w-full h-32 bg-yellow-600 rounded flex items-center justify-center mb-4">
            Scale Box
          </div>
          <div class="flex gap-2">
            <button @click="animateScaleUp" class="btn-primary">Scale Up</button>
            <button @click="animateScaleDown" class="btn-secondary">Scale Down</button>
            <button @click="animatePulse" class="btn-accent">Pulse</button>
          </div>
        </div>

        <!-- Rotate -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Rotate</h3>
          <div ref="rotateBox" class="w-full h-32 bg-red-600 rounded flex items-center justify-center mb-4">
            Rotate Box
          </div>
          <div class="flex gap-2">
            <button @click="animateRotate360" class="btn-primary">Rotate 360°</button>
            <button @click="animateFlip" class="btn-secondary">Flip</button>
          </div>
        </div>

        <!-- Bounce -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Bounce</h3>
          <div ref="bounceBox" class="w-full h-32 bg-green-600 rounded flex items-center justify-center mb-4">
            Bounce Box
          </div>
          <div class="flex gap-2">
            <button @click="animateBounce" class="btn-primary">Bounce</button>
            <button @click="animateElastic" class="btn-secondary">Elastic</button>
          </div>
        </div>

        <!-- Text Animation -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Text Effects</h3>
          <div class="w-full h-32 rounded flex items-center justify-center mb-4">
            <p ref="textBox" class="text-2xl font-bold text-cyan-400">Animate Me!</p>
          </div>
          <div class="flex gap-2">
            <button @click="animateTextSplit" class="btn-primary">Split</button>
            <button @click="animateTextBlur" class="btn-secondary">Blur</button>
          </div>
        </div>

        <!-- Stagger -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700 lg:col-span-2">
          <h3 class="text-lg font-bold mb-4 text-green-400">Stagger Animation</h3>
          <div class="flex gap-2 mb-4 flex-wrap">
            <div v-for="n in 8" :key="n" ref="staggerBoxes" class="w-16 h-16 bg-pink-600 rounded flex items-center justify-center">
              {{ n }}
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="animateStagger" class="btn-primary">Stagger In</button>
            <button @click="animateStaggerOut" class="btn-secondary">Stagger Out</button>
            <button @click="animateWave" class="btn-accent">Wave</button>
          </div>
        </div>

        <!-- Timeline -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Timeline</h3>
          <div class="space-y-2 mb-4">
            <div ref="timelineBox1" class="w-full h-8 bg-blue-600 rounded flex items-center px-3">Step 1</div>
            <div ref="timelineBox2" class="w-full h-8 bg-blue-500 rounded flex items-center px-3">Step 2</div>
            <div ref="timelineBox3" class="w-full h-8 bg-blue-400 rounded flex items-center px-3">Step 3</div>
          </div>
          <div class="flex gap-2">
            <button @click="animateTimeline" class="btn-primary">Play Timeline</button>
            <button @click="resetTimeline" class="btn-secondary">Reset</button>
          </div>
        </div>

        <!-- Morph -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Morph</h3>
          <div ref="morphBox" class="w-32 h-32 bg-orange-600 mx-auto mb-4 flex items-center justify-center">
            Morph
          </div>
          <div class="flex gap-2 justify-center">
            <button @click="animateMorphCircle" class="btn-primary">Circle</button>
            <button @click="animateMorphSquare" class="btn-secondary">Square</button>
          </div>
        </div>

        <!-- Path Drawing -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 class="text-lg font-bold mb-4 text-green-400">Path Drawing</h3>
          <svg ref="svgPath" class="w-full h-32 mb-4" viewBox="0 0 200 100">
            <path 
              ref="pathElement"
              d="M 10 50 Q 50 10, 90 50 T 170 50" 
              stroke="#22d3ee" 
              stroke-width="3" 
              fill="none"
              stroke-dasharray="1000"
              stroke-dashoffset="1000"
            />
          </svg>
          <div class="flex gap-2">
            <button @click="animatePathDraw" class="btn-primary">Draw Path</button>
            <button @click="resetPath" class="btn-secondary">Reset</button>
          </div>
        </div>

        <!-- BootText Typewriter -->
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700 lg:col-span-3">
          <h3 class="text-lg font-bold mb-4 text-green-400">BootText Typewriter Effect</h3>
          <div class="bg-black p-6 rounded font-mono text-sm mb-4 min-h-[120px]">
            <div v-if="showTypewriter1" class="mb-2">
              <BootText text="Testing typewriter effect..." color="green" animate />
            </div>
            <div v-if="showTypewriter2" class="mb-2">
              <BootText text="This should appear character by character" color="cyan" animate />
            </div>
            <div v-if="showTypewriter3" class="mb-2">
              <BootText text="Speed can be adjusted with the speed prop" color="yellow" :speed="50" animate />
            </div>
            <div v-if="showTypewriter4">
              <BootText text="Fast typing mode! 🚀" color="white" :speed="200" animate />
            </div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button @click="startTypewriterTest" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors">
              Start Typewriter Test
            </button>
            <button @click="resetTypewriter" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors">
              Reset
            </button>
            <button @click="showAllTypewriter" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm transition-colors">
              Show All Lines
            </button>
          </div>
          <div class="mt-4 p-3 bg-gray-900 rounded text-xs text-gray-300">
            <p><strong>How it works:</strong></p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li>Uses setInterval to reveal characters one by one</li>
              <li>Default speed: 100 characters/second</li>
              <li>Customize with <code class="text-cyan-400">:speed</code> prop</li>
              <li>No GSAP - pure JavaScript interval</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Reset All Button -->
      <div class="mt-8 text-center">
        <button @click="resetAll" class="btn-large bg-red-600 hover:bg-red-700">
          Reset All Animations
        </button>
      </div>

      <!-- Code Example Section -->
      <div class="mt-12 bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 class="text-xl font-bold mb-4 text-cyan-400">Last Animation Code</h3>
        <pre class="bg-black p-4 rounded overflow-x-auto text-sm text-green-400"><code>{{ lastCode }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { gsap } = useGsap()

// Refs for all boxes
const fadeBox = ref<HTMLElement | null>(null)
const slideBox = ref<HTMLElement | null>(null)
const scaleBox = ref<HTMLElement | null>(null)
const rotateBox = ref<HTMLElement | null>(null)
const bounceBox = ref<HTMLElement | null>(null)
const textBox = ref<HTMLElement | null>(null)
const staggerBoxes = ref<HTMLElement[]>([])
const timelineBox1 = ref<HTMLElement | null>(null)
const timelineBox2 = ref<HTMLElement | null>(null)
const timelineBox3 = ref<HTMLElement | null>(null)
const morphBox = ref<HTMLElement | null>(null)
const svgPath = ref<HTMLElement | null>(null)
const pathElement = ref<SVGPathElement | null>(null)

// Typewriter test state
const showTypewriter1 = ref(false)
const showTypewriter2 = ref(false)
const showTypewriter3 = ref(false)
const showTypewriter4 = ref(false)

const lastCode = ref('// Click a button to see the animation code')

// Animation functions
const animateFadeIn = () => {
  lastCode.value = `gsap.to(element, {
  opacity: 1,
  duration: 1,
  ease: 'power2.inOut'
})`
  gsap.to(fadeBox.value, { opacity: 1, duration: 1, ease: 'power2.inOut' })
}

const animateFadeOut = () => {
  lastCode.value = `gsap.to(element, {
  opacity: 0,
  duration: 1,
  ease: 'power2.inOut'
})`
  gsap.to(fadeBox.value, { opacity: 0, duration: 1, ease: 'power2.inOut' })
}

const animateSlideLeft = () => {
  lastCode.value = `gsap.to(element, {
  x: -100,
  duration: 0.5,
  ease: 'power2.out'
})`
  gsap.to(slideBox.value, { x: -100, duration: 0.5, ease: 'power2.out' })
}

const animateSlideRight = () => {
  lastCode.value = `gsap.to(element, {
  x: 100,
  duration: 0.5,
  ease: 'power2.out'
})`
  gsap.to(slideBox.value, { x: 100, duration: 0.5, ease: 'power2.out' })
}

const animateSlideUp = () => {
  lastCode.value = `gsap.to(element, {
  y: -50,
  duration: 0.5,
  ease: 'back.out(1.7)'
})`
  gsap.to(slideBox.value, { y: -50, duration: 0.5, ease: 'back.out(1.7)' })
}

const animateSlideDown = () => {
  lastCode.value = `gsap.to(element, {
  y: 50,
  duration: 0.5,
  ease: 'back.out(1.7)'
})`
  gsap.to(slideBox.value, { y: 50, duration: 0.5, ease: 'back.out(1.7)' })
}

const animateScaleUp = () => {
  lastCode.value = `gsap.to(element, {
  scale: 1.5,
  duration: 0.5,
  ease: 'back.out(1.7)'
})`
  gsap.to(scaleBox.value, { scale: 1.5, duration: 0.5, ease: 'back.out(1.7)' })
}

const animateScaleDown = () => {
  lastCode.value = `gsap.to(element, {
  scale: 0.5,
  duration: 0.5,
  ease: 'power2.inOut'
})`
  gsap.to(scaleBox.value, { scale: 0.5, duration: 0.5, ease: 'power2.inOut' })
}

const animatePulse = () => {
  lastCode.value = `gsap.to(element, {
  scale: 1.2,
  duration: 0.3,
  yoyo: true,
  repeat: 3,
  ease: 'power1.inOut'
})`
  gsap.to(scaleBox.value, { scale: 1.2, duration: 0.3, yoyo: true, repeat: 3, ease: 'power1.inOut' })
}

const animateRotate360 = () => {
  lastCode.value = `gsap.to(element, {
  rotation: 360,
  duration: 1,
  ease: 'power2.inOut'
})`
  gsap.to(rotateBox.value, { rotation: 360, duration: 1, ease: 'power2.inOut' })
}

const animateFlip = () => {
  lastCode.value = `gsap.to(element, {
  rotationY: 180,
  duration: 0.6,
  ease: 'back.out(1.7)'
})`
  gsap.to(rotateBox.value, { rotationY: 180, duration: 0.6, ease: 'back.out(1.7)' })
}

const animateBounce = () => {
  lastCode.value = `gsap.to(element, {
  y: -50,
  duration: 0.5,
  ease: 'bounce.out'
})`
  gsap.to(bounceBox.value, { y: -50, duration: 0.5, ease: 'bounce.out' })
}

const animateElastic = () => {
  lastCode.value = `gsap.to(element, {
  scale: 1.5,
  duration: 1,
  ease: 'elastic.out(1, 0.3)'
})`
  gsap.to(bounceBox.value, { scale: 1.5, duration: 1, ease: 'elastic.out(1, 0.3)' })
}

const animateTextSplit = () => {
  lastCode.value = `gsap.fromTo(element, 
  { opacity: 0, y: 20 },
  { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)' }
)`
  gsap.fromTo(textBox.value, 
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)' }
  )
}

const animateTextBlur = () => {
  lastCode.value = `gsap.to(element, {
  filter: 'blur(10px)',
  duration: 0.5,
  yoyo: true,
  repeat: 1
})`
  gsap.to(textBox.value, { filter: 'blur(10px)', duration: 0.5, yoyo: true, repeat: 1 })
}

const animateStagger = () => {
  lastCode.value = `gsap.from(elements, {
  opacity: 0,
  y: 30,
  scale: 0.5,
  stagger: 0.1,
  duration: 0.5,
  ease: 'back.out(1.7)'
})`
  gsap.from(staggerBoxes.value, {
    opacity: 0,
    y: 30,
    scale: 0.5,
    stagger: 0.1,
    duration: 0.5,
    ease: 'back.out(1.7)'
  })
}

const animateStaggerOut = () => {
  lastCode.value = `gsap.to(elements, {
  opacity: 0,
  y: -30,
  stagger: 0.1,
  duration: 0.3
})`
  gsap.to(staggerBoxes.value, {
    opacity: 0,
    y: -30,
    stagger: 0.1,
    duration: 0.3
  })
}

const animateWave = () => {
  lastCode.value = `gsap.to(elements, {
  y: -20,
  duration: 0.3,
  stagger: {
    each: 0.1,
    yoyo: true,
    repeat: 1
  },
  ease: 'power1.inOut'
})`
  gsap.to(staggerBoxes.value, {
    y: -20,
    duration: 0.3,
    stagger: {
      each: 0.1,
      yoyo: true,
      repeat: 1
    },
    ease: 'power1.inOut'
  })
}

const animateTimeline = () => {
  lastCode.value = `const tl = gsap.timeline()
tl.from(box1, { x: -100, opacity: 0, duration: 0.5 })
  .from(box2, { x: 100, opacity: 0, duration: 0.5 })
  .from(box3, { scale: 0, opacity: 0, duration: 0.5 })
  .to([box1, box2, box3], { 
    backgroundColor: '#10b981', 
    duration: 0.3 
  })`
  
  const tl = gsap.timeline()
  tl.from(timelineBox1.value, { x: -100, opacity: 0, duration: 0.5 })
    .from(timelineBox2.value, { x: 100, opacity: 0, duration: 0.5 })
    .from(timelineBox3.value, { scale: 0, opacity: 0, duration: 0.5 })
    .to([timelineBox1.value, timelineBox2.value, timelineBox3.value], { 
      backgroundColor: '#10b981', 
      duration: 0.3 
    })
}

const resetTimeline = () => {
  gsap.set([timelineBox1.value, timelineBox2.value, timelineBox3.value], {
    x: 0,
    scale: 1,
    opacity: 1,
    backgroundColor: ''
  })
}

const animateMorphCircle = () => {
  lastCode.value = `gsap.to(element, {
  borderRadius: '50%',
  duration: 0.5,
  ease: 'power2.inOut'
})`
  gsap.to(morphBox.value, { borderRadius: '50%', duration: 0.5, ease: 'power2.inOut' })
}

const animateMorphSquare = () => {
  lastCode.value = `gsap.to(element, {
  borderRadius: '0%',
  duration: 0.5,
  ease: 'power2.inOut'
})`
  gsap.to(morphBox.value, { borderRadius: '0%', duration: 0.5, ease: 'power2.inOut' })
}

const animatePathDraw = () => {
  lastCode.value = `gsap.to(pathElement, {
  strokeDashoffset: 0,
  duration: 2,
  ease: 'power1.inOut'
})`
  gsap.to(pathElement.value, {
    strokeDashoffset: 0,
    duration: 2,
    ease: 'power1.inOut'
  })
}

const resetPath = () => {
  gsap.set(pathElement.value, { strokeDashoffset: 1000 })
}

// Typewriter test functions
const startTypewriterTest = () => {
  lastCode.value = `// BootText component with typewriter effect
<BootText text="Hello World" color="green" />
<BootText text="Fast typing" :speed="200" />

// Component uses setInterval internally:
const chars = text.split('')
const msPerChar = 1000 / speed // default speed: 100
setInterval(() => {
  displayedText += chars[currentIndex++]
}, msPerChar)`

  resetTypewriter()
  
  // Stagger the appearance of lines
  setTimeout(() => { showTypewriter1.value = true }, 100)
  setTimeout(() => { showTypewriter2.value = true }, 1500)
  setTimeout(() => { showTypewriter3.value = true }, 3500)
  setTimeout(() => { showTypewriter4.value = true }, 6500)
}

const resetTypewriter = () => {
  showTypewriter1.value = false
  showTypewriter2.value = false
  showTypewriter3.value = false
  showTypewriter4.value = false
}

const showAllTypewriter = () => {
  showTypewriter1.value = true
  showTypewriter2.value = true
  showTypewriter3.value = true
  showTypewriter4.value = true
}

const resetAll = () => {
  gsap.set([
    fadeBox.value,
    slideBox.value,
    scaleBox.value,
    rotateBox.value,
    bounceBox.value,
    textBox.value,
    morphBox.value,
    ...staggerBoxes.value
  ], {
    clearProps: 'all'
  })
  resetTimeline()
  resetPath()
  resetTypewriter()
  lastCode.value = '// All animations reset!'
}

useSeoMeta({
  title: 'GSAP Animation Playground',
  description: 'Test and experiment with different GSAP animations'
})
</script>

