'use strict';
// Every training on the records list links to the regulation it meets and to where it is taken, never a regulations
// home page, and the Red Cross water safety course shows only for the people the director chooses. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { loaded, call } = require('./harness.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West', startDate: '2020-01-01' }, { name: 'Pat', startDate: '2020-01-01' }];
const HOME = /Community-Care-Licensing-Regulations\/Child-Care\/?$|^https:\/\/[^/]+\/?$/;

test('each training has a regulation link and a course link, neither a home page', async () => {
  const h = await loaded(LIST);
  const items = (await call(h.staff, 'Ann', 'boot', {})).body.defs.items;
  for (const k of ['cpr', 'hs16', 'eplan', 'mandated', 'hsa', 'water', 'rcwater']) {
    const it = items.find(i => i.k === k); assert.ok(it, k);
    for (const l of [it.law, it.course]) { assert.ok(l && /^https:\/\//.test(l.url), k); assert.doesNotMatch(l.url, HOME, k); assert.doesNotMatch(l.text, /[–—:]/, k); }
  }
  assert.strictEqual(items.find(i => i.k === 'mandated').course.url, 'https://mandatedreportertraining.com/california/');
  assert.strictEqual(items.find(i => i.k === 'rcwater').course.url, 'https://www.redcross.org/take-a-class/classes/water-safety-for-parents-and-caregivers/a6R3o0000012oT8.html');
  assert.ok(items.find(i => i.k === 'activesup').law);
});

test('the director chooses who needs the Red Cross course, and only they hear about it', async () => {
  const h = await loaded(LIST);
  assert.strictEqual((await call(h.staff, 'Ann', 'profile', { name: 'Ann', profile: { 'need:rcwater': '1' } })).status, 403);
  const r = await call(h.staff, 'Dir', 'profile', { name: 'Ann', profile: { 'need:rcwater': '1' } });
  assert.deepStrictEqual(r.body.profile.needs, { rcwater: true });
  await call(h.staff, 'Dir', 'save', { name: 'Ann', doc: { items: { rcwater: { date: '2026-01-10', expires: '2026-12-01' } } } });
  await call(h.staff, 'Dir', 'save', { name: 'Pat', doc: { items: { rcwater: { date: '2026-01-10', expires: '2026-12-01' } } } });
  const hears = n => ['2026-11-02', '2026-12-02'].flatMap(d => h.staff.dueFor(n, d)).filter(x => /Red Cross/.test(x));
  assert.strictEqual(hears('Ann').length, 2); assert.deepStrictEqual(hears('Pat'), []);
  const off = await call(h.staff, 'Dir', 'profile', { name: 'Ann', profile: { 'need:rcwater': '0' } });
  assert.deepStrictEqual(off.body.profile.needs, {});
});

test('the records page draws both links and the director\'s choice, with no regulations home page', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/staff-app.js'), 'utf8');
  assert.match(src, /The regulation, \$\{H\(it\.law\.text\)\}/); assert.match(src, /Take the training, \$\{H\(it\.course\.text\)\}/);
  assert.match(src, /Trainings you choose for/);
  assert.match(src, /x\.list==="training"\?trainingsCard\(\)/);
});
