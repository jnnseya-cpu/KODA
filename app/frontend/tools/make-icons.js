// Generate KODA PWA PNG icons from the same geometry as icon.svg — no deps.
// Petrol full-bleed background + centered gold rounded square + checkmark, so it
// works as both a normal and a maskable icon. Anti-aliased via 4x supersampling.
'use strict';
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const INK = [8, 24, 19], GOLD = [232, 161, 31];
const SS = 4; // supersample

// distance from point to segment
function distSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x0) * dx + (py - y0) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = x0 + t * dx, cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function render(size) {
  const S = size * SS, scale = S / 128; // svg viewBox is 128
  const buf = new Uint8Array(S * S * 4);
  const set = (i, c) => { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
  // gold rounded rect in 128-space: x20 y20 w88 h88 r18
  const gx = 20 * scale, gy = 20 * scale, gw = 88 * scale, gh = 88 * scale, gr = 18 * scale;
  const inRound = (x, y) => {
    if (x < gx || x > gx + gw || y < gy || y > gy + gh) return false;
    const rx = Math.min(x - gx, gx + gw - x), ry = Math.min(y - gy, gy + gh - y);
    if (rx >= gr || ry >= gr) return true;
    const cx = x < gx + gr ? gx + gr : gx + gw - gr;
    const cy = y < gy + gr ? gy + gr : gy + gh - gr;
    return Math.hypot(x - cx, y - cy) <= gr;
  };
  // checkmark 44,66 -> 58,80 -> 86,48, width 11
  const hw = (11 * scale) / 2;
  const P = [[44, 66], [58, 80], [86, 48]].map(([x, y]) => [x * scale, y * scale]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let c = INK; // full-bleed background
      if (inRound(x + 0.5, y + 0.5)) c = GOLD;
      const d = Math.min(
        distSeg(x + 0.5, y + 0.5, P[0][0], P[0][1], P[1][0], P[1][1]),
        distSeg(x + 0.5, y + 0.5, P[1][0], P[1][1], P[2][0], P[2][1])
      );
      if (d <= hw) c = INK; // checkmark punched back to ink
      set(i, c);
    }
  }
  // downsample SSxSS -> size
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
        r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
      }
      const n = SS * SS, o = (y * size + x) * 4;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = 255;
    }
  }
  return out;
}

function png(size, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  // add filter byte (0) per row
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '..');
for (const size of [192, 512]) {
  const file = path.join(dir, `icon-${size}.png`);
  fs.writeFileSync(file, png(size, render(size)));
  console.log('wrote', file, fs.statSync(file).size, 'bytes');
}
