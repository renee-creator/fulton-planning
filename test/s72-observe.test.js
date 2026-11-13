'use strict';
// Observe TREE, the small page only for taking an observation. It asks the server for the form's lists and the
// educator's own drafts and nothing else, keeps an observation through the same saves TREE uses, keeps what is being
// written as a draft, and holds an observation on the phone without signal until it is written once.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser } = require('./fixture.js');

const PHOTO = path.join(__dirname, '..', 'post_photo.jpg');
const more = put => {
  put('settings/program.json', { id: 'program', classrooms: ['West', 'North', 'South'], groups: [{ name: 'Poppy', room: 'West', educator: 'Ann' }, { name: 'Iris', room: 'North', educator: 'Bea' }], planResOn: true });
  put('children/c1.json', { first: 'Lark', last: 'Oneill', classroom: 'West', group: 'Poppy', status: 'active', dob: '2022-01-01', enrollForm: { phone: '555' } });
  put('children/c2.json', { first: 'Wren', last: 'Hale', classroom: 'West', status: 'active' });
  put('children/c3.json', { first: 'Finch', last: 'Moss', classroom: 'North', group: 'Iris', status: 'active' });
  put('children/c4.json', { first: 'Gone', last: 'Away', classroom: 'West', status: 'withdrawn' });
  put('plans/p1.json', { id: 'p1', by: 'Ann', fields: { rationale: 'A plan nobody asked Observe TREE for' } });
  put('drafts/dbea.json', { id: 'dbea', by: 'Bea', startedAt: 1, updatedAt: 2, form: { id: 'nbea1', noticed: 'Bea began this one', wonder: '', classroom: 'North' }, queue: [] });
};

