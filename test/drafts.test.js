'use strict';
// Drafts on the phone: words and photos kept on the device while writing, a save without signal waits and sends itself,
// a reply lost after the server saved never makes a second record, each educator sees only her own drafts, and signing
// out with something unsent says so first
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const NOTE = 'Saved on this phone, it will send when you are connected';
const PHOTO = fs.readFileSync(path.join(__dirname, '..', 'post_photo.jpg'));

test('Drafts on the phone', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start();
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const records = (kind, words) => { const d = path.join(fx.dir, kind); if (!fs.existsSync(d)) return []; return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))).filter(x => !words || JSON.stringify(x).includes(words)); };
  const settle = () => new Promise(r => setTimeout(r, 1500));
  const noteShown = p => p.evaluate(() => { const el = document.getElementById('draftnote'); return !!el && !el.hidden && el.offsetParent !== null ? el.textContent : ''; });
  const openForm = async p => { await p.evaluate(() => document.querySelector('#newnotice').click()); await p.waitForSelector('#nf-noticed'); };
  const send = p => p.evaluate(() => window.dispatchEvent(new Event('online')));

  await t.test('an observation kept without signal waits quietly and sends itself once, at 390', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await openForm(s.p); await s.p.fill('#nf-noticed', 'Lark counted the ducks by the pond.');
    await s.p.context().setOffline(true);
    await s.p.click('#nf-save'); await s.p.waitForTimeout(600);
    assert.strictEqual(await noteShown(s.p), NOTE);
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Lark counted the ducks/); assert.match(text, new RegExp(NOTE));
    // the note is quiet, in muted type, never the red of an error
    const color = await s.p.evaluate(() => getComputedStyle(document.getElementById('draftnote')).color);
    const danger = await s.p.evaluate(() => { const x = document.createElement('span'); x.style.color = 'var(--danger)'; document.body.append(x); const c = getComputedStyle(x).color; x.remove(); return c; });
    assert.notStrictEqual(color, danger);
    assert.strictEqual(records('notices', 'Lark counted the ducks').length, 0);
    await s.p.context().setOffline(false); await s.p.waitForTimeout(2500);
    assert.strictEqual(await noteShown(s.p), '');
    await settle(); assert.strictEqual(records('notices', 'Lark counted the ducks').length, 1);
    // later turns send nothing more
    await send(s.p); await s.p.waitForTimeout(1500); await settle();
    assert.strictEqual(records('notices', 'Lark counted the ducks').length, 1);
    assert.strictEqual(await s.p.evaluate(() => draftMine().then(a => a.length)), 0);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a reply lost after the server saved, observation and photo, keeps one record and one photo', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    let lostWrite = 0, lostPhoto = 0, again = 0;
    await s.p.route('**/api/original', async r => { const res = await r.fetch(); if (lostPhoto++ === 0) { await r.abort(); return; } const j = await res.json(); if (j.again) again++; await r.fulfill({ response: res, json: j }); });
    await s.p.route('**/api/write', async r => { const body = JSON.parse(r.request().postData() || '{}'); const res = await r.fetch();
      if (body.kind === 'notices' && lostWrite++ === 0) { await r.abort(); return; } const j = await res.json(); if (j.again) again++; await r.fulfill({ response: res, json: j }); });
    const before = fs.existsSync(path.join(fx.dir, 'originals')) ? fs.readdirSync(path.join(fx.dir, 'originals')).length : 0;
    await openForm(s.p);
    await s.p.setInputFiles('#nf-photo', { name: 'pond.jpg', mimeType: 'image/jpeg', buffer: PHOTO });
    await s.p.waitForSelector('.nf-photo img', { timeout: 15000 }); await s.p.waitForSelector('#nf-save:not([disabled])', { timeout: 15000 });
    await s.p.fill('#nf-noticed', 'Wren held the frog gently.');
    await s.p.click('#nf-save'); await s.p.waitForTimeout(1500);
    assert.strictEqual(await noteShown(s.p), NOTE);
    // the observation's reply is lost on the way back, so it waits for the next turn and goes again
    for (let i = 0; i < 5 && !(await s.p.evaluate(() => document.getElementById('draftnote').hidden)); i++) { await send(s.p); await s.p.waitForTimeout(3000); }
    assert.strictEqual(await noteShown(s.p), ''); assert.ok(lostWrite >= 2, 'the observation went a second time');
    await settle();
    const recs = records('notices', 'Wren held the frog');
    assert.strictEqual(recs.length, 1); assert.ok(recs[0].photo && recs[0].photo.id && !recs[0].photo.pending && !recs[0].photo.data);
    const after = fs.readdirSync(path.join(fx.dir, 'originals')).length;
    assert.strictEqual(after - before, 2, 'the photo and its small copy, each kept once');
    assert.ok(again >= 2, 'the server knew the photo and the observation when they came again');
    // a save sent twice with the same client id is the same save
    const tok = (await fx.login('Ann', '1357')).token;
    const doc = { id: 'n-twice', noticed: 'Sent twice', wonder: '', classroom: 'West', by: 'Ann', at: Date.now() };
    const one = await fx.as(tok, '/api/write', { op: 'set', kind: 'notices', id: 'n-twice', data: doc, cid: 'n-twice.1' });
    const two = await fx.as(tok, '/api/write', { op: 'set', kind: 'notices', id: 'n-twice', data: Object.assign({}, doc, { noticed: 'Changed meanwhile' }), cid: 'n-twice.1' });
    assert.strictEqual(one.status, 200); assert.strictEqual(two.body.again, true); assert.strictEqual(two.body.doc.noticed, 'Sent twice');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('words being written come back after the page closes, and a plan waits and sends once', async () => {
    const tok = (await fx.login('Ann', '1357')).token;
    const monday = await (async () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
    await fx.as(tok, '/api/write', { op: 'set', kind: 'plans', id: 'pdraft1', data: { id: 'pdraft1', type: 'individual', weekOf: monday, educator: 'Ann', classroom: 'West', status: 'draft', fields: {}, updatedAt: Date.now() } });
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await openForm(s.p); await s.p.fill('#nf-noticed', 'Tamsin sorted the seeds by size.'); await s.p.waitForTimeout(900);
    // no signal reaches the server, and the page is closed and opened again
    await s.p.route('**/api/write', r => r.abort());
    await s.p.evaluate(() => { view = 'plans'; currentId = 'pdraft1'; renderNav(); renderMain(); });
    await s.p.waitForSelector('textarea[data-f]');
    const f = await s.p.evaluate(() => document.querySelector('textarea[data-f]').dataset.f);
    await s.p.fill(`textarea[data-f="${f}"]`, 'The seed jars and a magnifier.'); await s.p.waitForTimeout(1800);
    assert.strictEqual(await noteShown(s.p), NOTE);
    await s.p.reload(); await s.p.waitForFunction(() => typeof goView === 'function' && window.FP_NAME && window.FP_NAME(), null, { timeout: 15000 }); await s.p.waitForTimeout(2000);
    assert.strictEqual(await noteShown(s.p), NOTE);
    await s.p.evaluate(() => { view = 'plans'; currentId = 'pdraft1'; renderNav(); renderMain(); });
    assert.strictEqual(await s.p.inputValue(`textarea[data-f="${f}"]`), 'The seed jars and a magnifier.');
    await openForm(s.p);
    assert.strictEqual(await s.p.inputValue('#nf-noticed'), 'Tamsin sorted the seeds by size.');
    // signal is back
    await s.p.unroute('**/api/write'); await send(s.p);
    await s.p.waitForFunction(() => document.getElementById('draftnote').hidden, null, { timeout: 15000 }); await settle();
    const pl = records('plans').filter(x => x.id === 'pdraft1');
    assert.strictEqual(pl.length, 1); assert.strictEqual(pl[0].fields[f], 'The seed jars and a magnifier.');
    await s.p.click('#nf-save'); await s.p.waitForTimeout(1500); await settle();
    assert.strictEqual(records('notices', 'Tamsin sorted the seeds').length, 1);
    assert.strictEqual(await s.p.evaluate(() => draftMine().then(a => a.length)), 0);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('signing out with an unsent draft says so first, and the draft is only hers', async () => {
    const ann = await fx.login('Ann', '1357'), bea = await fx.login('Bea', '1357');
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    const as = async j => { await p.evaluate(j => { localStorage.setItem('fp-token', j.token); localStorage.setItem('fp-name', j.name); }, j); await p.reload();
      await p.waitForFunction(() => typeof goView === 'function' && window.FP_NAME && window.FP_NAME(), null, { timeout: 15000 }); await p.waitForTimeout(2000); };
    await p.goto(fx.page); await as(ann);
    await p.route('**/api/write', r => r.abort());
    await openForm(p); await p.fill('#nf-noticed', 'Moss built a bridge for the snail.'); await p.click('#nf-save'); await p.waitForTimeout(1200);
    assert.strictEqual(await noteShown(p), NOTE);
    await p.click('.who-chip button');
    await p.waitForSelector('#soask');
    const ask = await p.textContent('#soask');
    assert.match(ask, /An observation is saved on this phone and not sent yet/); assert.match(ask, /it stays on this phone/);
    await p.click('[data-so="stay"]'); await p.waitForTimeout(400);
    assert.strictEqual(await p.evaluate(() => window.FP_NAME()), 'Ann');
    await p.click('.who-chip button'); await p.waitForSelector('#soask');
    await Promise.all([p.waitForNavigation(), p.click('[data-so="go"]')]);
    await p.waitForSelector('#gate:not([hidden])');
    await p.unroute('**/api/write');
    // another educator on the same phone sees nothing of it, and nothing is sent under her name
    await as(bea);
    assert.strictEqual(await noteShown(p), '');
    assert.doesNotMatch(await p.evaluate(() => { goView('moments'); return document.querySelector('#main').innerText; }), /Moss built a bridge/);
    await settle(); assert.strictEqual(records('notices', 'Moss built a bridge').length, 0);
    // she signs in again on the phone and it sends itself
    await as(ann); await p.waitForFunction(() => document.getElementById('draftnote').hidden, null, { timeout: 15000 }); await settle();
    const r = records('notices', 'Moss built a bridge'); assert.strictEqual(r.length, 1); assert.strictEqual(r[0].by, 'Ann');
    // with nothing unsent, signing out asks nothing
    await Promise.all([p.waitForNavigation(), p.click('.who-chip button')]);
    assert.deepStrictEqual(errors, []); await ctx.close();
  });
});
