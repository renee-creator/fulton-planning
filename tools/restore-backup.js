#!/usr/bin/env node
// Writes a TREE backup back into a records folder, one file for each record, the way the server keeps them.
//
//   node tools/restore-backup.js "TREE backup 2026-10-19.json.gz" path/to/records
//
// The folder can be a fresh clone of the records repository. Each file is written at its own path, such as
// plans/abc.json or calendar/bookings/2026-10.json, and the folder can then be committed and pushed.
// Sign-ins, access/accounts.json, are not in a backup, so an existing file there is left as it is.
// Photos are listed in the manifest with their Google Drive ids. The photo files themselves stay in Google Drive.
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
if (!bundle || !bundle.manifest || bundle.manifest.kind !== 'TREE backup' || !bundle.files) {
  console.error('This file is not a TREE backup.');
  process.exit(1);
}
const root = path.resolve(out);
let n = 0;
for (const [rel, doc] of Object.entries(bundle.files)) {
  // a path is always inside the records folder, and never the sign-ins file
  const clean = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  if (!/^[\w.-]+(\/[\w.~-]+)*\.json$/.test(clean.split(path.sep).join('/')) || clean.startsWith('access')) { console.error('Skipped', rel); continue; }
  const file = path.join(root, clean);
  if (!file.startsWith(root + path.sep)) { console.error('Skipped', rel); continue; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // the DRDP descriptors are kept with one space of indent, every other record with two, as the server writes them
  const indent = clean.split(path.sep).join('/') === 'drdp/descriptors.json' ? 1 : 2;
  fs.writeFileSync(file, JSON.stringify(doc, null, indent) + '\n');
  n++;
}
const m = bundle.manifest;
console.log(`Restored ${n} files from the backup of ${m.date} into ${root}`);
console.log('By kind', Object.entries(m.counts || {}).map(([k, v]) => `${k} ${v}`).join(', '));
if (m.photos) console.log(`Photos listed ${m.photos.total}, ${m.photos.inDrive} of them in Google Drive`);
console.log(m.left || '');
