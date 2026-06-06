// Type definitions for the data-driven section/scene framework.
// Top-level "sections" live in `content/sections/*.md`; biographical milestones
// (rendered as one artistic cluster by the biography section) live in
// `content/biography/*.md`. Both are validated by the zod schemas in
// `content.config.ts` and normalized into the shapes below.

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
  | "staffLines";

export type SectionType = "biography" | "tech-stack" | "contact" | "interlude";

export type Align = "center" | "left" | "right" | "top" | "bottom" | "free";

/** How a section's HTML content piece is aligned/offset over the canvas. */
export interface SectionLayout {
  align: Align;
  offset?: { x?: number; y?: number };
  maxWidth?: string;
}

/** A top-level peer section: a content piece + a 3D scene state. */
export interface Section {
  id: string;
  order: number;
  type: SectionType;
  title: string;
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
  /** Per-type config (e.g. tech-stack items) — narrowed by consumers. */
  data?: Record<string, unknown>;
  path?: string;
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
  path?: string;
}
