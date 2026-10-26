'use strict';
/* A small stand-in for the GitHub API, backed by a folder on disk, so the TREE server can be run and tested
   against a copy of the records without reaching GitHub. It answers the requests server.js, staff.js and
   calendar.js make: the repository, its tree, blobs, and contents read, written and removed with their sha,
   so a save with an old sha is refused with 409 the way GitHub refuses it.

   node test/mock-github.js <records folder> <port>     or require it and call start(dir, port) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const blobSha = buf => crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])).digest('hex');

function start(dir, port, opt) {
  opt = opt || {}; let trees = 0, busy = false;
  const writes = [];
  const walk = (d, pre = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name), pre + e.name + '/') : [pre + e.name]);
  const blobs = () => { const m = new Map(); for (const p of walk(dir)) { const b = fs.readFileSync(path.join(dir, p)); m.set(blobSha(b), b); } return m; };
  const server = http.createServer((req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const u = new URL(req.url, 'http://x'); const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
      let body = {}; try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch (e) {}
      const m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/);
      // with opt.gql the mock answers GraphQL requests for files by their ids, the way educator records are read in batches
      if (u.pathname === '/graphql' && opt.gql && /object\(oid:/.test(body.query || '')) { const bs = blobs(); const repo = {}; for (const mm of String(body.query).matchAll(/(\w+):object\(oid:"([a-f0-9]+)"\)/g)) { const b = bs.get(mm[2]); repo[mm[1]] = b ? { text: b.toString('utf8'), isTruncated: false } : null; } opt.gqlCalls = (opt.gqlCalls || 0) + 1; return send(200, { data: { repository: repo } }); }
      // folders by their path, to four levels, for the GraphQL listing used when the hourly allowance is spent
      if (u.pathname === '/graphql' && opt.gql && /object\(expression:/.test(body.query || '')) {
        const tree = (rel, n) => { const full = path.join(dir, rel); if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return null;
          return { entries: fs.readdirSync(full, { withFileTypes: true }).filter(e => e.name !== '.git').map(e => e.isDirectory() ? { name: e.name, oid: 't', type: 'tree', object: n > 0 ? tree(path.join(rel, e.name), n - 1) : {} } : { name: e.name, oid: blobSha(fs.readFileSync(path.join(full, e.name))), type: 'blob' }) }; };
        const repo = {}; for (const mm of String(body.query).matchAll(/(\w+):object\(expression:"[^:"]+:([^"]+)"\)/g)) repo[mm[1]] = tree(mm[2], 4);
        if (/defaultBranchRef/.test(body.query)) repo.defaultBranchRef = { name: 'main' };
        return send(200, { data: { repository: repo } }); }
      if (u.pathname === '/graphql' && opt.gql && /defaultBranchRef/.test(body.query || '')) return send(200, { data: { repository: { defaultBranchRef: { name: 'main' } } } });
      if (u.pathname === '/graphql') return send(502, { message: 'not in the mock' });
      // with opt.spent the REST allowance is spent, so reading anything through REST is refused the way GitHub refuses it
      if (opt.spent && req.method === 'GET') return send(403, { message: 'API rate limit exceeded' });
      if (!m) return send(404, { message: 'Not Found' });
      const rest = m[1] || '';
      if (!rest) return send(200, { default_branch: 'main', size: 1000 });
      // a slow GitHub, for the educator records that are listed after the rest
      if (/^\/git\/trees\//.test(rest) && opt.treeDelay && trees++ > 0) { setTimeout(() => send(200, { truncated: false, tree: walk(dir).map(p => { const b = fs.readFileSync(path.join(dir, p)); return { type: 'blob', path: p, sha: blobSha(b), size: b.length }; }) }), opt.treeDelay); return; }
      if (/^\/git\/trees\//.test(rest)) return send(200, { truncated: false, tree: walk(dir).map(p => { const b = fs.readFileSync(path.join(dir, p)); return { type: 'blob', path: p, sha: blobSha(b), size: b.length }; }) });
      const bl = rest.match(/^\/git\/blobs\/([a-f0-9]+)$/);
      if (bl) { const b = blobs().get(bl[1]); if (!b) return send(404, { message: 'Not Found' });
        if (/raw/.test(req.headers.accept || '')) { res.writeHead(200); return res.end(b); }
        return send(200, { sha: bl[1], content: b.toString('base64'), encoding: 'base64', size: b.length }); }
      const ct = rest.match(/^\/contents\/(.+)$/);
      if (ct) {
        const rel = decodeURIComponent(ct[1]); if (rel.includes('..')) return send(400, {});
        const file = path.join(dir, rel); const has = fs.existsSync(file) && fs.statSync(file).isFile();
        const cur = has ? fs.readFileSync(file) : null; const curSha = cur ? blobSha(cur) : null;
        if (req.method === 'GET') return has ? send(200, { sha: curSha, size: cur.length, content: cur.toString('base64'), encoding: 'base64' }) : send(404, { message: 'Not Found' });
        // GitHub makes every change a commit on the branch. With opt.branchRace a change that arrives while another is
        // still being made is refused, the way GitHub refuses two commits made in the same moment.
        if ((req.method === 'PUT' || req.method === 'DELETE') && opt.branchRace) {
          if (busy) { writes.push({ path: rel, refused: true, race: true }); return send(409, { message: 'refs/heads/main is at a but expected b' }); }
          busy = true; setTimeout(() => { busy = false; finish(); }, opt.branchRace); return;
        }
        finish();
        function finish() {
        const has = fs.existsSync(file) && fs.statSync(file).isFile(), cur = has ? fs.readFileSync(file) : null, curSha = cur ? blobSha(cur) : null;
        if (req.method === 'PUT') {
          if (has && body.sha !== curSha) { writes.push({ path: rel, refused: true }); return send(409, { message: 'sha does not match' }); }
          if (!has && body.sha) { writes.push({ path: rel, refused: true }); return send(422, { message: 'sha given for a new file' }); }
          const buf = Buffer.from(body.content || '', 'base64'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf);
          writes.push({ path: rel, message: body.message, at: Date.now() }); return send(has ? 200 : 201, { content: { sha: blobSha(buf), path: rel } });
        }
        if (req.method === 'DELETE') { if (!has) return send(404, {}); if (body.sha !== curSha) return send(409, {}); fs.unlinkSync(file); writes.push({ path: rel, removed: true, message: body.message, at: Date.now() }); return send(200, {}); }
        send(404, { message: 'Not Found' });
        }
        return;
      }
      // the latest commits that changed a file, newest first, with their messages
      if (rest === '/commits') { const fp = u.searchParams.get('path'); return send(200, writes.filter(w => !w.refused && (!fp || w.path === fp)).slice().reverse().slice(0, 100).map(w => ({ commit: { message: w.message || '' } }))); }
      send(404, { message: 'Not Found' });
    });
  });
  return new Promise(ok => server.listen(port || 0, '127.0.0.1', () => ok({ server, writes, port: server.address().port, close: () => new Promise(r => server.close(r)) })));
}
module.exports = { start, blobSha };
if (require.main === module) start(process.argv[2], +process.argv[3] || 4010).then(s => console.log('mock GitHub on', s.port, 'for', process.argv[2]));
