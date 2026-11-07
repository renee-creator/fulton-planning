#!/usr/bin/env node
'use strict';
/* A walk through TREE as the people who use it, for the morning check-up. It starts TREE on a small made-up school, the
   same kind the tests use, so no child's, family's or educator's record is ever read. Every name here is invented.

   It signs in as an educator on a phone, the director on a laptop and the kitchen on a tablet. On each page they reach
   it checks what people feel: a page wider than the screen, buttons too small to tap, buttons with no name a screen
   reader can say, very small text, errors in the page, and pages slow to draw. Then it does a few everyday tasks the way
   a person would, by tapping what is on the screen, and counts the taps: keeping an observation, finding a child,
   opening this week's plan and the calendar. A task it cannot finish by tapping is a finding too.

   Run from the repository folder:  node tools/user-walk.js [output folder]
   It writes walk-report.json, walk-report.md and a screenshot of every page into the folder, default ./user-walk. */
const fs = require('fs'), path = require('path');
const { start } = require('../test/fixture.js');

const OUT = path.resolve(process.argv[2] || 'user-walk');
const DAY = 864e5;
const PAGES = {
  educator: ['today', 'moments', 'plans', 'all', 'threads', 'projects', 'lens', 'children', 'conferences', 'calendar', 'stories', 'slides', 'bin', 'ideabank', 'recipes', 'songs'],
  director: ['today', 'moments', 'plans', 'children', 'conferences', 'calendar', 'settings'],
  kitchen: ['kitchen', 'today', 'calendar'],
};
const PEOPLE = [
  { role: 'educator', name: 'Ann', pass: '1357', device: 'phone', viewport: { width: 390, height: 844 }, touch: true },
  { role: 'director', name: 'Dee', pass: 'director-pass-1', device: 'laptop', viewport: { width: 1280, height: 800 } },
  { role: 'kitchen', name: 'Kit', pass: '1357', device: 'tablet', viewport: { width: 820, height: 1180 }, touch: true },
];

// a made-up school with enough in it to look like a real week
function school(put) {
  const now = Date.now();
  const kids = [['Lark', 'One', 'West'], ['Moss', 'Two', 'West'], ['Fern', 'Three', 'West'], ['Reed', 'Four', 'North'], ['Sky', 'Five', 'North'], ['Wren', 'Six', 'North']];
  kids.forEach(([first, last, room], i) => put(`children/w${i}.json`, { id: 'w' + i, first, last, classroom: room, status: 'active', birth: '2022-0' + (i + 1) + '-10' }));
  const words = ['poured water slowly over the stones and watched the color change.', 'stacked three blocks on the stump and counted them.', 'carried the plank to the ramp and set it beside the first one.', 'dug by the fence looking for the worm from yesterday.', 'sang the rain song while painting the sky blue.'];
  for (let i = 0; i < 10; i++) { const [first, , room] = kids[i % kids.length];
    put(`notices/wn${i}.json`, { id: 'wn' + i, at: now - i * DAY / 2, classroom: room, by: room === 'West' ? 'Ann' : 'Bea', noticed: first + ' ' + words[i % words.length], wonder: i % 3 ? '' : 'I wonder what will happen with more water.', children: ['w' + (i % kids.length)] }); }
  // the week TREE opens, as planWeekNow in src/app.html reckons it, with Saturday and Sunday opening the coming week
  const d0 = new Date(now), base = d0.getDay() === 6 || d0.getDay() === 0 ? new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 2) : d0;
  const m = new Date(base.getFullYear(), base.getMonth(), base.getDate() - (base.getDay() + 6) % 7);
  const monday = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0') + '-' + String(m.getDate()).padStart(2, '0');
  put('plans/wp1.json', { id: 'wp1', type: 'classroom', classroom: 'West', weekOf: monday, educator: 'Ann', status: 'draft', fields: { intentions: 'Water and weight' }, createdAt: now - DAY, updatedAt: now - DAY });
}

