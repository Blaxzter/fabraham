/**
 * The camera frame, as a number the choreography can read.
 *
 * Every camera pose in `components/home/sections/registry.ts` was composed on a
 * wide screen, and the generators that aim the head at DOM cards need to know how
 * big the visible world actually is at a given pose — `biography.ts` used to carry
 * that as two hardcoded constants whose own comment admitted they "assume a wide
 * (≈16:9) viewport". On a phone held upright that assumption is off by more than
 * a factor of two in width, which is how the head ended up swerving clean out of
 * frame.
 *
 * So it lives here instead, derived from the same lens the scene actually renders
 * with: Scene3D imports `fovForAspect` to drive the camera, and the generators
 * import `frameHalfAt` to measure the frame that lens produces. One formula, so
 * the two can never disagree.
 */

/** The FOV every camera pose in the registry was framed against. */
export const BASE_FOV = 45;

/**
 * The aspect at or above which `fovForAspect` changes nothing.
 *
 * Square, NOT the 16:9 the poses were composed for — deliberately. Every
 * LANDSCAPE viewport has to come out at exactly `BASE_FOV`, or a 16:10 laptop
 * (1.6) and a 3:2 one (1.5) would quietly get a wider lens than the scene was
 * tuned on. The widening below is a rescue for viewports that are TALLER than
 * they are wide, and 1 is the only threshold that says exactly that.
 */
export const REF_ASPECT = 1;

/**
 * The widest lens we will reach for. A tall phone asks for ~84°, which is a
 * fisheye — it would bend the set-pieces' straight lines into the corners. 70°
 * recovers most of the head's silhouette while the projection still reads as the
 * same lens.
 */
export const MAX_FOV = 70;

const DEG = Math.PI / 180;

/**
 * A perspective camera's `fov` is its VERTICAL one, so the horizontal frame is
 * whatever the aspect makes of it — and on a phone held upright that is barely a
 * third of the width the scene was composed for. Once a viewport goes portrait,
 * widen the vertical fov by however much the aspect has narrowed past square,
 * giving back the width the rotation took rather than trying to reach a desktop
 * frame a phone was never going to hold.
 */
export const fovForAspect = (aspect: number) => {
  if (!(aspect > 0) || aspect >= REF_ASPECT) return BASE_FOV;
  const halfH = Math.tan((BASE_FOV / 2) * DEG) * (REF_ASPECT / aspect);
  return Math.min(MAX_FOV, (2 * Math.atan(halfH)) / DEG);
};

/**
 * Half the visible world at `distance` in front of the camera, in world units —
 * the bridge between "x% across the screen" and "x world units from the middle".
 *
 * At 16:9 and the biography's camera distance (1.3) this returns
 * `{ w: 0.957, h: 0.538 }`, which is what that chapter's old `FRAME_HALF_W: 0.96`
 * / `FRAME_HALF_H: 0.54` constants were. On a 390×844 phone the same call returns
 * `{ w: 0.421, h: 0.910 }` — less than half the width, nearly twice the height.
 */
export const frameHalfAt = (aspect: number, distance: number) => {
  const h = Math.tan((fovForAspect(aspect) / 2) * DEG) * distance;
  return { w: h * aspect, h };
};

/** The aspect the registry's poses were composed against (see `frameHalfAt`). */
export const COMPOSED_ASPECT = 16 / 9;

/**
 * The head's half-extents in world units, measured from `public/models/head.glb`
 * (local bbox 0.305 × 0.378 × 0.295, rendered at `scale: 2` in Scene3D and
 * re-centred on the origin there).
 *
 * Here because "does the head still fit in the frame" is a question only these
 * two numbers and `frameHalfAt` can answer. Re-measure if the model is replaced:
 *   node -e "…read the GLB's POSITION accessor min/max…"
 */
export const HEAD_HALF = { x: 0.305, y: 0.378 };
