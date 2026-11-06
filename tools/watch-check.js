#!/usr/bin/env node
'use strict';
/* The checks the program's monitoring agent runs each day on the code, beside what the server's own program watch saw.
   It changes nothing in the repository. Run from the repository folder with  node tools/watch-check.js
   Set WATCH_KEY to read the server's report, and TREE_SERVER for another server than the one on Render.
   It prints a JSON summary, and exits 1 when something needs correcting. */
const fs = require('fs'), path = require('path'), { execFileSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SERVER = (process.env.TREE_SERVER || 'https://fulton-planning.onrender.com').replace(/\/+$/, '');
const out = { at: new Date().toISOString(), checks: [] };
const add = (name, ok, detail, plan) => out.checks.push({ name, ok, detail, plan: ok ? undefined : plan });

function git(...a) { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { return ''; } }

(async () => {
  // every script parses
  const bad = [];
  for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.js')).concat(fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f))) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' }); if (r.status !== 0) bad.push(f + ': ' + String(r.stderr).split('\n').find(l => /Error/.test(l)));
  }
  add('Every script parses', !bad.length, bad.join('\n') || 'All scripts parse.', ['Open the file named and correct the syntax error.', 'Run npm test before sending the change.']);

  // the generated pages match src, so what GitHub Pages serves is what was written
  const before = git('status', '--porcelain');
  const b = spawnSync('python3', [path.join(ROOT, 'tools/build.py')], { cwd: ROOT, encoding: 'utf8' });
  const changed = git('status', '--porcelain').split('\n').filter(l => l && !before.split('\n').includes(l)).map(l => l.slice(3));
  if (changed.length) git('checkout', '--', ...changed);
  add('Generated pages match src', b.status === 0 && !changed.length, b.status !== 0 ? String(b.stderr).slice(-400) : changed.length ? 'Out of date: ' + changed.join(', ') : 'tree.html, index.html and the pages loaded later match src.',
    ['Run python3 tools/build.py and commit the files it writes with the change to src.']);

  // the page every phone loads first, and how it has grown in the last month
  const size = f => { try { return fs.statSync(path.join(ROOT, f)).size; } catch (e) { return 0; } };
  const kb = n => Math.round(n / 1024) + ' KB';
  const page = size('tree.html'), oldRev = git('rev-list', '-1', '--before=30 days ago', 'HEAD');
  let old = 0; if (oldRev) { const t = git('cat-file', '-s', oldRev + ':tree.html'); old = Number(t) || 0; }
  const grew = old ? (page - old) / old : 0;
  add('The first page stays light', page < 3 * 1024 * 1024 && grew < 0.25, `tree.html is ${kb(page)}${old ? `, ${kb(old)} a month ago` : ''}.`,
    ['Find what grew with git log -p on src/app.html for the last month.', 'Move a section used rarely into a page loaded when opened, the way Settings and the Educators pages are, in tools/lazy.py.']);

  // the server's health and its program watch, with names already taken out
  try {
    const h = await (await fetch(SERVER + '/health', { signal: AbortSignal.timeout(60000) })).json();
    add('The server answers', !!h.ok && h.ready !== false && !h.saveError, h.saveError || h.saveWarn || (h.ready ? 'Running and the records are loaded.' : 'Running, the records still loading.'),
      ['Open the server log on Render.', 'Check GITHUB_TOKEN on Render has not expired.']);
  } catch (e) { add('The server answers', false, 'The server could not be reached: ' + e.message, ['Open the service on Render and see whether it is running or failed to deploy.']); }
  if (process.env.WATCH_KEY) {
    try {
      const r = await fetch(SERVER + '/watch/report', { headers: { 'x-tree-key': process.env.WATCH_KEY }, signal: AbortSignal.timeout(60000) });
      if (r.status !== 200) throw new Error('the server answered ' + r.status);
      out.watch = await r.json();
      add('The program watch in the server', !(out.watch.findings || []).length, (out.watch.findings || []).length + ' findings from the last day.', ['See the findings below, each with its own plan.']);
    } catch (e) { add('The program watch in the server', false, 'The report could not be read: ' + e.message, ['Check WATCH_KEY is the same on Render and for the monitoring agent.']); }
  } else out.watch = null;

  // what changed in the last day, for the agent to read
  out.recentCommits = git('log', '--since=26 hours ago', '--pretty=%h %s').split('\n').filter(Boolean);
  out.ok = out.checks.every(c => c.ok);
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = out.ok ? 0 : 1;
})();
