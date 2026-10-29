'use strict';
// A thread can follow more than one project, so a project shows only the observations kept for it and those the director
// added. TREE reads the project's threads and the ones that fit wait for the director with Add to project, Add all and
// Not this. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const day = 864e5;
const more = put => {
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', evidence: [] });
  put('projects/x1.json', { id: 'x1', name: 'The mud kitchen', experience: 'Children cook with mud and water in the yard.', home: 'West', status: 'active', createdAt: Date.now() - 9 * day, createdBy: 'Ann', classrooms: [{ room: 'West' }], threads: [{ id: 't1', at: Date.now() - 8 * day }] });
  put('notices/n0.json', { id: 'n0', noticed: 'Stirred a pot of mud soup and served it to friends.', at: Date.now() - 5 * day, projectId: 'x1', classroom: 'West', by: 'Ann' });
  put('notices/n1.json', { id: 'n1', noticed: 'Mixed water and dirt into a thick mud pie in the kitchen.', at: Date.now() - 3 * day, threadId: 't1', classroom: 'West', by: 'Ann' });
  put('notices/n2.json', { id: 'n2', noticed: 'Watched the rain run down the gutter into the drain by the gate.', at: Date.now() - 2 * day, threadId: 't1', classroom: 'West', by: 'Ann' });
  put('notices/n3.json', { id: 'n3', noticed: 'Poured water from the pitcher to make the mud soft for the cakes.', at: Date.now() - day, threadId: 't1', classroom: 'West', by: 'Ann' });
};

async function setup(t) {
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString(); asked.push(body);
    const text = /following this project/.test(body) ? JSON.stringify({ fits: [{ id: 'n1', why: 'They made a mud pie in the kitchen.' }, { id: 'n3', why: 'Softening the mud for cakes.' }] }) : '{}';
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more }); t.after(() => fx.stop());
  return { fx, asked: () => asked.filter(b => /following this project/.test(b)) };
}

test('only the director asks, and the server sends the observations that fit', async t => {
  const { fx, asked } = await setup(t);
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  assert.strictEqual((await fx.as(ann, '/api/projects/suggest', { id: 'x1' })).status, 403);
  const r = (await fx.as(dee, '/api/projects/suggest', { id: 'x1' })).body;
  assert.deepStrictEqual(r.suggest.map(s => [s.id, s.thread]), [['n1', 't1'], ['n3', 't1']]);
  const q = asked()[0]; assert.match(q, /mud pie/); assert.match(q, /rain run down the gutter/); assert.doesNotMatch(q, /mud soup/, 'one kept for the project is not asked about');
  assert.deepStrictEqual((await fx.as(dee, '/api/projects/suggest', { id: 'x1', key: r.key })).body, { same: true, key: r.key }, 'nothing new, no second reading');
  assert.strictEqual(asked().length, 1);
});

test('the project shows its own, and the director adds a suggestion, turns one down, or adds all', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx } = await setup(t);
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => openProject('x1'));
  await s.p.waitForSelector('[data-projadd="x1|n1"]', { timeout: 15000, state: 'attached' });
  assert.deepStrictEqual(await s.p.evaluate(() => projNotices(projects.get('x1')).map(n => n.id)), ['n0'], 'the thread observations are not in the project yet');
  const txt = await s.p.innerText('#main');
  assert.match(txt, /From its threads, waiting for you/); assert.doesNotMatch(txt, /rain run down the gutter/, 'one that does not fit is not suggested');
  await s.p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; }));
  await s.p.click('[data-projno="x1|n3"]'); await s.p.waitForTimeout(300);
  await s.p.click('[data-projadd="x1|n1"]'); await s.p.waitForTimeout(300);
  assert.deepStrictEqual(await s.p.evaluate(() => [projNotices(projects.get('x1')).map(n => n.id), projWaiting(projects.get('x1')).length, threadNotices(threads.get('t1')).map(n => n.id).sort()]), [['n1', 'n0'], 0, ['n1', 'n2', 'n3']], 'its thread keeps every one');
  assert.doesNotMatch(await s.p.innerText('#main'), /From its threads, waiting for you/);
  await new Promise(r => setTimeout(r, 2500));
  const x = JSON.parse(fs.readFileSync(path.join(fx.dir, 'projects/x1.json'), 'utf8'));
  assert.deepStrictEqual([x.evidence.map(e => [e.planId, e.via, e.by]), x.suggestNo.map(a => a.id)], [[['n1', 'suggest', 'Dee']], ['n3']]);
  // Add all, from a fresh suggestion
  await s.p.evaluate(() => { const x = projects.get('x1'); x.suggestNo = []; x.suggest = [{ id: 'n3', why: 'Softening the mud.', thread: 't1' }, { id: 'n2', why: 'Rain.', thread: 't1' }]; renderMain(); });
  await s.p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; }));
  await s.p.click('[data-projaddall="x1"]'); await s.p.waitForTimeout(300);
  assert.deepStrictEqual(await s.p.evaluate(() => projNotices(projects.get('x1')).map(n => n.id)), ['n3', 'n2', 'n1', 'n0']);
  assert.deepStrictEqual(s.errors, []);
  // an educator sees the project's own observations, and nothing waiting
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  await a.p.evaluate(() => openProject('x1')); await a.p.waitForSelector('text=Stirred a pot of mud soup', { timeout: 15000, state: 'attached' });
  assert.strictEqual(await a.p.$('[data-projadd]'), null);
});
