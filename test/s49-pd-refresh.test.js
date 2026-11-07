'use strict';
/* The PD library's out of date facts of November 7, 2026. Each page holds the old wording, the step swaps in the new,
   and a second start changes nothing more. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's49-pd-refresh.json'), 'utf8'));

test('s49PdRefresh brings each PD page up to date', async () => {
  const by = new Map();
  for (const c of LIST.changes) { if (!by.has(c.path)) by.set(c.path, []); by.get(c.path).push(c); }
  const page = cs => '<!--\nserves: obs\n-->\n# A page\n\nLead.\n\n## Reading\n\n' + cs.map(c => c.from).join('\n\nSome words between.\n\n') + '\n';
  const f = await fx.start({ env: { ONCE_SKIP: '' }, more: put => { for (const [p, cs] of by) put(p, page(cs)); } });
  try {
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = [...by].every(([p, cs]) => { const t = fs.readFileSync(path.join(f.dir, p), 'utf8'); return cs.every(c => t.includes(c.to)); });
    }
    assert.ok(ok, 'every new wording is in place');
    const t = fs.readFileSync(path.join(f.dir, 'staff/pd/modules/41-getting-into-tree.md'), 'utf8');
    assert.doesNotMatch(t, /start code/);
    const g = fs.readFileSync(path.join(f.dir, 'staff/pd/depth/families.md'), 'utf8');
    assert.doesNotMatch(g, /SignUpGenius/);
    const d = fs.readFileSync(path.join(f.dir, 'staff/pd/modules/25-drdp-foundations.md'), 'utf8');
    assert.equal(d.split('One observation, two measures at most').length, 2, 'the new DRDP agreement appears once');
  } finally { await f.stop(); }
});