// what a person feels on the page in front of them
async function pageChecks(p, touch) {
  const top = await checksIn(p, touch);
  // Calendar and Conferences are drawn inside a frame, so the page in the frame is checked too and counted with the rest
  const fr = await p.$('iframe.embed');
  if (fr) { const f = await fr.contentFrame(); if (f) { try { await f.waitForLoadState('load', { timeout: 10000 }); await p.waitForTimeout(800); const inner = await checksIn(f, touch, true);
    for (const k of ['smallTargets', 'unnamedButtons', 'unlabeledFields', 'tinyText', 'clipped', 'overlap', 'buttons', 'words']) top[k] += inner[k];
    top.wider = top.wider || inner.wider; top.smallSample = [...new Set([...top.smallSample, ...inner.smallSample])].slice(0, 5); top.clippedSample = [...top.clippedSample, ...inner.clippedSample].slice(0, 3); top.overlapSample = [...top.overlapSample, ...inner.overlapSample].slice(0, 3); top.framed = true;
  } catch (e) { top.frameError = e.message.split('\n')[0]; } } }
  return top;
}
// the checks run in a page or in a frame within it. In a frame the whole of its page is looked at, not only #main.
async function checksIn(p, touch, inFrame) {
  return p.evaluate(([touch, inFrame]) => {
    const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]') && (!el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })); };
    const label = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
    const controls = [...document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, textarea')].filter(vis);
    const min = touch ? 32 : 24;
    const small = controls.filter(el => { const r = el.getBoundingClientRect(); return (r.width < min || r.height < min) && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !el.closest('p, li, .cnt'); });
    const unnamed = controls.filter(el => /^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button').filter(el => !label(el) && !el.querySelector('img[alt]:not([alt=""])'));
    const fields = controls.filter(el => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !['button', 'submit', 'checkbox', 'radio', 'file'].includes(el.type)).filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('placeholder') && !el.getAttribute('title'));
    const root = (!inFrame && document.querySelector('#main')) || document.body;
    let tiny = 0; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) { const n = tw.currentNode; if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue; if (parseFloat(getComputedStyle(n.parentElement).fontSize) < 12) tiny++; }
    // formatting. Text cut off in its box, and buttons drawn over one another.
    const clipped = [...root.querySelectorAll('*')].filter(el => { if (!vis(el) || el.children.length || !el.textContent.trim()) return false; const s = getComputedStyle(el);
      return s.textOverflow !== 'ellipsis' && /hidden|clip/.test(s.overflowX + s.overflow) && el.scrollWidth > el.clientWidth + 2; });
    // the tab bar and the round button stay put while the page scrolls under them, which is meant, so they are left out
    const fixed = el => { for (let x = el; x && x !== document.body; x = x.parentElement) if (/fixed|sticky/.test(getComputedStyle(x).position)) return true; return false; };
    const rects = controls.filter(el => /^(BUTTON|A)$/.test(el.tagName) && !fixed(el)).map(el => [el, el.getBoundingClientRect()]);
    let overlap = 0; const overlapSample = [];
    for (let i = 0; i < rects.length; i++) for (let k = i + 1; k < rects.length; k++) { const [a, ra] = rects[i], [b, rb] = rects[k]; if (a.contains(b) || b.contains(a)) continue;
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 4 && h > 4) { overlap++; if (overlapSample.length < 3) overlapSample.push(label(a).slice(0, 25) + ' / ' + label(b).slice(0, 25)); } }
    // a way back from a page opened from somewhere
    const back = controls.some(el => /^\s*(‹\s*)?Back\b/i.test(label(el)));
    const text = root.innerText || '';
    return {
      wider: document.documentElement.scrollWidth > window.innerWidth + 2,
      smallTargets: small.length, smallSample: [...new Set(small.map(label).filter(Boolean))].slice(0, 5),
      unnamedButtons: unnamed.length, unlabeledFields: fields.length, tinyText: tiny,
      buttons: controls.filter(el => /^(BUTTON|A)$/.test(el.tagName)).length, words: text.split(/\s+/).filter(Boolean).length,
      clipped: clipped.length, clippedSample: clipped.slice(0, 3).map(el => el.textContent.trim().slice(0, 40)), overlap, overlapSample, back,
      height: Math.round(document.documentElement.scrollHeight / window.innerHeight * 10) / 10,
    };
  }, [!!touch, !!inFrame]);
}

// tap the first thing on screen whose words match, the way a person looks for it
async function tap(p, re, log) {
  const el = await p.evaluateHandle(src => { const re = new RegExp(src, 'i');
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[hidden]') && (!el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })); };
    return [...document.querySelectorAll('button, a, [role=button], [data-go], summary, .chip')].filter(vis).find(el => re.test((el.getAttribute('aria-label') || '') + ' ' + el.textContent)) || null; }, re.source);
  const found = await el.evaluate(x => !!x);
  if (!found) { log.missing = re.source; return false; }
  // a button a person could not press, under another or off the screen, counts as not found
  try { await el.asElement().click({ timeout: 3000 }); } catch (e) { log.missing = re.source + ' (on screen but could not be pressed)'; return false; }
  log.taps++; await p.waitForTimeout(500); return true;
}

