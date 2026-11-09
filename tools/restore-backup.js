#!/usr/bin/env node
// Writes a TREE backup back into a records folder, one file for each record, the way the server keeps them.
//
//   node tools/restore-backup.js "TREE backup 2026-10-19.json.gz" path/to/records
//
// The folder can be a fresh clone of the records repository. Each file is written at its own path, such as
// plans/abc.json or calendar/bookings/2026-10.json, and the folder can then be committed and pushed.
// Sign-ins, access/accounts.json, are not in a backup, so an existing file there is left as it is. The director and office
// names, access/roles.json, are restored.
// The pictures in the Policies and Procedures, the Family Handbook and the libraries are kept in their own files, TREE
// pictures YYYY-MM-DD.json.gz, each holding the pictures new or changed since the one before. Restore the records file
// first, then each pictures file into the same folder, oldest first, with the same command.
// Photos are listed in the manifest with their Google Drive ids. The photo files themselves stay in Google Drive, and the
// markers that point TREE to them, photos/<id>~<drive id>~<size>.ref, are written back from the manifest.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('Use it as  node tools/restore-backup.js "TREE backup YYYY-MM-DD.json.gz" path/to/records');
  process.exit(1);
}
let raw = fs.readFileSync(src);
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
const bundle = JSON.parse(raw.toString('utf8'));
if (!bundle || !bundle.manifest || !['TREE backup', 'TREE pictures'].includes(bundle.manifest.kind) || !bundle.files) {
  console.error('This file is not a TREE backup.');
  process.exit(1);
}
const root = path.resolve(out);
let n = 0;
// a path is always inside the records folder, with plain names only, and never the sign-ins file
function fileFor(rel) {
  const rp = String(rel).split(/[\\/]+/).join('/');
  if (!/^[\w.~-]+(\/[\w.~-]+)*$/.test(rp) || /(^|\/)\.\.?(\/|$)/.test(rp)) return null;
  if (rp.startsWith('access/') && rp !== 'access/roles.json') return null;
  const file = path.join(root, rp);
  return file.startsWith(root + path.sep) ? { rp, file } : null;
}
function write(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); n++; }
for (const [rel, doc] of Object.entries(bundle.files)) {
  const at = fileFor(rel);
  if (!at) { console.error('Skipped', rel); continue; }
  const { rp, file } = at;
  // a picture, from the Policies and Procedures, the Family Handbook or a library, comes back as the image it was
  if (doc && typeof doc === 'object' && typeof doc.base64 === 'string' && /\.(png|jpe?g|gif|webp|pdf)$/i.test(rp)) { write(file, Buffer.from(doc.base64, 'base64')); continue; }
  // a record kept as text, the PD library's pieces, the school's wording, the new educator pages, the family pieces and
  // any other Markdown page, is written as it was. Every other record is JSON.
  if (typeof doc === 'string') { write(file, doc); continue; }
  if (!doc || typeof doc !== 'object') { console.error('Skipped', rel); continue; }
  // the DRDP descriptors and the educator records under staff/ are kept with one space of indent, every other record with
  // two, as the server writes them
  const indent = rp === 'drdp/descriptors.json' || rp.startsWith('staff/') || rp.startsWith('family/handbook/') ? 1 : 2;
  write(file, JSON.stringify(doc, null, indent) + '\n');
}
const m = bundle.manifest;
if (m.kind === 'TREE pictures') { console.log(`Restored ${n} pictures from the picture backup of ${m.date} into ${root}`); process.exit(0); }
// the markers for photos kept in Google Drive, written as the server writes them, with the Drive id as the text
let marks = 0;
for (const p of (m.photos && m.photos.list) || []) {
  if (!p || !p.drive) continue;
  const ref = /^photos\/[^/]+\.ref$/.test(String(p.ref || '')) ? p.ref : `photos/${p.id}~${p.drive}~${Number(p.size) || 0}.ref`;
  const at = fileFor(ref);
  if (!at || !/^photos\/[a-z0-9][a-z0-9._-]{0,150}~[A-Za-z0-9_-]{10,}~\d+\.ref$/i.test(at.rp)) { console.error('Skipped photo marker', ref); continue; }
  write(at.file, String(p.drive)); marks++;
}
console.log(`Restored ${n} files from the backup of ${m.date} into ${root}`);
console.log('By kind', Object.entries(m.counts || {}).map(([k, v]) => `${k} ${v}`).join(', '));
if (m.photos) console.log(`Photos listed ${m.photos.total}, ${m.photos.inDrive} of them in Google Drive, ${marks} markers written`);
console.log(m.left || '');
