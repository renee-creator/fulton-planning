'use strict';
// a classroom plan kept without its curriculum web, or with only part of one, still opens with the web card
const test = require('node:test'); const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
test('a classroom plan with no web, or a web with no branches, opens with its Curriculum web card', async t => {
  const b = await browser(); const now = Date.now();
  const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const monday = d.toISOString().slice(0, 10);
  const fx = await start({ more: put => {
    put('plans/nw1.json', { id: 'nw1', type: 'classroom', classroom: 'West', weekOf: monday, educator: 'Ann', status: 'draft', fields: { intentions: 'Water and weight' }, createdAt: now, updatedAt: now });
    put('plans/nw2.json', { id: 'nw2', type: 'classroom', classroom: 'North', weekOf: monday, educator: 'Bea', status: 'draft', fields: {}, web: { focus: 'Ramps' }, createdAt: now, updatedAt: now });
  } });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1200); t.after(() => s.close());
  for (const id of ['nw1', 'nw2']) {
    await s.p.evaluate(id => { goView('plans'); currentId = id; renderMain(); }, id);
    await s.p.waitForFunction(() => [...document.querySelectorAll('#main .lbl')].some(e => /Curriculum web/.test(e.textContent)), null, { timeout: 15000 });
    const w = await s.p.evaluate(id => { const p = plans.get(id); return { branches: Array.isArray(p.web.branches), focus: p.web.focus }; }, id);
    assert.ok(w.branches, id + ' has its branches');
    if (id === 'nw2') assert.strictEqual(w.focus, 'Ramps', 'what the web held is kept');
  }
  assert.deepStrictEqual(s.errors, []);
});
