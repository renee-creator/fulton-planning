'use strict';
/* A small stand-in for the TREE mailbox's Apps Script web app. It runs the real tools/kaymbu-apps-script.gs and
   tools/readable-copies.gs, with Google's DriveApp, UrlFetchApp and the rest played by an in-memory Drive, so the
   server's photo and readable-copy requests reach the same doPost Renee pastes. Photos asked for by id come back as one
   small picture, since no real Drive is here.

   const d = await require('./mock-drive.js').start({ photo }); then DRIVE_PHOTOS_URL = d.url, KAYMBU_INBOX_KEY = d.key.
   d.tree() lists every file kept, d.file(path) gives its bytes, d.close() stops it. */
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

function start(opt) {
  opt = opt || {}; const key = opt.key || 'mock-drive-key-' + crypto.randomBytes(4).toString('hex');
  const nodes = new Map(); let n = 0; const sessions = new Map(); const props = new Map(), cache = new Map(); const calls = [];
  const add = (o) => { const id = 'drv' + String(++n).padStart(8, '0') + 'x'; nodes.set(id, Object.assign({ id, trashed: false }, o)); return id; };
  const kids = (pid, folder) => [...nodes.values()].filter(x => x.parent === pid && !!x.folder === folder && !x.trashed);
  const iter = l => { l = l.slice(); return { hasNext: () => l.length > 0, next: () => l.shift() }; };
  const blob = (bytes, type, name) => ({ bytes: Buffer.from(bytes), type: type || 'application/octet-stream', name: name || '', getBytes() { return this.bytes; }, setName(x) { this.name = x; return this; }, setContentType(t) { this.type = t; return this; }, copyBlob() { return blob(this.bytes, this.type, this.name); }, getDataAsString() { return this.bytes.toString('utf8'); } });
  const isTrashed = id => { for (let x = nodes.get(id); x; x = nodes.get(x.parent)) if (x.trashed) return true; return false; };
  function fileObj(id) { const x = nodes.get(id); return { getId: () => id, getName: () => x.name, getSize: () => x.bytes.length, getMimeType: () => x.type, isTrashed: () => isTrashed(id), setTrashed: t => { x.trashed = !!t; },
    getBlob: () => blob(x.bytes, x.type, x.name), getParents: () => iter(x.parent ? [folderObj(x.parent)] : []) }; }
  function folderObj(id) { const x = nodes.get(id); return { getId: () => id, getName: () => x.name, isTrashed: () => isTrashed(id), setTrashed: t => { x.trashed = !!t; },
    getFolders: () => iter(kids(id, true).map(k => folderObj(k.id))), getFiles: () => iter(kids(id, false).map(k => fileObj(k.id))),
    getFoldersByName: nm => iter(kids(id, true).filter(k => k.name === nm).map(k => folderObj(k.id))), getFilesByName: nm => iter(kids(id, false).filter(k => k.name === nm).map(k => fileObj(k.id))),
    createFolder: nm => folderObj(add({ name: nm, parent: id, folder: true })), createFile: b => fileObj(add({ name: b.name, parent: id, bytes: Buffer.from(b.bytes), type: b.type })) }; }
  const root = add({ name: 'My Drive', parent: null, folder: true });
  const ctx = {
    console, Logger: { log: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) || null, setProperty: (k, v) => props.set(k, v) }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) || null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    DriveApp: { getFolderById: id => { if (!nodes.has(id)) throw new Error('No item with the given ID could be found'); return folderObj(id); }, getFileById: id => { if (!nodes.has(id)) throw new Error('No item with the given ID could be found'); return fileObj(id); },
      getFoldersByName: nm => folderObj(root).getFoldersByName(nm), createFolder: nm => folderObj(root).createFolder(nm) },
    Utilities: { base64Decode: s => Buffer.from(String(s), 'base64'), base64Encode: b => Buffer.from(b).toString('base64'), newBlob: (b, t, nm) => blob(b, t, nm), sleep: () => {}, formatDate: () => '' },
    ScriptApp: { getOAuthToken: () => 'token', getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({}) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    // Drive's own resumable upload, the way the readable copies send a large file in pieces
    UrlFetchApp: { fetch: (url, o) => {
      const reply = (code, body, headers) => ({ getResponseCode: () => code, getContentText: () => body || '', getAllHeaders: () => headers || {} });
      if (/upload\/drive\/v3\/files\?uploadType=resumable/.test(url)) { const meta = JSON.parse(o.payload); const s = 'https://upload.mock/session/' + (sessions.size + 1);
        sessions.set(s, { name: meta.name, parent: meta.parents[0], type: o.headers['X-Upload-Content-Type'], total: Number(o.headers['X-Upload-Content-Length']), parts: [] }); return reply(200, '', { Location: s }); }
      const ss = sessions.get(url);
      if (ss) { const m = String(o.headers['Content-Range']).match(/bytes (\d+)-(\d+)\/(\d+)/); const got = ss.parts.reduce((a, b) => a + b.length, 0);
        if (!m || Number(m[1]) !== got) return reply(400, 'bad range');
        ss.parts.push(Buffer.from(o.payload)); if (got + o.payload.length < ss.total) return reply(308, '');
        const id = add({ name: ss.name, parent: ss.parent, bytes: Buffer.concat(ss.parts), type: ss.type }); sessions.delete(url); return reply(200, JSON.stringify({ id })); }
      if (/googleapis\.com\/drive\/v3\/files\//.test(url)) return reply(200, '{}');
      return reply(404, 'not in the mock'); } }
  };
  vm.createContext(ctx);
  const src = f => fs.readFileSync(path.join(__dirname, '..', 'tools', f), 'utf8');
  vm.runInContext(src('kaymbu-apps-script.gs').replace("const TREE_KEY = 'PASTE THE KEY HERE';", 'const TREE_KEY = ' + JSON.stringify(key) + ';') + '\n' + src('readable-copies.gs'), ctx);
  const server = http.createServer((req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      let out; const contents = Buffer.concat(chunks).toString('utf8'); let b = {}; try { b = JSON.parse(contents); } catch (e) {}
      calls.push({ op: b.op, folder: b.folder, name: b.name, part: b.part, parts: b.parts, bytes: (b.data || '').length });
      if (b.op === 'get' && opt.photo && b.key === key) out = JSON.stringify({ data: opt.photo.toString('base64'), type: 'image/jpeg' });
      else if (opt.fail && opt.fail(b)) out = JSON.stringify({ error: 'The mock was told to refuse this' });
      else { try { out = ctx.doPost({ postData: { contents } }).text; } catch (e) { res.writeHead(500, { 'Content-Type': 'text/html' }); res.end('<html><body>Script error ' + e.message + '</body></html>'); return; } }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out); });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => {
    const pathOf = id => { const p = []; for (let x = nodes.get(id); x && x.id !== root; x = nodes.get(x.parent)) p.unshift(x.name); return p.join('/'); };
    ok({ url: 'http://127.0.0.1:' + server.address().port + '/exec', key, calls,
      tree: () => [...nodes.values()].filter(x => !x.folder && !isTrashed(x.id)).map(x => pathOf(x.id)).sort(),
      trashed: () => [...nodes.values()].filter(x => x.folder && x.trashed).map(x => pathOf(x.id)),
      file: p => { const x = [...nodes.values()].find(y => !y.folder && !isTrashed(y.id) && pathOf(y.id) === p); return x ? x.bytes : null; },
      close: () => new Promise(r => server.close(r)) });
  }));
}
module.exports = { start };
