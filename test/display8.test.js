'use strict';
// The staff room display. A note to all staff shows that day and a note to one person never does, a staff birthday shows
// only on its day with the name alone, the lens shows its whole description, and photos take turns across the Classes.
// Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('the display shows notes to all staff, birthdays on the day, the whole lens and Classes in turn', async () => {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const [y, m, d] = day.split('-');
  const tomorrow = new Date(Date.parse(day + 'T12:00:00Z') + 864e5).toISOString().slice(5, 10);
  const long = 'A lens to read children\'s marks with. '.repeat(20).trim();
  const fx = await start({ more: put => {
    put('settings/staffbirthdays.json', { id: 'staffbirthdays', people: [{ name: 'Ann', date: m + '-' + d }, { name: 'Bea', date: tomorrow }] });
    put('settings/program.json', { id: 'program', groups: [], lenses: [{ id: 'l1', name: 'Graphic Languages', year: true, description: long, questions: ['One', 'Two', 'Three', 'Four'], languages: [] }] });
    const at = Date.now() - 3600e3;
    for (let i = 0; i < 6; i++) put(`notices/w${i}.json`, { id: 'w' + i, at: at - i * 1000, classroom: 'West', noticed: 'West moment ' + i, photo: { id: 'p-w' + i, w: 800, h: 600 } });
    put('notices/n0.json', { id: 'n0', at: at - 10000, classroom: 'North', noticed: 'North moment', photo: { id: 'p-n0', w: 800, h: 600 } });
    put('notices/s0.json', { id: 's0', at: at - 20000, classroom: 'South', noticed: 'South moment', photo: { id: 'p-s0', w: 800, h: 600 } });
  } });
  try {
    const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token;
    assert.strictEqual((await fx.as(ann, '/api/notes/send', { text: 'x', to: 'all' })).status, 403, 'only the director sends a note');
    assert.strictEqual((await fx.as(dee, '/api/notes/send', { text: 'The garden is closed this afternoon.', to: 'all' })).status, 200);
    assert.strictEqual((await fx.as(dee, '/api/notes/send', { text: 'Ann, a private word about Friday.', to: 'Ann' })).status, 200);
    assert.deepStrictEqual((await fx.as(ann, '/api/notes', {})).body.notes.map(x => x.text).sort(), ['Ann, a private word about Friday.', 'The garden is closed this afternoon.']);
    assert.deepStrictEqual((await fx.as(bea, '/api/notes', {})).body.notes.map(x => x.text), ['The garden is closed this afternoon.']);
    // nobody but the director receives the notes record itself
    const bd = (await fx.as(bea, '/api/data', {})).body.data.settings || {};
    assert.strictEqual(bd.staffnotes, undefined);
    await fx.as(dee, '/api/display', { action: 'new' });
    const key = (await fx.as(dee, '/api/display', {})).body.key;
    const f = (await fx.as('', '/display/feed', { key })).body;
    assert.deepStrictEqual(f.notes.map(x => x.text), ['The garden is closed this afternoon.']);
    assert.doesNotMatch(JSON.stringify(f), /private word/);
    assert.deepStrictEqual(f.birthdays, ['Ann']);
    assert.ok(!f.week.some(e => /Bea's birthday/.test(e.title)), 'a staff birthday is not shown before its day');
    assert.strictEqual(f.lenses[0].description, long); assert.strictEqual(f.lenses[0].questions.length, 4);
    // the first three photos come from three Classes
    assert.deepStrictEqual(f.moments.slice(0, 3).map(x => x.rooms[0]).sort(), ['North', 'South', 'West']);
  } finally { await fx.stop(); }
});
