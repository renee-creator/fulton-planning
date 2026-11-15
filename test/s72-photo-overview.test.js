'use strict';
/* Photographing Documentation's Overview gets a shorter Reading, and In depth keeps the full one, November 15, 2026.
   The step swaps the whole Reading once, keeps the wording it replaces in the page's history, and a second start changes
   nothing. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's72-photo-overview.json'), 'utf8'));
const WRITING = require('../writing.js');

test('the new Reading follows the writing rules and keeps every public-facing rule', () => {
  const to = LIST.changes[0].to;
  for (const l of to.split('\n')) assert.deepStrictEqual(WRITING.lineFindings(l), [], l);
  for (const rule of ['No recognizable faces', 'No names', 'No locations a stranger could use', 'No moments a child might later regret', 'The director chooses', 'Presentations stay on the screen'])
    assert.ok(to.includes('**' + rule + '.**'), rule);
  assert.ok(to.length < LIST.changes[0].from.length / 2, 'the Overview reading is less than half as long');
});

test('s72PhotoOverview swaps the Overview Reading once', async () => {
  const c = LIST.changes[0];
  const page = '<!--\nserves: obs, img\n-->\n# Photographing Documentation\n\n## Why it matters\n\nWords.\n\n' + c.from + '## From our own documentation\n\nExamples.\n';
  const skip = 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s55SofterWords,s56RecordText,s58PdPieces,s59BeanHouse,s60IdeaFacts,s61PastDates,s62ReadingDates,s63PhotoModule,s64PhotoDepth,s65PhotoChecks,s65LaoStickyRice,s66RiceBalls,s67LaoJeow,s68LaoNori,s69RecognizableFaces,s71DrdpAugust';
  const f = await fx.start({ env: { ONCE_SKIP: skip }, more: put => put(c.path, page) });
  try {
    const file = path.join(f.dir, c.path);
    let t = '';
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 250)); t = fs.readFileSync(file, 'utf8'); if (t.includes(c.to)) break; }
    assert.ok(t.includes(c.to), 'the new Reading is in place');
    assert.ok(!t.includes(c.from), 'the old Reading is gone');
    assert.match(t, /## Why it matters\n\nWords\.\n\n## Reading/);
    assert.match(t, /## From our own documentation\n\nExamples\.\n$/);
    let h = null;
    for (let i = 0; i < 40 && !h; i++) { await new Promise(r => setTimeout(r, 250)); try { h = JSON.parse(fs.readFileSync(path.join(f.dir, 'staff/pd/history/pd--modules--50-photographing-documentation.json'), 'utf8')); } catch (e) {} }
    assert.ok(h && h.history.some(x => x.text.includes(c.from)), 'the wording it replaces is kept in the history, so it can be restored');
  } finally { await f.stop(); }
});
