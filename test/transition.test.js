'use strict';
// The transition summary for a child going to kindergarten or TK. Drafted only from the child's own observations, portfolio
// and conference notes, never with DRDP levels or ratings, edited and marked ready by educators, printed as PDF and Word,
// and seen by the family only once the director shares it. The server decides what a family receives.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const t0 = new Date(); const y0 = t0.getMonth() >= 7 ? t0.getFullYear() : t0.getFullYear() - 1;
const YEAR = y0 + '-' + String(y0 + 1).slice(2), NEXT = (y0 + 1) + '-' + String(y0 + 2).slice(2);

test('Transition summary', async t => {
  const now = Date.now(), day = 864e5;
  const fx = await start({ more: put => {
    put('children/pip-test.json', { first: 'Pip', last: 'Test', classroom: 'North', group: '', dob: '2021-11-03', status: 'active', transition: { [NEXT]: { plan: 'k' } }, parents: [{ name: 'A parent', email: 'pip.family@example.test' }] });
    put('children/rue-test.json', { first: 'Rue', last: 'Test', classroom: 'North', dob: '2022-05-01', status: 'active', parents: [{ name: 'Another parent', email: 'rue.family@example.test' }] });
    put('notices/o1.json', { id: 'o1', noticed: 'Pip dug for worms with Rue and counted nine.', wonder: 'what Pip knows about soil', classroom: 'North', children: ['pip-test'], by: 'Bea', at: now - 5 * day });
    put('notices/o2.json', { id: 'o2', noticed: 'Rue painted the gate blue.', wonder: '', classroom: 'North', children: ['rue-test'], by: 'Bea', at: now - 4 * day });
    put('notices/o3.json', { id: 'o3', noticed: 'Pip ran from the circle when asked to sit.', wonder: '', classroom: 'North', children: ['pip-test'], by: 'Bea', at: now - 3 * day });
    put('inquiries/i1.json', { id: 'i1', name: 'Running from requests', room: 'North', status: 'open', obs: ['o3'], threads: [], projects: [] });
    put('conferences/pip-test--' + YEAR + '-fall.json', { childId: 'pip-test', schoolYear: YEAR, term: 'Fall', fields: { interests: 'Worms and digging', helps: '', documentation: 'DRDP evidence box text', friends: 'Plays with Rue most days' } });
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip-test'] }, { email: 'rue.family@example.test', children: ['rue-test'] }] });
  } });
  const kid = id => JSON.parse(fs.readFileSync(path.join(fx.dir, 'children', id + '.json'), 'utf8'));
  const family = async email => { const c = await fx.as('', '/family/code', { email }); const l = await fx.as('', '/family/login', { email, code: c.body.code }); return l.body.token; };
  const famData = async tok => (await fx.as(tok, '/family/data', {})).body;
  const save = () => new Promise(r => setTimeout(r, 1500));
  t.after(async () => { await fx.stop(); });

  await t.test('the server gives a family only a summary the director shared, and only an educator\'s words reach it otherwise', async () => {
    const ann = (await fx.login('Ann', '1357')).token, dee = (await fx.login('Dee', 'director-pass-1')).token;
    const pipFam = await family('pip.family@example.test'), rueFam = await family('rue.family@example.test');
    // an educator writes and tries to share it, and the share is left out
    let r = await fx.as(ann, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { [YEAR]: { sections: { who: 'Pip loves worms.' }, status: 'ready', shared: { at: new Date().toISOString(), sections: { who: 'Pip loves worms.' } } } } } });
    assert.strictEqual(r.status, 200); await save();
    assert.strictEqual(kid('pip-test').transitionSummary[YEAR].sections.who, 'Pip loves worms.');
    assert.strictEqual(kid('pip-test').transitionSummary[YEAR].shared, undefined);
    let d = await famData(pipFam);
    assert.strictEqual(d.children[0].transition, null); assert.doesNotMatch(JSON.stringify(d), /loves worms/);
    // a whole record saved by an educator, or a patch that takes it away, keeps the summary
    const doc = kid('pip-test'); delete doc.transitionSummary;
    await fx.as(ann, '/api/write', { op: 'set', kind: 'children', id: 'pip-test', data: doc });
    await fx.as(ann, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { __delete__: true } } }); await save();
    assert.strictEqual(kid('pip-test').transitionSummary[YEAR].sections.who, 'Pip loves worms.');
    // the director shares it, and only that child's family sees it, as it read when shared
    await fx.as(dee, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { [YEAR]: { shared: { at: new Date().toISOString(), by: 'Dee', plan: 'k', sections: { who: 'Pip loves worms.', play: '' } } } } } });
    await fx.as(ann, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { [YEAR]: { sections: { who: 'Pip loves worms and beetles.' } } } } }); await save();
    d = await famData(pipFam); const tr = d.children[0].transition;
    assert.deepStrictEqual(tr.sections, [['Who this child is', 'Pip loves worms.']]); assert.strictEqual(tr.next, 'Going to kindergarten next year'); assert.match(tr.age, /^\d+ years?( \d+ months?)?$/);
    assert.doesNotMatch(JSON.stringify(await famData(rueFam)), /worms/);
    // the director stops sharing it
    await fx.as(dee, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { [YEAR]: { shared: { __delete__: true } } } } }); await save();
    d = await famData(pipFam); assert.strictEqual(d.children[0].transition, null); assert.doesNotMatch(JSON.stringify(d), /worms/);
    // start over for the page
    await fx.as(dee, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { __delete__: true } } }); await save();
  });

  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch(); t.after(async () => { await b.close(); });
  const prompts = [];
  const serve = async route => { const prompt = JSON.parse(route.request().postData()).content.map(c => c.text || '').join('');
    if (/^Proofread/.test(prompt)) { await route.fulfill({ json: { text: '{"fixes":[]}' } }); return; }
    prompts.push(prompt);
    await route.fulfill({ json: { text: JSON.stringify({ who: 'Pip is a curious digger who loves worms.', play: 'Pip counted nine worms. Pip is at DRDP level Building Middle in counting.', friends: 'Pip plays with R. most days.', working: '', helps: 'A teacher nearby helps Pip — and time to dig.' }) } }); };

  await t.test('an educator drafts, changes and marks it ready on a phone', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.route('**/api/read', serve);
    await s.p.evaluate(() => { kidOpen = 'rue-test'; kidTab = 'overview'; goView('child'); }); await s.p.waitForTimeout(600);
    assert.strictEqual(await s.p.$('[data-ktab="transition"]'), null);
    await s.p.evaluate(() => { kidOpen = 'pip-test'; kidTab = 'overview'; goView('child'); }); await s.p.waitForSelector('[data-ktab="transition"]');
    await s.p.click('[data-ktab="transition"]'); await s.p.waitForSelector('[data-tsdraft]');
    let text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Going to kindergarten next year\. Age \d+ years/); assert.match(text, /Nothing is written yet/);
    await s.p.click('[data-tsdraft]'); await s.p.waitForFunction(() => document.querySelector('[data-ts="who"]').value.length > 0, null, { timeout: 15000 });
    const pr = prompts[0];
    assert.match(pr, /dug for worms with R\. and counted nine/); assert.match(pr, /Worms and digging/); assert.match(pr, /Plays with R\. most days/);
    assert.doesNotMatch(pr, /painted the gate/); assert.doesNotMatch(pr, /ran from the circle/); assert.doesNotMatch(pr, /DRDP evidence box/); assert.doesNotMatch(pr, /Rue/);
    const val = k => s.p.inputValue(`[data-ts="${k}"]`);
    assert.strictEqual(await val('play'), 'Pip counted nine worms.');
    assert.strictEqual(await val('helps'), 'An educator nearby helps Pip, and time to dig.');
    assert.strictEqual(await val('working'), '');
    await s.p.fill('[data-ts="working"]', 'Pip is practicing waiting for a turn at the hose.'); await s.p.locator('[data-ts="working"]').blur(); await save();
    assert.strictEqual(kid('pip-test').transitionSummary[YEAR].sections.working, 'Pip is practicing waiting for a turn at the hose.');
    // rating words keep it from being marked ready
    await s.p.fill('[data-ts="who"]', 'Pip scored high on the DRDP.'); await s.p.locator('[data-ts="who"]').blur();
    assert.match(await s.p.textContent('#ts-warn'), /Who this child is has words about the DRDP/);
    await s.p.click('[data-tsready="1"]'); await s.p.waitForTimeout(1500);
    assert.strictEqual(kid('pip-test').transitionSummary[YEAR].status, 'draft');
    await s.p.fill('[data-ts="who"]', 'Pip is a curious digger who loves worms.'); await s.p.locator('[data-ts="who"]').blur(); await save();
    await s.p.click('[data-tsready="1"]'); await s.p.waitForSelector('[data-tsready="0"]', { timeout: 15000 }); await save();
    const x = kid('pip-test').transitionSummary[YEAR];
    assert.strictEqual(x.status, 'ready'); assert.strictEqual(x.readyBy, 'Ann'); assert.strictEqual(x.shared, undefined);
    assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the director shares it from Shared with the family, prints it, and stops sharing it', async () => {
    const pipFam = await family('pip.family@example.test');
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    s.p.on('dialog', dl => dl.accept()); await s.p.route('**/api/read', serve);
    await s.p.evaluate(() => { kidOpen = 'pip-test'; kidTab = 'details'; goView('child'); }); await s.p.waitForSelector('[data-tsshare]');
    await s.p.click('[data-tsshare]'); await save();
    const x = kid('pip-test').transitionSummary[YEAR];
    assert.strictEqual(x.shared.by, 'Dee'); assert.strictEqual(x.shared.sections.working, 'Pip is practicing waiting for a turn at the hose.');
    const d = await famData(pipFam); assert.strictEqual(d.children[0].transition.sections.length, 5);
    // the PDF and the Word file are made by the same print helpers as every other printout, which load from the internet,
    // so here they only hold on to what they are given
    await s.p.evaluate(() => { kidTab = 'transition'; renderMain(); }); await s.p.waitForSelector('[data-print="transition"]');
    assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /Ready and shared with the family/);
    await s.p.evaluate(() => { window.__made = []; window.makePdf = async (list, name) => { __made.push({ name, list }); }; window.makeDocx = async (list, name) => { __made.push({ name, list }); }; });
    await s.p.click('[data-print="transition"]:not([data-word])'); await s.p.waitForFunction(() => __made.length === 1, null, { timeout: 15000 });
    await s.p.click('[data-print="transition"][data-word]'); await s.p.waitForFunction(() => __made.length === 2, null, { timeout: 15000 });
    const made = await s.p.evaluate(() => __made);
    assert.deepStrictEqual(made.map(m => m.name), ['Transition summary Pip Test.pdf', 'Transition summary Pip Test.docx']);
    const doc = made[0].list[0];
    assert.strictEqual(doc.title, 'Transition summary'); assert.deepStrictEqual(doc.meta.map(m => m[0]), ['Child', 'Age', 'Next year', 'Class', 'Date']);
    assert.match(doc.meta[1][1], /^\d+ years?/);
    assert.deepStrictEqual(doc.blocks.map(x => x.label), ['Who this child is', 'How they play and learn', 'Friends and relationships', 'What they are working on', 'What helps']);
    assert.doesNotMatch(JSON.stringify(doc), /DRDP|level|teacher|[–—]/);
    await s.p.evaluate(() => { kidTab = 'details'; renderMain(); }); await s.p.waitForSelector('[data-tsunshare]');
    await s.p.click('[data-tsunshare]'); await save();
    assert.strictEqual(kid('pip-test').transitionSummary[YEAR].shared, undefined);
    assert.strictEqual((await famData(pipFam)).children[0].transition, null);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the Copy for the next school leaves out other children, and the staff copy stays as written', async () => {
    const ann = (await fx.login('Ann', '1357')).token;
    await fx.as(ann, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { [YEAR]: { sections: { friends: 'Pip and Rue dig together. R.T. joins them.' } } } } }); await save();
    const r = await fx.as(ann, '/api/transition/nextschool', { id: 'pip-test', year: YEAR });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.sections.friends, 'Pip and a friend dig together. A friend joins them.');
    const kit = (await fx.login('Kit', '1357')).token;
    assert.strictEqual((await fx.as(kit, '/api/transition/nextschool', { id: 'pip-test', year: YEAR })).status, 403);
    assert.strictEqual(kid('pip-test').transitionSummary[YEAR].sections.friends, 'Pip and Rue dig together. R.T. joins them.');
    const s = await signedIn(fx, b, 'Ann', '1357', 390); await s.p.route('**/api/read', serve);
    await s.p.evaluate(() => { kidOpen = 'pip-test'; kidTab = 'transition'; goView('child'); }); await s.p.waitForSelector('[data-print="transitionnext"]');
    await s.p.evaluate(() => { window.__made = []; window.makePdf = async (list, name) => { __made.push({ name, list }); }; window.makeDocx = async (list, name) => { __made.push({ name, list }); }; });
    await s.p.click('[data-print="transitionnext"]:not([data-word])'); await s.p.waitForFunction(() => __made.length === 1, null, { timeout: 15000 });
    await s.p.click('[data-print="transitionnext"][data-word]'); await s.p.waitForFunction(() => __made.length === 2, null, { timeout: 15000 });
    await s.p.click('[data-print="transition"]:not([data-word])'); await s.p.waitForFunction(() => __made.length === 3, null, { timeout: 15000 });
    const made = await s.p.evaluate(() => __made);
    assert.deepStrictEqual(made.map(m => m.name), ['Transition summary for the next school Pip Test.pdf', 'Transition summary for the next school Pip Test.docx', 'Transition summary Pip Test.pdf']);
    assert.doesNotMatch(JSON.stringify(made[0].list), /\bRue\b|R\.T\.|"photo"/); assert.match(JSON.stringify(made[0].list), /a friend dig together/);
    assert.match(JSON.stringify(made[2].list), /Pip and Rue dig together/);
    assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the Family page shows a shared summary to that family', async () => {
    const dee = (await fx.login('Dee', 'director-pass-1')).token;
    await fx.as(dee, '/api/write', { op: 'update', kind: 'children', id: 'pip-test', patch: { transitionSummary: { [YEAR]: { shared: { at: new Date().toISOString(), by: 'Dee', plan: 'k', sections: { who: 'Pip is a curious digger.' } } } } } }); await save();
    const tok = await family('pip.family@example.test');
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [tok]);
    await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForTimeout(2500);
    const body = await p.evaluate(() => document.body.innerText);
    assert.match(body, /Transition summary/);
    await p.click('summary:has-text("Transition summary")'); assert.match(await p.evaluate(() => document.body.innerText), /Pip, \d+ years?.*Going to kindergarten next year\.\s+Who this child is\s+Pip is a curious digger/s);
    assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepStrictEqual(errors, []); await ctx.close();
  });
});

