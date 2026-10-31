'use strict';
// October 30, 2026. An observation is kept in the records as a draft from its first word or photo, so nothing written is
// lost with a phone, a browser or a page left. Only its educator and the director see it, and only she finishes it.
// Cancel asks before anything is thrown away. A Kaymbu moment in a small group takes that group's lead educator, and naming
// who shared an email changes only the photos of the educator's own class. Educators see What these observations keep
// returning to folded closed. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const k = (key, extra) => Object.assign({ v: 3, key, subject: '.', mail: '1700000000000', dated: 'photo', keptAt: Date.now() }, extra || {});
const more = put => {
  put('settings/main.json', { id: 'main', groups: [{ name: 'Marigold', room: 'North', educator: 'Bea' }, { name: 'Zinnia', room: 'West', educator: 'Ann' }] });
  // the director sent it, so it carries her name only because she sent it, in Bea's small group
  put('notices/g1.json', { id: 'g1', noticed: 'Fed the goats hay by hand.', at: Date.now() - 864e5, classroom: 'North', smallGroup: 'Marigold', by: 'Dee', kaymbu: k('kg1', { sentBy: 1 }) });
  // a name changed by hand stays as chosen
  put('notices/g2.json', { id: 'g2', noticed: 'Climbed the log twice.', at: Date.now() - 864e5, classroom: 'North', smallGroup: 'Marigold', by: 'Ann', editedBy: 'Ann', kaymbu: k('kg2') });
  // one email with no name, a North photo and a West photo, neither in a small group
  put('notices/m1.json', { id: 'm1', noticed: 'Poured water from the pitcher.', at: Date.now() - 36e5, classroom: 'North', by: '', kaymbu: k('km1', { mail: '1700000000001' }) });
  put('notices/m2.json', { id: 'm2', noticed: 'Cut the squash with a butter knife.', at: Date.now() - 36e5, classroom: 'West', by: '', kaymbu: k('km2', { mail: '1700000000001' }) });
  put('scans/moments-All.json', { id: 'moments-All', by: 'Dee', createdAt: Date.now(), summary: 'Children keep returning to water and its weight.', patterns: [], questions: [] });
};

