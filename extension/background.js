/* RTX Deal Hunter Companion · background service worker
 * Keeps your tracked laptops and their price history in extension storage,
 * shows price-drop notifications, and (optionally) saves everything to
 * manual.json in your GitHub repository so the website can show it.
 */
'use strict';

const GPU_VRAM = { '5050': 8, '5060': 8, '5070': 8, '5070ti': 12, '5080': 16, '5090': 24 };
const GPU_LABEL = { '5050': 'RTX 5050', '5060': 'RTX 5060', '5070': 'RTX 5070', '5070ti': 'RTX 5070 Ti', '5080': 'RTX 5080', '5090': 'RTX 5090' };
const DEFAULTS = { autoAdd: true, notify: true, ghOwner: '', ghRepo: 'rtx-deal-hunter', ghToken: '' };
const SAME_PRICE_GAP = 6 * 3600e3;   // log an unchanged price at most every 6 hours
const MAX_HISTORY = 400;
const GH_API = 'https://api.github.com';

// Run storage updates one at a time so two tabs can't overwrite each other.
let queue = Promise.resolve();
const serial = fn => (queue = queue.then(fn, fn));

async function load() {
  const d = await chrome.storage.local.get(['items', 'settings', 'syncState', 'removed']);
  return { items: d.items || {}, settings: { ...DEFAULTS, ...(d.settings || {}) }, syncState: d.syncState || {}, removed: d.removed || [] };
}
const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const short = s => (s.length > 60 ? s.slice(0, 57) + '…' : s);

function notify(id, title, message) {
  chrome.notifications.create('rtx-' + id + '-' + Date.now(), { type: 'basic', iconUrl: 'icons/icon128.png', title, message, priority: 1 });
}

async function onSeen(msg, force) {
  const { items, settings, removed } = await load();
  const p = msg.product || {};
  if (!p.id || !p.name) return { tracked: false };
  let it = items[p.id];
  let added = false;
  if (!it) {
    const wanted = force || (settings.autoAdd && p.gpu && p.isLaptop && !removed.includes(p.id));
    if (!wanted) return { tracked: false, canTrack: !!p.gpu };
    if (!p.gpu) return { tracked: false, canTrack: false };
    it = {
      id: p.id, name: p.name.slice(0, 140), url: p.url, retailer: p.retailer, gpu: GPU_LABEL[p.gpu] || p.gpu,
      vram: GPU_VRAM[p.gpu], ...p.specs, fullName: (p.fullName || '').slice(0, 300),
      specsFrom: 'Read from the product title by the browser extension. Check TGP, cooling and upgradeability yourself.',
      addedAt: new Date().toISOString(), history: []
    };
    items[p.id] = it; added = true;
    const r = removed.indexOf(p.id); if (r >= 0) { removed.splice(r, 1); await chrome.storage.local.set({ removed }); }
  } else {
    it.url = p.url || it.url;
  }

  const now = new Date();
  const last = it.history[it.history.length - 1] || null;
  let recorded = false;
  if (msg.price != null) {
    if (!last || last.price !== msg.price || now - new Date(last.t) > SAME_PRICE_GAP) {
      it.history.push({ t: now.toISOString(), price: msg.price, status: 'seen', source: 'Browser extension', note: msg.seller ? 'Seller: ' + String(msg.seller).slice(0, 60) : '' });
      if (it.history.length > MAX_HISTORY) it.history.splice(0, it.history.length - MAX_HISTORY);
      recorded = true;
    }
  }
  if (msg.listPrice && msg.listPrice > (msg.price || 0)) it.listPrice = msg.listPrice;
  it.available = msg.available !== false;
  it.checkedAt = now.toISOString();
  it.checkStatus = 'ok';
  it.lastSeenAt = now.toISOString();
  await chrome.storage.local.set({ items });
  if (recorded || added) scheduleSync();

  // Alerts
  if (recorded && settings.notify && msg.price != null) {
    if (it.target && msg.price <= it.target && (!last || last.price > it.target)) {
      notify(it.id, 'Target price reached', `${short(it.name)} is now ${money(msg.price)} (your target: ${money(it.target)})`);
    } else if (last && msg.price < last.price) {
      notify(it.id, `Price drop: −${money(last.price - msg.price)}`, `${short(it.name)} is now ${money(msg.price)}, down from ${money(last.price)}`);
    }
  }
  const prices = it.history.map(h => h.price);
  return { tracked: true, added, recorded, prev: last ? last.price : null, low: prices.length ? Math.min(...prices) : null, count: prices.length, target: it.target || null };
}

/* ---------------- GitHub sync (manual.json) ---------------- */
function scheduleSync() { chrome.alarms.create('sync', { delayInMinutes: 1 }); }
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'sync') serial(() => sync().catch(() => {})); });

const b64encode = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64decode = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

