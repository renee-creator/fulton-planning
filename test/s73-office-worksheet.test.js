'use strict';
// November 20, 2026. The office keeps the Farm to School grant with the director. The office sign-in opens the Farm to
// School page and the Kitchen page, an educator's does not, and the page makes the state's procurement worksheet,
// F2F-066, as an Excel file for one month, with a FEED bin as one csa box row that lists what came. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const sheet = require('../f2f-worksheet.js');

const now = new Date(), ym = new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 7);
const day = ym + '-03', bin = ym + '-03';
const more = put => {
  put('grant/o1.json', { id: 'o1', kind: 'order', distributor: 'FEED Cooperative', order: '1', fulfilled: day, items: [
    { item: 'OG Lemon, Meyer', producer: 'Made Up Ranch', unit: '20 pounds', qty: 1, price: 72, total: 72, use: 'meals', useSet: true },
    { item: "FEED Bin - 'Ohana / Large", producer: 'FEED Cooperative', unit: 'Large Bin', qty: 6, price: 46, total: 276, use: 'education' },
    { item: 'FEED Fruit Delights Box', producer: 'FEED Cooperative', unit: '1 box', qty: 3, price: 33, total: 99, use: 'education' }] });
  put(`bins/${bin}.json`, { id: bin, date: bin, source: 'hand', items: [{ name: 'Lettuce', farms: ['Made Up Ranch'] }, { name: 'Onions', farms: ['Other Farm'] }, { name: 'Kale', farms: ['Other Farm'] }] });
};
const cells = buf => sheet.unzip(buf).find(f => f.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');

test('the worksheet file holds the month, the contact lines and each row', () => {
  const s = cells(sheet.fill({ month: '2026-11', org: 'A School & Farm', person: 'A Person', email: 'a@example.org', phone: '555-0100', rows: [
    { date: '2026-11-03', vendor: 'FEED Cooperative', farm: 'Made Up Ranch', county: 'Sonoma', name: 'lemon', variety: 'OG Lemon, Meyer <large>', amount: 1, unit: '20 pounds', total: 72.5, purpose: 'School meals' }] }));
  assert.match(s, /<c r="K16" s="\d+" t="inlineStr"><is><t xml:space="preserve">A School &amp; Farm<\/t>/);
  assert.match(s, /<c r="K17"[^>]*><is><t[^>]*>A Person</);
  assert.match(s, /<c r="J21" s="\d+"><v>46327<\/v>/);
  assert.match(s, /<c r="B27" s="74"><v>46329<\/v>/);
  assert.match(s, /<c r="N27"[^>]*><is><t[^>]*>OG Lemon, Meyer &lt;large&gt;</);
  assert.match(s, /<c r="U27" s="78"><v>72.5<\/v>/);
  assert.match(s, /<c r="B28" s="81"\/>/);
  // the county list the form's own menu reads stays beside the rows
  assert.match(s, /<c r="AB27"[^>]*t="s">/);
  assert.throws(() => sheet.fill({ month: '2026-11', rows: new Array(sheet.ROWS + 1).fill({ date: '2026-11-03' }) }), /in parts/);
  assert.throws(() => sheet.fill({ month: 'November', rows: [] }), /month/);
});

test('the office keeps the grant with the director', async t => {
  const fx = await start({ more }); t.after(() => fx.stop());
  const gia = (await fx.login('Gia', '1357')).token, ann = (await fx.login('Ann', '1357')).token;

  await t.test('the office receives the grant records and an educator does not', async () => {
    const g = await fx.as(gia, '/api/data', {}), a = await fx.as(ann, '/api/data', {});
    assert.ok(g.body.data.grant.o1, 'the office has the order');
    assert.deepStrictEqual(Object.keys(a.body.data.grant), []);
    assert.deepStrictEqual(Object.keys(g.body.data.newsletters || {}), []);
  });

  await t.test('the server makes the worksheet for the office and refuses an educator', async () => {
    const body = { month: ym, org: 'A School', rows: [{ date: day, vendor: 'FEED Cooperative', farm: 'Made Up Ranch', name: 'lemon', amount: 1, total: 72 }] };
    const no = await fx.as(ann, '/api/grant/worksheet', body); assert.strictEqual(no.status, 403);
    const yes = await fx.as(gia, '/api/grant/worksheet', body); assert.strictEqual(yes.status, 200);
    assert.match(cells(Buffer.from(yes.body.data, 'base64')), /Made Up Ranch/);
  });

  const b = await browser(); if (!b) { t.diagnostic('Playwright is not installed here, so the page was not opened.'); return; }
  const chrome = await b.launch(); t.after(() => chrome.close());

  await t.test('the office opens Farm to School and the Kitchen, and the worksheet lists what came in the bin', async () => {
    const s = await signedIn(fx, chrome, 'Gia', '1357', 1100);
    await s.p.evaluate(() => goView('grant')); await s.p.waitForSelector('[data-gact="ws"]', { timeout: 15000 });
    await s.p.click('[data-gact="ws"]'); await s.p.waitForSelector('#g-ws');
    const rows = await s.p.evaluate(m => gWsRows(m), ym);
    assert.strictEqual(rows.length, 3);
    const box = rows.find(r => /Ohana/.test(r.variety)), fruit = rows.find(r => /Fruit Delights/.test(r.variety)), lemon = rows.find(r => r.name === 'lemon');
    assert.strictEqual(box.name, 'csa box'); assert.strictEqual(box.variety, "FEED Bin - 'Ohana / Large - Lettuce, Onions, Kale");
    assert.strictEqual(box.amount, 6); assert.strictEqual(box.unit, 'Large Bin'); assert.strictEqual(box.purpose, 'Student education'); assert.strictEqual(box.county, 'Sonoma');
    assert.strictEqual(fruit.variety, 'FEED Fruit Delights Box');
    assert.deepStrictEqual([lemon.vendor, lemon.farm, lemon.variety, lemon.organic, lemon.purpose, lemon.use, lemon.before], ['FEED Cooperative', 'Made Up Ranch', 'OG Lemon, Meyer', 'Yes', 'School meals', 'Used for school snacks and lunches', 'No']);
    // what came in the fruit box is typed once and kept
    const sel = '[data-gwsbox]'; const boxes = await s.p.$$(sel); assert.strictEqual(boxes.length, 2);
    await boxes[1].fill('Apples, kiwis, persimmons'); await boxes[1].dispatchEvent('change');
    await s.p.waitForFunction(m => gWsRows(m).some(r => r.variety === 'FEED Fruit Delights Box - Apples, kiwis, persimmons'), ym, { timeout: 8000 });
    const [dl] = await Promise.all([s.p.waitForEvent('download', { timeout: 15000 }), s.p.click('[data-gact="xlsx"]')]);
    assert.match(dl.suggestedFilename(), /^[A-Z][a-z]{2}\.\d{4}\.F2F-066 Procurement Metrics Worksheet\.xlsx$/);
    const xml = cells(require('fs').readFileSync(await dl.path()));
    assert.match(xml, /FEED Bin - 'Ohana \/ Large - Lettuce, Onions, Kale/); assert.match(xml, /Apples, kiwis, persimmons/); assert.match(xml, />csa box</);
    await s.p.evaluate(() => goView('kitchen')); await s.p.waitForTimeout(1500);
    assert.strictEqual(await s.p.evaluate(() => view), 'kitchen');
    assert.ok(!(await s.p.textContent('#main')).includes('The Kitchen page is for'));
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('an educator still does not open either page', async () => {
    const s = await signedIn(fx, chrome, 'Ann', '1357', 1100);
    await s.p.evaluate(() => goView('grant')); await s.p.waitForTimeout(600);
    assert.strictEqual(await s.p.evaluate(() => view), 'today');
    await s.p.evaluate(() => goView('kitchen')); await s.p.waitForTimeout(600);
    assert.strictEqual(await s.p.evaluate(() => view), 'today');
    await s.close();
  });
});
