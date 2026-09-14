<script setup lang="ts">
import { computed, shallowRef, onMounted, onBeforeUnmount } from "vue";
import { useWindowSize } from "@vueuse/core";
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Path,
  Shape,
  SphereGeometry,
  WireframeGeometry,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  clusterLogos,
  skillAccent,
  SKILL_CLUSTERS,
  SKILLS_RANGE,
  SKILLS_TOP_PAD,
  skillLit,
  skillTravel,
} from "../sections/skills";

/**
 * The "skills" chapter's backdrop: the stack itself, FLYING PAST YOU.
 *
 * This replaces the old conveyor (rails, tick gates, a dot belt and two vertical
 * descent guides, with the brand marks drawn flat on the rails). That backdrop
 * moved sideways while the DOM cards now fly at you and recede into the face —
 * two axes arguing with each other. Everything here travels the card's axis
 * instead: it launches a hand's width in front of the camera and runs away into
 * the depth.
 *
 * Two populations, one behaviour:
 *
 *   MARKS — the real brand SVGs of the cluster whose card is on the mark,
 *   EXTRUDED into solids rather than stroked flat, launched one after another so
 *   the cluster strings out into a procession at a range of depths.
 *
 *   SHARDS — tech debris on the same flight path, running continuously so the
 *   frame is never empty between clusters: ICs with pin legs, angle brackets, hex
 *   nuts, crystals, cube frames and flat circuit traces. The trace is the only
 *   flat one on purpose — a field of nothing but solids reads as a bag of rocks.
 *
 * BOTH draw themselves in as they launch (`setDrawRange` over edges sorted
 * bottom-up), on the same short window. The shards used to fade in fully formed
 * while a mark was still assembling, which left the icons visibly trailing the
 * debris they were supposed to arrive with.
 *
 * ONE HUE AT A TIME: the whole field takes the colour of the cluster currently on
 * the mark. Giving each piece its own colour made a frame of four hues at once,
 * which reads as confetti; a frame that changes register as a whole reads as a
 * new chapter.
 *
 * The paths are near-PARALLEL to the view axis rather than aimed at the head. An
 * earlier version aimed each flyer at its own point scattered around the face,
 * which diverged hard from a small launch ring and read exactly like someone
 * lobbing shapes at the camera. Parallel paths give the opposite read — you are
 * moving through a field that stays put — and they still converge toward the face
 * ON SCREEN, because the vanishing point of a line parallel to the view axis is
 * the centre of frame. Perspective does it, not arithmetic.
 *
 * The head is a SOLID BODY they COLLIDE with. Each flight is a straight line, so
 * whether it hits is an exact ray-sphere test — the ones that miss sail past
 * untouched, and the ones that connect kink off at the point of contact, flash,
 * and tumble away into the dark. That distinction is what makes it read as a
 * collision rather than as a force field: a field bends everything near it, and
 * the eye reads that as magnetism, not impact. See `place`.
 *
 * Everything is line art, as the rest of the scene is: outlines of real 3D
 * bodies, with a DEPTH-ONLY fill inside each extruded piece so its back edges are
 * hidden and it reads as solid rather than as a cage. (Set-pieces bypass the
 * ASCII pass — see SceneSetPieces — so shaded solids would in fact render; lines
 * are a style decision here, not a technical limit.)
 *
 * Scroll-driven off ONE source, `sections/skills.ts` — the same module the DOM
 * cards and the head's gaze read. Nothing is allocated per frame (issue #4).
 * Listed in OCCLUDED_PIECES, so the head stamps itself into the depth buffer
 * first and anything still behind it is genuinely hidden.
 */
interface Props {
  reveal?: number;
  variant?: string;
  position?: [number, number, number];
}
const props = withDefaults(defineProps<Props>(), {
  reveal: 0,
  variant: "",
  position: () => [0, 0, 0],
});

const store = useSectionsStore();

/** What anything tints toward at full attention, whatever the chapter's hue. */
const HOT = new Color("#fff3d6");

// ---- live controls ----------------------------------------------------------
// The spread and the head clearance are the two numbers worth dialling against
// the real scene rather than guessing, so they are tunable (dev panel → skills →
// Stack flight) and ship through tuning.config.json.
const tune = useTuning("stackFlight", "Stack flight", "skills");
/**
 * How wide the field fans out, AS A MULTIPLE OF THE DEPTH RUN.
 *
 * This is the number that decides whether the debris reads as a stream aimed at
 * the head or as a field you are flying through, and it is a ratio rather than an
 * absolute for a reason. A piece sits on screen at `lateral / depth`. Depth grows
 * by a fixed factor over a run (~17× at the shipped depth), so:
 *
 *   1.0  the lateral grows at exactly that rate — every piece HOLDS its screen
 *        position and simply shrinks. A static field, and you are moving through it.
 *   <1   depth outruns the fan and everything converges on the vanishing point.
 *        At 2.7 absolute (0.16 here) the visible field was 63% inside the middle
 *        two-fifths of the frame: a narrow stream pointed at the head.
 *   >1   the fan outruns depth and pieces drift outward and off the edges.
 *
 * Expressed as a ratio so it stays correct when `depth` moves — an absolute value
 * silently becomes wrong the moment the run gets longer or shorter.
 *
 * (New key: the old absolute `spread` is deliberately orphaned, because a saved
 * 3.5 would mean 3.5× the depth ratio here and throw the field off the screen.)
 */
const spreadRatio = tune.num("spreadRatio", 1, { min: 0.05, max: 2.5, step: 0.05, label: "Field spread (x depth)" });
/**
 * How wide the pieces that MISS the head spread, IN FRAMES: 1 puts the outermost
 * launch exactly on the edge of the frame, 1.15 just outside it.
 *
 * Measured in frames rather than world units, and that is the whole point. The
 * visible frame at the launch plane is only ~0.46 world units wide, so the old
 * world-unit version at 1 put two thirds of the field permanently off screen —
 * and the safe value moved every time `spreadRatio` did, because convergence used
 * to drag off-screen pieces back into view and now does not. A number in frames
 * means the same thing at any spread or depth.
 *
 * It deliberately does not touch the pieces aimed at the head; widening the field
 * should never quietly stop the collisions happening.
 *
 * (New key: the old world-unit `radius` is orphaned on purpose — a saved 1 would
 * mean something entirely different here.)
 */
