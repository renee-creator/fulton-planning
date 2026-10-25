'use strict';
// The New Educator first-weeks sequence and the welcome letter. A draft part shows only to the director until she marks
// it ready, a part for experienced educators reaches only a new educator she marked experienced, the go-to person's name
// fills in, and the welcome letter opens the PD library. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const part = (o, title, body, extra) => `<!--\nstatus: draft\norder: ${o}\n${extra || ''}source: A test file, May 1, 2025\n-->\n# ${title}\n\n${body}\n`;

test('the New Educator sequence', async t => {
  const fx = await start({ more: put => {
    put('staff/newed/01-first-days.md', part(1, 'The Educator\'s First Days', '## Day one\n\n- Meet {goTo} at the gate'));
    put('staff/newed/experienced.md', part(6, 'For Experienced Educators', 'Words for experienced hires.', 'audience: experienced\n'));
    put('staff/newed/welcome.md', part(0, 'A Welcome to Educators', 'Dear educators.', 'place: pdlibrary\n'));
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, neo = (await fx.login('Neo', '1357')).token, ann = (await fx.login('Ann', '1357')).token;
  const N = (tok, p, b) => fx.as(tok, '/api/staff/newed' + (p ? '/' + p : ''), b || {});
  await t.test('drafts show only to the director, with sources', async () => {
    const d = (await N(dee, '', { name: 'Neo' })).body; assert.strictEqual(d.list.length, 3); assert.ok(d.list.every(x => x.waiting && x.source));
    assert.deepStrictEqual((await N(neo)).body.list, []); assert.deepStrictEqual((await N(ann)).body.list, []);
    assert.strictEqual((await N(neo, 'ready', { slug: '01-first-days', on: true })).status, 403);
  });
  await t.test('ready parts reach the new educator, and the experienced part only once marked', async () => {
    for (const slug of ['01-first-days', 'experienced', 'welcome']) await N(dee, 'ready', { slug, on: true });
    let n = (await N(neo)).body; assert.deepStrictEqual(n.list.map(x => x.slug), ['welcome', '01-first-days']); assert.strictEqual(n.list[0].source, undefined);
    assert.strictEqual((await N(neo, 'experienced', { name: 'Neo', on: true })).status, 403);
    await N(dee, 'experienced', { name: 'Neo', on: true });
    n = (await N(neo)).body; assert.ok(n.experienced); assert.ok(n.list.some(x => x.slug === 'experienced'));
    assert.ok((await N(ann)).body.list.some(x => x.slug === 'welcome'), 'the welcome letter reaches every educator');
  });
  await t.test('the page shows the parts with the go-to person and the welcome in the PD library', async () => {
    const b = await (await browser()).launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Neo', '1357');
    await s.p.evaluate(() => goView('stnew')); await s.p.waitForFunction(() => /Your first weeks/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
    const txt = await s.p.evaluate(() => document.querySelector('#main').textContent);
    assert.match(txt, /Meet Gia at the gate/); assert.match(txt, /For Experienced Educators/); assert.doesNotMatch(txt, /Source, seen only|Draft/);
    await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => /A Welcome to Educators/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
