'use strict';
// One-page materials guides. A draft shows only to the director, with its source note, until she marks it ready. Once
// ready it is linked from its Materials library group and its Classroom area on plans, and prints as PDF and Word.
// Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const G = `<!--
status: draft
group: Sculpture
area: Art
source: A test guide, October 9, 2025
-->
# Educators and Clay

A whole block on a low table.

## Setting it up
- A board for each child

## Educator language
- "What do you notice about the clay?"
`;

test('materials guides', async t => {
  const fx = await start({ more: put => put('staff/guides/clay.md', G) }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const L = tok => fx.as(tok, '/api/staff/guides', {}).then(r => r.body.list);
  await t.test('a draft shows only to the director, with its source', async () => {
    const d = await L(dee); assert.strictEqual(d[0].title, 'Educators and Clay'); assert.ok(d[0].waiting); assert.match(d[0].source, /October 9, 2025/);
    assert.deepStrictEqual(await L(ann), []);
    assert.strictEqual((await fx.as(ann, '/api/staff/guides/ready', { slug: 'clay', on: true })).status, 403);
  });
  await t.test('once ready, an educator reaches it without the source', async () => {
    await fx.as(dee, '/api/staff/guides/ready', { slug: 'clay', on: true });
    const a = await L(ann); assert.strictEqual(a.length, 1); assert.strictEqual(a[0].source, undefined); assert.strictEqual(a[0].group, 'Sculpture');
  });
  await t.test('the guide opens from the Materials library and prints', async () => {
    const b = await (await browser()).launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => loadGuides(true)); await s.p.waitForTimeout(500);
    const html = await s.p.evaluate(() => guideLink(guideBy('group', 'sculpture'), 'Guide') + '|' + guideBy('area', 'Art').slug);
    assert.match(html, /data-guide="clay"/); assert.match(html, /\|clay$/);
    await s.p.evaluate(() => { guideSel = 'clay'; goView('guide'); }); await s.p.waitForTimeout(500);
    const txt = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(txt, /Educators and Clay/); assert.match(txt, /What do you notice/); assert.doesNotMatch(txt, /Source|Mark it ready/);
    const doc = await s.p.evaluate(() => guideDoc(guideList[0]));
    assert.deepStrictEqual(doc.blocks.map(x => x.label), ['', 'Setting it up', 'Educator language']);
    assert.ok(await s.p.evaluate(() => !!document.querySelector('[data-print="guide"][data-word="1"]')), 'a Word copy');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
