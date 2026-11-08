'use strict';
/* Bean house where teepee was, November 7, 2026. Each page holds the old wording, the step swaps in the new,
   and no page still says teepee. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's59-bean-house.json'), 'utf8'));

test('s59BeanHouse renames the teepee on every page', async () => {
  const by = new Map();
  for (const c of LIST.changes) { if (!by.has(c.path)) by.set(c.path, []); by.get(c.path).push(c); }
  const page = (p, cs) => p.endsWith('.json') ? JSON.stringify({ items: cs.map(c => ({ text: c.from })) }) : '# A page\n\n' + cs.map(c => c.from).join('\n\nSome words between.\n\n') + '\n';
  const skip = 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s60IdeaFacts';
  const f = await fx.start({ env: { ONCE_SKIP: skip }, more: put => { for (const [p, cs] of by) put(p, page(p, cs)); } });
  try {
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = [...by].every(([p, cs]) => { const t = fs.readFileSync(path.join(f.dir, p), 'utf8'); return cs.every(c => t.includes(c.to)); });
    }
    assert.ok(ok, 'every new wording is in place');
    for (const p of by.keys()) assert.doesNotMatch(fs.readFileSync(path.join(f.dir, p), 'utf8'), /teepee/i, p);
  } finally { await f.stop(); }
});
