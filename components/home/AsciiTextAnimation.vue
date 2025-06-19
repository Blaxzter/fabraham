<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { gsap } from "gsap";

// Props
interface Props {
  scrollProgress: number;
}

const props = defineProps<Props>();

// Template refs
const textContainer = ref<HTMLElement>();
const asciiContainer = ref<HTMLElement>();
const firstNameChars = ref<HTMLElement[]>([]);
const lastNameChars = ref<HTMLElement[]>([]);
const titleChars = ref<HTMLElement[]>([]);

// Animation state
const isInitialized = ref(false);
const idleAnimation = ref<gsap.core.Timeline>();

// Target texts
const firstName = "FREDERIC";
const lastName = "ABRAHAM";
const title = "FULLEST STACK DEVELOPER";

// Computer science themed random characters
const randomChars = [
  "0",
  "1",
  "#",
  "$",
  "%",
  "&",
  "*",
  "+",
  "-",
  "=",
  "<",
  ">",
  "?",
  "@",
  "[",
  "]",
  "{",
  "}",
  "|",
  "\\",
  "/",
  "^",
  "~",
  "`",
  ".",
  ",",
  ";",
  ":",
  '"',
  "'",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "x",
  "y",
  "z",
  "λ",
  "π",
  "Σ",
  "Δ",
  "∀",
];

// Generate random character
const getRandomChar = () => {
  return randomChars[Math.floor(Math.random() * randomChars.length)];
};

// Create character elements for a text line
const createTextLine = (
  text: string,
  fontSize: string,
  color: string = "#00ff00"
) => {
  const lineDiv = document.createElement("div");
  lineDiv.className = "flex justify-center items-center mb-4";

  const chars: HTMLElement[] = [];

  for (let i = 0; i < text.length; i++) {
    const span = document.createElement("span");

    // Preserve spaces
    if (text[i] === " ") {
      span.innerHTML = "&nbsp;";
      span.style.pointerEvents = "none"; // Don't interact with spaces
    } else {
      span.textContent = getRandomChar();
      // Store original character for hover effect
      span.setAttribute("data-content", text[i]);
    }

    span.className = "inline-block transition-all duration-100";
    span.style.fontFamily = "Courier New, monospace";
    span.style.fontSize = fontSize;
    span.style.fontWeight = "bold";
    span.style.color = color;
    span.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}`;
    span.style.letterSpacing = "clamp(0.1rem, 1vw, 2rem)";

    lineDiv.appendChild(span);
    chars.push(span);
  }

  return { lineDiv, chars };
};

// Initialize character elements
const initializeCharacters = () => {
  if (!asciiContainer.value) return;

  // Clear existing characters
  asciiContainer.value.innerHTML = "";
  firstNameChars.value = [];
  lastNameChars.value = [];
  titleChars.value = [];

  // Create first name line
  const { lineDiv: firstLineDiv, chars: firstChars } = createTextLine(
    firstName,
    "clamp(2rem, 8vw, 12rem)"
  );
  asciiContainer.value.appendChild(firstLineDiv);
  firstNameChars.value = firstChars;

  // Create last name line
  const { lineDiv: lastLineDiv, chars: lastChars } = createTextLine(
    lastName,
    "clamp(2rem, 8vw, 12rem)"
  );
  asciiContainer.value.appendChild(lastLineDiv);
  lastNameChars.value = lastChars;

  // Create title line with smaller font and different color
  const { lineDiv: titleLineDiv, chars: titleCharsArray } = createTextLine(
    title,
    "clamp(1rem, 4vw, 6rem)",
    "#00aaff"
  );
  titleLineDiv.style.marginTop = "2rem";
  asciiContainer.value.appendChild(titleLineDiv);
  titleChars.value = titleCharsArray;

  isInitialized.value = true;
  startIdleAnimation();
};

// Start idle animation (random character changes)
const startIdleAnimation = () => {
  const allChars = [
    ...firstNameChars.value,
    ...lastNameChars.value,
    ...titleChars.value,
  ];
  if (!allChars.length) return;

  const tl = gsap.timeline({ repeat: -1 });

  allChars.forEach((char) => {
    // Skip spaces in idle animation
    if (char.innerHTML === "&nbsp;") return;

    tl.to(
      char,
      {
        duration: 0.1,
        ease: "none",
        onComplete: () => {
          // Continue idle animation only if character hasn't been fully revealed
          const isRevealed =
            char.textContent === char.getAttribute("data-content");
          if (!isRevealed) {
            char.textContent = getRandomChar();
          }
        },
      },
      Math.random() * 2
    );
  });

  idleAnimation.value = tl;
};

// Stop idle animation
const stopIdleAnimation = () => {
  if (idleAnimation.value) {
    idleAnimation.value.kill();
    idleAnimation.value = undefined;
  }
};

// Animate a text line
const animateTextLine = (
  chars: HTMLElement[],
  targetText: string,
  startProgress: number,
  endProgress: number,
  finalColor: string = "#ffffff"
) => {
  const lineProgress = Math.max(
    0,
    Math.min(
      1,
      (props.scrollProgress - startProgress) / (endProgress - startProgress)
    )
  );

  chars.forEach((char, index) => {
    // Handle spaces
    if (targetText[index] === " ") {
      char.innerHTML = "&nbsp;";
      return;
    }

    const charProgress = Math.max(
      0,
      Math.min(1, (lineProgress - index * 0.02) * 2)
    );

    if (charProgress > 0) {
      // Character is being revealed
      if (charProgress >= 1) {
        // Fully revealed - show target character
        char.textContent = targetText[index];
        char.style.color = finalColor;
        char.style.textShadow = `0 0 5px ${finalColor}, 0 0 10px #00ff00, 0 0 15px #00ff00`;
      } else {
        // Partially revealed - still random but with some glitch effect
        if (Math.random() < charProgress) {
          char.textContent = targetText[index];
        } else {
          char.textContent = getRandomChar();
        }

        // Interpolate color
        const initialColor = char.style.color.includes("170")
          ? [0, 170, 255]
          : [0, 255, 0]; // blue for title, green for names
        const finalColorRGB =
          finalColor === "#ffffff" ? [255, 255, 255] : [0, 170, 255];

        const r = Math.floor(
          initialColor[0] + (finalColorRGB[0] - initialColor[0]) * charProgress
        );
        const g = Math.floor(
          initialColor[1] + (finalColorRGB[1] - initialColor[1]) * charProgress
        );
        const b = Math.floor(
          initialColor[2] + (finalColorRGB[2] - initialColor[2]) * charProgress
        );

        char.style.color = `rgb(${r}, ${g}, ${b})`;
      }

      // Scale effect during assembly
      const scale = 0.8 + charProgress * 0.2;
      char.style.transform = `scale(${scale})`;

      // Glitch effects during assembly
      if (charProgress < 1 && Math.random() < 0.05) {
        gsap.to(char, {
          duration: 0.1,
          x: Math.random() * 4 - 2,
          y: Math.random() * 4 - 2,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(char, { x: 0, y: 0 });
          },
        });
      }
    }
  });

  return lineProgress;
};

