/**
 * What comes out from behind each card on hover.
 *
 * The mechanic is one trick: `.emergents` sits BELOW `.card` in the stacking
 * order, its items start tucked behind the card's top edge, and on hover they
 * translate up past it. Whatever is still overlapping the card stays hidden, so
 * they read as emerging rather than fading in.
 *
 * Each project picks a set by name; the set is what only THAT project would
 * have — cubes for the CFOP trainer, staff notes for the hymnal, bezier anchors
 * for the vectorizer.
 */
export interface Emergent {
  /** Inline markup for the item. */
  h: string;
  /** Resting x, as a percentage of the card width. */
  lx: string;
  tx: string;
  ty: string;
  tr: string;
  /** Stagger. */
  d: string;
}

const CUBE_COLORS = ["#f4f4f0", "#ffd400", "#e0223a", "#ff7a15", "#1769ff", "#00b44a"];

/**
 * A real CSS-3D cube: six faces, nine stickers each, scrambled deterministically
 * so it reads as a cube mid-F2L rather than a colour soup or a solved toy.
 *
 * Exported because the home page's projects teaser grows the CFOP trainer as a
 * husk with a cube inside it, and a second implementation of "a scrambled cube"
 * is exactly the kind of thing that quietly drifts into two different cubes.
 */
export function cube(size: number, seed: number): string {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const faces = [
    "translateZ(H)",
    "rotateY(180deg) translateZ(H)",
    "rotateY(90deg) translateZ(H)",
    "rotateY(-90deg) translateZ(H)",
    "rotateX(90deg) translateZ(H)",
    "rotateX(-90deg) translateZ(H)",
  ];
  const half = `${size / 2}px`;
  let html = '<div class="cube-inner">';
  faces.forEach((t, fi) => {
    html += `<div class="face" style="transform:${t.replace("H", half)}">`;
    for (let i = 0; i < 9; i++) {
      const c = i === 4 || rnd() > 0.32 ? CUBE_COLORS[fi] : CUBE_COLORS[Math.floor(rnd() * 6)];
      html += `<i style="background:${c}"></i>`;
    }
    html += "</div>";
  });
  return `${html}</div>`;
}

const chip = (t: string, accent = false) =>
  `<div class="chip${accent ? " accent" : ""}">${t}</div>`;
const frame = (w: number, h: number) => `<div class="frame" style="width:${w}px;height:${h}px"></div>`;
const slot = (w: number, h: number, style = "") =>
  `<div class="slot" style="width:${w}px;height:${h}px;${style}"></div>`;