// the tab each page sits under, and the words on its own button once that tab is open
const HOME = { moments: ['Observations'], plans: ['Plans', 'This week'], all: ['Plans', 'All plans'], threads: ['Plans', 'Threads'], projects: ['Plans', 'Projects'], lens: ['Plans', 'Lens'],
  bin: ['Plans', 'Weekly bin'], ideabank: ['Plans', 'Planning resources', 'Idea bank'], recipes: ['Plans', 'Planning resources', 'Recipes'], songs: ['Plans', 'Planning resources', 'Songs and stories'],
  children: ['Children', 'Children'], conferences: ['Children', 'Conferences'], calendar: ['Calendar'], stories: ['Documentation', 'Stories'], slides: ['Documentation', 'Slides'], settings: ['Settings'], kitchen: ['Kitchen'] };
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// how a person gets from Today to a page by tapping, with the page picker opened when the page's own button is inside it
async function reach(p, v) {
  const log = { taps: 0 }; await p.evaluate(() => goView('today')); await p.waitForTimeout(400);
  for (const word of HOME[v] || []) {
    if (await p.evaluate(v => view === v, v)) break;
    // a list already open is not tapped again, which would close it
    if (await p.evaluate(word => [...document.querySelectorAll('#main details[open] > summary')].some(x => x.textContent.trim() === word), word)) continue;
    if (await tap(p, new RegExp('^\\s*' + esc(word) + '(\\s*\\d+\\s+pages?)?\\s*$'), log)) continue;
    // the page picker at the top of a tab, a closed list naming the page open now
    delete log.missing;
    // the closed list that holds the page's button, as a person would look for it
    const opened = await p.evaluate(word => { const has = el => [...el.querySelectorAll('button, a, summary')].some(b => b.textContent.trim().replace(/\d+ pages?$/, '').trim() === word);
      const d = [...document.querySelectorAll('#main details:not([open])')].filter(x => x.querySelector(':scope > summary') && x.querySelector(':scope > summary').getBoundingClientRect().height > 0).find(has);
      if (d) { d.querySelector(':scope > summary').click(); return true; } return false; }, word);
    if (opened) { log.taps++; await p.waitForTimeout(400); if (await tap(p, new RegExp('^\\s*' + esc(word) + '(\\s*\\d+\\s+pages?)?\\s*$'), log)) continue; }
    break;
  }
  const reached = await p.evaluate(v => view === v, v), out = { page: v, reached, taps: log.taps, stuckAt: log.missing || '' };
  // when the page was not reached, what was on the screen, for the agent to look at before saying so
  if (!reached && p._walkOut) { out.shot = `${p._walkRole}-reach-${v}.png`; await p.screenshot({ path: path.join(p._walkOut, out.shot) });
    out.onScreen = await p.evaluate(() => [...document.querySelectorAll('#main button, #main summary, #main a')].filter(el => el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true).map(el => el.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30)); }
  return out;
}

