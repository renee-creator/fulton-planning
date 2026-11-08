'use strict';
/* November 7, 2026. Fourteen PD paths seeded once beside the TREE series, and educators choosing a path for themselves.
   Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's53-paths.json'), 'utf8'));
const mod = (title, serves) => `<!--\nminutes: 30\nserves: ${serves}\n-->\n# ${title}\n\nLead.\n\n## Why it matters\n\nWords.\n\n## Reflect\n\nA question.\n`;
const series = { id: 'patreeseries', title: 'The TREE series', desc: 'Six modules.', onboarding: false, steps: [{ kind: 'module', slug: 'documentation' }], at: 1, by: 'Renee' };

test('s53Paths lists fourteen paths, each step a module in the library', () => {
  const adds = LIST.changes.filter(c => c.add === 'list');
  assert.strictEqual(adds.length, 14);
  const dir = '/home/claude/fulton-planning-records/staff/pd/modules';
  const slugs = fs.existsSync(dir) ? fs.readdirSync(dir).map(f => f.replace(/^\d+-/, '').replace(/\.md$/, '')) : null;
  for (const c of adds) {
    const p = c.value; assert.ok(p.id && p.title && p.desc && p.steps.length && p.by === 'TREE' && p.onboarding === false);
    assert.doesNotMatch(p.desc, /—|:/); assert.ok(p.serves.length && p.serves.every(k => ['img', 'env', 'lang', 'obs', 'cur', 'fam', 'team', 'refl'].includes(k)));
    if (slugs) for (const s of p.steps) assert.ok(slugs.includes(s.slug), p.title + ' ' + s.slug);
  }
  assert.deepStrictEqual(adds.map(c => c.value.title), ['Our Foundations', 'Observing and Documenting', 'Curriculum and Inquiry', 'Relationships and Guidance', 'Play, Risk and the Outdoors', 'The Languages of Art', 'Reading, Writing, Math and Time', 'The Garden Series', 'Food and the Table', 'Identity and Belonging', 'Knowing the Children', 'Working Together', 'Safety and Licensing', 'Leading and Mentoring']);
});

test('s53Paths seeds the paths once, and educators choose a path for themselves', async t => {
  const fx = await start({ env: { ONCE_SKIP: 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse,s60IdeaFacts' }, more: put => {
    put('staff/pd/paths.json', { list: [series, { id: 'pateam', title: 'Kept by the director', desc: 'Her own words.', onboarding: false, steps: [{ kind: 'module', slug: 'documentation' }], at: 2, by: 'Dee' }] });
    put('staff/pd/modules/12-play.md', mod('The Study of Play', 'env, img'));
    put('staff/pd/modules/20-risk.md', '<!--\nstatus: draft\nserves: img, fam\n-->\n# Risky Play\n\nLead.\n\n## Reflect\n\nA question.\n');
    put('staff/pd/modules/37-active-supervision.md', mod('Active Supervision', 'env'));
  } });
  let up = true; t.after(() => up && fx.stop());
  const read = p => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  let ok = false; for (let i = 0; i < 80 && !ok; i++) { await wait(250); const o = read('settings/once.json'); ok = !!(o && o.done && o.done.s53Paths) && (read('staff/pd/paths.json').list || []).length > 2; }
  assert.ok(ok, 'the step ran and was recorded');
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token;
  const S = (tok, p, b) => fx.as(tok, '/api/staff/' + p, b || {});

  await t.test('the step adds each path once, keeps the TREE series and a path already there', async () => {
    const L = read('staff/pd/paths.json').list;
    assert.strictEqual(L.length, 15); assert.strictEqual(L[0].id, 'patreeseries'); assert.deepStrictEqual(L[0].serves, ['obs', 'cur', 'team', 'refl']);
    assert.strictEqual(L.find(p => p.id === 'pateam').title, 'Kept by the director');
    const r = (await S(dee, 'paths')).body; assert.ok(r.paths.find(p => p.id === 'pasafety').choosable); assert.ok(!r.paths.find(p => p.id === 'firstweeks').choosable);
  });

  await t.test('a second start changes nothing', async () => {
    const before = fs.readFileSync(path.join(fx.dir, 'staff/pd/paths.json'), 'utf8');
    await wait(1500); await fx.stop(); up = false;
    const again = await start({ dir: fx.dir, env: { ONCE_SKIP: 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse,s60IdeaFacts' } });
    try { await wait(4000); assert.ok(!again.gh.writes.some(w => /staff\/pd\/paths\.json/.test(w.path || ''))); assert.strictEqual(fs.readFileSync(path.join(fx.dir, 'staff/pd/paths.json'), 'utf8'), before); }
    finally { await again.stop(); }
  });
});

test('educators choose, start and stop a path, and only they or the director can', async t => {
  const fx = await start({ more: put => {
    put('staff/pd/modules/12-play.md', mod('The Study of Play', 'env, img'));
    put('staff/pd/modules/20-risk.md', '<!--\nstatus: draft\nserves: img, fam\n-->\n# Risky Play\n\nLead.\n\n## Reflect\n\nA question.\n');
    put('staff/pd/paths.json', { list: [
      { id: 'paplay', title: 'Play, Risk and the Outdoors', desc: 'Play and healthy risk.', onboarding: false, serves: ['img', 'env'], steps: [{ kind: 'module', slug: 'play' }, { kind: 'module', slug: 'risk' }, { kind: 'module', slug: 'documentation' }], at: 1, by: 'TREE' },
      { id: 'pashut', title: 'Closed to choose', desc: '', onboarding: false, choose: false, steps: [{ kind: 'module', slug: 'documentation' }], at: 1, by: 'TREE' },
      { id: 'paonb', title: 'An onboarding path', desc: '', onboarding: true, steps: [{ kind: 'module', slug: 'documentation' }], at: 1, by: 'TREE' },
      { id: 'padraft', title: 'Only a draft', desc: '', onboarding: false, steps: [{ kind: 'module', slug: 'risk' }], at: 1, by: 'TREE' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token;
  const S = (tok, p, b) => fx.as(tok, '/api/staff/' + p, b || {});
  const mine = async tok => (await S(tok, 'paths/mine')).body;
  let id = '';

  await t.test('an educator sees only the paths open to choose, with the steps they can open', async () => {
    const r = await mine(ann);
    assert.deepStrictEqual(r.choose.map(p => p.id), ['paplay']);
    const p = r.choose[0]; assert.deepStrictEqual(p.areas, ['img', 'env']); assert.deepStrictEqual(p.steps.map(s => s.slug), ['play', 'documentation']);
    assert.ok(r.areas.some(a => a[0] === 'img'));
    for (const x of ['pashut', 'paonb', 'padraft', 'firstweeks']) assert.strictEqual((await S(ann, 'paths/choose', { id: x })).status, 404, x);
  });

  await t.test('starting a path puts it under Assigned to you, marked as their choice', async () => {
    const r = await S(ann, 'paths/choose', { id: 'paplay', ways: { play: 'meeting', documentation: 'nonsense' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body)); id = r.body.id;
    const a = r.body.list.find(x => x.id === id); assert.ok(a && a.chosen); assert.strictEqual(a.due, '');
    assert.deepStrictEqual(a.steps.map(s => [s.slug, s.way]), [['play', 'meeting'], ['documentation', 'own']]);
    assert.strictEqual(r.body.choose[0].started, id);
    assert.strictEqual((await S(ann, 'paths/choose', { id: 'paplay' })).status, 400);
    assert.ok(!(await mine(bea)).list.some(x => x.id === id));
  });

  await t.test('another educator cannot start or stop it for them', async () => {
    assert.strictEqual((await S(bea, 'paths/choose', { id: 'paplay', name: 'Ann' })).status, 200);
    assert.ok(!(await mine(ann)).list.some(x => x.chosen && x.id !== id), 'a name from an educator starts nothing for someone else');
    const beas = (await mine(bea)).list.find(x => x.chosen); assert.ok(beas);
    assert.strictEqual((await S(bea, 'paths/stop', { id })).status, 403);
    assert.strictEqual((await S(ann, 'paths/stop', { id: beas.id })).status, 403);
    assert.strictEqual((await S(bea, 'paths/unassign', { id })).status, 403);
  });

  await t.test('the director sees chosen paths in progress, and it counts the layers done', async () => {
    assert.strictEqual((await S(ann, 'g/module/progress', { slug: 'documentation', progress: { reflection: 'It went well.', finish: true } })).status, 200);
    const r = (await S(dee, 'paths')).body; const a = r.assignments.find(x => x.id === id);
    assert.ok(a && a.chosen); assert.deepStrictEqual(a.people, ['Ann']); assert.deepStrictEqual(a.progress.map(p => [p.name, p.state, p.done]), [['Ann', 'progress', 1]]);
    assert.ok(r.paths.find(p => p.id === 'paplay').choosable); assert.ok(!r.paths.find(p => p.id === 'pashut').choosable);
  });

  await t.test('stopping keeps what they did, and the director can start or stop one for them', async () => {
    const s = await S(ann, 'paths/stop', { id }); assert.strictEqual(s.status, 200);
    assert.ok(!s.body.list.some(x => x.id === id)); assert.strictEqual(s.body.choose[0].started, '');
    const g = (await S(ann, 'g/mine', { name: 'Ann' })).body; assert.ok(((g.modules || {}).documentation || {}).layers);
    const d = await S(dee, 'paths/choose', { id: 'paplay', name: 'Ann', due: '2027-01-15' }); assert.strictEqual(d.status, 200);
    const a = (await mine(ann)).list.find(x => x.id === d.body.id); assert.ok(a && a.chosen && a.due === '2027-01-15'); assert.strictEqual(a.state, 'progress');
    assert.strictEqual((await S(dee, 'paths/stop', { id: d.body.id })).status, 200);
    assert.ok(!(await mine(ann)).list.some(x => x.id === d.body.id));
  });

  await t.test('a path the director turns off is no longer offered', async () => {
    const p = (await S(dee, 'paths')).body.paths.find(x => x.id === 'paplay');
    const r = await S(dee, 'paths/save', { path: { id: p.id, title: p.title, desc: p.desc, onboarding: false, choose: false, steps: p.steps } });
    assert.strictEqual(r.status, 200); assert.ok(!r.body.paths.find(x => x.id === 'paplay').choosable);
    let kept = false; for (let i = 0; i < 40 && !kept; i++) { await wait(250); const x = read(fx, 'staff/pd/paths.json').list.find(y => y.id === 'paplay'); kept = x.choose === false && JSON.stringify(x.serves) === '["img","env"]'; }
    assert.ok(kept, 'choose is kept as false and the areas stay');
    assert.deepStrictEqual((await mine(ann)).choose, []); assert.strictEqual((await S(ann, 'paths/choose', { id: 'paplay' })).status, 404);
    await S(dee, 'paths/save', { path: { id: p.id, title: p.title, desc: p.desc, onboarding: false, steps: p.steps } });
    assert.deepStrictEqual((await mine(ann)).choose.map(x => x.id), ['paplay']);
  });
});
function read(fx, p) { return JSON.parse(fs.readFileSync(path.join(fx.dir, p), 'utf8')); }
