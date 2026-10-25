'use strict';
// Renee's decisions on Session 8's questions. A plan whose typed Where it happens differs from its calendar space says and
// prints the typed words. The slide set to show stays a PDF only, with no Word copy, since it keeps children's faces.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

test('the slide set to show is a PDF only', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/presenting-app.js'), 'utf8');
  const row = src.slice(src.indexOf('<b>Slide set to show</b>'), src.indexOf('</div>', src.indexOf('data-prshow')));
  assert.match(row, /data-prshow="1">PDF<\/button>/);
  assert.doesNotMatch(row, /data-word|Word/);
});

test('a plan whose typed words differ from its calendar space uses the typed words', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch();
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const fx = await start({ more: put => {
    put('plans/pwhere.json', { id: 'pwhere', type: 'individual', weekOf: monday, classroom: 'West', educator: 'Ann', focus: 'smallgroup', groups: [], where: 'The piazza then to the art shed',
      space: { spaceId: 'studio', spaceName: 'Tire swing studio', days: [2, 3], start: '09:00', end: '10:30', booked: [{ day: 2 }], skipped: [] }, fields: {}, status: 'draft' });
  } });
  try {
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    const where = await s.p.evaluate(() => { const p = plans.get('pwhere'); const c = planBlocks0(p)[0].cols; return c.find(x => x.label === 'Where').text; });
    assert.strictEqual(where, 'The piazza then to the art shed');
    assert.deepStrictEqual(s.errors, []); await s.close();
  } finally { await b.close(); await fx.stop(); }
});
