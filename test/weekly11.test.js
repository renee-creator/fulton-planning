'use strict';
// The week's reading reads threads, the lens and observations for the whole school and for each Class, and reads each
// active project and open team inquiry for observations that may belong. Only the director runs it, so an educator
// asking for a project or inquiry reading is turned away. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { start } = require('./fixture.js');

test('only the director runs the project and inquiry readings', async t => {
  const fx = await start(); t.after(() => fx.stop());
  const { token } = await fx.login('Ann', '1357');
  const ask = async body => { const r = await fetch(fx.api + '/api/read', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  for (const purpose of ['project-find', 'inquiry-find']) {
    const r = await ask({ purpose, content: [{ type: 'text', text: 'x' }] });
    assert.strictEqual(r.status, 403, purpose);
    assert.doesNotMatch(r.body.error || '', /Claude|Anthropic/);
  }
});

test('the week\'s reading covers each Class, observations, projects and inquiries', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  const steps = src.slice(src.indexOf('function weeklySteps('), src.indexOf('async function weeklyStep('));
  assert.match(steps, /\["All",\.\.\.CLASSROOMS\]/, 'the whole school and each Class');
  for (const k of ['threads|', 'lens|', 'moments|', 'project|', 'inquiry|']) assert.ok(steps.includes('"' + k + '"'), k);
  assert.ok(src.includes('((x.found||{}).items)'), 'a project lists what the reading found in its one list');
  assert.match(src, /foundHtml\("inquiry",x\)/);
});

test('observations come into readings fairly, once per post, with their photo as context', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  assert.match(src, /room==="none"\?!momentRooms\(n\)\.length/, 'No class means no class at all, chosen or from the children');
  assert.match(src, /function noticeOwnRoom/, 'an observation takes the class its tagged children share');
  assert.match(src, /shareRoom\(onePerPost\(ps\),160\)/, 'Find threads reads each post once and keeps room for observations');
  assert.match(src, /shareRoom\(onePerPost\(\[\.\.\.ps\]\),160\)/, 'the lens does the same');
  assert.strictEqual((src.match(/\$\{PHOTO_RULE\}/g) || []).length, 4, 'every reading is told the photo note is context only');
  assert.match(src, /async function photoNoteAuto/);
});
