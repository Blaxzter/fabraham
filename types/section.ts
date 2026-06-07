// Type definitions for the data-driven section/scene framework.
// Top-level "sections" are the scene SPINE — declared as typed config in
// `components/home/sections/registry.ts` (order, type, weight, camera pose,
// set-pieces, layout), each paired with a dedicated Vue component. Biographical
// milestones — the one genuinely content-shaped, repeating collection — stay as
// markdown in `content/biography/*.md`, validated by the zod schema in
// `content.config.ts` and normalized into `BiographyMilestone` below.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A camera "pose" the camera settles into while a section is centered. */
export interface CameraPose {
  position: Vec3;
  rotation: Vec3;
}

/**
 * Keys for the thin line/wireframe set-pieces. The whole scene is quantized by
 * the ASCII post-process, so only silhouettes/lines/points read well.
 */
export type SetPieceName =
  | "lattice"
  | "berlinSkyline"
  | "routeArc"
  | "threadBoard"
  | "documentGrid"
  | "staffLines"
  | "signalField";

export type SectionType = "hero" | "biography" | "contact" | "interlude";

export type Align = "center" | "left" | "right" | "top" | "bottom" | "free";

/** How a section's HTML content piece is aligned/offset over the canvas. */
export interface SectionLayout {
  align: Align;
  offset?: { x?: number; y?: number };
  maxWidth?: string;
}

/**
 * A top-level peer section's SPINE: the scene state the scroll engine needs.
 * This is the shared shape held in the sections store (issue #4); the dedicated
 * component and layout mode that render it live on `SectionDef` (registry.ts).
 */
export interface Section {
  id: string;
  order: number;
  type: SectionType;
  title?: string;
  subtitle?: string;
  /** Relative scroll length; drives DOM section height and camera segment width. */
  weight: number;
  layout: SectionLayout;
  /** Line set-pieces that bloom while this section is centered (may stack). */
  setPiece: SetPieceName[];
  setPieceVariant: string;
  accent?: string;
  /** Camera pose the camera arrives at while this section is centered. */
  camera: CameraPose;
}

/** A biographical milestone rendered inside the biography section's cluster. */
export interface BiographyMilestone {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  location?: string;
  accent?: string;
  side: "left" | "right" | "auto";
  offset?: { x?: number; y?: number };
  /** Line backdrop(s) that bloom while this milestone is centered. */
  setPiece: SetPieceName[];
  setPieceVariant: string;
  path?: string;
}
