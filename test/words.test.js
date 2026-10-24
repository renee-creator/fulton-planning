'use strict';
// times are said in words, never with a colon
const test = require('node:test');
const assert = require('node:assert');
const timeWords = require('../time-words.js');

test('times read the way people say them', () => {
  const want = { '13:15': 'quarter past one', '09:30': 'half past nine', '10:40': 'twenty to eleven', '08:00': "eight o'clock", '12:00': 'noon', '14:45': 'quarter to three',
    '18:30': 'half past six in the evening', '06:45': 'quarter to seven in the morning', '10:07': 'seven minutes past ten' };
  for (const [t, w] of Object.entries(want)) assert.strictEqual(timeWords(t), w, t);
  for (let m = 0; m < 24 * 60; m++) assert.ok(!/[:\d]/.test(timeWords(m)), String(m));
});

test('the pages, the calendar, conferences, the Family page and the display share the same spoken time', () => {
  const fs = require('fs'), path = require('path');
  const one = fs.readFileSync(path.join(__dirname, '..', 'time-words.js'), 'utf8').match(/function timeWords[\s\S]*?\n  return [^\n]*\}/)[0];
  for (const f of ['src/app.html', 'src/embed/calendar-app.html', 'src/embed/conferences-app.html', 'family.html', 'display.html']) assert.ok(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes(one), f);
});
