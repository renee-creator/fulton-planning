// every educator opens and writes team inquiries, and only the director shares one beyond the team
const test = require('node:test'); const assert = require('node:assert'); const { start } = require('./fixture.js');
test('an educator starts and writes a team inquiry, and only the director shares it', async t => {
  const fx = await start({}); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const doc = { id: 'iq-ann', name: 'Joining meeting', room: 'West', status: 'open', startedBy: 'Ann', display: false, see: 'A child runs from meeting.', hyps: [{ id: 'h1', text: 'Connection' }], tries: [] };
  assert.equal((await fx.as(ann, '/api/write', { kind: 'inquiries', id: 'iq-ann', op: 'set', data: doc })).status, 200, 'an educator starts one');
  assert.equal((await fx.as(ann, '/api/write', { kind: 'inquiries', id: 'iq-ann', op: 'update', patch: { watch: 'Using words', ibNeeds: ['Connection'] } })).status, 200, 'and writes every part');
  assert.equal((await fx.as(ann, '/api/write', { kind: 'inquiries', id: 'iq-ann', op: 'update', patch: { display: true } })).status, 403, 'but does not share it beyond the team');
  assert.equal((await fx.as(ann, '/api/write', { kind: 'inquiries', id: 'iq-x', op: 'set', data: Object.assign({}, doc, { id: 'iq-x', display: true }) })).status, 403, 'a new one stays with the team');
  assert.equal((await fx.as(ann, '/api/write', { kind: 'inquiries', id: 'iq-ann', op: 'delete' })).status, 403, 'only the director removes one');
  assert.equal((await fx.as(dee, '/api/write', { kind: 'inquiries', id: 'iq-ann', op: 'update', patch: { display: true } })).status, 200);
});
