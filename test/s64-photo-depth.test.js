'use strict';
/* Photographing Documentation gains its In depth tab and a Presenting section on its Overview, November 10, 2026. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's64-photo-depth.json'), 'utf8'));
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's63-photo-module.json'), 'utf8')).changes[0];

test('s64PhotoDepth adds the In depth tab and the Presenting section', async () => {
  const skip = 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse,s60IdeaFacts,s61PastDates,s62ReadingDates,s63PhotoModule';
  const f = await fx.start({ env: { ONCE_SKIP: skip }, more: put => put(M.path, M.create) });
  try {
    let ok = false;
    const dp = path.join(f.dir, LIST.changes[0].path), mp = path.join(f.dir, M.path);
    for (let i = 0; i < 60 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = fs.existsSync(dp) && fs.readFileSync(dp, 'utf8') === LIST.changes[0].create && fs.readFileSync(mp, 'utf8').split('## Presenting this module').length === 2;
    }
    assert.ok(ok, 'the In depth tab and the Presenting section are in place');
    assert.doesNotMatch(fs.readFileSync(dp, 'utf8'), /—|Claude/);
  } finally { await f.stop(); }
});
