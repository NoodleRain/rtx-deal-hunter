#!/usr/bin/env node
/**
 * RTX Deal Hunter · automatic price checker
 *
 * Runs on a schedule in GitHub Actions (see .github/workflows/check-prices.yml).
 * Free: no servers, no paid APIs. Node 20+, no npm packages.
 *
 * Sources:
 *   1. Best Buy Products API (official). Needs a free key in the BESTBUY_API_KEY
 *      repository secret. Discovers RTX 50-series laptops and reads their prices.
 *   2. Product pages you list in tracked.json. Reads the price the retailer
 *      publishes in the page's structured data (schema.org JSON-LD / meta tags).
 *      Honors robots.txt, sends one request at a time, and never retries around
 *      blocks or CAPTCHAs. If a retailer blocks automated access, the item is
 *      reported as blocked so you can check it by hand in the site.
 *
 * Output: feed.json (read by the website). Price history is kept in the feed.
 */
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url);
const FEED = new URL('feed.json', ROOT);
const TRACKED = new URL('tracked.json', ROOT);
const UA = 'RTXDealHunterBot/1.0 (personal price tracker; runs a few times a day; +https://github.com/)';
const MIN_PRICE = 200, MAX_PRICE = 15000;
const MAX_HISTORY = 400;
const KEEP_SAME_PRICE_HOURS = 24;   // log an unchanged price at most once a day
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = new Date().toISOString();
const log = (...a) => console.log(...a);

/* ---------------- helpers ---------------- */
async function readJSON(url, fallback) {
  try { return JSON.parse(await readFile(url, 'utf8')); } catch { return fallback; }
}
async function get(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...(opts.headers || {}) } });
  } finally { clearTimeout(t); }
}
const toNum = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : null; };
const okPrice = p => p != null && p >= MIN_PRICE && p <= MAX_PRICE;

function parseGpu(s) {
  s = String(s || '').toLowerCase().replace(/\s|-/g, '');
  if (s.includes('5070ti')) return '5070ti';
  for (const k of ['5090', '5080', '5070', '5060', '5050']) if (s.includes('rtx' + k) || s.includes('geforce' + k) || s.includes(k + 'laptop')) return k;
  return null;
}
/** Pull specs out of a listing title like
 * "ASUS - ROG Strix G16 16" 240Hz QHD+ Gaming Laptop - Intel Core Ultra 9 275HX - 32GB Memory - NVIDIA GeForce RTX 5070 Ti - 1TB SSD" */
