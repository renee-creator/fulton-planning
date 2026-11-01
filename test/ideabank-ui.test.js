'use strict';
// The Idea bank in TREE. The pages that moved under Plans, Planning resources, Search finding a card the first time, the
// behavior lookup, the inquiry pickers saved with the inquiry, We'll try this, the Family page's home cards only, the
// Help answers that moved, and a guide link that opens its card. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

const more = put => {
  put('inquiries/q1.json', { id: 'q1', name: 'Blocks across the room', room: 'West', status: 'open', see: 'Blocks fly at the end of the morning.', tries: [], hyps: [], threads: [], projects: [], obs: [], createdAt: Date.now() - 864e5 });
  put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
  put('staff/help.json', { id: 'help', list: [{ id: 'h27', q: 'What is on the Garden page?', a: ['Open Documentation and tap Garden.', 'Read Today in the garden.'], go: 'garden', label: 'Garden', roles: ['educator', 'director'], words: 'garden', quick: false },
    { id: 'h14', q: 'How do I use a materials guide?', a: ['In a plan, open Help me start under the materials section.', 'Open Materials library and tap Guide beside a group.', 'When the plan\'s Classroom area matches a guide, tap Open the guide.', 'Print the guide as PDF or Word from the guide page.'], go: 'plans', label: 'Plans', roles: ['educator', 'director'], words: 'materials guide library atelier loose parts', quick: false }] });
  put('staff/helpready.json', { id: 'helpready', on: true });
  put('staff/guides/clay.md', '<!--\nstatus: draft\ngroup: Sculpture\narea: Art\n-->\n# Educators and Clay\n\nA block.\n');
};