const fieldWidth = tune.num("fieldWidth", 1.15, { min: 0.2, max: 3, step: 0.05, label: "Field width (frames)" });
/**
 * What share of the SHARDS is launched on a collision course. Every MARK collides
 * — see the launch radius in `place`.
 *
 * Left to chance this was ~9%: two shards out of twenty-two, each bouncing once,
 * mid-flight, somewhere off to the side — implemented, working, and far too rare
 * to read as anything. The launch radius is therefore SOLVED rather than drawn:
 * `grazeFor()` finds the widest launch at which a given flyer still strikes the
 * head, and this fraction of the debris is placed inside it. The rest are placed
 * outside it and are guaranteed to miss.
 *
 * The point of solving it is that the guarantee survives tuning: change the head
 * radius, the spread or the run depth and the same share still connects.
 */
const hitShare = tune.num("hitShare", 0.15, { min: 0, max: 1, step: 0.02, label: "Share of shards that collide" });
/** The head's collision radius, as a sphere at the origin. Set it to match the
 *  real model's width; 0 turns the collision off and lets everything phase
 *  through again. */
const headClear = tune.num("headClear", 0.46, { min: 0, max: 1.2, step: 0.02, label: "Head radius" });
/** How hard a piece is thrown outward along the impact normal. This is the
 *  visible veer — turn it up and the ricochets get wilder. */
const bounce = tune.num("bounce", 0.55, { min: 0, max: 2.5, step: 0.05, label: "Bounce kick" });
/**
 * How the kick GROWS with distance after impact, as a power of `d / dHit`.
 *
 * This exponent is the whole difference between a bounce you can see and a nudge
 * you cannot. On screen a piece sits at `X / d`, and `d` grows GEOMETRICALLY down
 * the run — more than twentyfold. So an outward push that grows linearly loses to
 * the perspective: the piece gains a little sideways offset and still converges on
 * the vanishing point, which is to say it still sails off behind the head, exactly
 * as if nothing had hit it.
 *
 * Above 1 the outward motion outruns `d` instead, the screen offset grows, and the
 * piece genuinely leaves the head and heads out of frame. Because `d` is itself
 * exponential in `u`, so is the veer — which is why it also picks up immediately
 * at the point of contact rather than drifting out over the rest of the run.
 */
const KICK_GROWTH = 1.3;
/**
 * Scales the SHARDS only — the marks are the content and stay the size they are.
 *
 * Applied at draw time rather than baked into each flyer, so one number resizes
 * the whole debris field live. Smaller debris also means a denser field reads as
 * texture rather than as clutter, which is why the count went up alongside it
 * (see SHARD_COUNT).
 */
const shardSize = tune.num("shardSize", 0.35, { min: 0.1, max: 2, step: 0.02, label: "Shard size" });
/**
 * How far the shards are pulled off the section hue toward cold slate.
 *
 * The second half of telling debris from content. The chapter still wears one
 * colour — the marks, the light cone, the spots and the DOM card all carry it at
 * full strength — but the debris sits back off it, so the eye sorts the frame into
 * "the things that mean something" and "the weather" without being told. 0 puts
 * the shards back on the section hue exactly.
 */
const shardTint = tune.num("shardTint", 0.4, { min: 0, max: 1, step: 0.02, label: "Shard desaturation" });
/**
 * How strongly a mark's FACE is filled, on top of its outline.
 *
 * The body mesh already existed — it was `colorWrite: false`, there purely to
 * hide the mark's own back edges. Turning its colour on costs nothing extra and
 * turns an outline OF a solid into a solid. Kept translucent by default: opaque
 * logo plates flatten into stickers and fight the ASCII head behind them, where a
 * washed fill still reads as a face while the bright outline keeps the drawing.
 *
 * 0 is exactly the old look — the body stays in the scene writing depth either
 * way, so the back edges remain hidden whatever this is set to.
 */
const markFill = tune.num("markFill", 0.35, { min: 0, max: 1, step: 0.02, label: "Logo fill" });
/**
 * How much of a MARK's run is spent approaching, rather than receding.
 *
 * The depth ramp is geometric over the whole run, but launch-to-head is only
 * ~2.8x of a ~22x run — in log terms a third of it — and a mark is not visible for
 * the first sixth. So the approach, which is the only part anyone watches, got
 * 18% of the flight: measured at 1.5 wheel notches from appearing to striking the
 * head, and 1.0 for the last logo of a cluster. That is what reads as "jumpy":
 * not too few steps (the flight is continuous per-frame maths) but too little
 * scroll, so one notch moves a logo a third of the way in.
 *
 * Raising this reshapes u -> depth so early travel is slower: at 1.8 the head is
 * reached at u 0.46 instead of 0.24. It changes the PACE along the path, never the
 * path, so the collision solve (which works in path space) is untouched.
 *
 * MARKS ONLY, deliberately. The same shaping on the shards makes them linger where
 * they are largest — measured, it takes the field from 47% of the frame covered to
 * 93%, which is a wall. The debris should keep streaming evenly; the logos are what
 * you need time to read.
 */
const markApproach = tune.num("approach", 1.8, { min: 1, max: 3, step: 0.05, label: "Logo approach dwell" });
/**
 * How fast a piece turns on its way past, in radians over a whole run.
 *
 * Stored per flyer as a bearing in [-1, 1] per axis and scaled by this, so one
 * number moves the whole field. At 1.5 (where this sat while the collision was
 * still a smooth deflection) a piece turned at most 43 degrees across its entire
 * flight, which does not read as rotation at all — it reads as a shape sliding.
 * At 4 a typical piece turns ~115 degrees and the liveliest ones most of a
 * revolution, which is enough to show that these are solids with a back and a
 * front rather than flat cutouts.
 */
const spinRate = tune.num("spin", 4, { min: 0, max: 20, step: 0.25, label: "Spin rate" });
/** How much faster a piece tumbles after being hit. The spin rate JUMPS at the
 *  moment of contact, which is half of what sells the impact.
 *
 *  Mind the scale: this compounds with the depth ramp, which is itself
 *  accelerating (ds/du reaches ~2.6 by the end of a run), so the rate late in the
 *  flight ends up roughly `1 + t + 3.1t` times the pre-impact rate — at 4 that is
 *  a ~17x blur, not a tumble. 1.2 lands around 5x, which reads as knocked
 *  spinning while the piece is still legible as a chip or a mark. */
const tumble = tune.num("tumble", 1.2, { min: 0, max: 12, step: 0.1, label: "Post-impact tumble" });
/**
 * Dev-only overlay drawing the geometry these sliders control. Everything here is
 * invisible — a spawn radius, a collision sphere, where the frame edge actually
 * falls — and every wrong guess in this file came from reasoning about it blind.
 *
 *   white ring      the outer spawn radius (`fieldWidth`), at the launch plane
 *   red ring        the graze radius: launch inside it and you hit the head
 *   red sphere      the head's collision volume (`headClear`)
 *   cyan rectangle  the visible frame at the launch plane — anything spawned
 *                   outside this starts off screen, and at spreadRatio 1 stays there
 *   dim cyan rect   the visible frame at the far end of the run (`depth`)
 */
