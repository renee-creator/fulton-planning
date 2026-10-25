'use strict';
// Session 11, items 32 to 36. Gatherings, volunteer jobs, Play Garden and what families see. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const PG = `<!--
wording: play garden application
-->
# Play Garden application

Come and play.

## parent

Your name

## children long

Each child, with their age

## health optional

Anything we should know

## agree stay

I stay with my child the whole time
`;
const SETUP = { id: 'setup', ready: false, plants: [], beds: [], agreements: { guiding: ['Be kind to all beings.'], families: { title: 'For families', intro: 'Welcome.', items: ['Stay with your child.'] } } };
const SEASON = '<!--\nkind: season\n-->\n# Winter\n\nRest and plan.\n\n## What we plant\n\n- Garlic\n';
const RECIPE = '<!--\nlibrary: recipe\nkind: food\n-->\n# Pumpkin muffins\n\n## Ingredients\n\n- Pumpkin\n\n## Steps\n\n- Mix\n- Bake\n';

test('gatherings stay with the staff until the director marks them ready, and families see the season and recipes she shares', async t => {
  const fx = await start({ more: put => {
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
    put('staff/garden/setup.json', SETUP); put('staff/garden/log.json', { id: 'gardenlog', seeds: [{ id: 's1', name: 'Sunflower', share: true }] });
    put('staff/library/garden/season-winter.md', SEASON); put('staff/library/recipes/pumpkin-muffins.md', RECIPE);
    put('staff/wording/play-garden-application.md', PG);
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const family = async email => { const c = await fx.as('', '/family/code', { email }); return (await fx.as('', '/family/login', { email, code: c.body.code })).body.token; };
  const day = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const later = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);

  await t.test('a gathering and its job show to staff, on the calendar and the display, and not to families until ready', async () => {
    let r = await fx.as(dee, '/api/write', { op: 'create', kind: 'participation', id: 'it-ss1', data: { kind: 'item', type: 'event', gathering: 'second-saturday', gardenDay: true, onCalendar: true, title: 'Second Saturday', date: day, start: '09:00', end: '12:00', plan: 'Plant garlic.', signups: [], open: false, test: true } });
    assert.strictEqual(r.status, 200);
    r = await fx.as(dee, '/api/write', { op: 'create', kind: 'participation', id: 'it-job1', data: { kind: 'item', type: 'task', gatheringId: 'it-ss1', title: 'Second Saturday helper', date: day, hours: 3, spots: 4, signups: [], open: false, test: true } });
    assert.strictEqual(r.status, 200); await wait(1200);
    const data = (await fx.as(ann, '/api/data', {})).body;
    const g = data.gatherings.list.find(x => x.id === 'it-ss1');
    assert.ok(g && g.plan === 'Plant garlic.' && g.ready === false && g.jobs[0].title === 'Second Saturday helper');
    const v = await fx.as(ann, '/api/view', { from: day, to: day });
    assert.ok((v.body.events || []).some(e => e.cal === 'tfam' && /not yet open to families, Second Saturday/.test(e.title)));
    const tok = await family('pip.family@example.test');
    let d = (await fx.as(tok, '/family/data', {})).body;
    assert.ok(!d.open.some(it => it.id === 'it-ss1' || it.id === 'it-job1'));
    // the director marks it ready, and the gathering and its job reach the family
    await fx.as(dee, '/api/write', { op: 'update', kind: 'participation', id: 'it-ss1', patch: { open: true } });
    await fx.as(dee, '/api/write', { op: 'update', kind: 'participation', id: 'it-job1', patch: { open: true } });
    await wait(600);
    d = (await fx.as(tok, '/family/data', {})).body;
    const job = d.open.find(it => it.id === 'it-job1');
    assert.ok(d.open.find(it => it.id === 'it-ss1').gathering === 'second-saturday' && job.gatheringId === 'it-ss1');
    // signing up for the job logs nothing, the hours come after the day
    assert.ok(!d.signed.some(it => it.id === 'it-job1'));
  });

  await t.test('the office cannot open a gathering to families, and the kitchen cannot edit a module through a recipe', async () => {
    const gia = (await fx.login('Gia', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
    await fx.as(dee, '/api/write', { op: 'create', kind: 'participation', id: 'it-ss2', data: { kind: 'item', type: 'event', gathering: 'play-garden', onCalendar: true, title: 'Play Garden', signups: [], open: false, test: true } });
    const r = await fx.as(gia, '/api/write', { op: 'update', kind: 'participation', id: 'it-ss2', patch: { open: true, plan: 'Mud kitchen.' } });
    assert.strictEqual(r.status, 200); await wait(800);
    const doc = JSON.parse(fs.readFileSync(path.join(fx.dir, 'participation/it-ss2.json'), 'utf8'));
    assert.strictEqual(doc.open, false); assert.strictEqual(doc.plan, 'Mud kitchen.');
    const made = await fx.as(gia, '/api/write', { op: 'create', kind: 'participation', id: 'it-job9', data: { kind: 'item', type: 'task', gatheringId: 'it-ss2', title: 'Snacks', signups: [], open: true, test: true } });
    assert.strictEqual(made.status, 200); await wait(800);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(fx.dir, 'participation/it-job9.json'), 'utf8')).open, false);
    const k = await fx.as(kit, '/api/staff/page/save', { path: 'staff/library/recipes/x.md', module: 'language', parts: [], note: 'x' });
    assert.strictEqual(k.status, 403);
  });

  await t.test('the director shares one season sheet and a recipe on the Family page before the Garden is ready', async () => {
    assert.strictEqual((await fx.as(ann, '/api/staff/garden/familyshare', { season: 'winter' })).status, 403);
    const r = await fx.as(dee, '/api/staff/garden/familyshare', { season: 'winter', recipes: ['pumpkin-muffins', '../x'] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const tok = await family('pip.family@example.test');
    const d = (await fx.as(tok, '/family/data', {})).body;
    assert.strictEqual(d.gardenInfo.season.name, 'Winter'); assert.match(d.gardenInfo.season.parts[0].text, /Garlic/);
    assert.deepStrictEqual(d.gardenInfo.recipes.map(x => x.title), ['Pumpkin muffins']);
    // the agreements and the plant guide still wait for the Garden to be ready
    assert.strictEqual(d.gardenInfo.agreements, null);
  });

  await t.test('the Play Garden application is a public link the director turns on, kept in the records', async () => {
    assert.deepStrictEqual((await fx.as('', '/public/playgarden', {})).body, { open: false });
    assert.match((await fx.as('', '/public/playgarden/apply', { answers: { parent: 'Lou' } })).body.error || '', /not open/);
    assert.strictEqual((await fx.as(ann, '/api/staff/playgarden', {})).status, 403);
    await fx.as(dee, '/api/staff/playgarden/switch', { on: true });
    const p = (await fx.as('', '/public/playgarden', {})).body;
    assert.strictEqual(p.open, true); assert.deepStrictEqual(p.questions.map(q => q.key), ['parent', 'children', 'health', 'agree-stay']);
    assert.deepStrictEqual(p.agreements.families.items, ['Stay with your child.']);
    assert.match((await fx.as('', '/public/playgarden/apply', { answers: { parent: 'Lou', children: 'Ivy, 3' } })).body.error || '', /I stay with my child/);
    const ok = await fx.as('', '/public/playgarden/apply', { answers: { parent: 'Lou', children: 'Ivy, 3', 'agree-stay': true } });
    assert.strictEqual(ok.body.ok, true);
    await wait(1600);
    const files = fs.readdirSync(path.join(fx.dir, 'staff/playgarden')).filter(f => /^pg/.test(f));
    assert.strictEqual(files.length, 1);
    const list = (await fx.as(dee, '/api/staff/playgarden', {})).body.applications;
    assert.strictEqual(list[0].answers.parent, 'Lou');
    await fx.as(dee, '/api/staff/playgarden/switch', { on: false });
    assert.deepStrictEqual((await fx.as('', '/public/playgarden', {})).body, { open: false });
  });

  await t.test('the Gatherings page opens for the director and an educator, and the Garden links to it', async () => {
    const chromium = await browser(); if (!chromium) return;
    const b = await chromium.launch(); t.after(() => b.close());
    for (const [who, pass, w] of [['Dee', 'director-pass-1', 1280], ['Ann', '1357', 390]]) {
      const s = await signedIn(fx, b, who, pass, w);
      await s.p.evaluate(() => goView('gatherings')); await wait(800);
      const txt = await s.p.evaluate(() => document.getElementById('main').innerText);
      assert.match(txt, /Second Saturday/); assert.match(who === 'Dee' ? await s.p.evaluate(() => document.querySelector('[data-gthf="plan"]').value) : txt, /Plant garlic/); assert.match(txt, /A place for the Second Saturday toolkit/);
      if (who === 'Dee') assert.match(txt, /The Play Garden application/);
      if (who === 'Dee') {
        // the director plans a Second Saturday in March, adds a job and marks it ready
        await s.p.click('[data-gthnew]'); await s.p.fill('#gth-date', '2027-03-13'); await s.p.click('[data-gthsave]'); await wait(1500);
        const id = await s.p.evaluate(() => ptItems().find(x => x.gathering === 'second-saturday' && x.date === '2027-03-13').id);
        assert.strictEqual(await s.p.evaluate(i => participation.get(i).gardenDay && participation.get(i).season, id), 'spring');
        await s.p.fill('#gthj-t-' + id, 'Snack table'); await s.p.click(`[data-gthjob="${id}"]`); await wait(1500);
        await s.p.click(`[data-gthready="${id}"]`); await wait(2500);
        const jobs = await s.p.evaluate(i => ptItems().filter(j => j.gatheringId === i).map(j => [j.title, j.open]), id);
        assert.deepStrictEqual(jobs, [['Snack table', true]]);
        assert.strictEqual(JSON.parse(fs.readFileSync(path.join(fx.dir, 'participation', id + '.json'), 'utf8')).open, true);
      }
      await s.p.evaluate(() => goView('garden')); await wait(1200);
      const gt = await s.p.evaluate(() => document.getElementById('main').innerText);
      assert.doesNotMatch(gt, /Garden days with families/);
      assert.deepStrictEqual(s.errors, []); await s.close();
    }
  });

  await t.test('the Family page shows the gathering with its job, the season, the recipe and the seed library', async () => {
    const chromium = await browser(); if (!chromium) return;
    const b = await chromium.launch(); t.after(() => b.close());
    await fx.as(dee, '/api/staff/garden/ready', { on: true });
    const tok = await family('pip.family@example.test');
    const p = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [tok]);
    await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector("text=Taking part", { timeout: 10000 }); await p.click("text=Taking part"); await p.waitForTimeout(800);
    const txt = await p.evaluate(() => document.body.innerText);
    assert.match(txt, /Gatherings[\s\S]*Second Saturday[\s\S]*Second Saturday helper/);
    assert.match(txt, /Winter in our garden/); assert.match(txt, /Recipes from our kitchen[\s\S]*Pumpkin muffins/); assert.match(txt, /Our seed library[\s\S]*Sunflower/);
    assert.deepStrictEqual(errors, []);
  });
});
