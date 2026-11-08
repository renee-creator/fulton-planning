'use strict';
// Print fixes. A PD sheet whose lines start with a bold label prints, two child-height sheets fit a sideways letter
// page, and the tuition agreement prints its terms. Made-up text only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// pull one top-level function out of a source file by name, to run it on its own
function fnFrom(text, name) {
  const at = text.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' is in the source');
  let d = 0, i = text.indexOf('{', at);
  for (; i < text.length; i++) { if (text[i] === '{') d++; else if (text[i] === '}' && --d === 0) break; }
  return text.slice(at, i + 1);
}

test('a PD sheet with **Label.** lines turns into blocks and does not hang', () => {
  const G = src('src/growth-app.js'), consts = ['FILL', 'BOLDLEAD'].map(n => G.match(new RegExp('const ' + n + '=.*\\n'))[0]).join('');
  const printBlocks = new Function(consts + fnFrom(G, 'printBlocks') + '; return printBlocks;')();
  const body = '**Before.** We set out the materials.\n**During.** We watch and wonder.\n\n- one\n- two\n\n*Quiet note.*\n### Then\n1. first\n2. second\n\n1.5 hours in all\n\n| a | b |\n|---|---|\n| c | d |';
  const out = printBlocks(body);
  // each bold label is a small heading of its own, without its full stop, with its words under it (batch B, November 7, 2026)
  assert.deepStrictEqual(out.slice(0, 4), [{ t: 'minor', text: 'Before' }, { t: 'text', label: '', text: 'We set out the materials.' }, { t: 'minor', text: 'During' }, { t: 'text', label: '', text: 'We watch and wonder.' }]);
  assert.ok(out.some(b => b.t === 'list' && b.items.join() === 'one,two'));
  assert.ok(out.some(b => b.t === 'text' && b.text === 'Quiet note.'));
  assert.ok(out.some(b => b.t === 'sub' && b.text === 'Then'));
  assert.ok(out.some(b => b.t === 'list' && b.numbered && b.items.length === 2));
  assert.ok(out.some(b => b.t === 'text' && b.text === '1.5 hours in all'));
  assert.ok(out.some(b => b.t === 'table'));
});

test('child-height sheets go two to a sideways letter page, each a full half letter', () => {
  const hs = fnFrom(src('src/app.html'), 'halfSheets');
  assert.match(hs, /out\.addPage\(\[2\*H\.w,H\.h\]\)/, 'the page is two half letters wide, letter turned sideways');
  assert.doesNotMatch(hs, /addPage\(\[H\.h,H\.w\]\)/);
});

test('the printed agreement in the enrollment packet carries the school\'s terms', () => {
  assert.match(fnFrom(src('src/app.html'), 'enrollPacket'), /agreementWords:wordsDoc\("agreement"\)/, 'the office print passes the agreement wording');
  const WD = require('../wording.js'), A = require('../agreement.js');
  A.use(WD.parse('# Admission Tuition Agreement\n\n## program mf\n\nMorning, $1,000 per year, 10 payments of $100\n\n## page1 1\n\nI accept admission beginning {start}.\n\n## page1 2\n\nWe pay {month} a month.\n\n## page2 1\n\nFirst on the back.\n\n## page2 3\n\nThird on the back.\n\n## statement\n\nI agree.'));
  const t = A.terms({ start: '2027-08-16' }, 'mf');
  assert.strictEqual(t.page1.length, 2);
  assert.match(t.page1[0], /August 16, 2027/);
  assert.match(t.page1[1], /\$100/);
  assert.strictEqual(t.page2[1], A.LICENSING, 'the licensing term stays second on page two');
});
