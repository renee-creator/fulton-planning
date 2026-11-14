'use strict';
// November 14, 2026. Today, tidied. The Kaymbu kinds share one row, a sorted caption shows one short line, Send a clip reads
// the same on a phone and a computer, a save that took many tries shows for a day, and emails with no educator named wait
// for the director only. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const k = (subject, x) => Object.assign({ v: 3, key: 'k-' + subject, subject, dated: 'photo', keptAt: Date.now() }, x || {});
const more = put => {
  put('notices/c1.json', { id: 'c1', noticed: 'Poured sand through the funnel.', at: Date.now() - 864e5, classroom: 'West', by: 'Ann', kaymbu: k('West one', { check: true }) });
  put('notices/c2.json', { id: 'c2', noticed: 'Stacked the blocks high.', at: Date.now() - 2 * 864e5, classroom: 'West', by: 'Ann', kaymbu: k('West two', { check: true }) });
  put('notices/u1.json', { id: 'u1', noticed: 'Watered the beans.', at: Date.now() - 864e5, classroom: 'West', by: '', kaymbu: k('West three') });
  put('notices/u2.json', { id: 'u2', noticed: 'Fed the goats.', at: Date.now() - 864e5, classroom: 'West', by: '', kaymbu: k('West four') });
  put('notices/s1.json', { id: 's1', noticed: 'Dug in the mud.', wonder: 'What draws them back?', at: Date.now() - 3600e3, classroom: 'West', by: 'Dee', sorted: { from: 'Dug in the mud. What draws them back?', why: 'The question reads as wondering.' } });
};

test('Today, tidied', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const d = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => d.close());
  await d.p.waitForFunction(() => notices.get('u2') && notices.get('s1'), null, { timeout: 15000 });
  await d.p.evaluate(() => { todayAll = true; goView('today'); });
  await d.p.waitForSelector('[data-tg="kayall"]', { timeout: 15000 });
  const sum = await d.p.innerText('[data-tg="kayall"] > summary');
  assert.match(sum, /4 from Kaymbu/); assert.match(sum, /2 to tag\. 2 emails with no educator named/);
  // each part keeps its own fold inside
  assert.ok(await d.p.$('[data-tg="kayall"] [data-tg="kaymbu"]')); assert.ok(await d.p.$('[data-tg="kayall"] [data-tg="kby"]'));
  assert.strictEqual(await d.p.$$eval('[data-tg="kaymbu"]', x => x.length), 1);
  // the number says it is a total
  assert.match(await d.p.innerText('.tgrid2 .secthead'), /\d+ in all/);
  // a caption TREE sorted shows one short line on Today, and the whole why stays on the observation
  const main = await d.p.innerText('#main'); assert.match(main, /Sorted by TREE\.\s*Put it back/); assert.doesNotMatch(main, /The question reads as wondering/);
  assert.match(await d.p.evaluate(() => sortLinesHtml(notices.get('s1'))), /TREE sorted this into noticed and wondered[\s\S]*The question reads as wondering/);
  // Send a clip names no device
  assert.doesNotMatch(await d.p.evaluate(() => { PROGRAM_DOC = Object.assign({}, PROGRAM_DOC, { videoClipsOn: true }); return sendClipHtml('quick'); }), /phone/);
  // a save that took many tries shows for a day
  const hard = await d.p.evaluate(() => { LS.set('tree.hardseen', {}); savesInfo = { hard: [{ label: 'Old', path: 'x', tries: 5, at: Date.now() - 2 * 864e5 }] }; const a = hardSavesHtml();
    savesInfo = { hard: [{ label: 'New', path: 'y', tries: 5, at: Date.now() - 3600e3 }] }; return [a, /New/.test(hardSavesHtml())]; });
  assert.deepStrictEqual(hard, ['', true]);
  // an educator of the class is not asked who shared an email, and still sees the photos to tag
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  await a.p.waitForFunction(() => notices.get('u2'), null, { timeout: 15000 });
  const kinds = await a.p.evaluate(() => todayWaiting().map(w => (WAIT_KIND(w) || [''])[0]));
  assert.ok(!kinds.includes('kby')); assert.strictEqual(kinds.filter(x => x === 'kaymbu').length, 2);
  // Observations opens on her own class in two parts, her own first, and the director's list is as it was
  await a.p.evaluate(() => { nRoom = myRoom(); mRange = 'all'; mGroup = 'recent'; goView('moments'); }); await a.p.waitForSelector('#obs-mine', { timeout: 15000 });
  const parts = await a.p.evaluate(() => ({ room: myRoom(), mine: [...document.querySelectorAll('#obs-mine article')].map(x => x.id), rest: [...document.querySelectorAll('#obs-class article')].map(x => x.id), first: document.querySelector('#main section.card article').closest('section').id, heads: [...document.querySelectorAll('#obs-mine h3, #obs-class h3')].map(x => x.textContent) }));
  assert.strictEqual(parts.first, 'obs-mine'); assert.ok(parts.mine.includes('nw-c1') && parts.mine.includes('nw-c2'), JSON.stringify(parts)); assert.ok(parts.rest.includes('nw-s1') && !parts.mine.includes('nw-s1'));
  assert.deepStrictEqual(parts.heads, ['Your observations', 'The rest of ' + parts.room + ' class']);
  await d.p.evaluate(() => { nRoom = 'West'; mRange = 'all'; mGroup = 'recent'; goView('moments'); }); await d.p.waitForSelector('#main article', { timeout: 15000 }); assert.strictEqual(await d.p.$('#obs-mine'), null);
  assert.deepStrictEqual(d.errors, []); assert.deepStrictEqual(a.errors, []);
});
