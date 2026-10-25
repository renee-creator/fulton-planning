'use strict';
// The director's Edit button on a PD module, a TREE How To guide and the PD library letter. Each part has its own box,
// the headings stay, each save keeps the earlier wording with Restore this version, and new wording that breaks a
// writing rule is named before it saves. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('editing a module, a How To guide and the letter keeps each earlier version', async t => {
  const fx = await start({ more: put => {
    put('staff/pd/ready.json', { modules: { documentation: true } });
    put('staff/pd/howto/02-writing-a-plan.md', '<!--\nminutes: 10\n-->\n## Writing a plan\n\nA short guide.\n\n### What it is for\n\nA plan keeps the thread.\n\n### Try it\n\nWrite one.\n');
    put('staff/newed/welcome.md', '<!--\nplace: pdlibrary\n-->\n# A Letter to Our Educators\n\nDear educators.\n\n## What this library is\n\nA place to grow.\n');
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const E = (tok, p, b) => fx.as(tok, '/api/staff/page' + (p ? '/' + p : ''), b || {});
  assert.strictEqual((await E(ann, '', { module: 'documentation' })).status, 403, 'only the director edits');
  assert.strictEqual((await E(dee, '', { path: 'staff/handbook-doc.json' })).status, 404, 'only these pages are edited here');
  const pg = (await E(dee, '', { module: 'documentation' })).body;
  assert.deepStrictEqual(pg.parts.map(x => x.heading), ['Why it matters', 'Reflect']);
  const parts = pg.parts.map(x => ({ body: x.body })); parts[1].body = 'A question.\nWhat did the teacher notice — and why?';
  const bad = (await E(dee, 'save', { module: 'documentation', title: pg.title, parts, note: 'A new question' })).body;
  assert.deepStrictEqual(bad.findings.map(f => f.why), ['A dash. Use a comma or a full stop.', 'Say educator.']);
  parts[1].body = 'A question.\nWhat did you notice, and why?';
  assert.strictEqual((await E(dee, 'save', { module: 'documentation', title: 'Documentation', parts })).status, 400, 'a change needs a note');
  const ok = (await E(dee, 'save', { module: 'documentation', title: 'Documentation', parts, note: 'A new question' })).body;
  assert.ok(ok.ok); assert.strictEqual(ok.page.history.length, 1); assert.strictEqual(ok.page.title, 'Documentation');
  const mods = (await fx.as(ann, '/api/staff/g/modules', {})).body.modules;
  assert.strictEqual(mods.documentation.title, 'Documentation');
  assert.match(mods.documentation.sections.find(s => s.heading === 'Reflect').body, /What did you notice/);
  const back = (await E(dee, 'restore', { module: 'documentation', index: 0 })).body;
  assert.strictEqual(back.page.title, 'Documentation at Fulton'); assert.strictEqual(back.page.history.length, 2);
  assert.match(back.page.note, /Restored the version from before TREE/);
  // a How To guide keeps its opening note and its headings
  const hp = (await E(dee, '', { path: 'staff/pd/howto/02-writing-a-plan.md' })).body;
  assert.deepStrictEqual(hp.parts.map(x => x.heading), ['What it is for', 'Try it']);
  await E(dee, 'save', { path: 'staff/pd/howto/02-writing-a-plan.md', title: hp.title, parts: [{ body: 'A plan keeps the thread of the children\'s thinking.' }, { body: 'Write one.' }], note: 'Clearer' });
  const pc = (await fx.as(ann, '/api/staff/pd', {})).body.howto.find(x => x.id === 'howto/02-writing-a-plan');
  assert.strictEqual(pc.minutes, 10); assert.match(pc.sections[0].body, /children's thinking/);
  // the letter
  const lp = (await E(dee, '', { path: 'staff/newed/welcome.md' })).body; assert.strictEqual(lp.kind, 'letter');
  await E(dee, 'save', { path: 'staff/newed/welcome.md', title: lp.title, lead: 'Dear educators,', parts: lp.parts.map(x => ({ body: x.body })), note: 'A comma' });
  assert.strictEqual((await E(dee, '', { path: 'staff/newed/welcome.md' })).body.history.length, 1);
  const chromium = await browser(); if (chromium) {
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1');
    await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => !!window.TREE_PAGEEDIT, null, { timeout: 15000 });
    await s.p.evaluate(() => window.TREE_PAGEEDIT({ module: 'documentation' }));
    await s.p.waitForSelector('#stpageedit [data-pepart]', { timeout: 15000 });
    const txt = await s.p.evaluate(() => document.querySelector('#stpageedit').innerText);
    assert.match(txt, /Why it matters/); assert.match(txt, /Restore this version/);
    await s.p.fill('#stpageedit [data-pepart="1"]', 'A question.\nAt Fulton we ask this.'); await s.p.fill('#pe-note', 'A try');
    await s.p.click('#stpageedit [data-pesave]'); await s.p.waitForFunction(() => /Before it saves/.test(document.querySelector('#stpageedit').innerText), null, { timeout: 10000 });
    assert.deepStrictEqual(s.errors, []); await s.close();
  }
});
