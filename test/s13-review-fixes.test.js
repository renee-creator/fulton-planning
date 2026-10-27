'use strict';
// Session 13, after review. The suggested questions never wait forever, are kept under the words TREE read, cost nothing
// when an educator adds a question or types in the box it goes into, and leave the box being typed in alone. The wording
// check on a new question closes the gaps the review found. An artist's picture prints with the plan it is attached to,
// and a draft module's link stays with the director. Made-up names and a made-up page only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

const BANK = `<!--
library: provocations
-->
# Provocations and curiosity prompts

With each one we use the same routine. I notice. I wonder. It reminds me of. What do you see that makes you say that?

## Curiosity cards

- We wonder what the children notice when they follow the veins of a leaf with a fingertip.

## Artists

- A painter's water study, beside water play. What shapes do the children see in moving water?
`;
const ARTISTS = `<!--
library: artists
-->
# Artists

We look together before anyone speaks.

## A painter, Water Study

**Set.** Garden and materials
**Known as.** water study
**Print or link.** Print
**Picture.** https://example.org/water.jpg
**Link.** [A museum](https://example.org/water)
**Pairs with.** Water play.
**Wondering.** What shapes do the children see in moving water?
**For the educator.** A note that never prints.
`;

test('the wording check leaves out every question the review found getting through', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({});
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 420);
  const bad = [
    'How might the children print with apple halves?',
    'How might the children build with dried beans and pasta?',
    'We wonder what the children make when they glue rice to paper.',
    'How might the children copy Monet\'s Water Lilies?',
    'How might the children trace the shapes in the painting?',
    'We wonder how the children paint in the style of Van Gogh.',
    'How might the children keep the snails in a box?',
    'We wonder what the children notice when they put the worms in a bucket.',
    'Children, what do you see in the puddle?',
    'How many legs does a spider have, children?',
    'Do the children like ramps?',
    'Are the children ready for a bigger slope?',
    'What color is the sky in the painting the children made?',
    'We wonder whether the children are like engineers at the ramp.',
    'My question is what the children are testing at the ramp?',
    'We wonder what the children see, I think it is the light.',
    'We wonder what the teacher can offer the children at the ramp.',
    'We wonder how the children use the classroom ramp.'
  ];
  const good = [
    'We wonder what the children are testing each time they let the wheelbarrow roll back.',
    'How might the children find the balance point with more sticks?',
    'What might the children notice about the snails where they live?'
  ];
  const r = await s.p.evaluate(([bad, good]) => ({ bad: bad.filter(x => qsOk(x)), good: good.filter(x => !qsOk(x)),
    why: [qsWordsOk('I saw it in the observation.'), qsWordsOk('The children balanced sticks on the rail.'), qsWordsOk('It matches the teacher\'s note.')] }), [bad, good]);
  assert.deepStrictEqual(r.bad, [], 'each one breaks a rule and is left out');
  assert.deepStrictEqual(r.good, [], 'questions that keep our rules still show');
  assert.deepStrictEqual(r.why, [false, true, false], 'a reason keeps the same wording rules');
  await s.close();
});