const TASKS = {
  educator: [
    { name: 'Keep an observation from Today', run: async (p, log) => {
      await p.evaluate(() => goView('today')); await p.waitForTimeout(500);
      const before = await p.evaluate(() => notices.size);
      if (!(await tap(p, /Keep an observation/, log))) return false;
      const box = await p.$('#main textarea'); if (!box) { log.missing = 'a box to write in'; return false; }
      await box.click(); log.taps++; await box.fill('The children watched the rain run down the window and traced it with a finger.');
      if (!(await tap(p, /^\s*Keep this observation\s*$/, log))) return false;
      await p.waitForTimeout(1200); return (await p.evaluate(() => notices.size)) > before; } },
    { name: 'Find a child and open their page', run: async (p, log) => {
      await p.evaluate(() => goView('today')); await p.waitForTimeout(500);
      if (!(await tap(p, /^\s*Children\s*$/, log))) return false;
      // the Children tab opens where it was last left, so the Children button inside it is tapped when it shows
      if (!(await p.evaluate(() => view === 'children'))) { if (!(await tap(p, /^\s*Children\s*$/, log))) return false; }
      if (!(await tap(p, /Lark/, log))) return false;
      return p.evaluate(() => view === 'child'); } },
    { name: "Open this week's plan", run: async (p, log) => {
      await p.evaluate(() => goView('today')); await p.waitForTimeout(500);
      const r = await reach(p, 'plans'); log.taps += r.taps; if (!r.reached) { log.missing = r.stuckAt || 'This week'; return false; }
      if (!(await tap(p, /Water and weight|Classroom plan/, log))) return false;
      // the plan already written for this week, not a new one started by mistake
      const id = await p.evaluate(() => currentId); if (id !== 'wp1') { log.missing = "this week's plan, a new one was started instead"; return false; } return true; } },
    { name: 'See what is on the calendar today', run: async (p, log) => {
      await p.evaluate(() => goView('today')); await p.waitForTimeout(500);
      if (!(await tap(p, /^\s*Calendar\s*$/, log))) return false;
      return p.evaluate(() => view === 'calendar'); } },
  ],
  director: [
    { name: 'Open the Program watch in Settings', run: async (p, log) => {
      await p.evaluate(() => goView('today')); await p.waitForTimeout(500);
      if (!(await tap(p, /^\s*Settings\s*$/, log))) return false;
      if (!(await tap(p, /Program watch/, log))) return false;
      return p.evaluate(() => !!document.querySelector('#watchcard')); } },
  ],
  kitchen: [],
};

