'use strict';
// Licensing pages link the CDSS regulation document that holds their sections, the general page shows as a second,
// smaller link, and the date the links were checked is read from the piece. Made-up words only.
const test = require('node:test');
const assert = require('node:assert');
const { make } = require('./harness.js');

test('a licensing page has its regulation documents, a smaller general link and the date its links were checked', async () => {
  const h = make([{ name: 'Dir', director: true }]);
  h.files.set('staff/pd/licensing/01-sun.md', { text: '<!--\nlinkschecked: 2026-10-25\nlist: title22\n-->\n## Sun\n\nTitle 22, section 101229\n\n[Title 22 section 101229, CDSS Article 6, Word file](https://cdss.ca.gov/Portals/9/Regs/Man/CCL/5cccman.docx) About 7 minutes\n\n[All CDSS child care regulations](https://cdss.ca.gov/inforesources/Rules-Regulations/Legislation-and-Regulations/Community-Care-Licensing-Regulations/Child-Care)\n\n[Watch the training, Family Rights in Child Care](https://www.youtube.com/watch?v=A00b2jItu2A)\n\n### What the regulation asks\n\nShade.\n', sha: 'x' });
  await h.staff.load();
  const pc = h.staff.pieces().licensing.find(x => x.id === 'licensing/01-sun');
  assert.strictEqual(pc.checked, '2026-10-25');
  assert.deepStrictEqual(pc.links.map(l => [l.text, !!l.minor]), [['Title 22 section 101229, CDSS Article 6, Word file', false], ['All CDSS child care regulations', true], ['Watch the training, Family Rights in Child Care', false]]);
  assert.strictEqual(pc.minutes, 7);
});