const showHelpers = tune.bool("helpers", false, { label: "Show helpers" });
/** How deep into the background a run goes before it is spent — the draw
 *  distance. Raising it is what lets a piece keep shrinking into the dark instead
 *  of giving out while it is still an obvious shape; the fade-out below has to be
 *  pushed back with it or the extra distance is never seen. */
const runDepth = tune.num("depth", 9, { min: 1.5, max: 24, step: 0.2, label: "Run depth" });

// ---- the flight path --------------------------------------------------------
/** Roughly where the camera sits this chapter (skillsCameraKeyframes). */
const CAM_Z = 1.72;
/** How close to the lens a flyer starts. Anything nearer than about half a unit
 *  is wider than the frame at fov 45, and because the pace is geometric a third
 *  of every run would be spent there — the field filled the screen with giant
 *  near-field wireframe and read as noise. */
const LAUNCH_D = 0.62;
const LAUNCH_Z = CAM_Z - LAUNCH_D;
/**
 * Half the visible frame per unit of depth — multiply by a depth to get how far
 * off-axis the frame edge is there.
 *
 * MEASURED, not assumed. Scene3D matches the camera's aspect to the window, so a
 * hard-coded 16:9 is simply wrong on any other shape of viewport: at 21:9 the real
 * frame is ~17% wider than the constant claims, `fieldWidth` quietly stops meaning
 * frames, and the sides of a wide screen are left bare. Reactive rather than read
 * per frame, so the render loop still touches no layout (issue #4).
 */
const { width: viewW, height: viewH } = useWindowSize();
const HALF_FOV_TAN = Math.tan((45 * Math.PI) / 180 / 2); // Scene3D's vertical fov
const frameHalfPerDepth = computed(
  () => HALF_FOV_TAN * ((viewW.value || 1) / (viewH.value || 1))
);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

// Deterministic PRNG so the field is laid out identically on every reload.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- tech debris ------------------------------------------------------------
/** World size the longest edge of a brand mark is scaled to. */
const MARK_SIZE = 0.34;
/** Where a piece draws itself in, as a share of ITS OWN run. Deliberately early
 *  and quick, and shared by shards and marks alike: the shards run continuously
 *  while a cluster's marks only start at their own beat, so a slow mark wipe left
 *  the icons visibly trailing the debris they arrive with. */
const DRAW_START = 0.02;
const DRAW_WINDOW = 0.18;
/** How much later each successive mark of a cluster launches, as a share of the
 *  cluster's window — what strings a cluster out into a procession at a range of
 *  depths rather than a clump all at one distance. */
const LAUNCH_STAGGER = 0.09;

const rectShape = (x: number, y: number, w: number, h: number) => {
  const s = new Shape();
  s.moveTo(x, y);
  s.lineTo(x + w, y);
  s.lineTo(x + w, y + h);
  s.lineTo(x, y + h);
  s.closePath();
  return s;
};

/** An IC with pin legs — the most legible "this is a computer" silhouette there
 *  is in pure outline, which is why it leads the set. */
const chipShapes = () => {
  const shapes = [rectShape(-0.17, -0.13, 0.34, 0.26)];
  for (let i = 0; i < 3; i++) {
    const y = -0.095 + i * 0.08;
    shapes.push(rectShape(-0.235, y, 0.065, 0.036), rectShape(0.17, y, 0.065, 0.036));
  }
  return shapes;
};

/** An angle bracket, as a band rather than a filled wedge. */
const bracketShapes = (dir: number) => {
  const s = new Shape();
  s.moveTo(dir * 0.16, -0.2);
  s.lineTo(dir * -0.14, 0);
  s.lineTo(dir * 0.16, 0.2);
  s.lineTo(dir * 0.16, 0.115);
  s.lineTo(dir * -0.035, 0);
  s.lineTo(dir * 0.16, -0.115);
  s.closePath();
  return [s];
};

/** A hex nut: hexagon with a bore. */
const hexNutShapes = () => {
  const s = new Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * (Math.PI / 3);
    const x = Math.cos(a) * 0.19;
    const y = Math.sin(a) * 0.19;
    if (i) s.lineTo(x, y);
    else s.moveTo(x, y);
  }
  s.closePath();
  const bore = new Path();
  bore.absarc(0, 0, 0.098, 0, Math.PI * 2, true);
  s.holes.push(bore);
  return [s];
};

/** A fragment of circuit trace: right-angled runs with square vias. FLAT — the
 *  one piece in the set with no volume. */
const traceGeometry = (seed: number) => {
  const rand = mulberry32(seed * 7919 + 17);
  const pts: number[] = [];
  let x = -0.26;
  let y = -0.12 + rand() * 0.1;
  const push = (x1: number, y1: number, x2: number, y2: number) =>
    pts.push(x1, y1, 0, x2, y2, 0);
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) {
      const nx = x + 0.08 + rand() * 0.12;
      push(x, y, nx, y);
      x = nx;
    } else {
      const ny = y + (rand() < 0.5 ? -1 : 1) * (0.05 + rand() * 0.09);
      push(x, y, x, ny);
      y = ny;
      // a via at the corner
      const v = 0.018;
      push(x - v, y - v, x + v, y - v);
      push(x + v, y - v, x + v, y + v);
      push(x + v, y + v, x - v, y + v);
      push(x - v, y + v, x - v, y - v);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  g.center();
  return g;
};

/**
 * Sort a line geometry's segments bottom-to-top, so `setDrawRange` reveals the
 * outline as an upward WIPE. `EdgesGeometry` emits segments in face order, which
 * is arbitrary — drawing that range straight would sparkle random edges on
 * instead of drawing the shape. (The flat marks this replaces got the sweep for
 * free, because they were built from ordered polylines.)
 */
const sortEdgesUpward = (geo: BufferGeometry) => {
  const pos = geo.getAttribute("position") as BufferAttribute;
  const a = pos.array as Float32Array;
  const n = a.length / 6;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (p, q) => a[p * 6 + 1]! + a[p * 6 + 4]! - (a[q * 6 + 1]! + a[q * 6 + 4]!)
  );
  const out = new Float32Array(a.length);
  for (let i = 0; i < n; i++) out.set(a.subarray(order[i]! * 6, order[i]! * 6 + 6), i * 6);
  geo.setAttribute("position", new BufferAttribute(out, 3));
  return geo;
};

