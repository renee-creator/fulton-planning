'use strict';
// Food education records for the Farm to School grant. An observation with several photos shows and counts once, each
// item shows once across objectives 5 to 7 with a tick for each, the writing help sorts new items into Likely counts and
// Check these with the educator's own words, nothing counts until the director confirms, and Today counts each
// observation or plan once, in a weekly batch. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

// a stand-in for the writing help. Items that mention a snack are likely, the rest are not, and the third is given a
// line that is not in the educator's words, which is never used.
function writingHelp() {
  const asked = [];
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', c => b += c); q.on('end', () => {
    const text = JSON.parse(b).messages[0].content.map(c => c.text || '').join(''); asked.push(text);
    const items = []; const re = /^(\d+)\. (Observation|Plan)\. (.*)$/gm; let m;
    while ((m = re.exec(text))) items.push({ n: +m[1], likely: /snack/i.test(m[3]), objectives: /snack/i.test(m[3]) ? [5] : [6], quote: /song/i.test(m[3]) ? 'children loved every minute' : m[3].split(' ').slice(0, 6).join(' ') });
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ model: 'test', content: [{ type: 'text', text: JSON.stringify({ items }) }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }));
  }); });
  return new Promise(res => srv.listen(0, () => res({ port: srv.address().port, asked, close: () => srv.close() })));
}

test('food education items show and count once, sorted by the writing help, confirmed by the director', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const ai = await writingHelp();
  const at = Date.now() - 10 * 864e5;
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.port }, more: put => {
    // one observation with three photos, kept as three records sharing a group
    for (let i = 0; i < 3; i++) put(`notices/g${i}.json`, { id: 'g' + i, group: 'kg1', at: at + i, classroom: 'West', by: 'Ann', noticed: 'The children washed apples for snack and carried them to the table.', wonder: '', photo: { id: 'p' + i, w: 800, h: 600 } });
    put('notices/b1.json', { id: 'b1', at: at - 5000, classroom: 'North', by: 'Bea', noticed: 'We baked bread with the small group and the dough rose.', wonder: '' });
    put('notices/s1.json', { id: 's1', at: at - 9000, classroom: 'North', by: 'Bea', noticed: 'We sang a song about apples at circle.', wonder: '' });
    // an earlier choice on one photo of an observation already counted for objective 7
    put('notices/h0.json', { id: 'h0', group: 'kg2', at: at - 20000, classroom: 'West', by: 'Ann', noticed: 'We planted seeds in the garden.', wonder: '' });
    put('notices/h1.json', { id: 'h1', group: 'kg2', at: at - 19000, classroom: 'West', by: 'Ann', noticed: 'We planted seeds in the garden.', wonder: '' });
    put('grant/settings.json', { id: 'settings', start: '2026-07-01', end: '2027-06-30' });
    put('grant/education.json', { id: 'education', list: { '7|o|h0': { v: true, by: 'Dee', at: 1 }, '7|o|h1': { v: true, by: 'Dee', at: 1 } } });
  } });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); ai.close(); });
  const read = () => JSON.parse(fs.readFileSync(path.join(fx.dir, 'grant/education.json'), 'utf8'));
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 390);
  const p = s.p;
  const state = () => p.evaluate(() => { const { from, to } = periodRange('all'); return { ed: gEducation(from, to).map(o => [o.n, o.obs.length + o.plans.length]), pend: gEduPending(from, to).map(it => it.key).sort() }; });

  await p.waitForFunction(() => grantLoaded && notices.size >= 7, null, { timeout: 15000 });
  // the observation counted for 7 on both its photos counts once, and the three photos of the snack observation are one item
  let st = await state();
  assert.deepStrictEqual(st.ed, [[5, 0], [6, 0], [7, 1]]);
  assert.deepStrictEqual(st.pend, ['o|b1', 'o|kg1', 'o|s1']);

  // Today counts the week's batch, each observation once
  await p.evaluate(() => goView('today'));
  await p.waitForFunction(() => /3 food education records to confirm this week/.test(document.body.innerText), null, { timeout: 15000 });

  // the writing help sorts them, and its line comes only from the educator's words
  await p.evaluate(() => { gQuarter = 'all'; goView('grant'); });
  await p.waitForFunction(() => document.querySelector('[data-gedall]'), null, { timeout: 15000 });
  await p.evaluate(() => { const d = document.querySelector('[data-gsec=edu]'); if (d) d.open = true; });
  const sorted = read().sort;
  assert.strictEqual(sorted['o|kg1'].likely, true); assert.deepStrictEqual(sorted['o|kg1'].objs, [5]);
  assert.strictEqual(sorted['o|s1'].likely, false);
  assert.match(sorted['o|s1'].why, /song about apples/, 'a line not in the educator\'s words is replaced by their own');
  assert.ok(!ai.asked.join('').includes('planted seeds'), 'what is already confirmed is not sent');
  const text = await p.innerText('[data-gsec=edu]');
  assert.match(text, /Likely counts, 1/); assert.match(text, /Check these, 2/);
  assert.strictEqual((await p.$$('[data-gedok]')).length, 3, 'each item once');
  // nothing counts until confirmed
  st = await state(); assert.deepStrictEqual(st.ed, [[5, 0], [6, 0], [7, 1]]);

  // one tap confirms every likely count, saved on each photo's record
  await p.click('[data-gedall]');
  await p.waitForFunction(() => { const { from, to } = periodRange('all'); return gEducation(from, to)[0].obs.length === 1; }, null, { timeout: 10000 });
  for (let k = 0; k < 40 && !(read().list['5|o|g2']); k++) await p.waitForTimeout(250);
  const list = read().list;
  for (const id of ['g0', 'g1', 'g2']) { assert.strictEqual(list['5|o|' + id].v, true); assert.strictEqual(list['6|o|' + id], undefined); }

  // the bread observation, ticked for 6 and 7, counts once for each
  await p.click('[data-gedtick="o|b1|7"]');
  await p.click('[data-gedok="o|b1"]');
  await p.waitForFunction(() => { const { from, to } = periodRange('all'); const e = gEducation(from, to); return e[1].obs.length === 1 && e[2].obs.length === 2; }, null, { timeout: 10000 });
  // the song does not count
  await p.click('[data-gedno="o|s1"]');
  await p.waitForFunction(() => { const { from, to } = periodRange('all'); return gEduPending(from, to).length === 0; }, null, { timeout: 10000 });
  st = await state(); assert.deepStrictEqual(st.ed, [[5, 1], [6, 1], [7, 2]]);
  // the summaries count the same
  const rows = await p.evaluate(() => { const { from, to } = periodRange('all'); return gGoalRows(from, to).filter(r => r[0] >= 5 && r[0] <= 7).map(r => r[1]); });
  assert.deepStrictEqual(rows, ['1 confirmed', '1 confirmed', '2 confirmed']);
  await p.evaluate(() => goView('today'));
  await p.waitForTimeout(800);
  assert.doesNotMatch(await p.innerText('#main'), /food education record/);
  assert.deepStrictEqual(s.errors, []);
  await s.close();
});