test('on a Classroom plan, adding a question costs no new reading, keeps the other offers, and the reading never waits forever', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  let asks = 0;
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { asks++;
    const text = JSON.stringify({ thin: false, items: [
      { from: 'prompt', id: 'Curiosity cards|0', why: 'The children traced the leaf.' },
      { from: 'observation', text: 'We wonder what the children are testing each time they let the wheelbarrow roll back.', why: 'They pushed the wheelbarrow up the hill again and again.' }] });
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok));
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const OBS = 'Two children pushed the wheelbarrow up the hill again and again this morning and let it roll back down, laughing each time it tipped over at the bottom.';
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more: put => {
    put('staff/library/prompts/provocations.md', BANK); put('staff/library/prompts/artists.md', ARTISTS);
  } });
  t.after(async () => { await fx.stop(); ai.close(); });
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 420);
  await s.p.waitForFunction(() => typeof plans !== 'undefined' && typeof newPlan === 'function', null, { timeout: 15000 }); await wait(500);
  // a Classroom plan made the way TREE makes one, with its observation written
  const pid = await s.p.evaluate(obs => { const np = newPlan('classroom', { classroom: 'West' }); np.fields.observation = obs; plans.set(np.id, np); persist(np); return np.id; }, OBS);
  await s.p.evaluate(id => { const x = document.createElement('button'); x.dataset.open = id; document.body.appendChild(x); x.click(); x.remove(); }, pid);
  await s.p.waitForSelector('[data-qsadd]', { timeout: 15000 });
  assert.strictEqual(asks, 1);
  assert.strictEqual(await s.p.locator('[data-qsadd]').count(), 2);
  // adding one puts it in Intentions, asks nothing more, and the other offer stays
  await s.p.click('[data-qsadd="1"]'); await wait(1500);
  assert.strictEqual(asks, 1, 'adding a question costs no new reading');
  assert.match(await s.p.evaluate(id => plans.get(id).fields.intentions, pid), /wheelbarrow roll back/);
  assert.strictEqual(await s.p.locator('[data-qsadd]').count(), 1, 'the offer not taken is still there');
  assert.match(await s.p.textContent('[data-card="intentions"]'), /Added/);
  // typing in Intentions and deleting the question asks nothing, never leaves the reading waiting, and the offer can be taken again
  await s.p.fill('#f-intentions', 'Our own question about the hill.'); await s.p.dispatchEvent('#f-intentions', 'change'); await wait(1200);
  assert.strictEqual(asks, 1, 'typing in Intentions costs no reading');
  const box = await s.p.textContent('[data-card="intentions"]');
  assert.doesNotMatch(box, /TREE is reading the observation/);
  assert.doesNotMatch(box, /Added/, 'an offer deleted from the box can be added again');
  assert.strictEqual(await s.p.locator('[data-qsadd]').count(), 2);
  // leaving the Observation box redraws only the suggestions, so the Intentions box keeps its place and cursor
  await s.p.evaluate(() => { window.__ta = document.querySelector('#f-intentions'); });
  await s.p.fill('#f-observation', OBS + ' Then they tried the steeper slope by the oak and counted how many times it tipped.');
  await s.p.focus('#f-intentions'); await s.p.dispatchEvent('#f-observation', 'change'); await wait(300);
  assert.ok(await s.p.evaluate(() => window.__ta === document.querySelector('#f-intentions') && document.activeElement === window.__ta), 'the Intentions box is the same box, still in focus');
  await s.p.waitForFunction(() => document.querySelectorAll('[data-qsadd]').length > 0, null, { timeout: 15000 });
  assert.strictEqual(asks, 2, 'new observation words are read once');
  // going back to the earlier words shows what was found for them, with no new reading
  await s.p.fill('#f-observation', OBS); await s.p.dispatchEvent('#f-observation', 'change'); await wait(1200);
  assert.strictEqual(asks, 2, 'earlier words are not read again');
  assert.doesNotMatch(await s.p.textContent('[data-card="intentions"]'), /TREE is reading the observation/);
  // a reading that arrives late fills only its own words, and the words now written get their own reading
  await s.p.fill('#f-observation', 'A third set of words about the wheelbarrow and the hill and the children taking turns at the top of the slope.');
  await s.p.dispatchEvent('#f-observation', 'change');
  await s.p.waitForFunction(() => document.querySelectorAll('[data-qsadd]').length > 0, null, { timeout: 15000 });
  assert.strictEqual(asks, 3);
  assert.deepStrictEqual(s.errors, []);
  await s.close();
});

test('an attached artist prints its picture with the plan, and a draft module\'s link stays with the director', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const fx = await start({ more: put => {
    put('staff/library/prompts/provocations.md', BANK); put('staff/library/prompts/artists.md', ARTISTS);
    put('plans/pa.json', { id: 'pa', type: 'individual', weekOf: monday, classroom: 'West', educator: 'Ann', focus: 'area', fields: { area: 'Water', observation: 'Water play.' }, attached: [{ kind: 'artist', id: 'a-painter-water-study', title: 'A painter, Water Study' }] });
  } });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 420);
  await s.p.evaluate(id => { const x = document.createElement('button'); x.dataset.open = id; document.body.appendChild(x); x.click(); x.remove(); }, 'pa');
  await wait(800);
  const asked = await s.p.evaluate(async () => { let got = null; window.loadPhotos = async docs => { got = docs.map(d => (d.photos || []).map(x => x.src)); }; window.makePdf = () => {};
    const x = document.createElement('button'); x.id = 'dl'; document.body.appendChild(x); x.click(); x.remove();
    for (let i = 0; i < 40 && !got; i++) await new Promise(r => setTimeout(r, 100)); return got; });
  assert.ok(asked && asked.some(list => list.includes('https://example.org/water.jpg')), 'the picture is fetched for the plan\'s print');
  // the module is a draft, so an educator sees no link to it, and the director does
  await s.p.evaluate(() => goView('artists')); await s.p.waitForSelector('[data-artrow]');
  assert.strictEqual(await s.p.locator('[data-artmod]').count(), 0);
  assert.strictEqual(await s.p.locator('[data-artprint="all"][data-word]').count(), 1, 'every card shown has a Word copy too');
  await s.close();
  const d = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100);
  await d.p.evaluate(() => goView('artists')); await d.p.waitForSelector('[data-artrow]');
  assert.strictEqual(await d.p.locator('[data-artmod]').count(), 1);
  await d.close();
});