function mergeItems(remoteItems, localItems, removed) {
  const out = {};
  for (const r of remoteItems || []) if (r && r.id && !removed.includes(r.id)) out[r.id] = { ...r, history: [...(r.history || [])] };
  for (const l of Object.values(localItems)) {
    const r = out[l.id];
    if (!r) { out[l.id] = { ...l, history: [...l.history] }; continue; }
    const seen = new Set(r.history.map(h => h.t + '|' + h.price));
    const hist = [...r.history, ...l.history.filter(h => !seen.has(h.t + '|' + h.price))].sort((a, b) => Date.parse(a.t) - Date.parse(b.t)).slice(-MAX_HISTORY);
    const newer = Date.parse(l.lastSeenAt || 0) >= Date.parse(r.lastSeenAt || 0) ? l : r;
    out[l.id] = { ...r, ...l, available: newer.available, checkedAt: newer.checkedAt, lastSeenAt: newer.lastSeenAt, target: l.target ?? r.target, history: hist };
  }
  return out;
}

async function sync() {
  const { items, settings, removed } = await load();
  const setState = s => chrome.storage.local.set({ syncState: { ...s, at: new Date().toISOString() } });
  if (!settings.ghToken || !settings.ghOwner || !settings.ghRepo) { await setState({ ok: false, msg: 'GitHub sync is not set up' }); return { ok: false, msg: 'GitHub sync is not set up' }; }
  const url = `${GH_API}/repos/${encodeURIComponent(settings.ghOwner)}/${encodeURIComponent(settings.ghRepo)}/contents/manual.json`;
  const headers = { Authorization: `Bearer ${settings.ghToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      let sha, remote = { items: [] };
      const g = await fetch(url, { headers, cache: 'no-store' });
      if (g.status === 200) { const j = await g.json(); sha = j.sha; try { remote = JSON.parse(b64decode(j.content)); } catch { /* start fresh */ } }
      else if (g.status === 401) throw new Error('GitHub rejected the token. Check it and its expiry date.');
      else if (g.status === 404 && attempt === 0) {
        const repoCheck = await fetch(`${GH_API}/repos/${encodeURIComponent(settings.ghOwner)}/${encodeURIComponent(settings.ghRepo)}`, { headers });
        if (repoCheck.status === 404) throw new Error('Repository not found, or the token has no access to it.');
      } else if (g.status !== 404) throw new Error('GitHub error ' + g.status);

      const merged = mergeItems(remote.items, items, removed);
      const doc = {
        format: 'rtx-deal-hunter-feed', version: 2, generated: new Date().toISOString(),
        source: 'RTX Deal Hunter Companion (browser extension)', removed,
        items: Object.values(merged).sort((a, b) => a.id.localeCompare(b.id))
      };
      const body = { message: `Extension prices ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, content: b64encode(JSON.stringify(doc, null, 1) + '\n') };
      if (sha) body.sha = sha;
      const r = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) {
        await chrome.storage.local.set({ items: merged });   // pull in prices recorded on your other computers
        const n = doc.items.reduce((a, i) => a + i.history.length, 0);
        const st = { ok: true, msg: `Synced ${doc.items.length} laptops, ${n} prices` };
        await setState(st); return st;
      }
      if (r.status === 409 || r.status === 422) continue;   // file changed meanwhile: re-read and retry
      if (r.status === 401) throw new Error('GitHub rejected the token. Check it and its expiry date.');
      if (r.status === 403 || r.status === 404) throw new Error('The token can\'t write to this repository. Give it "Contents: Read and write" access.');
      throw new Error('GitHub error ' + r.status);
    }
    throw new Error('GitHub kept reporting a conflict. Try again in a minute.');
  } catch (e) {
    const st = { ok: false, msg: e.message || String(e) };
    await setState(st); return st;
  }
}

/* ---------------- messages from pages and the popup ---------------- */
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const run = async () => {
    switch (msg.type) {
      case 'seen': return onSeen(msg, false);
      case 'track': return onSeen(msg, true);
      case 'list': return load();
      case 'untrack': {
        const { items, removed } = await load();
        delete items[msg.id];
        if (!removed.includes(msg.id)) removed.push(msg.id);
        await chrome.storage.local.set({ items, removed }); scheduleSync(); return { ok: true };
      }
      case 'target': {
        const { items } = await load();
        if (items[msg.id]) { items[msg.id].target = msg.target > 0 ? msg.target : null; await chrome.storage.local.set({ items }); scheduleSync(); }
        return { ok: true };
      }
      case 'settings': {
        const { settings } = await load();
        const next = { ...settings, ...msg.settings };
        next.ghOwner = String(next.ghOwner || '').trim(); next.ghRepo = String(next.ghRepo || '').trim(); next.ghToken = String(next.ghToken || '').trim();
        await chrome.storage.local.set({ settings: next }); return { ok: true };
      }
      case 'sync': return sync();
      default: return null;
    }
  };
  serial(run).then(reply, e => reply({ ok: false, msg: String(e) }));
  return true;   // reply asynchronously
});
