'use strict';
/* Noticed and wondered, sorted. A Kaymbu caption with a wondering sentence arrives sorted into the two boxes, with the
   original kept for Put it back. A typed observation gets an offer and nothing moves until the educator says yes. The
   night offers on older observations. The move is made from the numbered sentences, so no word changes. Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const day = 864e5;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await wait(200); } return false; }
const CAPTION = 'Che carried the plank to the ramp. He set it beside the first one. I wonder if he wanted a second lane so no one waits.';

const more = put => {
  // an older observation with no wonder, two sentences, one of them wondering, for the night to offer on
  put('notices/old1.json', { id: 'old1', noticed: 'Leo stacked three blocks on the stump. Perhaps he is testing how high they balance.', wonder: '', at: Date.now() - 9 * day, classroom: 'West', by: 'Ann' });
  // one already sorted, one dismissed, and one with a wonder, which the night leaves alone
  put('notices/old2.json', { id: 'old2', noticed: 'Sat by the gate. Maybe waiting for a friend.', wonder: '', at: Date.now() - 9 * day, classroom: 'West', by: 'Ann', sortDismissed: true });
  put('notices/old3.json', { id: 'old3', noticed: 'Sat by the gate. Maybe waiting for a friend.', wonder: 'Who?', at: Date.now() - 9 * day, classroom: 'West', by: 'Ann' });
};

// the fake model answers the sort prompt by number, naming the sentence that holds a wondering word
async function setup(t) {
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString(); asked.push(body);
    let text = '{}';
    if (/box What I noticed/.test(body)) {
      const prompt = JSON.parse(body).messages[0].content[0].text;
      const nums = prompt.split('\n').map(l => l.match(/^(\d+)\. (.*)$/)).filter(Boolean).filter(m => /\b(I wonder|I think|maybe|perhaps)\b/i.test(m[2])).map(m => +m[1]);
      text = JSON.stringify({ wonder: nums, why: 'The last sentence asks what he wanted, so it reads as wondering.' });
    }
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port, KAYMBU_INBOX_KEY: 'kaymbu-test-key', SORT_DELAY_MS: '300', SUGGEST_DELAY_MS: '600' }, more }); t.after(() => fx.stop());
  const read = p => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const inbound = async (subject, caption) => { const html = `<table><tbody class="caption-and-notes"><tr class="caption"><td>${caption}</td></tr><tr class="notes"><td></td></tr></tbody></table>`;
    const r = await fetch(fx.api + '/inbound/kaymbu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'kaymbu-test-key', from: 'Kaymbu <noreply@kaymbu.com>', subject, date: new Date().toISOString(), html }) });
    return { status: r.status, body: await r.json() }; };
  const notice = key => { const dir = path.join(fx.dir, 'notices'); if (!fs.existsSync(dir)) return null; for (const f of fs.readdirSync(dir)) { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (d.kaymbu && d.kaymbu.key === key) return d; } return null; };
  return { fx, asked, read, inbound, notice };
}

test('a Kaymbu caption arrives sorted, whole sentences only, and Put it back restores it word for word', async t => {
  const { fx, asked, inbound, notice } = await setup(t);
  await until(() => fs.existsSync(path.join(fx.dir, 'settings/once.json')), 20000);
  const r = await inbound('West Ann', CAPTION); assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.strictEqual(r.body.kept, 1);
  const d = await until(() => notice(require('crypto').createHash('sha1').update(CAPTION + '\n').digest('hex').slice(0, 16)), 20000);
  assert.ok(d, 'the moment was kept'); assert.ok(await until(() => notice(d.kaymbu.key).sorted, 20000), 'the moment was sorted'); Object.assign(d, notice(d.kaymbu.key));
  assert.ok(d, 'the moment was sorted');
  assert.strictEqual(d.noticed, 'Che carried the plank to the ramp. He set it beside the first one.');
  assert.strictEqual(d.wonder, 'I wonder if he wanted a second lane so no one waits.');
  assert.deepStrictEqual([d.sorted.by, d.sorted.from.noticed, d.sorted.why], ['TREE', CAPTION, 'The last sentence asks what he wanted, so it reads as wondering.']);
  assert.ok(d.sorted.at > 0);
  const q = asked.filter(b => /box What I noticed/.test(b)); assert.ok(q.length >= 1);
  assert.match(q[0], /1\. Che carried the plank to the ramp\./); assert.match(q[0], /3\. I wonder if he wanted/);
  // Put it back, by the educator who kept it. Bea cannot.
  const ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token;
  assert.strictEqual((await fx.as(bea, '/api/notices/sort', { id: d.id, action: 'undo' })).status, 403);
  const u = await fx.as(ann, '/api/notices/sort', { id: d.id, action: 'undo' }); assert.strictEqual(u.status, 200, JSON.stringify(u.body));
  assert.deepStrictEqual([u.body.doc.noticed, u.body.doc.wonder, u.body.doc.sorted, u.body.doc.sortDismissed], [CAPTION, '', undefined, true]);
  await until(() => { const n = notice(d.kaymbu.key); return n && !n.sorted; }, 10000);
  assert.strictEqual(notice(d.kaymbu.key).noticed, CAPTION, 'the exact caption is back in the records');
});

test('a typed observation is offered its sort and nothing moves until the educator says yes, and the night offers on an old one', async t => {
  const { fx, read, asked } = await setup(t);
  await until(() => fs.existsSync(path.join(fx.dir, 'settings/once.json')), 20000);
  const ann = (await fx.login('Ann', '1357')).token, dee = (await fx.login('Dee', 'director-pass-1')).token, bea = (await fx.login('Bea', '1357')).token;
  const words = 'Mia poured the water slowly over the stones. Maybe she was watching how the color changed.';
  const w = await fx.as(ann, '/api/write', { op: 'set', kind: 'notices', id: 'nt1', data: { id: 'nt1', noticed: words, wonder: '', classroom: 'West', by: 'Ann', at: Date.now(), children: [] } });
  assert.strictEqual(w.status, 200, JSON.stringify(w.body));
  const d = await until(() => { const n = read('notices/nt1.json'); return n && n.sortOffer ? n : null; }, 20000);
  assert.ok(d, 'an offer was stored');
  assert.deepStrictEqual([d.noticed, d.wonder, d.sortOffer.wonderIdx, d.sorted], [words, '', [1], undefined], 'the words did not move');
  assert.match(d.sortOffer.why, /wondering/); assert.ok(d.sortOffer.at > 0);
  // the same words saved again keep the offer, and a second sentence with a wonder written is never offered
  const w2 = await fx.as(ann, '/api/write', { op: 'update', kind: 'notices', id: 'nt1', patch: { children: ['c1'] } }); assert.strictEqual(w2.status, 200);
  assert.deepStrictEqual(w2.body.doc.sortOffer.wonderIdx, [1], 'a save that leaves the words alone keeps the offer');
  // No, by someone else, is refused. The keeper's No clears the offer and marks it, so it is not offered again
  assert.strictEqual((await fx.as(bea, '/api/notices/sort', { id: 'nt1', action: 'dismiss' })).status, 403);
  await fx.as(ann, '/api/write', { op: 'set', kind: 'notices', id: 'nt2', data: { id: 'nt2', noticed: 'Sam dug a hole by the fence. I think he was looking for the worm from yesterday.', wonder: '', classroom: 'West', by: 'Ann', at: Date.now(), children: [] } });
  assert.ok(await until(() => read('notices/nt2.json') && read('notices/nt2.json').sortOffer, 20000));
  const no = await fx.as(ann, '/api/notices/sort', { id: 'nt2', action: 'dismiss' }); assert.strictEqual(no.status, 200);
  assert.deepStrictEqual([no.body.doc.sortOffer, no.body.doc.sortDismissed, no.body.doc.noticed.startsWith('Sam dug')], [undefined, true, true]);
  // Yes moves the sentence, from the stored numbers, and keeps the original
  const yes = await fx.as(ann, '/api/notices/sort', { id: 'nt1', action: 'accept' }); assert.strictEqual(yes.status, 200, JSON.stringify(yes.body));
  assert.deepStrictEqual([yes.body.doc.noticed, yes.body.doc.wonder, yes.body.doc.sortOffer, yes.body.doc.sorted.from.noticed, yes.body.doc.sorted.by], ['Mia poured the water slowly over the stones.', 'Maybe she was watching how the color changed.', undefined, words, 'TREE']);
  assert.ok(await until(() => read('notices/nt1.json') && read('notices/nt1.json').sorted, 10000));
  // the nightly pass offers on the old observation and leaves the dismissed one and the one with a wonder alone
  const before = asked.filter(b => /box What I noticed/.test(b)).length;
  const r = (await fx.as(dee, '/api/nightly', {})).body; assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual([r.sort.looked, r.sort.asked, r.sort.offered], [1, 1, 1]);
  assert.strictEqual(asked.filter(b => /box What I noticed/.test(b)).length, before + 1);
  assert.ok(await until(() => read('notices/old1.json') && read('notices/old1.json').sortOffer, 10000));
  assert.deepStrictEqual([read('notices/old1.json').sortOffer.wonderIdx, read('notices/old1.json').noticed.startsWith('Leo stacked'), read('notices/old2.json').sortOffer, read('notices/old3.json').sortOffer], [[1], true, undefined, undefined]);
  // Accept all for the class is the director's, and takes every open offer in it
  assert.strictEqual((await fx.as(ann, '/api/notices/sort', { action: 'acceptAll', classroom: 'West' })).status, 403);
  const all = await fx.as(dee, '/api/notices/sort', { action: 'acceptAll', classroom: 'West' }); assert.deepStrictEqual([all.status, all.body.moved], [200, 1]);
  assert.ok(await until(() => read('notices/old1.json') && read('notices/old1.json').sorted, 10000));
  assert.deepStrictEqual([read('notices/old1.json').noticed, read('notices/old1.json').wonder], ['Leo stacked three blocks on the stump.', 'Perhaps he is testing how high they balance.']);
});

test('the card shows the offer, and Yes moves the sentence', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, read } = await setup(t);
  await until(() => fs.existsSync(path.join(fx.dir, 'settings/once.json')), 20000);
  const ann = (await fx.login('Ann', '1357')).token;
  const words = 'Mia poured the water slowly over the stones. Maybe she was watching how the color changed.';
  await fx.as(ann, '/api/write', { op: 'set', kind: 'notices', id: 'nt1', data: { id: 'nt1', noticed: words, wonder: '', classroom: 'West', by: 'Ann', at: Date.now(), children: [] } });
  assert.ok(await until(() => read('notices/nt1.json') && read('notices/nt1.json').sortOffer, 20000));
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => s.close());
  await s.p.waitForFunction(() => notices.get('nt1') && notices.get('nt1').sortOffer, null, { timeout: 15000 });
  const card = await s.p.evaluate(() => noticeCard(notices.get('nt1')));
  assert.match(card, /This sentence reads as wondering\. Move it to What I wonder\?/); assert.match(card, /“Maybe she was watching how the color changed\.”/); assert.match(card, /data-sortyes="nt1"/); assert.match(card, /data-sortno="nt1"/);
  assert.match(await s.p.evaluate(() => { view = 'today'; return momentMini(notices.get('nt1')); }), /Move it to What I wonder/, 'the Today list shows it to the educator who kept it');
  await s.p.evaluate(() => { nRoom = 'All'; goView('moments'); }); await s.p.waitForSelector('[data-sortyes="nt1"]', { timeout: 10000 });
  await s.p.click('[data-sortyes="nt1"]');
  await s.p.waitForFunction(() => notices.get('nt1') && notices.get('nt1').sorted && notices.get('nt1').wonder === 'Maybe she was watching how the color changed.', null, { timeout: 10000 });
  assert.strictEqual(await s.p.evaluate(() => notices.get('nt1').noticed), 'Mia poured the water slowly over the stones.');
  assert.doesNotMatch(await s.p.evaluate(() => noticeCard(notices.get('nt1'))), /Move it to What I wonder/);
  assert.ok(await until(() => read('notices/nt1.json') && read('notices/nt1.json').sorted, 10000));
  assert.deepStrictEqual(s.errors, []);
});
