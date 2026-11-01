'use strict';
/* Builds staff.js and growth.js with stand-ins for the server, so the schedules, reminders and the rules about who
   receives what can be tested on any date with made-up educators. No school names or records are used here. */
const { setTimeout: wait } = require('timers/promises');

function people(list) {
  // list: [{ name, room, role, planHour, checkin, startDate, kitchen, office, director, newHire, journalEvery }]
  const files = new Map();
  const accounts = { list: list.filter(p => !p.renderOnly).map(p => ({ name: p.name, room: p.room || '', kitchen: !!p.kitchen, newHire: !!p.newHire, code: '1357', v: 1 })), loaded: true };
  for (const p of list) if (!p.renderOnly) files.set(`staff/people/${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`, { doc: { name: p.name, profile: { role: p.role || 'educator', planHour: p.planHour || '', checkin: p.checkin || '', startDate: p.startDate || '', journalEvery: p.journalEvery || 1 } }, sha: 'x' });
  return { files, accounts };
}

function make(list, opt = {}) {
  const { files, accounts } = people(list);
  const nameKey = n => String(n || '').trim().toLowerCase();
  const accountFor = n => accounts.list.find(a => nameKey(a.name) === nameKey(n)) || null;
  const isDirector = n => list.some(p => p.director && nameKey(p.name) === nameKey(n));
  const isKitchen = n => !isDirector(n) && !!(accountFor(n) || {}).kitchen;
  const isOffice = n => isDirector(n) || list.some(p => p.office && nameKey(p.name) === nameKey(n));
  const sent = [];
  const reminders = { keys: () => ({ pub: 'x' }), sendTo: async (name, msg) => { sent.push({ name, msg }); return { sent: 1 }; } };
  const store = { branch: 'main', recs: { settings: new Map(), children: new Map(), threads: new Map(), projects: new Map(), inquiries: new Map() } };
  const writes = [];
  const gh = async (method, path, body) => {
    if (method === 'GET' && /git\/trees/.test(path)) return { status: 200, json: { tree: [...files.keys()].map(p => ({ type: 'blob', path: p, sha: encodeURIComponent(p) })) } };
    const b = method === 'GET' && path.match(/git\/blobs\/(.+)$/);
    if (b) { const f = files.get(decodeURIComponent(b[1])); return f ? { status: 200, json: { content: Buffer.from(typeof f.text === 'string' ? f.text : JSON.stringify(f.doc)).toString('base64') } } : { status: 404, json: {} }; }
    if (method === 'PUT') { writes.push(path); return { status: 200, json: { content: { sha: 's' + writes.length } } }; }
    return { status: 404, json: {} };
  };
  files.set('staff/school.json', { doc: Object.assign({ open: { records: true, pd: true, handbook: true, newed: true, growth: true }, checkin: { week: 1, secondTime: '13:00', minutes: 20 } }, opt.school || {}), sha: 'x' });
  const events = opt.events || [];
  for (const [k, v] of Object.entries(opt.files || {})) files.set(k, typeof v === 'string' ? { text: v } : { doc: v });
  const staff = require('../staff.js')({ ask: opt.ask, hasAsk: opt.ask ? () => true : undefined, gh, repo: 'o/r', store, log: () => {}, classrooms: () => ['West', 'North', 'South'], accounts, accountFor, saveAccounts: async () => true, isDirector, isKitchen, isOffice, nameKey,
    keepOriginal: async () => {}, readOriginal: async () => Buffer.from(''), reminders, lensNow: () => null, rosterNames: () => list.filter(p => !p.kitchen && !p.office && !p.director).map(p => p.name),
    checkPasscode: (n, c) => c === '1357', nameBlocked: () => false, calendarEvents: async (f, t) => ({ events: events.filter(e => e.start <= t && (e.end || e.start) >= f) }), setSetting: () => {} });
  return { staff, files, accounts, sent, writes, store };
}

// a request through staff.handle, answered as the server would answer it
async function call(staff, me, path, body) {
  let out = null;
  const res = {};
  const json = (q, r, status, obj) => { out = { status, body: obj }; };
  const err = (q, r, status, msg) => { out = { status, body: { error: msg } }; };
  const send = (q, r, status, h, buf) => { out = { status, body: buf }; };
  await staff.handle('/api/staff/' + path, body || {}, me, {}, res, { json, err, send });
  return out;
}

// the staff module reads the records through gh at load, so the files are placed straight into its map after loading
async function loaded(list, opt) {
  const h = make(list, opt);
  await h.staff.load();
  return h;
}

module.exports = { make, call, loaded, wait };
