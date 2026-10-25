'use strict';
// Session 11, one builder for every print. Every PDF and Word file is made through print-kit.js, which holds the
// library addresses, the typeface, the page sizes and the two readers for uploads. The before and after comparison of
// every print is made against the real records with the browser, outside this test.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('every print is made through the one print kit', () => {
  const kit = read('print-kit.js');
  for (const k of ['letter', 'half', 'poster']) assert.match(kit, new RegExp(k + ': \\{ w: \\d+'), k);
  for (const f of ['tree.html', 'tree-staff.js', 'tree-conferences.html', 'enroll-forms.js', 'family.html']) {
    const s = read(f);
    assert.doesNotMatch(s, /new window\.jspdf\.jsPDF\(/, f + ' makes no PDF of its own');
    assert.doesNotMatch(s, /(?<![\w.])new (D\.)?Document\(\{/, f + ' makes no Word document of its own');
    assert.doesNotMatch(s, /(?<![\w.])(D\.)?Packer\.toBlob\(/, f + ' packs no Word file of its own');
    assert.doesNotMatch(s, /docx@9\.8\.1|pdf\.js\/3\.11\.174|mammoth\/1\.6\.0|pdf-lib@1\.17\.1|pdf-lib\/1\.17\.1|fontkit@/, f + ' loads no print library of its own');
    assert.doesNotMatch(s, /fetch\("fonts\/"\+f\)|fetch\("fonts\/"/, f + ' loads no typeface of its own');
  }
  assert.match(read('tree.html'), /<script src="print-kit\.js"><\/script>/);
  assert.match(read('tree-conferences.html'), /<script src="print-kit\.js"><\/script>/);
});

test('the kit makes a sheet in each size', () => {
  const win = { jspdf: { jsPDF: class { constructor(o) { this.o = o; } addFileToVFS() {} addFont() {} } } };
  const ctx = { window: win, document: {}, fetch: () => {}, btoa: () => '' };
  new Function('window', 'document', read('print-kit.js'))(win, ctx.document);
  const K = win.TREE_KIT;
  assert.deepStrictEqual(K.pdf({ size: 'poster' }).o, { unit: 'pt', format: [1296, 1728] });
  assert.deepStrictEqual(K.pdf({ size: 'half', orientation: 'landscape' }).o, { unit: 'pt', orientation: 'landscape', format: [396, 612] });
  assert.deepStrictEqual(K.pdf({ unit: 'pt', format: 'letter' }).o, { unit: 'pt', format: 'letter' });
  const D = { Document: class { constructor(o) { this.o = o; } } };
  const w = K.wordFile(D, { size: 'half', sections: [{ children: [] }, { properties: { page: { size: { width: 1, height: 2 } } }, children: [] }] });
  assert.deepStrictEqual(w.o.sections[0].properties.page.size, { width: 7920, height: 12240 });
  assert.deepStrictEqual(w.o.sections[1].properties.page.size, { width: 1, height: 2 }, 'a section with its own size keeps it');
});
