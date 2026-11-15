'use strict';
// A PD module stays steady while TREE works in the background, and the photos that fit it are suggested for the
// PowerPoint and for a Presenting entry's deck (November 15, 2026). Made-up names and words only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

const LONG = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of a long reading about how children play side by side.`).join('\n\n');
const MOD = '<!--\nserves: obs\ndesc: The forms of social play.\n-->\n# How children play together\n\n## Why it matters\n\nChildren play in many ways during the day.\n\n' +
  '## Reading\n\n### Parten\'s six forms\n\n- **Solitary play.** A child plays alone.\n- **Parallel play.** Children play side by side with similar materials, each on their own.\n- **Cooperative play.** Children share a goal and take roles.\n\n' +
  LONG + '\n\n## Try this week\n\nWatch one child and note which form of play you see.\n\n## Reflect\n\n- What did you see?\n\n' +
  '## Presenting this module\n\n**Before the session**\n\n- Choose photos of children playing together.\n';

test('a module page stays put while observations change, and suggests photos that fit it', async t => {
  const at = Date.now() - 864e5;
  const fx = await start({ more: put => {
    put('staff/pd/modules/05-play-together.md', MOD);
    put('notices/p1.json', { id: 'p1', at, classroom: 'West', by: 'Ann', noticed: 'Two children sat side by side at the sand table, each filling a bucket with similar scoops, in parallel play.', wonder: '', photo: { id: 'ph1', thumb: 'ph1t', w: 800, h: 600 } });
    put('notices/p2.json', { id: 'p2', at: at - 1000, classroom: 'North', by: 'Bea', noticed: 'Three children built one cooperative road together, each taking a role and sharing a goal.', wonder: '', photo: { id: 'ph2', thumb: 'ph2t', w: 800, h: 600 } });
    put('notices/p3.json', { id: 'p3', at: at - 2000, classroom: 'West', by: 'Ann', noticed: 'We had snack on the porch and the bread was warm from the oven this morning.', wonder: '', photo: { id: 'ph3', thumb: 'ph3t', w: 800, h: 600 } });
  } });
  t.after(() => fx.stop());
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await s.p.evaluate(() => goView('stpd'));
  await s.p.waitForSelector('[data-stmod="m:play-together"]', { timeout: 15000, state: 'attached' });
  await s.p.evaluate(() => { const L = [...document.querySelectorAll('[data-stmod="m:play-together"]')]; L[L.length - 1].click(); });
  await s.p.waitForFunction(() => /Photos that fit this module/.test(document.getElementById('main').innerText), null, { timeout: 15000 });

  await t.test('the photos that fit are offered, and the one that does not is left out', async () => {
    const keys = await s.p.evaluate(() => [...document.querySelectorAll('[data-gmphoto]')].map(x => x.dataset.gmphoto.split('|')[1]));
    assert.ok(keys.includes('obs:ph1') && keys.includes('obs:ph2'), 'both play photos are offered');
    assert.ok(!keys.includes('obs:ph3'), 'the snack photo does not fit');
  });

  await t.test('a guiding question moves the photos that share its words to the front', async () => {
    const r = await s.p.evaluate(() => ({ plain: TreeGrowth.photoFits('play-together', { n: 3 }).map(p => p.key),
      asked: TreeGrowth.photoFits('play-together', { n: 3, question: 'How do children build a road together, each with a role?' }).map(p => p.key),
      kept: TreeGrowth.photoFits('play-together', { n: 3, have: ['obs:ph1'] }).map(p => p.key) }));
    assert.strictEqual(r.asked[0], 'obs:ph2', 'the road photo leads once the question asks about roads and roles');
    assert.ok(!r.kept.includes('obs:ph1'), 'a photo already in the deck is not offered again');
    assert.ok(!r.plain.includes('obs:ph3'));
  });

  await t.test('ticking a photo keeps the reader in place and names it on the PowerPoint button', async () => {
    await s.p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(200);
    const y0 = await s.p.evaluate(() => window.scrollY); assert.ok(y0 > 200, 'the page is long enough to scroll');
    await s.p.check('[data-gmphoto="play-together|obs:ph2"]');
    await s.p.waitForFunction(() => /PowerPoint, overview, with 1 photo/.test(document.getElementById('main').innerText), null, { timeout: 10000 });
    const y1 = await s.p.evaluate(() => window.scrollY);
    assert.ok(Math.abs(y1 - y0) < 60, `the page stays where it was (${y0} then ${y1})`);
  });

  await t.test('an observation changing in the background does not draw the module again', async () => {
    const y0 = await s.p.evaluate(() => { document.getElementById('main').insertAdjacentHTML('beforeend', '<i id="still-here"></i>'); return window.scrollY; });
    await s.p.evaluate(() => patchNotice('p3', { wonder: 'What else could we bake?' }));
    await wait(1500);
    const r = await s.p.evaluate(() => ({ kept: !!document.getElementById('still-here'), y: window.scrollY }));
    assert.ok(r.kept, 'the page was not drawn again');
    assert.ok(Math.abs(r.y - y0) < 10, 'the reader stays where they were');
  });
});
