'use strict';
// After the week's reading TREE writes a short report for the whole school and each class, kept by week. The director
// reads every one, and a class team reads only its own class's. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const day = 864e5;
const more = put => {
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', status: 'deepening', evidence: [] });
  for (let i = 0; i < 8; i++) put(`notices/n${i}.json`, { id: 'n' + i, noticed: 'Poured water down the hill again ' + i, at: Date.now() - i * 4 * day, threadId: 't1', classroom: 'West', by: 'Ann' });
  put('notices/m1.json', { id: 'm1', noticed: 'Built a tall tower in the block area.', at: Date.now() - day, classroom: 'North', by: 'Bea' });
};

async function setup(t) {
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString(); asked.push(body);
    const room = /the West class/.test(body) ? 'West' : /the North class/.test(body) ? 'North' : /the whole school/.test(body) ? 'All' : '';
    const text = /short weekly report/.test(body) ? JSON.stringify({ emerging: 'A tower is just appearing.', growing: `Perhaps water play is growing, ${room}.`, deepening: 'Water and mud is deepening.', resting: 'Nothing is resting.', support: ['Offer more ways to move water.'] }) : '{}';
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more }); t.after(() => fx.stop());
  return { fx, asked };
}

test('the week\'s reading ends with a report for the school and each class, and each team reads its own', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, asked } = await setup(t);
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  assert.ok(await s.p.evaluate(() => (() => { const st = weeklySteps(), i = st.findIndex(x => x.startsWith('report|')); return i > 0 && st.slice(i).every(x => x.startsWith('report|')) && st.includes('report|All'); })()), 'the report is the last part of the reading');
  await s.p.evaluate(async () => { for (const r of ['All', 'West', 'North']) await weeklyReport(r); });
  const q = asked.find(b => /short weekly report/.test(b) && /the West class/.test(b));
  assert.ok(q); assert.match(q, /Water and mud/); assert.match(q, /\\"status\\":\\"Deepening\\"/, 'the thread\'s own status'); assert.match(q, /Emerging is an interest just appearing/); assert.doesNotMatch(q, /tall tower/, 'a class report reads only its class');
  await new Promise(r => setTimeout(r, 2500));
  const wk = await s.p.evaluate(() => mondayOf(new Date()));
  const w = JSON.parse(fs.readFileSync(path.join(fx.dir, `reports/${wk}-West.json`), 'utf8'));
  assert.strictEqual(w.growing, 'Perhaps water play is growing, West.'); assert.strictEqual(w.threads[0].name, 'Water and mud'); assert.strictEqual(w.obs.length, 6);
  // the director's page, every scope
  await s.p.evaluate(() => goView('wreport')); await s.p.waitForSelector('.wrrep');
  const all = await s.p.innerText('#main');
  assert.match(all, /The whole school[\s\S]*Emerging[\s\S]*A tower is just appearing[\s\S]*Growing[\s\S]*growing, All\.[\s\S]*Deepening[\s\S]*Resting[\s\S]*To support the work[\s\S]*Offer more ways to move water/);
  assert.doesNotMatch(all, /\bNew\b|Gone quiet|Steady|Fading/, 'no words the threads do not use');
  await s.p.click('[data-wrroom="West"]'); await s.p.waitForSelector('text=Water and mud');
  assert.match(await s.p.innerText('#main'), /West class[\s\S]*growing, West\.[\s\S]*Water and mud[\s\S]*Deepening/);
  assert.deepStrictEqual(s.errors, []);
  // a class team reads its own class's, on Today and the page, and nothing else
  const ann = (await fx.login('Ann', '1357')).token;
  const mine = (await fx.as(ann, '/api/reports/mine', {})).body;
  assert.deepStrictEqual(mine.reports.map(r => r.room), ['West']);
  const a = await signedIn(fx, br, 'Ann', '1357', 390); t.after(() => a.close());
  await a.p.evaluate(() => goView('today')); await a.p.waitForSelector('text=This week\'s reading report for the West class', { timeout: 15000 });
  await a.p.click('[data-wrseen]'); await a.p.waitForSelector('.wrrep');
  const txt = await a.p.innerText('#main');
  assert.match(txt, /growing, West\./); assert.doesNotMatch(txt, /The whole school|North class/);
  assert.strictEqual(await a.p.evaluate(() => reports.size), 0, 'the records hold no report for an educator');
  assert.deepStrictEqual(a.errors, []);
});
