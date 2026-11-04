'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { start, browser, signedIn } = require('/home/claude/fulton-planning/.claude/worktrees/agent-a9a99338ad6f189cb/test/fixture.js');
const day = 864e5;
const more = put => {
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', status: 'growing', evidence: [{ planId: 'w0', week: '2026-10-26', text: 'Poured water down the hill' }], weeks: ['2026-10-26'], createdAt: Date.now() - 30 * day, followedBy: 'Ann' });
  put('notices/w0.json', { id: 'w0', noticed: 'Poured water down the hill and watched it pool', at: Date.now() - 2 * day, classroom: 'West', by: 'Ann' });
  put('notices/w1.json', { id: 'w1', noticed: 'Carried mud to the shade and watched it dry', at: Date.now() - 3 * day, classroom: 'West', by: 'Ann' });
  put('scans/All.json', { room: 'All', range: '8', createdAt: Date.now() - day, summary: 'Water.', threads: [{ name: 'Mud in the shade', question: 'Children may be asking where the mud dries.', classroom: 'West', groups: [], status: 'emerging', weeks: ['2026-10-26'], evidence: [{ planId: 'w0', week: '2026-10-26', text: 'Poured water down the hill' }, { planId: 'w1', week: '2026-10-26', text: 'Carried mud to the shade' }], languages: [], next: [] }] });
  put('scans/lens-All.json', { room: 'lens-All', kind: 'lens', range: '8', createdAt: Date.now() - day, lensId: 'lens1', lensName: 'Graphic Languages', questionsAsked: ['What did the child make?'], summary: 'Marks.', moments: [{ planId: 'w1', quote: 'Carried mud to the shade', language: '', why: 'The child drew with the mud as it dried.', answers: ['A drying mark'] }], gaps: [], teamQuestions: [] });
};
test('one project and lens moments keep their why', async t => {
  const b = await browser(); const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1300); t.after(() => s.close());
  const open = () => s.p.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });
  await s.p.evaluate(() => { tRoom = 'All'; goView('threads'); }); await s.p.waitForSelector('[data-onestart]', { state: 'attached' });
  await s.p.click('[data-onestart]'); await s.p.waitForTimeout(500);
  const pr = await s.p.evaluate(() => { const x = [...projects.values()][0]; return { why: x.why, tw: x.threads.map(l => l.why) }; });
  assert.match(pr.why, /^These may be one project\. .*Mud in the shade.*1 piece.*2 pieces|These may be one project\./);
  assert.ok(pr.tw.every(w => w === pr.why));
  await open(); assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /Why TREE offered it\. These may be one project\./);
  // the found thread's evidence, now a thread, keeps the found reading on a joined thread's evidence when Find threads adds to a followed one
  // the lens closer reading shows the why under each moment, on the observation card and in the lens print
  await s.p.evaluate(() => { lRoom = 'All'; goView('lens'); }); await s.p.waitForTimeout(600); await open();
  const lt = await s.p.evaluate(() => document.querySelector('#main').innerText);
  assert.match(lt, /Why TREE offered it\. The child drew with the mud as it dried\./);
  const ld = await s.p.evaluate(() => JSON.stringify(lensDocs(true).flatMap(d => d.blocks).filter(b => b.quiet).map(b => b.text)));
  assert.match(ld, /Why TREE offered it\. The child drew with the mud as it dried\./);
  await s.p.evaluate(() => goView('moments')); await s.p.waitForSelector('#nw-w1', { state: 'attached' });
  assert.match(await s.p.$eval('#nw-w1', e => e.innerText), /Why TREE offered it\. The child drew with the mud as it dried\./);
  // the lens why is editable by the director
  await s.p.evaluate(() => { lRoom = 'All'; goView('lens'); }); await s.p.waitForTimeout(600); await open();
  await s.p.click('[data-whyedit^="lens|"]'); await s.p.fill('[data-whybox^="lens|"]', 'A mark left in the mud'); await s.p.click('[data-whysave^="lens|"]'); await s.p.waitForTimeout(300);
  assert.strictEqual(await s.p.evaluate(() => scans.get('lens-All').moments[0].why), 'A mark left in the mud');
  // the staff room display is untouched by the width rule
  assert.ok(!require('fs').readFileSync('/home/claude/fulton-planning/.claude/worktrees/agent-a9a99338ad6f189cb/display.html', 'utf8').includes('105ch'));
  assert.deepStrictEqual(s.errors, []);
});
