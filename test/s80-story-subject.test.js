'use strict';
// A story begun from a subject someone types, from one child, or both (November 19, 2026). The search finds observations
// by whole words, the best matches first, a story holds only the ticked photos, and a subject with nothing found still
// opens a story with its title and blank pages. An educator searches their own class. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const more = put => {
  put('children/pip.json', { id: 'pip', first: 'Pip', last: 'Test', classroom: 'West', status: 'active' });
  put('children/zed.json', { id: 'zed', first: 'Zed', last: 'Test', classroom: 'North', status: 'active' });
  const n = (id, noticed, room, kids, photo) => put(`notices/${id}.json`, { id, noticed, wonder: '', classroom: room, by: room === 'West' ? 'Ann' : 'Bea', at: Date.now() - 864e5, children: kids, ...(photo ? { photo: { id: 'ph' + id, w: 10, h: 10 } } : {}) });
  n('s1', 'Rain boots\nPip pulls on her rain boots and gets ready for the rain.', 'West', ['pip'], true);
  n('s2', 'The train\nPip pushes a train along the track.', 'West', ['pip'], true);
  n('s3', 'Shoes on\nZed puts his shoe on by the door.', 'North', ['zed'], true);
  n('s4', 'Rain walk\nWe walked in the rain with no camera.', 'West', ['pip'], false);
  n('s5', 'Ready\nPip is ready for lunch.', 'West', ['pip'], true);
};

test('a story starts from a subject, a child, or both', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());

  await t.test('the director finds a subject across classes, ticks, and the story holds only the ticked photos', async () => {
    const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('stories')); await s.p.waitForSelector('#stfq');
    assert.deepStrictEqual(await s.p.evaluate(() => stFindTerms('getting ready for the rain')), ['ready', 'rain']);
    assert.deepStrictEqual(await s.p.evaluate(() => stFindTerms('putting on shoes')), ['shoe']);
    await s.p.fill('#stfq', 'getting ready for the rain'); await s.p.click('[data-stfind]'); await s.p.waitForSelector('[data-stftick]');
    const ids = await s.p.evaluate(() => [...document.querySelectorAll('[data-stftick]')].map(x => x.dataset.stftick));
    assert.strictEqual(ids[0], 's1', 'the observation holding both words comes first');
    assert.ok(ids.includes('s5') && !ids.includes('s2') && !ids.includes('s4'), 'train is no match for rain, and an observation with no photo is left out');
    await s.p.click('[data-stftick="s1"]'); await s.p.click('[data-stfgo]'); await s.p.waitForFunction(() => view === 'story');
    const st = await s.p.evaluate(() => { const x = stories.get(storyOpen); return { title: x.title, sources: x.sources, pages: x.pages.length, from: x.from, child: x.childId || '' }; });
    assert.strictEqual(st.title, 'Getting ready for the rain'); assert.deepStrictEqual(st.sources, ['s1']); assert.strictEqual(st.pages, 1);
    assert.strictEqual(st.from.kind, 'subject'); assert.strictEqual(st.child, '');
    assert.deepStrictEqual(s.errors || [], []);
  });

  await t.test('a subject with nothing found still opens a story with its title', async () => {
    const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('stories')); await s.p.fill('#stfq', 'using clay'); await s.p.click('[data-stfind]'); await s.p.waitForSelector('[data-stfgo]');
    assert.match(await s.p.innerText('#main'), /No observations with a photo found for "using clay" yet/);
    await s.p.click('[data-stfgo]'); await s.p.waitForFunction(() => view === 'story');
    const st = await s.p.evaluate(() => { const x = stories.get(storyOpen); return { title: x.title, pages: x.pages.length }; });
    assert.strictEqual(st.title, 'Using clay'); assert.strictEqual(st.pages, 0);
  });

  await t.test('Make a story on a child\'s page lists that child\'s observations, and the story carries the child', async () => {
    const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => { kidOpen = 'pip'; goView('child'); }); await s.p.waitForSelector('[data-kidstory="pip"]');
    await s.p.click('[data-kidstory="pip"]'); await s.p.waitForSelector('[data-stftick]');
    const ids = await s.p.evaluate(() => [...document.querySelectorAll('[data-stftick]')].map(x => x.dataset.stftick).sort());
    assert.deepStrictEqual(ids, ['s1', 's2', 's5']);
    await s.p.click('[data-stfall]'); await s.p.click('[data-stfgo]'); await s.p.waitForFunction(() => view === 'story');
    const st = await s.p.evaluate(() => { const x = stories.get(storyOpen); return { title: x.title, n: x.sources.length, child: x.childId, kind: x.from.kind }; });
    assert.deepStrictEqual(st, { title: 'Pip', n: 3, child: 'pip', kind: 'child' });
  });

  await t.test('an educator searches their own class', async () => {
    const s = await signedIn(fx, br, 'Ann', '1357', 390);
    await s.p.evaluate(() => goView('stories')); await s.p.waitForSelector('#stfq');
    const kids = await s.p.evaluate(() => [...document.querySelectorAll('#stfkid option')].map(o => o.textContent));
    assert.ok(kids.includes('Pip Test') && !kids.includes('Zed Test'));
    await s.p.fill('#stfq', 'shoes'); await s.p.click('[data-stfind]'); await s.p.waitForSelector('[data-stfgo]');
    assert.strictEqual(await s.p.evaluate(() => document.querySelectorAll('[data-stftick]').length), 0, 'the North class observation is not offered to a West educator');
    for (const t of await s.p.evaluate(() => [...document.querySelectorAll('#main .cnt, #main b, #main button')].map(x => x.textContent))) assert.doesNotMatch(t, /[—–]|\bClaude\b/);
  });
});
