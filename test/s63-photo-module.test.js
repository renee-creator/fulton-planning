'use strict';
/* Photographing Documentation arrives as a draft module with its printables, November 10, 2026. The module and its
   printables are in place, and the module is marked draft so only the director sees it. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's63-photo-module.json'), 'utf8'));

test('s63PhotoModule adds the draft module and its printables', async () => {
  const skip = 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse,s60IdeaFacts,s61PastDates,s62ReadingDates';
  const f = await fx.start({ env: { ONCE_SKIP: skip } });
  try {
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = LIST.changes.every(c => { const p = path.join(f.dir, c.path); return fs.existsSync(p) && fs.readFileSync(p, 'utf8') === c.create; });
    }
    assert.ok(ok, 'the module and its printables are in place');
    const m = fs.readFileSync(path.join(f.dir, LIST.changes[0].path), 'utf8');
    assert.match(m, /status: draft/);
    assert.doesNotMatch(m, /—|Claude/);
  } finally { await f.stop(); }
});
