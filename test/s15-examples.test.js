'use strict';
// Session 15. A module's examples from our own documentation, matched to its key ideas and confirmed by TREE's writing help.
// Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
// what the matching returns comes from its own context, so it is compared as plain data
const same = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);

// the matching on its own, read from the page's source between its markers
function core() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/growth-app.js'), 'utf8');
  const a = src.indexOf('/* ex-core begin'), b = src.indexOf('/* ex-core end */'); assert.ok(a > 0 && b > a);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + ';this.X={exWords,exKeyIdeas,exIdf,exRank,exIdeaLine,exAskText,exReadAnswer,exArrange,exClean}', ctx);
  return ctx.X;
}

const PLAY = { title: 'How children play together', desc: 'The forms of social play and how we notice them.', serves: [], sections: [
  { heading: 'Why it matters', body: 'Children play in many ways during the day, and every form of play has its time in our class.' },
  { heading: 'Reading', body: "### Parten's six forms\n\n- **Solitary play.** A child plays alone with their own materials.\n- **Parallel play.** Children play side by side with similar materials, near each other but each on their own.\n- **Cooperative play.** Children share a goal, take roles and negotiate.\n\n### Watching closely\n\nWe write down what we see." },
  { heading: 'Try this week', body: 'Watch one child during choice time and note which form of play you see.' }] };
const OTHER = [
  { title: 'Our garden', desc: 'Children in the garden.', sections: [{ heading: 'Why it matters', body: 'Children play in the garden every day. Time outside matters for the class and for each educator.' }, { heading: 'Reading', body: '### Soil and seeds\n\nChildren dig, plant and water. Play in the soil takes time.' }] },
  { title: 'Documentation', desc: 'How we write what we see.', sections: [{ heading: 'Why it matters', body: 'Children and educators write together. Play and time are part of every day in the class.' }, { heading: 'Reading', body: '### Noticing and wondering\n\nWe write what children say during play time.' }] }];
const RELEVANT = { kind: 'obs', id: 'obs:a', at: 1, label: 'Observation', raw: 'R. and J. sat side by side at the sand table, each filling their own bucket with similar scoops, glancing over now and then. Parallel play, each on their own.' };
const GENERIC = { kind: 'obs', id: 'obs:b', at: 2, label: 'Observation', raw: 'The children had a long play time outside today and the class had a lot of time to play. Children played and played all morning.' };

test('key-idea matching ranks a clearly relevant piece above a generic one and names the idea', () => {
  const X = core();
  const K = X.exKeyIdeas(PLAY);
  same(K.ideas.map(i => i.label), ["Parten's six forms", 'Solitary play', 'Parallel play', 'Cooperative play', 'Watching closely']);
  assert.strictEqual(K.ideas[2].from, "Parten's six forms");
  // the topic is the key ideas, never the body of the reading
  assert.ok(!K.words.includes('negotiate'));
  const idf = X.exIdf([PLAY, ...OTHER]);
  assert.ok(idf('parallel') > 4 * idf('play'), 'a word every module uses counts little');
  const r = X.exRank(PLAY, [PLAY, ...OTHER], [GENERIC, RELEVANT], [], false);
  assert.strictEqual(r[0].id, 'obs:a');
  const g = r.find(x => x.id === 'obs:b'); assert.ok(!g || g.sc < r[0].sc / 2);
  assert.strictEqual(X.exIdeaLine(r[0].idea), "Shows Parallel play, from Parten's six forms.");
});

