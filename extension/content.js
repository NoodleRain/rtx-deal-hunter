/* RTX Deal Hunter Companion · page reader
 * Runs only on the store sites listed in manifest.json, on pages you open yourself.
 * Reads the product name, price and specs shown on the page and hands them to the
 * extension. It never clicks, never loads other pages, and never sends data anywhere
 * except your own extension storage.
 */
(() => {
  'use strict';
  if (window.__rtxDealHunter) return;
  window.__rtxDealHunter = true;

  const MIN = 200, MAX = 15000;
  const host = location.hostname.replace(/^www\./, '');
  const RETAILER = [
    [/amazon\.com$/, 'amazon'], [/bestbuy\.com$/, 'bestbuy'], [/newegg\.com$/, 'newegg'], [/bhphotovideo\.com$/, 'bh'],
    [/walmart\.com$/, 'walmart'], [/dell\.com$/, 'dell'], [/hp\.com$/, 'hp'], [/lenovo\.com$/, 'lenovo'],
    [/microcenter\.com$/, 'microcenter'], [/costco\.com$/, 'costco'], [/acer\.com$/, 'acer'], [/asus\.com$/, 'asus'], [/msi\.com$/, 'msi']
  ].find(([re]) => re.test(host));
  const retailer = RETAILER ? RETAILER[1] : 'other';

  const toNum = t => {
    const m = String(t || '').replace(/\s/g, '').match(/\$?([\d,]+(?:\.\d{1,2})?)/);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const ok = n => n != null && n >= MIN && n <= MAX;
  const txt = el => el ? (el.getAttribute('content') || el.textContent || '').trim() : '';
  function firstPrice(selectors) {
    for (const s of selectors) {
      for (const el of document.querySelectorAll(s)) {
        if (el.closest('[id*="similar"], [class*="carousel"], [data-testid*="carousel"]')) continue;
        const n = toNum(txt(el));
        if (ok(n)) return n;
      }
    }
    return null;
  }

  /* ---------- structured data (schema.org JSON-LD) ---------- */
  function* walk(node) {
    if (Array.isArray(node)) { for (const x of node) yield* walk(x); return; }
    if (!node || typeof node !== 'object') return;
    yield node;
    for (const k of ['@graph', 'mainEntity', 'hasVariant']) if (node[k]) yield* walk(node[k]);
  }
  function jsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data; try { data = JSON.parse(s.textContent); } catch { continue; }
      for (const n of walk(data)) {
        if (!/Product/i.test([].concat(n['@type'] || []).join(',')) || !n.offers) continue;
        for (const o of [].concat(n.offers)) {
          const cur = o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency);
          if (cur && cur !== 'USD') continue;
          const price = toNum(o.price ?? o.lowPrice ?? (o.priceSpecification && o.priceSpecification.price));
          if (ok(price)) return { price, name: n.name, available: !/OutOfStock|SoldOut|Discontinued/i.test(o.availability || ''), sku: n.sku };
        }
      }
    }
    return null;
  }

  /* ---------- per-store readers ---------- */
  const STORE = {
    amazon: {
      isProduct: () => /\/(dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i.test(location.pathname),
      id: () => { const m = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i); return m && 'amz-' + m[1].toUpperCase(); },
      url: () => { const m = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i); return m && `https://www.amazon.com/dp/${m[1].toUpperCase()}`; },
      name: () => txt(document.querySelector('#productTitle')),
      price: () => firstPrice([
        '#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
        '#corePrice_feature_div .a-price .a-offscreen',
        '#corePrice_desktop .a-price .a-offscreen',
        '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
        '#tp_price_block_total_price_ww .a-offscreen',
        '#priceblock_dealprice', '#priceblock_ourprice'
      ]),
      list: () => firstPrice(['#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen', '#corePrice_desktop .a-text-price .a-offscreen', '.a-price.a-text-price[data-a-strike="true"] .a-offscreen']),
      available: () => !/currently unavailable|out of stock/i.test(txt(document.querySelector('#availability'))),
      seller: () => txt(document.querySelector('#sellerProfileTriggerId')) || (txt(document.querySelector('#merchantInfoFeature_feature_div .offer-display-feature-text')) || '').slice(0, 60),
      context: () => txt(document.querySelector('#wayfinding-breadcrumbs_feature_div')) + ' ' + txt(document.querySelector('#productDetails_techSpec_section_1')) + ' ' + txt(document.querySelector('#feature-bullets'))
    },
    bestbuy: {
      isProduct: () => /\/site\/.+\.p|\/product\//.test(location.pathname),
      id: () => {
        const q = new URLSearchParams(location.search).get('skuId');
        const t = document.body ? document.body.innerText.slice(0, 200000) : '';
        const m = q || (location.pathname.match(/\/(\d{7,8})\.p/) || [])[1] || (t.match(/SKU:\s*(\d{7,9})/) || [])[1];
        return 'bb-' + (m || location.pathname.split('/').filter(Boolean).pop());
      },
      url: () => location.origin + location.pathname + (new URLSearchParams(location.search).get('skuId') ? '?skuId=' + new URLSearchParams(location.search).get('skuId') : ''),
      name: () => txt(document.querySelector('h1')),
      price: () => firstPrice(['[data-testid="customer-price"] span', '[data-testid="large-customer-price"]', '.priceView-customer-price span', '[data-testid="product-price"]']) || scriptNumber(/"customerPrice"\s*:\s*([\d.]+)/),
      list: () => firstPrice(['[data-testid="regular-price"]', '.pricing-price__regular-price']) || scriptNumber(/"regularPrice"\s*:\s*([\d.]+)/)
    },
    newegg: {
      isProduct: () => /\/p\//.test(location.pathname),
      price: () => firstPrice(['.product-buy-box .price-current', '.price-current']),
      list: () => firstPrice(['.product-buy-box .price-was-data', '.price-was-data'])
    },
    bh: {
      isProduct: () => /\/c\/product\//.test(location.pathname),
      price: () => firstPrice(['[data-selenium="pricingPrice"]']),
      list: () => firstPrice(['[data-selenium="strikeThroughPrice"]'])
    },
    walmart: {
      isProduct: () => /\/ip\//.test(location.pathname),
      price: () => firstPrice(['[itemprop="price"]', '[data-testid="price-wrap"] [itemprop="price"]'])
    }
  };
  function scriptNumber(re) {
    for (const s of document.querySelectorAll('script:not([src])')) {
      const m = s.textContent.length < 3e6 && s.textContent.match(re);
      if (m && ok(+m[1])) return +m[1];
    }
    return null;
  }

  /* ---------- GPU and specs from the page title ---------- */
  function gpuOf(t) {
    const m = String(t).match(/RTX[\s™®]*(50[5-9]0)(\s*Ti\b)?/i);
    if (!m) return null;
    return m[1] === '5070' && m[2] ? '5070ti' : m[1];
  }
  function specsOf(n) {
    const out = {};
    const ram = n.match(/(\d{2,3})\s*GB\s*(?:DDR5|DDR4|LPDDR5X?|Memory|RAM)/i);
    const ssd = n.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:PCIe\s*)?(?:Gen\s*\d\s*)?(?:NVMe\s*)?(?:M\.2\s*)?SSD/i);
    const size = n.match(/(1[3-8](?:\.\d)?)\s*(?:"|”|''|-inch|\sinch|\sin\b)/i);
    const hz = n.match(/(\d{2,3})\s*Hz/i);
    const cpu = n.match(/(Intel\s+(?:®\s*)?Core\s+(?:™\s*)?(?:Ultra\s+)?[579i][\w-]*\s*[\w-]*|AMD\s+Ryzen\s+(?:AI\s+)?\d\s+(?:HX\s+)?\w+)/i);
    if (ram) out.ram = +ram[1];
    if (ssd) out.storage = Math.round(ssd[2].toUpperCase() === 'TB' ? +ssd[1] * 1024 : +ssd[1]);
    if (size) out.displaySize = +size[1];
    if (hz) out.hz = +hz[1];
    if (cpu) out.cpu = cpu[1].replace(/[®™]/g, '').replace(/\s+/g, ' ').trim();
    if (/OLED/i.test(n)) out.panel = 'OLED'; else if (/mini[\s-]?led/i.test(n)) out.panel = 'Mini-LED';
    if (/4K|UHD|3840/i.test(n)) out.displayRes = '4K';
    else if (/QHD|WQXGA|2\.5K|2560|1600p|1440p/i.test(n)) out.displayRes = 'QHD';
    else if (/FHD|1080p|1920|WUXGA/i.test(n)) out.displayRes = 'FHD';
    return out;
  }
  const GPU_LABEL = { '5050': 'RTX 5050', '5060': 'RTX 5060', '5070': 'RTX 5070', '5070ti': 'RTX 5070 Ti', '5080': 'RTX 5080', '5090': 'RTX 5090' };
  // "ASUS - ROG Strix G16 16\" 240Hz Gaming Laptop - AMD … - 1TB SSD" → "ASUS ROG Strix G16 (RTX 5070 Ti, 32GB, 1TB)"
  function shortName(full, gpu, sp) {
    let n = String(full).replace(/[\u00ae\u2122]/g, '');
    n = n.replace(/^([^-–|]{2,25}?)\s+[-–]\s+/, '$1 ');                       // "Brand - Model" → "Brand Model"
    n = n.split(/\s+[-–|]\s+|,\s+/)[0];                                       // first segment only
    const size = n.match(/\s+\d{2}(\.\d)?\s*("|\u201d|''|-inch|\sinch|\sin\b)/i);
    if (size) n = n.slice(0, size.index).trim().split(/\s+/).length >= 3
      ? n.slice(0, size.index)                                                   // "ROG Strix G16 16\" 240Hz…" → drop size and after
      : n.slice(0, size.index) + ' ' + n.slice(size.index + size[0].length);     // "Lenovo 16\" Legion…" → drop size only
    n = n.trim()
      .replace(/\s+(Gaming\s+)?(Laptop|Notebook)(\s+PC)?\s*$/i, '').trim();
    n = n.replace(/\s+/g, ' ').trim();
    if (n.length < 4) n = String(full).slice(0, 80);
    const extras = [GPU_LABEL[gpu], sp.ram && sp.ram + 'GB', sp.storage && (sp.storage >= 1024 ? +(sp.storage / 1024).toFixed(1) + 'TB' : sp.storage + 'GB')].filter(Boolean);
    return (extras.length && !/RTX/i.test(n) ? `${n} (${extras.join(', ')})` : n).slice(0, 140);
  }
  function hashId(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  /* ---------- read the page ---------- */
  function read() {
    const st = STORE[retailer] || {};
    const ld = jsonLd();
    const productPage = (st.isProduct && st.isProduct()) || !!ld;
    if (!productPage) return null;
    const ogTitle = txt(document.querySelector('meta[property="og:title"]'));
    const name = ((st.name && st.name()) || (ld && ld.name) || txt(document.querySelector('h1')) || ogTitle || document.title).replace(/\s+/g, ' ').trim().slice(0, 200);
    const price = (st.price && st.price()) || (ld && ld.price) ||
      firstPrice(['meta[property="product:price:amount"]', 'meta[property="og:price:amount"]', '[itemprop="price"]']);
    const desc = txt(document.querySelector('meta[name="description"]')) + ' ' + txt(document.querySelector('meta[property="og:description"]'));
    const top = document.body ? document.body.innerText.slice(0, 15000) : '';   // product header and key features
    const extra = (st.context ? st.context() : '') + ' ' + desc;
    const gpu = gpuOf(name) || gpuOf(ogTitle) || gpuOf(extra) || gpuOf(top);
    const canon = txt(document.querySelector('link[rel="canonical"]')) || document.querySelector('link[rel="canonical"]')?.href;
    let url = st.url ? st.url() : null;
    if (!url) { try { const c = new URL(canon || location.href, location.href); url = (c.hostname === location.hostname ? c.origin + c.pathname : location.origin + location.pathname); } catch { url = location.origin + location.pathname; } }
    const id = (st.id && st.id()) || (retailer + '-' + hashId(url));
    return {
      product: { id, name: shortName(name, gpu, specsOf(name)), fullName: name, url, retailer, gpu, isLaptop: /laptop|notebook/i.test(name + ' ' + ogTitle + ' ' + extra), specs: specsOf(name) },
      price: ok(price) ? Math.round(price * 100) / 100 : null,
      listPrice: st.list ? st.list() : null,
      available: st.available ? st.available() : (ld ? ld.available : true),
      seller: st.seller ? st.seller() : ''
    };
  }

  /* ---------- small on-page badge ---------- */
  let badge, lastKey = '';
  const money = n => '$' + (n % 1 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString('en-US'));
  function showBadge(data, res) {
    if (!badge) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;';
      badge = host.attachShadow({ mode: 'open' });
      document.documentElement.appendChild(host);
      badge.host_ = host;
    }
    const tracked = res && res.tracked;
    let line = '';
    if (tracked && data.price != null) {
      if (res.prev != null && res.prev !== data.price) {
        const d = data.price - res.prev;
        line = `<span class="${d < 0 ? 'down' : 'up'}">${d < 0 ? '▼' : '▲'} ${money(Math.abs(d))}</span> since last seen`;
      } else if (res.prev != null) line = 'Same as last time';
      else line = res.added ? 'Now tracking' : 'First price saved';
      if (res.low != null && res.count > 1) line += ` · low ${money(res.low)}`;
    } else if (!tracked) {
      line = data.product.gpu ? 'Not tracked yet' : 'Pick the GPU to track this laptop';
    }
    if (tracked && data.price == null) line = 'Tracked · no price found on this page';
    badge.innerHTML = `<style>
      :host{all:initial}
      .b{font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e7eaee;background:#13171d;border:1px solid #2d3541;border-radius:12px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;max-width:340px;transition:opacity .3s}
      .t{font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5be3a3}
      .p{font-weight:700;font-size:15px}
      .down{color:#4ade80;font-weight:700}.up{color:#f87171;font-weight:700}
      button{font:inherit;font-weight:650;border:0;border-radius:8px;padding:6px 10px;cursor:pointer;background:#5be3a3;color:#062014}
      .x{background:none;color:#828c9a;padding:2px 4px;font-size:16px;line-height:1}
      .m{color:#b4bcc8;font-size:12px}
      select{font:inherit;font-size:12px;background:#1e242d;color:#e7eaee;border:1px solid #2d3541;border-radius:7px;padding:5px}
    </style>
    <div class="b" role="status">
      <div style="flex:1;min-width:0"><div class="t">RTX Deal Hunter</div>
        ${data.price != null ? `<div class="p">${money(data.price)}</div>` : ''}
        <div class="m">${line}</div></div>
      ${!tracked && !data.product.gpu ? `<select id="gpu" title="Which GPU does this laptop have?"><option value="">GPU?</option>${['5050', '5060', '5070', '5070ti', '5080', '5090'].map(g => `<option value="${g}">RTX ${g.replace('ti', ' Ti')}</option>`).join('')}</select>` : ''}
      ${!tracked ? '<button id="track">Track</button>' : ''}
      <button class="x" id="close" title="Hide" aria-label="Hide">×</button>
    </div>`;
    badge.getElementById('close').onclick = () => { badge.host_.style.display = 'none'; };
    const tb = badge.getElementById('track');
    if (tb) tb.onclick = () => {
      const g = badge.getElementById('gpu');
      if (g && !g.value) { g.focus(); g.style.outline = '2px solid #f5b84b'; return; }
      if (g) data.product.gpu = g.value;
      send('track', data).then(r => showBadge(data, r));
    };
    badge.host_.style.display = (tracked || data.product.gpu || data.product.isLaptop) ? '' : 'none';
    clearTimeout(badge.t_);
    if (tracked) badge.t_ = setTimeout(() => { badge.host_.style.opacity = '0.0'; setTimeout(() => { badge.host_.style.display = 'none'; badge.host_.style.opacity = ''; }, 400); }, 8000);
  }
  function send(type, data) {
    return new Promise(res => {
      try { chrome.runtime.sendMessage({ type, ...data }, r => { void chrome.runtime.lastError; res(r || null); }); }
      catch { res(null); }   // extension was reloaded; ignore
    });
  }

  async function run() {
    const data = read();
    if (!data) return false;
    const key = data.product.id + '|' + data.price;
    if (key === lastKey) return true;
    if (data.price == null && !data.product.gpu) return false;   // wait for the page to finish loading
    if (!data.product.gpu && !data.product.isLaptop) return false;   // not a laptop page
    lastKey = key;
    const res = await send('seen', data);
    showBadge(data, res);
    return data.price != null;
  }

  // Product pages often fill in prices after loading; try a few times, and again on in-page navigation.
  let href = location.href;
  const attempts = () => { lastKey = ''; [1200, 3500, 8000].forEach(t => setTimeout(run, t)); };
  attempts();
  setInterval(() => { if (location.href !== href) { href = location.href; if (badge) badge.host_.style.display = 'none'; attempts(); } }, 1500);
})();
