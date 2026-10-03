// Generates the PWA icons in icons/ with no dependencies: the mark is rendered pixel by pixel with
// analytic anti-aliasing and written as RGBA PNGs through a minimal encoder (node:zlib deflate +
// CRC32). The same geometry is also written out as icons/icon.svg, the editable source of the mark.
//
//   node tools/make-icons.mjs            writes icons/icon-192.png, icon-512.png, maskable-512.png,
//                                        apple-touch-icon.png (180) and icon.svg
//
// The mark: dark emerald square, a centred gold disc (54 % of the width; 40 % on the maskable icon so
// it stays inside the 80 % safe zone), a thin lighter ring floating just outside the disc and a small
// emerald dot at the centre. Two colours, no gradients: it still reads at 29 px.
import { deflateSync, inflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export const COLORS = {
  bg:   [0x0e, 0x28, 0x20], // #0e2820 dark emerald (also the manifest background/theme colour)
  gold: [0xe3, 0xc8, 0x86], // #e3c886 gold disc
  ring: [0xf2, 0xe0, 0xb3], // #f2e0b3 lighter gold ring
  dot:  [0x0e, 0x28, 0x20], // #0e2820 inner dot (same emerald as the background)
};

// Geometry as fractions of the disc radius R, where R = markFraction * size / 2.
export const MARK = {
  ringInner: 1.20, // ring starts 0.20 R outside the disc edge
  ringOuter: 1.28, // 0.08 R thick
  dot: 0.18,       // inner dot radius
};

export const ICONS = [
  { file: 'icon-192.png',        size: 192, mark: 0.54 },
  { file: 'icon-512.png',        size: 512, mark: 0.54 },
  { file: 'maskable-512.png',    size: 512, mark: 0.40 }, // maskable: full-bleed background, smaller mark
  { file: 'apple-touch-icon.png', size: 180, mark: 0.54 },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Coverage of a disc of radius r over a pixel whose centre is d away from the disc centre: a 1 px
// soft edge, which is what a crisp anti-aliased circle needs at these sizes.
const disc = (d, r) => clamp01(r - d + 0.5);
const mix = (a, b, t) => a + (b - a) * t;

// Renders one icon into a tightly packed RGBA buffer (row-major, 4 bytes per pixel, opaque).
export function renderIcon(size, markFraction) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const R = (markFraction * size) / 2;
  const ri = R * MARK.ringInner, ro = R * MARK.ringOuter, rd = R * MARK.dot;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const covDisc = disc(d, R);
      const covRing = disc(d, ro) - disc(d, ri);
      const covDot = disc(d, rd);
      const o = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) {
        let v = COLORS.bg[k];
        v = mix(v, COLORS.gold[k], covDisc);
        v = mix(v, COLORS.ring[k], covRing);
        v = mix(v, COLORS.dot[k], covDot);
        px[o + k] = Math.round(v);
      }
      px[o + 3] = 255;
    }
  }
  return px;
}

// ── Minimal PNG encoder ─────────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
export function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// rgba: width*height*4 bytes. Writes an 8-bit RGBA (colour type 6), non-interlaced PNG with filter 0 on every row.
export function encodePNG(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new Error('encodePNG: buffer size does not match ' + width + 'x' + height);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Reads back the subset of PNG this file writes (used by the tests to prove the files open).
export function decodePNG(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG: bad signature');
  let off = 8; const chunks = []; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    const crc = buf.readUInt32BE(off + 8 + len);
    if (crc !== crc32(buf.subarray(off + 4, off + 8 + len))) throw new Error('bad CRC in ' + type);
    chunks.push(type);
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (chunks[0] !== 'IHDR') throw new Error('IHDR must be the first chunk');
  if (chunks[chunks.length - 1] !== 'IEND') throw new Error('IEND missing');
  const ihdrOff = 16;
  const width = buf.readUInt32BE(ihdrOff), height = buf.readUInt32BE(ihdrOff + 4);
  const bitDepth = buf[ihdrOff + 8], colorType = buf[ihdrOff + 9], interlace = buf[ihdrOff + 12];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  if (raw.length !== (stride + 1) * height) throw new Error('decoded size mismatch');
  const rgba = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    if (raw[y * (stride + 1)] !== 0) throw new Error('unexpected filter type');
    raw.copy(rgba, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  }
  return { width, height, bitDepth, colorType, interlace, chunks, rgba,
    pixel(x, y) { const o = (y * width + x) * 4; return [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]]; } };
}

// ── SVG source of the same mark ─────────────────────────────────────────────────────────────────
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
export function iconSVG(markFraction = 0.54) {
  const S = 100, R = (markFraction * S) / 2;
  const f = (v) => +v.toFixed(2);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">`,
    `  <!-- Protocol OS mark. Source for icons/*.png (regenerate with: node tools/make-icons.mjs) -->`,
    `  <rect width="${S}" height="${S}" fill="${hex(COLORS.bg)}"/>`,
    `  <circle cx="${S / 2}" cy="${S / 2}" r="${f(R * (MARK.ringInner + MARK.ringOuter) / 2)}" fill="none" stroke="${hex(COLORS.ring)}" stroke-width="${f(R * (MARK.ringOuter - MARK.ringInner))}"/>`,
    `  <circle cx="${S / 2}" cy="${S / 2}" r="${f(R)}" fill="${hex(COLORS.gold)}"/>`,
    `  <circle cx="${S / 2}" cy="${S / 2}" r="${f(R * MARK.dot)}" fill="${hex(COLORS.dot)}"/>`,
    `</svg>`,
    '',
  ].join('\n');
}

export function writeIcons(outDir) {
  mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const icon of ICONS) {
    const png = encodePNG(icon.size, icon.size, renderIcon(icon.size, icon.mark));
    writeFileSync(join(outDir, icon.file), png);
    written.push({ file: icon.file, bytes: png.length });
  }
  writeFileSync(join(outDir, 'icon.svg'), iconSVG());
  written.push({ file: 'icon.svg' });
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const w of writeIcons(join(root, 'icons'))) console.log(`wrote icons/${w.file}${w.bytes ? ` (${w.bytes} bytes)` : ''}`);
}
