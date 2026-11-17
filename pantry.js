/* Kitchen TREE. The school's pantry, the weekly shopping list by store, and the facilities, garden and farm tasks the
   director shares with the shopper. It is its own small page, kitchen.html, on TREE's server and TREE's sign-in.
   Built November 16, 2026, as the director asked and agreed in chat.

   What it keeps, in the TREE records, under settings. None of these is sent to TREE's own pages, only through here.
     settings/pantry       the stores, the items, the menu words, closing times and the shopper's email
     settings/pantrylist   the lines on the list, from gathering to bought, and a short history
     settings/pantrytasks  the shared tasks

   How a week runs.
     Any time   an item marked Low or Out, an educator's request, a task's supplies, all wait as lines being gathered.
                A line for a store marked Ordered direct goes to the director and kitchen to reorder, never the shopper.
     Thursday   at the Costco closing time, with Costco delivery on, the Costco lines wait for the director to order.
     Friday     at the closing time, the standing weekly items and what next week's menu needs join the list, every
                gathered line and any Costco line not ordered go to the shopper's trip, and the shopper is told.
     After      a line added after the close waits for next week, and the shopper sees it in its own fold.
     Done       Done shopping marks every item checked off as stocked and keeps the trip in the history.

   Who does what.
     The director     everything.
     The kitchen      the pantry, the list, the stores, the menu words and the times. Not the tasks.
     The shopper      the trip, the pantry and the tasks. A shopper sign-in reaches only this page.
     Educators        the pantry and the list to read, Low and Out on any item, and requests. Never an item's store. */
'use strict';
const crypto = require('crypto');

