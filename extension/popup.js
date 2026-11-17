'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const STORE = { amazon: 'Amazon', bestbuy: 'Best Buy', newegg: 'Newegg', bh: 'B&H', walmart: 'Walmart', dell: 'Dell', hp: 'HP', lenovo: 'Lenovo', microcenter: 'Micro Center', costco: 'Costco', acer: 'Acer', asus: 'ASUS', msi: 'MSI', other: 'Other' };
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch { return '#'; } };
function ago(t) {
  const s = (Date.now() - new Date(t)) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago';
}
const ask = (type, data = {}) => new Promise(r => chrome.runtime.sendMessage({ type, ...data }, r));
let state;

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const sort = $('#sort').value;
  let list = Object.values(state.items).map(it => {
    const h = it.history || [];
    const cur = h.length ? h[h.length - 1].price : null;
    const prev = h.length > 1 ? h[h.length - 2].price : null;
    const prices = h.map(x => x.price);
    return { it, cur, prev, low: prices.length ? Math.min(...prices) : null, high: prices.length ? Math.max(...prices) : null };
  }).filter(x => !q || (x.it.name + ' ' + x.it.gpu + ' ' + STORE[x.it.retailer]).toLowerCase().includes(q));
  const cmp = {
    seen: (a, b) => String(b.it.lastSeenAt || '').localeCompare(String(a.it.lastSeenAt || '')),
    drop: (a, b) => ((a.cur ?? 0) - (a.high ?? 0)) - ((b.cur ?? 0) - (b.high ?? 0)),
    price: (a, b) => (a.cur ?? 1e9) - (b.cur ?? 1e9)
  }[sort];
  list.sort(cmp);
  $('#empty').hidden = list.length > 0 || !!q;
  $('#items').innerHTML = list.map(({ it, cur, prev, low, high }) => {
    const d = prev != null && cur != null ? cur - prev : null;
    const hit = it.target && cur != null && cur <= it.target;
    return `<div class="item">
      <div class="top">
        <a class="name" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${esc(it.name)}</a>
        <div class="price">${money(cur)}</div>
      </div>
      <div class="meta">
        <span><span class="gpu">${esc(it.gpu)}</span> ${esc(STORE[it.retailer] || it.retailer)} · ${it.lastSeenAt ? ago(it.lastSeenAt) : '—'}${it.available === false ? ' · <span class="oos">out of stock</span>' : ''}</span>
        <span>${d ? `<span class="${d < 0 ? 'down' : 'up'}">${d < 0 ? '▼' : '▲'} ${money(Math.abs(d))}</span>` : ''}${low != null && high !== low ? ` low ${money(low)}` : ''}</span>
      </div>
      <div class="ctl">
        <input type="number" min="0" step="10" placeholder="Target $" value="${it.target ?? ''}" data-target="${esc(it.id)}" aria-label="Target price">
        <span class="grow">${hit ? '<span class="hit">At or below target</span>' : it.target && cur != null ? `<span style="color:var(--m)">${money(cur - it.target)} to go</span>` : ''}</span>
        <button class="x" data-remove="${esc(it.id)}" title="Stop tracking">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function refresh() {
  state = await ask('list');
  const s = state.settings;
  for (const k of ['ghOwner', 'ghRepo', 'ghToken']) if (document.activeElement !== $('#' + k)) $('#' + k).value = s[k] || '';
  $('#autoAdd').checked = !!s.autoAdd; $('#notify').checked = !!s.notify;
  const st = state.syncState || {};
  $('#syncStatus').textContent = st.msg ? `${st.msg}${st.at ? ' · ' + ago(st.at) : ''}` : '';
  $('#syncStatus').className = 'status ' + (st.ok ? 'ok' : st.msg ? 'err' : '');
  const site = s.ghOwner && s.ghRepo ? `https://${s.ghOwner.toLowerCase()}.github.io/${s.ghRepo}/` : null;
  $('#site').hidden = !site; if (site) $('#site').href = site;
  render();
}

document.addEventListener('click', async e => {
  const t = e.target;
  if (t.matches('.tab')) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b === t));
    document.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== t.dataset.tab; });
  }
  if (t.dataset.remove) {
    if (confirm('Stop tracking this laptop? Its saved prices are removed from the extension.')) { await ask('untrack', { id: t.dataset.remove }); refresh(); }
  }
  if (t.id === 'save' || t.id === 'syncNow') {
    await ask('settings', { settings: { ghOwner: $('#ghOwner').value, ghRepo: $('#ghRepo').value, ghToken: $('#ghToken').value, autoAdd: $('#autoAdd').checked, notify: $('#notify').checked } });
    if (t.id === 'syncNow') { $('#syncStatus').textContent = 'Syncing…'; $('#syncStatus').className = 'status'; await ask('sync'); }
    else { $('#syncStatus').textContent = 'Saved.'; $('#syncStatus').className = 'status ok'; setTimeout(refresh, 800); return; }
    refresh();
  }
  if (t.id === 'export') {
    const blob = new Blob([JSON.stringify({ format: 'rtx-deal-hunter-feed', version: 2, generated: new Date().toISOString(), items: Object.values(state.items) }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rtx-deal-hunter-extension.json'; a.click();
  }
});
document.addEventListener('change', async e => {
  if (e.target.dataset.target) { await ask('target', { id: e.target.dataset.target, target: parseFloat(e.target.value) || 0 }); refresh(); }
  if (e.target.id === 'autoAdd' || e.target.id === 'notify') await ask('settings', { settings: { autoAdd: $('#autoAdd').checked, notify: $('#notify').checked } });
  if (e.target.id === 'sort') render();
});
$('#q').addEventListener('input', render);
refresh();
