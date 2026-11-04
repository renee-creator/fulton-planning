'use strict';
/* The server side of the planning cycle. Every observation is read for a thread at night in batches, a plan's reflection
   reaches a thread through the observations it quotes, a project is offered followed threads and counts its threads'
   observations as its own, a lens writes its picks back, an inquiry gathers by need, a place is read and never typed,
   photos come in display sizes, s16Credit credits class teams, findings are kept by week, and the director's Today
   carries the cycle's health. Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

const day = 864e5;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await wait(200); } return false; }
const mondayOf = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const mon = mondayOf(new Date()), lastMon = mondayOf(new Date(Date.now() - 7 * day));

const more = put => {
  put('settings/program.json', { id: 'program', classrooms: ['West', 'North', 'South'], groups: [{ name: 'Marigold', room: 'North', educator: 'Bea' }], places: ['Garden', 'Goat yard', 'Indoor piazza', 'Tire swing yard'], lenses: [{ id: 'lens1', name: 'Graphic Languages', year: true, questions: ['What idea?'], languages: [], words: ['draw'] }] });
  put('staff/garden/setup.json', { ready: true, beds: [{ id: 'b-raised', name: 'Raised beds', space: 'garden' }, { id: 'b-willow', name: 'Willow dome', space: 'logyard' }], animals: [{ id: 'a-goats', name: 'Goats', names: [{ name: 'Ivy' }], care: [{ id: 'g1', text: 'Feed the goats', every: 'day', weekday: 1 }] }],
    plants: [{ id: 'p-apple', common: 'Apple', bed: 'b-raised', ready: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'], eat: 'food' }], plan: { months: {} }, tending: {} }, 1);
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', status: 'growing', evidence: [{ planId: 'pq', week: lastMon, text: 'Quote one' }, { planId: 'pq', week: lastMon, text: 'Quote two' }, { planId: 'pq', week: lastMon, text: 'Quote three' }, { planId: 'pq', week: lastMon, text: 'Quote four' }, { planId: 'pq', week: lastMon, text: 'Quote five' }, { planId: 'pq', week: lastMon, text: 'Quote six' }, { planId: 'pq', week: lastMon, text: 'Quote seven' }, { planId: 'pq', week: lastMon, text: 'Quote eight' }, { planId: 'pq', week: lastMon, text: 'Quote nine' }] });
  put('threads/t2.json', { id: 't2', name: 'Caring for the goats', classroom: 'North', question: 'What do the goats need from us?', status: 'deepening', evidence: [{ planId: 'n3', week: lastMon, text: 'Fed the goats' }] });
  put('threads/t3.json', { id: 't3', name: 'Old boats', classroom: 'West', status: 'closed', evidence: [] });
  put('projects/x1.json', { id: 'x1', name: 'The mud kitchen', experience: 'Children cook with mud and water in the yard.', home: 'West', status: 'active', createdAt: Date.now() - 9 * day, createdBy: 'Ann', classrooms: [{ room: 'West' }], threads: [{ id: 't1', at: Date.now() - 8 * day }] });
  // observations in no thread, with words enough to ask about, one of them kept for the project's thread
  put('notices/n1.json', { id: 'n1', noticed: 'Mixed water and dirt into a thick mud pie in the raised beds of the garden today.', wonder: 'What else could they add?', at: Date.now() - 8 * day, classroom: 'West', by: 'Ann' });
  put('notices/n2.json', { id: 'n2', noticed: 'Watched the rain run down the gutter into the drain by the gate.', wonder: '', at: Date.now() - 2 * day, classroom: 'West', by: 'Ann' });
  put('notices/n3.json', { id: 'n3', noticed: 'Carried hay to the goat yard and fed Ivy by hand this morning.', wonder: 'Do they know the goats by name?', at: Date.now() - 3600e3, classroom: 'North', by: 'Bea', threadId: 't2' });
  put('notices/n4.json', { id: 'n4', noticed: 'Threw the ball over the fence again and again, laughing each time it landed.', wonder: 'Is it the arc or the landing?', at: Date.now() - 3600e3, classroom: 'North', by: 'Bea' });
  put('notices/n5.json', { id: 'n5', noticed: 'Drew a map of the creek on the chart paper in the indoor piazza.', wonder: '', at: Date.now() - 4 * day, classroom: 'South', by: 'Ann' });
  put('notices/n6.json', { id: 'n6', noticed: 'Short.', at: Date.now() - day, classroom: 'West', by: 'Ann' });
  // the director's Kaymbu moments with no small group and no educator named, and one with a small group
  put('notices/k1.json', { id: 'k1', noticed: 'Shook maracas and danced together in the yard.', at: Date.now() - 10 * day, classroom: 'West', by: 'Dee', kaymbu: { v: 3, key: 'k1', subject: '.', sentBy: 1, keptAt: 1 } });
  put('notices/k2.json', { id: 'k2', noticed: 'Fed the goats hay by hand.', at: Date.now() - 10 * day, classroom: 'North', smallGroup: 'Marigold', by: 'Dee', kaymbu: { v: 3, key: 'k2', subject: 'Marigold', keptAt: 1 } });
  // an open inquiry naming the trajectory need, and a lens scan quoting n5
  put('inquiries/q1.json', { id: 'q1', name: 'Why are things flying through the air?', room: 'North', status: 'open', createdAt: Date.now() - 9 * day, createdBy: 'Dee', see: 'Blocks and balls get thrown.', hyps: [], tries: [], obs: [], threads: [], ibNeeds: ['Moving things through the air (trajectory schema)'] });
  // plans. p1 follows no thread but quotes n1 in its Observation box and has Final remarks. p2 is a draft with words never sent. p3 is last week's with no remarks.
  put('plans/p1.json', { id: 'p1', type: 'individual', weekOf: mon, classroom: 'West', educator: 'Ann', group: 'Cosmos', groups: ['Cosmos'], status: 'ready', fields: { area: 'Mud', dates: 'x', observation: 'Mixed water and dirt into a thick mud pie in the raised beds of the garden today. We wonder what else.', intent: 'y', materials: 'z', questions: 'q', remarks: 'The children kept returning to the mud after the rain. They asked for more water.' }, noticeAdded: ['n1'], createdAt: Date.now(), updatedAt: Date.now() });
  put('plans/p2.json', { id: 'p2', type: 'individual', weekOf: mon, classroom: 'North', educator: 'Bea', group: 'Marigold', groups: ['Marigold'], status: 'draft', fields: { area: 'Goats', observation: 'Some words.' }, createdAt: Date.now(), updatedAt: Date.now() });
  put('plans/p3.json', { id: 'p3', type: 'individual', weekOf: lastMon, classroom: 'North', educator: 'Bea', group: 'Marigold', groups: ['Marigold'], status: 'reviewed', fields: { area: 'Goats', observation: 'Some words.', intent: 'x', materials: 'y', questions: 'z', remarks: '' }, createdAt: Date.now() - 7 * day, updatedAt: Date.now() - 7 * day });
};

async function setup(t, env) {
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString(); asked.push(body);
    let text = '{}';
    if (/kept these observations/.test(body)) text = JSON.stringify({ observations: [{ id: 'n1', threads: [{ id: 't1', why: 'They mixed water into mud.' }] }, { id: 'n2', threads: [] }, { id: 'n4', threads: [] }, { id: 'n5', threads: [] }, { id: 'k1', threads: [] }, { id: 'k2', threads: [] }] });
    else if (/kept this observation/.test(body)) text = JSON.stringify({ threads: [{ id: 't1', why: 'They poured water into the mud.' }] });
    else if (/threads the team follows that the project does not hold/.test(body)) text = JSON.stringify({ fits: [{ id: 't2', why: 'The goats drink the water too.' }] });
    else if (/team inquiry about a child/.test(body)) text = JSON.stringify({ fits: [{ id: 'n4', why: 'Perhaps the arc of the ball is the draw.' }] });
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: Object.assign({ ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port, SUGGEST_DELAY_MS: '600' }, env || {}), more }); t.after(() => fx.stop());
  const read = p => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  return { fx, asked, read };
}

test('the nightly pass reads every observation in no thread, ten to a request, and gives each a place', async t => {
  const { fx, asked, read } = await setup(t);
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  assert.ok(await until(() => read('settings/once.json') && read('settings/once.json').done.s16Credit, 45000), 's16Credit ran');
  assert.strictEqual((await fx.as(ann, '/api/nightly', {})).status, 403);
  const r = (await fx.as(dee, '/api/nightly', {})).body;
  assert.ok(r.ok, JSON.stringify(r));
  // n3 is in a thread, n6 is too short, so six are read in one batch
  assert.deepStrictEqual([r.counts.asked, r.counts.batches, r.counts.suggested, r.counts.none], [6, 1, 1, 5]);
  const q = asked.filter(b => /kept these observations/.test(b)); assert.strictEqual(q.length, 1);
  assert.match(q[0], /Quote two/); assert.doesNotMatch(q[0], /Quote one/, 'eight quotes a thread, the last eight');
  assert.match(q[0], /pursuing the thread's question, and otherwise none/); assert.doesNotMatch(q[0], /Most observations fit none/);
  assert.doesNotMatch(q[0], /Old boats/, 'a closed thread is never offered');
  assert.ok(await until(() => read('notices/n1.json') && (read('notices/n1.json').threadSuggest || [])[0], 10000));
  const n1 = read('notices/n1.json'); assert.deepStrictEqual([n1.threadSuggest[0].id, n1.threadSuggest[0].why, !!n1.threadSuggestKey], ['t1', 'They mixed water into mud.', true]);
  assert.ok(await until(() => read('notices/n2.json') && read('notices/n2.json').threadSuggestKey && !read('notices/n2.json').threadSuggest, 10000), 'one that fits none keeps the key and no suggestion');
  // places, read from the words against the site's places, the garden's beds and the animal yards, never typed
  assert.deepStrictEqual(read('notices/n1.json').place, ['Garden', 'Raised beds']);
  assert.deepStrictEqual(read('notices/n3.json').place, ['Goat yard']);
  assert.deepStrictEqual(read('notices/n5.json').place, ['Indoor piazza', 'Creek', 'Piazza']);
  assert.deepStrictEqual(read('notices/n2.json').place, []);
  // a second run finds nothing new to ask
  const r2 = (await fx.as(dee, '/api/nightly', {})).body; assert.deepStrictEqual([r2.counts.asked, r2.counts.batches], [0, 0]);
  const ni = read('settings/nightly.json'); assert.ok(ni && ni.lastDay && ni.counts);
  // the quick check after an observation is kept carries the same eight quotes and the softened wording
  await fx.as(ann, '/api/write', { op: 'set', kind: 'notices', id: 'n7', data: { id: 'n7', noticed: 'Poured water from the pitcher to make the mud soft for the cakes in the goat yard.', wonder: '', classroom: 'West', by: 'Ann', at: Date.now() } });
  assert.ok(await until(() => asked.some(b => /kept this observation/.test(b) && /mud soft/.test(b)), 15000));
  const one = asked.find(b => /kept this observation/.test(b) && /mud soft/.test(b)); assert.match(one, /Quote two/); assert.doesNotMatch(one, /Quote one/); assert.match(one, /otherwise none/);
  assert.ok(await until(() => read('notices/n7.json') && read('notices/n7.json').place && read('notices/n7.json').place.includes('Goat yard'), 10000), 'the place is read when an observation is kept');
  // s16Credit. The director's moment with no small group is the class team's, the one with a small group keeps her name
  assert.deepStrictEqual([read('notices/k1.json').by, read('notices/k1.json').creditWas, read('notices/k2.json').by, read('notices/k2.json').creditWas], ['West class team', 'Dee', 'Dee', undefined]);
});

test('a reflection flows to a thread through the observation the plan quotes, a lens writes back, a project is offered threads, an inquiry gathers by need', async t => {
  const { fx, asked, read } = await setup(t);
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  assert.ok(await until(() => read('settings/once.json') && read('settings/once.json').done.s16Credit, 45000));
  // n1 joins t1 by hand, as Add it does, and the plan that quotes n1 is saved with its remarks
  await fx.as(dee, '/api/write', { op: 'update', kind: 'threads', id: 't1', patch: { evidence: [...read('threads/t1.json').evidence, { planId: 'n1', week: lastMon, text: 'Mixed water and dirt', via: 'suggest' }] } });
  await fx.as(ann, '/api/write', { op: 'update', kind: 'plans', id: 'p1', patch: { fields: { remarks: 'The children kept returning to the mud after the rain. They asked for more water.' } } });
  assert.ok(await until(() => (read('threads/t1.json').evidence || []).some(e => e.via === 'reflection'), 10000), 'the reflection reached the thread');
  let t1 = read('threads/t1.json'); let e = t1.evidence.filter(x => x.via === 'reflection'); assert.strictEqual(e.length, 1);
  assert.deepStrictEqual([e[0].planId, e[0].section, e[0].week, e[0].obs, e[0].text], ['p1', 'Final remarks', mon, true, 'The children kept returning to the mud after the rain. They asked for more water.']);
  assert.ok(!(read('threads/t2.json').evidence || []).some(x => x.via === 'reflection'), 'a thread the plan does not touch gets nothing');
  // saved again with the same words, nothing doubles. Changed words replace the entry. Emptied, the entry leaves.
  await fx.as(ann, '/api/write', { op: 'update', kind: 'plans', id: 'p1', patch: { fields: { intent: 'y2' } } }); await wait(1500);
  assert.strictEqual(read('threads/t1.json').evidence.filter(x => x.via === 'reflection').length, 1);
  await fx.as(ann, '/api/write', { op: 'update', kind: 'plans', id: 'p1', patch: { fields: { remarks: 'New words about the mud.' } } });
  assert.ok(await until(() => (read('threads/t1.json').evidence || []).some(x => x.via === 'reflection' && x.text === 'New words about the mud.'), 10000));
  assert.strictEqual(read('threads/t1.json').evidence.filter(x => x.via === 'reflection').length, 1);
  await fx.as(ann, '/api/write', { op: 'update', kind: 'plans', id: 'p1', patch: { fields: { remarks: '' } } });
  assert.ok(await until(() => !(read('threads/t1.json').evidence || []).some(x => x.via === 'reflection'), 10000), 'emptied remarks leave the thread');
  // a lens scan kept by the page writes lensIds on each observation it quotes, once
  const scan = { room: 'lens-lens1-All', kind: 'lens', range: 'year', createdAt: Date.now(), by: 'Dee', lensId: 'lens1', lensName: 'Graphic Languages', moments: [{ planId: 'n5', quote: 'Drew a map of the creek', language: '', answers: [] }, { planId: 'p1', quote: 'x', answers: [] }] };
  await fx.as(dee, '/api/write', { op: 'set', kind: 'scans', id: 'lens-lens1-All', data: scan });
  assert.ok(await until(() => read('notices/n5.json') && JSON.stringify(read('notices/n5.json').lensIds) === '["lens1"]', 10000));
  await fx.as(dee, '/api/write', { op: 'set', kind: 'scans', id: 'lens-lens1-All', data: Object.assign({}, scan, { createdAt: Date.now() }) }); await wait(1500);
  assert.deepStrictEqual(read('notices/n5.json').lensIds, ['lens1'], 'added once');
  assert.strictEqual(read('plans/p1.json').lensIds, undefined, 'a plan is left as it is');
  // the project's observations count its threads' observations, and the project is offered followed threads it does not hold
  const po = (await fx.as(ann, '/api/projects/observations', { id: 'x1' })).body;
  assert.deepStrictEqual(po.ids.sort(), ['n1']); assert.deepStrictEqual(po.place, ['Garden', 'Raised beds']);
  assert.strictEqual((await fx.as(ann, '/api/projects/threads', { id: 'x1' })).status, 403);
  const pt = (await fx.as(dee, '/api/projects/threads', { id: 'x1' })).body;
  assert.deepStrictEqual(pt.suggest.map(s => [s.id, s.why]), [['t2', 'The goats drink the water too.']]);
  const pq = asked.find(b => /threads the team follows that the project does not hold/.test(b)); assert.match(pq, /What do the goats need/); assert.doesNotMatch(pq, /Water and mud/, 'a thread it holds is not offered'); assert.doesNotMatch(pq, /Old boats/);
  assert.ok(await until(() => read('projects/x1.json') && (read('projects/x1.json').threadSuggest || [])[0], 10000));
  assert.deepStrictEqual((await fx.as(dee, '/api/projects/threads', { id: 'x1' })).body.same, true, 'nothing changed, no second reading');
  // adding the thread to the project takes it off the waiting list
  const x1 = read('projects/x1.json');
  await fx.as(dee, '/api/write', { op: 'set', kind: 'projects', id: 'x1', data: Object.assign({}, x1, { threads: [...x1.threads, { id: 't2', at: Date.now() }] }) });
  assert.ok(await until(() => read('projects/x1.json') && !read('projects/x1.json').threadSuggest, 10000), 'added, so it leaves the list');
  assert.deepStrictEqual((await fx.as(ann, '/api/projects/observations', { id: 'x1' })).body.ids.sort(), ['n1', 'n3'], 'the new thread\'s observation counts too');
  assert.deepStrictEqual((await fx.as(ann, '/api/place', { kind: 'projects', id: 'x1' })).body.place, ['Garden', 'Raised beds', 'Goat yard']);
  assert.deepStrictEqual((await fx.as(ann, '/api/place', { kind: 'threads', id: 't2' })).body.place, ['Goat yard']);
  // the inquiry gathers by the need it names, word match then the model, and the ones that fit wait as candidates
  const ig = (await fx.as(dee, '/api/inquiries/gather', { id: 'q1' })).body;
  assert.deepStrictEqual(ig.suggest.map(s => [s.id, s.from, s.need]), [['n4', 'need', 'Moving things through the air (trajectory schema)']]);
  const iq = asked.find(b => /team inquiry about a child/.test(b)); assert.match(iq, /Threw the ball/); assert.doesNotMatch(iq, /hay to the goat yard/, 'only the observations whose words match are asked about');
  assert.ok(await until(() => read('inquiries/q1.json') && (read('inquiries/q1.json').found || {}).items && read('inquiries/q1.json').found.items.some(i => i.id === 'n4' && i.from === 'need'), 10000));
  assert.deepStrictEqual(read('inquiries/q1.json').obs, [], 'nothing joins until the director adds it');
  assert.deepStrictEqual((await fx.as(dee, '/api/inquiries/gather', { id: 'q1' })).body.suggest, [], 'one already waiting is not asked about again');
  assert.strictEqual(asked.filter(b => /team inquiry about a child/.test(b)).length, 1);
  // the week's findings are kept by week
  assert.ok(await until(() => read(`reports/${mon}-findings.json`), 10000), 'findings kept');
  const f = read(`reports/${mon}-findings.json`);
  assert.deepStrictEqual([f.kind, f.week, f.lens.map(m => m.id), f.inquiries.map(q => q.found.map(i => i.id))], ['findings', mon, ['n5', 'p1'], [['n4']]]);
  const fl = (await fx.as(dee, '/api/findings', {})).body; assert.strictEqual(fl.findings[0].week, mon);
  const fa = (await fx.as(ann, '/api/findings', {})).body; assert.strictEqual(fa.room, 'West'); assert.deepStrictEqual(fa.findings[0].inquiries, [], 'a class team reads its own parts');
  // the place sheet, what is alive on site this week
  const ps = (await fx.as(ann, '/api/place-sheet', {})).body;
  assert.strictEqual(ps.week, mon); assert.deepStrictEqual(ps.garden.plants, [{ name: 'Apple', where: 'Raised beds', eat: 'food' }]);
  assert.deepStrictEqual(ps.animals.map(a => [a.name, a.names, a.care]), [['Goats', ['Ivy'], ['Feed the goats']]]);
  assert.ok(ps.places.includes('Goat yard') && ps.places.includes('Raised beds') && ps.places.includes('Creek'));
  // cycle health on the director's data head, once p1's reflection is back in its thread
  await fx.as(ann, '/api/write', { op: 'update', kind: 'plans', id: 'p1', patch: { fields: { remarks: 'Back in the mud.' } } });
  assert.ok(await until(() => (read('threads/t1.json').evidence || []).some(x => x.via === 'reflection'), 10000));
  const head = (await fx.as(dee, '/api/data', {})).body; const ch = head.cycleHealth;
  assert.ok(ch && ch.week === mon, JSON.stringify(ch));
  assert.deepStrictEqual(ch.noWonder.names, ['Ann'], 'Bea wondered this week, Ann\'s wonder was last week');
  assert.deepStrictEqual(ch.threadsNoPlan.threads.map(x => x.id), ['t2'], 't1 has p1 this week, t2 has none');
  assert.deepStrictEqual(ch.remarksDue.plans.map(x => x.id), ['p3']);
  assert.deepStrictEqual(ch.draftsNotSent.plans.map(x => x.id), ['p2']);
  assert.strictEqual((await fx.as(ann, '/api/data', {})).body.cycleHealth, undefined, 'educators do not receive it');
  assert.strictEqual((await fx.as(ann, '/api/cycle-health', {})).status, 403);
});

test('a photo comes at a display size, made once and cached, and the original route is unchanged', async t => {
  const { fx } = await setup(t);
  const ann = (await fx.login('Ann', '1357')).token;
  let sharp; try { sharp = require('sharp'); } catch (e) { t.skip('sharp is not installed here'); return; }
  const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#4a7' } }).jpeg().toBuffer();
  const a = await fx.as(ann, '/api/original', { name: 'moment.jpg', data: big.toString('base64') });
  const fk = (await fx.as(ann, '/api/data', {})).body.fileKey;
  const crypto = require('crypto'); const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const keyFor = (fk, id) => { const [e36, secret] = fk.split('.'); return e36 + '.' + b64u(crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(id, 'utf8').digest()).slice(0, 32); };
  const get = (p, w) => fetch(fx.api + p + '/' + encodeURIComponent(a.body.id) + '?t=' + encodeURIComponent(keyFor(fk, a.body.id)) + (w ? '&w=' + w : ''));
  const o = await get('/original'); assert.strictEqual(o.status, 200); const ob = Buffer.from(await o.arrayBuffer()); assert.strictEqual((await sharp(ob).metadata()).width, 3000);
  for (const [w, want] of [[1920, 1920], [1200, 1200], [777, 1920]]) {
    const r = await get('/photo', w); assert.strictEqual(r.status, 200); assert.strictEqual(r.headers.get('content-type'), 'image/jpeg'); assert.match(r.headers.get('cache-control'), /max-age=31536000/);
    const m = await sharp(Buffer.from(await r.arrayBuffer())).metadata(); assert.deepStrictEqual([m.width, m.height], [want, Math.round(want * 2 / 3)]);
  }
  const twice = await get('/photo', 1200); assert.strictEqual(twice.status, 200);
  assert.strictEqual((await fetch(fx.api + '/photo/' + encodeURIComponent(a.body.id) + '?w=1200&t=bad')).status, 403, 'the same key rule as the original');
});