test('the Idea bank in TREE', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  for (let i = 0; i < 100; i++) { const r = await fx.as(dee, '/api/staff/ideabank', {}); if (r.status === 200 && r.body.cards) break; await wait(200); }

  await t.test('Help answers name the new places, and the Idea bank has its own', async () => {
    let L = [];for (let i = 0; i < 60; i++) { L = (await fx.as(dee, '/api/staff/help', {})).body.list || []; if (L.some(x => x.id === 'hib1')) break; await wait(250); }
    assert.deepStrictEqual(L.find(x => x.id === 'h27').a[0], 'Open Plans, then Planning resources, and tap Garden.');
    assert.match(L.find(x => x.id === 'h14').q, /Idea bank card/);
    assert.ok(L.some(x => x.id === 'hib3' && /What are you seeing/.test(x.q)));
    for (const x of L) for (const t of [x.q, ...x.a]) assert.doesNotMatch(t, /[—–;:]|\bClaude\b/);
  });

  await t.test('the pages moved under Plans, Planning resources, and old links still open them', async () => {
    const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280);
    const docs = await s.p.evaluate(() => SUBS.docs.map(x => x[0]));
    for (const k of ['garden', 'artists', 'museums', 'recipes', 'songs']) assert.ok(!docs.includes(k), k + ' left Documentation');
    for (const k of ['slides', 'walls', 'stories', 'grant', 'kitchen']) assert.ok(docs.includes(k), k + ' stays');
    await s.p.evaluate(() => goView('plans')); await wait(300);
    assert.strictEqual(await s.p.evaluate(() => document.querySelector('details.planres') && document.querySelector('details.planres').open), false, 'Planning resources starts closed');
    assert.deepStrictEqual(await s.p.evaluate(() => [...document.querySelectorAll('details.planres [data-tview]')].map(x => x.textContent)), ['Idea bank', 'Garden', 'Artists', 'Museums and cultural places', 'Recipes', 'Songs and stories']);
    for (const v of ['garden', 'recipes', 'songs', 'artists', 'ideabank']) {
      await s.p.evaluate(v => goView(v), v); await wait(400);
      assert.strictEqual(await s.p.evaluate(() => secOf(view)), 'plans');
      assert.ok(await s.p.evaluate(() => document.querySelector('details.planres').open), v + ' opens the group it is in');
    }
    // the address of a materials guide opens the card it was folded into
    await s.p.evaluate(() => { guideSel = 'clay'; goView('guide'); }); await s.p.waitForFunction(() => view === 'ideabank' && /Educators and Clay|Clay/.test(document.querySelector('#ibright') ? document.querySelector('#ibright').innerText : ''), null, { timeout: 15000 });
    assert.strictEqual(await s.p.evaluate(() => ibSt.sel), 'clay');
    assert.strictEqual(await s.p.evaluate(() => guideBy('group', 'Sculpture').slug + '|' + guideBy('area', 'Writing center').slug), 'clay|writing-center');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the card view, its order, the two sides and printing', async () => {
    const s = await signedIn(fx, br, 'Ann', '1357', 1280);
    await s.p.evaluate(() => goView('ideabank')); await s.p.waitForFunction(() => ib && ib.cards, null, { timeout: 15000 });
    await s.p.evaluate(() => ibOpen('watercolor', 'edu')); await wait(300);
    const txt = await s.p.$eval('#ibright', el => el.innerText);
    const at = w => txt.indexOf(w);
    assert.ok(at('Open to all') < at('Invitations') && at('Invitations') < at('Ways it can grow') && at('Ways it can grow') < at('Feeds') && at('Feeds') < at('Supports') && at('Supports') < at('Connected to'));
    assert.match(txt, /For a child who seeks more/);
    await s.p.evaluate(() => { ibSt.side = 'home'; renderMain(); }); await wait(200);
    const home = await s.p.$eval('#ibright', el => el.innerText); assert.match(home, /Watercolor at Home/); assert.doesNotMatch(home, /Feeds|Open to all/);
    await s.p.click('#ibright [data-ibopen], #ibright [data-ibside="edu"]'); await wait(200);
    // a Connected to entry that names a card opens it
    await s.p.evaluate(() => { ibSt.side = 'edu'; renderMain(); }); await s.p.click('#ibright li button[data-ibopen="color-mixing"]'); await wait(300);
    assert.strictEqual(await s.p.evaluate(() => ibSt.sel), 'color-mixing');
    // Select all shown, and one card to a page
    await s.p.click('[data-ibmode="list"]'); await wait(200); await s.p.click('[data-ibselall]'); await wait(200);
    const n = await s.p.evaluate(() => ibPick.size); assert.ok(n >= 3);
    const docs = await s.p.evaluate(async () => (await ibPrintDocs('home|' + [...ibPick].join(','))).map(d => [d.title, !!d.centered]));
    assert.strictEqual(docs.length, n); assert.ok(docs.every(d => / at Home$/.test(d[0])));
    assert.ok(await s.p.evaluate(() => !!document.querySelector('[data-print="ibcards"][data-word="1"]')), 'a Word copy');
    assert.doesNotMatch(await s.p.evaluate(async () => JSON.stringify(await ibPrintDocs('edu|clay,water,chalk'))), /\bClaude\b(?! Monet)/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('Search finds a card on the first search', async () => {
    const s = await signedIn(fx, br, 'Ann', '1357', 390);
    await s.p.evaluate(() => goView('search')); await wait(200);
    await s.p.fill('#gq', 'tortilla press');
    await s.p.waitForSelector('[data-ibopen="piazza-and-culinary-atelier"]', { timeout: 15000 });
    await s.p.fill('#gq', 'throwing');
    await s.p.waitForSelector('[data-ibseeing="throwing-objects"]', { timeout: 5000 });
    await s.p.click('[data-ibseeing="throwing-objects"]'); await wait(400);
    assert.strictEqual(await s.p.evaluate(() => view + '|' + ibSt.mode), 'ideabank|seeing');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a fresh page never shows results before the libraries', async () => {
    const s = await signedIn(fx, br, 'Ann', '1357', 390);
    const first = await s.p.evaluate(() => { gs.q = 'clay'; goView('search'); return document.querySelector('#gres').innerText; });
    assert.ok(/Loading our libraries/.test(first) || /Idea bank/.test(first), 'a loading line, or the libraries already there');
    await s.p.waitForSelector('[data-ibopen="clay"]', { timeout: 15000 });
    await s.close();
  });

  await t.test('What are you seeing? and Start a team inquiry with this', async () => {
    const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('ideabank')); await s.p.waitForFunction(() => ib && ib.cards, null, { timeout: 15000 });
    await s.p.click('[data-ibmode="seeing"]'); await s.p.fill('#ib-bq', 'covering ears'); await wait(400);
    const chip = await s.p.$$eval('[data-ibbeh]', xs => xs.map(x => x.dataset.ibbeh)); assert.ok(chip.length >= 1);
    await s.p.click('[data-ibbeh="throwing-objects"]').catch(async () => { await s.p.fill('#ib-bq', 'throw'); await wait(300); await s.p.click('[data-ibbeh="throwing-objects"]'); });
    await wait(300);
    const txt = await s.p.$eval('#ibright', el => el.innerText);
    for (const w of ['What the child might be seeking', 'First steps', 'Keeping everyone safe', 'Ideas that may help', 'Can feed']) assert.match(txt, new RegExp(w));
    await s.p.click('[data-ibinq="throwing-objects"]'); await wait(400);
    const f = await s.p.evaluate(() => iqForm && { n: iqForm.ibNeeds, s: iqForm.ibSys, name: iqForm.name });
    assert.ok(f.n.includes('Moving things through the air (trajectory schema)')); assert.strictEqual(f.s['Body pressure and heavy work (proprioception)'], 'seek'); assert.strictEqual(f.name, 'Throwing things');
    assert.deepStrictEqual(s.errors, []); await s.close();
    // an educator writes what was tried first, then may open a team inquiry when it keeps happening
    const a = await signedIn(fx, br, 'Ann', '1357', 1280);
    await a.p.evaluate(async () => { await ibLoad(); ibSt.mode = 'seeing'; ibSt.bsel = 'throwing-objects'; goView('ideabank'); }); await wait(400);
    assert.strictEqual(await a.p.$('[data-ibinq="throwing-objects"]'), null, 'no inquiry before a try is written');
    assert.match(await a.p.$eval('#ibright', el => el.innerText), /What the child might need from us/);
    await a.p.click('[data-ibtryopen="throwing-objects"]'); await wait(200);
    await a.p.fill('#ib-trh', 'Threw beanbags at the target for a while, then blocks again at cleanup.');
    await a.p.click('[data-ibtry="throwing-objects"]'); await a.p.waitForSelector('[data-ibinq="throwing-objects"]', { timeout: 10000 });
    await a.p.click('[data-ibinq="throwing-objects"]'); await wait(300);
    assert.strictEqual(await a.p.evaluate(() => !!iqForm), false, 'the box is checked first');
    await a.p.check('#ib-keeps'); await a.p.click('[data-ibinq="throwing-objects"]'); await wait(400);
    const g = await a.p.evaluate(() => iqForm && { by: iqForm.startedBy, tried: iqForm.tried.length, us: iqForm.ibUs, display: iqForm.display });
    assert.strictEqual(g.by, 'Ann'); assert.strictEqual(g.tried, 1); assert.ok(g.us.length >= 2); assert.strictEqual(g.display, false);
    await a.p.click('[data-iqmake="1"]'); await wait(2500);
    const dirQ = path.join(fx.dir, 'inquiries'); const kept = fs.readdirSync(dirQ).map(f => JSON.parse(fs.readFileSync(path.join(dirQ, f), 'utf8')));
    assert.ok(kept.some(x => x.ibFrom === 'throwing-objects' && x.startedBy === 'Ann' && x.tried.length === 1), 'the server keeps the inquiry the educator opened');
    assert.deepStrictEqual(a.errors, []); await a.close();
  });

  await t.test('the inquiry pickers save with the inquiry, and We\'ll try this', async () => {
    const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(async () => { await ibLoad(); openInquiry('q1'); }); await s.p.waitForSelector('[data-ibiqneed]', { timeout: 15000 });
    await s.p.click('[data-ibiqneed="Knocking down and changing things (transformation schema)"]'); await wait(200);
    await s.p.click('[data-ibiqmode="avoid"]'); await wait(200);
    await s.p.fill('[data-ibiqdev]', 'Common at two. Still guided.'); await wait(1200);
    assert.strictEqual(await s.p.evaluate(() => inquiries.get('q1').ibDev), 'Common at two. Still guided.');
    await s.p.click('[data-ibiqsys="Listening and sound (auditory)"]'); await wait(300);
    assert.ok(await s.p.evaluate(() => document.querySelectorAll('[data-ibiqtry]').length > 0), 'possibilities show');
    const file = path.join(fx.dir, 'inquiries/q1.json');
    let d = null; for (let i = 0; i < 60; i++) { await wait(250); try { d = JSON.parse(fs.readFileSync(file, 'utf8')); if (d.ibSys) break; } catch (e) {} }
    assert.deepStrictEqual(d.ibNeeds, ['Knocking down and changing things (transformation schema)']); assert.deepStrictEqual(d.ibSys, { 'Listening and sound (auditory)': 'avoid' }); assert.strictEqual(d.ibMode, 'avoid');
    assert.match(await s.p.evaluate(() => document.querySelector('[data-ibiqtry]').closest('.prow').innerText), /Can feed|Supports/);
    await s.close();
    // an educator reads the pickers, and the team's choice to try a card is added and kept
    const a = await signedIn(fx, br, 'Ann', '1357', 1280);
    await a.p.evaluate(async () => { await ibLoad(); openInquiry('q1'); }); await a.p.waitForSelector('[data-ibiqtry]', { timeout: 15000 });
    assert.ok(await a.p.evaluate(() => document.querySelector('[data-ibiqneed]').disabled), 'educators read the pickers');
    const id = await a.p.evaluate(() => document.querySelector('[data-ibiqtry]').dataset.ibiqtry);
    assert.strictEqual(await a.p.evaluate(() => (inquiries.get('q1').tries || []).length), 0, 'nothing is added unless the team chooses');
    await a.p.click(`[data-ibiqtry="${id}"]`);
    for (let i = 0; i < 60; i++) { await wait(250); d = JSON.parse(fs.readFileSync(file, 'utf8')); if ((d.tries || []).length) break; }
    assert.strictEqual(d.tries[0].idea, id); assert.match(d.tries[0].text, /from the Idea bank/);
    assert.ok(await a.p.evaluate(id => !!document.querySelector(`.pdir [data-ibopen="${id}"]`), id), 'the card is linked from What we will try');
    assert.deepStrictEqual(a.errors, []); await a.close();
  });

  await t.test('a plan finds an idea and uses it', async () => {
    const s = await signedIn(fx, br, 'Ann', '1357', 1280);
    const pid = await s.p.evaluate(async () => { await ibLoad(); const p = newPlan('individual'); p.fields.observation = 'Children poured water through funnels at the water table and floated leaves.'; p.where = 'Sensory table'; plans.set(p.id, p); currentId = p.id; return p.id; }).catch(() => null);
    assert.ok(pid, 'a plan was started');
    await s.p.evaluate(id => { ibSt.fromPlan = id; goView('ideabank', { keepPlan: true }); }, pid); await wait(400);
    const fit = await s.p.evaluate(() => ibForPlan(plans.get(ibSt.fromPlan)).map(c => c.id)); assert.ok(fit.includes('water'));
    await s.p.evaluate(() => ibOpen('water')); await s.p.click('[data-ibuse="water"]'); await wait(200);
    assert.ok(await s.p.evaluate(id => (plans.get(id).attached || []).some(a => a.kind === 'idea' && a.id === 'water'), pid));
    const docs = await s.p.evaluate(async id => (await attachDocs(plans.get(id))).docs.map(d => d.title), pid); assert.deepStrictEqual(docs, ['Water']);
    assert.ok(await s.p.evaluate(() => attachPool().some(x => x.kind === 'idea' && x.id === 'clay')), 'Attach from our libraries reaches the cards');
    await s.close();
  });

  await t.test('the Family page shows only home cards, highlights first', async () => {
    await fx.as(dee, '/api/staff/ideabank/highlight', { id: 'clay', on: true });
    const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
    const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
    assert.strictEqual((await fx.as(fam, '/family/ideas', {})).body.off, true, 'off until the director turns it on');
    await fx.as(dee, '/api/staff/ideabank/family', { on: true });
    const r = (await fx.as(fam, '/family/ideas', {})).body;
    assert.deepStrictEqual(r.highlights, ['clay']); assert.ok(r.cards.length > 100);
    assert.doesNotMatch(JSON.stringify(r), /"feeds"|"supports"|"setting"|"seeks"|"behaviors"|Your presence|Ways it can grow/);
    assert.strictEqual((await fx.as('', '/family/ideas', {})).status, 401, 'signed in families only');
    const p = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [fam]);
    await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('button[data-tab="ideas"]', { timeout: 10000 }); await p.click('button[data-tab="ideas"]');
    await p.waitForSelector('text=Happening at school now');
    await p.click('button[data-idea="clay"]'); await p.waitForSelector('text=Clay at Home');
    const txt = await p.innerText('#main'); assert.match(txt, /Wonder together/); assert.doesNotMatch(txt, /Feeds|Open to all|Your presence/);
    assert.doesNotMatch(await p.innerText('body'), /[—–]|\bteacher|\bClaude\b/);
    assert.deepStrictEqual(errors, []);
  });

  await t.test('the planning resources wait for the director to turn them on for educators, and a card reads in short parts', async () => {
    const a = await signedIn(fx, br, 'Ann', '1357', 1280);
    await a.p.evaluate(() => { PROGRAM_DOC = Object.assign({}, PROGRAM_DOC, { planResOn: false }); goView('ideabank'); });
    assert.strictEqual(await a.p.evaluate(() => view), 'plans', 'an educator is sent to Plans');
    assert.strictEqual(await a.p.$('[data-tview="ideabank"]'), null, 'and sees no Planning resources');
    assert.strictEqual(await a.p.$('[data-ibfind]'), null);
    await a.p.evaluate(() => { PROGRAM_DOC = Object.assign({}, PROGRAM_DOC, { planResOn: true }); goView('ideabank'); });
    assert.strictEqual(await a.p.evaluate(() => view), 'ideabank');
    await a.close();
    const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(async () => { await ibLoad(); ibOpen('watercolor'); }); await s.p.waitForSelector('.ibsec', { timeout: 10000 });
    assert.ok(await s.p.$('[data-planreson="0"]'), 'the director has the switch');
    assert.strictEqual(await s.p.$('.ibwrap'), null, 'an open card has the page to itself');
    const longest = await s.p.$$eval('.ibcardv p', ps => Math.max(...ps.map(p => p.innerText.split(/[.!?]\s/).length)));
    assert.ok(longest <= 3, 'paragraphs stay short');
    // a Connected to entry opens the item it names, not only its page
    const links = await s.p.evaluate(() => { artCards = () => [{ id: 'monet', name: 'Claude Monet' }];
      attachPool = () => [{ kind: 'book', id: 'b1', title: 'Leaf Man' }, { kind: 'recipe', id: 'r1', title: 'Butternut squash soup' }, { kind: 'song', id: 's1', title: 'Rain, rain' }];
      return [ibConnHtml('Claude Monet on the Artists page, for the same place in different light'), ibConnHtml('Book collection, for Leaf Man and Red Leaf, Yellow Leaf by Lois Ehlert'),
        ibConnHtml('Recipe library, for soups on cold wet days'), ibConnHtml('Song book, for rain and weather songs'), ibConnHtml((LENSES[0] || {}).name + ' lens')]; });
    assert.match(links[0], /data-libopen="artist\|monet"/); assert.match(links[1], /data-libopen="book\|b1"/);
    assert.match(links[2], /data-libopen="recipe\|r1"/); assert.match(links[3], /data-libopen="song\|s1"/); assert.match(links[4], /data-lensgo=/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
