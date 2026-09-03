/**
 * Generates the monochrome PWA icon PNGs from the same geometry as public/favicon.svg.
 * Pure-TS rasteriser + PNG encoder so the build needs no native image dependency.
 *
 *   bun run scripts/gen-icons.ts
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

type RGBA = [number, number, number, number];

const BG: RGBA = [10, 10, 10, 255];
const FG: RGBA = [250, 250, 250, 255];

/** Geometry in the 32x32 viewBox of favicon.svg. */
const VIEW = 32;
const BARS = [
  { x: 7, y: 8, w: 4.5, h: 16, r: 1.4 },
  { x: 13.75, y: 8, w: 4.5, h: 10, r: 1.4 },
  { x: 20.5, y: 8, w: 4.5, h: 13, r: 1.4 },
];

/** Signed distance to a rounded rectangle, negative inside. */
function sdRoundRect(px: number, py: number, x: number, y: number, w: number, h: number, r: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

/** Anti-aliased coverage from a signed distance, in pixels of the target raster. */
function coverage(d: number, scale: number) {
  const px = d * scale;
  return Math.min(1, Math.max(0, 0.5 - px));
}

function render(size: number, maskable: boolean): Buffer {
  const scale = size / VIEW;
  // Maskable icons need their content inside the 80% safe zone.
  const inset = maskable ? VIEW * 0.1 : 0;
  const contentScale = maskable ? 0.8 : 1;
  const raw = Buffer.alloc(size * (size * 4 + 1));

  for (let py = 0; py < size; py++) {
    const rowStart = py * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / scale;
      const v = (py + 0.5) / scale;
      // Background plate: rounded on the plain icon, full-bleed when maskable.
      const plate = maskable ? -1 : sdRoundRect(u, v, 0, 0, VIEW, VIEW, 7);
      let color: RGBA = mix([0, 0, 0, 0], BG, coverage(plate, scale));

      const cu = (u - inset) / contentScale;
      const cv = (v - inset) / contentScale;
      for (const b of BARS) {
        const d = sdRoundRect(cu, cv, b.x, b.y, b.w, b.h, b.r);
        const c = coverage(d, scale * contentScale);
        if (c > 0) color = mix(color, FG, c);
      }

      const o = rowStart + 1 + px * 4;
      raw[o] = color[0];
      raw[o + 1] = color[1];
      raw[o + 2] = color[2];
      raw[o + 3] = color[3];
    }
  }
  return encodePng(size, size, raw);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!)! & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, raw: Buffer) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = join(import.meta.dir, "..", "public");
const targets: Array<[string, number, boolean]> = [
  ["pwa-192x192.png", 192, false],
  ["pwa-512x512.png", 512, false],
  ["maskable-512x512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];
for (const [name, size, maskable] of targets) {
  const png = render(size, maskable);
  writeFileSync(join(outDir, name), png);
  console.log(`${name} ${size}x${size} ${png.length}B`);
}