/** Outline + a depth-only body, from a set of 2D shapes. The body writes depth
 *  but no colour, so the piece's own back edges are hidden and it reads as a
 *  solid — without punching a dark plate through the scene behind it. */
const extruded = (shapes: Shape[], depth: number) => {
  const solid = new ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
  });
  solid.center();
  return { solid, edges: sortEdgesUpward(new EdgesGeometry(solid, 18)) };
};

interface ShardKind {
  edges: BufferGeometry;
}

/**
 * EVERY shard is an open frame — no depth body, so you see straight through it.
 *
 * That is the main thing separating the debris from the marks now: a mark is a
 * SOLID (its fill hides its own back edges, so it reads as an object you could
 * pick up), and a shard is a wireframe you can see the far side of. Same
 * language, unmistakably different register, and it costs nothing — the
 * extrusions are still needed to derive the outlines, they are just thrown away
 * once the edges are out.
 */
const SHARD_KINDS: ShardKind[] = [];
{
  const solids = [
    extruded(chipShapes(), 0.05),
    extruded(bracketShapes(1), 0.05),
    extruded(bracketShapes(-1), 0.05),
    extruded(hexNutShapes(), 0.07),
  ];
  for (const e of solids) {
    SHARD_KINDS.push({ edges: e.edges });
    e.solid.dispose(); // outlines only; nothing here gets a body
  }
  SHARD_KINDS.push(
    { edges: sortEdgesUpward(new EdgesGeometry(new OctahedronGeometry(0.17), 1)) },
    { edges: sortEdgesUpward(new EdgesGeometry(new IcosahedronGeometry(0.15), 1)) },
    { edges: sortEdgesUpward(new EdgesGeometry(new BoxGeometry(0.21, 0.21, 0.21), 1)) },
    { edges: sortEdgesUpward(traceGeometry(1)) },
    { edges: sortEdgesUpward(traceGeometry(2)) }
  );
}

/** How many shards EXIST. The number actually flown is the `count` tunable below;
 *  the rest of the pool sits idle and invisible. Built up front because flyers are
 *  constructed once, and a slider that had to allocate would hitch every time it
 *  moved. Idle ones cost a Group and a material — nothing is drawn. */
const SHARD_POOL = 320;
const SHARD_CYCLES = 2.2;
/** Autonomous drift layered on the scroll, so a parked field still breathes. */
const SHARD_DRIFT = 0.014;

/**
 * How many of the pool are actually in the air.
 *
 * This and `shardSize` trade against each other, and what they jointly control is
 * how much of the FRAME IS COVERED — roughly `count × size²`, since a piece's
 * screen area goes as the square of its size. Measured at the shipped spread:
 *
 *   count  80, size 0.50  →   71 on screen,  64% of the frame covered
 *   count 160, size 0.50  →  137 on screen, 131%  (an overlapping wall)
 *   count 160, size 0.35  →  137 on screen,  64%  (same fill, twice the debris)
 *
 * So "more objects" means "more and smaller", not just more. Push the count alone
 * and the frame silts up; take the size down with it and the field gets denser
 * without getting heavier to look at.
 *
 * Cost is one draw call per flyer, so the count is also the frame budget: ~180 at
 * the default, and the top of the slider is genuinely a lot.
 */
const shardCount = tune.num("count", 160, { min: 0, max: SHARD_POOL, step: 1, label: "Shard count" });
/** How far the whole field rises over the section — the chapter's only remaining
 *  "you are still going down the page" cue, now that the descent ladder is gone.
 *  Scrolling down sends the world up past you. */
const FIELD_RISE = 0.22;

// ---- flyers -----------------------------------------------------------------
interface Flyer {
  group: Group;
  line: LineSegments;
  material: LineBasicMaterial;
  body: Mesh | null;
  /** Unit bearing out of the launch ring. The launch RADIUS along it is solved
   *  per frame (see `grazeRadius`), not stored, so the share that collides holds
   *  whatever the geometry is tuned to. */
  bx: number;
  by: number;
  /** Where this flyer sits within its band (0..1) — inside the graze radius if it
   *  is aimed, outside it if not. */
  t: number;
  /** Deterministic 0..1 rank, compared against `hitShare` every frame so the
   *  aimed set can be dialled live. Golden-ratio spaced, so any threshold takes
   *  an evenly spread subset rather than a clump. */
  hitRank: number;
  /** Outer limit of this flyer's band, as a fraction of the frame, before
   *  `fieldWidth` scales it. */
  rMax: number;
  /** This flyer's own size, around 1. Multiplied by `shardSize` at draw time for
   *  shards; marks are drawn at it directly. */
  baseScale: number;
  /** Per-flyer variation on the shared spread, so the fan is not uniform. */
  fan: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  cluster: number;
  slot: number;
  vertexCount: number;
  isMark: boolean;
}

// ---- dev-only helper overlay ------------------------------------------------
const unitRing = (segments = 72) => {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(Math.cos(a), Math.sin(a), 0);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  return g;
};
const unitRect = () => {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
      3
    )
  );
  return g;
};

interface Helpers {
  group: Group;
  frameNear: LineLoop;
  frameFar: LineLoop;
  spawn: LineLoop;
  graze: LineLoop;
  head: LineSegments;
  dispose: () => void;
}

const buildHelpers = (): Helpers => {
  const group = new Group();
  group.visible = false;
  const ring = unitRing();
  const rect = unitRect();
  const sphere = new SphereGeometry(1, 20, 12);
  const wire = new WireframeGeometry(sphere);
  sphere.dispose();

  const mat = (hex: number, opacity: number) =>
    new LineBasicMaterial({ color: hex, transparent: true, opacity, depthTest: false });
  const mats = [mat(0x6fd7ff, 0.55), mat(0x6fd7ff, 0.25), mat(0xffffff, 0.7), mat(0xff5c8a, 0.8), mat(0xff5c8a, 0.4)];

  const frameNear = new LineLoop(rect, mats[0]);
  const frameFar = new LineLoop(rect, mats[1]);
  const spawn = new LineLoop(ring, mats[2]);
  const graze = new LineLoop(ring, mats[3]);
  const head = new LineSegments(wire, mats[4]);
  for (const o of [frameNear, frameFar, spawn, graze, head]) {
    o.frustumCulled = false;
    // Drawn last and without depth testing, so the head never hides the very
    // volume you are trying to see the size of.
    o.renderOrder = 999;
    group.add(o);
  }
  return {
    group, frameNear, frameFar, spawn, graze, head,
    dispose: () => {
      ring.dispose();
      rect.dispose();
      wire.dispose();
      for (const m of mats) m.dispose();
    },
  };
};

