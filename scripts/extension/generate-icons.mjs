#!/usr/bin/env node
// Generates solid-color PNG icons for the browser extension.
// Keeps the repo dependency-free while producing valid 16/48/128 px icons
// that satisfy chrome.notifications' iconUrl requirement.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "extension", "icons");

const PRIMARY = [31, 111, 235]; // #1F6FEB — matches badge working color

function crc32(buf) {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size, [r, g, b]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Draw a filled rounded-ish square: the outer ring stays transparent-like
  // by using a slightly darker shade so the badge/logo is visually distinct.
  const border = 2;
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < size; x += 1) {
      const off = rowStart + 1 + x * 3;
      const onBorder = x < border || x >= size - border || y < border || y >= size - border;
      if (onBorder) {
        raw[off] = Math.max(0, r - 40);
        raw[off + 1] = Math.max(0, g - 40);
        raw[off + 2] = Math.max(0, b - 40);
      } else {
        raw[off] = r;
        raw[off + 1] = g;
        raw[off + 2] = b;
      }
    }
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  const png = makePng(size, PRIMARY);
  const path = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}