test('Observe TREE', async t => {
  const fx = await start({ more });
  const chromium = await browser();
  const b = chromium ? await chromium.launch() : null;
  t.after(async () => { if (b) await b.close(); await fx.stop(); });
  const records = (kind, words) => { const d = path.join(fx.dir, kind); if (!fs.existsSync(d)) return []; return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))).filter(x => !words || JSON.stringify(x).includes(words)); };
  const settle = ms => new Promise(r => setTimeout(r, ms || 1800));
  const open = async (name, width) => {
    const j = await fx.login(name, name === 'Dee' ? 'director-pass-1' : '1357');
    const ctx = await b.newContext({ viewport: { width: width || 390, height: 844 } }); const p = await ctx.newPage();
    const errors = [], asked = []; p.on('pageerror', e => errors.push(e.message)); p.on('request', r => { if (r.url().startsWith(fx.api)) asked.push(new URL(r.url()).pathname); });
    await p.addInitScript(([tk, n]) => { localStorage.setItem('fp-token', tk); localStorage.setItem('fp-name', n); }, [j.token, j.name]);
    await p.goto(`http://localhost:${fx.web}/observe.html?server=${fx.api}`); await p.waitForSelector('#f-noticed');
    return { p, ctx, errors, asked, close: () => ctx.close() };
  };

  await t.test('the server hands over the form\'s lists and the educator\'s own drafts, and nothing else', async () => {
    const ann = await fx.login('Ann', '1357');
    const r = await fx.as(ann.token, '/api/observe/boot'); assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(Object.keys(r.body).sort(), ['children', 'classrooms', 'clips', 'director', 'drafts', 'groups', 'me', 'photos', 'room']);
    assert.deepStrictEqual(r.body.classrooms, ['West', 'North', 'South']); assert.strictEqual(r.body.room, 'West'); assert.strictEqual(r.body.me, 'Ann');
    // first names with a last initial, the class and the small group. No withdrawn child, and nothing else from a child's record.
    assert.deepStrictEqual(r.body.children, [{ id: 'c3', first: 'Finch', last: 'M', classroom: 'North', group: 'Iris' }, { id: 'c1', first: 'Lark', last: 'O', classroom: 'West', group: 'Poppy' }, { id: 'c2', first: 'Wren', last: 'H', classroom: 'West', group: '' }]);
    assert.deepStrictEqual(r.body.drafts, []);
    const bea = await fx.login('Bea', '1357'); const rb = await fx.as(bea.token, '/api/observe/boot');
    assert.deepStrictEqual(rb.body.drafts.map(d => d.id), ['dbea']); assert.strictEqual(rb.body.room, 'North');
    assert.ok(!JSON.stringify(r.body).includes('nobody asked'));
    // a kitchen sign-in and a new hire are refused, and so is no sign-in at all
    for (const n of ['Kit', 'Neo']) { const k = await fx.login(n, '1357'); assert.strictEqual((await fx.as(k.token, '/api/observe/boot')).status, 403, n); }
    assert.strictEqual((await fx.as('nope', '/api/observe/boot')).status, 401);
    // a fresh sign-in is not handed another one
    assert.strictEqual(r.body.token, undefined);
  });

  await t.test('the page is small and never asks for the whole school record', async () => {
    assert.ok(fs.statSync(path.join(__dirname, '..', 'observe.html')).size < 60000);
    const html = fs.readFileSync(path.join(__dirname, '..', 'observe.html'), 'utf8');
    assert.ok(!html.includes('/api/data')); assert.ok(!/Claude/.test(html.replace(/fromClaude/g, ''))); assert.ok(!html.includes('—'));
  });

  if (!b) { t.diagnostic('Playwright is not installed here, so the page itself was not opened'); return; }

  await t.test('an observation with words, children and a small group is kept once, at 390', async () => {
    const s = await open('Ann');
    // her own class is ticked, its children show, and the other class waits folded
    assert.strictEqual(await s.p.evaluate(() => document.querySelector('[data-room="West"]').checked), true);
    assert.deepStrictEqual(await s.p.evaluate(() => [...document.querySelectorAll('#f-kids > .chips .chip')].map(x => x.textContent)), ['Lark O.', 'Wren H.']);
    assert.strictEqual(await s.p.evaluate(() => document.querySelector('#f-kids details').open), false);
    assert.strictEqual(await s.p.evaluate(() => document.querySelector('[data-sg="Poppy"]').checked), false);
    await s.p.fill('#f-noticed', 'Lark poured water from the tall jug into the bowl.'); await s.p.fill('#f-wonder', 'I wonder what she will pour next.');
    await s.p.click('[data-kid="c1"]'); await s.p.click('label.tick:has([data-sg="Poppy"])');
    await s.p.click('#f-keep'); await s.p.waitForFunction(() => document.querySelector('#status').textContent === 'Kept.');
    assert.strictEqual(await s.p.inputValue('#f-noticed'), '');
    await settle(2500);
    const kept = records('notices', 'tall jug'); assert.strictEqual(kept.length, 1);
    const n = kept[0];
    assert.strictEqual(n.by, 'Ann'); assert.strictEqual(n.classroom, 'West'); assert.deepStrictEqual(n.children, ['c1']); assert.strictEqual(n.smallGroup, 'Poppy'); assert.deepStrictEqual(n.smallGroups, ['Poppy']);
    assert.strictEqual(n.wonder, 'I wonder what she will pour next.'); assert.match(n.week, /^\d{4}-\d{2}-\d{2}$/); assert.ok(n.at > Date.now() - 60000); assert.strictEqual(n.updatedByName, 'Ann');
    assert.strictEqual(n.projectId, ''); assert.strictEqual(n.threadId, '');
    // the draft made while typing is gone from the records, and nothing waits on the phone
    assert.strictEqual(records('drafts', 'tall jug').length, 0);
    await s.p.waitForFunction(() => window.OBSERVE_TEST.waitingList().then(a => a.length === 0), null, { timeout: 30000 });
    assert.ok(!s.asked.includes('/api/data')); assert.ok(!s.asked.includes('/api/changes'));
    // nothing runs off the side of the phone
    assert.ok(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a photo is kept with its observation, with a small copy', async () => {
    const s = await open('Ann');
    await s.p.setInputFiles('#f-photo', PHOTO); await s.p.waitForSelector('.photo img');
    await s.p.fill('#f-noticed', 'Wren lined the stones along the fence.');
    await s.p.click('#f-keep'); await settle(4000);
    const kept = records('notices', 'lined the stones'); assert.strictEqual(kept.length, 1);
    const ph = kept[0].photo; assert.ok(ph && ph.id && ph.thumb && ph.w > 0 && ph.h > 0); assert.strictEqual(ph.pending, undefined); assert.strictEqual(ph.seq, undefined);
    assert.ok(fs.existsSync(path.join(fx.dir, 'originals', ph.id))); assert.ok(fs.existsSync(path.join(fx.dir, 'originals', ph.thumb)));
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('kept without signal, it waits on the phone and is written once when the signal returns', async () => {
    const s = await open('Ann');
    await s.p.fill('#f-noticed', 'Finch carried the ladder with two hands.');
    await s.ctx.setOffline(true);
    await s.p.click('#f-keep'); await s.p.waitForTimeout(800);
    assert.match(await s.p.textContent('#status'), /Saved on this phone/);
    assert.match(await s.p.textContent('#waiting'), /1 observation is saved on this phone/);
    assert.strictEqual(records('notices', 'carried the ladder').length, 0);
    await s.ctx.setOffline(false); await s.p.evaluate(() => window.dispatchEvent(new Event('online')));
    await s.p.waitForFunction(() => window.OBSERVE_TEST.waitingList().then(a => a.length === 0), null, { timeout: 40000 });
    await settle(); assert.strictEqual(records('notices', 'carried the ladder').length, 1);
    assert.strictEqual(await s.p.textContent('#waiting'), '');
    await s.p.evaluate(() => window.OBSERVE_TEST.pump()); await settle();
    assert.strictEqual(records('notices', 'carried the ladder').length, 1);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('what is being written is a draft, hers alone, and opens again where it was', async () => {
    const s = await open('Ann');
    await s.p.fill('#f-noticed', 'Half a thought about the mud kitchen'); await s.p.click('[data-kid="c2"]');
    await s.p.waitForTimeout(2200); await settle();
    const d = records('drafts', 'mud kitchen'); assert.strictEqual(d.length, 1); assert.strictEqual(d[0].by, 'Ann'); assert.deepStrictEqual(d[0].form.children, ['c2']); assert.deepStrictEqual(d[0].queue, []);
    // the page opened again shows the draft in the form
    await s.p.reload(); await s.p.waitForSelector('#f-noticed');
    assert.strictEqual(await s.p.inputValue('#f-noticed'), 'Half a thought about the mud kitchen');
    assert.strictEqual(await s.p.evaluate(() => document.querySelector('[data-kid="c2"]').classList.contains('on')), true);
    // Bea sees her own draft under Drafts, folded closed, and never Ann's
    const bea = await open('Bea');
    assert.strictEqual(await bea.p.evaluate(() => document.querySelector('#draftfold').open), false);
    assert.match(await bea.p.textContent('#draftfold summary'), /^Drafts, 1$/);
    assert.ok(!(await bea.p.textContent('#drafts')).includes('mud kitchen'));
    await bea.p.click('#draftfold summary'); await bea.p.click('[data-draft="dbea"]');
    await bea.p.waitForFunction(() => document.querySelector('#f-noticed').value !== '');
    assert.strictEqual(await bea.p.inputValue('#f-noticed'), 'Bea began this one');
    assert.strictEqual(await bea.p.evaluate(() => document.querySelector('[data-room="North"]').checked), true);
    await bea.p.click('#f-keep'); await settle(3000);
    assert.strictEqual(records('notices', 'Bea began this one').length, 1); assert.strictEqual(records('notices', 'Bea began this one')[0].id, 'nbea1');
    assert.strictEqual(records('drafts', 'Bea began this one').length, 0);
    await bea.close();
    // Ann starts over, and the draft leaves the records
    await s.p.click('#f-rm'); await s.p.click('#f-rmyes'); await settle(2500);
    assert.strictEqual(await s.p.inputValue('#f-noticed'), ''); assert.strictEqual(records('drafts', 'mud kitchen').length, 0);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('signing in on the page itself, and the director sees every class folded', async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(`http://localhost:${fx.web}/observe.html?server=${fx.api}`); await p.waitForSelector('#g-name');
    await p.fill('#g-name', 'Ann'); await p.fill('#g-code', '0000'); await p.click('#g-go');
    await p.waitForFunction(() => /do not match/.test(document.querySelector('#g-msg').textContent));
    await p.fill('#g-code', '1357'); await p.click('#g-go'); await p.waitForSelector('#f-noticed');
    assert.strictEqual(await p.textContent('#who'), 'Ann');
    await p.click('#signout'); await p.waitForSelector('#g-name');
    await p.fill('#g-name', 'Dee'); await p.fill('#g-code', 'director-pass-1'); await p.click('#g-go'); await p.waitForSelector('#f-noticed');
    assert.strictEqual(await p.evaluate(() => document.querySelectorAll('[data-room]:checked').length), 0);
    assert.deepStrictEqual(await p.evaluate(() => [...document.querySelectorAll('#f-kids details summary')].map(x => x.textContent)), ['West class, 2 children', 'North class, 1 children']);
    assert.deepStrictEqual(errors, []); await ctx.close();
  });
  await t.test('a clip goes up in pieces, with the page saying how far it has come', async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    const j = await fx.login('Ann', '1357'); await p.addInitScript(([tk, n]) => { localStorage.setItem('fp-token', tk); localStorage.setItem('fp-name', n); }, [j.token, j.name]);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }; const steps = [];
    await p.route('**/api/observe/boot', async r => { const a = await r.fetch(); const body = await a.json(); body.clips = true; await r.fulfill({ status: 200, headers: cors, body: JSON.stringify(body) }); });
    await p.route('**/api/clip-send', async r => { if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: Object.assign({ 'Access-Control-Allow-Headers': '*' }, cors) }); return; }
      const q = r.request().postDataJSON(); steps.push(q.step + (q.step === 'piece' ? q.k : ''));
      await r.fulfill({ status: 200, headers: cors, body: JSON.stringify(q.step === 'start' ? { id: 'u1', piece: 1000, pieces: Math.ceil(q.size / 1000) } : q.step === 'piece' ? { got: 1, next: q.k + 1 } : { ok: true }) }); });
    await p.goto(`http://localhost:${fx.web}/observe.html?server=${fx.api}`); await p.waitForSelector('#f-clip', { state: 'attached' });
    await p.setInputFiles('#f-clip', { name: 'pond.mov', mimeType: 'video/quicktime', buffer: Buffer.alloc(2500, 7) });
    await p.waitForFunction(() => /Clip sent/.test(document.querySelector('#status').textContent));
    assert.deepStrictEqual(steps, ['start', 'piece0', 'piece1', 'piece2', 'done']);
    // the photo and clip buttons are back, ready for the next one
    assert.ok(await p.$('#f-photo')); assert.deepStrictEqual(errors, []); await ctx.close();
  });
});
