'use strict';
// Taking part on the Family page. Entries round up to the next half hour, the PAC and class representatives are named for
// every family, one of them posts a gathering hosted by families, First Friday is posted each month while it is on, and
// the family contact list is email only, with a parent able to take their own email off. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const soon = (() => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 10); return d.toISOString().slice(0, 10); })();

const more = put => {
  put('participation/config.json', { id: 'config', test: true, firstFriday: { on: true, start: '08:30', end: '09:15' },
    testers: [{ email: 'pip.family@example.test', children: ['pip'] }, { email: 'kit.family@example.test', children: ['kit'] }],
    roles: [{ name: 'Rosa Rep', email: 'pip.family@example.test', role: 'rep', classroom: 'West' }, { name: 'Pat Council', email: '', role: 'pac' }] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ name: 'Rosa Rep', email: 'pip.family@example.test' }, { name: 'Sam Rep', email: 'sam.family@example.test' }] });
  put('children/kit.json', { first: 'Kit', last: 'Test', classroom: 'North', status: 'active', parents: [{ name: 'Lee Kit', email: 'kit.family@example.test' }] });
};
async function setup(t) {
  const fx = await start({ more }); t.after(() => fx.stop());
  const tok = async email => { const c = await fx.as('', '/family/code', { email }); return (await fx.as('', '/family/login', { email, code: c.body.code })).body.token; };
  const pip = await tok('pip.family@example.test'), kit = await tok('kit.family@example.test');
  return { fx, pip, kit, data: async k => (await fx.as(k, '/family/data', {})).body };
}

test('half hours, the roster, a gathering hosted by families, First Friday and the contact list', async t => {
  const { fx, pip, kit, data } = await setup(t);
  // a 20 minute job counts a half hour, and 40 minutes counts one hour
  let d = (await fx.as(pip, '/family/log', { what: 'Peeled crayons', date: today, minutes: 20, childId: 'pip', type: 'job' })).body;
  assert.strictEqual(d.entries[0].hours, 0.5);
  d = (await fx.as(pip, '/family/log', { what: 'Washed smocks', date: today, minutes: 40, childId: 'pip', type: 'job' })).body;
  assert.strictEqual(d.children[0].hours, 1.5);
  assert.match(d.texts['Participation hours'], /next half hour/);
  // every family sees the names, and never an email
  d = await data(kit);
  assert.deepStrictEqual(d.roles, [{ name: 'Rosa Rep', role: 'rep', classroom: 'West' }, { name: 'Pat Council', role: 'pac', classroom: '' }]);
  assert.strictEqual(d.iHost, false); assert.doesNotMatch(JSON.stringify(d.roles), /@/);
  // only a host posts a gathering, and every family sees it hosted by families
  assert.strictEqual((await fx.as(kit, '/family/gather', { title: 'Park playdate', date: soon })).status, 400);
  const r = await fx.as(pip, '/family/gather', { title: 'Park playdate', date: soon, start: '10:00', place: 'Howarth Park', hours: 1.5, note: 'Bring a snack.' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  d = await data(kit); const g = d.open.find(x => x.title === 'Park playdate');
  assert.ok(g, 'every family sees it'); assert.strictEqual(g.hostedBy, 'families'); assert.strictEqual(g.host, 'Rosa Rep'); assert.strictEqual(g.mineHost, false); assert.strictEqual(g.hours, 1.5);
  assert.strictEqual((await fx.as(kit, '/family/ungather', { id: g.id })).status, 400, 'only the family who posted it takes it down');
  // First Friday is posted as a half hour community event
  const ff = d.open.find(x => x.title === 'First Friday Morning Coffee, Tea and Chat');
  assert.ok(ff, 'First Friday is posted'); assert.strictEqual(ff.hours, 0.5); assert.strictEqual(new Date(ff.date + 'T12:00:00Z').getUTCDay(), 5); assert.strictEqual(ff.start, '08:30');
  // the contact list is email only, and a parent can take their own email off
  let L = (await fx.as(kit, '/family/contacts', {})).body;
  assert.deepStrictEqual(L.rows.map(x => [x.classroom, x.child, x.parents.map(p => p.email).join(' ')]), [['North', 'Kit', 'kit.family@example.test'], ['West', 'Pip', 'pip.family@example.test sam.family@example.test']]);
  assert.doesNotMatch(JSON.stringify(L), /phone|address/i);
  await fx.as(pip, '/family/contactpref', { out: true });
  L = (await fx.as(kit, '/family/contacts', {})).body;
  assert.deepStrictEqual(L.rows.find(x => x.child === 'Pip').parents.map(p => p.email), ['sam.family@example.test']);
  assert.strictEqual((await data(pip)).contactOut, true);
});

test('the Family page shows the roster, the guide, a host posting a gathering and the contact list on a phone', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, pip } = await setup(t);
  const br = await b.launch(); t.after(() => br.close());
  const p = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [pip]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('button[data-tab="part"]', { timeout: 10000 }); await p.click('button[data-tab="part"]');
  await p.waitForSelector('text=PAC and class representatives');
  let txt = await p.innerText('#main');
  assert.match(txt, /Parent Advisory Council\s*Pat Council/); assert.match(txt, /West class representative\s*Rosa Rep/);
  assert.match(txt, /Our family contact list/); assert.match(txt, /First Friday Morning Coffee, Tea and Chat/);
  await p.click('summary:has-text("Our guide for PAC members")'); assert.match(await p.innerText('#main'), /showing appreciation[\s\S]*Invite all families in the class/i);
  await p.click('button[data-gnew]'); await p.fill('#gt', 'Book talk'); await p.fill('#gd', soon); await p.fill('#gp', 'The library'); await p.click('#gform button.btn');
  await p.waitForSelector('text=Book talk');
  txt = await p.innerText('#main'); assert.match(txt, /Book talk[\s\S]*The library[\s\S]*Hosted by families\. Parents and caregivers care for their own children\. Posted by Rosa Rep\./);
  assert.doesNotMatch(await p.innerText('body'), /[—–]|\bteacher|\bClaude\b/);
  assert.deepStrictEqual(errors, []);
  await wait(10);
});
