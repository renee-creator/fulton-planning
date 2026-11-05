'use strict';
// The night's lens reading. A sentence a lens word finds is read with its context, and only a sentence that shows the
// lens is a passage. "wait in line" is set aside, "a stool to represent a bridge" is kept with a why, a keep by hand
// survives the next run, and the page shows the kept one with its why and the other in a fold. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const LINE = 'The children had to wait in line for the one sink after the mud.';
const BRIDGE = 'A child put a stool across the creek to represent a bridge and walked the goat over it.';

async function setup(t) {
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString();
    let text = '{}';
    if (/truly shows the lens/.test(body)) {
      const prompt = JSON.parse(body).messages[0].content[0].text; const items = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
      asked.push(items);
      text = JSON.stringify({ passages: items.map(it => /wait in line/.test(it.sentence) ? { key: it.key, keep: false, why: 'The children were waiting their turn at the sink, and no one made a line on anything.' }
        : { key: it.key, keep: true, why: 'The stool stands for a bridge, so the child gave a bridge a form with an object.' }) });
    }
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port } }); t.after(() => fx.stop());
  const ann = (await fx.login('Ann', '1357')).token, dee = (await fx.login('Dee', 'director-pass-1')).token;
  const at = Date.now() - 36e5;
  for (const [id, noticed] of [['n-line', LINE], ['n-bridge', BRIDGE]]) {
    const w = await fx.as(ann, '/api/write', { op: 'set', kind: 'notices', id, data: { id, noticed, wonder: '', classroom: 'West', by: 'Ann', at } });
    assert.strictEqual(w.status, 200);
  }
  return { fx, ann, dee, asked };
}
const entries = p => Object.entries(p || {}).filter(([k, v]) => v && typeof v === 'object' && 'kept' in v);

test('the lens pass sets aside a word match and keeps a passage with its why, and a keep by hand survives the next run', async t => {
  const { fx, ann, dee, asked } = await setup(t);
  const no = await fx.as(ann, '/api/lens/read', {}); assert.strictEqual(no.status, 403);
  const r1 = await fx.as(dee, '/api/lens/read', {}); assert.strictEqual(r1.status, 200);
  assert.strictEqual(r1.body.counts.read, 2); assert.strictEqual(r1.body.counts.kept, 1); assert.strictEqual(r1.body.counts.aside, 1);
  assert.strictEqual(asked.length, 1, 'both sentences went in one request');
  const sent = asked[0]; assert.ok(sent.every(it => it.context && it.part === 'What I noticed'), 'each sentence goes with its context');
  const e = entries(r1.body.passages); assert.strictEqual(e.length, 2);
  const line = e.find(([, v]) => v.planId === 'n-line'), bridge = e.find(([, v]) => v.planId === 'n-bridge');
  assert.strictEqual(line[1].kept, false); assert.match(line[1].why, /waiting their turn/); assert.strictEqual(line[1].by, 'TREE');
  assert.strictEqual(bridge[1].kept, true); assert.match(bridge[1].why, /stands for a bridge/); assert.strictEqual(bridge[1].lens, 'lens1');
  assert.ok(/^lens1\.n-bridge\.[0-9a-f]{8}$/.test(bridge[0]), bridge[0]);
  // nothing waits now, so a second run asks nothing
  const r2 = await fx.as(dee, '/api/lens/read', {}); assert.strictEqual(r2.body.counts.read, 0); assert.strictEqual(asked.length, 1);
  // an educator keeps the set-aside one by hand, and a third run, with the record forgotten first, leaves it as she said
  const keep = await fx.as(ann, '/api/lens/passage', { key: line[0], keep: true, why: 'They lined the stones up along the sink edge while they waited.' });
  assert.strictEqual(keep.status, 200); assert.strictEqual(keep.body.entry.byHand, true); assert.strictEqual(keep.body.entry.by, 'Ann');
  const r3 = await fx.as(dee, '/api/lens/read', {}); assert.strictEqual(r3.status, 200);
  const after = entries(r3.body.passages).find(([k]) => k === line[0])[1];
  assert.strictEqual(after.kept, true); assert.strictEqual(after.byHand, true); assert.match(after.why, /lined the stones/);
  // the record is in the records, and a device cannot write it through the ordinary save
  await new Promise(r => setTimeout(r, 1500));
  const saved = JSON.parse(fs.readFileSync(path.join(fx.dir, 'lens', 'passages.json'), 'utf8'));
  assert.strictEqual(saved[line[0]].by, 'Ann'); assert.strictEqual(saved[bridge[0]].by, 'TREE');
  const w = await fx.as(ann, '/api/write', { op: 'set', kind: 'lens', id: 'passages', data: {} }); assert.strictEqual(w.status, 403);
  // the record reaches the page's data like any other
  const d = await fx.as(ann, '/api/data', {}); assert.ok(d.body.data.lens && d.body.data.lens.passages && d.body.data.lens.passages[bridge[0]]);
});