test('Observations kept as drafts in the records', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const dir = kind => path.join(fx.dir, kind);
  const files = kind => fs.existsSync(dir(kind)) ? fs.readdirSync(dir(kind)).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir(kind), f), 'utf8'))) : [];
  const wait = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 200; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };
  const read = id => JSON.parse(fs.readFileSync(path.join(fx.dir, `notices/${id}.json`), 'utf8'));

  await t.test('a draft is only its educator\'s, and the director\'s to see or remove', async () => {
    const ann = await fx.login('Ann', '1357'), bea = await fx.login('Bea', '1357'), dee = await fx.login('Dee', 'director-pass-1');
    const w = await fx.as(ann.token, '/api/write', { op: 'set', kind: 'drafts', id: 'dtest1', data: { id: 'dtest1', by: 'Bea', form: { id: 'ntest1', noticed: 'Wren sang to the hens.' } } });
    assert.strictEqual(w.status, 200);
    assert.strictEqual(w.body.doc.by, 'Ann', 'the name on a draft is always the one who wrote it');
    const seen = async tok => Object.keys(((await fx.as(tok, '/api/data')).body.data || {}).drafts || {});
    assert.ok((await seen(ann.token)).includes('dtest1'));
    assert.ok(!(await seen(bea.token)).includes('dtest1'), 'another educator never receives it');
    assert.ok((await seen(dee.token)).includes('dtest1'), 'the director sees it');
    const ch = (await fx.as(bea.token, '/api/changes', { since: 0, bootId: (await fx.as(bea.token, '/api/data')).body.bootId })).body.changes || {};
    assert.ok(!(ch.drafts && ch.drafts.dtest1), 'nor in the changes');
    assert.strictEqual((await fx.as(bea.token, '/api/write', { op: 'set', kind: 'drafts', id: 'dtest1', data: { form: {} } })).status, 403);
    assert.strictEqual((await fx.as(dee.token, '/api/write', { op: 'set', kind: 'drafts', id: 'dtest1', data: { form: {} } })).status, 403, 'the director removes a draft, she does not write in it');
    assert.strictEqual((await fx.as(dee.token, '/api/write', { op: 'delete', kind: 'drafts', id: 'dtest1' })).status, 200);
  });

  await t.test('words written on one phone wait as a draft, and are finished from another', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => document.querySelector('#newnotice').click()); await s.p.waitForSelector('#nf-noticed');
    await s.p.fill('#nf-noticed', 'Lark lined up twelve acorns along the bench and counted them twice.');
    assert.ok(await wait(() => files('drafts').some(d => d.by === 'Ann' && /twelve acorns/.test((d.form || {}).noticed || ''))), 'the draft reaches the records');
    // leaving the page keeps it
    await s.p.evaluate(() => goView('today')); await s.p.waitForTimeout(800);
    assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /An observation to finish/);
    await s.close();
    // another phone, the same educator
    const s2 = await signedIn(fx, b, 'Ann', '1357', 390);
    await s2.p.evaluate(() => goView('moments')); await s2.p.waitForSelector('[data-draftopen]');
    const text = await s2.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Your drafts/); assert.match(text, /twelve acorns/);
    await s2.p.click('[data-draftopen]'); await s2.p.waitForSelector('#nf-noticed');
    assert.match(await s2.p.inputValue('#nf-noticed'), /twelve acorns/);
    await s2.p.click('#nf-save');
    assert.ok(await wait(() => files('notices').some(n => /twelve acorns/.test(n.noticed || '') && n.by === 'Ann' && !n.draftId)), 'kept as an observation');
    assert.ok(await wait(() => !files('drafts').some(d => /twelve acorns/.test((d.form || {}).noticed || ''))), 'and the draft leaves');
    assert.deepStrictEqual(s2.errors, []); await s2.close();
  });

  await t.test('another educator never sees the draft, and Cancel asks first', async () => {
    const a = await signedIn(fx, b, 'Ann', '1357', 390);
    await a.p.evaluate(() => document.querySelector('#newnotice').click()); await a.p.waitForSelector('#nf-noticed');
    await a.p.fill('#nf-noticed', 'Moss built a bridge for the snail.');
    assert.ok(await wait(() => files('drafts').some(d => /bridge for the snail/.test((d.form || {}).noticed || ''))));
    let asked = 0; a.p.once('dialog', d => { asked++; d.dismiss(); });
    await a.p.click('#nf-cancel'); await a.p.waitForTimeout(400);
    assert.strictEqual(asked, 1, 'Cancel asks before throwing words away');
    assert.match(await a.p.inputValue('#nf-noticed'), /bridge for the snail/, 'and nothing is lost when she says no');
    const bea = await signedIn(fx, b, 'Bea', '1357', 390);
    await bea.p.evaluate(() => goView('moments')); await bea.p.waitForTimeout(800);
    assert.doesNotMatch(await bea.p.evaluate(() => document.querySelector('#main').innerText), /bridge for the snail/);
    a.p.once('dialog', d => d.accept());
    await a.p.click('#nf-cancel');
    assert.ok(await wait(() => !files('drafts').some(d => /bridge for the snail/.test((d.form || {}).noticed || ''))), 'thrown away on purpose, it leaves');
    assert.deepStrictEqual(a.errors, []); await a.close(); await bea.close();
  });

  await t.test('a Kaymbu moment in a small group takes the group\'s lead', async () => {
    assert.ok(await wait(() => read('g1').by === 'Bea'), 'named only because the director sent it, it takes Bea');
    assert.strictEqual(read('g1').kaymbu.sentBy, undefined);
    assert.strictEqual(read('g2').by, 'Ann', 'a name changed by hand stays');
  });

  await t.test('naming who shared an email changes only the educator\'s own class', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 390);
    await s.p.waitForFunction(() => notices.get('m1') && notices.get('m2'), null, { timeout: 15000 });
    await s.p.evaluate(() => { const x = document.createElement('button'); x.dataset.tqsave = 'kmail|m1|Bea'; document.body.append(x); x.click(); x.remove(); });
    assert.ok(await wait(() => read('m1').by === 'Bea'), 'her own class takes her name');
    await new Promise(r => setTimeout(r, 1200));
    assert.strictEqual(read('m2').by, '', 'the West photo is left for West');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('educators see the reading folded closed, the director sees it open', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => { nRoom = 'All'; goView('moments'); }); await s.p.waitForSelector('#mreadcard');
    assert.deepStrictEqual(await s.p.evaluate(() => { const d = document.querySelector('#mreadcard details'); return d ? [true, d.open] : [false]; }), [true, false]);
    await s.close();
    const d = await signedIn(fx, b, 'Dee', 'director-pass-1', 1100);
    await d.p.evaluate(() => { nRoom = 'All'; goView('moments'); }); await d.p.waitForSelector('#mreadcard');
    assert.strictEqual(await d.p.evaluate(() => !!document.querySelector('#mreadcard details')), false);
    await d.close();
  });

  await t.test('words typed into a box kept only by a button wait as a draft and come back on another device', async () => {
    const s1 = await signedIn(fx, b, 'Bea', '1357', 1100);
    await s1.p.evaluate(() => goView('stci')); await s1.p.waitForSelector('#main textarea[id]', { timeout: 15000 });
    const id = await s1.p.evaluate(() => document.querySelector('#main textarea[id]').id);
    await s1.p.fill('#' + id, 'The rainy week asked a lot of the team.');
    assert.ok(await wait(() => files('drafts').some(d => d.by === 'Bea' && d.kind === 'words' && JSON.stringify(d.words).includes('rainy week'))), 'kept in the records');
    await s1.close();
    const s2 = await signedIn(fx, b, 'Bea', '1357', 1100);
    await s2.p.evaluate(() => goView('stci')); await s2.p.waitForSelector('#' + id, { timeout: 15000 });
    assert.match(await s2.p.inputValue('#' + id), /rainy week/, 'and back on another device');
    assert.deepStrictEqual(s2.errors, []); await s2.close();
    // a project being started, on the Projects page
    const a = await signedIn(fx, b, 'Ann', '1357', 1100);
    await a.p.evaluate(() => { goView('projects'); }); await a.p.waitForSelector('#pstart-school', { timeout: 15000 });
    await a.p.click('#pstart-school'); await a.p.waitForSelector('#pf-exp');
    await a.p.fill('#pf-exp', 'The children found a nest after the storm.');
    assert.ok(await wait(() => files('drafts').some(d => d.by === 'Ann' && d.kind === 'words' && JSON.stringify(d.words).includes('nest after the storm'))));
    await a.close();
    const a2 = await signedIn(fx, b, 'Ann', '1357', 1100);
    await a2.p.evaluate(() => { goView('projects'); }); await a2.p.waitForSelector('#pstart-school', { timeout: 15000 });
    await a2.p.click('#pstart-school'); await a2.p.waitForSelector('#pf-exp'); await a2.p.waitForTimeout(300);
    assert.match(await a2.p.inputValue('#pf-exp'), /nest after the storm/);
    assert.deepStrictEqual(a2.errors, []); await a2.close();
  });
});
