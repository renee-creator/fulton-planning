'use strict';
// Required notices. Hidden from staff until the director marks them ready, each linked to its official page, acknowledged
// by the new hire, the yearly Workplace Know Your Rights notice recorded with each person's language, an emergency contact
// seen only by that person and the director, and one reminder each January from 2027. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');
const N = require('../notices.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West', startDate: '2020-01-01' }, { name: 'Pat', startDate: '2020-01-01' }, { name: 'Kit', kitchen: true, role: 'staff' }];

test('every notice links to an official agency page and copies no notice text', () => {
  for (const x of [...N.POSTERS, ...N.NEWHIRE]) {
    assert.match(x.url, /^https:\/\/([a-z]+\.)*(ca\.gov|dol\.gov|eeoc\.gov)\//, x.id);
    assert.ok(x.checked && x.agency && x.title, x.id); assert.doesNotMatch(x.title + x.when, /[–—:]/, x.id);
  }
  assert.ok(N.NEWHIRE.some(x => x.id === 'wtpa' && x.how === 'packet'));
  assert.strictEqual(N.KYR_LANGS[0], 'English');
});

test('staff see nothing until the director marks the notices ready', async () => {
  const h = await loaded(LIST);
  assert.strictEqual((await call(h.staff, 'Ann', 'notices', {})).status, 403);
  assert.strictEqual((await call(h.staff, 'Ann', 'notices/ack', { id: 'de2515' })).status, 403);
  assert.strictEqual((await call(h.staff, 'Dir', 'notices', {})).status, 200);
  assert.strictEqual((await call(h.staff, 'Ann', 'notices/ready', { on: true })).status, 403);
  await call(h.staff, 'Dir', 'notices/ready', { on: true });
  const d = (await call(h.staff, 'Ann', 'notices', {})).body;
  assert.strictEqual(d.ready, true); assert.strictEqual(d.mine.lang, 'English'); assert.strictEqual(d.people, undefined);
});

test('acknowledgments, the language and the emergency contact stay with the person and the director', async () => {
  const h = await loaded(LIST); await call(h.staff, 'Dir', 'notices/ready', { on: true });
  const a = await call(h.staff, 'Ann', 'notices/ack', { id: 'de2515' });
  assert.ok(a.body.acks.de2515.day);
  assert.strictEqual((await call(h.staff, 'Ann', 'notices/ack', { id: 'wtpa' })).status, 400);
  assert.strictEqual((await call(h.staff, 'Ann', 'notices/lang', { lang: 'Klingon' })).status, 400);
  await call(h.staff, 'Ann', 'notices/lang', { lang: 'Spanish' });
  await call(h.staff, 'Ann', 'notices/emergency', { contact: { name: 'A friend', phone: '555 0100', notify: 'yes' } });
  // another educator cannot read or change Ann's
  assert.strictEqual((await call(h.staff, 'Pat', 'notices/emergency', { name: 'Ann', contact: { name: 'X' } })).status, 403);
  const pat = (await call(h.staff, 'Pat', 'notices', { name: 'Ann' })).body; assert.strictEqual(pat.name, 'Pat'); assert.strictEqual(pat.mine.emergency, null);
  const dir = (await call(h.staff, 'Dir', 'notices', { name: 'Ann' })).body;
  assert.strictEqual(dir.mine.emergency.name, 'A friend'); assert.strictEqual(dir.mine.lang, 'Spanish');
  assert.deepStrictEqual(dir.people.map(p => p.name), ['Ann', 'Kit', 'Pat']);
  // a whole records page saved from an old copy never takes them away
  await call(h.staff, 'Dir', 'save', { name: 'Ann', doc: { notices: {}, units: { completed: 3 } } });
  await call(h.staff, 'Ann', 'save', { name: 'Ann', doc: { notices: { acks: {} } } });
  assert.strictEqual((await call(h.staff, 'Dir', 'notices', { name: 'Ann' })).body.mine.acks.de2515.day, a.body.acks.de2515.day);
  // the kitchen reaches its own
  assert.strictEqual((await call(h.staff, 'Kit', 'notices/lang', { lang: 'Tagalog' })).status, 200);
});

test('the yearly notice is recorded by the director, and the January reminder starts in 2027', async t => {
  const h = await loaded(LIST); await call(h.staff, 'Dir', 'notices/ready', { on: true });
  assert.strictEqual((await call(h.staff, 'Ann', 'notices/give', { names: ['Ann'], year: '2027', way: 'email', date: '2027-01-15' })).status, 403);
  const g = await call(h.staff, 'Dir', 'notices/give', { names: ['Ann', 'Pat', 'Dir'], year: '2027', way: 'email', date: '2027-01-15' });
  assert.strictEqual(g.body.given, 2);
  assert.strictEqual((await call(h.staff, 'Dir', 'notices', { name: 'Pat' })).body.mine.kyr['2027'].way, 'email');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'staff.js'), 'utf8');
  assert.match(src, /day\.slice\(5, 7\) === '01' && y >= 2027 && once\('notices\|jan\|' \+ y\)/);
});
