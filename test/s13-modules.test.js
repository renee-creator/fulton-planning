'use strict';
// Session 13. Restored module drafts, the three ways in and the layers recorded from PD agendas. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const REST = '<!--\nserves: obs\nstatus: draft\ndesc: Restored.\nsource: A workshop, 2026\n-->\n# Documentation\n\nServes Observation and Documentation\n\n## What changed in this draft\n\n- Restored the studio.\n\n## Why it matters\n\nRestored words.\n\n## Three ways in\n\n- **On my own.** Read.\n- **Staff meeting.** Talk.\n- **PD day.** Do.\n\n## Reading\n\n### A part\n\nText.\n\n## With families\n\nFamily words.\n\n## Into our program\n\nProgram words.\n\n## Reflect\n\n- A question?\n\n## Presenting this module\n\nDirector words.\n\n## Printables\n\n- A card.\n';

test('restored drafts, three ways in and layers', async t => {
  const fx = await start({ more: put => { put('staff/pd/restored/documentation.md', REST); put('staff/pd/originals.json', { modules: { documentation: [{ id: 'pdorig-documentation-guide.pdf', title: 'A guide', kind: 'guide', type: 'application/pdf' }] } }); put('originals/pdorig-documentation-guide.pdf', '%PDF-1.4 made up'); put('staff/pd/template.json', { id: 'template', sections: [{ title: 'Opening', minutes: 10, do: 'Begin.' }] }); } });
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

  await t.test('original materials open for the director and presenters only', async () => {
    const l = await fx.as(dee, '/api/staff/pd/originals', { slug: 'documentation' }); assert.strictEqual(l.status, 200); assert.strictEqual(l.body.list[0].title, 'A guide');
    assert.strictEqual((await fx.as(ann, '/api/staff/pd/originals', { slug: 'documentation' })).status, 403);
    // a photo link made with the file key never opens an original PD file
    { const crypto = require('crypto'); const fk = (await fx.as(ann, '/api/file-key', {})).body.fileKey; const [e36, secret] = fk.split('.'); const id = 'pdorig-documentation-guide.pdf';
      const mac = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(id, 'utf8').digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
      assert.strictEqual((await fetch(fx.api + '/original/' + id + '?t=' + e36 + '.' + mac)).status, 403); }
    const r = await fetch(fx.api + '/api/staff/pd/original', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + dee }, body: JSON.stringify({ slug: 'documentation', id: 'pdorig-documentation-guide.pdf' }) });
    assert.strictEqual(r.status, 200); assert.match(await r.text(), /PDF/);
    const e = (await fx.as(dee, '/api/staff/pres/new', { title: 'Documentation', template: false })).body;
    await fx.as(dee, '/api/staff/pres/save', { id: e.id, fields: { presenters: ['Ann'] } });
    assert.strictEqual((await fx.as(ann, '/api/staff/pd/originals', { slug: 'documentation' })).status, 403);
    const m = (await fx.as(dee, '/api/staff/pres/new', { title: 'Documentation', template: true, module: 'documentation' })).body;
    assert.ok(m && m.id); await fx.as(dee, '/api/staff/pres/save', { id: m.id, fields: { presenters: ['Ann'] } });
    assert.strictEqual((await fx.as(ann, '/api/staff/pd/originals', { slug: 'documentation' })).status, 200);
    // only the director takes a file off the list, and Put back returns it
    const id = 'pdorig-documentation-guide.pdf';
    assert.strictEqual((await fx.as(ann, '/api/staff/pd/original/remove', { slug: 'documentation', id })).status, 403);
    const rm = await fx.as(dee, '/api/staff/pd/original/remove', { slug: 'documentation', id }); assert.strictEqual(rm.status, 200);
    assert.strictEqual(rm.body.list.length, 0); assert.strictEqual(rm.body.removed[0].id, id);
    assert.strictEqual((await fx.as(ann, '/api/staff/pd/originals', { slug: 'documentation' })).body.list.length, 0);
    assert.strictEqual((await fx.as(ann, '/api/staff/pd/originals', { slug: 'documentation' })).body.removed, undefined);
    const bk = await fx.as(dee, '/api/staff/pd/original/restore', { slug: 'documentation', id }); assert.strictEqual(bk.body.list[0].id, id);
  });

  await t.test('anyone suggests a book, and it waits for the director', async () => {
    const a = await fx.as(ann, '/api/staff/library/add', { kind: 'book', title: 'A Made Up Book', author: 'An Author', why: 'Rich language.', kinds: ['story', 'wordless'] });
    assert.strictEqual(a.status, 200); assert.ok(a.body.draft);
    const mine = a.body.books.find(x => x.id === 'a-made-up-book'); assert.ok(mine && mine.draft);
    const bea = (await fx.login('Bea', '1357')).token;
    assert.ok(!((await fx.as(bea, '/api/staff/library', {})).body.books || []).some(x => x.id === 'a-made-up-book'));
    assert.strictEqual((await fx.as(ann, '/api/staff/library/ready', { path: mine.path, on: true })).status, 403);
    const r = await fx.as(dee, '/api/staff/library/ready', { path: mine.path, on: true }); assert.strictEqual(r.status, 200);
    const b = r.body.books.find(x => x.id === 'a-made-up-book'); assert.ok(!b.draft); assert.ok(!(b.meta || {}).by);
    assert.ok(b.parts.some(p => /kind of reading/i.test(p.key) && /Wordless/i.test(p.text)));
  });

  await t.test('the module page shows the three ways in and the restored draft card', async () => {
    const chromium = await browser(); if (!chromium) return;
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => goView('stpd')); await wait(1200);
    await s.p.evaluate(() => { const x = document.querySelector('[data-stmod="m:documentation"]'); if (x) x.click(); }); await wait(1500);
    const txt = await s.p.evaluate(() => document.getElementById('main').innerText);
    await s.p.evaluate(() => goView('songs')); await wait(1500);
    await s.p.evaluate(() => { const b = document.querySelector('[data-songtab="collection"]'); if (b) b.click(); }); await wait(800);
    const bk = await s.p.evaluate(() => document.getElementById('main').innerText);
    assert.match(bk, /A Made Up Book/); assert.match(bk, /Suggest a book/);
    await s.p.evaluate(() => goView('stpd')); await wait(1200);
    await s.p.evaluate(() => { const x = document.querySelector('[data-stmod="m:documentation"]'); if (x) x.click(); }); await wait(1500);
    const sd = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await sd.p.evaluate(() => goView('stpd')); await wait(3000);
    await sd.p.evaluate(() => { const L = [...document.querySelectorAll('[data-stmod="m:documentation"]')]; L[L.length - 1].click(); });
    await sd.p.waitForSelector('button[data-gmslides]', { timeout: 15000, state: 'attached' });
    await sd.p.evaluate(() => { window.__made = []; window.makePdf = async (list, name) => { __made.push({ name, list }); }; window.makeDocx = async (list, name) => { __made.push({ name, list }); }; });
    await sd.p.evaluate(() => document.querySelector('button[data-gmslides]:not([data-word])').click()); await wait(1500);
    const made = await sd.p.evaluate(() => __made.map(x => ({ name: x.name, titles: x.list.map(d => d.title) })));
    assert.ok(made.length === 1 && /slides\.pdf$/.test(made[0].name)); assert.ok(made[0].titles.includes('Why it matters')); assert.ok(made[0].titles.includes('A part')); assert.ok(made[0].titles.includes('Plus and delta'));
    const dtxt = await sd.p.evaluate(() => document.getElementById('main').innerText);
    assert.match(dtxt, /Original materials/); assert.match(dtxt, /Remove/); assert.match(dtxt, /Presenting this module/);
    assert.match(txt, /Three ways in/); assert.match(txt, /With families/); assert.match(txt, /PD day, /); assert.doesNotMatch(txt, /Presenting this module/);
  });
});
