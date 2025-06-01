// composables/useGsap.ts
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextPlugin } from "gsap/TextPlugin";

let initialized = false;

export const useGsap = () => {
  if (!initialized && import.meta.client) {
    gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger, TextPlugin, CustomEase);
    initialized = true;
  }

  return {
    gsap,
    ScrollTrigger,
    CustomEase,
  };
};
