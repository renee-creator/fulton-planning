'use strict';
// An observation kept for a project, that does not belong there, is taken out of the project by the director with Not part of this project. Its threads stay as they are, and Put it back returns it.
// Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const more = put => {
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', evidence: [] });
  put('projects/x1.json', { id: 'x1', name: 'The mud kitchen', home: 'West', status: 'active', createdAt: Date.now() - 5 * 864e5, createdBy: 'Ann', classrooms: [{ room: 'West' }], threads: [{ id: 't1', at: Date.now() - 4 * 864e5 }] });
  put('notices/n1.json', { id: 'n1', noticed: 'Poured water down the hill and watched it pool.', at: Date.now() - 864e5, threadId: 't1', projectId: 'x1', classroom: 'West', by: 'Ann' });
  put('notices/n2.json', { id: 'n2', noticed: 'Sang the goodbye song at pickup.', at: Date.now() - 2 * 864e5, threadId: 't1', projectId: 'x1', classroom: 'West', by: 'Ann' });
};

test('Not part of this project takes an observation out of the project only, and Put it back returns it', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => openProject('x1')); await s.p.waitForSelector('[data-projout="x1|n2"]', { timeout: 15000, state: 'attached' });
  await s.p.click('summary:has-text("Observations")');
  await s.p.click('#pmore-n2 > summary');
  assert.match(await s.p.innerText('#main'), /Sang the goodbye song/);
  await s.p.click('[data-projout="x1|n2"]'); await s.p.waitForTimeout(500);
  const txt = await s.p.innerText('#main');
  assert.match(txt, /Poured water down the hill/); assert.match(txt, /Not part of this project, 1/);
  assert.deepStrictEqual(await s.p.evaluate(() => [projNotices(projects.get('x1')).map(n => n.id), threadNotices(threads.get('t1')).map(n => n.id).sort()]), [['n1'], ['n1', 'n2']], 'the thread keeps it');
  await new Promise(r => setTimeout(r, 2500));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(fx.dir, 'projects/x1.json'), 'utf8')).setAside.map(a => [a.id, a.by]), [['n2', 'Dee']]);
  await s.p.click('summary:has-text("Not part of this project, 1")'); await s.p.click('[data-projback="x1|n2"]'); await s.p.waitForTimeout(500);
  assert.deepStrictEqual(await s.p.evaluate(() => projNotices(projects.get('x1')).map(n => n.id)), ['n1', 'n2']);
  assert.deepStrictEqual(s.errors, []);
  // an educator sees the observations, with no button to take one out
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  await a.p.evaluate(() => openProject('x1')); await a.p.waitForSelector('text=Poured water down the hill', { timeout: 15000, state: 'attached' });
  assert.strictEqual(await a.p.$('[data-projout]'), null);
});
