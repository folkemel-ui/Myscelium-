// Draws the app icon – the pink mother mushroom on glowing coloured threads, on deep violet – and
// writes it as PNG files into public/ (for the Home Screen and the browser tab).
// Run with: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
const SAMPLES = 4; // per pixel, each way, for smooth edges

const GLOW = [[255, 79, 216], [79, 243, 255], [182, 255, 79], [255, 184, 79], [157, 107, 255]];

// Threads from the mushroom's foot out to the edges, as polylines in 0..1 coordinates.
const THREADS = [
  [[0.5, 0.8], [0.36, 0.86], [0.2, 0.84], [0.04, 0.92]],
  [[0.5, 0.8], [0.64, 0.87], [0.8, 0.83], [0.97, 0.9]],
  [[0.5, 0.8], [0.42, 0.9], [0.4, 1.02]],
  [[0.5, 0.8], [0.58, 0.92], [0.66, 1.02]],
  [[0.47, 0.79], [0.3, 0.74], [0.14, 0.7], [0.0, 0.74]],
];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const over = (dst, src, a) => dst.map((v, k) => v * (1 - a) + src[k] * a);

// The colour at a point of the icon (0..1 each way).
function shade(x, y) {
  // Deep violet, lighter in the middle.
  const r0 = Math.hypot(x - 0.5, y - 0.55);
  let c = over([18, 10, 28], [52, 24, 78], Math.max(0, 1 - r0 * 1.6));
  // Glowing threads.
  THREADS.forEach((line, k) => {
    let d = Infinity;
    for (let s = 0; s < line.length - 1; s++) d = Math.min(d, segDist(x, y, ...line[s], ...line[s + 1]));
    const glow = Math.max(0, 1 - d / 0.05) ** 2 * 0.55;
    const core = d < 0.012 ? 1 : 0;
    c = over(c, GLOW[k], Math.max(glow, core * 0.95));
  });
  // A pink glow behind the cap.
  c = over(c, [255, 61, 127], Math.max(0, 1 - Math.hypot(x - 0.5, y - 0.45) / 0.42) ** 2 * 0.45);
  // The stem.
  if (Math.abs(x - 0.5) < 0.075 && y > 0.5 && y < 0.8) c = over(c, x > 0.5 ? [222, 208, 178] : [243, 230, 200], 1);
  // The cap: the top half of an oval, its underside a gentle curve; darker at the rim.
  const capY = 0.52;
  const ex = (x - 0.5) / 0.32;
  const ey = (y - capY) / 0.27;
  const under = capY + 0.05 * (1 - ex * ex);
  if (ex * ex + ey * ey < 1 && y < under) {
    const rim = Math.max(0, Math.sqrt(ex * ex + ey * ey) - 0.82) / 0.18;
    c = over([255, 61, 127], [176, 30, 84], rim);
    // A shine on the top left.
    if (Math.hypot((x - 0.4) / 0.1, (y - 0.36) / 0.045) < 1) c = over(c, [255, 255, 255], 0.35);
    // White spots.
    for (const [sx, sy, sr] of [[0.36, 0.42, 0.04], [0.55, 0.33, 0.045], [0.66, 0.44, 0.035], [0.47, 0.47, 0.03], [0.27, 0.48, 0.025]]) {
      if (Math.hypot(x - sx, y - sy) < sr) c = [255, 255, 255];
    }
  }
  return c;
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // no filter
    for (let px = 0; px < size; px++) {
      let sum = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = shade((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size);
          sum = sum.map((v, k) => v + c[k]);
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(sum[k] / (SAMPLES * SAMPLES));
      raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

mkdirSync('public', { recursive: true });
for (const [file, size] of Object.entries(SIZES)) {
  writeFileSync(`public/${file}`, png(size));
  console.log(`public/${file}: ${size}×${size}`);
}
