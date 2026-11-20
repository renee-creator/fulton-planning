// The state's food procurement worksheet, F2F-066, filled in for one month. The blank form is forms/F2F-066.xlsx, the
// CDFA Office of Farm to Fork workbook with nothing typed in it. This writes the month, the school's contact lines and one
// row for each purchase line into that workbook and hands back the Excel file, so the office uploads it as it is.
// An Excel file is a zip of XML parts. Only the sheet's own part changes, and every other part is copied as it was.
// Nothing here is written by Claude.

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const FIRST = 27, LAST = 100, ROWS = LAST - FIRST + 1;
const TEXT_COLS = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'];
// the form's own columns, in order, and the field of a row that fills each
const FIELD = { C: 'vendor', D: 'farm', E: 'county', F: 'contact', G: 'before', H: 'connect', I: 'channel', J: 'method', K: 'timing', L: 'type', M: 'name', N: 'variety', O: 'whole', P: 'how', Q: 'ca', R: 'organic', S: 'amount', T: 'unit', U: 'total', V: 'purpose', W: 'use' };
// the styles the form gives a row someone has typed in, and an empty row
const FILLED = { B: 74, I: 76, U: 78 }, EMPTY = { B: 81, U: 82 };

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// the parts of a zip, in the order the file lists them
function unzip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('The blank worksheet could not be read.');
  const count = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('The blank worksheet could not be read.');
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), noteLen = buf.readUInt16LE(p + 32), at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const raw = buf.subarray(start, start + size);
    out.push({ name, data: method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw) });
    p += 46 + nameLen + extraLen + noteLen;
  }
  return out;
}

function zip(parts) {
  const files = [], dir = []; let at = 0;
  for (const f of parts) {
    const name = Buffer.from(f.name, 'utf8'), data = zlib.deflateRawSync(f.data, { level: 9 }), crc = crc32(f.data);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8); head.writeUInt16LE(0, 10); head.writeUInt16LE(0x21, 12);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(f.data.length, 22); head.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(f.data.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(at, 42);
    files.push(head, name, data); dir.push(cd, name); at += 30 + name.length + data.length;
  }
  const dirBuf = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(parts.length, 8); end.writeUInt16LE(parts.length, 10); end.writeUInt32LE(dirBuf.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...files, dirBuf, end]);
}

const xml = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
// Excel counts days from the end of 1899
function serial(day) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || '')); if (!m) return null; return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 864e5); }
const text = (ref, style, v) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
const number = (ref, style, n) => `<c r="${ref}" s="${style}"><v>${n}</v></c>`;
const blank = (ref, style) => `<c r="${ref}" s="${style}"/>`;

function rowXml(r, row, county) {
  const cells = [blank('A' + r, 1)];
  const day = row ? serial(row.date) : null;
  cells.push(day != null ? number('B' + r, FILLED.B, day) : blank('B' + r, EMPTY.B));
  for (const col of TEXT_COLS) {
    const ref = col + r, v = row ? row[FIELD[col]] : '';
    const has = v !== '' && v != null;
    if (!has) { cells.push(blank(ref, EMPTY[col] || 77)); continue; }
    const style = FILLED[col] || 75;
    if ((col === 'S' || col === 'U') && Number.isFinite(Number(v))) cells.push(number(ref, style, Math.round(Number(v) * 100) / 100));
    else cells.push(text(ref, style, clip(v, 600)));
  }
  for (const col of ['X', 'Y', 'Z', 'AA']) cells.push(blank(col + r, 1));
  return `<row r="${r}" ht="15.75" customHeight="1">${cells.join('')}${county}</row>`;
}

let blankForm = null;
function form() { if (!blankForm) blankForm = unzip(fs.readFileSync(path.join(__dirname, 'forms', 'F2F-066.xlsx'))); return blankForm; }

// info is { month: '2026-11', org, person, email, phone, rows: [...] }, each row with a date and the form's fields
function fill(info) {
  const rows = Array.isArray(info.rows) ? info.rows : [];
  if (!/^\d{4}-\d{2}$/.test(String(info.month || ''))) throw new Error('Choose the month.');
  if (rows.length > ROWS) throw new Error('The form holds ' + ROWS + ' lines. Send the month in parts.');
  const parts = form().map(f => ({ name: f.name, data: f.data }));
  const sheet = parts.find(f => f.name === 'xl/worksheets/sheet1.xml');
  let s = sheet.data.toString('utf8');
  const put = (ref, make) => { const m = new RegExp(`<c r="${ref}" s="(\\d+)"[^>]*?(?:/>|>.*?</c>)`).exec(s); if (m) s = s.replace(m[0], make(m[1])); };
  for (const [ref, v] of [['K16', info.org], ['K17', info.person], ['K18', info.email], ['K19', info.phone]]) if (v) put(ref, st => text(ref, st, clip(v, 200)));
  put('J21', st => number('J21', st, serial(info.month + '-01')));
  s = s.replace(/<row r="(\d+)"[^>]*>.*?<\/row>/g, (all, n) => {
    const r = Number(n); if (r < FIRST || r > LAST) return all;
    const county = (new RegExp(`<c r="AB${r}"[^>]*?(?:/>|>.*?</c>)`).exec(all) || [''])[0];
    return rowXml(r, rows[r - FIRST], county);
  });
  sheet.data = Buffer.from(s, 'utf8');
  return zip(parts);
}

module.exports = { fill, unzip, zip, ROWS };
