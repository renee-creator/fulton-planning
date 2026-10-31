'use strict';
// The one-page materials guides are folded into their Idea bank cards. A guide file in the records stays as it is and
// no longer shows anywhere. Guide beside a Materials library group and Open the guide on a Classroom area open the
// matching card. Made-up names only.
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
`;

test('materials guides open their Idea bank cards', async t => {
  const fx = await start({ more: put => put('staff/guides/clay.md', G) }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  await t.test('the guides no longer show to anyone', async () => {
    for (const tok of [dee, ann]) assert.deepStrictEqual((await fx.as(tok, '/api/staff/guides', {})).body.list, []);
    assert.strictEqual((await fx.as(dee, '/api/staff/page', { path: 'staff/guides/clay.md' })).status, 404);
  });
  await t.test('Guide and Open the guide open the matching card', async () => {
    const b = await browser(); if (!b) return;
    const br = await b.launch(); t.after(() => br.close());
    const s = await signedIn(fx, br, 'Ann', '1357', 390);
    await s.p.evaluate(() => ibLoad()); await s.p.waitForFunction(() => ib && ib.cards, null, { timeout: 15000 });
    const html = await s.p.evaluate(() => guideLink(guideBy('group', 'sculpture'), 'Guide') + '|' + guideBy('area', 'Art').slug + '|' + guideBy('group', 'Culinary').slug);
    assert.match(html, /data-ibopen="clay"/); assert.match(html, /\|studio-and-class-ateliers\|piazza-and-culinary-atelier$/);
    await s.p.evaluate(() => document.body.insertAdjacentHTML('beforeend', guideLink(guideBy('group', 'Natural'), 'Guide')));
    await s.p.evaluate(() => document.querySelector('body > [data-ibopen="water"]').click()); await s.p.waitForFunction(() => view === 'ideabank' && ibSt.sel === 'water');
    assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /Water/);
    assert.doesNotMatch(await s.p.evaluate(() => document.querySelector('#main').innerText), /Educators and Clay/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
