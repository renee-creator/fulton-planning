'use strict';
// October 31, 2026. The nine fixes from the audit. Final remarks are each educator's own. Two teammates starting the week's
// Classroom plan write in one plan. Clear test entries puts back only what a tester changed. A new team inquiry starts off
// the staff room display. The phone's Back steps through TREE. A family's copy of a transition summary takes out every
// other child's name, known or not, and keeps sentences whole. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const fam = require('../family.js');

const monday = d => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x.toISOString().slice(0, 10); };
const lastWeek = monday(Date.now() - 7 * 864e5);
const more = put => {
  put('settings/main.json', { id: 'main', groups: [{ name: 'Marigold', room: 'North', educator: 'Bea' }] });
  put('plans/pold.json', { id: 'pold', type: 'individual', weekOf: lastWeek, classroom: 'North', educator: 'Bea', groups: ['Marigold'], focus: 'smallgroup', fields: { rationale: 'Something written.' }, status: 'draft', createdAt: 1, updatedAt: 1 });
  put('children/k1.json', { first: 'Wren', last: 'Hale', classroom: 'North', status: 'active', note: 'Staff wrote this later.', enrollForm: { done: true } });
  put('participation/undo-children-k1.json', { id: 'undo-children-k1', kind: 'undo', target: 'children', tid: 'k1', existed: true, keys: ['familyStrengths'], was: { familyStrengths: null }, test: true });
  put('participation/undo-children-old.json', { id: 'undo-children-old', kind: 'undo', target: 'children', tid: 'k1', prev: { first: 'Wren' }, test: true });
};

test('the family copy takes out every other name and keeps sentences', () => {
  const kids = [{ id: 'z', first: 'Zyah', last: 'Overby' }, { id: 'o', first: 'Opal', last: 'Reyes' }, { id: 'r', first: 'Rowan', last: 'Lee' }];
  const found = [];
  const out = fam.withoutOthers("Zyah's friends include Zeleny, Zephyr and Grace. She played with Opal and R. Zyah joined small group with Hannah in Marigold. In Spanish she counts.", kids[0], kids, { keep: ['Hannah', 'Marigold'], found });
  assert.doesNotMatch(out, /Zeleny|Zephyr|Grace|Opal|R\./);
  assert.match(out, /Zyah's friends include friends\./);
  assert.match(out, /played with friends\. Zyah joined/, 'the full stop stays when an initial ends a sentence');
  assert.match(out, /Hannah in Marigold/, 'staff and small groups stay');
  assert.match(out, /In Spanish/);
  assert.ok(found.includes('Zeleny') && found.includes('Opal'));
});

test('the nine audit fixes', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const read = (k, id) => { const f = path.join(fx.dir, `${k}/${id}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const wait = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 200; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };

  await t.test('an educator with no plans of her own sees no one else\'s Final remarks', async () => {
    const ann = await signedIn(fx, b, 'Ann', '1357', 390);
    assert.strictEqual(await ann.p.evaluate(() => dueList().list.length), 0);
    assert.ok(!(await ann.p.evaluate(() => todayWaiting().some(w => w.t === 'Final remarks still to write'))));
    await ann.close();
    const bea = await signedIn(fx, b, 'Bea', '1357', 390);
    assert.strictEqual(await bea.p.evaluate(() => dueList().list.length), 1, 'her own shows');
    await bea.close();
  });

  await t.test('two teammates starting the Classroom plan write in one plan', async () => {
    const a = await signedIn(fx, b, 'Bea', '1357', 1100), c = await signedIn(fx, b, 'Gia', '1357', 1100);
    for (const s of [a, c]) await s.p.evaluate(() => { roomFilter = 'North'; LS.set('fps.myroom', 'North'); });
    const startPlan = s => s.p.evaluate(() => { const x = document.createElement('button'); x.dataset.new = 'classroom'; x.dataset.room = 'North'; document.body.append(x); x.click(); x.remove(); });
    await startPlan(a); await startPlan(c);
    await a.p.waitForSelector('textarea[data-f]'); await c.p.waitForSelector('textarea[data-f]');
    await a.p.fill('textarea[data-f]', 'Children carried water to the beds.');
    await c.p.fill('textarea[data-f]', 'They counted the buckets.');
    const plansDir = path.join(fx.dir, 'plans');
    assert.ok(await wait(() => { const cls = fs.readdirSync(plansDir).map(f => JSON.parse(fs.readFileSync(path.join(plansDir, f), 'utf8'))).filter(p => p.type === 'classroom' && p.classroom === 'North');
      return cls.length === 1 && /water/.test(JSON.stringify(cls[0].fields)) && /buckets/.test(JSON.stringify(cls[0].fields)); }, 15000), 'one plan holds both');
    await a.close(); await c.close();
  });

  await t.test('Clear test entries puts back only what a tester changed', async () => {
    const d = await signedIn(fx, b, 'Dee', 'director-pass-1', 1100);
    await d.p.waitForFunction(() => participation.get('undo-children-k1'), null, { timeout: 15000 });
    await fx.as((await fx.login('Dee', 'director-pass-1')).token, '/api/write', { op: 'update', kind: 'children', id: 'k1', patch: { familyStrengths: { text: 'A tester typed this.' } } });
    await d.p.waitForTimeout(1500);
    await d.p.evaluate(() => { goView('participation'); });
    await d.p.waitForSelector('[data-ptclear]', { timeout: 15000 });
    await d.p.click('[data-ptclear]'); await d.p.click('[data-ptclear]');
    assert.ok(await wait(() => { const k = read('children', 'k1'); return k && !k.familyStrengths; }), 'the tester\'s part is taken away');
    const k = read('children', 'k1');
    assert.strictEqual(k.note, 'Staff wrote this later.'); assert.deepStrictEqual(k.enrollForm, { done: true }); assert.strictEqual(k.last, 'Hale', 'nothing else goes back');
    await d.close();
  });

  await t.test('a new team inquiry starts off the staff room display', async () => {
    const d = await signedIn(fx, b, 'Dee', 'director-pass-1', 1100);
    assert.strictEqual(await d.p.evaluate(() => newInquiry({ name: 'x' }).display), false);
    await d.close();
  });

  await t.test('Back steps through TREE and never leaves it', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 390);
    for (const v of ['moments', 'children', 'today']) { await s.p.evaluate(v => document.querySelector(`[data-tsec="${v}"],[data-tview="${v}"]`) ? document.querySelector(`[data-tsec="${v}"],[data-tview="${v}"]`).click() : goView(v), v); await s.p.waitForTimeout(400); }
    const seen = [];
    for (let i = 0; i < 3; i++) { await s.p.goBack().catch(() => {}); await s.p.waitForTimeout(400); seen.push(await s.p.evaluate(() => view)); }
    assert.match(s.p.url(), /tree\.html/, 'still in TREE');
    assert.deepStrictEqual(seen.slice(0, 2), ['children', 'moments'], 'each Back goes one step');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
