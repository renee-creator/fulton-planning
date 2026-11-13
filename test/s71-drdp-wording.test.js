'use strict';
// The official DRDP wording is read through GraphQL when GitHub refuses the ordinary read after a restart, so DRDP
// readings never go for long without it (November 13, 2026). Made-up wording only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const WORDING = { ptk: { 'ATL 1': { def: 'A made-up definition.', levels: { 'Exploring Later': 'A made-up level.' } } }, it: { 'ATL 1': { def: 'A made-up definition.', levels: {} } } };
const levels = async (fx, token) => { let L = null; for (let i = 0; i < 40; i++) { L = (await fx.as(token, '/api/drdp-levels', {})).body; if (L && L.levels) break; await new Promise(r => setTimeout(r, 250)); } return L; };

test('with the ordinary read refused, the official DRDP wording still loads through GraphQL', async t => {
  const gh = { gql: true, refuseFile: 'drdp/descriptors.json' };
  const fx = await start({ gh, more: put => put('drdp/descriptors.json', WORDING) });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const L = await levels(fx, dee);
  assert.ok(gh.refused >= 1, 'the ordinary read was refused');
  assert.ok(L.levels && L.levels.ptk['ATL 1'], 'the wording loaded anyway');
  assert.strictEqual(L.levels.ptk['ATL 1'].def, 'A made-up definition.');
});

test('with both reads refused, the server says the wording is not ready rather than loaded', async t => {
  const gh = { refuseFile: 'drdp/descriptors.json' };
  const fx = await start({ gh, more: put => put('drdp/descriptors.json', WORDING) });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const L = (await fx.as(dee, '/api/drdp-levels', {})).body;
  assert.ok(gh.refused >= 1);
  assert.strictEqual(L.levels, null, 'no wording is claimed');
});
