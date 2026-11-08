'use strict';
/* The PD library's new pieces of November 7, 2026. New printables and family pieces are made only where none is kept,
   and each module that lacked one gains its Presenting section once. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's58-pd-pieces.json'), 'utf8'));

test('s58PdPieces adds the printables, family pieces and Presenting sections', async () => {
  const mods = LIST.changes.filter(c => c.from);
  const f = await fx.start({ env: { ONCE_SKIP: 's49PdRefresh,s50PdScreens,s51Citations,s52Wording,s53Paths,s54PlantStages,s55SofterWords,s56RecordText,s57PathLicensing,s59BeanHouse,s60IdeaFacts' },
    more: put => { for (const c of mods) put(c.path, '<!--\nserves: obs\n-->\n# A module\n\nLead.\n\n## Readings\n\n' + c.from + '\n'); } });
  try {
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      ok = LIST.changes.every(c => { const p = path.join(f.dir, c.path); if (!fs.existsSync(p)) return false; const t = fs.readFileSync(p, 'utf8'); return c.create ? t === c.create : t.includes(c.to); });
    }
    assert.ok(ok, 'every new piece is in place');
    for (const c of mods) assert.equal(fs.readFileSync(path.join(f.dir, c.path), 'utf8').split('## Presenting this module').length, 2, c.path);
  } finally { await f.stop(); }
});
