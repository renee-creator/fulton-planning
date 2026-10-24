'use strict';
// times are plain clock times, 1:15 pm and 9:00 am, the same everywhere
const test = require('node:test');
const assert = require('node:assert');
const clockTime = require('../clock-time.js');

test('times read as plain clock times', () => {
  const want = { '13:15': '1:15 pm', '09:00': '9:00 am', '09:30': '9:30 am', '10:40': '10:40 am', '12:00': '12:00 pm', '00:05': '12:05 am', '18:30': '6:30 pm', '8:00': '8:00 am' };
  for (const [t, w] of Object.entries(want)) assert.strictEqual(clockTime(t), w, t);
  assert.strictEqual(clockTime(13 * 60 + 15), '1:15 pm');
  for (let m = 0; m < 24 * 60; m++) assert.match(clockTime(m), /^(1[0-2]|[1-9]):[0-5]\d (am|pm)$/, String(m));
  assert.strictEqual(clockTime(''), '');
});

test('the pages, the calendar, conferences, the Family page and the display share the same clock time', () => {
  const fs = require('fs'), path = require('path');
  const one = fs.readFileSync(path.join(__dirname, '..', 'clock-time.js'), 'utf8').match(/function clockTime[\s\S]*?\n  h=[^\n]*\}/)[0];
  for (const f of ['src/app.html', 'src/embed/calendar-app.html', 'src/embed/conferences-app.html', 'family.html', 'display.html']) {
    const s = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(s.includes(one), f);
    assert.doesNotMatch(s, /quarter past|half past|o'clock/, f);
  }
});
