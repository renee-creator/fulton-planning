'use strict';
// Session 27. A PD printable of kind visual prints as one page, one idea, large type and white space. The lead sits under
// the title in a quiet line, each "### Heading" becomes a tinted panel side by side with its labelled parts, and a Footer
// paragraph sits small at the foot. The sheet scales its type in steps so it stays one page. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), os = require('os');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

const SAMPLE = require('../once/s27-visual-sample.json').changes[0].to.split('\n## ').slice(1).map(x => '## ' + x).find(x => /kind: visual/.test(x));
const PRINTABLES = '<!--\nmodule: documentation\n-->\n# Printables for Documentation\n\n## I notice, I wonder\nkind: card\nWhat do you notice?\n\n- One.\n- Two.\n\n' + SAMPLE + '\n';

test('a visual printable is listed as Visual, builds a cols block and prints one page', async t => {
  const fx = await start({ more: put => put('staff/pd/printables/documentation.md', PRINTABLES) });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const m = (await fx.as(dee, '/api/staff/g/modules', {})).body.modules.documentation;
  const x = m.printables.list.find(p => p.kind === 'visual');
  assert.ok(x, 'the visual kind is accepted'); assert.strictEqual(x.title, 'Four ways children take in the world');
  assert.doesNotMatch(x.body, /^\s*kind\s*:/m, 'the kind line is taken out of the body');

  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1280); t.after(() => s.close());
  await s.p.evaluate(() => goView('stpd')); await wait(2500);
  await s.p.evaluate(() => { const L = [...document.querySelectorAll('[data-stmod="m:documentation"]')]; L[L.length - 1].click(); });
  await s.p.waitForSelector('button[data-gmprint]', { timeout: 15000, state: 'attached' });
  const labels = await s.p.evaluate(() => [...document.querySelectorAll('details.strow summary .cnt')].map(e => e.textContent.trim()));
  assert.deepStrictEqual(labels, ['Card', 'Visual']);

  // the module page's own PDF button builds the document, caught here before the file is made
  await s.p.evaluate(id => { window.__made = []; window.__realMakePdf = window.makePdf; window.makePdf = async (list, name) => { __made.push({ name, list }); };
    document.querySelector('button[data-gmprint="documentation|' + id + '"]:not([data-word])').click(); }, x.id); await wait(1500);
  const r = await s.p.evaluate(async ([m, x]) => {
    window.makePdf = window.__realMakePdf; if (__made.length !== 1 || __made[0].list.length !== 1) throw new Error('one document expected, got ' + JSON.stringify(__made.map(z => z.name)));
    const d = __made[0].list[0];
    const cols = d.blocks.find(b => b.t === 'cols');
    if (!window.jspdf) await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf, 'jspdf');
    const blob = await makePdf([d], 'visual.pdf', 'quiet');
    const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    const doc = planDoc({ unit: 'pt', format: 'letter' }); const F = displayFit(doc, d, ACC.story);
    return { d, kinds: d.blocks.map(b => b.t), cols, pages: F.F.pages.length, scale: F.s, end: F.F.end, bottom: DG.bottom, b64 };
  }, [m, x]);
  assert.ok(r.d.visual && r.d.display && r.d.type === 'report' && r.d.acc === 'story');
  assert.deepStrictEqual(r.kinds, ['text', 'small', 'cols', 'small']);
  assert.ok(r.d.blocks[0].quiet); assert.match(r.d.blocks[0].text, /^A lens for wondering/); assert.strictEqual(r.d.blocks[1].text, m.title);
  assert.match(r.d.blocks[3].text, /^Adapted from the Early Learning Institute/);
  assert.strictEqual(r.cols.cols.length, 4);
  assert.deepStrictEqual(r.cols.cols.map(c => c.h), ['Active and driving', 'Highly sensitive', 'Slow to warm', 'Under responsive']);
  for (const c of r.cols.cols) { assert.deepStrictEqual(c.parts.map(p => p.label), ['What you see', 'How it may feel', 'What helps']); for (const p of c.parts) assert.doesNotMatch(p.text, /\*\*/); }
  assert.strictEqual(r.pages, 1, 'one page'); assert.ok(r.end <= r.bottom, 'the grid stays above the foot'); assert.ok(r.scale >= .8, 'type stays at 8pt or above');
  const out = process.env.VISUAL_PDF_OUT || path.join(os.tmpdir(), 's27-visual.pdf');
  fs.writeFileSync(out, Buffer.from(r.b64, 'base64'));
  assert.ok(fs.statSync(out).size > 1000);
  assert.deepStrictEqual(s.errors, []);
});

test('the one-time step adds the sample after the last line of the live page, and the kind reaches the records', () => {
  const list = require('../once/s27-visual-sample.json');
  assert.strictEqual(list.changes.length, 1); const c = list.changes[0];
  assert.strictEqual(c.path, 'staff/pd/printables/beyond.md'); assert.ok(c.to.startsWith(c.from + '\n\n## Four ways children take in the world\nkind: visual\n'));
  assert.doesNotMatch(c.to, /[—–;]|\bteacher\b|\bClaude\b/);
  const g = fs.readFileSync(path.join(__dirname, '..', 'growth.js'), 'utf8'); assert.match(g, /card\|sheet\|sign\|visual/);
  const sa = fs.readFileSync(path.join(__dirname, '..', 'src', 'staff-app.js'), 'utf8'); assert.match(sa, /b\.t==="cols"/);
  const src = fs.readFileSync(path.join(__dirname, '..', 'staff.js'), 'utf8'); assert.ok(src.indexOf('s27Visual:') > src.indexOf('s26Anchors:'));
  const sv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'); assert.ok(sv.indexOf("ONCE.push(['s27Visual'") > sv.indexOf("ONCE.push(['s26Anchors'"));
});
