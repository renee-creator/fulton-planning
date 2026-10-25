'use strict';
// Books in our library on site, and articles to read online. A book can be marked In our library, off until the
// director turns it on, and the library has a filter for them. Articles are entries of the kind article, linked to their
// module, added, changed and removed by the director the same way as a book, each opening in a new tab with its
// publisher and year. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('books in our library and articles to read online', async t => {
  const fx = await start({ more: put => {
    put('staff/readings.json', { list: [] });
    put('staff/readings-library.json', { id: 'readings-library', list: [{ id: 'rl01', title: 'A Book on Clay', url: 'https://example.org/b', cite: 'Author, A. (2020). A Book on Clay. A Press.', areas: ['img'], modules: ['documentation'] }] });
    put('staff/pd/ready.json', { modules: { documentation: true }, library: { on: '2026-10-01', by: 'Dee' } });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const R = (tok, p, b) => fx.as(tok, '/api/staff/g/readings' + (p ? '/' + p : ''), b || {});
  assert.strictEqual((await R(ann)).body.list[0].onSite, false, 'In our library is off until the director turns it on');
  assert.strictEqual((await R(ann, 'onsite', { id: 'rl01', on: true })).status, 403);
  await R(dee, 'onsite', { id: 'rl01', on: true });
  assert.strictEqual((await R(ann)).body.list[0].onSite, true);
  assert.strictEqual((await R(dee, 'lib/save', { entry: { kind: 'article', title: 'A Walk', url: 'http://example.org/w' } })).status, 400, 'an article needs an https link');
  const sv = await R(dee, 'lib/save', { entry: { kind: 'article', title: 'Walking with Children', author: 'A. Writer', source: 'A Journal', year: '2021', url: 'https://example.org/walk', note: 'Short ideas for walks.', modules: ['documentation'] } });
  assert.strictEqual(sv.status, 200); const id = sv.body.id;
  let art = (await R(ann)).body.list.find(x => x.id === id); assert.strictEqual(art.kind, 'article'); assert.strictEqual(art.source, 'A Journal'); assert.strictEqual(art.onSite, false);
  assert.strictEqual((await R(dee, 'onsite', { id, on: true })).status, 400, 'an article is never on the shelf');
  await R(dee, 'lib/save', { entry: { id, kind: 'article', title: 'Walking with Young Children', source: 'A Journal', year: '2021', url: 'https://example.org/walk', modules: ['documentation'] } });
  art = (await R(ann)).body.list.find(x => x.id === id); assert.strictEqual(art.title, 'Walking with Young Children');
  const chromium = await browser(); if (chromium) {
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => /Readings/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
    await s.p.click('[data-grlfilter="onsite"]'); await s.p.waitForTimeout(400);
    const txt = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(txt, /A Book on Clay/); assert.match(txt, /In our library/); assert.doesNotMatch(txt, /Walking with Young Children/);
    assert.strictEqual(await s.p.evaluate(() => document.querySelectorAll('[data-grlonsite]').length), 0, 'only the director sees the checkbox');
    assert.deepStrictEqual(s.errors, []); await s.close();
  }
  assert.strictEqual((await R(dee, 'lib/remove', { id })).status, 200);
  assert.ok(!(await R(ann)).body.list.some(x => x.id === id));
});