(async () => {
  let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.error('Playwright is not installed here, so the walk cannot run.'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const fx = await start({ more: school }); const browser = await chromium.launch();
  const report = { at: new Date().toISOString(), people: [] };
  try {
    for (const who of PEOPLE) {
      const j = await fx.login(who.name, who.pass);
      if (!j || !j.token) { report.people.push({ role: who.role, error: 'could not sign in' }); continue; }
      const ctx = await browser.newContext({ viewport: who.viewport, hasTouch: !!who.touch, isMobile: who.device === 'phone' });
      const p = await ctx.newPage(); p._walkOut = OUT; p._walkRole = who.role; const errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.addInitScript(([t, n, d]) => { localStorage.setItem('fp-token', t); localStorage.setItem('fp-name', n); localStorage.setItem('fp-director', d ? '1' : ''); }, [j.token, j.name, !!j.director]);
      const t0 = Date.now(); await p.goto(fx.page); await p.waitForFunction(() => typeof goView === 'function' && window.FP_NAME && window.FP_NAME(), null, { timeout: 20000 }); await p.waitForTimeout(1500);
      const person = { role: who.role, device: who.device, openMs: Date.now() - t0, pages: [], tasks: [] };
      for (const v of PAGES[who.role]) {
        const e0 = errors.length, s = Date.now();
        await p.evaluate(v => goView(v), v); await p.waitForTimeout(700); const drawMs = Date.now() - s - 700;
        const where = await p.evaluate(() => view);
        const c = await pageChecks(p, who.touch);
        const shot = `${who.role}-${v}.png`; await p.screenshot({ path: path.join(OUT, shot), fullPage: false });
        person.pages.push(Object.assign({ page: v, reached: where === v ? v : where, drawMs, errors: errors.slice(e0), shot }, c));
      }
      // how many taps each page is from Today. Each tab first opens where it was last left, so this runs after the visits.
      person.reach = [];
      for (const v of PAGES[who.role]) if (v !== 'today' && HOME[v]) person.reach.push(await reach(p, v));
      for (const task of TASKS[who.role]) {
        const log = { taps: 0 }, s = Date.now(); let ok = false;
        try { ok = await task.run(p, log); } catch (e) { log.error = e.message.split('\n')[0]; }
        const shot = `${who.role}-task-${task.name.toLowerCase().replace(/[^a-z]+/g, '-')}.png`; await p.screenshot({ path: path.join(OUT, shot) });
        person.tasks.push({ name: task.name, done: !!ok, taps: log.taps, ms: Date.now() - s, stuckAt: log.missing || log.error || '', shot });
      }
      person.errors = [...new Set(errors)];
      report.people.push(person); await ctx.close();
    }
  } finally { await browser.close(); await fx.stop(); }

  // what the walk found, plainly, for the agent to read and look into
  const found = [];
  for (const who of report.people) {
    if (who.error) { found.push(`The ${who.role} ${who.error}.`); continue; }
    for (const g of who.pages) {
      const at = `the ${g.page} page for the ${who.role} on a ${who.device}`;
      if (g.reached !== g.page) found.push(`Going to ${at} landed on ${g.reached} instead.`);
      if (g.wider) found.push(`${at} is wider than the screen, so it scrolls sideways.`);
      if (g.smallTargets >= 5) found.push(`${at} has ${g.smallTargets} buttons smaller than a fingertip${g.smallSample.length ? `, such as ${g.smallSample.map(s => '"' + s.slice(0, 30) + '"').join(', ')}` : ''}.`);
      if (g.unnamedButtons) found.push(`${at} has ${g.unnamedButtons} buttons with no name a screen reader can say.`);
      if (g.unlabeledFields) found.push(`${at} has ${g.unlabeledFields} boxes to fill with no label.`);
      if (g.tinyText >= 10) found.push(`${at} has ${g.tinyText} pieces of text smaller than 12 pixels.`);
      if (g.drawMs > 1500) found.push(`${at} took ${(g.drawMs / 1000).toFixed(1)} seconds to draw.`);
      if (g.height > 8) found.push(`${at} is ${g.height} screens long.`);
      if (g.clipped) found.push(`${at} has ${g.clipped} pieces of text cut off in their box${g.clippedSample.length ? `, such as "${g.clippedSample[0]}"` : ''}.`);
      if (g.overlap) found.push(`${at} has ${g.overlap} buttons drawn over one another${g.overlapSample.length ? `, such as ${g.overlapSample[0]}` : ''}.`);
      if (g.errors.length) found.push(`${at} had an error in the page: ${g.errors[0].slice(0, 120)}.`);
    }
    for (const r of who.reach || []) {
      if (!r.reached) found.push(`The ${who.role} could not reach the ${r.page} page from Today by tapping (check ${r.shot})${r.stuckAt ? `, nothing on screen matched ${r.stuckAt.replace(/\\s\*|\^|\$|\(.*\)\?/g, '')}` : ''}.`);
      else if (r.taps >= 4) found.push(`The ${who.role} needs ${r.taps} taps to reach the ${r.page} page from Today.`);
    }
    for (const t of who.tasks) {
      if (!t.done) found.push(`The ${who.role} could not ${t.name.toLowerCase()} by tapping (check ${t.shot})${t.stuckAt ? `. Nothing on screen matched ${t.stuckAt}` : ''}.`);
      else if (t.taps > 5) found.push(`The ${who.role} needed ${t.taps} taps to ${t.name.toLowerCase()}.`);
    }
  }
  report.found = found;
  fs.writeFileSync(path.join(OUT, 'walk-report.json'), JSON.stringify(report, null, 2));
  const md = ['# Walk through TREE as its users', '', `Made-up school, ${report.at}.`, '', '## What was found', '', ...(found.length ? found.map(f => '- ' + f) : ['- Nothing stood out.']), '',
    '## Tasks', '', '| Who | Task | Done | Taps | Seconds | Stuck at |', '|---|---|---|---|---|---|',
    ...report.people.flatMap(w => (w.tasks || []).map(t => `| ${w.role} | ${t.name} | ${t.done ? 'yes' : 'no'} | ${t.taps} | ${(t.ms / 1000).toFixed(1)} | ${t.stuckAt || ''} |`)), '',
    '## Getting around, taps from Today', '', '| Who | Page | Reached | Taps |', '|---|---|---|---|',
    ...report.people.flatMap(w => (w.reach || []).map(r => `| ${w.role} | ${r.page} | ${r.reached ? 'yes' : 'no'} | ${r.taps} |`)), '',
    '## Pages', '', '| Who | Page | Draw ms | Wider | Small buttons | Unnamed | Tiny text | Cut off | Overlap | Screens long | Buttons |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...report.people.flatMap(w => (w.pages || []).map(g => `| ${w.role} | ${g.page} | ${g.drawMs} | ${g.wider ? 'yes' : ''} | ${g.smallTargets} | ${g.unnamedButtons} | ${g.tinyText} | ${g.clipped} | ${g.overlap} | ${g.height} | ${g.buttons} |`)), ''];
  fs.writeFileSync(path.join(OUT, 'walk-report.md'), md.join('\n'));
  console.log(md.slice(0, 6 + found.length).join('\n'));
  console.log('\nScreenshots and the full report are in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
