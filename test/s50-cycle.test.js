'use strict';
// November 4, 2026. A thread or a plan from an observation, remarks that never expire and drafts that carry forward, a plan's
// week of observations, Today's one Wonder, Start a plan from what grew, the readings that stay all week, the project page's
// suggestions and the children's question, Find threads offering a project, place chips, child height prints, Before Monday
// and the resized photos. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const day = 864e5;
const monday = () => { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const more = put => {
  const wk = monday(), wkIso = isoOf(wk), old = new Date(wk.getTime() - 6 * 7 * day), oldIso = isoOf(old), prev = isoOf(new Date(wk.getTime() - 7 * day));
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', status: 'growing', evidence: [], weeks: [prev], createdAt: Date.now() - 30 * day, followedBy: 'Ann' });
  put('threads/t3.json', { id: 't3', name: 'Pipes in the sand', classroom: 'West', question: 'Children may be asking how water travels.', status: 'emerging', evidence: [{ planId: 'n9', week: prev, text: 'Rolled the big tyre' }], createdAt: Date.now() - 12 * day, followedBy: 'Ann' });
  put('threads/t2.json', { id: 't2', name: 'Shadows at noon', classroom: 'West', question: 'Where do shadows go?', status: 'emerging', evidence: [], createdAt: Date.now() - 20 * day, followedBy: 'Ann' });
  // three observations this week in the thread, one of them today from Kaymbu with no wonder, each with a place
  for (let i = 0; i < 3; i++) put(`notices/w${i}.json`, { id: 'w' + i, noticed: 'Poured water down the hill and watched it pool ' + i, at: wk.getTime() + 9 * 36e5 + i * 36e5 + (i === 2 ? (Date.now() - wk.getTime() - 9 * 36e5 - 2 * 36e5) : 0), threadId: 't1', classroom: 'West', by: 'Ann', smallGroup: 'Marigold', place: ['The creek'], photo: { id: 'ph-w' + i, w: 800, h: 600 }, kaymbu: i === 2 ? { keptAt: Date.now() } : undefined, lensIds: [] });
  put('notices/n9.json', { id: 'n9', noticed: 'Rolled the big tyre across the yard.\nWren - It goes where I push it', at: Date.now() - 20 * day, classroom: 'West', by: 'Ann', place: ['The yard'] });
  put('projects/x1.json', { id: 'x1', name: 'The mud kitchen', home: 'West', status: 'active', createdAt: Date.now() - 9 * day, createdBy: 'Dee', classrooms: [{ room: 'West' }], threads: [{ id: 't1', at: Date.now() - 8 * day }], threadSuggest: [{ id: 't2', why: 'The same children carry shade into the mud play.' }], underneath: 'Perhaps children are testing where water goes.', intent: 'To follow the water with them.' });
  // an old draft Individual plan with only its remarks written, and an old plan following the thread with final remarks
  put('plans/old1.json', { id: 'old1', type: 'individual', weekOf: oldIso, classroom: 'West', educator: 'Ann', status: 'draft', focus: 'area', groups: [], fields: { remarks: 'They kept returning to the slope after rain.' }, createdAt: Date.now() - 40 * day, updatedAt: Date.now() - 40 * day });
  put('plans/due1.json', { id: 'due1', type: 'individual', weekOf: oldIso, classroom: 'West', educator: 'Ann', status: 'reviewed', focus: 'area', groups: [], fields: { area: 'Slopes', observation: 'Water on the slope.', intent: 'Follow.', questions: 'Where?', dates: 'x', activities: 'x' }, createdAt: Date.now() - 41 * day, updatedAt: Date.now() - 41 * day });
  put('plans/fol1.json', { id: 'fol1', type: 'individual', weekOf: prev, classroom: 'West', educator: 'Ann', status: 'reviewed', threadId: 't1', focus: 'area', groups: [], fields: { area: 'Water', observation: 'Pooling.', intent: 'Follow it.', questions: 'Where?', remarks: 'The water went under the fence and the children followed it.', dates: 'x', activities: 'x' }, createdAt: Date.now() - 10 * day, updatedAt: Date.now() - 10 * day });
};

test('an observation starts a thread or a plan, remarks never expire, a draft with remarks carries forward, and a plan lists its week', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  // Final remarks six weeks old still wait on Today
  await a.p.evaluate(() => goView('today')); await a.p.waitForSelector('text=Final remarks still to write', { timeout: 15000 });
  // one Wonder for today's Kaymbu photo, folded, opens the observation with the Wonder box focused
  await a.p.waitForSelector('#wondertoday', { state: 'attached' });
  assert.strictEqual(await a.p.$eval('#wondertoday', d => d.open), false, 'folded to start');
  await a.p.click('#wondertoday > summary'); await a.p.click('[data-wonderadd]'); await a.p.waitForSelector('#nf-wonder');
  assert.strictEqual(await a.p.evaluate(() => document.activeElement && document.activeElement.id), 'nf-wonder');
  await a.p.click('#nf-cancel'); await a.p.waitForTimeout(300);
  await a.p.evaluate(() => goView('today')); await a.p.waitForTimeout(500);
  assert.strictEqual(await a.p.$('#wondertoday'), null, 'shows once a day on this device');
  // Start a new thread from this, in the observation form's Thread picker
  await a.p.evaluate(() => openObservation('n9')); await a.p.waitForSelector('#nw-n9');
  await a.p.click('#nw-n9 [data-nwedit]'); await a.p.waitForSelector('#nf-thread');
  assert.match(await a.p.$eval('#nf-thread', s => s.innerText), /Start a new thread from this/);
  await a.p.selectOption('#nf-thread', '__new'); await a.p.click('#nf-save');
  await a.p.waitForFunction(() => view === 'threads' && [...threads.values()].some(t => t.name === 'Rolled the big tyre across the yard.'), null, { timeout: 15000 });
  const nt = await a.p.evaluate(() => { const t = [...threads.values()].find(t => t.name === 'Rolled the big tyre across the yard.'); return { q: t.question, ev: t.evidence.map(e => [e.planId, e.via]), room: t.classroom, obs: notices.get('n9').threadId === t.id, hand: !!(t.origin && t.origin.hand) }; });
  assert.deepStrictEqual(nt, { q: '', ev: [['n9', 'hand']], room: 'West', obs: true, hand: true });
  // Start a plan from the card's More menu, the words dropped into the Observation rationale, the observation linked
  await a.p.evaluate(() => openObservation('n9')); await a.p.waitForSelector('#nw-n9 [data-nwplan]', { state: 'attached' });
  await a.p.evaluate(() => document.querySelector('#nw-n9 [data-nwplan]').click()); await a.p.waitForSelector('#f-observation');
  const np = await a.p.evaluate(() => { const p = plans.get(currentId); return { type: p.type, room: p.classroom, obs: p.fields.observation, added: p.noticeAdded, linked: notices.get('n9').planId === p.id }; });
  assert.strictEqual(np.type, 'individual'); assert.strictEqual(np.room, 'West'); assert.match(np.obs, /Rolled the big tyre across the yard/); assert.deepStrictEqual(np.added, ['n9']); assert.ok(np.linked);
  // a draft with only its remarks written carries forward. The remarks become the new Observation rationale and nothing else, the old plan stays
  await a.p.evaluate(() => { currentId = 'old1'; view = 'plans'; renderAll(); }); await a.p.waitForSelector('#carry', { state: 'attached' });
  await a.p.evaluate(() => carryForward(plans.get('old1')));
  await a.p.waitForFunction(() => plans.get(currentId) && plans.get(currentId).prevId === 'old1', null, { timeout: 10000 });
  const cf = await a.p.evaluate(() => { const p = plans.get(currentId), o = plans.get('old1'); return { obs: p.fields.observation, keys: Object.keys(p.fields).filter(k => String(p.fields[k] || '').trim()), oldRemarks: o.fields.remarks, oldStatus: o.status }; });
  assert.deepStrictEqual(cf, { obs: 'They kept returning to the slope after rain.', keys: ['observation'], oldRemarks: 'They kept returning to the slope after rain.', oldStatus: 'draft' });
  // the plan page lists its own week's observations, folded, with a count, matching its small group
  await a.p.evaluate(() => { const p = newPlan('individual', { weekOf: mondayOf(new Date()), classroom: 'West' }); p.focus = 'smallgroup'; p.groups = ['Marigold']; plans.set(p.id, p); persist(p); currentId = p.id; renderAll(); });
  await a.p.waitForSelector('details.planobs', { state: 'attached' });
  const po = await a.p.$eval('details.planobs', d => ({ open: d.open, sum: d.querySelector('summary').innerText, n: d.querySelectorAll('.evob').length }));
  assert.strictEqual(po.open, false); assert.match(po.sum, /Formal observations[\s\S]*3 this week, matching this plan/); assert.strictEqual(po.n, 3);
  // place chips on the card and the place filter on Observations
  await a.p.evaluate(() => openObservation('w0')); await a.p.waitForSelector('#nw-w0 .placechips', { state: 'attached' });
  assert.match(await a.p.$eval('#nw-w0 .placechips', el => el.innerText), /The creek/);
  await a.p.evaluate(() => document.querySelector('#nw-w0 [data-placego]').click()); await a.p.waitForTimeout(400);
  assert.deepStrictEqual(await a.p.evaluate(() => [nPlace, momentsIn().map(n => n.id).sort()]), ['The creek', ['w0', 'w1', 'w2']]);
  await a.p.evaluate(() => document.querySelector('[data-nplace=""]').click()); await a.p.waitForTimeout(300);
  assert.strictEqual(await a.p.evaluate(() => momentsIn().length), 4);
  assert.deepStrictEqual(a.errors, []);
});

