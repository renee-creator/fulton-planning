'use strict';
// Readable copies in Google Drive.
// Once a week the director's own TREE, on a computer or iPad, makes the Word and PDF files TREE already prints and sends
// them here one at a time. Each is passed on to the TREE mailbox's Apps Script, the one that keeps the photos, which
// keeps it under TREE readable copies in that account's Drive, in a folder for the week. Only once the whole set has
// arrived does the script trash last week's set, so the newest complete set is always there. Evaluations, journals,
// check-ins and growth are never made into these files, and this route only ever takes PDF and Word files.
module.exports = function ({ drive, store, noteChange, scheduleSave, log }) {
  const RUN = /^\d{4}-\d{2}-\d{2}( \d{1,2})?$/;
  const FOLDER = /^(School|Former children|Former educators|[A-Z][A-Za-z]{0,30} Class)$/;
  const NAME = /^[^/\\:*?"<>|\u0000-\u001f]{1,160}\.(pdf|docx)$/i;
  const TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const CHUNK = 4 * 1024 * 1024;
  // one device makes a set at a time. A device that has sent nothing for 15 minutes gives way to the next.
  let claim = null;
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const info = () => { const r = store.recs.settings.get('readable'); return (r && !r.deleted && r.doc) || {}; };
  function save(patch) {
    const cur = store.recs.settings.get('readable');
    store.recs.settings.set('readable', Object.assign({}, cur || {}, { doc: Object.assign({}, info(), { id: 'readable', updatedAt: Date.now(), updatedByName: 'Readable copies' }, patch) }));
    noteChange('settings', 'readable'); scheduleSave('settings', 'readable');
  }
  const mine = b => claim && claim.id === String(b.device || '') && Date.now() - claim.at < 15 * 60e3;

  async function handle(b, who) {
    const a = String(b.action || '');
    if (!drive.on()) return { status: 503, error: 'Google Drive is not set up for TREE yet, so the readable copies cannot be kept there.' };
    if (a === 'start') {
      const device = String(b.device || '').slice(0, 40); if (!device) return { status: 400, error: 'The request could not be read.' };
      if (claim && claim.id !== device && Date.now() - claim.at < 15 * 60e3) return { busy: true };
      // a set that did not finish carries on in the same week's folder, and what already arrived is not sent again
      // a new set made the same day as the last whole one goes in its own folder, such as 2026-10-26 2, so the whole one stays until it is replaced
      const p = info().pending, last = String(info().run || ''), day = today();
      const next = last === day || last.startsWith(day + ' ') ? day + ' ' + ((Number(last.slice(11)) || 1) + 1) : day;
      const run = p && RUN.test(p.run || '') && Date.now() - (p.at || 0) < 6 * 864e5 ? p.run : next;
      claim = { id: device, at: Date.now() };
      let j; try { j = await drive.ask({ op: 'readable-start', run }, 120000); } catch (e) { claim = null; return { status: 502, error: 'The mailbox script did not answer. ' + e.message }; }
      if (!p || p.run !== run) save({ pending: { run, at: Date.now(), by: who } });
      log('Readable copies started by', who, 'for', run + ',', (j.have || []).length, 'files already there');
      return { run, have: Array.isArray(j.have) ? j.have : [] };
    }
    if (!mine(b)) return { status: 409, error: 'Another device is making the readable copies, or this one waited too long. Try again in a few minutes.' };
    claim.at = Date.now();
    const run = String(b.run || '');
    if (!RUN.test(run)) return { status: 400, error: 'The request could not be read.' };
    if (a === 'put') {
      const folder = String(b.folder || ''), name = String(b.name || ''), ext = (name.match(NAME) || [])[1];
      if (!FOLDER.test(folder) || !ext) return { status: 400, error: 'Only PDF and Word files go in the readable copies.' };
      const part = Number(b.part) || 0, parts = Number(b.parts) || 1, total = Number(b.total) || 0, start = Number(b.start) || 0;
      if (typeof b.data !== 'string' || b.data.length > Math.ceil(CHUNK / 3) * 4 + 8 || part < 0 || part >= parts || parts > 200 || total > CHUNK * 200) return { status: 400, error: 'That piece of the file could not be read.' };
      let j; try { j = await drive.ask({ op: 'readable-put', run, folder, name, type: TYPES[ext.toLowerCase()], data: b.data, part, parts, total, start, upload: String(b.upload || '').slice(0, 40) }, 180000); }
      catch (e) { return { status: 502, error: 'Drive did not keep ' + name + '. ' + e.message }; }
      return { ok: true, id: j.id || '', done: !!j.id };
    }
    if (a === 'finish') {
      const files = Math.max(0, Number(b.files) || 0);
      let j; try { j = await drive.ask({ op: 'readable-finish', run, expect: files }, 180000); } catch (e) { return { status: 502, error: 'The new set is in Drive, and last week\'s is still there too. ' + e.message }; }
      // a print TREE could not make is named, so the director can see which one to look at
      const skipped = (Array.isArray(b.skipped) ? b.skipped : []).slice(0, 20).map(s => String(s).slice(0, 200));
      save({ lastAt: Date.now(), run, files: Number(j.kept) || files, bytes: Number(b.bytes) || 0, skipped, by: who, pending: null, tried: null });
      claim = null; log('Readable copies kept for', run + ',', j.kept, 'files,', j.trashed || 0, 'older sets to the Drive trash');
      return { ok: true, kept: j.kept, trashed: j.trashed || 0 };
    }
    if (a === 'fail') {
      save({ tried: { at: Date.now(), run, done: Number(b.done) || 0, total: Number(b.total) || 0, why: String(b.why || '').slice(0, 200), by: who } });
      claim = null; log('Readable copies did not finish for', run + ',', String(b.why || '').slice(0, 200)); return { ok: true };
    }
    return { status: 400, error: 'Unknown request' };
  }
  return { handle };
};
