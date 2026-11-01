'use strict';
// Session 13. Suggested questions on curriculum plans and the Artists page. TREE offers up to three questions once the
// observation is written, from our prompts word for word or from the educator's own words, each labelled with its reason,
// and nothing joins a plan without a tap. A question from the Artists list brings the artist's card, which prints with its
// public domain picture and never with the note for the educator. Made-up names and a made-up page only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http'), fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.TREE_SHOTS || '';

const BANK = `<!--
library: provocations
-->
# Provocations and curiosity prompts

With each one, and with every artwork, we use the same routine. I notice. I wonder. It reminds me of. What do you see that makes you say that?

## Wonderings

- We wonder what the children notice when they follow the veins of a leaf with a fingertip.

## Artists

- Alexander Calder's mobiles and wire circus, beside our wire, sticks and string. We wonder how the children find the balance point.

## Where the artists come from

- **Alexander Calder**. Mobiles. Link, [the Calder Foundation](https://calder.org/).
`;
const ARTISTS = `<!--
library: artists
-->
# Artists

We look together before anyone speaks. I notice. I wonder. It reminds me of. What do you see that makes you say that?

## Alexander Calder, mobiles and wire figures

**Set.** Garden and materials
**Known as.** Calder
**Print or link.** Link
**Link.** [The Calder Foundation](https://calder.org/)
**Pairs with.** Wire, sticks, string and found objects.
**Wondering.** We wonder how the children find the balance point.
**For the educator.** A note that never prints.

## A painter, Water Study

**Set.** Garden and materials
**Known as.** Water Study
**Print or link.** Print
**Picture.** https://example.org/water.jpg
**Link.** [A museum](https://example.org/water)
**Pairs with.** Water play.
**Wondering.** What shapes do the children see in moving water?
**For the educator.** Another note that never prints.
`;