test('the Lens page shows the kept passage with its why, the other in a fold, and Keep it moves it into the passages', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, dee } = await setup(t);
  const r1 = await fx.as(dee, '/api/lens/read', {}); assert.strictEqual(r1.body.counts.read, 2);
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1200); t.after(() => s.close());
  await s.p.evaluate(() => { lRoom = 'All'; lRange = 'year'; goView('lens'); }); await s.p.waitForSelector('#lens-aside', { state: 'attached', timeout: 15000 });
  const section = await s.p.evaluate(() => document.querySelector('#main').innerText);
  assert.match(section, /stool across the creek to represent a bridge/);
  assert.match(section, /Why TREE offered it\. The stool stands for a bridge/);
  assert.ok(!/Waiting for tonight/.test(section), 'nothing waits once both are read');
  // the set-aside sentence is only in the fold, with the reading's why and Keep it
  await s.p.evaluate(() => { document.querySelector('#lens-aside').open = true; });
  const inFold = await s.p.$eval('#lens-aside', e => e.innerText);
  assert.match(inFold, /Found by a word, set aside by the reading/); assert.match(inFold, /wait in line for the one sink/); assert.match(inFold, /waiting their turn at the sink/);
  const outside = await s.p.evaluate(() => { const m = document.querySelector('#main').cloneNode(true); m.querySelector('#lens-aside').remove(); return m.innerText; });
  assert.ok(!/wait in line/.test(outside), 'the set-aside sentence is not among the passages');
  assert.match(outside, /\b1\s*moments in educators' words/, 'the tally counts kept passages only');
  // the print lists the kept one with its why
  const print = await s.p.evaluate(() => JSON.stringify(lensDocs(true).flatMap(d => d.blocks).map(b => b.text || '')));
  assert.match(print, /represent a bridge/); assert.match(print, /Why TREE offered it\. The stool stands for a bridge/); assert.ok(!/wait in line/.test(print));
  // Keep it brings it into the passages, with her name, and the server keeps it by hand
  await s.p.click('[data-lkeep]'); await s.p.waitForTimeout(1200);
  const now = await s.p.evaluate(() => document.querySelector('#main').innerText);
  assert.ok(!/Found by a word, set aside/.test(now), 'the fold is gone once nothing is set aside');
  assert.match(now, /wait in line for the one sink/); assert.match(now, /Kept by Dee\./); assert.match(now, /\b2\s*moments in educators' words/);
  const key = await s.p.evaluate(() => Object.keys(lensPassages).find(k => lensPassages[k] && lensPassages[k].planId === 'n-line'));
  const d = await fx.as(dee, '/api/data', {}); const e = d.body.data.lens.passages[key];
  assert.strictEqual(e.kept, true); assert.strictEqual(e.byHand, true); assert.strictEqual(e.by, 'Dee');
  assert.deepStrictEqual(s.errors, []);
});