test('the director sees what grew, Before Monday, the readings all week, the project suggestions, the children\'s question and a project from two threads', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  // Start a plan from what grew, a followed thread with three observations this week
  await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('[data-grewplan="t1"]', { timeout: 15000 });
  await s.p.click('[data-grewplan="t1"]'); await s.p.waitForSelector('#f-observation');
  const gp = await s.p.evaluate(() => { const p = plans.get(currentId); return { thread: p.threadId, n: (p.noticeAdded || []).length, obs: p.fields.observation }; });
  assert.strictEqual(gp.thread, 't1'); assert.strictEqual(gp.n, 3); assert.match(gp.obs, /Poured water down the hill/);
  // Before Monday, from cycleHealth in the data head, folded, each name a link
  await s.p.evaluate(() => { window.FP_CYCLE = { noWonder: ['Ann'], noPlan: ['t2'], remarksUnwritten: ['old1'], draftsNotSent: [{ id: 'old1' }] }; goView('today'); });
  await s.p.waitForSelector('#beforemonday', { state: 'attached' });
  const bm = await s.p.$eval('#beforemonday', d => ({ open: d.open, text: d.innerText, links: [...d.querySelectorAll('button')].map(b => b.textContent) }));
  assert.strictEqual(bm.open, false); assert.match(bm.text, /Before Monday[\s\S]*4 things to look at/);
  assert.ok(bm.links.includes('Ann') && bm.links.includes('Shadows at noon'));
  await s.p.evaluate(() => { window.FP_CYCLE = null; });
  // the reading is done line folds once seen rather than hiding, and the report line stays all week, folded
  await s.p.evaluate(() => { weeklyRec = { week: mondayOf(new Date()), done: true, threads: 1, doneSteps: [], tally: {} }; db.doc('settings/weekly').set(weeklyRec); const wk = mondayOf(new Date()); const r = { id: wk + '-All', week: wk, room: 'All', emerging: 'A tower is just appearing.', findings: { threads: [{ name: 'Water and mud', why: 'Three this week.', thread: 't1' }] } }; reports.set(r.id, r); db.doc('reports/' + r.id).set(r); renderMain(); });
  await s.p.waitForSelector('#weeklydone', { state: 'attached' }); await s.p.waitForTimeout(2500); await s.p.evaluate(() => { weeklyRec = Object.assign({}, weeklyRec || {}, { week: mondayOf(new Date()), done: true, threads: 1 }); renderMain(); });
  assert.strictEqual(await s.p.$eval('#weeklydone', d => d.open), false, 'closed to start');
  await s.p.click('#weeklydone > summary'); await s.p.click('[data-weeklyok]'); await s.p.waitForTimeout(300);
  assert.ok(await s.p.$('#weeklydone'), 'still there once seen'); assert.strictEqual(await s.p.$eval('#weeklydone', d => d.open), false);
  await s.p.evaluate(() => { LS.set('tree.wrseen', mondayOf(new Date())); todayAll = true; renderMain(); }); await s.p.waitForFunction(() => reports.size > 0, null, { timeout: 10000 }); await s.p.evaluate(() => renderMain()); await s.p.waitForTimeout(200);
  assert.ok(await s.p.evaluate(() => todayWaiting().some(w => w.seen && /reading report/.test(w.t))), 'the report row stays once read');
  assert.ok(await s.p.$('details.tseen'), 'the report line folds to one line and stays');
  // Readings on Threads, director only, opens the report with this week first and the findings folded under it
  await s.p.evaluate(() => goView('threads')); await s.p.waitForSelector('[data-readings]');
  await s.p.click('[data-readings]'); await s.p.waitForSelector('.wrrep');
  const rp = await s.p.evaluate(() => ({ week: wrWeek === mondayOf(new Date()), opt: document.querySelector('[data-wrweek] option').textContent, find: (() => { const d = [...document.querySelectorAll('details.fold')].find(x => /What the reading found/.test(x.innerText)); return d ? [d.open, d.textContent] : null; })() }));
  assert.ok(rp.week); assert.match(rp.opt, /this week/); assert.ok(rp.find && rp.find[0] === false); assert.match(rp.find[1], /Water and mud[\s\S]*Three this week/);
  // the project page. Threads the reading suggests, the thread's observations counted as the project's, final remarks as new evidence, the children's question
  await s.p.evaluate(() => openProject('x1')); await s.p.waitForSelector('[data-ptsadd="x1|t2"]', { state: 'attached' });
  assert.deepStrictEqual(await s.p.evaluate(() => projNotices(projects.get('x1')).map(n => n.id).sort()), ['w0', 'w1', 'w2'], 'its thread\'s observations count');
  await s.p.evaluate(() => document.querySelector('[data-ptsadd="x1|t2"]').click()); await s.p.waitForTimeout(300);
  assert.deepStrictEqual(await s.p.evaluate(() => projects.get('x1').threads.map(l => l.id)), ['t1', 't2']);
  assert.match(await s.p.$eval('#main', m => m.textContent), /New evidence, Final remarks from 1 plan[\s\S]*went under the fence/);
  await s.p.evaluate(() => { document.querySelectorAll('#main details').forEach(d => { d.open = true; }); document.querySelector('[data-pkeeprem="fol1"]').click(); }); await s.p.waitForTimeout(400);
  assert.deepStrictEqual(await s.p.evaluate(() => projEarlier(projects.get('x1'), 'underneath').map(r => [r.text, r.plan])), [['The water went under the fence and the children followed it.', 'fol1']]);
  await s.p.click('[data-pqpick]'); await s.p.waitForSelector('[data-pqset]');
  await s.p.evaluate(() => document.querySelector('[data-pqset]').click()); await s.p.waitForTimeout(300);
  const cq = await s.p.evaluate(() => projects.get('x1').childQuestion);
  assert.match(cq.text, /Poured water down the hill/); assert.match(cq.obs, /^w/);
  await s.p.evaluate(() => { const b = document.querySelector('[data-unlock]'); if (b) b.click(); }); await s.p.waitForTimeout(200);
  await s.p.fill('[data-pf="childQuestionText"]', 'Where does the water go when it hides?'); await s.p.waitForTimeout(1200);
  assert.strictEqual(await s.p.evaluate(() => projects.get('x1').childQuestion.text), 'Where does the water go when it hides?');
  // Find threads offers a project when two threads share a room or evidence
  await s.p.evaluate(() => { scans.set('All', { room: 'All', range: '8', createdAt: Date.now(), summary: 'x', threads: [{ name: 'Pipes and funnels', question: 'Children may be asking how water travels.', classroom: 'West', evidence: [{ planId: 'n9', week: mondayOf(new Date()), text: 'Rolled the big tyre' }], weeks: [] }] }); tRoom = 'All'; goView('threads'); });
  await s.p.waitForSelector('[data-onestart]', { state: 'attached' });
  const op = await s.p.$eval('article.oneproject', el => el.innerText);
  assert.match(op, /These may be one project[\s\S]*Pipes and funnels[\s\S]*Pipes in the sand/);
  await s.p.evaluate(() => document.querySelector('[data-onestart]').click()); await s.p.waitForFunction(() => view === 'projects' && projId && projects.get(projId).threads.length === 2, null, { timeout: 10000 });
  const pr = await s.p.evaluate(() => { const x = projects.get(projId); return { n: x.name, ths: x.threads.map(l => threads.get(l.id).name).sort() }; });
  assert.deepStrictEqual(pr.ths, ['Pipes and funnels', 'Pipes in the sand']); assert.match(pr.n, /Pipes and funnels|Pipes in the sand/);
  // child height prints and the place sheet are offered
  await s.p.evaluate(() => goView('threads')); await s.p.waitForSelector('#th-t1', { state: 'attached' });
  assert.ok(await s.p.$('#th-t1 [data-print="threadkids"]'), 'Print for the classroom on the thread');
  assert.ok(await s.p.evaluate(() => DOC_PLAN.includes('Revisit')));
  // the resized photo route is used only when the server offers it, and falls back otherwise
  const thumb = await s.p.evaluate(() => { window.FP_PHOTO_SIZES = [1200, 1920]; const u = photoThumb(notices.get('w0')); window.FP_PHOTO_SIZES = []; return [u, photoThumb(notices.get('w0'))]; });
  assert.match(thumb[0], /\/photo\/ph-w0\?w=1200/); assert.match(thumb[1], /\/original\/ph-w0/);
  assert.deepStrictEqual(s.errors, []);
});
