'use strict';
// Print batch B. PD sheet labels, tick boxes and lines to write on, card lists in order, the guard for empty prints,
// cards per page and sign sizes, agenda words, and outside handouts that never name a person. Made-up text only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function fnFrom(text, name) {
  const at = text.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' is in the source');
  let d = 0, i = text.indexOf('{', at);
  for (; i < text.length; i++) { if (text[i] === '{') d++; else if (text[i] === '}' && --d === 0) break; }
  return text.slice(at, i + 1);
}
const G = src('src/growth-app.js');
const consts = ['FILL', 'BOLDLEAD'].map(n => G.match(new RegExp('const ' + n + '=.*\\n'))[0]).join('');
const P = new Function('has', consts + fnFrom(G, 'printBlocks') + fnFrom(G, 'cardBlocks') + ';return {printBlocks,cardBlocks}')(x => !!String(x || '').trim());

test('a sheet prints bold labels as small headings, tick boxes and full-width lines', () => {
  const out = P.printBlocks('**Our team.** ______ **Date.** ______\n\n**Questions for us.**\n1. One\n\n- [ ] Read the file\n- [ ] Call home\n\n______\n\n______\n\n**Sketch.** Mark where you stand.');
  assert.deepStrictEqual(out[0], { t: 'fill', fields: ['Our team', 'Date'], lines: 1 });
  assert.deepStrictEqual(out[1], { t: 'minor', text: 'Questions for us' });
  assert.ok(out.some(b => b.t === 'checks' && b.items.join('|') === 'Read the file|Call home'));
  assert.ok(out.some(b => b.t === 'fill' && b.lines === 2 && b.fields[0] === ''));
  assert.ok(out.some(b => b.t === 'minor' && b.text === 'Sketch'));
  assert.ok(out.some(b => b.t === 'text' && b.text === 'Mark where you stand.'));
});

test('a card splits label lines onto their own lines and keeps its list in order', () => {
  const out = P.cardBlocks('**9:00.** Welcome.\n**11:00.** A walk.\n\n**Carry these questions.**\n- One?\n- Two?\n\nThe end.');
  assert.deepStrictEqual(out.map(b => b.label), ['9:00', '11:00', 'Carry these questions', '']);
  assert.deepStrictEqual(out[2].items, ['One?', 'Two?']);
});

test('the print kit makes no file for an empty print, and lays cards and signs out', () => {
  global.window = {}; global.localStorage = { getItem: () => null, setItem() {} };
  const fn = new Function('window', src('print-kit.js').replace("})(typeof window !== 'undefined' ? window : this);", '})(window);'));
  const w = { localStorage: global.localStorage }; fn(w); const K = w.TREE_KIT;
  assert.strictEqual(K.isEmpty({ display: true, title: 'Agenda', meta: [['Day', 'Monday']], blocks: [] }), true);
  assert.strictEqual(K.isEmpty({ display: true, title: 'Evaluation', blocks: [{ t: 'list', label: 'Goals', items: [] }] }), true);
  assert.strictEqual(K.isEmpty({ centered: true, display: true, title: '', blocks: [], photos: [] }), true, 'a slide with no title and no photo');
  assert.strictEqual(K.isEmpty({ display: true, blocks: [{ t: 'text', text: 'Words' }] }), false);
  assert.strictEqual(K.guard([{ display: true, blocks: [] }], true), null);
  assert.strictEqual(K.pageKind({ centered: true, card: true }), 'card');
  assert.strictEqual(K.pageKind({ centered: true, sign: true }), 'sign');
  assert.strictEqual(K.pageKind({ display: true }), 'page');
  assert.deepStrictEqual(K.pagePlan('card', 4), { n: 4, size: 'letter' });
  assert.deepStrictEqual(K.pagePlan('sign', 1, 'half'), { n: 1, size: 'half' });
  assert.deepStrictEqual(K.pagePlan('page', 4), { n: 1, size: 'letter' });
});

test('agenda titles and words print plainly', () => {
  const at = G.indexOf('const shortUrl='), end = G.indexOf('function agendaDoc(');
  const f = new Function('CLASSROOMS', G.slice(at, end).replace(/^\/\*[\s\S]*?\*\/\s*/m, '') + ';return {agTitle,agWords}')(['West', 'North']);
  assert.strictEqual(f.agTitle('PD Day - School Closed'), 'Professional Development Day, school closed');
  assert.strictEqual(f.agWords('Read https://www.example.org/a/b?c=1. In West Class.'), 'Read example.org. In West class.');
});

test('outside prints name the school and never the person a date waits on', () => {
  const pr = src('src/presenting-app.js');
  assert.match(pr, /const printWhen=/);
  assert.match(pr, /\["Date",printWhen\(e\)\]/);
  assert.match(pr, /d\.footer=c/);
  assert.match(G, /filter\(b=>!\/\^Serves \//, 'the outside deck drops the Serves line');
});

test('the Growth Plan, check-ins, journal and Proud Moments each have a print', () => {
  for (const k of ['plan', 'checkin', 'mycheckins', 'journal', 'moments']) assert.ok(G.includes(`data-gprint="${k}"`), k);
  assert.match(fnFrom(G, 'journalDoc'), /st\.jrWho!==name/, 'the journal prints only once it is open for that reader');
});

test('the policies print at 12 points and the licensing print names no educator for the director', () => {
  const S = src('src/staff-app.js');
  assert.match(S, /else if\(b\.t==="p"\)\{words\(b\.runs,12,/);
  assert.match(S, /D\(\)&&!VIEW_AS\?\["Printed"/);
});
