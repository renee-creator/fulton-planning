'use strict';
/* Kitchen TREE (pantry.js) with stand-ins for the server and made-up people. No school records are used. */
const test = require('node:test'); const assert = require('node:assert');
function make(menu) {
  const recs = new Map(); const sent = [], mails = [];
  const accounts = { list: [{ name: 'Dee', director: true }, { name: 'Cook', kitchen: true }, { name: 'Ed' }] };
  const nameKey = n => String(n || '').trim().toLowerCase();
  const accountFor = n => accounts.list.find(a => nameKey(a.name) === nameKey(n)) || null;
  const isDirector = n => !!(accountFor(n) || {}).director;
  const P = require('../pantry.js')({ store: { ready: true }, log: () => {}, setSetting: (id, doc) => recs.set(id, JSON.parse(JSON.stringify(doc))), settingDoc: id => JSON.parse(JSON.stringify(recs.get(id) || {})),
    isDirector, isKitchen: n => !isDirector(n) && !!(accountFor(n) || {}).kitchen, accountFor, accounts, saveAccounts: async () => true, nameKey, cleanName: n => String(n || '').trim(), okName: n => /^[A-Za-z]+$/.test(n),
    mailText: async (to, s, b) => { mails.push({ to, s, b }); }, pushTo: async (n, m) => { sent.push({ n, m }); }, keepOriginal: async () => {}, photoSrc: id => '/original/' + id, menuDays: d => (menu || {})[d] || null });
  const call = async (me, path, body) => { let out; await P.handle(path, body || {}, me, {}, {}, { json: (q, r, s, o) => { out = { status: s, body: o }; }, err: (q, r, s, m) => { out = { status: s, body: { error: m } }; } }); return out; };
  return { P, call, recs, sent, mails, accounts };
}
const find = (b, name, section) => b.items.find(i => i.name === name && (!section || i.section === section));

