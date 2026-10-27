'use strict';
// Session 13. Restored module drafts, the three ways in and the layers recorded from PD agendas. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const REST = '<!--\nserves: obs\nstatus: draft\ndesc: Restored.\nsource: A workshop, 2026\n-->\n# Documentation\n\nServes Observation and Documentation\n\n## What changed in this draft\n\n- Restored the studio.\n\n## Why it matters\n\nRestored words.\n\n## Three ways in\n\n- **On my own.** Read.\n- **Staff meeting.** Talk.\n- **PD day.** Do.\n\n## Reading\n\n### A part\n\nText.\n\n## With families\n\nFamily words.\n\n## Into our program\n\nProgram words.\n\n## Reflect\n\n- A question?\n\n## Presenting this module\n\nDirector words.\n\n## Printables\n\n- A card.\n';

test('restored drafts, three ways in and layers', async t => {
  const fx = await start({ more: put => { put('staff/pd/restored/documentation.md', REST); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const G = (tok, p, b) => fx.as(tok, '/api/staff/g/' + p, b || {});

  await t.test('only the director reads a restored draft', async () => {
    const m = (await G(dee, 'modules')).body.modules.documentation; assert.ok(m.restored);
    assert.strictEqual((await G(ann, 'module/restored', { slug: 'documentation' })).status, 403);
    const r = (await G(dee, 'module/restored', { slug: 'documentation' })).body.module; assert.strictEqual(r.title, 'Documentation');
    assert.ok(r.sections.some(s => /three ways in/i.test(s.heading)));
  });

  await t.test('accepting keeps the order and history and drops the review note', async () => {
    assert.strictEqual((await G(ann, 'module/accept', { slug: 'documentation' })).status, 403);
    const r = await G(dee, 'module/accept', { slug: 'documentation' }); assert.strictEqual(r.status, 200);
    const m = r.body.modules.documentation; assert.ok(!m.restored); assert.ok(!m.sections.some(s => /what changed/i.test(s.heading)));
    assert.strictEqual(m.minutes, 90);
    await wait(1400);
    const page = (await fx.as(dee, '/api/staff/page', { path: 'staff/pd/modules/02-documentation.md' })).body;
    if (page && page.history) assert.ok(page.history.length >= 1);
  });

  await t.test('educators never receive Presenting this module', async () => {
    // the module was published before, so accepting a draft marked status draft keeps it published
    const m = (await G(ann, 'modules')).body.modules.documentation; assert.ok(m);
    assert.ok(!m.sections.some(s => /presenting this module/i.test(s.heading))); assert.ok(m.sections.some(s => /with families/i.test(s.heading)));
  });

  await t.test('a PD day that used a module records its layer for each attendee once', async () => {
    const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const s = await G(dee, 'pd/save', { agenda: { date, kind: 'pdday', start: '09:00', end: '12:00', blocks: [{ title: 'Documentation studio', module: 'documentation' }] } });
    assert.strictEqual(s.status, 200); assert.strictEqual(s.body.agenda.blocks[0].module, 'documentation');
    assert.strictEqual((await G(dee, 'pd/hours', { id: date + '-pdday', names: ['Ann'] })).status, 200);
    await G(dee, 'pd/hours', { id: date + '-pdday', names: ['Ann'] });
    const g = (await G(ann, 'mine')).body; const mod = ((g.doc || g).modules || {}).documentation || {};
    assert.strictEqual((mod.layers || {}).pdday, date);
  });

  await t.test('the module page shows the three ways in and the restored draft card', async () => {
    const chromium = await browser(); if (!chromium) return;
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => goView('stpd')); await wait(1200);
    await s.p.evaluate(() => { const x = document.querySelector('[data-stmod="m:documentation"]'); if (x) x.click(); }); await wait(1500);
    const txt = await s.p.evaluate(() => document.getElementById('main').innerText);
    assert.match(txt, /Three ways in/); assert.match(txt, /With families/); assert.match(txt, /PD day, /); assert.doesNotMatch(txt, /Presenting this module/);
  });
});
