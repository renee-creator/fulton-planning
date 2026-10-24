'use strict';
// the Teacher Policies and Procedures and the Family Handbook in a browser, against the made-up school in fixture.js
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const more = put => {
  put('staff/policies/teacher.json', { title: 'Teacher Policies and Procedures', edition: '2025', mustRead: ['arrival'], parts: [
    { id: 'arrival', title: 'Arrival', sections: [{ id: 'arrival' }] }, { id: 'codes', title: 'Codes', sections: [{ id: 'codes' }] },
    { id: 'routines', title: 'Routines', sections: [{ id: 'lunch' }, { id: 'a-section', ref: 'staff/handbook/a-section.json' }] }] });
  put('staff/policies/teacher/arrival.json', { id: 'arrival', title: 'Arrival', body: 'Greet each family.\n\n- Wash hands\n  - With soap\n\n| Day | Who |\n|---|---|\n| Monday | The greeter |', history: [] });
  put('staff/policies/teacher/codes.json', { id: 'codes', title: 'Codes', body: 'The door code is SECRET.', history: [], directorOnly: true });
  put('staff/policies/teacher/lunch.json', { id: 'lunch', title: 'Lunch', body: 'We eat together.', history: [] });
  put('staff/policies/teacher/a-section.json', { id: 'a-section', ref: 'staff/handbook/a-section.json', history: [] });
  put('family/handbook/2026/edition.json', { year: '2026', title: 'Family Handbook', published: true, parts: [{ id: 'policies', title: 'School Policies', sections: ['behavior-and-discipline'] }] });
  put('family/handbook/2026/behavior-and-discipline.json', { id: 'behavior-and-discipline', title: 'Behavior and Discipline', body: 'We guide children with care.', history: [] });
  put('staff/school.json', { open: { records: true, pd: true, handbook: true, newed: true, growth: true, family: true }, goTo: 'Gia', checkin: { week: 1, secondTime: '13:00', minutes: 20 }, meeting: { start: '13:15', end: '14:30' }, philosophy: 'Words.' });
};

test('the policies in the browser', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const main = p => p.evaluate(() => document.querySelector('#main').innerText);

  await t.test('the director edits a section with a note, and the earlier wording is kept to read and restore', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280); s.p.on('dialog', d => d.accept().catch(() => {}));
    await s.p.evaluate(() => goView('sthb')); await s.p.waitForSelector('[data-stpol="arrival"]', { timeout: 15000 });
    assert.match(await main(s.p), /Codes/); assert.match(await main(s.p), /Routines/);
    await s.p.click('[data-stpol="arrival"]'); await s.p.waitForSelector('.pmd table');
    assert.ok(await s.p.$('.pmd ul ul li'), 'a list inside a list');
    await s.p.click('[data-stpoledit]'); await s.p.fill('#stpol-body', 'Greet each family by name.'); await s.p.click('[data-stpolsave]');
    await s.p.waitForTimeout(800); assert.ok(await s.p.$('#stpol-body'), 'a change without a note is not saved');
    await s.p.fill('#stpol-note', 'By name'); await s.p.click('[data-stpolsave]');
    await s.p.waitForFunction(() => /1 earlier version/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    await s.p.click('details summary.linkbtn'); await s.p.click('[data-stpolrestore="0"]');
    await s.p.waitForFunction(() => /Wash hands/.test(document.querySelector('#main').innerText) && /2 earlier versions/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('an educator on a phone reads the policies, never the director\'s own section, and acknowledges them', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 360);
    await s.p.evaluate(() => goView('sthb')); await s.p.waitForSelector('[data-stpolack]', { timeout: 15000 });
    assert.doesNotMatch(await main(s.p), /Codes/);
    assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await s.p.click('[data-stpolack]'); await s.p.waitForFunction(() => /Acknowledged for/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    // an inquiry links to Behavior and Discipline in the Family Handbook
    await s.p.evaluate(() => goView('inquiries')); await s.p.waitForSelector('[data-fhopen="behavior-and-discipline"]', { timeout: 10000 });
    await s.p.click('[data-fhopen="behavior-and-discipline"]'); await s.p.waitForFunction(() => /Behavior and Discipline/.test((document.querySelector('#main h2') || {}).textContent || ''), null, { timeout: 10000 });
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the public page stays closed until the director turns it on', async () => {
    const p = await (await b.newContext()).newPage();
    await p.goto(`http://localhost:${fx.web}/handbook.html?server=${fx.api}`); await p.waitForFunction(() => /not open/.test(document.querySelector('#out').textContent), null, { timeout: 10000 });
    const tok = (await fx.login('Dee', 'director-pass-1')).token;
    assert.strictEqual((await fx.as(tok, '/api/staff/policies/public', { on: true, reviewed: true })).status, 200);
    await p.reload(); await p.waitForSelector('nav.toc', { timeout: 10000 }); assert.match(await p.innerText('body'), /We guide children with care/);
  });
});
