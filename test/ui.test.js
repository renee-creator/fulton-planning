'use strict';
// TREE in a browser, at phone width and on a desktop, against the made-up school in fixture.js
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('TREE in the browser', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const h2 = p => p.evaluate(() => (document.querySelector('#main h2') || {}).textContent || '');

  await t.test('another page opens even while a box on the page has focus', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1');
    await s.p.evaluate(() => goView('stjour')); await s.p.waitForSelector('#gj-pass'); await s.p.focus('#gj-pass'); await s.p.waitForTimeout(1200);
    await s.p.evaluate(() => goView('today')); await s.p.waitForTimeout(800);
    assert.match(await h2(s.p), /Good (morning|afternoon|evening)/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a check-in reads its day in full and its time as a clock time', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357');
    await s.p.evaluate(() => goView('stci')); await s.p.waitForFunction(() => /My next check-in/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Monday, November 2, 10:15 am/);
    assert.doesNotMatch(text, /quarter past|o'clock|\d:\d\d ?(AM|PM)/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('Share tapped twice keeps one proud moment', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stmom')); await s.p.waitForSelector('#gm-text');
    await s.p.fill('#gm-text', 'We planted the garlic together');
    await s.p.evaluate(() => { const x = document.querySelector('[data-gmshare]'); x.click(); x.click(); });
    await s.p.waitForFunction(() => /We planted the garlic together/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const n = await s.p.evaluate(() => (document.querySelector('#main').innerText.match(/We planted the garlic together/g) || []).length);
    assert.strictEqual(n, 1);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('words typed in the Growth Plan are still there after opening another page and coming back', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stplan')); await s.p.waitForSelector('#gp-ch');
    // on a narrow screen the box can sit in a closed fold, which a person opens first
    // a long page folds its later sections a moment after it is drawn, so the fold is opened once that has happened
    await s.p.waitForTimeout(1500);
    await s.p.evaluate(() => { for (let d = document.querySelector('#gp-ch').closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; });
    await s.p.fill('#gp-ch', 'Rain days indoors');
    await s.p.click('#tsubnav [data-tview="strec"]').catch(async () => { await s.p.evaluate(() => goView('strec')); });
    await s.p.waitForFunction(() => /My records/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    await s.p.evaluate(() => goView('stplan')); await s.p.waitForSelector('#gp-ch');
    assert.strictEqual(await s.p.inputValue('#gp-ch'), 'Rain days indoors');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a flu shot not on file shows as past due after December 1, in words and not only in color', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.route('**/api/staff/boot', async r => { const res = await r.fetch(); const j = await res.json(); j.today = '2026-12-15'; await r.fulfill({ response: res, json: j }); });
    await s.p.evaluate(() => goView('strec')); await s.p.waitForFunction(() => /Flu vaccine/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Past due, it was due by December 1/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the PD library holds no coming soon line, and the go-to person is named rather than called she', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => /Modules/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    assert.doesNotMatch(await s.p.evaluate(() => document.querySelector('#main').innerText), /Written next|coming soon/i);
    await s.close();
    const n = await signedIn(fx, b, 'Neo', '1357');
    // the go-to person's line comes with the educator records, which can arrive a moment after the page is drawn
    await n.p.evaluate(() => goView('stnew')); await n.p.waitForFunction(() => /Gia answers your questions/.test(document.querySelector('#main').innerText), null, { timeout: 15000 }).catch(() => {});
    const text = await n.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Gia answers your questions/);
    assert.deepStrictEqual(n.errors, []); await n.close();
  });

  await t.test('the director\'s list says a Fulton training not done yet is due, not to renew', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('stteam')); await s.p.waitForFunction(() => /Every educator/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const row = await s.p.evaluate(() => [...document.querySelectorAll('[data-stperson]')].find(r => /Ann/.test(r.innerText)).innerText);
    assert.match(row, /1 due/); assert.doesNotMatch(row, /to renew/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('every choice in the Educators settings has a name a screen reader can read', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('settings')); await s.p.waitForSelector('[data-stprof]', { state: 'attached', timeout: 15000 });
    const bare = await s.p.evaluate(() => [...document.querySelectorAll('#main select,#main input:not([type=hidden]),#main textarea')].filter(el => !el.getAttribute('aria-label') && !el.closest('label') && !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.title && !el.placeholder).map(el => el.outerHTML.slice(0, 80)));
    assert.deepStrictEqual(bare, []);
    await s.close();
  });

  await t.test('on a phone muted lines are muted by colour, so a chip inside keeps its contrast', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 360);
    await s.p.evaluate(() => goView('strec')); await s.p.waitForSelector('#main .cnt');
    const ops = await s.p.evaluate(() => [...new Set([...document.querySelectorAll('#main .cnt')].map(e => getComputedStyle(e).opacity))]);
    assert.deepStrictEqual(ops, ['1']);
    await s.close();
  });

  await t.test('links in the Educators lists are tall enough to tap on a phone', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 360);
    for (const v of ['strec', 'sthb']) {
      await s.p.evaluate(v => goView(v), v); await s.p.waitForTimeout(1500);
      const small = await s.p.evaluate(() => [...document.querySelectorAll('#main :is(.prow,.stfiles,.strow,.actions) :is(.linkbtn,a:not(.btn))')].filter(e => e.getBoundingClientRect().height && e.getBoundingClientRect().height < 32).map(e => e.textContent.trim().slice(0, 40)));
      assert.deepStrictEqual(small, [], v);
    }
    await s.close();
  });

  await t.test('seeing TREE as an educator opens that educator\'s own records, growth and check-in', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280, { name: 'Bea', room: 'North' });
    await s.p.evaluate(() => goView('strec')); await s.p.waitForFunction(() => /Monday planning hour/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /North Class/);
    await s.p.evaluate(() => goView('stci')); await s.p.waitForFunction(() => /My next check-in/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /10:15 am/); assert.doesNotMatch(text, /could not open/);
    await s.p.evaluate(() => goView('stgrow')); await s.p.waitForTimeout(1500);
    assert.doesNotMatch(await s.p.evaluate(() => document.querySelector('#main').innerText), /could not open/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the calendar reads days in full and times as clock times', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 1280);
    await s.p.evaluate(() => goView('calendar'));
    let text = '';
    for (let i = 0; i < 40 && !/The rest of the week|Nothing scheduled/.test(text); i++) { await s.p.waitForTimeout(250); const f = s.p.frames().find(f => /tree-calendar/.test(f.url())); text = f ? await f.evaluate(() => document.body.innerText).catch(() => '') : ''; }
    assert.match(text, /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d/);
    assert.doesNotMatch(text, /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d|quarter past|half past|o'clock/);
    await s.close();
  });

  await t.test('Write my plan shows on Today for a Class educator, and not for the director or the office', async () => {
    for (const [n, pass, want] of [['Ann', '1357', true], ['Dee', 'director-pass-1', false], ['Gia', '1357', false]]) {
      const s = await signedIn(fx, b, n, pass);
      await s.p.evaluate(() => goView('today')); await s.p.waitForFunction(() => /Make documentation/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
      assert.strictEqual(/Write my plan/.test(await s.p.evaluate(() => document.querySelector('#main').innerText)), want, n);
      assert.deepStrictEqual(s.errors, []); await s.close();
    }
  });

  await t.test('the director\'s Educators pages sit under four tabs, every page two taps away, and the page starts on the first screen of a phone', async () => {
    for (const w of [360, 1280]) {
      const s = await signedIn(fx, b, 'Dee', 'director-pass-1', w);
      // on a phone a row of tabs that does not fit is one dropdown, opened before a tab inside it is tapped
      const tap = async sel => { await s.p.evaluate(q => { const b = document.querySelector(q); const d = b && b.closest('details.tabdrop'); if (d) d.open = true; }, sel); await s.p.click(sel); };
      await s.p.evaluate(() => goView('stteam')); await s.p.waitForSelector('#tsubnav .stgroups', { state: 'attached' });
      const groups = await s.p.$$eval('#tsubnav .stgroups button', bs => bs.map(x => x.textContent.trim()));
      assert.deepStrictEqual(groups, ['People', 'Growth', 'PD and Licensing', 'Records']);
      const seen = new Set();
      for (let g = 0; g < groups.length; g++) {
        await tap(`#tsubnav .stgroups button:nth-child(${g + 1})`); await s.p.waitForTimeout(400);
        const pages = await s.p.$$eval('#tsubnav .stpages button', bs => bs.map(x => x.dataset.tview));
        const cur = await s.p.evaluate(() => view); seen.add(cur);
        for (const v of pages) { await tap(`#tsubnav .stpages button[data-tview="${v}"]`); await s.p.waitForTimeout(300); seen.add(await s.p.evaluate(() => view)); }
      }
      for (const v of ['stteam', 'strec', 'stnew', 'stgrow', 'stplan', 'stjour', 'stci', 'stmom', 'stpd', 'stpdd', 'sthb', 'st27', 'stdrill', 'stfiles']) assert.ok(seen.has(v), w + ' ' + v);
      await s.p.evaluate(() => goView('stteam')); await s.p.waitForFunction(() => /Every educator/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
      const navBottom = await s.p.evaluate(() => document.querySelector('#tsubnav').getBoundingClientRect().bottom + window.scrollY);
      assert.ok(navBottom < (w === 360 ? 380 : 260), 'the tabs end at ' + navBottom);
      const cardTop = await s.p.evaluate(() => document.querySelector('#main section.card').getBoundingClientRect().top + window.scrollY);
      assert.ok(cardTop < 640, 'the page starts at ' + cardTop);
      assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepStrictEqual(s.errors, []); await s.close();
    }
  });

  await t.test('tabs use the full page names, the same words as the page title', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('st27')); await s.p.waitForFunction(() => /Coming October 1, 2027/.test(document.querySelector('#main h2') && document.querySelector('#main h2').textContent), null, { timeout: 10000 });
    const tabs = await s.p.$$eval('#tsubnav .stpages button', bs => bs.map(x => x.textContent.trim()));
    assert.ok(tabs.includes('Coming October 1, 2027') && tabs.includes('Teacher Policies and Procedures'), tabs.join(', '));
    await s.p.click('#tsubnav .stpages button[data-tview="sthb"]'); await s.p.waitForFunction(() => /Teacher Policies and Procedures/.test(document.querySelector('#main h2') && document.querySelector('#main h2').textContent), null, { timeout: 10000 });
    await s.close();
    const a = await signedIn(fx, b, 'Ann', '1357');
    await a.p.evaluate(() => goView('sthb')); await a.p.waitForSelector('#tsubnav');
    const mine = await a.p.$$eval('#tsubnav button.sub', bs => bs.map(x => x.textContent.trim()));
    assert.ok(mine.includes('Teacher Policies and Procedures'), mine.join(', ')); assert.ok(!mine.includes('Policies'));
    await a.close();
  });

  await t.test('the check-in has five parts in order, then After the check-in, and an earlier check-in keeps every answer', async () => {
    for (const w of [360, 1280]) {
      const s = await signedIn(fx, b, 'Dee', 'director-pass-1', w);
      await s.p.evaluate(() => goView('stci')); await s.p.waitForSelector('[data-gci="Bea"]', { timeout: 10000 });
      await s.p.click('[data-gci="Bea"]'); await s.p.waitForFunction(() => /After the check-in/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
      const heads = await s.p.$$eval('#main section.card h3', hs => hs.map(h => h.textContent.trim()));
      const want = ['Professional temperature', 'Plus delta', 'Growth Plan check', 'One support', 'Focus Until Next Time', 'Earlier answers', 'After the check-in'];
      const at = want.map(x => heads.findIndex(h => h.startsWith(x)));
      assert.ok(at.every(i => i >= 0) && at.every((x, i) => !i || x > at[i - 1]), heads.join(' | '));
      const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
      assert.ok(!heads.some(h => /^(One challenge|Curriculum, environment and child goals|Team alignment|Follow-up notes|Check-in effectiveness)/.test(h)), heads.join(' | '));
      assert.match(text, /The garden beds/); assert.match(text, /Rainy days indoors/);
      const after = await s.p.evaluate(() => [...document.querySelectorAll('#main section.card')].find(c => /After the check-in/.test(c.querySelector('h3').textContent)).innerText);
      assert.match(after, /Follow-up notes/); assert.match(after, /Team alignment/); assert.match(after, /Check-in effectiveness/);
      if (w === 1280) {
        await s.p.fill('[data-gcf="goalsLine"]', 'Both goals moving');
        await s.p.click('[data-gcsave]'); await s.p.waitForTimeout(2500);
        const g = JSON.parse(require('fs').readFileSync(require('path').join(fx.dir, 'staff/growth/bea.json'), 'utf8')).checkins[0];
        assert.strictEqual(g.work, 'The garden beds'); assert.strictEqual(g.challenge, 'Rainy days indoors'); assert.strictEqual(g.align.note, 'More shared planning time');
        assert.strictEqual(g.goals.g1, 'Halfway there'); assert.strictEqual(g.goalsLine, 'Both goals moving'); assert.strictEqual(g.followup, 'Order the easel');
      }
      assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepStrictEqual(s.errors, []); await s.close();
    }
  });

  await t.test('the director, a Class educator and the kitchen open their pages at phone width and on a desktop with no errors and no sideways scroll', async () => {
    const who = [['Dee', 'director-pass-1', ['today', 'moments', 'stteam', 'stci', 'calendar']], ['Ann', '1357', ['today', 'moments', 'stci', 'sthb', 'calendar']], ['Kit', '1357', ['kitchen', 'today', 'calendar']]];
    for (const w of [360, 1280]) for (const [n, pass, views] of who) {
      const s = await signedIn(fx, b, n, pass, w);
      for (const v of views) {
        await s.p.evaluate(v => goView(v), v); await s.p.waitForTimeout(1200);
        assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${n} ${v} ${w}`);
        const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
        assert.doesNotMatch(text, /quarter past|half past|o'clock|[—–]/, `${n} ${v} ${w}`);
      }
      if (n === 'Kit') assert.doesNotMatch(await s.p.evaluate(() => document.body.innerText), /Write my plan|Proofread observations/);
      assert.deepStrictEqual(s.errors, [], `${n} ${w}`); await s.close();
    }
  });
});
