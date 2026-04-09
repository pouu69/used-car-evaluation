/**
 * Brutalist Scoreboard app icon generator.
 *
 * Renders a yellow/black "D" mark at 16/32/48/128 px as PNGs, using
 * pure Node (zlib + manual PNG encoding) so we don't add any image
 * tooling dependency.
 *
 * Run:  node scripts/generate-icons.mjs
 * Writes to: public/icons/icon-{16,32,48,128}.png
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons');

const SIZES = [16, 32, 48, 128];

const YELLOW = [0xe4, 0xff, 0x00, 0xff];
const BLACK = [0x00, 0x00, 0x00, 0xff];

// ── pixel ops ───────────────────────────────────────────────────
function fill(px, size, color) {
  for (let i = 0; i < size * size; i++) {
    px[i * 4 + 0] = color[0];
    px[i * 4 + 1] = color[1];
    px[i * 4 + 2] = color[2];
    px[i * 4 + 3] = color[3];
  }
}

function setRect(px, size, x, y, w, h, color) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const xi = x + i;
      const yj = y + j;
      if (xi < 0 || xi >= size || yj < 0 || yj >= size) continue;
      const off = (yj * size + xi) * 4;
      px[off + 0] = color[0];
      px[off + 1] = color[1];
      px[off + 2] = color[2];
      px[off + 3] = color[3];
    }
  }
}

function drawThickLine(px, size, x1, y1, x2, y2, thickness, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(len * 2));
  const half = Math.floor(thickness / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x1 + dx * t);
    const cy = Math.round(y1 + dy * t);
    setRect(px, size, cx - half, cy - half, thickness, thickness, color);
  }
}

// ── brutalist car + check mark ─────────────────────────────────
function makePixels(size) {
  const px = new Uint8Array(size * size * 4);
  fill(px, size, YELLOW);
  const s = size;

  // Outer thick black border.
  const border = Math.max(1, Math.round(s / 14));
  setRect(px, s, 0, 0, s, border, BLACK);
  setRect(px, s, 0, s - border, s, border, BLACK);
  setRect(px, s, 0, 0, border, s, BLACK);
  setRect(px, s, s - border, 0, border, s, BLACK);

  // Car chassis (lower wide box).
  const bodyX = Math.round(s * 0.14);
  const bodyW = s - bodyX * 2;
  const bodyH = Math.round(s * 0.24);
  const bodyY = Math.round(s * 0.52);
  setRect(px, s, bodyX, bodyY, bodyW, bodyH, BLACK);

  // Cabin (upper narrower box) — stacked on top of chassis.
  const cabinX = Math.round(s * 0.26);
  const cabinW = s - cabinX * 2;
  const cabinY = Math.round(s * 0.28);
  const cabinH = bodyY - cabinY;
  setRect(px, s, cabinX, cabinY, cabinW, cabinH, BLACK);

  // Windshield slashes (yellow notch on the cabin front).
  if (s >= 32) {
    const winY = cabinY + Math.round(cabinH * 0.25);
    const winH = Math.max(1, Math.round(cabinH * 0.35));
    const winPad = Math.max(1, Math.round(s * 0.04));
    const winX = cabinX + winPad;
    const winW = cabinW - winPad * 2;
    setRect(px, s, winX, winY, winW, winH, YELLOW);
    // center pillar divider
    const pillarW = Math.max(1, Math.round(s * 0.035));
    setRect(
      px,
      s,
      cabinX + Math.round(cabinW / 2) - Math.floor(pillarW / 2),
      winY,
      pillarW,
      winH,
      BLACK,
    );
  }

  // Wheels — black squares protruding slightly below the chassis.
  const wheelSize = Math.max(2, Math.round(s * 0.2));
  const wheelY = bodyY + bodyH - Math.round(wheelSize * 0.45);
  const leftWheelX = bodyX + Math.round(s * 0.04);
  const rightWheelX = bodyX + bodyW - wheelSize - Math.round(s * 0.04);
  setRect(px, s, leftWheelX, wheelY, wheelSize, wheelSize, BLACK);
  setRect(px, s, rightWheelX, wheelY, wheelSize, wheelSize, BLACK);
  // yellow wheel hubs (only at 32+ where a hub is readable).
  if (s >= 32) {
    const hub = Math.max(1, Math.round(wheelSize / 3));
    const hubOff = Math.round((wheelSize - hub) / 2);
    setRect(px, s, leftWheelX + hubOff, wheelY + hubOff, hub, hub, YELLOW);
    setRect(px, s, rightWheelX + hubOff, wheelY + hubOff, hub, hub, YELLOW);
  }

  // "Evaluation approved" checkmark — yellow, overlaid on the chassis.
  if (s >= 32) {
    const stroke = Math.max(2, Math.round(s * 0.08));
    // Short diagonal (bottom-left elbow of the check).
    drawThickLine(
      px,
      s,
      Math.round(s * 0.3),
      Math.round(s * 0.62),
      Math.round(s * 0.42),
      Math.round(s * 0.72),
      stroke,
      YELLOW,
    );
    // Long diagonal (up to top-right).
    drawThickLine(
      px,
      s,
      Math.round(s * 0.42),
      Math.round(s * 0.72),
      Math.round(s * 0.72),
      Math.round(s * 0.48),
      stroke,
      YELLOW,
    );
  } else {
    // At 16px, no room for a check inside the chassis — drop a
    // single yellow pixel on the car body as a tiny "ok" marker.
    const dot = Math.max(1, Math.round(s / 16));
    setRect(
      px,
      s,
      Math.round(s * 0.56),
      Math.round(s * 0.62),
      dot,
      dot,
      YELLOW,
    );
  }

  return px;
}

// ── PNG encoder (RGBA, no filter) ──────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(pixels, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: None
    for (let x = 0; x < stride; x++) {
      raw[y * (stride + 1) + 1 + x] = pixels[y * stride + x];
    }
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── main ────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const pixels = makePixels(size);
  const png = encodePNG(pixels, size);
  const file = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