module.exports = function createPantry(o) {
  const { store, log, setSetting, settingDoc, isDirector, isKitchen, accountFor, accounts, saveAccounts, nameKey, cleanName, okName, mailText, pushTo, keepOriginal, photoSrc, menuDays } = o;
  const newId = p => p + crypto.randomBytes(5).toString('hex');
  const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 120);
  const IDS = ['pantry', 'pantrylist', 'pantrytasks'];

  /* ---------- the school's own time ---------- */
  const laParts = t => { const o = {}; for (const p of new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(t))) o[p.type] = p.value; return o; };
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOf = t => { const p = laParts(t); return p.year + '-' + p.month + '-' + p.day; };
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const mondayOf = d => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return addDays(d, -((w + 6) % 7)); };
  // the moment a weekday and clock time falls in the week of a day, as the school's wall clock reads it
  function closeAt(day, wd, hm) {
    const d = addDays(mondayOf(day), (wd + 6) % 7);
    const [h, m] = String(hm || '00:00').split(':').map(Number);
    // try the two offsets California uses and keep the one that reads back right
    for (const off of [7, 8]) { const t = Date.parse(d + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00Z') + off * 36e5; const p = laParts(t); if (+p.hour === h && p.year + '-' + p.month + '-' + p.day === d) return t; }
    return Date.parse(d + 'T12:00:00Z');
  }

  /* ---------- what is kept, with the starting pantry the first time ---------- */
  const STORES = [
    { id: 'costco', name: 'Costco' }, { id: 'tj', name: "Trader Joe's" }, { id: 'cashcarry', name: 'Cash and Carry' },
    { id: 'asian', name: 'Asian grocery store' }, { id: 'western', name: 'Western Farm Center' }, { id: 'tractor', name: 'Tractor Supply' },
    { id: 'direct', name: 'Ordered direct', direct: true }];
  // like items sit together inside each store's list, in the order the shopper walks. Renamed and added to in Settings.
  const GROUPS = [['produce', 'Produce'], ['dairy', 'Dairy and eggs'], ['cold', 'Refrigerated and frozen'], ['dry', 'Dry goods'], ['baking', 'Baking'], ['sauces', 'Oils, sauces and spices'], ['snacks', 'Snacks'],
    ['paper', 'Paper and kitchen supplies'], ['cleaning', 'Cleaning'], ['animals', 'Animals and garden'], ['other', 'Other']].map(([id, name]) => ({ id, name }));
  const GUESS = [['animals', /feed|scratch|hay|pellet|straw|bedding|seed|soil|compost/], ['cleaning', /soap|detergent|disinfect|laundry|trash bag|bleach|sponge/], ['paper', /paper|napkin|foil|wrap|parchment|glove|container|storage bag|toilet/],
    ['dairy', /egg|butter|milk|yogurt|cream cheese|cheese/], ['cold', /tofu|frozen|miso|tortilla/], ['produce', /produce|fruit|vegetable|lemon|onion|garlic|potato|carrot|kale|broccoli|cucumber|apple|banana|berr/],
    ['baking', /flour|sugar|baking|yeast|vanilla|cornstarch|cream of tartar|poppy|honey|oats/], ['sauces', /oil|vinegar|soy|sauce|spice|herb|salt|tahini|jelly/], ['snacks', /cracker|pretzel|rice cake|raisin|granola|trail/],
    ['dry', /pasta|rice|noodle|ramen|seaweed|nori|bean|grain|lentil/]];
  const guessGroup = name => { const n = String(name || '').toLowerCase(); for (const [g, re] of GUESS) if (re.test(n)) return g; return 'other'; };
  const SECTIONS = { kitchen: 'Kitchen', sensory: 'Sensory staples', other: 'Other items' };
  function startingItems() {
    const L = [];
    const add = (store, section, names, more) => { for (const n of names) { const [name, from] = Array.isArray(n) ? n : [n, '']; L.push(Object.assign({ id: 'i' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + (section === 'sensory' ? '-sensory' : ''), name, store, section, from, amount: '', status: 'ok', weekly: false, perUse: false, by: 'TREE', at: Date.now() }, more || {})); } };
    add('direct', 'kitchen', [['Produce', 'FEED Sonoma bins'], ['Cheese', 'Petaluma Creamery'], ['Beans and grains', 'Next Generation Foods'], ['Flour for baking', 'Central Milling'], ['Corn tortillas', 'Local molino']]);
    add('costco', 'kitchen', ['Eggs', 'Butter', 'Milk'], { weekly: true });
    add('costco', 'kitchen', ['Olive oil', 'Cooking oil', 'Sugar', 'Honey', 'Oats', 'Raisins', 'Frozen fruit']);
    add('costco', 'kitchen', ['Plain yogurt', 'Cream cheese'], { perUse: true });
    add('costco', 'other', ['Paper towels', 'Napkins', 'Foil', 'Plastic wrap', 'Parchment paper', 'Dish soap', 'Dishwasher detergent', 'Food service gloves', 'Toilet paper', 'Hand soap', 'Disinfectant', 'Laundry soap']);
    add('tj', 'kitchen', ['Crackers', 'Pretzels', 'Jelly', 'Tahini', 'Spices and dried herbs']);
    add('tj', 'kitchen', ['Pasta', 'Rice cakes'], { perUse: true });
    add('cashcarry', 'kitchen', ['Baking powder', 'Baking soda', 'Yeast', 'Vanilla', 'Vinegar', 'Salt', 'Poppy seeds']);
    add('cashcarry', 'other', ['Storage containers', 'Storage bags', 'Large trash bags']);
    add('asian', 'kitchen', ['Jasmine rice', 'Sesame oil', 'Soy sauce', 'Vegetarian stir fry sauce']);
    add('asian', 'kitchen', ['Tofu', 'Sweet rice (khao niao)', 'Seaweed (nori)', 'Rice noodles', 'Glass noodles', 'Ramen noodles', 'Stir fry noodles', 'Miso'], { perUse: true });
    add('costco', 'sensory', ['Flour', 'Oil']);
    add('cashcarry', 'sensory', ['Salt', 'Cornstarch', 'Cream of tartar']);
    add('western', 'other', ['Chicken feed', 'Chicken scratch', 'Goat feed', 'Hay', 'Rabbit pellets', 'Straw', 'Bedding']);
    return L;
  }
  // words in a dish on the menu, and the items that dish needs each week it is served. Edited in Settings.
  const RULES = [
    ['tofu', ['Tofu']], ['cream cheese', ['Cream cheese']], ['rice cake', ['Rice cakes']], ['yogurt', ['Plain yogurt']],
    ['pasta', ['Pasta']], ['spaghetti', ['Pasta']], ['macaroni', ['Pasta']], ['pho', ['Rice noodles']], ['japchae', ['Glass noodles']], ['jap chae', ['Glass noodles']],
    ['ramen', ['Ramen noodles']], ['miso', ['Miso']], ['stir fry', ['Stir fry noodles']], ['sticky rice', ['Sweet rice (khao niao)']], ['seaweed', ['Seaweed (nori)']]];
  const startingRules = items => RULES.map(([word, names]) => ({ id: newId('r'), word, items: names.map(n => (items.find(i => i.name === n && i.section === 'kitchen') || {}).id).filter(Boolean) }));
  function cfg() {
    const d = settingDoc('pantry');
    if (d && Array.isArray(d.items)) { if (!Array.isArray(d.groups) || !d.groups.length) d.groups = GROUPS; const ok = new Set(d.groups.map(g => g.id)); for (const i of d.items) if (!ok.has(i.group)) i.group = ok.has(guessGroup(i.name)) ? guessGroup(i.name) : d.groups[d.groups.length - 1].id; return d; }
    const items = startingItems(); for (const i of items) i.group = guessGroup(i.name);
    return { groups: GROUPS, stores: STORES, items, rules: startingRules(items), costcoDelivery: true, costcoClose: { day: 4, at: '18:00' }, close: { day: 5, at: '14:00' }, shopperEmail: '', starting: true };
  }
  const list = () => { const d = settingDoc('pantrylist'); return { lines: Array.isArray(d.lines) ? d.lines : [], history: Array.isArray(d.history) ? d.history : [], closed: d.closed || {}, trip: d.trip || null }; };
  const tasks = () => { const d = settingDoc('pantrytasks'); return { list: Array.isArray(d.list) ? d.list : [] }; };
  const saveCfg = c => { delete c.starting; setSetting('pantry', c); };
  const saveList = l => { l.history = l.history.slice(-400); setSetting('pantrylist', l); };
  const saveTasks = t => setSetting('pantrytasks', t);

  /* ---------- who may do what ---------- */
  const isShopper = n => { const a = accountFor(n); return !!(a && a.shopper); };
  const roleOf = n => isDirector(n) ? 'director' : isShopper(n) ? 'shopper' : isKitchen(n) ? 'kitchen' : 'educator';
  const canSetStores = r => r === 'director' || r === 'kitchen';
  const canTasks = r => r === 'director' || r === 'shopper';
  const shoppers = () => accounts.list.filter(a => a.shopper).map(a => a.name);
  const directors = () => accounts.list.filter(a => isDirector(a.name)).map(a => a.name);

  /* ---------- lines ---------- */
  const storeOf = (c, id) => (c.stores || []).find(s => s.id === id);
  const isDirect = (c, id) => !!(storeOf(c, id) || {}).direct;
  const active = l => l.stage !== 'done';
  function lineFor(c, L, item, why, by, note, extra) {
    if (item && L.lines.some(x => active(x) && x.item === item.id && x.stage !== 'trip')) {
      const have = L.lines.find(x => active(x) && x.item === item.id && x.stage !== 'trip');
      if (why === 'out' && have.why === 'low') have.why = 'out';
      if (note && !String(have.note || '').includes(note)) have.note = [have.note, note].filter(Boolean).join('. ');
      return have;
    }
    const store = item ? item.store : clip((extra || {}).store, 30);
    const ln = Object.assign({ id: newId('l'), item: item ? item.id : '', name: item ? item.name : clip((extra || {}).name, 80), section: item ? item.section : ((extra || {}).section || 'other'), store, from: item ? item.from || '' : '', amount: item ? item.amount || '' : clip((extra || {}).amount, 40), why, note: clip(note, 200), by, at: Date.now(), stage: store && isDirect(c, store) ? 'reorder' : 'collect', state: '' }, (extra && extra.late) ? { late: true } : {});
    // once the list has closed for the week, a new line waits for next week. The shopper still sees it, in its own fold.
    if (ln.stage === 'collect' && L.trip && !L.trip.done) ln.late = true;
    L.lines.push(ln); return ln;
  }
  function finish(L, ln, state, by) { ln.stage = 'done'; ln.state = state; ln.doneBy = by; ln.doneAt = Date.now(); L.history.push(ln); L.lines = L.lines.filter(x => x !== ln); }
  function restock(c, ln) { const it = ln.item && c.items.find(i => i.id === ln.item); if (it) { it.status = 'ok'; it.at = Date.now(); } }

  /* ---------- the menu ---------- */
  // the dishes of the school week after a day, Monday to Friday, read from TREE's monthly menus
  function nextWeekDishes(fromDay) {
    const mon = addDays(mondayOf(fromDay), 7), out = [];
    for (let i = 0; i < 5; i++) { const d = addDays(mon, i), x = menuDays(d); if (!x || x.closed) continue;
      for (const k of ['am', 'lunch', 'pm']) { const t = clip(x[k], 120); if (t) out.push({ day: d, meal: k, dish: t }); } }
    return { monday: mon, dishes: out };
  }
  const WEEKDAY = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  // what next week's dishes need, by the menu words, each item once with the dishes that need it
  function menuNeeds(c, fromDay) {
    const { monday, dishes } = nextWeekDishes(fromDay), need = new Map();
    for (const r of c.rules || []) { const w = String(r.word || '').trim().toLowerCase(); if (!w) continue;
      for (const x of dishes) { if (!x.dish.toLowerCase().includes(w)) continue;
        for (const id of r.items || []) { const it = c.items.find(i => i.id === id); if (!it) continue;
          const e = need.get(id) || { item: it, dishes: [] }; const lab = x.dish + ' (' + WEEKDAY(x.day) + ')'; if (!e.dishes.includes(lab)) e.dishes.push(lab); need.set(id, e); } } }
    return { monday, dishes, needs: [...need.values()] };
  }

  /* ---------- closing ---------- */
  function closeCostco(by) {
    const c = cfg(), L = list(), wk = mondayOf(dayOf(Date.now()));
    let n = 0; for (const ln of L.lines) if (ln.stage === 'collect' && !ln.late && ln.store === 'costco') { ln.stage = 'delivery'; n++; }
    L.closed.costco = wk; saveList(L); log('Kitchen TREE closed the Costco part', wk, n, 'lines', by || '');
    if (n) for (const d of directors()) pushTo(d, { title: 'Kitchen TREE', body: `The Costco list is ready to order, ${n} item${n === 1 ? '' : 's'}.`, url: 'kitchen.html?go=delivery', tag: 'kitchen-costco' }).catch(() => {});
    return n;
  }
  async function closeWeek(by) {
    const c = cfg(), L = list(), today = dayOf(Date.now()), wk = mondayOf(today);
    // what the last trip left unbought stays on the new one
    for (const ln of L.lines) if (ln.stage === 'trip' && ln.state === 'got') { restock(c, ln); }
    for (const ln of L.lines.filter(x => x.stage === 'trip' && x.state === 'got')) finish(L, ln, 'got', ln.gotBy || '');
    for (const ln of L.lines) if (ln.late) delete ln.late;
    L.trip = null;
    for (const it of c.items) if (it.weekly && !isDirect(c, it.store)) lineFor(c, L, it, 'weekly', 'TREE', '');
    const mn = menuNeeds(c, today);
    for (const e of mn.needs) { const ln = lineFor(c, L, e.item, 'menu', 'TREE', 'For ' + e.dishes.join(', ')); if (ln.why !== 'menu' && ln.why !== 'out') ln.why = 'menu'; }
    let n = 0; for (const ln of L.lines) if (ln.stage === 'collect' || (ln.stage === 'delivery' && ln.state !== 'ordered')) { if (ln.stage === 'delivery') ln.state = ''; ln.stage = 'trip'; n++; }
    for (const ln of L.lines.filter(x => x.stage === 'delivery' && x.state === 'ordered')) { restock(c, ln); finish(L, ln, 'ordered', ln.orderedBy || ''); }
    L.trip = { week: wk, closedAt: Date.now(), menuWeek: mn.monday, done: false };
    L.closed.week = wk; L.closed.costco = L.closed.costco || wk;
    saveCfg(c); saveList(L); log('Kitchen TREE closed the list', wk, n, 'lines', by || '');
    const total = L.lines.filter(x => x.stage === 'trip').length;
    const byStore = {}; for (const ln of L.lines.filter(x => x.stage === 'trip')) { const s = (storeOf(c, ln.store) || { name: 'Store not chosen yet' }).name; byStore[s] = (byStore[s] || 0) + 1; }
    const lines = Object.entries(byStore).map(([s, k]) => `${s}, ${k} item${k === 1 ? '' : 's'}`);
    for (const s of shoppers()) pushTo(s, { title: 'Kitchen TREE', body: `This week's shopping list is ready, ${total} item${total === 1 ? '' : 's'}.`, url: 'kitchen.html?go=list', tag: 'kitchen-list' }).catch(() => {});
    if (c.shopperEmail && total) {
      try { await mailText(c.shopperEmail, "This week's shopping list is ready", `This week's shopping list is ready in Kitchen TREE.\n\n${lines.join('\n')}\n\nOpen it here.\nhttps://renee-creator.github.io/fulton-planning/kitchen.html\n\nFulton Community School`); }
      catch (e) { log('Kitchen TREE could not email the shopper', e.message); }
    }
    return total;
  }
  // every five minutes the server looks at the clock, so a close happens once each week even after a restart
  let ticking = false;
  async function tick() {
    if (ticking || !store.ready) return; ticking = true;
    try {
      const c = cfg(), L = list(), now = Date.now(), today = dayOf(now), wk = mondayOf(today);
      if (c.costcoDelivery && L.closed.costco !== wk && now >= closeAt(today, c.costcoClose.day, c.costcoClose.at) && now < closeAt(today, c.close.day, c.close.at)) closeCostco('the clock');
      if (L.closed.week !== wk && now >= closeAt(today, c.close.day, c.close.at)) await closeWeek('the clock');
    } catch (e) { log('Kitchen TREE could not check the week', e.message); }
    ticking = false;
  }
  setInterval(() => { tick(); }, 5 * 60e3).unref();

  /* ---------- what a page receives ---------- */
  function boot(me) {
    const role = roleOf(me), c = cfg(), L = list(), now = Date.now(), today = dayOf(now);
    const items = c.items.map(i => ({ id: i.id, name: i.name, store: i.store, group: i.group, section: i.section, from: i.from || '', amount: i.amount || '', status: i.status || 'ok', weekly: !!i.weekly, perUse: !!i.perUse, markedBy: i.markedBy || '', markedAt: i.markedAt || 0 }));
    const lines = L.lines;
    const mn = menuNeeds(c, today);
    const out = {
      me, role, today, stores: c.stores, groups: c.groups, sections: SECTIONS, items, lines,
      trip: L.trip, history: L.history.slice(-60).reverse(),
      times: { costcoDelivery: !!c.costcoDelivery, costcoClose: c.costcoClose, close: c.close,
        costcoCloseAt: closeAt(today, c.costcoClose.day, c.costcoClose.at), closeAt: closeAt(today, c.close.day, c.close.at), closedCostco: L.closed.costco === mondayOf(today), closedWeek: L.closed.week === mondayOf(today) },
      menu: { monday: mn.monday, dishes: mn.dishes, needs: mn.needs.map(e => ({ item: e.item.id, name: e.item.name, store: e.item.store, dishes: e.dishes })) },
      people: { shoppers: shoppers(), directors: directors() },
    };
    if (canSetStores(role)) { out.rules = c.rules || []; out.shopperEmail = c.shopperEmail || ''; out.starting = !!c.starting; }
    if (role === 'director') out.shopperAccounts = accounts.list.filter(a => a.shopper).map(a => ({ name: a.name, hasCode: !!a.code }));
    // everyone sees their own facilities requests, waiting or done, and nothing else of the tasks
    out.myRequests = tasks().list.filter(t => t.request && nameKey(t.by) === nameKey(me) && (!t.closedAt || now - t.closedAt < 14 * 864e5)).slice(-12).reverse().map(t => ({ id: t.id, title: t.title, at: t.at, done: !!t.closedAt, doneAt: t.closedAt || 0 }));
    if (canTasks(role)) out.tasks = tasks().list.map(t => Object.assign({}, t, t.photo ? { src: photoSrc(t.photo) } : {}, { done: (t.done || []).slice(-6).map(d => Object.assign({}, d, d.photo ? { src: photoSrc(d.photo) } : {})) }));
    return out;
  }

  // a photo sent from a phone, kept with TREE's other files
  async function keepPhoto(data, tag) {
    const buf = Buffer.from(String(data).replace(/^data:image\/\w+;base64,/, ''), 'base64'); if (!buf.length) throw new Error('empty'); if (buf.length > 6e6) { const e = new Error('big'); e.big = true; throw e; }
    const id = 'kt-' + tag + '-' + Date.now().toString(36) + '.jpg'; await keepOriginal(id, buf, 'image/jpeg', 'Kitchen TREE photo'); return id;
  }

  /* ---------- requests ---------- */
  async function handle(P, body, me, req, res, { json, err }) {
    const role = roleOf(me), b = body || {};
    const done = () => json(req, res, 200, boot(me));
    const no = m => err(req, res, 403, m || 'This is kept by the director and the kitchen.');
    if (P === 'boot') { await tick(); json(req, res, 200, boot(me)); return; }
    const c = cfg(), L = list();
    const item = id => c.items.find(i => i.id === id);
    const ln = id => L.lines.find(x => x.id === id);

    // Low, Out or Stocked on any item, from anyone
    if (P === 'mark') { const it = item(b.id); if (!it) { err(req, res, 404, 'That item is not in the pantry.'); return; }
      const st = ['ok', 'low', 'out'].includes(b.status) ? b.status : 'ok';
      it.status = st; it.markedBy = me; it.markedAt = Date.now();
      if (st === 'ok') { L.lines = L.lines.filter(x => !(x.item === it.id && (x.stage === 'collect' || x.stage === 'reorder') && (x.why === 'low' || x.why === 'out'))); }
      else lineFor(c, L, it, st, me, clip(b.note, 200));
      saveCfg(c); saveList(L); done(); return; }

    // a request for something, matched to a pantry item when it is one, or a line of its own for the kitchen to place
    if (P === 'request') { const name = clip(b.name, 120); if (!name) { err(req, res, 400, 'Type what is needed.'); return; }
      // a facilities request, something to fix or look at, becomes a task for the director and the shopper, with its photo
      if (b.section === 'facilities') {
        const T = tasks(), id = newId('t'); let photo = '';
        if (b.photo && typeof b.photo === 'string') { try { photo = await keepPhoto(b.photo, id); } catch (e) { log('Kitchen TREE photo not kept', e.message); err(req, res, e.big ? 413 : 502, e.big ? 'That photo is too large.' : 'The photo could not be kept, so the request is not sent yet. Try again.'); return; } }
        T.list.push({ id, title: name, notes: clip(b.note, 600), area: 'Facilities', who: 'Both', due: '', repeat: null, by: me, at: Date.now(), done: [], request: true, photo });
        saveTasks(T); log('Kitchen TREE facilities request from', me);
        for (const n of new Set([...shoppers(), ...directors()])) if (nameKey(n) !== nameKey(me)) pushTo(n, { title: 'Kitchen TREE', body: 'Facilities request from ' + me + '. ' + name, url: 'kitchen.html?go=tasks', tag: 'kitchen-fac-' + id }).catch(() => {});
        done(); return;
      }
      const section = SECTIONS[b.section] ? b.section : 'other';
      const it = c.items.find(i => nameKey(i.name) === nameKey(name) && (i.section === section || !b.section)) || c.items.find(i => nameKey(i.name) === nameKey(name));
      if (it) { it.status = 'out'; it.markedBy = me; it.markedAt = Date.now(); lineFor(c, L, it, 'request', me, clip(b.note, 200)); }
      else lineFor(c, L, null, b.task ? 'task' : 'request', me, clip(b.note, 200), { name, section, amount: b.amount, store: canSetStores(role) || role === 'shopper' ? (storeOf(c, b.store) ? b.store : '') : '' });
      saveCfg(c); saveList(L); done(); return; }

    // the shopper checks lines off, or moves one to another store or to next week
    if (P === 'line') { const x = ln(b.id); if (!x) { err(req, res, 404, 'That line is no longer on the list.'); return; }
      if (b.do === 'got' || b.do === 'undo') { if (x.stage !== 'trip' && !x.late) { err(req, res, 400, 'That line is not on the trip.'); return; }
        x.state = b.do === 'got' ? 'got' : ''; x.gotBy = b.do === 'got' ? me : ''; if (x.late && b.do === 'got') x.stage = 'trip'; }
      else if (b.do === 'store') { const s = storeOf(c, b.store); if (!s) { err(req, res, 400, 'Choose a store.'); return; }
        if (!(canSetStores(role) || role === 'shopper')) return no();
        x.movedFrom = x.store; x.store = s.id; if (s.direct) { x.stage = 'reorder'; x.state = ''; } else if (x.stage === 'reorder') x.stage = L.trip && !L.trip.done ? 'trip' : 'collect';
        // a kitchen or director choice for a pantry item keeps that store for the item from now on
        if (b.keep && canSetStores(role) && x.item && item(x.item)) item(x.item).store = s.id;
        if (b.keep && canSetStores(role) && x.item && item(x.item) && c.groups.some(g => g.id === b.group)) item(x.item).group = b.group;
        if (b.keep && canSetStores(role) && !x.item) { const it = { id: newId('i'), name: x.name, store: s.id, group: c.groups.some(g => g.id === b.group) ? b.group : guessGroup(x.name), section: x.section, from: '', amount: x.amount || '', status: 'out', weekly: false, perUse: false, by: me, at: Date.now() }; c.items.push(it); x.item = it.id; } }
      else if (b.do === 'later') { if (!(canSetStores(role) || role === 'shopper')) return no(); x.stage = 'collect'; x.state = ''; x.late = true; x.note = [x.note, 'Moved to next week'].filter(Boolean).join('. '); }
      else if (b.do === 'ordered' || b.do === 'na') { if (role !== 'director') return no('The director orders the Costco delivery.'); if (x.stage !== 'delivery') { err(req, res, 400, 'That line is not waiting on the delivery.'); return; } x.state = b.do === 'ordered' ? 'ordered' : 'na'; x.orderedBy = me;
        if (b.do === 'na') { x.stage = L.trip && !L.trip.done ? 'trip' : 'collect'; x.state = ''; x.note = [x.note, 'Costco delivery did not have it'].filter(Boolean).join('. '); } }
      else if (b.do === 'reordered') { if (!canSetStores(role)) return no(); restock(c, x); finish(L, x, 'reordered', me); }
      else if (b.do === 'remove') { if (!(canSetStores(role) || nameKey(x.by) === nameKey(me))) return no('Only the person who added it, the kitchen or the director takes it off.'); L.lines = L.lines.filter(y => y !== x); }
      else { err(req, res, 400, 'That is not something a line can do.'); return; }
      saveCfg(c); saveList(L); done(); return; }

    // Done shopping, for the whole trip or one store
    if (P === 'doneshopping') { if (!(role === 'shopper' || role === 'director')) return no('The shopper marks the trip done.');
      const one = b.store && storeOf(c, b.store) ? b.store : '';
      for (const x of L.lines.filter(y => y.stage === 'trip' && y.state === 'got' && (!one || y.store === one))) { restock(c, x); finish(L, x, 'got', x.gotBy || me); }
      if (L.trip && !L.lines.some(y => y.stage === 'trip')) L.trip.done = true;
      saveCfg(c); saveList(L); done(); return; }

    // the director closes a part by hand, such as when the clock time has not come yet
    if (P === 'close') { if (role !== 'director') return no('The director closes the list by hand.');
      if (b.which === 'costco') closeCostco(me); else await closeWeek(me); done(); return; }

    // the pantry's items and the menu words, by the director and the kitchen
    if (P === 'item') { if (!canSetStores(role)) return no();
      if (b.remove) { c.items = c.items.filter(i => i.id !== b.id); for (const r of c.rules || []) r.items = (r.items || []).filter(i => i !== b.id); L.lines = L.lines.filter(x => !(x.item === b.id && x.stage !== 'trip')); saveCfg(c); saveList(L); done(); return; }
      const it = item(b.id) || (b.id ? null : { id: newId('i'), status: 'ok', by: me, at: Date.now() });
      if (!it) { err(req, res, 404, 'That item is not in the pantry.'); return; }
      const name = clip(b.name, 80); if (!name) { err(req, res, 400, 'Type the item\'s name.'); return; }
      Object.assign(it, { name, store: storeOf(c, b.store) ? b.store : '', group: c.groups.some(g => g.id === b.group) ? b.group : (it.group || guessGroup(name)), section: SECTIONS[b.section] ? b.section : 'kitchen', from: clip(b.from, 60), amount: clip(b.amount, 40), weekly: !!b.weekly, perUse: !!b.perUse });
      if (!c.items.includes(it)) c.items.push(it);
      // the item's open lines follow its new name and store, except what is already on the trip
      for (const x of L.lines) if (x.item === it.id && x.stage !== 'trip') { x.name = it.name; x.section = it.section; x.amount = it.amount; if (x.store !== it.store) { x.store = it.store; x.stage = isDirect(c, it.store) ? 'reorder' : (x.stage === 'reorder' ? 'collect' : x.stage); } }
      saveCfg(c); saveList(L); done(); return; }
    if (P === 'rules') { if (!canSetStores(role)) return no();
      c.rules = (Array.isArray(b.rules) ? b.rules : []).slice(0, 200).map(r => ({ id: /^r[a-f0-9]{10}$/.test(r.id) ? r.id : newId('r'), word: clip(r.word, 40).toLowerCase(), items: (Array.isArray(r.items) ? r.items : []).filter(id => item(id)).slice(0, 12) })).filter(r => r.word);
      saveCfg(c); done(); return; }
    if (P === 'settings') { if (!canSetStores(role)) return no();
      const t = (v, d) => ({ day: Number.isInteger(+v.day) && +v.day >= 0 && +v.day <= 6 ? +v.day : d.day, at: /^\d{2}:\d{2}$/.test(String(v.at || '')) ? v.at : d.at });
      if (b.close) c.close = t(b.close, c.close); if (b.costcoClose) c.costcoClose = t(b.costcoClose, c.costcoClose);
      if ('costcoDelivery' in b) c.costcoDelivery = !!b.costcoDelivery;
      if ('shopperEmail' in b) { const e = clip(b.shopperEmail, 120); if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { err(req, res, 400, 'That email address does not look right.'); return; } c.shopperEmail = e; }
      if (Array.isArray(b.groups)) { const keep = b.groups.slice(0, 30).map(g => ({ id: /^[a-z0-9-]{1,30}$/.test(g.id) ? g.id : 'g' + crypto.randomBytes(3).toString('hex'), name: clip(g.name, 40) })).filter(g => g.name);
        if (!keep.length) { err(req, res, 400, 'Keep at least one group.'); return; }
        const ids = new Set(keep.map(g => g.id)); for (const it of c.items) if (!ids.has(it.group)) it.group = keep[keep.length - 1].id; c.groups = keep; }
      if (Array.isArray(b.stores)) { const keep = b.stores.slice(0, 20).map(s => ({ id: /^[a-z0-9-]{1,30}$/.test(s.id) ? s.id : 's' + crypto.randomBytes(3).toString('hex'), name: clip(s.name, 40), direct: !!s.direct })).filter(s => s.name);
        if (!keep.some(s => s.direct)) keep.push(STORES[STORES.length - 1]);
        const ids = new Set(keep.map(s => s.id)); for (const it of c.items) if (!ids.has(it.store)) it.store = ''; for (const x of L.lines) if (x.store && !ids.has(x.store)) x.store = '';
        c.stores = keep; }
      saveCfg(c); saveList(L); done(); return; }

    // a Kitchen TREE only sign-in for the shopper, added by the director. It chooses its own four numbers at first sign-in.
    if (P === 'shopper') { if (role !== 'director') return no('Only the director adds a sign-in.');
      const name = cleanName(b.name); if (!okName(name)) { err(req, res, 400, 'Type the first name, letters only.'); return; }
      let a = accountFor(name);
      if (a && !a.shopper && !b.remove) { err(req, res, 409, name + ' already has a TREE sign-in.'); return; }
      if (b.remove) { if (!a || !a.shopper) { err(req, res, 404, 'That sign-in is not here.'); return; } accounts.list.splice(accounts.list.indexOf(a), 1); }
      else if (b.reset) { if (!a) { err(req, res, 404, 'That sign-in is not here.'); return; } a.code = ''; a.v = (a.v || 0) + 1; }
      else if (!a) { a = { name, addedBy: me, addedAt: Date.now(), code: '', v: 0, room: '', director: false, kitchen: true, shopper: true }; accounts.list.push(a); }
      if (!(await saveAccounts(me))) { err(req, res, 502, 'The sign-in could not be saved. Try again.'); return; }
      log('Kitchen TREE sign-in', b.remove ? 'removed' : b.reset ? 'cleared' : 'saved', 'for', name, 'by', me); done(); return; }

    // the shared tasks, the director and the shopper only
    if (P.startsWith('task')) { if (!canTasks(role)) return no('Tasks are shared by the director and the shopper.');
      const T = tasks(); const t = T.list.find(x => x.id === b.id);
      if (P === 'task') {
        if (b.remove) { T.list = T.list.filter(x => x.id !== b.id); saveTasks(T); done(); return; }
        const title = clip(b.title, 120); if (!title) { err(req, res, 400, 'Type the task.'); return; }
        const x = t || { id: newId('t'), by: me, at: Date.now(), done: [] };
        const every = Math.max(0, Math.min(365, parseInt(b.every, 10) || 0)), unit = ['day', 'week', 'month', 'year'].includes(b.unit) ? b.unit : 'week';
        Object.assign(x, { title, notes: clip(b.notes, 600), area: ['Facilities', 'Garden', 'Farm'].includes(b.area) ? b.area : 'Facilities', who: clip(b.who, 40) || 'Both', due: /^\d{4}-\d{2}-\d{2}$/.test(b.due || '') ? b.due : '', repeat: every ? { every, unit } : null });
        if (!t) T.list.push(x); saveTasks(T); done(); return; }
      if (P === 'taskdone') { if (!t) { err(req, res, 404, 'That task is not here.'); return; }
        let photo = '';
        if (b.photo && typeof b.photo === 'string') { const buf = Buffer.from(b.photo.replace(/^data:image\/\w+;base64,/, ''), 'base64'); if (buf.length > 6e6) { err(req, res, 413, 'That photo is too large.'); return; }
          try { photo = await keepPhoto(b.photo, t.id + 'd'); } catch (e) { log('Kitchen TREE photo not kept', e.message); err(req, res, 502, 'The photo could not be kept. The task is not marked done yet. Try again.'); return; } }
        t.done = (t.done || []).concat([{ at: Date.now(), by: me, note: clip(b.note, 300), photo }]).slice(-30);
        if (t.repeat) { const step = { day: 1, week: 7 }[t.repeat.unit]; let d = t.due || dayOf(Date.now());
          const bump = x => step ? addDays(x, step * t.repeat.every) : (() => { const z = new Date(x + 'T12:00:00Z'); if (t.repeat.unit === 'month') z.setUTCMonth(z.getUTCMonth() + t.repeat.every); else z.setUTCFullYear(z.getUTCFullYear() + t.repeat.every); return z.toISOString().slice(0, 10); })();
          d = bump(d); while (d <= dayOf(Date.now())) d = bump(d); t.due = d; }
        else t.closedAt = Date.now();
        saveTasks(T); done(); return; }
      if (P === 'taskopen') { if (!t) { err(req, res, 404, 'That task is not here.'); return; } delete t.closedAt; saveTasks(T); done(); return; }
    }
    err(req, res, 404, 'Kitchen TREE does not know that request.');
  }

  return { IDS, handle, isShopper, tick, closeAt, menuNeeds, _cfg: cfg };
};