const helpers: Helpers | null = import.meta.dev ? buildHelpers() : null;

/** A stand-in flyer for the helper's graze ring: a nominal bearing and fan, so
 *  the ring shows the threshold for a typical piece rather than any one of them. */
const NOMINAL = { bx: 1, by: 0, fan: 1 } as unknown as Flyer;

const shards = shallowRef<Flyer[]>([]);
const marks = shallowRef<Flyer[]>([]);
const groupRef = shallowRef<Group | null>(null);
let disposed = false;

/** Everything a flyer needs to fly, worked out once at build time. */
const makeFlyer = (
  edges: BufferGeometry,
  solid: BufferGeometry | undefined,
  rand: () => number,
  opts: {
    isMark: boolean;
    cluster: number;
    slot: number;
    /** Marks: how many marks this cluster has, so they can be spaced against each
     *  other rather than scattered. 1 for shards, which stay random. */
    slotCount: number;
    /** World scale. Shards vary; a mark is always full size, because it has to
     *  stay recognisable as the thing it is. */
    scale: number;
    /** Marks only: the SVG y-flip inverts the winding, so the depth body has to
     *  fill from both sides or half the silhouette writes no depth. */
    doubleSide?: boolean;
  }
): Flyer => {
  const material = new LineBasicMaterial({
    // Recoloured every frame from the chapter's live hue; the initial value only
    // has to be something.
    color: new Color(skillAccent(0)),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const line = new LineSegments(edges, material);
  line.frustumCulled = false;

  const group = new Group();
  group.scale.setScalar(opts.scale);
  group.add(line);

  let body: Mesh | null = null;
  if (solid) {
    // Colour-less, so it only writes depth. `polygonOffset` pushes it a hair
    // behind its own surface, or the outline z-fights the body it belongs to.
    body = new Mesh(
      solid,
      new MeshBasicMaterial({
        // Painted now, not just a depth stamp. `depthWrite` stays on so it still
        // hides the mark's own back edges at any fill strength, and
        // `polygonOffset` pushes it a hair behind its own surface so the outline
        // does not z-fight the face it belongs to.
        transparent: true,
        opacity: 0,
        depthWrite: true,
        side: opts.doubleSide ? DoubleSide : undefined,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
    );
    body.frustumCulled = false;
    // Both the fill and the outline are transparent now, so draw order is no
    // longer decided by the opaque/transparent split. Force the face first or it
    // paints over the edges that belong to it.
    body.renderOrder = -1;
    group.add(body);
  }

  // Launch: a ring just in front of the lens. Only the BEARING is fixed here —
  // the radius along it is solved each frame from the live geometry. The ring is
  // squashed vertically (the frame is wider than it is tall), so normalise or the
  // solved radius would mean something different depending on the bearing.
  //
  // A cluster's MARKS are spaced deterministically around the ring; only the
  // shards are scattered. Random bearings clump — five random draws put three of
  // Infra's logos within 25 degrees of each other and two of them 2 degrees apart,
  // so they flew the same path and landed on top of one another. Every mark is
  // aimed at the head, which confines them all to a narrow cone already; inside
  // that cone they have to be placed, not rolled. The jitter keeps it from reading
  // as a perfect polygon without ever closing the gaps much.
  const a = opts.isMark
    ? ((opts.slot + 0.5) / opts.slotCount) * Math.PI * 2 +
      opts.cluster * 0.8 +
      (rand() - 0.5) * 0.5
    : rand() * Math.PI * 2;
  const ex = Math.cos(a);
  const ey = Math.sin(a) * 0.8;
  const el = Math.hypot(ex, ey) || 1;

  return {
    group,
    line,
    material,
    body,
    bx: ex / el,
    by: ey / el,
    // Spaced for marks too, so a cluster fans out from the axis instead of
    // stacking at one distance from it.
    t: opts.isMark
      ? clamp01((opts.slot + 0.5) / opts.slotCount + (rand() - 0.5) * 0.18)
      : rand(),
    hitRank: (opts.slot * 0.6180339887498949) % 1,
    // In FRAMES. Marks stay nearer the axis: they have to remain readable, and
    // they are the content. (Marks are always aimed, so this only ever applies to
    // shards in practice.)
    rMax: opts.isMark ? 0.65 : 1,
    baseScale: opts.scale,
    fan: 0.8 + rand() * 0.45,
    // A per-axis bearing in [-1, 1], scaled by `spinRate` at draw time — the
    // magnitude is one tunable for the whole field rather than baked in here.
    // Roll (z) is deliberately slower than pitch and yaw: a piece spinning
    // hardest about the view axis just looks like a turning sticker, where the
    // other two show its depth.
    spinX: (rand() - 0.5) * 2,
    spinY: (rand() - 0.5) * 2.1,
    spinZ: (rand() - 0.5) * 1.2,
    cluster: opts.cluster,
    slot: opts.slot,
    vertexCount: edges.getAttribute("position").count,
    isMark: opts.isMark,
  };
};

// Shards exist immediately; the marks wait on their SVGs.
{
  const rand = mulberry32(4177);
  const built: Flyer[] = [];
  for (let i = 0; i < SHARD_POOL; i++) {
    const kind = SHARD_KINDS[i % SHARD_KINDS.length]!;
    built.push(
      makeFlyer(kind.edges, undefined, rand, {
        isMark: false,
        cluster: -1,
        slot: i,
        slotCount: 1,
        // Around 1: the absolute size is `shardSize`, this is only the spread.
        scale: 0.6 + rand() * 0.8,
      })
    );
  }
  shards.value = built;
}

// ---- the brand marks, extruded ---------------------------------------------
const LOGO_URL = (name: string) => `/setpieces/logos/${name}.svg`;

/**
 * Real mark → extruded solid. `SVGLoader.createShapes` gives proper `Shape`s
 * WITH their holes, which is what makes an extrusion possible at all — the
 * previous version only needed flat polylines and so never had to resolve them.
 */
const buildMark = (paths: ReturnType<SVGLoader["parse"]>["paths"]) => {
  const shapes: Shape[] = [];
  for (const path of paths) for (const s of SVGLoader.createShapes(path)) shapes.push(s);
  if (!shapes.length) return null;

  const solid = new ExtrudeGeometry(shapes, {
    depth: 6,
    bevelEnabled: false,
    curveSegments: 6,
  });
  solid.computeBoundingBox();
  const bb = solid.boundingBox;
  if (!bb) return null;
  const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) || 1;
  const k = MARK_SIZE / span;
  // Negative Y: SVG is y-down, three is y-up. That inverts the winding, so the
  // depth body is DoubleSide — it only needs to fill the silhouette.
  solid.scale(k, -k, k);
  solid.center();
  return { solid, edges: sortEdgesUpward(new EdgesGeometry(solid, 20)) };
};

onMounted(async () => {
  const loader = new SVGLoader();
  const built: Flyer[] = [];

  await Promise.all(
    SKILL_CLUSTERS.flatMap((cluster, ci) => {
      const names = clusterLogos(cluster);
      return names.map(async (name, slot) => {
        try {
          const data = await loader.loadAsync(LOGO_URL(name));
          if (disposed) return;
          const shape = buildMark(data.paths);
          if (!shape) return;
          built.push(
            // Seeded PER MARK, not from one shared sequence: these are built
            // inside `await`ed callbacks, so the order they finish in is however
            // the SVGs happen to load. A shared generator made the layout differ
            // between reloads, which is exactly what the deterministic PRNG is
            // there to prevent.
            makeFlyer(shape.edges, shape.solid, mulberry32(ci * 31 + slot * 7 + 101), {
              isMark: true,
              cluster: ci,
              slot,
              slotCount: names.length,
              scale: 1,
              doubleSide: true,
            })
          );
        } catch (err) {
          console.warn(`[StackFlight] could not load ${LOGO_URL(name)}`, err);
        }
      });
    })
  );

  if (!disposed) marks.value = built;
});

// ---- the loop ---------------------------------------------------------------
// Per-frame scratch, read off the tunables once a frame and shared by `place`.
// Module-level rather than arguments so the hot path allocates nothing (issue #4).
let fSpread = 1;
let fWidth = 1;
/** World half-frame at the launch plane, for this viewport. */
let fLaunchHalf = 0.46;
let fClear = 0;
let fHitShare = 0;
let fShardSize = 1;
let fShardTint = 0;
let fMarkFill = 0;
let fApproach = 1;
let fSpin = 0;
let fKick = 0;
let fTumble = 0;
let fEndZ = -5;
let fEndD = 1;
let fRise = 0;

/**
 * The widest launch radius at which THIS flyer still strikes the head.
 *
 * Monotonic in r — launching further out can only pass further out — so a
 * bisection nails it in a dozen steps.
 *
 * Solved per flyer, not once for the field, and that is not fussiness: an earlier
 * version used the mean fan and ignored the field's rise, and only 6 of 17 "aimed"
 * pieces actually connected while 5 supposedly-missing ones hit anyway. The
 * per-flyer fan varies by a quarter either way and multiplies the whole outward
 * angle, so a mean is nowhere near good enough to promise anything with. It is
 * ~12 cheap iterations per visible flyer per frame, which is nothing next to
 * drawing them, and it buys an exact guarantee that survives tuning.
 */
const grazeFor = (f: Flyer) => {
  const dz = fEndZ - LAUNCH_Z;
  const k = fSpread * f.fan;
  const strikes = (r: number) => {
    const ax = f.bx * r;
    const ay = f.by * r + fRise;
    const dx = f.bx * r * k - ax;
    const dy = f.by * r * k + fRise - ay;
    const dd = dx * dx + dy * dy + dz * dz;
    const ad = ax * dx + ay * dy + LAUNCH_Z * dz;
    const aa = ax * ax + ay * ay + LAUNCH_Z * LAUNCH_Z;
    // A launch already INSIDE the head counts as striking it. `headClear` can be
    // dialled past LAUNCH_Z, and then the near root sits behind the launch plane
    // and every piece reads as a clean miss — which silently collapses the whole
    // aimed/unaimed split while pieces further out still collide.
    if (aa < fClear * fClear) return true;
    const disc = ad * ad - dd * (aa - fClear * fClear);
    if (disc <= 0) return false;
    const sHit = (-ad - Math.sqrt(disc)) / dd;
    return sHit > 0 && sHit < 1;
  };
  // Dead on the axis must hit, or nothing can (headClear at 0, or a rise that has
  // carried the whole field clear of the head).
  if (!strikes(0)) return 0;
  let lo = 0;
  let hi = 1.6;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) * 0.5;
    if (strikes(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
};

/**
 * Place one flyer at travel `u`, bouncing it off the head if it hits.
 *
 * The pace is geometric in DISTANCE FROM CAMERA — something receding at a steady
 * rate halves in apparent size over equal steps of depth, so a geometric ramp is
 * the one that reads as constant velocity. The lateral position is then a plain
 * fan: the bearing it launched on, opened out by `spread` as it goes. Both are
 * LINEAR in `s`, which is the thing that makes the collision cheap and exact —
 * the whole flight is a straight line in space, so "does it hit the head" is a
 * closed-form ray-sphere test rather than anything stepped or simulated.
 *
 * Everything here stays a pure function of `u`. That is not a style preference:
 * scrolling back up has to run the collision backwards, exactly, and a piece that
 * remembered it had been hit would smear on the way out. So there is no state and
 * no integration — the impact is *solved for*, every frame, from scratch.
 *
 * Only x and y are touched. The depth ramp owns z, so a bounce changes where a
 * piece goes without ever changing how fast it recedes.
 */
const place = (f: Flyer, u: number, fade: number, tint: number, hue: Color) => {
  // Marks dwell on the approach; shards keep an even pace (see `markApproach`).
  const paced = f.isMark ? Math.pow(u, fApproach) : u;
  // Solved launch radius: inside this flyer's own graze radius if it is aimed,
  // safely outside it if not. Exact, so the share that collides is the share that
  // was asked for.
  //
  // EVERY MARK is aimed. A logo is the thing worth watching, so each one gets the
  // beat: flown at the face, struck off it, and sent tumbling out of frame. The
  // debris is the part that is left to a share — if all of it collided too the
  // head would be the only place anything ever happened, and the field would stop
  // reading as something you are moving through.
  //
  // The guarantee holds while `headClear` > FIELD_RISE (0.22). Below that the
  // field has risen clear of the head by the end of the section and nothing can
  // reach it — `grazeFor` returns 0 and the marks fall through to the miss branch
  // and simply fly past. Degrades quietly rather than breaking, and only a head
  // far smaller than the real one gets there.
  const graze = fClear > 0 ? grazeFor(f) : 0;
  const aimed = graze > 0 && (f.isMark || f.hitRank < fHitShare);
  const inner = graze * 1.08;
  const r = aimed
    ? graze * (0.08 + 0.88 * f.t)
    : inner + f.t * Math.max(0, f.rMax * fWidth * fLaunchHalf - inner);
  const lx = f.bx * r;
  const ly = f.by * r;

  const d = LAUNCH_D * Math.pow(fEndD / LAUNCH_D, paced);
  const z = CAM_Z - d;
  const s = (z - LAUNCH_Z) / (fEndZ - LAUNCH_Z);
  const fan = 1 + (fSpread * f.fan - 1) * s;
  let x = lx * fan;
  let y = ly * fan + fRise;

  let after = 0;
  let flash = 0;
  if (fClear > 0) {
    // The flight, as a segment: A at the launch plane, B at the far end.
    const ax = lx;
    const ay = ly + fRise;
    const gEnd = fSpread * f.fan;
    const dx = lx * gEnd - ax;
    const dy = ly * gEnd + fRise - ay;
    const dz = fEndZ - LAUNCH_Z;
    // |A + D·s| = R, solved for the NEAR root: the face of the head it strikes.
    const dd = dx * dx + dy * dy + dz * dz;
    const ad = ax * dx + ay * dy + LAUNCH_Z * dz;
    const aa = ax * ax + ay * ay + LAUNCH_Z * LAUNCH_Z;
    const disc = ad * ad - dd * (aa - fClear * fClear);
    if (disc > 0) {
      const root = (-ad - Math.sqrt(disc)) / dd;
      // In contact from the start if the launch is inside the head (see grazeFor).
      const sHit = root < 0 && aa < fClear * fClear ? 0 : root;
      if (sHit >= 0 && sHit < 1 && s > sHit) {
        after = (s - sHit) / (1 - sHit || 1);
        const px = ax + dx * sHit;
        const py = ay + dy * sHit;
        const pl = Math.sqrt(px * px + py * py);
        const nx = pl > 1e-4 ? px / pl : f.bx;
        const ny = pl > 1e-4 ? py / pl : f.by;
        // A REBOUND, not a nudge. Once it has been hit the piece leaves the
        // straight path entirely and flies from the point of contact: keep the
        // tangential part of its motion, REVERSE the part heading into the head,
        // and add the kick outward along the normal.
        //
        // Adding the kick to the straight path instead (the obvious shortcut)
        // looks right for glancing hits and is badly wrong for square ones: the
        // straight path carries on through the head and out the far side, so it
        // crosses the axis, the outward bearing flips, and the piece snaps
        // through 180 degrees. Rebounding from the contact point cannot cross the
        // axis, because the radial component only ever points away.
        const vx = dx * (s - sHit);
        const vy = dy * (s - sHit);
        const rad = vx * nx + vy * ny;
        const undo = rad < 0 ? -2 * rad : 0;
        // Scaled by depth, not by the remaining run — see KICK_GROWTH.
        const zHit = LAUNCH_Z + sHit * (fEndZ - LAUNCH_Z);
        const dHit = CAM_Z - zHit;
        const grow = Math.pow(d / (dHit || 1e-4), KICK_GROWTH) - 1;
        const out = undo + fKick * grow;
        x = px + vx + out * nx;
        y = py + vy + out * ny;
        // A hard, brief spark at contact rather than a glow around the head.
        flash = Math.exp(-after * 16);
      }
    }
    // Backstop: a glancing hit can still clip the surface on its way out, and
    // nothing may ever be INSIDE the head. A sphere of radius R cuts a circle of
    // this radius at depth z; outside |z| > R there is nothing to clear.
    const rhoMin2 = fClear * fClear - z * z;
    if (rhoMin2 > 0) {
      const rho2 = x * x + y * y;
      if (rho2 < rhoMin2) {
        const k = Math.sqrt(rhoMin2 / (rho2 || 1e-8));
        x *= k;
        y *= k;
      }
    }
  }

  f.group.position.set(x, y, z);
  if (!f.isMark) f.group.scale.setScalar(f.baseScale * fShardSize);
  // The spin RATE jumps at contact — the angle stays continuous, its derivative
  // does not. Half of what sells an impact is the tumble it imparts.
  const spinK = fSpin * (1 + fTumble * after);
  f.group.rotation.set(u * f.spinX * spinK, u * f.spinY * spinK, u * f.spinZ * spinK);
  f.material.opacity = fade;
  f.material.color.copy(hue).lerp(HOT, clamp01(tint + flash * 0.8));
};

/** The chapter's live hue, the two it is crossfading between, and the cooled-off
 *  version the debris wears. */
const HUE = new Color();
const HUE_A = new Color();
const HUE_B = new Color();
const HUE_SHARD = new Color();
const HUE_AT = new Color();

/**
 * The chapter's hue at an arbitrary point in the section, written into `out`.
 *
 * Crossfaded in HSL rather than RGB: an RGB lerp between two hues this far apart
 * passes through desaturated grey (the same trap the spotlight hand-offs dodge
 * with a dark beat). `lerpHSL` goes the short way round the wheel instead. Holds
 * each cluster's colour through the middle of its band and swings across in the
 * gap, so the hue belongs to the cluster rather than sliding continuously.
 *
 * The two pure-colour early exits are not just tidiness: this runs per shard per
 * frame now, and most shards sit inside a band rather than in a hand-off, so the
 * HSL conversion is skipped for nearly all of them.
 */
const hueAt = (flow: number, out: Color) => {
  const n = SKILL_CLUSTERS.length;
  const bandWidth = SKILLS_RANGE / n;
  const idx = (flow - SKILLS_TOP_PAD) / bandWidth - 0.5;
  const i0 = Math.max(0, Math.min(n - 1, Math.floor(idx)));
  const i1 = Math.max(0, Math.min(n - 1, i0 + 1));
  const w = smoothstep(0.35, 0.65, idx - i0);
  if (w <= 0.001 || i0 === i1) return out.set(skillAccent(i0));
  if (w >= 0.999) return out.set(skillAccent(i1));
  HUE_A.set(skillAccent(i0));
  HUE_B.set(skillAccent(i1));
  return out.copy(HUE_A).lerpHSL(HUE_B, w);
};
/** Where the shards are pulled toward — cold, and desaturated enough to sit back
 *  from any of the four section hues. */
const SLATE = new Color("#7d8796");

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;

  // The one scroll signal this whole chapter runs on.
  const flow = store.localFracAt("skills", store.progress);
  const n = SKILL_CLUSTERS.length;

  fWidth = fieldWidth.value;
  fLaunchHalf = LAUNCH_D * frameHalfPerDepth.value;
  fClear = headClear.value;
  fHitShare = hitShare.value;
  fShardSize = shardSize.value;
  fShardTint = shardTint.value;
  fMarkFill = markFill.value;
  fApproach = markApproach.value;
  fSpin = spinRate.value;
  fKick = bounce.value;
  fTumble = tumble.value;
  fEndZ = -runDepth.value;
  fEndD = CAM_Z - fEndZ;
  // AFTER fEndD: the spread is a ratio of this frame's depth run, so reading it
  // any earlier picks up last frame's value (and the initial one on frame one).
  fSpread = spreadRatio.value * (fEndD / LAUNCH_D);
  fRise = flow * FIELD_RISE;

  if (helpers) {
    helpers.group.visible = showHelpers.value;
    if (showHelpers.value) {
      const halfH = HALF_FOV_TAN;
      helpers.frameNear.scale.set(fLaunchHalf, LAUNCH_D * halfH, 1);
      helpers.frameNear.position.z = LAUNCH_Z;
      helpers.frameFar.scale.set(fEndD * frameHalfPerDepth.value, fEndD * halfH, 1);
      helpers.frameFar.position.z = fEndZ;
      helpers.spawn.scale.setScalar(Math.max(1e-3, fWidth * fLaunchHalf));
      helpers.spawn.position.z = LAUNCH_Z;
      helpers.graze.scale.setScalar(Math.max(1e-3, fClear > 0 ? grazeFor(NOMINAL) : 0));
      helpers.graze.position.z = LAUNCH_Z;
      helpers.head.scale.setScalar(Math.max(1e-3, fClear));
    }
  }

  // The chapter's hue right now — what the light cone and the DOM card wear.
  hueAt(flow, HUE);

  // How lit is the chapter right now — the shards brighten on each card's beat.
  let beat = 0;
  for (let i = 0; i < n; i++) {
    const lit = skillLit(skillTravel(i, n, flow));
    if (lit > beat) beat = lit;
  }

  const shardList = shards.value;
  const flying = Math.min(Math.round(shardCount.value), shardList.length);
  for (let i = 0; i < shardList.length; i++) {
    const f = shardList[i]!;
    if (i >= flying) {
      f.group.visible = false;
      continue;
    }
    // Phase spread across the LIVE count, not the pool, so the ring stays evenly
    // spaced however many are flying. Split out the scroll-driven part: it is what
    // says HOW LONG AGO this piece launched, which the ambient drift does not.
    const uFlow = (flow * SHARD_CYCLES + i / flying) % 1;
    const u = (uFlow + elapsed * SHARD_DRIFT) % 1;
    // Lit for almost the whole run. Fading flyers out early made the old field
    // look like it evaporated in mid-air rather than going anywhere: by the time
    // one disappeared it had barely shrunk.
    const fade =
      smoothstep(0.0, 0.1, u) *
      (1 - smoothstep(0.92, 1.0, u)) *
      (0.22 + 0.32 * beat) *
      reveal;
    f.group.visible = fade > 0.004;
    if (!f.group.visible) continue;
    const drawn = smoothstep(DRAW_START, DRAW_START + DRAW_WINDOW, u);
    f.line.geometry.setDrawRange(0, Math.floor((f.vertexCount / 2) * drawn) * 2);
    if (f.body) f.body.visible = drawn > 0.985;
    // Coloured by the hue that was current WHEN IT LAUNCHED, not the hue now.
    // Repainting the whole field every frame meant a cluster change swept the new
    // colour onto pieces already deep in the background, which reads as the scene
    // being recoloured rather than as anything moving. Holding each piece's launch
    // colour makes the change arrive with the new arrivals and leaves the far field
    // on the old one — the field becomes a record of the chapter in depth.
    //
    // `u / SHARD_CYCLES` is how much scroll ago that was; exact, because `uFlow`
    // excludes the time-based drift.
    hueAt(flow - uFlow / SHARD_CYCLES, HUE_AT);
    HUE_SHARD.copy(HUE_AT).lerp(SLATE, fShardTint);
    place(f, u, fade, 0, HUE_SHARD);
  }

  const markList = marks.value;
  for (let i = 0; i < markList.length; i++) {
    const f = markList[i]!;
    // The stagger REMAPS the run rather than offsetting it. Subtracting the
    // stagger from `u` (the obvious way) means a late mark only ever reaches
    // u = 1 - stagger before its cluster's window closes — so it was cut off
    // mid-flight, at half opacity, and popped out of existence. Rescaling keeps
    // every mark's run a complete 0..1: it starts later and flies a little
    // faster, and it always gets to fade out properly at the far end.
    const start = f.slot * LAUNCH_STAGGER;
    const u = clamp01((skillTravel(f.cluster, n, flow) - start) / (1 - start));
    if (u <= 0.001 || u >= 0.999) {
      f.group.visible = false;
      continue;
    }
    f.group.visible = true;

    const drawn = smoothstep(DRAW_START, DRAW_START + DRAW_WINDOW, u);
    f.line.geometry.setDrawRange(0, Math.floor((f.vertexCount / 2) * drawn) * 2);
    const lit = skillLit(u);
    const fade =
      smoothstep(0.02, 0.14, u) *
      (1 - smoothstep(0.85, 1.0, u)) *
      (0.5 + 0.5 * lit) *
      reveal;

    // The body would occlude the half of the outline that has not been drawn yet,
    // so it only joins once the mark is whole — and then the fill floods in over
    // the next stretch rather than snapping on with it. Must come AFTER `fade`:
    // it reads it, and a `const` used above its declaration is a hard throw that
    // takes the whole render loop down with it.
    if (f.body) {
      f.body.visible = drawn > 0.985;
      if (f.body.visible) {
        const fill = f.body.material as MeshBasicMaterial;
        fill.color.copy(HUE);
        fill.opacity = fade * fMarkFill * smoothstep(0.2, 0.34, u);
      }
    }
    // A mark wears ITS OWN cluster's colour for its whole flight — not the live
    // chapter hue, which would turn a receding Frontend logo into an Infra one
    // partway out. It is that cluster's logo wherever it happens to be.
    HUE_AT.set(skillAccent(f.cluster));
    place(f, u, fade, lit * 0.5, HUE_AT);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  helpers?.dispose();
  for (const k of SHARD_KINDS) k.edges.dispose();
  for (const list of [shards.value, marks.value]) {
    for (const f of list) {
      f.material.dispose();
      if (f.body) (f.body.material as MeshBasicMaterial).dispose();
      // Shards share SHARD_KINDS' geometry (disposed above); only a mark owns
      // the geometry it flies, so only a mark may free it.
      if (f.isMark) {
        f.line.geometry.dispose();
        f.body?.geometry.dispose();
      }
    }
  }
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive v-if="helpers" :object="helpers.group" />
    <primitive v-for="(f, i) in shards" :key="`s${i}`" :object="f.group" />
    <primitive v-for="(f, i) in marks" :key="`m${i}`" :object="f.group" />
  </TresGroup>
</template>
