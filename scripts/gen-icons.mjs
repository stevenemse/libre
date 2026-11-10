// Génère les icônes PWA : point citron centré sur carré arrondi encre.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const INK = [11, 15, 21];
const LIME = [168, 255, 0];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function insideRoundedRect(x, y, size, radius) {
  const r = radius;
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const dotRadius = size * 0.2;
  const center = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // échantillonnage 3×3 pour lisser les bords
      let square = 0;
      let dot = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const px0 = x + (sx + 0.5) / 3;
          const py0 = y + (sy + 0.5) / 3;
          if (insideRoundedRect(px0, py0, size, radius)) square++;
          const dx = px0 - center;
          const dy = py0 - center;
          if (dx * dx + dy * dy <= dotRadius * dotRadius) dot++;
        }
      }
      const s = square / 9;
      const d = dot / 9;
      if (s === 0) continue;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round((INK[c] * (1 - d) + LIME[c] * d) * s + 0 * (1 - s));
      }
      px[i + 3] = Math.round(255 * s);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
  ['public/favicon.png', 64],
]) {
  writeFileSync(name, render(size));
  console.log(`${name} (${size}px)`);
}