function specsFromTitle(name) {
  const n = String(name);
  const ram = n.match(/(\d{2,3})\s*GB\s*(?:DDR5|DDR4|LPDDR5X?|Memory|RAM)/i);
  const ssd = n.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:PCIe\s*)?(?:NVMe\s*)?SSD/i);
  const size = n.match(/(1[3-8](?:\.\d)?)\s*(?:"|”|''|-inch|inch|in\b)/i);
  const hz = n.match(/(\d{2,3})\s*Hz/i);
  const cpu = n.match(/(Intel\s+Core\s+(?:Ultra\s+)?[579i][\w-]*\s*[\w-]*|AMD\s+Ryzen\s+(?:AI\s+)?\d\s+(?:HX\s+)?\w+)/i);
  const out = {};
  if (ram) out.ram = +ram[1];
  if (ssd) out.storage = Math.round(ssd[2].toUpperCase() === 'TB' ? +ssd[1] * 1024 : +ssd[1]);
  if (size) out.displaySize = +size[1];
  if (hz) out.hz = +hz[1];
  if (cpu) out.cpu = cpu[1].replace(/\s+/g, ' ').trim();
  if (/OLED/i.test(n)) out.panel = 'OLED'; else if (/mini[\s-]?led/i.test(n)) out.panel = 'Mini-LED';
  if (/4K|UHD|3840/i.test(n)) out.displayRes = '4K';
  else if (/QHD|WQXGA|2\.5K|2560|1600p|1440p/i.test(n)) out.displayRes = 'QHD';
  else if (/FHD|1080p|1920|WUXGA/i.test(n)) out.displayRes = 'FHD';
  return out;
}

const GPU_LABEL = { '5050': 'RTX 5050', '5060': 'RTX 5060', '5070': 'RTX 5070', '5070ti': 'RTX 5070 Ti', '5080': 'RTX 5080', '5090': 'RTX 5090' };
/** "ASUS - ROG Strix G16 16\" ... Gaming Laptop - Intel ... - 32GB Memory - ..." → "ASUS ROG Strix G16 (RTX 5070 Ti, 32GB, 1TB)" */
function shortName(full, gpu) {
  const sp = specsFromTitle(full);
  let n = String(full).replace(/^([^-]+?)\s+-\s+/, '$1 ').replace(/\s+-\s+.*$/, '');
  n = n.replace(/\s+\d{2}(\.\d)?\s*("|”|''|-inch|inch)[\s\S]*$/i, '').replace(/\s+(Gaming\s+)?(Laptop|Notebook)\s*$/i, '').trim();
  const extras = [GPU_LABEL[gpu], sp.ram && sp.ram + 'GB', sp.storage && (sp.storage >= 1024 ? sp.storage / 1024 + 'TB' : sp.storage + 'GB')].filter(Boolean);
  return (n + ' (' + extras.join(', ') + ')').slice(0, 140);
}

/* ---------------- robots.txt ---------------- */
const robotsCache = new Map();
async function robotsAllows(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    let rules = [];
    try {
      const r = await get(u.origin + '/robots.txt', { timeout: 10000 });
      if (r.ok) rules = parseRobots(await r.text());
      else if (r.status === 401 || r.status === 403) rules = [{ allow: false, path: '/' }];
    } catch { /* unreachable robots.txt: treat as no rules */ }
    robotsCache.set(u.origin, rules);
  }
  const path = u.pathname + u.search;
  let best = null;
  for (const rule of robotsCache.get(u.origin)) {
    if (!rule.path) continue;
    const re = new RegExp('^' + rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))) best = rule;
  }
  return best ? best.allow : true;
}
function parseRobots(txt) {
  // Rules from groups for our bot name, otherwise from "User-agent: *"
  const groups = []; let cur = null, lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === 'allow' || k === 'disallow') cur.rules.push({ allow: k === 'allow', path: v });
  }
  const mine = groups.filter(g => g.agents.some(a => a !== '*' && 'rtxdealhunterbot'.includes(a)));
  return (mine.length ? mine : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.rules);
}

/* ---------------- source 1: Best Buy API ---------------- */
async function bestBuy(cfg, key, sources) {
  const found = [];
  if (!key) { sources.push({ id: 'bestbuy-api', name: 'Best Buy API', status: 'off', detail: 'No BESTBUY_API_KEY secret set. See README.' }); return found; }
  const show = 'sku,name,salePrice,regularPrice,onSale,url,onlineAvailability,manufacturer,modelNumber';
  const gpus = cfg.gpus || ['5050', '5060', '5070', '5070 Ti', '5080', '5090'];
  const seen = new Set(); let calls = 0, errors = 0;
  const category = cfg.categoryId || 'abcat0502000';   // Best Buy "All Laptops"
  const queries = gpus.map(g => `(search=rtx&search=${encodeURIComponent(g.replace(/\s+/g, '&search='))})`);
  const skuList = (cfg.skus || []).filter(s => /^\d+$/.test(String(s)));
  if (skuList.length) queries.push(`(sku in(${skuList.join(',')}))`);
  for (const q of queries) {
    const filter = q.startsWith('(sku') ? q : q.replace(/\)$/, `&categoryPath.id=${category})`);
    for (let page = 1; page <= (cfg.maxPages || 2); page++) {
      const url = `${process.env.BESTBUY_API_BASE || 'https://api.bestbuy.com'}/v1/products${filter}?apiKey=${encodeURIComponent(key)}&format=json&show=${show}&pageSize=100&page=${page}`;
      let data;
      try {
        calls++;
        const r = await get(url);
        if (r.status === 403 || r.status === 401) throw new Error('API key rejected (HTTP ' + r.status + ')');
        if (r.status === 429) { await sleep(3000); page--; if (++errors > 5) throw new Error('rate limited'); continue; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        data = await r.json();
      } catch (e) {
        errors++; log('  Best Buy error:', e.message.replace(key, '***'));
        if (/key rejected/.test(e.message)) { sources.push({ id: 'bestbuy-api', name: 'Best Buy API', status: 'error', detail: e.message }); return found; }
        break;
      }
      for (const p of data.products || []) {
        if (seen.has(p.sku)) continue; seen.add(p.sku);
        const gpu = parseGpu(p.name);
        if (!gpu || !/laptop|notebook/i.test(p.name)) continue;
        const price = toNum(p.salePrice);
        if (!okPrice(price)) continue;
        found.push({
          id: 'bb-' + p.sku, name: shortName(p.name, gpu),
          fullName: p.name, brandRaw: p.manufacturer, gpu, retailer: 'bestbuy', url: p.url,
          listPrice: toNum(p.regularPrice), price, available: p.onlineAvailability !== false,
          source: 'Best Buy API', ...specsFromTitle(p.name)
        });
      }
      await sleep(400);
      if (!data.totalPages || page >= data.totalPages) break;
    }
  }
  sources.push({ id: 'bestbuy-api', name: 'Best Buy API', status: errors && !found.length ? 'error' : 'ok', detail: `${found.length} RTX 50 laptops, ${calls} API calls${errors ? ', ' + errors + ' errors' : ''}` });
  return found;
}

