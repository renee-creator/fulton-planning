'use strict';
// When a new edition of the Family Handbook becomes current, a returning family sees one Read and acknowledge step on
// the Family page, for all their children at once. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser } = require('./fixture.js');

test('a returning family reads the new edition in one step', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => {
    put('children/pip-test.json', { first: 'Pip', last: 'Test', classroom: 'North', dob: '2021-11-03', status: 'active', enrollDate: '2025-08-20', parents: [{ name: 'A parent', email: 'pip.family@example.test' }] });
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip-test'] }] });
  } });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' }); const tok = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  // the edition is made current here by the answer the page receives, as the server gives it once 2027 is published
  let checked = [];
  const as27 = j => { if (j && Array.isArray(j.children)) { j.handbook = { year: '2027' }; for (const k of j.children) { k.isNew = false; k.handbook = checked.includes(k.id) ? { year: '2027', at: '2027-06-02T10:00:00Z', earlier: '2026' } : { year: '2027', at: '', earlier: '2026' }; } } return j; };
  await p.route('**/family/data', async r => { const res = await r.fetch(); await r.fulfill({ response: res, json: as27(await res.json()) }); });
  await p.route('**/family/check', async r => { const body = JSON.parse(r.request().postData() || '{}'); if (body.key === 'handbook' && body.on) checked.push(body.childId); const res = await r.fetch(); await r.fulfill({ response: res, json: as27(await res.json()) }); });
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [tok]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('#hbnew', { timeout: 10000 });
  assert.match(await p.innerText('#hbnew'), /Read and acknowledge the 2027 Family Handbook/);
  await p.click('[data-hbackall]'); await p.waitForTimeout(800);
  assert.deepStrictEqual(checked, ['pip-test']);
  assert.strictEqual(await p.$('#hbnew'), null, 'the step goes once it is done');
  assert.deepStrictEqual(errors, []);
});
