import { markRaw } from "vue";
import type { Component } from "vue";
import type { Section } from "~/types/section";
import HeroSection from "./HeroSection.vue";
import InterludeSection from "./InterludeSection.vue";
import BiographySection from "./BiographySection.vue";
import SkillsSection from "./SkillsSection.vue";
import ContactSection from "./ContactSection.vue";
import { skillsCameraKeyframes, skillsHeadKeyframes } from "./skills";

// How a section's HTML is laid out over the canvas:
//   flow   → the component fills the section height (the biography cluster).
//   pinned → a sticky, centered card (contact, interludes) using `layout`.
//   bare   → just a height spacer; the component positions itself (the hero's
//            fixed full-screen ASCII treatment).
export type SectionMode = "flow" | "pinned" | "bare";

/**
 * A top-level section, fully declared in code: the scene SPINE (`Section`) plus
 * the dedicated component that renders it and its layout mode.
 *
 * This is the single source of the section sequence (replacing the old
 * `content/sections/*.md` collection). The spine is config every section needs —
 * not content — so it belongs here, typed, not in markdown frontmatter. Markdown
 * stays reserved for the one genuinely content-shaped collection: the biography
 * milestones (`content/biography/*.md`), rendered by the biography section.
 */
export interface SectionDef extends Section {
  /** The component that renders this section's HTML. markRaw'd (never reactive). */
  component: Component;
  mode: SectionMode;
}

const v3 = (x: number, y: number, z: number) => ({ x, y, z });

// The scroll experience, in order. Camera poses / weights / accents are the same
// values the markdown frontmatter carried, so the camera path is unchanged.
//
// A section's `camera` is a single pose held at the section centre. To pan the
// camera THROUGH several poses while a section is on screen, give it
// `cameraKeyframes` instead (anchored like the spotlights — `t` is the local
// position 0..1, `milestone` pins to a biography card). Example:
//   cameraKeyframes: [
//     { t: 0.0, position: v3(-0.05, 0.05, 1.3), rotation: v3(-0.05, 0, 0) },
//     { milestone: 3, position: v3(0.3, 0.05, 1.25), rotation: v3(-0.05, 0.04, 0) },
//     { t: 1.0, position: v3(-0.05, 0.05, 1.35), rotation: v3(-0.05, -0.03, 0) },
//   ],
export const SECTION_DEFS: SectionDef[] = [
  {
    id: "identity",
    order: 0,
    type: "hero",
    component: markRaw(HeroSection),
    mode: "bare",
    title: "Frederic Abraham",
    subtitle: "Fullest-Stack Developer",
    weight: 2,
    accent: "#00ff9c",
    setPiece: [],
    setPieceVariant: "",
    layout: { align: "center" },
    camera: { position: v3(0.06, 0.04, 0.48), rotation: v3(-0.15, 0.15, 0.02) },
  },
  {
    id: "pause",
    order: 20,
    type: "interlude",
    component: markRaw(InterludeSection),
    mode: "pinned",
    title: "Interlude",
    weight: 1,
    accent: "#9ad1ff",
    setPiece: [],
    setPieceVariant: "",
    layout: { align: "center" },
    camera: { position: v3(0.0, 0.05, 0.85), rotation: v3(-0.1, 0.0, 0.0) },
  },
  {
    id: "biography",
    order: 30,
    type: "biography",
    component: markRaw(BiographySection),
    mode: "flow",
    title: "The path so far",
    subtitle: "Berlin → Maastricht → Berlin",
    weight: 4,
    accent: "#9ad1ff",
    setPiece: [],
    setPieceVariant: "",
    layout: { align: "center" },
    camera: { position: v3(-0.05, 0.05, 1.3), rotation: v3(-0.05, -0.03, 0.0) },
    // No `headKeyframes` here on purpose — unlike skills (below), this chapter's
    // head track is GENERATED at runtime, because its cards are a @nuxt/content
    // collection whose count and sides only exist once the query resolves. See
    // ./biography.ts for the formulas and `useBiographyChoreography` for the
    // wiring; the generated track lands in the same store map the dev panel edits,
    // and this section's `camera.position.z` is one of the inputs the gaze maths
    // assumes (it sets the frame size the cards are measured against).
  },
  {
    id: "skills",
    order: 40,
    type: "skills",
    component: markRaw(SkillsSection),
    // "bare": the component owns a sticky, full-viewport stage the cards fly
    // through — it can't be a pinned card, and it isn't a flowing cluster.
    mode: "bare",
    title: "What I bring",
    subtitle: "The toolbox",
    // Every beat in this chapter — card flight, mark draw-on, gaze, light — is a
    // fraction of this, so it is the single lever for the chapter's PACE. At
    // weight 3 a mark drew itself in over ~150px of scroll, roughly one notch of
    // a mouse wheel, and read as a flicker; at 5 the cards arrived so far apart
    // that the chapter dragged between them. 4 keeps each flight legible while
    // the cards follow each other closely (`HALF_FACTOR` in ./skills.ts widens
    // their overlap to match).
    //
    // Raised to 6: a logo's approach — from first visible to striking the head —
    // was 154px of scroll, about 1.5 notches of a wheel, which reads as a jump
    // rather than a flight. This widens every beat in the chapter together; the
    // rest of the gap is closed by `approach` in StackFlight, which spends more of
    // a mark's own run on the near half.
    weight: 6,
    accent: "#ffb454",
    setPiece: ["stackFlight"],
    setPieceVariant: "",
    layout: { align: "center" },
    camera: { position: v3(0.0, 0.05, 1.5), rotation: v3(-0.04, 0.0, 0.0) },
    // Both tracks are GENERATED from the card layout in ./skills.ts — the head's
    // gaze is the same formula the cards' positions are, so it turns out to meet
    // each card coming in and settles square to camera as it lands. Add or remove
    // a cluster and the gaze re-derives with it.
    cameraKeyframes: skillsCameraKeyframes(),
    headKeyframes: skillsHeadKeyframes(),
  },
  {
    id: "contact",
    order: 70,
    type: "contact",
    component: markRaw(ContactSection),
    mode: "pinned",
    title: "Let's build something that holds up",
    subtitle: "Berlin → Maastricht → Berlin · and onward",
    weight: 1.5,
    accent: "#00ff9c",
    setPiece: ["signalField"],
    // The finale: the head sits on the LEFT (camera panned right), turned to look
    // at the terminal card on the RIGHT, while the signal pulses travel *inward*
    // toward the head — a transmission being received. See Scene3D (head aim) +
    // SignalField (receive variant) + ContactSection (right-aligned card).
    setPieceVariant: "receive",
    layout: { align: "right", maxWidth: "32rem", offset: { x: -1 } },
    camera: { position: v3(0.62, 0.04, 1.72), rotation: v3(-0.04, 0.0, 0.0) },
  },
];

/** Strip a def down to its store-held spine (no Vue component in shared state). */
export const spineOf = (def: SectionDef): Section => ({
  id: def.id,
  order: def.order,
  type: def.type,
  title: def.title,
  subtitle: def.subtitle,
  weight: def.weight,
  layout: def.layout,
  setPiece: def.setPiece,
  setPieceVariant: def.setPieceVariant,
  accent: def.accent,
  camera: def.camera,
  cameraKeyframes: def.cameraKeyframes,
  headKeyframes: def.headKeyframes,
});
