// KODA — tiny zero-dependency ZIP writer (STORE method, no compression).
// Enough to package a WooCommerce plugin folder into a valid .zip that
// WordPress accepts, without any npm dependency or a `zip` CLI in the image.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

// CRC-32 (IEEE 802.3), table-driven.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// recursively list files under dir, returning {name (zip path), data}
function collect(dir, base, prefix) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = (prefix ? prefix + '/' : '') + entry.name;
    if (entry.isDirectory()) out.push(...collect(abs, base, rel));
    else if (entry.isFile()) out.push({ name: rel, data: fs.readFileSync(abs) });
  }
  return out;
}

// Build a ZIP buffer from a directory. The archive root is the directory's own
// name (e.g. zipping .../koda-payments yields entries koda-payments/…).
function zipDir(srcDir) {
  const rootName = path.basename(srcDir);
  const files = collect(srcDir, srcDir, rootName).sort((a, b) => a.name < b.name ? -1 : 1);
  const chunks = [];
  const central = [];
  let offset = 0;
  // fixed DOS date/time (2026-01-01 00:00:00) — deterministic, no Date.now dependency
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(0, 8);            // method 0 = store
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);        // compressed size (== size for store)
    local.writeUInt32LE(size, 22);        // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra len
    chunks.push(local, nameBuf, f.data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);     // central dir signature
    cen.writeUInt16LE(20, 4);             // version made by
    cen.writeUInt16LE(20, 6);             // version needed
    cen.writeUInt16LE(0, 8);              // flags
    cen.writeUInt16LE(0, 10);             // method
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(size, 20);
    cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);             // extra len
    cen.writeUInt16LE(0, 32);             // comment len
    cen.writeUInt16LE(0, 34);             // disk number
    cen.writeUInt16LE(0, 36);             // internal attrs
    cen.writeUInt32LE(0, 38);             // external attrs
    cen.writeUInt32LE(offset, 42);        // local header offset
    central.push(Buffer.concat([cen, nameBuf]));

    offset += local.length + nameBuf.length + f.data.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);      // end of central dir signature
  eocd.writeUInt16LE(0, 4);               // disk
  eocd.writeUInt16LE(0, 6);               // disk with central dir
  eocd.writeUInt16LE(files.length, 8);    // entries this disk
  eocd.writeUInt16LE(files.length, 10);   // entries total
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);         // central dir offset
  eocd.writeUInt16LE(0, 20);              // comment len

  return Buffer.concat([...chunks, centralBuf, eocd]);
}

module.exports = { zipDir, crc32 };
