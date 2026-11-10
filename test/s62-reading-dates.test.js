'use strict';
/* Past dates taken out of the educator-facing PD text, November 10, 2026. Each page holds the old wording, the step
   swaps in the new, and none of the old dates are left. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's62-reading-dates.json'), 'utf8'));

test('s62ReadingDates takes past dates out of PD Readings lists', async () => {
  const by = new Map();
  for (const c of LIST.changes) { if (!by.has(c.path)) by.set(c.path, []); by.get(c.path).push(c); }
  const page = cs => '# A page\n\n' + cs.map(c => c.from).join('\n\nSome words between.\n\n') + '\n';
  const skip = 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse,s60IdeaFacts,s61PastDates';
  const f = await fx.start({ env: { ONCE_SKIP: skip }, more: put => { for (const [p, cs] of by) put(p, page(cs)); } });
  try {
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = [...by].every(([p, cs]) => { const t = fs.readFileSync(path.join(f.dir, p), 'utf8'); return cs.every(c => t.includes(c.to)); });
    }
    assert.ok(ok, 'every new wording is in place');
    for (const p of by.keys()) assert.doesNotMatch(fs.readFileSync(path.join(f.dir, p), 'utf8'), /May 2026|March 9, 2021/, p);
  } finally { await f.stop(); }
});