test('an educator marks a sensory staple low and it joins the list for its store, but cannot change a store', async () => {
  const h = make(); let r = await h.call('Ed', 'boot'); assert.equal(r.body.role, 'educator'); assert.equal(r.body.rules, undefined); assert.equal(r.body.tasks, undefined);
  const salt = find(r.body, 'Salt', 'sensory'); assert.ok(salt);
  r = await h.call('Ed', 'mark', { id: salt.id, status: 'low' });
  const ln = r.body.lines.find(l => l.item === salt.id); assert.equal(ln.stage, 'collect'); assert.equal(ln.store, 'cashcarry'); assert.equal(ln.by, 'Ed');
  assert.equal((await h.call('Ed', 'item', { id: salt.id, name: 'Salt', store: 'tj' })).status, 403);
  assert.equal((await h.call('Ed', 'task', { title: 'x' })).status, 403);
  r = await h.call('Ed', 'mark', { id: salt.id, status: 'ok' }); assert.equal(r.body.lines.length, 0);
});
test('an item ordered direct goes to the kitchen to reorder and never to the trip', async () => {
  const h = make(); let r = await h.call('Cook', 'boot'); const cheese = find(r.body, 'Cheese');
  r = await h.call('Cook', 'mark', { id: cheese.id, status: 'out' }); const ln = r.body.lines[0]; assert.equal(ln.stage, 'reorder');
  await h.call('Dee', 'close', {}); r = await h.call('Cook', 'boot'); assert.equal(r.body.lines.find(l => l.id === ln.id).stage, 'reorder');
  r = await h.call('Cook', 'line', { id: ln.id, do: 'reordered' }); assert.equal(find(r.body, 'Cheese').status, 'ok'); assert.ok(!r.body.lines.some(l => l.id === ln.id));
});
test('the week closes with weekly items and what next week\'s menu needs, the Costco delivery part first', async () => {
  const today = new Date(); const la = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(today);
  const mon = (() => { const x = new Date(la + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + 7); return x.toISOString().slice(0, 10); })();
  const h = make({ [mon]: { am: 'Rice cakes with cream cheese', lunch: 'Teriyaki tofu and brown rice' } });
  await h.call('Dee', 'shopper', { name: 'Kai' }); await h.call('Dee', 'settings', { shopperEmail: 'kai@example.org' });
  let r = await h.call('Kai', 'boot'); assert.equal(r.body.role, 'shopper'); assert.ok(Array.isArray(r.body.tasks));
  assert.deepEqual(r.body.menu.needs.map(n => n.name).sort(), ['Cream cheese', 'Rice cakes', 'Tofu']);
  r = await h.call('Ed', 'request', { name: 'Clothespins', section: 'other' }); assert.equal(r.body.lines[0].store, '');
  r = await h.call('Cook', 'line', { id: r.body.lines[0].id, do: 'store', store: 'costco', keep: true }); assert.ok(find(r.body, 'Clothespins'));
  await h.call('Dee', 'close', { which: 'costco' }); r = await h.call('Dee', 'boot');
  const cl = r.body.lines.find(l => l.name === 'Clothespins'); assert.equal(cl.stage, 'delivery');
  await h.call('Dee', 'line', { id: cl.id, do: 'na' });
  r = await h.call('Dee', 'close', {});
  const trip = r.body.lines.filter(l => l.stage === 'trip').map(l => l.name).sort();
  assert.deepEqual(trip, ['Butter', 'Clothespins', 'Cream cheese', 'Eggs', 'Milk', 'Rice cakes', 'Tofu']);
  assert.match(r.body.lines.find(l => l.name === 'Tofu').note, /Teriyaki tofu/);
  assert.equal(h.mails.length, 1); assert.match(h.mails[0].b, /Costco, 5 items/); assert.ok(h.sent.some(s => s.n === 'Kai'));
  // the shopper checks off, moves one, and finishes
  const tofu = r.body.lines.find(l => l.name === 'Tofu'), eggs = r.body.lines.find(l => l.name === 'Eggs');
  await h.call('Kai', 'line', { id: tofu.id, do: 'got' }); await h.call('Kai', 'line', { id: eggs.id, do: 'store', store: 'tj' });
  r = await h.call('Ed', 'mark', { id: find(r.body, 'Pasta').id, status: 'out' }); assert.equal(r.body.lines.find(l => l.name === 'Pasta').late, true);
  r = await h.call('Kai', 'doneshopping', {}); assert.equal(find(r.body, 'Tofu').status, 'ok'); assert.ok(!r.body.lines.some(l => l.name === 'Tofu'));
  assert.equal(r.body.lines.find(l => l.name === 'Eggs').store, 'tj'); assert.equal(find(r.body, 'Eggs').store, 'costco');
  assert.equal(r.body.history[0].name, 'Tofu');
});
test('tasks repeat, and only the director and the shopper see them', async () => {
  const h = make(); await h.call('Dee', 'shopper', { name: 'Kai' });
  let r = await h.call('Dee', 'task', { title: 'Check the drip lines', area: 'Garden', every: 1, unit: 'week', due: '2026-11-02' }); const t = r.body.tasks[0];
  r = await h.call('Kai', 'taskdone', { id: t.id, note: 'One leak fixed' }); assert.ok(r.body.tasks[0].due > '2026-11-02'); assert.equal(r.body.tasks[0].done.length, 1); assert.ok(!r.body.tasks[0].closedAt);
  assert.equal((await h.call('Cook', 'boot')).body.tasks, undefined);
  assert.equal((await h.call('Kai', 'item', { name: 'x' })).status, 403);
});
test('a facilities request with a photo becomes a task for the director and the shopper, and the asker sees only their own', async () => {
  const h = make(); await h.call('Dee', 'shopper', { name: 'Kai' });
  let r = await h.call('Ed', 'request', { name: 'Gate latch is loose', section: 'facilities', note: 'Goat yard', photo: 'data:image/jpeg;base64,' + Buffer.from('abc').toString('base64') });
  assert.equal(r.status, 200); assert.equal(r.body.tasks, undefined); assert.equal(r.body.lines.length, 0); assert.deepEqual(r.body.myRequests.map(x => [x.title, x.done]), [['Gate latch is loose', false]]);
  assert.ok(h.sent.some(s => s.n === 'Kai') && h.sent.some(s => s.n === 'Dee'));
  r = await h.call('Kai', 'boot'); const t = r.body.tasks[0]; assert.equal(t.area, 'Facilities'); assert.equal(t.by, 'Ed'); assert.match(t.src, /^\/original\/kt-/); assert.equal(r.body.myRequests.length, 0);
  await h.call('Kai', 'taskdone', { id: t.id }); r = await h.call('Ed', 'boot'); assert.equal(r.body.myRequests[0].done, true);
});