export const EMERGENTS: Record<string, Emergent[]> = {
  cubes: [
    { h: `<div class="cube" style="--cs:34px">${cube(34, 7)}</div>`, lx: "24%", tx: "-14px", ty: "-78px", tr: "0deg", d: "0s" },
    { h: `<div class="cube" style="--cs:46px">${cube(46, 23)}</div>`, lx: "50%", tx: "0px", ty: "-104px", tr: "0deg", d: ".07s" },
    { h: `<div class="cube" style="--cs:30px">${cube(30, 91)}</div>`, lx: "76%", tx: "12px", ty: "-72px", tr: "0deg", d: ".14s" },
  ],
  sessions: [
    { h: frame(46, 30), lx: "24%", tx: "-14px", ty: "-70px", tr: "-7deg", d: "0s" },
    { h: chip("● running", true), lx: "50%", tx: "0px", ty: "-102px", tr: "2deg", d: ".08s" },
    { h: frame(46, 30), lx: "74%", tx: "14px", ty: "-68px", tr: "8deg", d: ".16s" },
    { h: chip("needs you"), lx: "62%", tx: "30px", ty: "-40px", tr: "5deg", d: ".24s" },
  ],
  files: [
    { h: frame(30, 38), lx: "24%", tx: "-12px", ty: "-70px", tr: "-10deg", d: "0s" },
    { h: chip("⇄ synced", true), lx: "50%", tx: "0px", ty: "-100px", tr: "0deg", d: ".09s" },
    { h: frame(30, 38), lx: "76%", tx: "12px", ty: "-70px", tr: "10deg", d: ".17s" },
  ],
  vectors: [
    {
      h: '<div class="blk" style="width:34px;height:34px;background:repeating-conic-gradient(#2a3340 0 25%, #131b25 0 50%) 0 0/8px 8px"></div>',
      lx: "24%", tx: "-14px", ty: "-66px", tr: "-9deg", d: "0s",
    },
    {
      h: '<svg width="52" height="46" viewBox="0 0 52 46" aria-hidden="true"><path d="M6 38 C 10 8, 42 8, 46 38" fill="none" stroke="#00ff9c" stroke-width="2"/><line x1="6" y1="38" x2="16" y2="16" stroke="#3a4a5a" stroke-width="1"/><line x1="46" y1="38" x2="36" y2="16" stroke="#3a4a5a" stroke-width="1"/><rect x="2" y="34" width="8" height="8" fill="#0d1218" stroke="#00ff9c" stroke-width="1.5"/><rect x="42" y="34" width="8" height="8" fill="#0d1218" stroke="#00ff9c" stroke-width="1.5"/><circle cx="16" cy="16" r="3" fill="#3a4a5a"/><circle cx="36" cy="16" r="3" fill="#3a4a5a"/></svg>',
      lx: "52%", tx: "0px", ty: "-104px", tr: "0deg", d: ".09s",
    },
    { h: chip(".svg", true), lx: "78%", tx: "16px", ty: "-62px", tr: "8deg", d: ".18s" },
  ],
  tags: [
    { h: chip("release", true), lx: "28%", tx: "-14px", ty: "-66px", tr: "-8deg", d: "0s" },
    { h: chip("build"), lx: "50%", tx: "0px", ty: "-94px", tr: "3deg", d: ".08s" },
    { h: chip("refactor"), lx: "72%", tx: "16px", ty: "-64px", tr: "9deg", d: ".16s" },
    { h: chip("feat"), lx: "60%", tx: "26px", ty: "-36px", tr: "5deg", d: ".22s" },
  ],
  notes: [
    { h: '<div class="note" style="color:#ffd479">♪</div>', lx: "24%", tx: "-12px", ty: "-72px", tr: "-12deg", d: "0s" },
    { h: '<div class="note" style="color:#ffd479">♫</div>', lx: "44%", tx: "0px", ty: "-102px", tr: "6deg", d: ".09s" },
    { h: '<div class="note" style="color:#ffd479">♩</div>', lx: "62%", tx: "8px", ty: "-78px", tr: "-5deg", d: ".17s" },
    { h: chip("Lied 347"), lx: "80%", tx: "18px", ty: "-50px", tr: "9deg", d: ".24s" },
  ],
  tests: [
    { h: chip("✓ offline"), lx: "26%", tx: "-16px", ty: "-64px", tr: "-8deg", d: "0s" },
    { h: chip("✓ 887 passing", true), lx: "52%", tx: "0px", ty: "-98px", tr: "2deg", d: ".08s" },
    { h: chip("✓ a11y"), lx: "78%", tx: "16px", ty: "-64px", tr: "9deg", d: ".16s" },
  ],
  ascii: [
    { h: '<div class="glyph" style="width:26px;height:26px;font-size:15px;color:#9ad1ff">@</div>', lx: "22%", tx: "-10px", ty: "-64px", tr: "-10deg", d: "0s" },
    { h: '<div class="glyph" style="width:30px;height:30px;font-size:17px;color:#00ff9c">#</div>', lx: "40%", tx: "0px", ty: "-96px", tr: "4deg", d: ".07s" },
    { h: '<div class="glyph" style="width:24px;height:24px;font-size:14px;color:#c4a0ff">%</div>', lx: "58%", tx: "6px", ty: "-72px", tr: "-6deg", d: ".14s" },
    { h: '<div class="glyph" style="width:28px;height:28px;font-size:16px;color:#ffb454">&amp;</div>', lx: "76%", tx: "16px", ty: "-54px", tr: "11deg", d: ".21s" },
  ],
  archive: [
    { h: slot(30, 30), lx: "26%", tx: "-14px", ty: "-66px", tr: "-9deg", d: "0s" },
    { h: slot(36, 36, "border-color:#7fe7ff;background:#0c2129"), lx: "52%", tx: "0px", ty: "-100px", tr: "2deg", d: ".08s" },
    { h: slot(30, 30), lx: "78%", tx: "14px", ty: "-66px", tr: "9deg", d: ".16s" },
    { h: chip("similar × 3", true), lx: "52%", tx: "36px", ty: "-128px", tr: "3deg", d: ".24s" },
  ],
  clips: [
    { h: frame(52, 32), lx: "28%", tx: "-16px", ty: "-66px", tr: "-8deg", d: "0s" },
    { h: frame(52, 32), lx: "50%", tx: "0px", ty: "-96px", tr: "2deg", d: ".08s" },
    { h: frame(52, 32), lx: "72%", tx: "16px", ty: "-66px", tr: "9deg", d: ".16s" },
    { h: chip("↺ last 60s", true), lx: "50%", tx: "0px", ty: "-124px", tr: "0deg", d: ".24s" },
  ],
  rooms: [
    { h: slot(38, 22), lx: "26%", tx: "-14px", ty: "-60px", tr: "-7deg", d: "0s" },
    { h: slot(38, 22, "border-color:#7fe7ff;background:#0c2129"), lx: "48%", tx: "0px", ty: "-88px", tr: "2deg", d: ".08s" },
    { h: slot(38, 22), lx: "70%", tx: "14px", ty: "-60px", tr: "8deg", d: ".16s" },
    { h: chip("booked", true), lx: "48%", tx: "34px", ty: "-112px", tr: "4deg", d: ".24s" },
  ],
  paper: [
    { h: frame(44, 58), lx: "30%", tx: "-14px", ty: "-86px", tr: "-9deg", d: "0s" },
    { h: frame(44, 58), lx: "50%", tx: "0px", ty: "-98px", tr: "1deg", d: ".07s" },
    { h: chip("cited 2×", true), lx: "74%", tx: "18px", ty: "-64px", tr: "8deg", d: ".15s" },
  ],
  blocks: [
    { h: '<div class="blk" style="width:44px;height:11px;background:#b4763a"></div>', lx: "40%", tx: "-4px", ty: "-46px", tr: "0deg", d: "0s" },
    { h: '<div class="blk" style="width:11px;height:36px;background:#7fd8e8"></div>', lx: "30%", tx: "0px", ty: "-82px", tr: "0deg", d: ".07s" },
    { h: '<div class="blk" style="width:11px;height:36px;background:#7fd8e8"></div>', lx: "50%", tx: "0px", ty: "-82px", tr: "0deg", d: ".07s" },
    { h: '<div class="blk" style="width:52px;height:12px;background:#9aa3ad"></div>', lx: "40%", tx: "-2px", ty: "-96px", tr: "0deg", d: ".16s" },
    { h: '<div class="blk" style="width:13px;height:13px;border-radius:50%;background:#e0223a"></div>', lx: "40%", tx: "-2px", ty: "-116px", tr: "0deg", d: ".24s" },
    { h: chip("stable ✓"), lx: "76%", tx: "16px", ty: "-58px", tr: "7deg", d: ".3s" },
  ],
  event: [
    { h: chip("Fr"), lx: "24%", tx: "-14px", ty: "-62px", tr: "-8deg", d: "0s" },
    { h: chip("Sa · Kirchentag", true), lx: "52%", tx: "0px", ty: "-96px", tr: "2deg", d: ".08s" },
    { h: chip("So"), lx: "80%", tx: "16px", ty: "-62px", tr: "9deg", d: ".16s" },
  ],
  dna: [
    { h: chip("10110100"), lx: "26%", tx: "-20px", ty: "-64px", tr: "-8deg", d: "0s" },
    { h: chip("fitness 0.91", true), lx: "52%", tx: "0px", ty: "-92px", tr: "2deg", d: ".08s" },
    { h: chip("01101011"), lx: "78%", tx: "18px", ty: "-62px", tr: "9deg", d: ".16s" },
    { h: chip("hall of fame"), lx: "64%", tx: "30px", ty: "-34px", tr: "5deg", d: ".22s" },
  ],
};

