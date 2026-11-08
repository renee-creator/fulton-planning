'use strict';
/* The PD library's quotes, studies, years and links corrected after the fact check of November 7, 2026. Each page holds
   the wording it had, the step swaps in the corrected wording in order, and a passage the step removes is gone. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's51-citations.json'), 'utf8'));

test('s51Citations corrects each page', async () => {
  const by = new Map();
  for (const c of LIST.changes) { if (!by.has(c.path)) by.set(c.path, []); by.get(c.path).push(c); }
  // a passage a later change rewrites is held inside an earlier change's new wording, so only the first in a chain is written
  const page = cs => '<!--\nserves: obs\n-->\n# A page\n\nLead.\n\n## Reading\n\n' + cs.filter((c, i) => !cs.slice(0, i).some(a => a.to.includes(c.from))).map(c => c.from.replace(/\n$/, '')).join('\n\nSome words between.\n\n') + '\n';
  const f = await fx.start({ env: { ONCE_SKIP: 's49PdRefresh,s50PdScreens,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse' }, more: put => { for (const [p, cs] of by) put(p, page(cs)); } });
  try {
    const want = LIST.changes.filter(c => c.to);
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = want.every(c => fs.readFileSync(path.join(f.dir, c.path), 'utf8').includes(c.to.replace(/\n$/, '')));
    }
    assert.ok(ok, 'every corrected wording is in place');
    const kohn = fs.readFileSync(path.join(f.dir, 'staff/pd/depth/language.md'), 'utf8');
    assert.doesNotMatch(kohn, /Reducing risks/);
  } finally { await f.stop(); }
});
