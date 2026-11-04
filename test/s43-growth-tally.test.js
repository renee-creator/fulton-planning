'use strict';
// The Reflective Practice and Professional Growth tally, counted from the records, never a score. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }, { name: 'Bea', room: 'North' }];
const y = (() => { const d = new Date(); return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; })();

test('the tally counts this year\'s journal entries, focuses tried, module reflections, Proud Moments and presenting', async () => {
  const h = await loaded(LIST, { files: {
    'staff/growth/ann.json': { checkins: [
      { id: 'c1', date: `${y}-09-07`, focus: { settled: 'Wonder aloud' }, followed: { at: 1 } },
      { id: 'c2', date: `${y}-10-05`, focus: { settled: 'Sit with the block builders' } },
      { id: 'c0', date: `${y - 1}-10-05`, focus: { settled: 'Last year' }, followed: { at: 1 } }],
      modules: { documentation: { done: Date.parse(`${y}-10-01T12:00:00`), reflection: 'It changed how I write.' }, language: { opened: 1, reflection: 'Not finished' } } },
    'staff/journal/ann.json': { entries: [{ id: 'j1', date: `${y}-09-01`, joy: 'x' }, { id: 'j2', date: `${y}-09-08`, joy: 'y' }, { id: 'j0', date: `${y - 1}-09-08`, joy: 'old' }] },
    'staff/moments.json': { list: [{ id: 'm1', kind: 'moment', by: 'Ann', text: 'Proud', audience: 'everyone', at: Date.parse(`${y}-09-20T12:00:00`) }, { id: 'm2', kind: 'kudos', by: 'Bea', to: 'Ann', text: 'Thanks', audience: 'everyone', at: Date.parse(`${y}-09-21T12:00:00`) }] } } });
  const G = (n, p, b) => call(h.staff, n, 'g/' + p, Object.assign({ name: n }, b || {}));
  const mine = (await G('Ann', 'mine')).body;
  assert.deepStrictEqual(mine.tally, { year: String(y), journal: 2, tried: 1, reflections: 1, proud: 1, presenting: 0 });
  // the director sees the same tally on Ann's page, and scores are untouched
  const dir = (await call(h.staff, 'Dir', 'g/mine', { name: 'Ann' })).body;
  assert.deepStrictEqual(dir.tally, mine.tally);
  assert.deepStrictEqual(dir.evals, {});
  const bea = (await G('Bea', 'mine')).body;
  assert.deepStrictEqual(bea.tally, { year: String(y), journal: 0, tried: 0, reflections: 0, proud: 0, presenting: 0 });
});

test('the page shows the tally beside Reflective Practice only, as a line that says it is never a score', () => {
  const fs = require('fs'), path = require('path');
  const g = fs.readFileSync(path.join(__dirname, '..', 'src', 'growth-app.js'), 'utf8');
  assert.match(g, /function tallyHtml\(d\)/);
  assert.ok((g.match(/k==="refl"\?tallyHtml\(d\):""/g) || []).length >= 4, 'the scores row, the continuum, the director\'s placements and side by side');
  assert.match(g, /Counted from the records, never a score/);
  assert.doesNotMatch(g.slice(g.indexOf('function tallyHtml'), g.indexOf('function tallyHtml') + 900), /[—–]|teacher/);
});
