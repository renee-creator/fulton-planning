'use strict';
// Session 10 names the school, we and our in sentences and Fulton Community School where a name is needed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('TREE names the school as we and our, or Fulton Community School', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const app = read('src/app.html'), staff = read('src/staff-app.js'), growth = read('src/growth-app.js'), pres = read('src/presenting-app.js');
  for (const w of ['"At Fulton"', '"Left Fulton"', 'Staying at Fulton', '`Fulton plans week of', '"Food at Fulton"', 'Fulton does not celebrate']) assert.ok(!app.includes(w), w);
  assert.ok(app.includes('`Fulton Community School plans week of ${week}'));
  for (const w of ['"Licensing at Fulton"', 'Fulton PD hours', '"Welcome to Fulton"']) assert.ok(!staff.includes(w), w);
  assert.ok(!growth.includes('Everyone at Fulton') && growth.includes('Everyone at our school'));
  assert.ok(pres.includes('Start from our PD template'));
  assert.match(read('server.js'), /Never call it Fulton on its own/);
});
