'use strict';
// Phase one of the review of TREE, privacy and lost work. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { start } = require('./fixture.js');

test('phase one of the review', async t => {
  const fx = await start(); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;

  await t.test('the director has a TREE sign-in made for her, and her Render passcode still signs in', async () => {
    const list = (await fx.as(dee, '/api/accounts', {})).body;
    const accts = (list && (list.accounts || list.list)) || [];
    const mine = accts.find(a => String(a.name).toLowerCase() === 'dee');
    assert.ok(mine, 'a sign-in exists for the director');
    assert.ok(mine.director, 'it is a director sign-in');
    assert.match(String(mine.start || mine.code ? (mine.start || 'set') : ''), /^(\d{6}|set)$/, 'it waits with a six-number start code');
    const again = await fx.login('Dee', 'director-pass-1');
    assert.ok(again.token, 'the Render passcode keeps working as a backup');
  });

  await t.test('a journal save after the journal closed asks for the passcode and keeps the writing', async () => {
    const sv = await fx.as(dee, '/api/staff/g/journal/save', { name: 'Dee', key: 'not-a-key', entry: { joy: 'The goats met the new class.' } });
    assert.strictEqual(sv.status, 409, 'never 401, which would sign the educator out');
    const ok = await fx.as(dee, '/api/staff/g/journal/save', { name: 'Dee', key: 'not-a-key', passcode: 'director-pass-1', entry: { joy: 'The goats met the new class.' } });
    assert.strictEqual(ok.status, 200);
    assert.ok(ok.body.key, 'a fresh key comes back');
    assert.ok(ok.body.entries.some(e => e.joy === 'The goats met the new class.'), 'the writing was saved');
  });
});

test('phase one changes in the page code', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  const fam = fs.readFileSync(path.join(__dirname, '..', 'family.js'), 'utf8');
  const kay = fs.readFileSync(path.join(__dirname, '..', 'kaymbu.js'), 'utf8');
  const staff = fs.readFileSync(path.join(__dirname, '..', 'staff.js'), 'utf8');
  assert.doesNotMatch(src, /data-confshare/, 'conference notes are never shared with families');
  assert.match(fam, /const shared = \[\];/);
  assert.match(fam, /return \{ ok: true, test: true, code \}/, 'in test mode a tester sees the code on the page (Oct 31)');
  assert.doesNotMatch(staff, /randomBytes\(3\)\.toString\('hex'\)/, 'start codes are six numbers');
  assert.doesNotMatch(kay, /r\.deleted = true; r\.local = true; noteChange\('notices', id\); scheduleSave\('notices', id\); n\+\+; continue;/, 'linked Moments are never removed');
  assert.match(src, /suggest\.map\(id=>\{const c=children\.get\(id\);return c\?Object\.assign\(\{\},c,\{id\}\):null\}\)/, 'each suggested name stays with its own child');
  assert.match(src, /drdpTries/, 'a DRDP reading that did not finish is tried again');
  assert.match(src, /n\._talkH!==h/, 'the closed-question note compares with the last note drawn');
  assert.match(src, /readOf:shown/, 'a read mark belongs to the words on the screen');
});