/* ---------------- source 2: product pages ---------------- */
function* walk(node) {
  if (Array.isArray(node)) { for (const x of node) yield* walk(x); return; }
  if (!node || typeof node !== 'object') return;
  yield node;
  for (const k of ['@graph', 'mainEntity', 'itemListElement', 'item', 'hasVariant']) if (node[k]) yield* walk(node[k]);
}
function priceFromHtml(html) {
  // 1) schema.org JSON-LD Product → offers
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data = JSON.parse(m[1].trim()); } catch { continue; }
    for (const node of walk(data)) {
      const type = [].concat(node['@type'] || []).join(',');
      if (!/Product/i.test(type) || !node.offers) continue;
      for (const o of [].concat(node.offers)) {
        const cur = o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency);
        if (cur && cur !== 'USD') continue;
        const price = toNum(o.price ?? o.lowPrice ?? (o.priceSpecification && o.priceSpecification.price));
        if (okPrice(price)) return { price, available: !/OutOfStock|Discontinued|SoldOut/i.test(o.availability || ''), how: 'JSON-LD', name: node.name };
      }
    }
  }
  // 2) Store-specific markup (used mainly for archived copies of pages)
  const amz = html.match(/id=["']corePrice(?:Display_desktop)?_feature_div["'][\s\S]{0,4000}?class=["']a-offscreen["']>\s*\$([\d,]+\.\d{2})/i)
    || html.match(/id=["']priceblock_(?:our|deal)price["'][^>]*>\s*\$([\d,]+\.\d{2})/i);
  if (amz && okPrice(toNum(amz[1]))) return { price: toNum(amz[1]), available: true, how: 'Amazon price block' };
  const bb = html.match(/"customerPrice"\s*:\s*([\d.]+)/);
  if (bb && okPrice(toNum(bb[1]))) return { price: toNum(bb[1]), available: true, how: 'Best Buy price data' };
  // 3) Open Graph / product meta tags
  const meta = html.match(/<meta[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]*content=["']([\d.,]+)["']/i)
    || html.match(/<meta[^>]+content=["']([\d.,]+)["'][^>]*(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["']/i);
  if (meta && okPrice(toNum(meta[1]))) return { price: toNum(meta[1]), available: true, how: 'meta tag' };
  return null;
}
async function checkPages(items, sources) {
  const results = []; const byHost = {};
  for (const it of items) {
    const res = { id: it.id, url: it.url, host: '', status: '', detail: '' };
    try {
      const u = new URL(it.url); res.host = u.hostname;
      if (!/^https?:$/.test(u.protocol)) throw new Error('not http(s)');
      if (!(await robotsAllows(it.url))) { res.status = 'skipped'; res.detail = 'robots.txt does not allow automated access to this page'; }
      else {
        const r = await get(it.url, { headers: { Accept: 'text/html,application/xhtml+xml' } });
        if (r.status === 403 || r.status === 429 || r.status === 503) { res.status = 'blocked'; res.detail = `Retailer blocked automated access (HTTP ${r.status})`; }
        else if (!r.ok) { res.status = 'error'; res.detail = 'HTTP ' + r.status; }
        else {
          const html = (await r.text()).slice(0, 3_000_000);
          if (/captcha|are you a human|access denied|robot check/i.test(html.slice(0, 20000)) && !/application\/ld\+json/i.test(html)) { res.status = 'blocked'; res.detail = 'Retailer showed a bot check'; }
          else {
            const p = priceFromHtml(html);
            if (!p) { res.status = 'no-price'; res.detail = 'No machine-readable price on the page'; }
            else { res.status = 'ok'; res.detail = `Read from ${p.how}`; res.price = p.price; res.available = p.available; }
          }
        }
      }
    } catch (e) { res.status = 'error'; res.detail = e.name === 'AbortError' ? 'Timed out' : e.message; }
    log(`  ${res.status.padEnd(8)} ${it.name || it.url}${res.price ? ' $' + res.price : ''} ${res.detail}`);
    results.push(res);
    (byHost[res.host] ||= []).push(res.status);
    await sleep(+process.env.PAGE_DELAY_MS || (3000 + Math.random() * 2000));  // be gentle: one page every 3-5 s
  }
  for (const [host, sts] of Object.entries(byHost)) {
    const ok = sts.filter(s => s === 'ok').length;
    sources.push({ id: 'page:' + host, name: host, status: ok ? (ok === sts.length ? 'ok' : 'partial') : (sts[0] || 'error'), detail: `${ok}/${sts.length} pages read` });
  }
  return results;
}

/* ---------------- price history from the Wayback Machine ----------------
 * The retailer blocks us today, but web.archive.org keeps public snapshots of
 * many product pages. We read the price the page showed on each snapshot date.
 * Only archive.org is contacted, slowly, and each item is backfilled once
 * (retried after a few days if nothing was archived yet).
 */
const WB = process.env.WAYBACK_BASE || 'https://web.archive.org';
const WAYBACK_DAYS = +(process.env.WAYBACK_DAYS || 45);
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
async function waybackSnapshots(url) {
  const tryUrls = [url, url.split('?')[0]].filter((v, i, a) => a.indexOf(v) === i);
  for (const u of tryUrls) {
    const q = `${WB}/cdx/search/cdx?url=${encodeURIComponent(u.replace(/^https?:\/\//, ''))}`
      + `&from=${ymd(new Date(Date.now() - WAYBACK_DAYS * 864e5))}&to=${ymd(new Date())}`
      + `&output=json&filter=statuscode:200&collapse=timestamp:8&limit=60`;
    try {
      const r = await get(q, { timeout: 30000 });
      if (!r.ok) continue;
      const rows = await r.json();
      const snaps = rows.slice(1).map(x => ({ ts: x[1], original: x[2] })).filter(x => /^\d{14}$/.test(x.ts));
      if (snaps.length) return snaps;
    } catch { /* try next form */ }
    await sleep(1500);
  }
  return [];
}
function pickSpread(snaps, max) {   // keep up to `max` snapshots spread across the period
  if (snaps.length <= max) return snaps;
  const out = []; for (let i = 0; i < max; i++) out.push(snaps[Math.round(i * (snaps.length - 1) / (max - 1))]);
  return [...new Map(out.map(s => [s.ts, s])).values()];
}
const tsToIso = ts => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`;
async function backfill(items, sources) {
  const max = +(process.env.WAYBACK_MAX_ITEMS || 20);
  const due = [...items.values()].filter(it => it.url && (!it.backfilledAt ||
    (!it.backfillFound && Date.parse(now) - Date.parse(it.backfilledAt) > 3 * 864e5))).slice(0, max);
  if (!due.length) return 0;
  log(`Wayback Machine history (${due.length} items)…`);
  let added = 0, withData = 0;
  for (const it of due) {
    let found = 0;
    try {
      const snaps = pickSpread(await waybackSnapshots(it.url), 8);
      for (const sn of snaps) {
        await sleep(2000);
        try {
          const r = await get(`${WB}/web/${sn.ts}id_/${sn.original}`, { timeout: 30000 });
          if (!r.ok) continue;
          const p = priceFromHtml((await r.text()).slice(0, 3_000_000));
          if (!p) continue;
          const t = tsToIso(sn.ts);
          it.history ||= [];
          if (!it.history.some(h => h.t.slice(0, 10) === t.slice(0, 10))) {
            it.history.push({ t, price: p.price, status: 'archive', source: 'Wayback Machine snapshot' });
            found++;
          }
        } catch { /* skip this snapshot */ }
      }
    } catch (e) { log('  wayback error', e.message); }
    it.history.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    it.backfilledAt = now; it.backfillFound = (it.backfillFound || 0) + found;
    if (found) withData++;
    added += found;
    log(`  ${found ? 'found ' + found : 'none   '} ${it.name || it.id}`);
    await sleep(1500);
  }
  sources.push({ id: 'wayback', name: 'Wayback Machine (past prices)', status: withData ? 'ok' : 'partial', detail: `${added} past prices for ${withData}/${due.length} laptops checked this run` });
  return added;
}

/* ---------------- merge into feed ---------------- */
function addObservation(item, price, source) {
  item.history ||= [];
  const last = item.history[item.history.length - 1];
  const hours = last ? (Date.parse(now) - Date.parse(last.t)) / 3600e3 : Infinity;
  if (!last || last.price !== price || hours >= KEEP_SAME_PRICE_HOURS) {
    item.history.push({ t: now, price, status: 'auto', source });
    if (item.history.length > MAX_HISTORY) item.history.splice(0, item.history.length - MAX_HISTORY);
    return true;
  }
  return false;
}

async function main() {
  const tracked = await readJSON(TRACKED, { items: [], bestbuy: { enabled: true } });
  const feed = await readJSON(FEED, { items: [] });
  const items = new Map((feed.items || []).map(i => [i.id, i]));
  const sources = []; let newPrices = 0, newItems = 0;

  // Best Buy discovery
  if (tracked.bestbuy?.enabled !== false) {
    log('Best Buy API…');
    const bb = await bestBuy(tracked.bestbuy || {}, process.env.BESTBUY_API_KEY, sources);
    const minRam = tracked.bestbuy?.minRamGB || 0;
    for (const p of bb) {
      if (minRam && p.ram && p.ram < minRam) continue;
      let it = items.get(p.id);
      const { price, available, source, fullName, brandRaw, ...specs } = p;
      if (!it) { it = { ...specs, specsFrom: 'Parsed from the Best Buy listing title. Check TGP, cooling and upgradeability yourself.', history: [] }; items.set(p.id, it); newItems++; }
      it.url = p.url; it.listPrice = p.listPrice; it.available = available; it.checkedAt = now; it.checkStatus = 'ok';
      if (addObservation(it, price, source)) newPrices++;
    }
  }

  // Tracked product pages
  // Stores that keep refusing are checked once a day instead of every run.
  const pages = (tracked.items || []).filter(i => i && typeof i.url === 'string' && /^https?:\/\//.test(i.url)).filter(i => {
    const prev = items.get(i.id);
    if (!prev || !['blocked', 'skipped'].includes(prev.checkStatus) || (prev.failCount || 0) < 3) return true;
    return Date.parse(now) - Date.parse(prev.lastAttemptAt || prev.checkedAt || 0) > 24 * 3600e3;
  });
  if (pages.length) {
    log(`Product pages (${pages.length})…`);
    const res = await checkPages(pages, sources);
    for (const r of res) {
      const src = pages.find(p => p.id === r.id || p.url === r.url);
      const id = src.id || 'page-' + Buffer.from(src.url).toString('base64url').slice(-16);
      let it = items.get(id);
      if (!it) { const { id: _i, ...rest } = src; it = { id, ...rest, history: [] }; items.set(id, it); newItems++; }
      else { const { history, ...rest } = src; Object.assign(it, rest, { id }); }
      it.checkedAt = now; it.lastAttemptAt = now; it.checkStatus = r.status; it.checkDetail = r.detail;
      it.failCount = r.status === 'ok' ? 0 : (it.failCount || 0) + 1;
      if (r.status === 'ok') { it.available = r.available; if (addObservation(it, r.price, 'Auto: ' + r.host)) newPrices++; }
    }
  }

  // Items listed in tracked.json that weren't checked this run (backed off) still appear in the feed.
  for (const src of tracked.items || []) {
    if (src && src.id && src.url && !items.has(src.id)) { items.set(src.id, { ...src, history: [] }); newItems++; }
  }
  if (process.env.WAYBACK !== 'off') newPrices += await backfill(items, sources);

  const out = {
    format: 'rtx-deal-hunter-feed', version: 2, generated: now,
    schedule: tracked.scheduleNote || 'Every 3 hours via GitHub Actions',
    sources, stats: { items: items.size, newItems, newPrices },
    items: [...items.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  };
  await writeFile(FEED, JSON.stringify(out, null, 1) + '\n');
  log(`Done: ${items.size} items, ${newItems} new, ${newPrices} new prices.`);
  for (const s of sources) log(`  [${s.status}] ${s.name}: ${s.detail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
