#!/usr/bin/env node
/**
 * Builds every raster icon from the two SVGs that are the source of truth:
 *
 *   public/favicon.svg  → favicon.ico (16/32/48), icon-192.png, icon-512.png
 *   public/logo.svg     → og.png (1200×630)
 *   the mark            → apple-touch-icon.png (180×180)
 *
 * Run `pnpm build:icons` after either SVG changes. The SVGs are baked outlines
 * (no <text>, no font dependency), so this renders identically on any machine.
 *
 * favicon.ico is hand-encoded: sharp does not write ICO, and an ICO that
 * carries PNG frames (ICONDIR + one ICONDIRENTRY per frame + the PNG bytes)
 * has been valid since Vista, so there is nothing to gain from a BMP encoder.
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const PUBLIC = path.resolve(__dirname, "..", "public");
const FAVICON = path.join(PUBLIC, "favicon.svg");
const LOGO = path.join(PUBLIC, "logo.svg");

const INK_DARK = "#313131";
const INK_LIGHT = "#f4f4f4";

/**
 * The mark alone — the box, the bracket, `$fa` and the cursor — is the top half
 * of logo.svg. Cropping the logo's viewBox above the wordmark is the same art
 * with nothing redrawn, so the mark can never drift from the logo. The crop is
 * the frame plus its stroke (see scripts/../BrandMark.vue for the same numbers
 * scaled to 200 wide). Ink is rewritten to `currentColor` and `color` set on
 * the root so one file serves light and dark tiles.
 */
function markSvg(ink) {
  const logo = fs.readFileSync(LOGO, "utf8");
  const body = logo
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    // the wordmark sits below y=2600; drop those paths so the crop is clean
    .split("\n")
    .filter((line) => !/<path d="M\d+(\.\d+)? (2[7-9]|3[0-2])\d\d/.test(line))
    .join("\n")
    .replace(/#313131/g, "currentColor");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 40 5671 2464" color="${ink}">${body}</svg>`;
}

/** PNG-in-ICO container. `pngs` are {size, buffer} at native size. */
function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buffer } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette colours
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += buffer.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buffer)]);
}

async function png(svg, size) {
  return sharp(svg).resize(size, size).png().toBuffer();
}

async function main() {
  const out = [];
  const write = (name, buf) => {
    fs.writeFileSync(path.join(PUBLIC, name), buf);
    out.push(name);
  };

  // favicon.ico — three frames so every tab strip and shortcut picks a native one
  const frames = [];
  for (const size of [16, 32, 48]) frames.push({ size, buffer: await png(FAVICON, size) });
  write("favicon.ico", encodeIco(frames));

  // manifest icons
  write("icon-192.png", await png(FAVICON, 192));
  write("icon-512.png", await png(FAVICON, 512));

  // apple-touch-icon — square, iOS rounds it. Solid ground because iOS paints
  // black behind transparency, and the full mark because 180px has room for it.
  const markW = Math.round((180 * 48) / 64);
  const mark = await sharp(Buffer.from(markSvg(INK_LIGHT)))
    .resize({ width: markW })
    .png()
    .toBuffer();
  write(
    "apple-touch-icon.png",
    await sharp({ create: { width: 180, height: 180, channels: 4, background: INK_DARK } })
      .composite([{ input: mark, gravity: "centre" }])
      .png()
      .toBuffer()
  );

  // og.png — the whole logo on white, sized so the wordmark reads in a feed
  const logoW = Math.round(1200 * 0.62);
  const logo = await sharp(LOGO).resize({ width: logoW }).png().toBuffer();
  write(
    "og.png",
    await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#ffffff" } })
      .composite([{ input: logo, gravity: "centre" }])
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer()
  );

  for (const name of out) {
    const file = path.join(PUBLIC, name);
    const bytes = fs.statSync(file).size;
    if (name.endsWith(".ico")) {
      console.log(`${name.padEnd(22)} ${frames.map((f) => f.size).join("/")}px  ${bytes} B`);
    } else {
      const { width, height } = await sharp(file).metadata();
      console.log(`${name.padEnd(22)} ${width}×${height}  ${bytes} B`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
