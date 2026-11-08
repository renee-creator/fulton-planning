'use strict';
/* November 7, 2026. The Licensing pieces as a step of a path, the whole set or one piece, read from the pd.done record the
   pieces already keep, and the one-time step that gives Safety and Licensing that step once. Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const piece = (title, extra) => `<!--\nlist: title22\nweek: 2\n${extra || ''}-->\n## ${title}\n\nTitle 22\n\n### What it says\n\nWords.\n\n### One question\n\nWhat do you do?\n`;
const SKIP = 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s53Paths,s55SofterWords,s56RecordText';
const read = (fx, p) => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };

test('the once list appends one licensing step to Safety and Licensing', () => {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's57-path-licensing.json'), 'utf8'));
  assert.strictEqual(L.changes.length, 1); const c = L.changes[0];
  assert.strictEqual(c.path, 'staff/pd/paths.json'); assert.strictEqual(c.append, 'list[title=Safety and Licensing].steps');
  assert.deepStrictEqual(c.value, { kind: 'licensing' }); assert.deepStrictEqual(c.unless, { kind: 'licensing' });
});

test('a path with a Licensing step lists it, counts it and opens it', async t => {
  const fx = await start({ env: { ONCE_SKIP: SKIP + ',s57PathLicensing' }, more: put => {
    put('staff/pd/licensing/02-b-piece.md', piece('B piece'));
    put('staff/pd/licensing/03-c-draft.md', piece('C draft', 'status: draft\n'));
    put('staff/pd/paths.json', { list: [{ id: 'pasafety', title: 'Safety and Licensing', desc: 'Keeping children safe.', onboarding: false, steps: [{ kind: 'module', slug: 'documentation' }, { kind: 'licensing' }, { kind: 'licensing', id: 'licensing/02-b-piece' }], at: 1, by: 'TREE' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const S = (tok, p, b) => fx.as(tok, '/api/staff/' + p, b || {});
  let aid = '';

  await t.test('the director sees the steps, and the editor offers each piece', async () => {
    const r = (await S(dee, 'paths')).body; const p = r.paths.find(x => x.id === 'pasafety');
    assert.deepStrictEqual(p.steps.map(s => [s.kind, s.id || '', s.title, s.missing]), [['module', '', 'Documentation at Fulton', false], ['licensing', '', 'Licensing at Fulton Community School', false], ['licensing', 'licensing/02-b-piece', 'B piece', false]]);
    assert.deepStrictEqual(r.licensing.map(x => [x.id, x.waiting]), [['licensing/01-a-piece', false], ['licensing/02-b-piece', false], ['licensing/03-c-draft', true]]);
  });

  await t.test('saving keeps Licensing steps, drops an unknown piece and a repeat', async () => {
    const r = await S(dee, 'paths/save', { path: { id: 'pasafety', title: 'Safety and Licensing', desc: 'Keeping children safe.', steps: [{ kind: 'module', slug: 'documentation' }, { kind: 'licensing' }, { kind: 'licensing' }, { kind: 'licensing', id: 'licensing/02-b-piece' }, { kind: 'licensing', id: 'licensing/99-gone' }] } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(r.body.paths.find(x => x.id === 'pasafety').steps.map(s => [s.kind, s.id || '']), [['module', ''], ['licensing', ''], ['licensing', 'licensing/02-b-piece']]);
    const c = await S(dee, 'paths/copy', { id: 'pasafety' }); const cp = c.body.paths.find(x => x.id === c.body.id);
    assert.deepStrictEqual(cp.steps.map(s => [s.kind, s.id || '']), [['module', ''], ['licensing', ''], ['licensing', 'licensing/02-b-piece']]);
    await S(dee, 'paths/remove', { id: c.body.id });
  });

  await t.test('Assigned to you shows the Licensing step with its count, the draft piece left out', async () => {
    const a = await S(dee, 'paths/assign', { kind: 'path', id: 'pasafety', people: ['Ann'] }); assert.strictEqual(a.status, 200); aid = a.body.id;
    const m = (await S(ann, 'paths/mine')).body.list.find(x => x.id === aid);
    const lic = m.steps.filter(s => s.kind === 'licensing');
    assert.deepStrictEqual(lic.map(s => [s.id || '', s.title, s.count, s.of, s.done]), [['', 'Licensing at Fulton Community School', 0, 2, false], ['licensing/02-b-piece', 'B piece', 0, 1, false]]);
    assert.ok(!(await S(ann, 'paths/mine')).body.choose.find(p => p.id === 'pasafety').steps.some(s => s.id === 'licensing/03-c-draft'));
  });

  await t.test('finishing pieces moves the count, and the director\'s progress counts the step', async () => {
    assert.strictEqual((await S(ann, 'pd/done', { id: 'licensing/02-b-piece', answer: 'I watch closely.' })).status, 200);
    let m = (await S(ann, 'paths/mine')).body.list.find(x => x.id === aid);
    assert.deepStrictEqual(m.steps.filter(s => s.kind === 'licensing').map(s => [s.count, s.of, s.done, s.started]), [[1, 2, false, true], [1, 1, true, true]]);
    assert.strictEqual(m.state, 'progress');
    let pr = (await S(dee, 'paths')).body.assignments.find(x => x.id === aid).progress[0]; assert.deepStrictEqual([pr.done, pr.open, pr.state], [1, 3, 'progress']);
    assert.strictEqual((await S(ann, 'pd/done', { id: 'licensing/01-a-piece', answer: 'I count.' })).status, 200);
    m = (await S(ann, 'paths/mine')).body.list.find(x => x.id === aid);
    assert.deepStrictEqual(m.steps.find(s => s.kind === 'licensing' && !s.id).done, true);
    pr = (await S(dee, 'paths')).body.assignments.find(x => x.id === aid).progress[0]; assert.deepStrictEqual([pr.done, pr.open], [2, 3]);
  });

  await t.test('one tap on the step opens the Licensing list', async () => {
    const chromium = await browser(); if (!chromium) return;
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => /Assigned to you/.test(document.getElementById('main').innerText), null, { timeout: 15000 });
    const txt = await s.p.evaluate(() => document.getElementById('main').innerText);
    assert.match(txt, /2 of 2 pieces/); assert.match(txt, /A Licensing piece/);
    await s.p.evaluate(() => document.querySelector('#main [data-stmod="licensing"]').click());
    await s.p.waitForFunction(() => /The pieces/.test(document.getElementById("main").innerText) && /2 of 2 read/.test(document.getElementById("main").innerText), null, { timeout: 15000 });
    assert.match(await s.p.evaluate(() => document.getElementById('main').innerText), /B piece/);
    const d = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await d.p.evaluate(() => goView('stpd')); await d.p.waitForFunction(() => /Assigned PD/.test(document.getElementById('main').innerText), null, { timeout: 15000 });
    await d.p.evaluate(() => document.querySelector('[data-paedit="pasafety"]').click()); await wait(800);
    const opts = await d.p.evaluate(() => [...document.querySelectorAll('#pa-add option')].map(o => o.value));
    assert.ok(opts.includes('licensing|') && opts.includes('licensing|licensing/01-a-piece'));
    assert.deepStrictEqual(s.errors, []); assert.deepStrictEqual(d.errors, []);
  });
});

test('s57PathLicensing adds the Licensing step once, and leaves a path that has one', async t => {
  const fx = await start({ env: { ONCE_SKIP: SKIP }, more: put => {
    put('staff/pd/paths.json', { list: [
      { id: 'pasafety', title: 'Safety and Licensing', desc: '', onboarding: false, steps: [{ kind: 'module', slug: 'documentation' }], at: 1, by: 'TREE' },
      { id: 'paother', title: 'Another path', desc: '', onboarding: false, steps: [{ kind: 'module', slug: 'documentation' }], at: 1, by: 'TREE' }] });
  } });
  let up = true; t.after(() => up && fx.stop());
  let ok = false; for (let i = 0; i < 80 && !ok; i++) { await wait(250); const o = read(fx, 'settings/once.json'); ok = !!(o && o.done && o.done.s57PathLicensing) && read(fx, 'staff/pd/paths.json').list[0].steps.length === 2; }
  assert.ok(ok, 'the step ran and was recorded');
  const L = read(fx, 'staff/pd/paths.json').list;
  assert.deepStrictEqual(L[0].steps, [{ kind: 'module', slug: 'documentation' }, { kind: 'licensing' }]);
  assert.deepStrictEqual(L[1].steps, [{ kind: 'module', slug: 'documentation' }]);
  await wait(1500); await fx.stop(); up = false;
  // run again from scratch on a path that already has a Licensing piece step, and it is left alone
  const o = read(fx, 'settings/once.json'); delete o.done.s57PathLicensing; fs.writeFileSync(path.join(fx.dir, 'settings/once.json'), JSON.stringify(o, null, 2) + '\n');
  const p = read(fx, 'staff/pd/paths.json'); p.list[0].steps = [{ kind: 'licensing', id: 'licensing/01-a-piece' }]; fs.writeFileSync(path.join(fx.dir, 'staff/pd/paths.json'), JSON.stringify(p, null, 2) + '\n');
  const again = await start({ dir: fx.dir, env: { ONCE_SKIP: SKIP } });
  try {
    let done = false; for (let i = 0; i < 80 && !done; i++) { await wait(250); const x = read(fx, 'settings/once.json'); done = !!(x && x.done && x.done.s57PathLicensing); }
    assert.ok(done); await wait(800);
    assert.deepStrictEqual(read(fx, 'staff/pd/paths.json').list[0].steps, [{ kind: 'licensing', id: 'licensing/01-a-piece' }]);
  } finally { await again.stop(); }
});
