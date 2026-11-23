#!/usr/bin/env node
// Génère les icônes PNG de la PWA (sans dépendance) dans apps/web/public/icons.
// Usage : node scripts/generate-icons.mjs   (les PNG générés sont versionnés)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT = 'apps/web/public/icons';
const BG = [10, 92, 214]; // --accent
const FG = [255, 255, 255];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), y * (size * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Glyphe « relais » en coordonnées normalisées [0,1] : un point d'origine, une flèche vers la droite.
function glyph(u, v) {
  const dot = Math.hypot(u - 0.27, v - 0.5) <= 0.085;
  const shaft = u >= 0.27 && u <= 0.58 && Math.abs(v - 0.5) <= 0.04;
  const t = (u - 0.55) / 0.2; // pointe de flèche : triangle de u=0.55 à 0.75
  const head = t >= 0 && t <= 1 && Math.abs(v - 0.5) <= 0.14 * (1 - t);
  return dot || shaft || head;
}

function icon(size, { maskable }) {
  const radius = maskable ? 0 : 0.22;
  const scale = maskable ? 0.8 : 1; // zone de sécurité des icônes maskables
  const SS = 4;
  return png(size, (x, y) => {
    let bg = 0;
    let fg = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const u = (x + (sx + 0.5) / SS) / size;
        const v = (y + (sy + 0.5) / SS) / size;
        const dx = Math.max(radius - u, u - (1 - radius), 0);
        const dy = Math.max(radius - v, v - (1 - radius), 0);
        if (dx * dx + dy * dy <= radius * radius) bg++;
        if (glyph((u - 0.5) / scale + 0.5, (v - 0.5) / scale + 0.5)) fg++;
      }
    const n = SS * SS;
    const f = fg / n;
    const a = Math.max(bg, fg) / n;
    return [0, 1, 2]
      .map((i) => Math.round(BG[i] * (1 - f) + FG[i] * f))
      .concat(Math.round(a * 255));
  });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'icon-192.png'), icon(192, { maskable: false }));
writeFileSync(join(OUT, 'icon-512.png'), icon(512, { maskable: false }));
writeFileSync(join(OUT, 'icon-maskable-512.png'), icon(512, { maskable: true }));
writeFileSync(join(OUT, 'apple-touch-icon.png'), icon(180, { maskable: true }));
console.log('✓ icônes générées dans', OUT);
