'use strict';
// The print kit's two layouts, the place sheet on one centred letter page and the children's height sheets at half
// letter, two to a page with the photo first. Drawn against a stand-in for the PDF library that records each call.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function kit() {
  class Doc { constructor(o) { this.o = o; this.calls = []; this.pages = 1; this.size = 12; }
    addFileToVFS() {} addFont() {} setFont() {} setFontSize(n) { this.size = n; } setTextColor() {} setDrawColor() {} setLineWidth() {} setCharSpace() {} setLineDashPattern() {}
    line(...a) { this.calls.push(['line', ...a]); } addPage(f, o) { this.pages++; this.calls.push(['page', f, o]); }
    // about half a point of width for each point of size, per character, so wrapping is near the real thing
    splitTextToSize(t, w) { const per = Math.max(1, Math.floor(w / (this.size * .5))); const out = []; let line = ''; for (const word of String(t).split(/\s+/)) { if ((line + ' ' + word).trim().length > per && line) { out.push(line); line = word; } else line = (line + ' ' + word).trim(); } if (line) out.push(line); return out; }
    text(t, x, y, o) { this.calls.push(['text', t, Math.round(x), Math.round(y), (o || {}).align || '', this.size, this.pages]); }
    addImage(u, k, x, y, w, h) { this.calls.push(['img', Math.round(x), Math.round(y), Math.round(w), Math.round(h), this.pages]); } }
  const win = { jspdf: { jsPDF: Doc } };
  const doc = { querySelector: () => ({}), createElement: () => ({ addEventListener() {} }), head: { appendChild() {} } };
  new Function('window', 'document', 'fetch', read('print-kit.js'))(win, doc, () => Promise.reject(new Error('no net')));
  return win.TREE_KIT;
}
const PH = { url: 'data:image/jpeg;base64,xx', w: 1600, h: 1200 };

test('the existing kit signature is intact and the two layouts are added', () => {
  const K = kit();
  for (const k of ['LIB', 'SIZES', 'PF', 'loadScript', 'fonts', 'pdfFonts', 'wordFonts', 'pdf', 'word', 'wordFile', 'wordBlob', 'pdfLib', 'pdfjs', 'readPdf', 'pageImage', 'readDocx', 'placeSheet', 'childHeight']) assert.strictEqual(typeof K[k], k === 'LIB' || k === 'SIZES' || k === 'PF' ? 'object' : 'function', k);
  const src = read('print-kit.js');
  assert.match(src, /TREE_KIT\.placeSheet\(input\)/); assert.match(src, /TREE_KIT\.childHeight\(input\)/);
  assert.doesNotMatch(src, /[—–]|teacher|Claude/);
});

test('placeSheet draws one centred letter page with the three groups and their photos', async () => {
  const K = kit();
  const d = await K.placeSheet({ title: 'Our place this week', sub: 'Week of November 2, 2026', school: true, foot: 'Fulton Community School', groups: [
    { heading: 'What is growing', lines: ['Fava beans in the north bed', 'Calendula along the fence'], photo: PH },
    { heading: 'Our animals this week', lines: ['The goats moved to the orchard'] },
    { heading: 'This week\'s bin', lines: ['Delicata squash, Bernier Farms, Healdsburg', 'Fuji apples, Devoto Gardens, Sebastopol'], photo: PH }] });
  assert.deepStrictEqual(d.o, { unit: 'pt', format: [612, 792] });
  assert.strictEqual(d.pages, 1, 'one page');
  const texts = d.calls.filter(c => c[0] === 'text');
  const title = texts.find(c => c[1] === 'Our place this week'); assert.ok(title && title[4] === 'center' && title[2] === 306, 'the title is centred');
  assert.ok(texts.some(c => c[1] === 'FULTON COMMUNITY SCHOOL & FARM'));
  for (const h of ['What is growing', 'Our animals this week', 'This week\'s bin']) assert.ok(texts.some(c => c[1] === h), h);
  assert.ok(texts.some(c => /Fava beans/.test(c[1])) && texts.some(c => /Delicata/.test(c[1])));
  assert.strictEqual(d.calls.filter(c => c[0] === 'img').length, 2, 'a photo for each group that gave one');
  const low = Math.max(...texts.map(c => c[3])); assert.ok(low <= 792 - 40, 'nothing runs off the page');
  // every group's words sit under their own heading, in order
  const ys = ['What is growing', 'Our animals this week', 'This week\'s bin'].map(h => texts.find(c => c[1] === h)[3]);
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2]);
});

test('childHeight sets two half-letter sheets to a landscape letter page, photo first and the words large', async () => {
  const K = kit();
  const d = await K.childHeight({ title: 'How tall am I?', foot: 'Fulton Community School', sheets: [
    { photo: PH, words: 'I am as tall as the sunflower.', name: 'Wren', line: 'November 2, 2026, North class' },
    { photo: PH, words: 'Taller than the goat, smaller than the gate.', name: 'Ash' },
    { words: 'My head touches the second shelf now.' }] });
  assert.deepStrictEqual(d.o, { unit: 'pt', orientation: 'landscape', format: [612, 792] });
  assert.strictEqual(d.pages, 2, 'three sheets take two pages');
  const imgs = d.calls.filter(c => c[0] === 'img'); assert.strictEqual(imgs.length, 2);
  assert.ok(imgs[0][1] < 396 && imgs[1][1] >= 396, 'one sheet on each half of the page');
  const w1 = d.calls.find(c => c[0] === 'text' && /sunflower/.test(c[1]));
  assert.ok(w1 && w1[5] >= 18 && w1[4] === 'center', 'the words are set large and centred');
  assert.ok(imgs[0][2] + imgs[0][4] <= w1[3], 'the photo sits above the words');
  assert.ok(imgs[0][4] >= 120, 'the photo takes most of the sheet');
  assert.ok(d.calls.some(c => c[0] === 'text' && c[1] === 'Wren') && d.calls.some(c => c[0] === 'text' && /North class/.test(c[1])));
  // the cut line down the middle of each page
  assert.strictEqual(d.calls.filter(c => c[0] === 'line' && c[1] === 396 && c[3] === 396).length, 2);
  const p2 = d.calls.find(c => c[0] === 'text' && /second shelf/.test(c[1])); assert.strictEqual(p2[6], 2);
});