test('the writing help is asked about the key ideas, and only what it confirms comes first with its sentence', () => {
  const X = core();
  const K = X.exKeyIdeas(PLAY);
  const ask = X.exAskText(PLAY, K.ideas, [RELEVANT.raw, GENERIC.raw]);
  assert.match(ask, /- Parallel play \(from Parten's six forms\)/); assert.match(ask, /\[1\] R\. and J\./); assert.match(ask, /\[2\] The children/);
  const ranked = [RELEVANT, GENERIC, { kind: 'plan', id: 'plan:c', raw: 'Cooperative building.' }];
  const fits = X.exReadAnswer({ fits: [
    { n: 1, idea: 'Parallel play', sentence: 'Shows parallel play: R. and J. fill their own buckets side by side, glancing over — the teacher watches.' },
    { n: 2, idea: 'Something not in the module', sentence: 'Children playing outside together for a long time today.' },
    { n: 9, idea: 'Solitary play', sentence: 'A piece that was never sent to the writing help at all.' }] }, ranked, K.ideas);
  assert.strictEqual(fits.length, 1); assert.strictEqual(fits[0].id, 'obs:a');
  assert.strictEqual(fits[0].why, 'Shows parallel play, R. and J. fill their own buckets side by side, glancing over, the educator watches.');
  assert.doesNotMatch(fits[0].why, /[—–:]/);
  const A = X.exArrange(ranked, fits, 5);
  same(A.sure.map(x => [x.id, x.why]), [['obs:a', fits[0].why]]);
  same(A.maybe.map(x => x.id), ['obs:b', 'plan:c']);
});

test('without the writing help every match shows as a possible fit', () => {
  const X = core();
  const A = X.exArrange([RELEVANT, GENERIC], [], 5);
  same(A.sure, []); same(A.maybe.map(x => x.id), ['obs:a', 'obs:b']);
  same(X.exReadAnswer(undefined, [RELEVANT], []), []);
});

const MOD = '<!--\nserves: obs\ndesc: The forms of social play.\n-->\n# How children play together\n\n## Why it matters\n\nChildren play in many ways during the day.\n\n## Reading\n\n### Parten\'s six forms\n\n- **Solitary play.** A child plays alone.\n- **Parallel play.** Children play side by side with similar materials, each on their own.\n- **Cooperative play.** Children share a goal and take roles.\n\n## Try this week\n\nWatch one child and note which form of play you see.\n\n## Reflect\n\n- What did you see?\n';

test('the director sees confirmed examples first, and possible fits without the writing help', async t => {
  const at = Date.now() - 864e5;
  const fx = await start({ more: put => {
    put('staff/pd/modules/05-play-together.md', MOD);
    put('children/rosa.json', { first: 'Rosa', last: 'Quill', classroom: 'West', status: 'active', parents: [] });
    put('notices/p1.json', { id: 'p1', at, classroom: 'West', by: 'Ann', noticed: 'Rosa and J. sat side by side at the sand table, each filling a bucket with similar scoops, in parallel play, glancing over now and then.', wonder: '' });
    put('notices/p2.json', { id: 'p2', at: at - 1000, classroom: 'West', by: 'Ann', noticed: 'Three children built one cooperative road together, each taking a role, one the builder and one the driver, sharing a goal.', wonder: '' });
    put('notices/p3.json', { id: 'p3', at: at - 2000, classroom: 'West', by: 'Ann', noticed: 'We had a long time outside this morning and the children played in the garden until snack.', wonder: '' });
  } });
  t.after(() => fx.stop());
  const ann = (await fx.login('Ann', '1357')).token;

  await t.test('only the director asks the writing help about examples', async () => {
    const r = await fx.as(ann, '/api/read', { purpose: 'pd-examples', content: [{ type: 'text', text: 'Hello' }] });
    assert.strictEqual(r.status, 403);
  });

  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch(); t.after(() => b.close());
  const toModule = async s => {
    await s.p.evaluate(() => { const back = document.querySelector('[data-stmodback]'); if (back) back.click(); else goView('stpd'); });
    await s.p.waitForSelector('[data-stmod="m:play-together"]', { timeout: 15000, state: 'attached' });
    await s.p.evaluate(() => { const L = [...document.querySelectorAll('[data-stmod="m:play-together"]')]; L[L.length - 1].click(); });
    await s.p.waitForSelector('[data-gexsugg]', { timeout: 15000, state: 'attached' });
  };
  const open = async s => { await toModule(s); await s.p.click('[data-gexsugg] > summary'); };

  await t.test('confirmed ones first with their sentence, then possible fits, asked once a day', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    const sent = [];
    await s.p.route('**/api/read', async route => { const body = JSON.parse(route.request().postData()); const prompt = body.content.map(c => c.text || '').join('');
      if (body.purpose !== 'pd-examples') { await route.fulfill({ json: { text: '{}' } }); return; }
      sent.push(body);
      const n = (prompt.match(/\[(\d+)\] [^\n]*parallel play/) || [])[1];
      await route.fulfill({ json: { text: JSON.stringify({ fits: [{ n: +n, idea: 'Parallel play', sentence: 'R. and J. fill their own buckets side by side at the sand table, showing parallel play.' }] }) } }); });
    await open(s);
    await s.p.waitForFunction(() => /showing parallel play/.test(document.getElementById('main').innerText), null, { timeout: 15000 });
    const txt = await s.p.evaluate(() => document.querySelector('[data-gexsugg]').innerText);
    assert.ok(txt.indexOf('showing parallel play') < txt.indexOf('Possible fits'), 'the confirmed example comes first');
    assert.match(txt, /Possible fits[\s\S]*cooperative road/);
    assert.strictEqual(sent.length, 1);
    // children only as initials, and nothing but words
    assert.ok(sent[0].content.every(c => c.type === 'text')); assert.doesNotMatch(JSON.stringify(sent[0]), /Rosa|Quill|Ann\b/);
    assert.match(sent[0].content[0].text, /Parallel play \(from Parten's six forms\)/);
    // drawn again, and opened again, the answer is kept for the day
    await toModule(s);
    await s.p.waitForFunction(() => /showing parallel play/.test(document.getElementById('main').innerText), null, { timeout: 15000 });
    assert.strictEqual(sent.length, 1);
    // the director still keeps it herself
    await s.p.evaluate(() => document.querySelector('[data-gexsugg] [data-gexkeep]').click()); await wait(1500);
    const kept = (await fx.as((await fx.login('Dee', 'director-pass-1')).token, '/api/staff/g/modules')).body.examples['play-together'].examples;
    assert.strictEqual(kept.length, 1); assert.match(kept[0].why, /showing parallel play/); assert.doesNotMatch(kept[0].text, /Rosa/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('without the writing help the matches show as possible fits, naming the key idea', async () => {
    // no key is set for these tests, so the server turns the request away and the page carries on quietly
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^tree\.exconfirm\./.test(k)) localStorage.removeItem(k); });
    await fx.as((await fx.login('Dee', 'director-pass-1')).token, '/api/staff/g/module/examples', { slug: 'play-together', examples: [], out: [] });
    await open(s);
    await s.p.waitForFunction(() => /Possible fits/.test(document.querySelector('[data-gexsugg]').innerText) && !/Reading the closest/.test(document.querySelector('[data-gexsugg]').innerText), null, { timeout: 15000 });
    const txt = await s.p.evaluate(() => document.querySelector('[data-gexsugg]').innerText);
    assert.match(txt, /Shows Parallel play, from Parten's six forms\./); assert.match(txt, /Shows Cooperative play, from Parten's six forms\./);
    assert.doesNotMatch(txt, /garden until snack/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