test('the library serves the Artists page beside the prompts', async t => {
  const fx = await start({ more: put => { put('staff/library/prompts/provocations.md', BANK); put('staff/library/prompts/artists.md', ARTISTS); } });
  t.after(() => fx.stop());
  const ann = (await fx.login('Ann', '1357')).token;
  const r = await fx.as(ann, '/api/staff/library', {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.artists.path, 'staff/library/prompts/artists.md');
  assert.deepStrictEqual(r.body.artists.parts.map(p => p.key), ['Alexander Calder, mobiles and wire figures', 'A painter, Water Study']);
  assert.match(r.body.provocations.lead, /What do you see that makes you say that\?/);
});

test('suggested questions are labelled, kept to our rules, added only with a tap, and an artist brings its card', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  let asked = '';
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { asked = Buffer.concat(c).toString();
    const text = JSON.stringify({ thin: false, items: [
      { from: 'prompt', id: 'Artists|0', why: 'The children balanced sticks on the fence rail.' },
      { from: 'observation', text: 'I want to make the sticks stay up.', why: 'A child voice, left out.' },
      { from: 'observation', text: 'We wonder what the children are testing each time a stick falls — and the teacher helps?', why: 'Left out.' },
      { from: 'observation', text: 'We wonder what the children are testing each time they add one more stick to the rail.', why: 'They kept adding sticks until the row fell.' }] });
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok));
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more: put => {
    put('staff/library/prompts/provocations.md', BANK); put('staff/library/prompts/artists.md', ARTISTS);
    put('plans/pq.json', { id: 'pq', type: 'individual', weekOf: monday, classroom: 'West', educator: 'Ann', focus: 'area', fields: { area: 'Balance at the fence', observation: 'Several children spent the morning balancing sticks across the fence rail and adding more until the whole row fell, then they started again.' } });
    put('plans/pthin.json', { id: 'pthin', type: 'individual', weekOf: monday, classroom: 'West', educator: 'Ann', focus: 'area', fields: { area: 'Sticks', observation: 'Sticks again.' } });
  } });
  t.after(async () => { await fx.stop(); ai.close(); await b.close?.(); });
  const br = await b.launch();
  t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 420);
  const open = id => s.p.evaluate(id => { const x = document.createElement('button'); x.dataset.open = id; document.body.appendChild(x); x.click(); x.remove(); }, id);
  // a thin observation gets nothing, and TREE says so
  await open('pthin'); await wait(800);
  assert.match(await s.p.textContent('[data-card="questions"]'), /Write a little more in the observation/);
  assert.strictEqual(asked, '', 'nothing is asked for a thin observation');
  // a written observation brings labelled suggestions, the ones that break our rules left out
  await open('pq');
  await s.p.waitForSelector('[data-qsadd]', { timeout: 15000 });
  assert.match(asked, /What is the child trying to make happen\?/);
  assert.match(asked, /Artists\|0 => Alexander Calder/);
  const box = await s.p.textContent('[data-card="questions"]');
  assert.match(box, /From our prompts/); assert.match(box, /From your observation/);
  assert.match(box, /Brings the card for Alexander Calder/);
  assert.strictEqual(await s.p.locator('[data-qsadd]').count(), 2, 'a child\'s voice, a dash and the word teacher are each left out');
  assert.doesNotMatch(box, /I want to make/);
  let plan = await s.p.evaluate(() => plans.get('pq'));
  assert.ok(!plan.fields.questions, 'nothing is added without a tap');
  if (SHOTS) await s.p.locator('[data-card="questions"]').screenshot({ path: path.join(SHOTS, 'suggested-questions.png') });
  // a tap adds the prompt word for word, keeps its reason, and attaches the artist's card
  await s.p.click('[data-qsadd="0"]'); await wait(500);
  plan = await s.p.evaluate(() => plans.get('pq'));
  assert.strictEqual(plan.fields.questions, "Alexander Calder's mobiles and wire circus, beside our wire, sticks and string. We wonder how the children find the balance point.");
  assert.strictEqual(plan.qsTaken[0].from, 'prompt'); assert.match(plan.qsTaken[0].why, /fence rail/);
  assert.deepStrictEqual(plan.attached.map(a => a.kind + '|' + a.id), ['artist|alexander-calder-mobiles-and-wire-figures']);
  // How it connects shows the question taken and TREE's reason
  const how = await s.p.evaluate(() => howEvents().ev.filter(e => /suggested question/.test(e.what)).map(e => e.why));
  assert.deepStrictEqual(how, ['The children balanced sticks on the fence rail.']);
  // the Artists page lists the cards, keeps the note on the screen, and a card prints without the note
  await s.p.evaluate(() => goView('artists')); await s.p.waitForSelector('[data-artrow]');
  assert.strictEqual(await s.p.locator('[data-artrow]').count(), 2);
  await s.p.click('[data-artrow="a-painter-water-study"] summary');
  if (SHOTS) await s.p.screenshot({ path: path.join(SHOTS, 'artists-page.png'), fullPage: true });
  const docs = await s.p.evaluate(() => artCards().map(c => JSON.stringify(artistDoc(c))));
  for (const d of docs) assert.doesNotMatch(d, /never prints/, 'the note for the educator never prints');
  const pic = JSON.parse(docs[1]); assert.strictEqual(pic.photos.length, 1); assert.strictEqual(pic.blocks.length, 1, 'a public domain work prints large with little text');
  const link = JSON.parse(docs[0]); assert.ok(!link.photos.length && !link.blocks.some(x => x.t === 'photo'), 'a work under copyright is never copied');
  assert.deepStrictEqual(s.errors, []);
  await s.close();
});

test('every word TREE shows for the new parts keeps the school\'s writing rules', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  const a = src.indexOf('/* ---------- Suggested questions on a curriculum plan'), z = src.indexOf('async function loadGuides(force){');
  const b2 = src.indexOf('/* ---------- The Artists page'), z2 = src.indexOf('/* ---------- Attach to a plan');
  for (const part of [src.slice(a, z), src.slice(b2, z2)]) {
    assert.ok(part.length > 500);
    const shown = [...part.matchAll(/>([^<>${}]{12,})</g)].map(m => m[1]).join('\n');
    assert.doesNotMatch(shown, /[—–]|\bteachers?\b|\bClaude\b/);
  }
});