test('the family copy of a transition summary never names another child, and the staff copy stays as written', () => {
  const kids = new Map([['pip', { doc: { first: 'Pip', last: 'Test', dob: '2021-11-03', status: 'active', transitionSummary: { '2026-27': { sections: { friends: 'Plays with Rue most days.' }, shared: { at: '2026-10-01', plan: 'k', sections: { friends: 'Pip plays with Rue and Oak Lane. R. and Pip dug. Rue\'s tower fell. Bea, an educator, helped.' } } } } } }],
    ['rue', { doc: { first: 'Rue', last: 'Moss', status: 'active', familyQuestionnaire: { answers: ['We call her Bunny'] } } }], ['oak', { doc: { first: 'Oak', last: 'Lane', status: 'active' } }]]);
  const store = { recs: { participation: new Map(), children: kids, conferences: new Map(), menus: new Map(), grant: new Map(), newsletters: new Map(), bins: new Map() } };
  const fam = require('../family.js')({ store, log: () => {}, sign: s => s, noteChange: () => {}, scheduleSave: () => {}, mailCode: async () => {}, photoSrc: id => id, keepPhoto: async () => {}, handbook: () => null });
  const f = { email: 'p@x.test', kids: [Object.assign({ id: 'pip' }, kids.get('pip').doc)], test: false };
  const tr = fam.familyView(f).children[0].transition;
  const text = tr.sections.map(x => x[1]).join(' ');
  assert.doesNotMatch(text, /\bRue\b|\bOak\b|\bLane\b|\bMoss\b|\bR\./);
  assert.match(text, /Pip plays with friends\. A friend and Pip dug\. A friend's tower fell\. Bea, an educator, helped\./);
  assert.strictEqual(fam.withoutOthers('Bunny laughed.', { id: 'pip', first: 'Pip' }, [...kids].map(([id, r]) => Object.assign({ id }, r.doc))), 'A friend laughed.');
  // another child's initials that share this child's first letter, names that are everyday words, the school's own
  // words, and a brother or sister
  const rosa = { id: 'rosa', first: 'Rosa', last: 'Lee', parents: [{ email: 'lee@example.test' }] };
  const others = [rosa, { id: 'rt', first: 'Ruby', last: 'Tran' }, { id: 'mg', first: 'May', last: 'Green' }, { id: 'sl', first: 'Sam', last: 'Lee', parents: [{ email: 'lee@example.test' }] }, { id: 'af', first: 'Ava', last: 'Fulton' }];
  assert.strictEqual(fam.withoutOthers('Rosa plays with R.T. every day.', rosa, others), 'Rosa plays with a friend every day.');
  assert.strictEqual(fam.withoutOthers('May I help? She played with May.', rosa, others), 'May I help? She played with a friend.');
  assert.strictEqual(fam.withoutOthers('Green beans grew. Ava Green ran.', rosa, others), 'Green beans grew. A friend ran.');
  assert.strictEqual(fam.withoutOthers('Rosa and Sam built a tower at Fulton.', rosa, others), 'Rosa and Sam built a tower at Fulton.');
  assert.strictEqual(kids.get('pip').doc.transitionSummary['2026-27'].sections.friends, 'Plays with Rue most days.');
});