/** The small ornament in each card header's top-right corner, one per skin. */
export const MARKS: Record<string, string> = {
  cubes:
    '<div class="mk-grid3">' +
    ["#00b44a", "#00b44a", "#ffd400", "#00b44a", "#00b44a", "#e0223a", "#1769ff", "#ffd400", "#00b44a"]
      .map((c) => `<i style="background:${c}"></i>`)
      .join("") +
    "</div>",
  cockpit:
    '<div class="mk-sessions"><span><i></i><b></b></span><span><i></i><b></b></span>' +
    '<span class="idle"><i></i><b></b></span></div>',
  hatch: '<div class="mk-split"><i></i><b>⇄</b><i></i></div>',
  alpha:
    '<svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">' +
    '<path d="M4 25 C 8 5, 26 5, 30 25" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<rect x="1" y="22" width="6" height="6" fill="#05070a" stroke="currentColor" stroke-width="1.3"/>' +
    '<rect x="27" y="22" width="6" height="6" fill="#05070a" stroke="currentColor" stroke-width="1.3"/>' +
    '<circle cx="11" cy="10" r="2" fill="currentColor" opacity=".6"/>' +
    '<circle cx="23" cy="10" r="2" fill="currentColor" opacity=".6"/></svg>',
  rail: '<div class="mk-tag">v0.20.1</div>',
  staff: '<div class="mk-note">♪</div>',
  tests: '<div class="mk-check">✓</div>',
  ascii: '<div class="mk-ascii">@#<br>%&amp;</div>',
  archive: '<div class="mk-tiles"><i class="on"></i><i></i><i></i><i class="on"></i></div>',
  scrub: '<div class="mk-scrub"><i></i></div>',
  week: '<div class="mk-week"><i></i><i class="on"></i><i></i><i></i><i></i><i class="on"></i></div>',
  desk: '<div class="mk-rows"><i></i><i></i><i></i><i></i></div>',
  paper: '<div class="mk-paper"></div>',
  lattice:
    '<svg width="34" height="32" viewBox="0 0 34 32" aria-hidden="true">' +
    '<line x1="6" y1="7" x2="18" y2="16" stroke="currentColor" stroke-width="0.9" opacity=".5"/>' +
    '<line x1="18" y1="16" x2="28" y2="6" stroke="currentColor" stroke-width="0.9" opacity=".5"/>' +
    '<line x1="18" y1="16" x2="12" y2="27" stroke="currentColor" stroke-width="0.9" opacity=".5"/>' +
    '<line x1="18" y1="16" x2="29" y2="24" stroke="currentColor" stroke-width="0.9" opacity=".5"/>' +
    '<circle cx="6" cy="7" r="2" fill="currentColor"/><circle cx="28" cy="6" r="2" fill="currentColor"/>' +
    '<circle cx="18" cy="16" r="3" fill="currentColor"/><circle cx="12" cy="27" r="2" fill="currentColor"/>' +
    '<circle cx="29" cy="24" r="2" fill="currentColor"/></svg>',
  event: '<div class="mk-date"><u>KITAWO</u><b>26</b></div>',
  genome:
    '<div class="mk-bits">' +
    ["1011010", "0110101", "1101001"]
      .map((r) => `<span>${[...r].map((b) => `<i class="${b === "1" ? "on" : ""}"></i>`).join("")}</span>`)
      .join("") +
    "</div>",
};
