'use strict';
// Step 3 of volunteering. Slots posted from a job card with a point person, work days whose stations are job cards,
// specialty visits a family offers, family strengths beside threads and projects, each card's best months and the
// January list. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); };

const more = put => {
  put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ name: 'Rue Test', email: 'pip.family@example.test' }], familyStrengths: { text: 'We keep bees and love building with stones.' } });
  put('threads/t1.json', { id: 't1', name: 'Heavy stones', classroom: 'West', question: 'What makes a stone heavy?', evidence: [] });
  put('projects/x1.json', { id: 'x1', name: 'Building with mud', home: 'North', status: 'active', classrooms: [], threads: [] });
};
async function setup(t) {
  const fx = await start({ more }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, gia = (await fx.login('Gia', '1357')).token;
  let lib; for (let i = 0; i < 100; i++) { lib = (await fx.as(dee, '/api/staff/volunteer', {})).body; if (lib && lib.loaded) break; await wait(200); }
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  return { fx, dee, gia, fam, lib, data: async () => (await fx.as(fam, '/family/data', {})).body };
}
const write = (fx, tok, id, data) => fx.as(tok, '/api/write', { op: 'set', kind: 'participation', id, data });

test('a slot from a card names its point person, and its steps show once a family signs up', async t => {
  const { fx, dee, gia, fam, lib, data } = await setup(t);
  const card = lib.jobs.find(j => j.title === 'Spread Wood Chips');
  // the office marks the card's best months, and the director sees them
  assert.strictEqual((await fx.as(gia, '/api/staff/volunteer/months', { id: card.id, months: ['10', '03', '13', '10'] })).status, 200);
  assert.deepStrictEqual((await fx.as(dee, '/api/staff/volunteer', {})).body.jobs.find(j => j.id === card.id).months, ['03', '10']);
  await write(fx, dee, 'it-slot', { kind: 'item', type: 'task', jobId: card.id, title: card.title, date: day(3), spots: 2, hours: 2, pointPerson: 'Ann', open: true, test: true, signups: [] });
  let it = (await data()).open.find(x => x.id === 'it-slot');
  assert.strictEqual(it.pointPerson, 'Ann'); assert.strictEqual(it.card.full, false); assert.ok(!it.card.directions, 'the steps wait for sign up');
  assert.deepStrictEqual(it.card.supplies, card.supplies);
  await fx.as(fam, '/family/signup', { itemId: 'it-slot', on: true, who: 'Rue' });
  it = (await data()).open.find(x => x.id === 'it-slot');
  assert.strictEqual(it.card.full, true); assert.deepStrictEqual(it.card.directions, card.directions);
  // the director's switch shows the steps before sign up
  await fx.as(dee, '/api/staff/volunteer/settings', { stepsBefore: true });
  await fx.as(fam, '/family/signup', { itemId: 'it-slot', on: false });
  assert.strictEqual((await data()).open.find(x => x.id === 'it-slot').card.full, true);
});

test('a family offers a visit, and it comes to the director with the licensing rule when the visitor is a guest', async t => {
  const { fx, dee, fam, data } = await setup(t);
  assert.match((await fx.as(fam, '/family/visit', { what: 'Beekeeping', who: 'Rue' })).body.error || '', /parent, relative or guardian/);
  const r = await fx.as(fam, '/family/visit', { what: 'Beekeeping with a real hive frame', who: 'Our neighbor Sol', isFamily: false, when: 'Tuesday mornings' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const v = r.body.visits[0]; assert.deepStrictEqual([v.what, v.status], ['Beekeeping with a real hive frame', 'new']);
  // the director schedules it, and the family sees the day
  // the idea is kept in the records the director's TREE receives
  const fs = require('fs'), path = require('path'); let rec = null;
  for (let i = 0; i < 60 && !rec; i++) { await wait(250); const dir = path.join(fx.dir, 'participation'); const f = fs.readdirSync(dir).find(n => /^vi-/.test(n)); if (f) rec = [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]; }
  assert.ok(rec, 'the director receives the idea'); assert.strictEqual(rec[1].isFamily, false);
  await write(fx, dee, 'it-visit', { kind: 'item', type: 'task', title: 'A visit, Beekeeping', date: day(5), open: false, visitId: rec[0], signups: [{ email: 'pip.family@example.test', who: 'Sol' }], test: true });
  await write(fx, dee, rec[0], Object.assign({}, rec[1], { status: 'scheduled', itemId: 'it-visit' }));
  const d = await data(); assert.deepStrictEqual([d.visits[0].status, d.visits[0].date], ['scheduled', day(5)]);
  assert.ok(!d.open.some(x => x.id === 'it-visit'), 'a visit is not offered to every family');
});

test('the library posts slots, a work day prints its station cards, and the Participation page brings visits, strengths and the January list', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, fam } = await setup(t);
  await fx.as(fam, '/family/visit', { what: 'Beekeeping', who: 'Our neighbor Sol', isFamily: false });
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  // a slot from the library
  await s.p.evaluate(() => goView('volunteer')); await s.p.waitForSelector('[data-volrow^="g:"]', { timeout: 15000 });
  await s.p.click('[data-volrow="g:garden-and-orchard"] > summary'); await s.p.click('[data-volrow="j:spread-wood-chips"] > summary');
  await s.p.click('[data-volrow="j:spread-wood-chips"] [data-volslot="spread-wood-chips"]');
  await s.p.fill('#vs-d', '2099-05-01'); await s.p.fill('#vs-p', 'Ann'); await s.p.click('[data-volslotsave]'); await s.p.waitForTimeout(800);
  const slot = await s.p.evaluate(() => ptItems().find(x => x.jobId === 'spread-wood-chips'));
  assert.deepStrictEqual([slot.open, slot.pointPerson, slot.date, slot.title], [true, 'Ann', '2099-05-01', 'Spread Wood Chips']);
  // a work day with a station from a card, and its station cards
  const got = await s.p.evaluate(async () => {
    const id = ptNewId('it'); await ptSave(id, { kind: 'item', type: 'event', gathering: 'work-day', title: 'Fall work day', date: '2099-10-10', start: '09:00', end: '12:00', open: false, onCalendar: true, signups: [] });
    goView('gatherings'); for (let i = 0; i < 50 && !document.getElementById('gths-c-' + id); i++) await new Promise(r => setTimeout(r, 100));
    document.getElementById('gths-c-' + id).value = 'spread-wood-chips'; document.getElementById('gths-p-' + id).value = 'Bea';
    document.querySelector(`[data-gthstation="${id}"]`).click(); for (let i = 0; i < 50 && !document.querySelector(`[data-gthstations="${id}"]`); i++) await new Promise(r => setTimeout(r, 100));
    const out = {}; window.makePdf = docs => { out.docs = docs; }; document.querySelector(`[data-gthstations="${id}"]`).click(); for (let i = 0; i < 50 && !out.docs; i++) await new Promise(r => setTimeout(r, 100));
    return { station: ptItems().find(x => x.gatheringId === id), docs: out.docs, text: document.querySelector('#main').innerText };
  });
  assert.deepStrictEqual([got.station.jobId, got.station.pointPerson, got.station.open], ['spread-wood-chips', 'Bea', false]);
  assert.match(got.text, /Work days/); assert.match(got.text, /Spread Wood Chips with Bea/);
  assert.strictEqual(got.docs.length, 1); assert.match(JSON.stringify(got.docs[0]), /Point person[\s\S]*Bea/); assert.match(JSON.stringify(got.docs[0]), /Fall work day/);
  // the visit with its licensing note, strengths beside a thread and a project, and the January list
  await s.p.evaluate(() => goView('participation')); await s.p.waitForSelector('text=Specialty and passion visits', { timeout: 15000 });
  const txt = await s.p.innerText('#main');
  assert.match(txt, /Our neighbor Sol/); assert.match(txt, /Title 22, section 101170\(b\)/);
  assert.match(txt, /Family strengths that may fit/); assert.match(txt, /May fit the thread Heavy stones/); assert.match(txt, /May fit the project Building with mud/);
  const jan = await s.p.evaluate(() => { const g = Date.prototype.getMonth; Date.prototype.getMonth = function () { return 0; }; try { return ptJanuaryHtml(); } finally { Date.prototype.getMonth = g; } });
  assert.match(jan, /The January list/);
  // schedule the visit
  const vid = await s.p.evaluate(() => ptVisits()[0].id);
  await s.p.click(`[data-pvsched="${vid}"]`); await s.p.fill(`#pvd-${vid}`, '2099-04-01'); await s.p.selectOption(`#pvl-${vid}`, 'project:x1'); await s.p.click(`[data-pvsave="${vid}"]`); await s.p.waitForTimeout(1000);
  const sch = await s.p.evaluate(v => { const x = participation.get(v); const it = participation.get(x.itemId); return [x.status, it.date, it.open, it.link && it.link.name, it.signups[0].email]; }, vid);
  assert.deepStrictEqual(sch, ['scheduled', '2099-04-01', false, 'Building with mud', 'pip.family@example.test']);
  assert.deepStrictEqual(s.errors, []);
  // the office prepares a slot, which waits for the director
  const o = await signedIn(fx, br, 'Gia', '1357', 1100); t.after(() => o.close());
  await o.p.evaluate(() => goView('volunteer')); await o.p.waitForSelector('[data-volrow^="g:"]', { timeout: 15000 });
  await o.p.click('[data-volrow="g:animal-care"] > summary'); const aid = await o.p.evaluate(() => volData.jobs.find(j => j.group === 'animal-care').id);
  await o.p.click(`[data-volrow="j:${aid}"] > summary`); await o.p.click(`[data-volslot="${aid}"]`); await o.p.fill('#vs-d', '2099-05-02'); await o.p.click('[data-volslotsave]'); await o.p.waitForTimeout(800);
  assert.deepStrictEqual(await o.p.evaluate(a => { const x = ptItems().find(y => y.jobId === a); return [x.status, x.open]; }, aid), ['requested', false]);
  assert.deepStrictEqual(o.errors, []);
});

test('on a phone, a family sees a slot\'s point person and card, and offers a visit', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, dee, fam, lib } = await setup(t);
  const card = lib.jobs.find(j => j.title === 'Spread Wood Chips');
  await write(fx, dee, 'it-slot', { kind: 'item', type: 'task', jobId: card.id, title: card.title, date: day(3), spots: 2, hours: 2, pointPerson: 'Ann', open: true, test: true, signups: [] });
  const br = await b.launch(); t.after(() => br.close());
  const p = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [fam]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('text=Taking part', { timeout: 10000 }); await p.click('text=Taking part');
  await p.waitForSelector('text=Your point person is Ann.');
  await p.click('summary:has-text("The job card")'); assert.match(await p.innerText('body'), /The steps show here once you sign up/);
  await p.click('summary:has-text("Share a specialty or passion")'); await p.fill('#fvw', 'Songs in Tagalog'); await p.fill('#fvn', 'Rue');
  await p.check('input[name="fvf"][value="yes"]'); await p.click('#fv button'); await p.waitForSelector('text=With the director');
  assert.doesNotMatch(await p.innerText('body'), /[—–]|\bteacher|\bClaude\b/);
  assert.deepStrictEqual(errors, []);
});
