'use strict';
// Session 11, items 37 and 38. Presenting and PD fixes. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const MOD = '<!--\nserves: lang\n-->\n# Talking with Children\n\n## Why it matters\n\nWords matter.\n\n## Reflect\n\n- What did you say?\n';
const TPL = { id: 'template', sections: [{ title: 'Opening', minutes: 10, do: 'Begin.' }, { title: 'Framing', minutes: 20, do: 'Frame.' }] };

test('Presenting and the PD library keep lengths, links and audiences honest', async t => {
  const fx = await start({ more: put => { put('staff/pd/modules/03-language.md', MOD); put('staff/pd/template.json', TPL); put('staff/readings-library.json', { list: [] }); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const P = (p, b) => fx.as(dee, '/api/staff/pres/' + p, b || {}), G = (p, b) => fx.as(dee, '/api/staff/g/' + p, b || {});

  await t.test('a module has no guessed length, and turning it into a presentation starts internal with no length', async () => {
    const m = (await G('modules')).body;
    const mod = (m.modules || {}).language || Object.values(m.modules || {}).find(x => x.title === 'Talking with Children');
    if (mod) assert.strictEqual(mod.minutes, 0);
    const e = (await P('new', { title: 'Talking with Children', template: true, module: 'language' })).body;
    assert.strictEqual(e.minutes, 0); assert.strictEqual(e.audienceType, 'internal');
    const s = (await P('save', { id: e.id, fields: { mode: 'both', audienceType: 'nonsense' } })).body;
    assert.strictEqual(s.mode, 'both'); assert.strictEqual(s.audienceType, '');
    const l = (await P('list')).body.list.find(x => x.id === e.id);
    assert.strictEqual(l.mode, 'both');
  });

  await t.test('a reading without a link is refused, and a place in TREE counts as a link', async () => {
    const no = await G('readings/lib/save', { entry: { kind: 'book', title: 'A book with no link' } });
    assert.strictEqual(no.status, 400); assert.match(no.body.error, /link/);
    assert.strictEqual((await G('readings/lib/save', { entry: { kind: 'book', title: 'A book', url: 'http://x.test' } })).status, 400);
    assert.strictEqual((await G('readings/lib/save', { entry: { kind: 'book', title: 'Our language parameters', url: 'tree:hb/language-parameters' } })).status, 200);
    assert.strictEqual((await G('readings/lib/save', { entry: { kind: 'book', title: 'A real book', url: 'https://publisher.test/book' } })).status, 200);
  });

  await t.test('a guest session needs a link and counts toward PD hours for each educator present', async () => {
    const date = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const block = { title: 'Understanding Senses', guest: 'yes', guestBy: 'Two Guests', guestOrg: 'A Test Institute', guestMinutes: 120, guestPeople: 11 };
    const bad = await G('pd/save', { agenda: { date, kind: 'pdday', start: '09:30', end: '10:30', blocks: [block] } });
    assert.strictEqual(bad.status, 400); assert.match(bad.body.error, /guest session needs a link/);
    const ok = await G('pd/save', { agenda: { date, kind: 'pdday', start: '09:30', end: '10:30', blocks: [Object.assign({}, block, { guestLink: 'https://institute.test/' })] } });
    assert.strictEqual(ok.status, 200); assert.strictEqual(ok.body.agenda.blocks[0].guestOrg, 'A Test Institute');
    const h = (await G('pd/hours', { id: date + '-pdday', names: ['Ann'] })).body;
    assert.strictEqual(h.hours, 2);
    await wait(1400);
    const rec = (await fx.as(ann, '/api/staff/g', {})).body;
    void rec;
  });

  await t.test('the module page and the Presenting list read as asked', async () => {
    const chromium = await browser(); if (!chromium) return;
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('stpres')); await wait(1500);
    const txt = await s.p.evaluate(() => document.getElementById('main').innerText);
    assert.match(txt, /Audience not yet set|Internal, our own staff/); assert.match(txt, /Sort by audience type/);
    await s.p.click('[data-praud="unset"]'); await wait(600);
    assert.match(await s.p.evaluate(() => document.getElementById('main').innerText), /Talking with Children/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
