'use strict';
// The year record. Each week's findings are kept by week, earlier weeks of the school year are filled in once, and one
// device at a time runs the week's reading. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

test('the server fills in an earlier week once and keeps one device on the week\'s reading', async () => {
  const fx = await start({});
  try {
    const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
    const fill = { week: '2026-09-07', room: 'West', threads: [{ name: 'Water and mud', question: 'Children may be asking where water goes.', ids: ['n1', 'n2'], weeks: ['2026-09-07'] }], patterns: [{ name: 'Pouring', why: 'Perhaps pouring is the work.', ids: ['n1', 'n2'] }], seenOnce: [{ id: 'n3', idea: 'A child traced a shadow.' }] };
    assert.strictEqual((await fx.as(ann, '/api/findings/fill', fill)).status, 403, 'only the director fills in the year record');
    assert.strictEqual((await fx.as(dee, '/api/findings/fill', Object.assign({}, fill, { week: '2099-01-05' }))).status, 400, 'a week to come cannot be filled in');
    assert.strictEqual((await fx.as(dee, '/api/findings/fill', fill)).body.ok, true);
    assert.strictEqual((await fx.as(dee, '/api/findings/fill', fill)).body.again, true, 'a class is filled in once for a week');
    await fx.as(dee, '/api/findings/fill', Object.assign({}, fill, { room: 'North', threads: [], patterns: [], seenOnce: [{ id: 'n4', idea: 'Stones lined up by size.' }] }));
    const all = (await fx.as(dee, '/api/findings', {})).body.findings.find(f => f.week === '2026-09-07');
    assert.deepStrictEqual(all.filled, ['West', 'North']);
    assert.strictEqual(all.threads.length, 1); assert.strictEqual(all.seenOnce.length, 2);
    const west = (await fx.as(ann, '/api/findings', {})).body.findings.find(f => f.week === '2026-09-07');
    assert.ok(west.seenOnce.every(o => o.room === 'West' || o.room === 'All'), 'a class team reads only its own class\'s moments seen once');

    assert.strictEqual((await fx.as(dee, '/api/weekly/claim', { device: 'phone' })).body.ok, true);
    assert.strictEqual((await fx.as(dee, '/api/weekly/claim', { device: 'laptop' })).body.busy, true, 'a second device waits while the first reads');
    assert.strictEqual((await fx.as(dee, '/api/weekly/claim', { device: 'phone' })).body.ok, true, 'the first device keeps it as it goes');
    await fx.as(dee, '/api/weekly/claim', { device: 'phone', done: true });
    assert.strictEqual((await fx.as(dee, '/api/weekly/claim', { device: 'laptop' })).body.ok, true, 'once it lets go, another device may read');
    assert.strictEqual((await fx.as(ann, '/api/weekly/claim', { device: 'x' })).status, 403);
  } finally { await fx.stop(); }
});

test('the readings skip what has not changed, read the year when it is in use, and the report shows the year', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  assert.match(src, /if\(o\.weekly&&prev&&prev\.sig===sig&&prev\.range===tRange/, 'Find threads keeps last week\'s reading when nothing changed');
  assert.match(src, /if\(o\.weekly&&prev&&prev\.sig===sig&&prev\.range===lRange/, 'the lens does the same');
  assert.match(src, /if\(o\.weekly&&prev&&prev\.sig===sig&&prev\.range===mRange/, 'the observation reading does the same');
  assert.match(src, /if\(o&&o\.weekly&&x\.found&&x\.found\.sig===sig\)/, 'a project or inquiry does the same');
  assert.match(src, /const sc=await findThreads\(\{weekly:true,year:yr\}\);return \{ok:!!sc,sc\}/, 'a step is done when its reading hands back what it kept');
  assert.match(src, /if\(!\(await weeklyHold\(\)\)\)\{missed\+\+;break\}/, 'the reading stops when another device holds it');
  assert.match(src, /for\(const x of ths\)\{if\(!x\.trackedId\|\|o\.preview\)continue;/, 'Compare never adds to a thread');
  assert.match(src, /Since the start of the school year/);
  assert.match(src, /const yearOn=\(\)=>!!\(PROGRAM_DOC&&PROGRAM_DOC\.yearRecord\)/, 'the year record is off until the director turns it on');
});

test('with the year record in use, Find threads reads the year and keeps moments seen once, and a second weekly read is skipped', async t => {
  const http = require('http');
  const { browser, signedIn } = require('./fixture.js');
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const day = 864e5, asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString(); asked.push(body);
    const text = /Find the threads/.test(body) ? JSON.stringify({ summary: 'Perhaps water play began in August and came back.', threads: [{ name: 'Water and mud', question: 'Children may be asking where the water goes.', classroom: 'West', status: 'growing', evidence: [{ planId: 'old1', text: 'Poured water down the hill in August' }, { planId: 'n1', text: 'Poured water down the hill again' }], weeks: [] }], seen_once: [{ planId: 'n2', idea: 'A child traced a shadow on the path.' }] }) : '{}';
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const more = put => {
    put('settings/program.json', { yearRecord: true, yearFilled: 'x' });
    put('notices/old1.json', { id: 'old1', noticed: 'Poured water down the hill in August', at: Date.parse('2026-09-02T17:00:00Z'), classroom: 'West', by: 'Ann' });
    put('notices/n1.json', { id: 'n1', noticed: 'Poured water down the hill again', at: Date.now() - 2 * day, classroom: 'West', by: 'Ann' });
    put('notices/n2.json', { id: 'n2', noticed: 'Traced a shadow on the path', at: Date.now() - 3 * day, classroom: 'West', by: 'Ann' });
    put('reports/2026-08-31-findings.json', { id: '2026-08-31-findings', kind: 'findings', week: '2026-08-31', threads: [], joined: [], patterns: [], lens: [], seenOnce: [{ room: 'West', id: 'old1', idea: 'Water poured down the hill.' }], projects: [], inquiries: [] });
  };
  const fx = await start({ more, env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port } }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.waitForFunction(() => typeof yearOn === 'function' && yearOn());
  const sc = await s.p.evaluate(async () => { tRoom = 'West'; tRange = '8'; const r = await findThreads({ weekly: true, year: true }); return r && { year: r.year, seen: r.seenOnce, ev: r.threads[0].evidence.map(e => e.planId) }; });
  const q = asked.filter(x => /Find the threads/.test(x));
  assert.strictEqual(q.length, 1);
  assert.match(q[0], /The year record/); assert.match(q[0], /Water poured down the hill/); assert.match(q[0], /Poured water down the hill in August/, 'the earlier moment is read in its own words');
  assert.deepStrictEqual(sc, { year: true, seen: [{ planId: 'n2', idea: 'A child traced a shadow on the path.' }], ev: ['old1', 'n1'] });
  await s.p.evaluate(async () => { tRoom = 'West'; tRange = '8'; await findThreads({ weekly: true, year: true }); });
  assert.strictEqual(asked.filter(x => /Find the threads/.test(x)).length, 1, 'nothing changed, so the week\'s reading keeps last week\'s');
  await s.p.evaluate(() => { wrRoom = 'West'; goView('wreport'); }); await s.p.waitForSelector('text=The year record');
  assert.match(await s.p.innerText('#main'), /In use in the week's reading[\s\S]*Stop using the year record/);
  assert.deepStrictEqual(s.errors, []);
});
