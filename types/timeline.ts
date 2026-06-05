// Type definitions for the data-driven 3D biographical timeline.
// Chapters live in `content/timeline/*.md`; their frontmatter is validated by
// the zod schema in `content.config.ts` and normalized into `TimelineChapter`.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A camera "pose" the camera settles into while a chapter is centered. */
export interface CameraPose {
  position: Vec3;
  rotation: Vec3;
}

/**
 * Keys for the thin line/wireframe set-pieces that accompany chapters.
 * The whole scene is quantized by the ASCII post-process, so only
 * silhouettes/lines/wireframe read well — hence "line set-pieces".
 */
export type SetPieceName =
  | "lattice"
  | "berlinSkyline"
  | "routeArc"
  | "threadBoard"
  | "documentGrid"
  | "staffLines";

/** Normalized chapter used by the 3D/animation layer (derived from content). */
export interface TimelineChapter {
  /** Stable id (content path). */
  id: string;
  /** Sort key (also used to derive the numeric prefix ordering). */
  order: number;
  title: string;
  subtitle?: string;
  /** Geographic anchor for the Berlin → Maastricht → Berlin spine. */
  location?: string;
  /** Relative scroll length; drives both DOM section height and camera segment width. */
  weight: number;
  /** Line set-pieces that accompany this chapter (may stack; empty for none). */
  setPiece: SetPieceName[];
  /** Variant passed to the set-piece (e.g. lattice escalation: gan → embeddings → rag). */
  setPieceVariant: string;
  /** Accent colour for the chapter card / set-piece. */
  accent?: string;
  /** Camera pose the camera arrives at while this chapter is centered. */
  camera: CameraPose;
  /** Original content path (for keys / ContentRenderer). */
  path?: string;
}