// Update animation based on scroll progress
const updateAnimation = () => {
  if (!isInitialized.value || !textContainer.value) return;

  // Keep idle animation running - removed the stopping condition

  // Calculate container position based on scroll progress
  // Text stays centered during animation (0-70%), then gets pushed up
  let yTransform = 0;
  if (props.scrollProgress > 0.7) {
    // After animation completes, push text up and out of view
    const pushProgress = (props.scrollProgress - 0.7) / 0.3; // 70-100% range
    yTransform = -100 * pushProgress; // Push up by 100vh
  }

  // Apply transform to container
  textContainer.value.style.transform = `translateY(${yTransform}vh)`;

  // First name animates from 0% to 25%
  const firstNameProgress = animateTextLine(
    firstNameChars.value,
    firstName,
    0,
    0.25
  );

  // Last name animates from 20% to 45% (slight overlap)
  const lastNameProgress = animateTextLine(
    lastNameChars.value,
    lastName,
    0.2,
    0.45
  );

  // Title animates from 40% to 70% (different color)
  const titleProgress = animateTextLine(
    titleChars.value,
    title,
    0.4,
    0.7,
    "#00aaff"
  );

  // Breathing effect when all are assembled (but not being pushed out)
  if (
    firstNameProgress >= 1 &&
    lastNameProgress >= 1 &&
    titleProgress >= 1 &&
    props.scrollProgress <= 0.7
  ) {
    const breathe = Math.sin(Date.now() * 0.003) * 0.02 + 1;
    [
      ...firstNameChars.value,
      ...lastNameChars.value,
      ...titleChars.value,
    ].forEach((char) => {
      char.style.transform = `scale(${breathe})`;
    });
  }
};

// Watch scroll progress
watch(() => props.scrollProgress, updateAnimation);

onMounted(() => {
  if (import.meta.client) {
    initializeCharacters();
  }
});

onUnmounted(() => {
  stopIdleAnimation();
});
</script>

<template>
  <div
    ref="textContainer"
    class="fixed inset-0 flex items-center justify-center pointer-events-none z-20 transition-transform duration-100 ease-out"
  >
    <div
      ref="asciiContainer"
      class="text-center leading-none select-none"
      style="font-family: 'Courier New', monospace"
    />
  </div>
</template>

<style scoped>
/* Additional glitch effects */
@keyframes glitch {
  0% {
    transform: translate(0);
  }
  20% {
    transform: translate(-1px, 1px);
  }
  40% {
    transform: translate(-1px, -1px);
  }
  60% {
    transform: translate(1px, 1px);
  }
  80% {
    transform: translate(1px, -1px);
  }
  100% {
    transform: translate(0);
  }
}

.glitch {
  animation: glitch 0.3s infinite;
}
</style>
