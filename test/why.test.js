'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { start, browser, signedIn } = require('/home/claude/fulton-planning/.claude/worktrees/agent-a9a99338ad6f189cb/test/fixture.js');
const day = 864e5;
const monday = () => { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const more = put => {
  const wk = monday(), prev = isoOf(new Date(wk.getTime() - 7 * day));
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', status: 'growing', evidence: [], weeks: [prev], createdAt: Date.now() - 30 * day, followedBy: 'Ann' });
  put('threads/t2.json', { id: 't2', name: 'Shadows at noon', classroom: 'West', question: 'Where do shadows go?', status: 'emerging', evidence: [], createdAt: Date.now() - 20 * day, followedBy: 'Ann' });
  put('notices/w0.json', { id: 'w0', noticed: 'Poured water down the hill and watched it pool', at: Date.now() - 2 * day, classroom: 'West', by: 'Ann', threadSuggest: [{ id: 't2', why: 'The puddle caught the shade' }] });
  put('notices/w1.json', { id: 'w1', noticed: 'Carried mud to the shade and watched it dry', at: Date.now() - 3 * day, classroom: 'West', by: 'Ann' });
  put('projects/x1.json', { id: 'x1', name: 'The mud kitchen', home: 'West', status: 'active', createdAt: Date.now() - 9 * day, createdBy: 'Dee', classrooms: [{ room: 'West' }], threads: [{ id: 't1', at: Date.now() - 8 * day }],
    threadSuggest: [{ id: 't2', why: 'The same children carry shade into the mud play.' }], underneath: 'Perhaps children are testing where water goes.', intent: 'To follow the water with them.', found: { at: Date.now(), items: [{ id: 'w1', why: 'The mud came back to the kitchen.' }] } });
  put('inquiries/q1.json', { id: 'q1', name: 'Running from lunch', room: 'West', status: 'open', createdAt: Date.now() - 5 * day, createdBy: 'Dee', obs: [], found: { at: Date.now(), items: [{ id: 'w1', why: 'Perhaps the child was looking for shade.' }] } });
};
test('the why stays with what TREE offered', async t => {
  const b = await browser(); const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1300); t.after(() => s.close());
  const txt = () => s.p.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; return document.querySelector('#main').innerText; });
  const open = () => s.p.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });
  // project. a thread the reading suggested, and an observation the reading found
  await s.p.evaluate(() => openProject('x1')); await s.p.waitForSelector('[data-ptsadd="x1|t2"]', { state: 'attached' }); await open();
  await s.p.click('[data-ptsadd="x1|t2"]'); await s.p.waitForTimeout(400);
  assert.deepStrictEqual(await s.p.evaluate(() => projects.get('x1').threads.map(l => [l.id, l.why || ''])), [['t1', ''], ['t2', 'The same children carry shade into the mud play.']]);
  await s.p.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });
  assert.match(await txt(), /Why TREE offered it\. The same children carry shade into the mud play\./);
  await open(); await s.p.click('[data-projadd="x1|w1"]'); await s.p.waitForTimeout(400);
  const ev = await s.p.evaluate(() => projects.get('x1').evidence.map(e => [e.planId, e.via, e.why]));
  assert.deepStrictEqual(ev, [['w1', 'weekly', 'The mud came back to the kitchen.']]);
  await s.p.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });
  assert.match(await txt(), /Why TREE offered it\. The mud came back to the kitchen\./);
  // the why is editable on the project page
  await open(); { const u = await s.p.$('[data-unlock]'); if (u) { await u.click(); await s.p.waitForTimeout(200); await open(); } } await s.p.click('[data-whyedit="pev|x1|w1"]'); await s.p.fill('[data-whybox="pev|x1|w1"]', 'The mud came back, and so did the shade');
  await open(); await s.p.click('[data-whysave="pev|x1|w1"]'); await s.p.waitForTimeout(300);
  assert.strictEqual(await s.p.evaluate(() => projects.get('x1').evidence[0].why), 'The mud came back, and so did the shade');
  // the project print carries both
  const pdoc = await s.p.evaluate(() => JSON.stringify(projectDoc(projects.get('x1'), true).blocks.filter(b => b.quiet).map(b => b.text)));
  assert.match(pdoc, /Why TREE offered it\. The same children carry shade/); assert.match(pdoc, /Why TREE offered it\. The mud came back, and so did the shade\./);
  // How it connects reads the same stored why
  const how = await s.p.evaluate(() => howEvents().ev.filter(e => e.why).map(e => e.why));
  assert.ok(how.includes('The same children carry shade into the mud play.') && how.includes('The mud came back, and so did the shade'));
  // inquiry. an observation the reading found keeps its why and prints it
  await s.p.evaluate(() => { goView('inquiries'); }); await s.p.waitForSelector('[data-iqopen="q1"]'); await s.p.click('[data-iqopen="q1"]'); await s.p.waitForSelector('[data-fdadd="inquiry|q1|w1"]', { state: 'attached' }); await open();
  await s.p.click('[data-fdadd="inquiry|q1|w1"]'); await s.p.waitForTimeout(400);
  assert.strictEqual(await s.p.evaluate(() => inquiries.get('q1').obsFound.w1.why), 'Perhaps the child was looking for shade.');
  assert.match(await txt(), /Why TREE offered it\. Perhaps the child was looking for shade\./);
  const idoc = await s.p.evaluate(() => JSON.stringify(inquiryDoc(inquiries.get('q1'), true).blocks.filter(b => b.quiet).map(b => b.text)));
  assert.match(idoc, /Why TREE offered it\. Perhaps the child was looking for shade\./);
  // a thread suggested on an observation keeps its why on the thread's evidence, shown on the thread and the observation card
  await s.p.evaluate(() => goView('moments')); await s.p.waitForSelector('[data-tsadd="w0|t2"]', { state: 'attached' }); await open();
  await s.p.click('[data-tsadd="w0|t2"]'); await s.p.waitForTimeout(400);
  assert.deepStrictEqual(await s.p.evaluate(() => threads.get('t2').evidence.map(e => [e.planId, e.via, e.why])), [['w0', 'suggest', 'The puddle caught the shade']]);
  assert.match(await txt(), /Why TREE offered it\. The puddle caught the shade\./);
  await s.p.evaluate(() => goView('threads')); await s.p.waitForSelector('#th-t2', { state: 'attached' }); await open();
  assert.match(await s.p.$eval('#th-t2', e => e.innerText), /Why TREE offered it\. The puddle caught the shade\./);
  const tdoc = await s.p.evaluate(() => JSON.stringify(threadDoc(threads.get('t2')).blocks.filter(b => b.quiet).map(b => b.text)));
  assert.match(tdoc, /Why TREE offered it\. The puddle caught the shade\./);
  // reading width. on a wide screen the hint follows the card up to 105ch, on a phone it keeps 72ch
  await s.p.evaluate(() => openProject('x1')); await s.p.waitForSelector('.card .hint');
  const wide = await s.p.$eval('.card .hint', e => getComputedStyle(e).maxWidth);
  await s.p.setViewportSize({ width: 390, height: 800 }); await s.p.waitForTimeout(200);
  const phone = await s.p.$eval('.card .hint', e => getComputedStyle(e).maxWidth);
  assert.ok(parseFloat(wide) > parseFloat(phone) * 1.3, wide + ' vs ' + phone);
  assert.deepStrictEqual(s.errors, []);
});
