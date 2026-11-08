'use strict';
/* The TREE series, the How To guides and Licensing matched to TREE on November 7, 2026, after the step before it. Each
   page holds the wording it had, both steps run in order, and proofreading before save is turned on. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const read = n => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', n), 'utf8'));
const A = read('s49-pd-refresh.json'), B = read('s50-pd-screens.json');

test('s50PdScreens follows s49PdRefresh and brings each page up to date', async () => {
  const pages = new Map();
  const add = c => { if (!c.from || !/\.md$/.test(c.path)) return; if (!pages.has(c.path)) pages.set(c.path, []); pages.get(c.path).push(c); };
  A.changes.forEach(add);
  // a passage the step before already changes is not written twice
  for (const c of B.changes) { if (!c.from || !/\.md$/.test(c.path)) continue; if (A.changes.some(a => a.path === c.path && a.to.includes(c.from))) continue; add(c); }
  const page = cs => '<!--\nserves: obs\n-->\n# A page\n\nLead.\n\n## Reading\n\n' + cs.map(c => c.from).join('\n\nSome words between.\n\n') + '\n';
  const f = await fx.start({ env: { ONCE_SKIP: 's51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse' }, more: put => { for (const [p, cs] of pages) put(p, page(cs)); } });
  try {
    const want = B.changes.filter(c => c.from && /\.md$/.test(c.path));
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = want.every(c => fs.existsSync(path.join(f.dir, c.path)) && fs.readFileSync(path.join(f.dir, c.path), 'utf8').includes(c.to));
    }
    assert.ok(ok, 'every new wording is in place');
    const lic = fs.readFileSync(path.join(f.dir, 'staff/pd/licensing/21-calling-in-late-or-sick.md'), 'utf8');
    assert.doesNotMatch(lic, /Renee|529-2035/);
    const prog = JSON.parse(fs.readFileSync(path.join(f.dir, 'settings/program.json'), 'utf8'));
    assert.strictEqual(prog.proofSave, true);
  } finally { await f.stop(); }
});
