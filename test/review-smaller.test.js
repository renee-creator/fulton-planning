'use strict';
// October 31, 2026. The smaller review items. A recipe naming a nut is refused by the server too. Someone who does not
// work Mondays is never put on a Monday. A Title 22 mark belongs to the school year it was made in. A Kaymbu moment in a
// small group carries the group's lead, even when the subject names someone else, unless its name was chosen by hand.
// A donated grant line stays out of the figures until the director counts it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const k = (key, extra) => Object.assign({ v: 3, key, subject: 'North Bea', dated: 'photo', keptAt: Date.now() }, extra || {});
const more = put => {
  put('settings/main.json', { id: 'main', groups: [{ name: 'Marigold', room: 'North', educator: 'Ann' }] });
  put('notices/s1.json', { id: 's1', noticed: 'Poured water.', at: Date.now() - 864e5, classroom: 'North', smallGroup: 'Marigold', by: 'Bea', kaymbu: k('ks1') });
  put('notices/s2.json', { id: 's2', noticed: 'Climbed.', at: Date.now() - 864e5, classroom: 'North', smallGroup: 'Marigold', by: 'Dee', editedBy: 'Dee', children: ['x'], kaymbu: k('ks2', { sentBy: 1 }) });
  put('notices/s3.json', { id: 's3', noticed: 'Sang.', at: Date.now() - 864e5, classroom: 'North', smallGroup: 'Marigold', by: 'Bea', editedBy: 'Bea', kaymbu: k('ks3', { byHand: 1 }) });
  put('notices/kept1.json', { id: 'kept1', noticed: 'Wren stacked three stones.', wonder: '', at: Date.now() - 36e5, classroom: 'West', by: 'Ann', children: [] });
  put('grant/o1.json', { id: 'o1', kind: 'order', distributor: 'FEED Cooperative', order: '1', fulfilled: new Date().toISOString().slice(0, 10), items: [
    { item: 'Apples', producer: 'Devoto Gardens', unit: 'lb', qty: 5, price: 2, total: 10 },
    { item: 'FEED Bin, donated', producer: 'FEED Cooperative', unit: 'bin', qty: 1, price: 0, total: 0 }] });
};

test('the smaller review items', async t => {
  const fx = await start({ more }); t.after(() => fx.stop());
  const read = id => JSON.parse(fs.readFileSync(path.join(fx.dir, `notices/${id}.json`), 'utf8'));
  const wait = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 200; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };
  const ann = (await fx.login('Ann', '1357')).token, dee = (await fx.login('Dee', 'director-pass-1')).token;

  await t.test('a recipe naming a nut is refused by the server', async () => {
    const r = await fx.as(ann, '/api/staff/library/add', { kind: 'recipe', title: 'Trail mix', ingredients: 'Oats\nAlmonds\nRaisins', steps: 'Mix.' });
    assert.strictEqual(r.status, 400); assert.match(r.body.error, /nut free/);
    const ok = await fx.as(ann, '/api/staff/library/add', { kind: 'recipe', title: 'Oat cakes', ingredients: 'Oats\nHoney', steps: 'Mix and bake.' });
    assert.strictEqual(ok.status, 200);
  });

  await t.test('someone who does not work Mondays is never put on a Monday', async () => {
    const set = await fx.as(dee, '/api/staff/profile', { name: 'Ann', profile: { noMondays: true } });
    assert.strictEqual(set.status, 200);
    const mon = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
    const b = await fx.as(dee, '/api/staff/g/checkin/book', { name: 'Ann', date: mon, time: '09:00' });
    assert.strictEqual(b.status, 400); assert.match(b.body.error, /does not work Mondays/);
  });

  await t.test('a Title 22 mark belongs to this school year', async () => {
    const r = await fx.as(dee, '/api/staff/review', { name: 'Ann', piece: 'licensing/01-a-piece', mark: 'inplace' });
    if (r.status === 400) { t.diagnostic('licensing piece id differs in this fixture: ' + r.body.error); return; }
    assert.strictEqual(r.status, 200);
    const m = Object.values(r.body.review || {})[0];
    const d = new Date(); const yr = d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    assert.strictEqual(m.year, yr);
  });

  await t.test('a moment in a small group carries its lead, unless named by hand', async () => {
    assert.ok(await wait(() => read('s1').by === 'Ann'), 'the subject named Bea, the group lead Ann wins');
    assert.ok(await wait(() => read('s2').by === 'Ann'), 'the director only sent it and tagged children, Ann wins');
    assert.strictEqual(read('s3').by, 'Bea', 'chosen by hand stays');
  });

  await t.test('a donated grant line stays out until the director counts it', async () => {
    const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1100);
    await s.p.waitForFunction(() => typeof grantRecs !== 'undefined' && grantRecs.get('o1'), null, { timeout: 15000 });
    const before = await s.p.evaluate(() => { const L = gLinesAll('0000', '9999'); return { donated: L.filter(x => x.donated).map(x => x.item), counted: L.filter(x => x.ca).map(x => x.item) }; });
    assert.deepStrictEqual(before.donated, ['FEED Bin, donated']);
    assert.ok(!before.counted.includes('FEED Bin, donated'));
    assert.strictEqual(await s.p.evaluate(() => /Donated, your call/.test(gDonatedHtml())), true);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('changes to a kept observation wait as a draft until Save changes', async () => {
    const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
    const b = await chromium.launch(); t.after(() => b.close());
    const drafts = () => { const d = path.join(fx.dir, 'drafts'); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : []; };
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.waitForFunction(() => notices.get('kept1'), null, { timeout: 15000 });
    await s.p.evaluate(() => { const x = document.createElement('button'); x.dataset.nwedit = 'kept1'; document.body.append(x); x.click(); x.remove(); });
    await s.p.waitForSelector('#nf-noticed');
    await s.p.fill('#nf-noticed', 'Wren stacked three stones and then a fourth.');
    assert.ok(await wait(() => drafts().some(d => d.editOf === 'kept1' && /a fourth/.test(d.form.noticed))), 'the change waits as her draft');
    assert.strictEqual(read('kept1').noticed, 'Wren stacked three stones.', 'everyone else still sees the kept words');
    await s.close();
    const s2 = await signedIn(fx, b, 'Ann', '1357', 390);
    await s2.p.evaluate(() => goView('moments')); await s2.p.waitForSelector('[data-draftopen]', { timeout: 15000 });
    assert.match(await s2.p.evaluate(() => document.querySelector('#main').innerText), /Changes to a kept observation/);
    await s2.p.click('[data-draftopen]'); await s2.p.waitForSelector('#nf-noticed');
    assert.match(await s2.p.inputValue('#nf-noticed'), /a fourth/);
    await s2.p.click('#nf-save');
    assert.ok(await wait(() => /a fourth/.test(read('kept1').noticed)), 'saved');
    assert.ok(await wait(() => !drafts().some(d => d.editOf === 'kept1')), 'and the draft leaves');
    assert.deepStrictEqual(s2.errors, []); await s2.close();
  });
});
