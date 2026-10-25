'use strict';
// The readings library. The shared list shows to every educator, and the library added since waits for the director to
// mark it ready, with links still to check shown only to her. It shows on the PD library page grouped by area, and on
// each module tagged to it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('the readings library', async t => {
  const fx = await start({ more: put => {
    put('staff/readings.json', { list: [{ id: 'r01', title: 'A Shared Reading', url: 'https://example.org/a', source: 'An author', areas: ['img'], modules: [] }] });
    put('staff/readings-library.json', { id: 'readings-library', list: [{ id: 'rl01', title: 'A Book on Clay', url: 'https://example.org/b', cite: 'Author, A. (2020). A Book on Clay. A Press.', areas: ['env'], modules: ['documentation'], check: true, by: 'TREE' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const R = (tok, p, b) => fx.as(tok, '/api/staff/g/readings' + (p ? '/' + p : ''), b || {});
  assert.deepStrictEqual((await R(ann)).body.list.map(x => x.id), ['r01']);
  const d = (await R(dee)).body; assert.ok(d.list.find(x => x.id === 'rl01').waiting); assert.strictEqual(d.libraryReady, false);
  assert.strictEqual((await R(ann, 'ready', { on: true })).status, 403);
  await R(dee, 'ready', { on: true });
  const a = (await R(ann)).body.list; assert.deepStrictEqual(a.map(x => x.id), ['r01', 'rl01']); assert.strictEqual(a[1].check, undefined);
  const b = await (await browser()).launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Ann', '1357');
  await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => /Readings/.test(document.querySelector('#main').innerText) && /Modules/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
  const txt = await s.p.evaluate(() => document.querySelector('#main').textContent);
  assert.match(txt, /A Book on Clay/); assert.match(txt, /Author, A\. \(2020\)/); assert.doesNotMatch(txt, /Link to check|Draft/);
  assert.deepStrictEqual(s.errors, []); await s.close();
});
