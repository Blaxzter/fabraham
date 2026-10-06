/**
 * How much smaller than the canvas the lit scene is rendered, 0..1 per axis.
 *
 * `HeroAscii` decides it (see "The scene buffer" there) and writes it here each
 * frame; anything drawn in that pass whose size is given in PIXELS reads it.
 * In practice that is one thing: three sizes a `PointsMaterial` against the
 * canvas, whatever target it is rendering into, so a point drawn into a buffer
 * a third the size comes out three times too big.
 *
 * A plain object for the same reason `heroExit` is: read every frame, and of no
 * interest to Vue (issue #4).
 */
export const sceneBuffer = { scale: 1 };
