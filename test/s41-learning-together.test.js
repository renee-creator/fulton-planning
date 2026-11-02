'use strict';
// Learning together on the Family page. A piece waits as a draft until the director marks it ready, finishing it counts a
// half hour once for the child the family chooses, and what a parent writes while wondering stays on their own device and
// never reaches the server. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser } = require('./fixture.js');

const PIECE = '<!--\nstatus: draft\norder: 1\naudience: learning\nminutes: 30\nsource: A test, November 1, 2026\n-->\n# Big Feelings at Home\n\nA few words about big feelings.\n\n## Wondering together\n\n- What helps your child feel steady?\n- What helps you feel steady?\n';

test('a Learning together piece counts a half hour once and the wonderings stay on the device', async t => {
  const fx = await start({ more: put => {
    put('staff/familypieces/together-feelings.md', PIECE);
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip', 'ivy'] }] });
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
    put('children/ivy.json', { first: 'Ivy', last: 'Test', classroom: 'North', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  const data = () => fx.as(fam, '/family/data', {}).then(r => r.body);
  // a draft reaches no family
  let d = await data(); assert.deepStrictEqual(d.learning, []);
  const L = (await fx.as(dee, '/api/staff/familypieces', {})).body.list; assert.strictEqual(L[0].audience, 'learning'); assert.strictEqual(L[0].minutes, 30);
  await fx.as(dee, '/api/staff/familypieces/ready', { slug: 'together-feelings', on: true });
  d = await data(); assert.strictEqual(d.learning.length, 1); assert.strictEqual(d.learning[0].title, 'Big Feelings at Home'); assert.deepStrictEqual(d.pieces, [], 'it is not under Good to know');
  // finishing counts a half hour for the child chosen, and only once
  d = (await fx.as(fam, '/family/learned', { slug: 'together-feelings', childId: 'ivy' })).body;
  await fx.as(fam, '/family/learned', { slug: 'together-feelings', childId: 'ivy' });
  d = await data();
  assert.deepStrictEqual(d.children.map(k => [k.first, k.hours]), [['Pip', 0], ['Ivy', 0.5]]);
  assert.deepStrictEqual(d.learning[0].done, ['ivy']);
  assert.strictEqual(d.entries.filter(e => e.type === 'learning').length, 1);
  // the page, the wonderings kept on the device and never sent
  const b = await browser(); if (!b) return;
  const br = await b.launch(); t.after(() => br.close());
  const p = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errors = [], sent = []; p.on('pageerror', e => errors.push(e.message));
  p.on('request', r => { if (r.method() === 'POST') sent.push(r.postData() || ''); });
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [fam]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('button[data-tab="learn"]', { timeout: 10000 }); await p.click('button[data-tab="learn"]');
  await p.click('summary:has-text("Big Feelings at Home")');
  await p.fill('[data-wq="together-feelings|0"]', 'A quiet corner and a hug'); await p.selectOption('#lk-learn-together-feelings', 'pip'); await p.click('[data-learndone="together-feelings"]');
  await p.waitForSelector('text=Our journal');
  const txt = await p.innerText('#main'); assert.match(txt, /Our journal[\s\S]*1 entry, on this device only/);
  assert.ok(sent.every(s => !/quiet corner/.test(s)), 'the wonderings never leave the device');
  assert.deepStrictEqual((await data()).children.map(k => k.hours), [0.5, 0.5]);
  assert.doesNotMatch(await p.innerText('body'), /[—–]|\bteacher|\bClaude\b/);
  assert.deepStrictEqual(errors, []);
});

test('the director writes a family piece in full, kept with its earlier version', async t => {
  const fx = await start({ more: put => { put('staff/familypieces/tk.md', '<!--\nstatus: draft\naudience: tk\n-->\n# Old Title\n\nOld words.\n'); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  assert.strictEqual((await fx.as(ann, '/api/staff/familypieces/write', { slug: 'tk', text: '<!--\n-->\n# X\n' })).status, 403);
  assert.strictEqual((await fx.as(dee, '/api/staff/familypieces/write', { slug: 'tk', text: 'No comment and no title' })).status, 400);
  let L = (await fx.as(dee, '/api/staff/familypieces/write', { slug: 'tk', text: '<!--\nstatus: draft\naudience: tk\n-->\n# New Title\n\nNew words.\n', note: 'Merged' })).body.list;
  assert.deepStrictEqual(L.map(x => [x.slug, x.title, x.audience, x.waiting]), [['tk', 'New Title', 'tk', true]]);
  L = (await fx.as(dee, '/api/staff/familypieces/write', { slug: 'together-new', text: '<!--\nstatus: draft\naudience: learning\nminutes: 30\n-->\n# A New Piece\n\nWords.\n' })).body.list;
  assert.deepStrictEqual(L.map(x => x.slug).sort(), ['tk', 'together-new']);
  const hist = (await fx.as(dee, '/api/staff/page', { path: 'staff/familypieces/tk.md' })).body.history || [];
  assert.ok(hist.some(h => /Old words/.test(h.text || '') || h.title === 'Old Title'), 'the earlier version is kept');
});


test('a family version sits on its PD module page for the director, and stays off the Family Handbook card', async t => {
  const MOD = PIECE.replace('minutes: 30\n', 'minutes: 30\nmodule: documentation\n');
  const fx = await start({ more: put => { put('staff/familypieces/together-feelings.md', MOD); put('staff/familypieces/info.md', '<!--\nstatus: draft\naudience: all\n-->\n# Good to Know Piece\n\nWords.\n'); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const L = (await fx.as(dee, '/api/staff/familypieces', {})).body.list;
  assert.strictEqual(L.find(x => x.slug === 'together-feelings').module, 'documentation');
  const chromium = await browser(); if (!chromium) return;
  const { signedIn } = require('./fixture.js');
  const b = await chromium.launch(); t.after(() => b.close());
  const sd = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280); const errors = []; sd.p.on('pageerror', e => errors.push(e.message));
  await sd.p.evaluate(() => goView('stpd')); await new Promise(r => setTimeout(r, 3000));
  await sd.p.evaluate(() => { const L = [...document.querySelectorAll('[data-stmod="m:documentation"]')]; L[L.length - 1].click(); });
  await sd.p.waitForSelector('text=For families', { timeout: 15000 });
  let txt = await sd.p.innerText('#main');
  assert.match(txt, /For families[\s\S]*Big Feelings at Home[\s\S]*Draft/);
  await sd.p.click('summary:has-text("Big Feelings at Home")'); await sd.p.click('[data-fpready="together-feelings|1"]');
  await sd.p.waitForSelector('text=On the Family page', { timeout: 10000 });
  assert.strictEqual((await fx.as(dee, '/api/staff/familypieces', {})).body.list.find(x => x.slug === 'together-feelings').waiting, false);
  assert.doesNotMatch(await sd.p.innerText('#main'), /[—–]|\bClaude\b/);
  assert.deepStrictEqual(errors, []);
});
