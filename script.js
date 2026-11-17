/* RTX Deal Hunter
 * A browser-only gaming laptop deal tracker. No backend, no accounts, no paid APIs.
 * All data lives in this browser's localStorage. See README.md.
 */
'use strict';
(function () {

  /* =========================================================
   * 1. Utilities
   * ======================================================= */
  const STORE_KEY = 'rtx-deal-hunter:v1';
  const DAY = 864e5;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const num = (v, d = null) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : d;
    const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : d;
  };
  const toBool = v => v === true || /^(true|yes|y|1)$/i.test(String(v ?? '').trim());
  const money = n => (n == null || !Number.isFinite(n)) ? '—' : '$' + (Math.abs(n % 1) > 0.004 && Math.abs(n) < 1e5 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-US'));
  const uid = () => 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const byT = (a, b) => new Date(a.t) - new Date(b.t);
  const fmtDate = t => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtDay = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtStorage = gb => gb >= 1024 ? (+(gb / 1024).toFixed(1)) + 'TB' : gb + 'GB';

  function safeUrl(u) {
    if (!u) return '';
    try {
      const x = new URL(String(u).trim());
      return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '';
    } catch { return ''; }
  }
  function ago(t) {
    const s = (Date.now() - new Date(t)) / 1000;
    if (s < 0) return 'in the future';
    if (s < 60) return 'just now';
    const m = s / 60; if (m < 60) return Math.floor(m) + 'm ago';
    const h = m / 60; if (h < 24) return Math.floor(h) + 'h ago';
    const d = h / 24; if (d < 45) return Math.floor(d) + 'd ago';
    return fmtDay(t);
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function localInputValue(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* Icons: simple stroke icons drawn for this project */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M19 9h3M19 15h3M2 9h3M2 15h3"/>',
    columns: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    star: '<path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>',
    gamepad: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 10.5v3.5M5.25 12.25h3.5"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="14" r="1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    dollar: '<path d="M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    external: '<path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2 0-4-2-6-1 4-4 7-4 12 0 4 3 7 7 7z"/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h0a3 3 0 0 1-3-3"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'
  };
  const I = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* =========================================================
   * 2. Reference data
   * ======================================================= */
  // perf = rough relative laptop GPU performance index (RTX 5090 Laptop = 100).
  // It is an editorial estimate for ranking, not a benchmark result.
  const GPUS = {
    '5050':   { label: 'RTX 5050',    vram: 8,  perf: 42,  tier: 'Entry' },
    '5060':   { label: 'RTX 5060',    vram: 8,  perf: 52,  tier: 'Mainstream' },
    '5070':   { label: 'RTX 5070',    vram: 8,  perf: 62,  tier: 'Performance' },
    '5070ti': { label: 'RTX 5070 Ti', vram: 12, perf: 76,  tier: 'High-end' },
    '5080':   { label: 'RTX 5080',    vram: 16, perf: 89,  tier: 'Enthusiast' },
    '5090':   { label: 'RTX 5090',    vram: 24, perf: 100, tier: 'Flagship' }
  };
  const GPU_ORDER = ['5050', '5060', '5070', '5070ti', '5080', '5090'];

  const CPU_CLASSES = [
    { id: 'u9hx',  label: 'Intel Core Ultra 9 HX (275HX, 285HX)', score: 100 },
    { id: 'r9hx',  label: 'AMD Ryzen 9 HX (9955HX, 9955HX3D)',    score: 100 },
    { id: 'u7hx',  label: 'Intel Core Ultra 7 HX (255HX)',        score: 88 },
    { id: 'i9hx',  label: 'Intel Core i9 HX, 13th/14th gen',      score: 86 },
    { id: 'raihx', label: 'AMD Ryzen AI 9 HX (370, 375)',         score: 82 },
    { id: 'i7hx',  label: 'Intel Core i7 HX, 13th/14th gen',      score: 78 },
    { id: 'u9h',   label: 'Intel Core Ultra 9 H (285H, 185H)',    score: 78 },
    { id: 'u7h',   label: 'Intel Core Ultra 7 H (255H, 155H)',    score: 70 },
    { id: 'r7',    label: 'AMD Ryzen 7 (260, 8845HS, 7840HS)',    score: 66 },
    { id: 'mid',   label: 'Core i5 / Ultra 5 / Ryzen 5 class',    score: 50 },
    { id: 'other', label: 'Other / unknown',                      score: 60 }
  ];
  const CPU_MAP = Object.fromEntries(CPU_CLASSES.map(c => [c.id, c]));
  const PANELS = { 'OLED': 1, 'Mini-LED': 0.95, 'IPS': 0.7 };
  const RES = { 'FHD': { label: 'FHD+', v: 0.5 }, 'QHD': { label: 'QHD+', v: 0.85 }, '4K': { label: '4K / UHD+', v: 1 } };
  const BRANDS = ['Alienware', 'ASUS ROG', 'ASUS TUF', 'Lenovo Legion', 'Acer Predator', 'Acer Nitro', 'MSI', 'HP OMEN', 'HP Victus', 'Razer', 'Gigabyte AORUS', 'Dell', 'Other'];

  const enc = encodeURIComponent;
  const RETAILERS = [
    { id: 'bestbuy', name: 'Best Buy', home: 'https://www.bestbuy.com/', search: q => `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(q)}`, note: 'Check the exact SKU. Open-box and member prices are listed separately.' },
    { id: 'amazon', name: 'Amazon', home: 'https://www.amazon.com/', search: q => `https://www.amazon.com/s?k=${enc(q)}`, note: 'Automatic checks aren\'t possible (Amazon blocks them, and its API needs an affiliate account with regular sales). Add products by link: each one gets camelcamelcamel and Keepa price-history links, and you log prices with +.' },
    { id: 'newegg', name: 'Newegg', home: 'https://www.newegg.com/', search: q => `https://www.newegg.com/p/pl?d=${enc(q)}`, note: 'Marketplace sellers are common. Look for "Sold by Newegg".' },
    { id: 'dell', name: 'Dell / Alienware', home: 'https://www.dell.com/en-us', search: q => `https://www.dell.com/en-us/search/${enc(q)}`, note: 'Configurable systems: price depends on the options you pick.' },
    { id: 'lenovo', name: 'Lenovo', home: 'https://www.lenovo.com/us/en/', search: q => `https://www.lenovo.com/us/en/search?text=${enc(q)}`, note: 'eCoupons often apply at checkout. Log the final price you see.' },
    { id: 'asus', name: 'ASUS Store', home: 'https://www.asus.com/us/', search: q => `https://www.asus.com/us/searchresult?searchType=products&searchKey=${enc(q)}`, note: 'Official store stock varies. Many ASUS models sell mainly through retailers.' },
    { id: 'hp', name: 'HP', home: 'https://www.hp.com/us-en/shop/', search: q => `https://www.hp.com/us-en/shop/sitesearch?keyword=${enc(q)}`, note: 'OMEN models are often configurable. Note the exact configuration.' },
    { id: 'msi', name: 'MSI', home: 'https://us-store.msi.com/', search: q => `https://www.msi.com/search/${enc(q)}`, note: 'The MSI site lists specs. Buy links usually go to authorized retailers.' },
    { id: 'acer', name: 'Acer Store', home: 'https://store.acer.com/en-us/', search: q => `https://store.acer.com/en-us/catalogsearch/result/?q=${enc(q)}`, note: 'Official store with occasional exclusive configurations.' },
    { id: 'walmart', name: 'Walmart', home: 'https://www.walmart.com/', search: q => `https://www.walmart.com/search?q=${enc(q)}`, note: 'Marketplace listings are mixed in. Check the seller name.' },
    { id: 'microcenter', name: 'Micro Center', home: 'https://www.microcenter.com/', search: q => `https://www.microcenter.com/search/search_results.aspx?Ntt=${enc(q)}`, note: 'Many deals are in-store only, and prices vary by store.' },
    { id: 'bh', name: 'B&H Photo', home: 'https://www.bhphotovideo.com/', search: q => `https://www.bhphotovideo.com/c/search?q=${enc(q)}`, note: 'Reliable specs pages. Check holiday shipping cutoffs.' },
    { id: 'costco', name: 'Costco', home: 'https://www.costco.com/', search: q => `https://www.costco.com/CatalogSearch?keyword=${enc(q)}`, note: 'Some prices need a membership. Bundles may include extras.' },
    { id: 'other', name: 'Other retailer', home: '', search: null, note: 'Any other store. Add the product URL yourself.' }
  ];
  const RETAILER_MAP = Object.fromEntries(RETAILERS.map(r => [r.id, r]));

  const COMP_LABELS = { gpu: 'GPU performance', vram: 'GPU VRAM', cpu: 'CPU', ram: 'RAM', storage: 'Storage', cooling: 'Cooling', display: 'Display', upgrade: 'Upgradeability', portability: 'Portability' };
  const PROFILES = {
    gaming:    { label: 'Heavy AAA gaming',                  short: 'Gaming',    icon: 'gamepad', w: { gpu: .40, vram: .10, cpu: .12, ram: .06, storage: .04, cooling: .15, display: .10, upgrade: .03 } },
    soc:       { label: 'Cybersecurity & SOC labs',          short: 'SOC labs',  icon: 'shield',  w: { gpu: .04, vram: .02, cpu: .26, ram: .30, storage: .14, cooling: .08, display: .02, upgrade: .14 } },
    ai:        { label: 'Local AI & machine learning',       short: 'AI / ML',   icon: 'brain',   w: { gpu: .25, vram: .32, cpu: .08, ram: .15, storage: .08, cooling: .08, upgrade: .04 } },
    vm:        { label: 'VMs, Docker, Wazuh & Suricata',     short: 'VMs',       icon: 'columns', w: { gpu: .02, cpu: .28, ram: .34, storage: .16, cooling: .08, upgrade: .12 } },
    multitask: { label: 'Heavy multitasking & many browsers', short: 'Multitask', icon: 'dashboard', w: { gpu: .05, cpu: .24, ram: .30, storage: .08, cooling: .08, display: .13, upgrade: .07, portability: .05 } },
    everyday:  { label: 'Everyday, Office & streaming',      short: 'Everyday',  icon: 'sun',     w: { gpu: .04, cpu: .16, ram: .12, storage: .10, cooling: .10, display: .28, upgrade: .05, portability: .15 } }
  };
  const PROFILE_KEYS = Object.keys(PROFILES);

  /* =========================================================
   * 3. Demonstration data (clearly flagged demo: true)
   * ======================================================= */
  const DEMO_NOTE = 'Demonstration entry. The price is made up for the demo. Specs reflect a typical configuration, so confirm the exact SKU on the retailer page.';
  const DEMO = [
    { id: 'demo-legion-pro7i-g10', name: 'Lenovo Legion Pro 7i Gen 10', brand: 'Lenovo Legion', gpu: '5080', tgp: 175, cpu: 'Intel Core Ultra 9 275HX', cpuClass: 'u9hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 2048, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'OLED', hz: 240, cooling: 5, coolingNote: 'Vapor chamber, large dual-fan design', weight: 2.7, retailer: 'bestbuy', listPrice: 2999, p: 2699 },
    { id: 'demo-rog-scar18-2025', name: 'ASUS ROG Strix SCAR 18 (2025)', brand: 'ASUS ROG', gpu: '5090', tgp: 175, cpu: 'Intel Core Ultra 9 275HX', cpuClass: 'u9hx', ram: 64, ramMax: 96, ramUpgradeable: true, storage: 2048, storageSlots: 2, displaySize: 18, displayRes: 'QHD', panel: 'Mini-LED', hz: 240, cooling: 5, coolingNote: 'Tri-fan, liquid-metal CPU interface', weight: 3.2, retailer: 'asus', listPrice: 4499, p: 3999 },
    { id: 'demo-aw16-area51', name: 'Alienware 16 Area-51', brand: 'Alienware', gpu: '5080', tgp: 175, cpu: 'Intel Core Ultra 9 275HX', cpuClass: 'u9hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 2048, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'IPS', hz: 240, cooling: 5, coolingNote: 'Large chassis, quad-fan airflow', weight: 3.4, retailer: 'dell', listPrice: 3199, p: 2899 },
    { id: 'demo-blade16-2025', name: 'Razer Blade 16 (2025)', brand: 'Razer', gpu: '5090', tgp: 160, cpu: 'AMD Ryzen AI 9 HX 370', cpuClass: 'raihx', ram: 32, ramMax: 32, ramUpgradeable: false, storage: 2048, storageSlots: 1, displaySize: 16, displayRes: 'QHD', panel: 'OLED', hz: 240, cooling: 4, coolingNote: 'Thin vapor chamber; runs warm under sustained load', weight: 2.1, retailer: 'bestbuy', listPrice: 4499, p: 4199 },
    { id: 'demo-vector16-hx-ai', name: 'MSI Vector 16 HX AI', brand: 'MSI', gpu: '5070ti', tgp: 175, cpu: 'Intel Core Ultra 9 275HX', cpuClass: 'u9hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'IPS', hz: 240, cooling: 4, coolingNote: 'Dual fans with shared heat pipes', weight: 2.7, retailer: 'newegg', listPrice: 2199, p: 1899 },
    { id: 'demo-helios-neo16-ai', name: 'Acer Predator Helios Neo 16 AI', brand: 'Acer Predator', gpu: '5070ti', tgp: 140, cpu: 'Intel Core Ultra 9 275HX', cpuClass: 'u9hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'IPS', hz: 240, cooling: 4, coolingNote: 'AeroBlade fans, liquid-metal CPU', weight: 2.8, retailer: 'amazon', listPrice: 1899, p: 1649 },
    { id: 'demo-omen-max16', name: 'HP OMEN Max 16', brand: 'HP OMEN', gpu: '5080', tgp: 175, cpu: 'Intel Core Ultra 9 275HX', cpuClass: 'u9hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 2048, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'IPS', hz: 240, cooling: 5, coolingNote: 'OMEN Tempest cooling with vapor chamber', weight: 2.7, retailer: 'hp', listPrice: 2799, p: 2399 },
    { id: 'demo-aorus-master16', name: 'Gigabyte AORUS MASTER 16', brand: 'Gigabyte AORUS', gpu: '5080', tgp: 175, cpu: 'Intel Core Ultra 9 275HX', cpuClass: 'u9hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 2048, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'OLED', hz: 240, cooling: 4, coolingNote: 'WINDFORCE cooling with vapor chamber', weight: 2.5, retailer: 'newegg', listPrice: 3099, p: 2749 },
    { id: 'demo-legion5i-g10', name: 'Lenovo Legion 5i Gen 10', brand: 'Lenovo Legion', gpu: '5060', tgp: 115, cpu: 'Intel Core Ultra 7 255HX', cpuClass: 'u7hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 15.1, displayRes: 'QHD', panel: 'OLED', hz: 165, cooling: 4, coolingNote: 'Dual fans, well-tuned for its size', weight: 1.95, retailer: 'lenovo', listPrice: 1599, p: 1349 },
    { id: 'demo-legion-pro5i-g10', name: 'Lenovo Legion Pro 5i Gen 10', brand: 'Lenovo Legion', gpu: '5070', tgp: 140, cpu: 'Intel Core Ultra 7 255HX', cpuClass: 'u7hx', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'OLED', hz: 240, cooling: 4, coolingNote: 'Dual fans, quad exhaust vents', weight: 2.5, retailer: 'bh', listPrice: 1849, p: 1599 },
    { id: 'demo-omen16-2025', name: 'HP OMEN 16 (2025)', brand: 'HP OMEN', gpu: '5070', tgp: 115, cpu: 'Intel Core Ultra 7 255H', cpuClass: 'u7h', ram: 32, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'IPS', hz: 165, cooling: 3.5, coolingNote: 'Dual fans; gets loud in performance mode', weight: 2.4, retailer: 'bestbuy', listPrice: 1699, p: 1449 },
    { id: 'demo-zephyrus-g16-2025', name: 'ASUS ROG Zephyrus G16 (2025)', brand: 'ASUS ROG', gpu: '5070ti', tgp: 110, cpu: 'Intel Core Ultra 9 285H', cpuClass: 'u9h', ram: 32, ramMax: 32, ramUpgradeable: false, storage: 2048, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'OLED', hz: 240, cooling: 4, coolingNote: 'Vapor chamber in a slim chassis', weight: 1.95, retailer: 'amazon', listPrice: 2699, p: 2399 },
    { id: 'demo-titan18-hx-ai', name: 'MSI Titan 18 HX AI', brand: 'MSI', gpu: '5090', tgp: 175, cpu: 'Intel Core Ultra 9 285HX', cpuClass: 'u9hx', ram: 64, ramMax: 96, ramUpgradeable: true, storage: 2048, storageSlots: 3, displaySize: 18, displayRes: '4K', panel: 'Mini-LED', hz: 120, cooling: 5, coolingNote: 'Vapor chamber, very large heatsink area', weight: 3.6, retailer: 'msi', listPrice: 5499, p: 4999 },
    { id: 'demo-tuf-a16-2025', name: 'ASUS TUF Gaming A16 (2025)', brand: 'ASUS TUF', gpu: '5060', tgp: 115, cpu: 'AMD Ryzen 7 260', cpuClass: 'r7', ram: 16, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 16, displayRes: 'FHD', panel: 'IPS', hz: 165, cooling: 3, coolingNote: 'Dual fans; louder under load', weight: 2.2, retailer: 'walmart', listPrice: 1299, p: 1099 },
    { id: 'demo-katana15-hx', name: 'MSI Katana 15 HX', brand: 'MSI', gpu: '5060', tgp: 115, cpu: 'Intel Core i7-14650HX', cpuClass: 'i7hx', ram: 16, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 15.6, displayRes: 'QHD', panel: 'IPS', hz: 165, cooling: 3, coolingNote: 'Cooler Boost, adequate for its class', weight: 2.3, retailer: 'microcenter', listPrice: 1299, p: 1099 },
    { id: 'demo-nitro-v16-ai', name: 'Acer Nitro V 16 AI', brand: 'Acer Nitro', gpu: '5050', tgp: 100, cpu: 'AMD Ryzen 7 260', cpuClass: 'r7', ram: 16, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 1, displaySize: 16, displayRes: 'FHD', panel: 'IPS', hz: 180, cooling: 3, coolingNote: 'Basic dual-fan design', weight: 2.5, retailer: 'bestbuy', listPrice: 1099, p: 899 },
    { id: 'demo-victus15-2025', name: 'HP Victus 15 (2025)', brand: 'HP Victus', gpu: '5050', tgp: 95, cpu: 'AMD Ryzen 7 8845HS', cpuClass: 'r7', ram: 16, ramMax: 64, ramUpgradeable: true, storage: 512, storageSlots: 2, displaySize: 15.6, displayRes: 'FHD', panel: 'IPS', hz: 144, cooling: 2.5, coolingNote: 'Entry-level cooling', weight: 2.3, retailer: 'costco', listPrice: 999, p: 849 }
  ];

  function buildDemo() {
    const now = Date.now();
    return DEMO.map(d => {
      const r = rng(hashStr(d.id));
      const n = 7 + Math.floor(r() * 5);
      const span = 40 * DAY;
      const start = d.listPrice;
      const history = [];
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        let t = now - span + f * (span - 3 * 3600e3) + (i && i < n - 1 ? (r() - 0.5) * DAY : 0);
        let p = start + (d.p - start) * Math.pow(f, 1.6) + (i && i < n - 1 ? (r() - 0.45) * start * 0.04 : 0);
        if (i === n - 1) p = d.p;
        p = Math.max(Math.round(p / 10) * 10 - 1, 199);
        if (i === n - 1) p = d.p;
        history.push({ t: new Date(t).toISOString(), price: p, status: 'demo', source: 'Demo data', note: '' });
      }
      const { p, ...rest } = d;
      return normalizeLaptop({ ...rest, demo: true, notes: DEMO_NOTE, history, addedAt: new Date(now - span).toISOString() });
    });
  }

  /* =========================================================
   * 4. State and storage
   * ======================================================= */
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const DEFAULT_SETTINGS = { theme: prefersLight ? 'light' : 'dark', profile: 'gaming', showDemo: true, feedUrl: 'feed.json', autoFeed: true, lastFeedAt: null, importMode: 'merge' };
  let state;
  let storageOK = true;
  const ui = {
    filters: { q: '', gpu: 'all', brand: 'all', retailer: 'all', ram: 0, min: '', max: '', status: 'all', sort: '' },
    historyId: null, aiTab: 'labs', charts: []
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        state = {
          laptops: (d.laptops || []).map(normalizeLaptop).filter(Boolean),
          settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
          compare: Array.isArray(d.compare) ? d.compare.filter(x => typeof x === 'string') : [],
          seededAt: d.seededAt || null,
          feedMeta: d.feedMeta || null
        };
        return;
      }
    } catch (e) { console.warn('Could not read saved data', e); }
    state = { laptops: [], settings: { ...DEFAULT_SETTINGS }, compare: [], seededAt: new Date().toISOString() };
    save();
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      storageOK = true;
    } catch (e) {
      storageOK = false;
      toast('Could not save. Browser storage is full or blocked (private mode?). Export a backup.', 'error');
    }
  }
  function storageBytes() { try { return (localStorage.getItem(STORE_KEY) || '').length * 2; } catch { return 0; } }

  /* =========================================================
   * 5. Normalisation (also used to sanitise imports)
   * ======================================================= */
  function parseGpu(v) {
    const s = String(v || '').toLowerCase().replace(/geforce|rtx|laptop|gpu|nvidia|\s|-/g, '');
    if (GPUS[s]) return s;
    if (s.includes('5070ti')) return '5070ti';
    for (const k of ['5090', '5080', '5070', '5060', '5050']) if (s.includes(k)) return k;
    return null;
  }
  function guessCpuClass(s) {
    s = String(s || '');
    if (/ultra\s*9.*hx/i.test(s)) return 'u9hx';
    if (/ultra\s*7.*hx/i.test(s)) return 'u7hx';
    if (/ryzen\s*ai\s*9/i.test(s)) return 'raihx';
    if (/ryzen\s*9.*hx/i.test(s)) return 'r9hx';
    if (/i9-1[34]\d{3}hx/i.test(s)) return 'i9hx';
    if (/i7-1[34]\d{3}hx/i.test(s)) return 'i7hx';
    if (/ultra\s*9/i.test(s)) return 'u9h';
    if (/ultra\s*7/i.test(s)) return 'u7h';
    if (/ryzen\s*7/i.test(s)) return 'r7';
    if (/(i5|ultra\s*5|ryzen\s*5)/i.test(s)) return 'mid';
    return 'other';
  }
  function guessBrand(name) {
    const n = String(name).toLowerCase();
    const pairs = [['alienware', 'Alienware'], ['tuf', 'ASUS TUF'], ['rog', 'ASUS ROG'], ['legion', 'Lenovo Legion'], ['predator', 'Acer Predator'], ['nitro', 'Acer Nitro'], ['msi', 'MSI'], ['omen', 'HP OMEN'], ['victus', 'HP Victus'], ['razer', 'Razer'], ['aorus', 'Gigabyte AORUS'], ['gigabyte', 'Gigabyte AORUS'], ['dell', 'Dell']];
    for (const [k, v] of pairs) if (n.includes(k)) return v;
    return 'Other';
  }
  function findRetailer(v) {
    if (!v) return 'other';
    if (RETAILER_MAP[v]) return v;
    const s = String(v).toLowerCase().replace(/[^a-z]/g, '');
    const r = RETAILERS.find(x => x.name.toLowerCase().replace(/[^a-z]/g, '').startsWith(s) || s.startsWith(x.id));
    return r ? r.id : 'other';
  }
  function normObs(o) {
    if (!o || typeof o !== 'object') return null;
    const price = num(o.price);
    if (price == null || price <= 0 || price > 100000) return null;
    const t = new Date(o.t || o.observedAt || o.observed_at || Date.now());
    if (isNaN(t)) return null;
    let status = ['verified', 'unverified', 'demo', 'auto', 'archive', 'seen'].includes(o.status) ? o.status : (toBool(o.verified) ? 'verified' : 'unverified');
    return { t: t.toISOString(), price: Math.round(price * 100) / 100, status, source: String(o.source || '').slice(0, 120), note: String(o.note || '').slice(0, 200) };
  }
  function normalizeLaptop(r) {
    if (!r || typeof r !== 'object') return null;
    const gpu = parseGpu(r.gpu);
    const name = String(r.name || '').trim().slice(0, 140);
    if (!gpu || !name) return null;
    const ram = clamp(num(r.ram, 16), 4, 256);
    const ramUp = toBool(r.ramUpgradeable);
    const demo = toBool(r.demo);
    const history = (Array.isArray(r.history) ? r.history : []).map(normObs).filter(Boolean)
      .filter(o => !(o.status === 'seen' && o.price < 450))   // early extension misread monthly-payment amounts
      .map(o => demo ? { ...o, status: 'demo' } : o).sort(byT);
    return {
      id: String(r.id || uid()).replace(/[^\w.-]/g, '').slice(0, 64) || uid(),
      name,
      brand: String(r.brand || guessBrand(name)).slice(0, 40),
      gpu,
      vram: clamp(num(r.vram, GPUS[gpu].vram), 4, 48),
      tgp: num(r.tgp, null) != null ? clamp(num(r.tgp), 35, 250) : null,
      cpu: String(r.cpu || '').slice(0, 80),
      cpuClass: CPU_MAP[r.cpuClass] ? r.cpuClass : guessCpuClass(r.cpu),
      ram,
      ramMax: Math.max(ram, clamp(num(r.ramMax, ram), 4, 256)),
      ramUpgradeable: ramUp,
      ramUpgradeKnown: r.ramUpgradeKnown === false || ((r.ramUpgradeable == null || r.ramUpgradeable === '') && toBool(r.auto)) ? false : true,
      storage: clamp(num(r.storage, 1024), 128, 32768),
      storageSlots: clamp(Math.round(num(r.storageSlots, 1)), 1, 4),
      displaySize: clamp(num(r.displaySize, 16), 10, 20),
      displayRes: RES[r.displayRes] ? r.displayRes : 'QHD',
      panel: PANELS[r.panel] != null ? r.panel : 'IPS',
      hz: clamp(Math.round(num(r.hz, 165)), 60, 500),
      cooling: clamp(num(r.cooling, 3), 1, 5),
      coolingNote: String(r.coolingNote || '').slice(0, 160),
      weight: num(r.weight, null) != null ? clamp(num(r.weight), 0.8, 6) : null,
      retailer: findRetailer(r.retailer),
      url: safeUrl(r.url),
      listPrice: num(r.listPrice, null) != null && num(r.listPrice) > 0 ? num(r.listPrice) : null,
      notes: String(r.notes || '').slice(0, 600),
      demo,
      watch: toBool(r.watch),
      target: num(r.target, null) > 0 ? num(r.target) : null,
      addedAt: isNaN(new Date(r.addedAt)) ? new Date().toISOString() : new Date(r.addedAt).toISOString(),
      auto: toBool(r.auto),
      checkedAt: r.checkedAt && !isNaN(new Date(r.checkedAt)) ? new Date(r.checkedAt).toISOString() : null,
      checkStatus: ['ok', 'blocked', 'skipped', 'no-price', 'error'].includes(r.checkStatus) ? r.checkStatus : null,
      checkDetail: String(r.checkDetail || '').slice(0, 160),
      available: r.available === false ? false : (r.available === true ? true : null),
      specsFrom: String(r.specsFrom || '').slice(0, 200),
      history
    };
  }

  /* =========================================================
   * 6. Derived values: prices, scores
   * ======================================================= */
  const latest = l => l.history[l.history.length - 1] || null;
  const curPrice = l => latest(l) ? latest(l).price : null;
  const lastCheck = l => { const a = latest(l) ? latest(l).t : null, b = l.checkedAt; return !a ? b : !b ? a : (a > b ? a : b); };
  const statusOf = l => l.demo ? 'demo' : (latest(l) ? latest(l).status : 'none');
  const visible = () => state.laptops.filter(l => state.settings.showDemo || !l.demo);
  const getL = id => state.laptops.find(l => l.id === id);

  function priceStats(l) {
    const h = l.history;
    if (!h.length) return null;
    const ps = h.map(o => o.price);
    const cur = ps[ps.length - 1], prev = ps.length > 1 ? ps[ps.length - 2] : null, first = ps[0];
    const lo = Math.min(...ps), hi = Math.max(...ps);
    const weekAgo = [...h].reverse().find(o => new Date(o.t) <= Date.now() - 7 * DAY);
    return {
      cur, prev, first, lo, hi, count: ps.length,
      dPrev: prev != null ? cur - prev : null,
      dPrevPct: prev ? (cur - prev) / prev * 100 : null,
      dFirst: cur - first, dFirstPct: (cur - first) / first * 100,
      dWeek: weekAgo ? cur - weekAgo.price : null, dWeekPct: weekAgo ? (cur - weekAgo.price) / weekAgo.price * 100 : null,
      belowHigh: hi - cur, belowHighPct: hi ? (hi - cur) / hi * 100 : 0,
      aboveLow: cur - lo,
      vsList: l.listPrice ? l.listPrice - cur : null,
      vsListPct: l.listPrice ? (l.listPrice - cur) / l.listPrice * 100 : null,
      isLow: ps.length > 1 && cur <= lo,
      lastT: lastCheck(l)
    };
  }

  function components(l) {
    const g = GPUS[l.gpu];
    const tgpF = l.tgp ? clamp(l.tgp / 175, 0.4, 1) : 0.75;
    const cpu = CPU_MAP[l.cpuClass] || CPU_MAP.other;
    const resV = RES[l.displayRes].v;
    const ramScore = 0.75 * clamp(l.ram / 64) + 0.25 * (l.ramUpgradeable ? clamp(l.ramMax / 64) : 0);
    const storScore = 0.7 * clamp(l.storage / 2048) + 0.3 * (l.storageSlots >= 2 ? 1 : 0);
    return {
      gpu: { v: g.perf / 100 * (0.7 + 0.3 * tgpF), why: `${g.label}${l.tgp ? ' at ' + l.tgp + 'W TGP' : ' (TGP unknown)'}, performance index ${g.perf}/100${l.tgp && l.tgp < 130 ? '. A lower TGP limits sustained clocks' : ''}` },
      vram: { v: clamp(l.vram / 24), why: `${l.vram}GB VRAM${l.vram <= 8 ? '. Tight for larger local models and max-texture gaming' : l.vram >= 16 ? '. Room for larger local models' : ''}` },
      cpu: { v: cpu.score / 100, why: `${l.cpu || cpu.label} (class score ${cpu.score}/100)` },
      ram: { v: ramScore, why: `${l.ram}GB${l.ramUpgradeable ? `, upgradeable to ${l.ramMax}GB` : l.ramUpgradeKnown === false ? ', upgradeability unknown (scored as not upgradeable until you edit it)' : ', soldered (not upgradeable)'}` },
      storage: { v: storScore, why: `${fmtStorage(l.storage)} SSD, ${l.storageSlots} M.2 slot${l.storageSlots > 1 ? 's' : ''}` },
      cooling: { v: l.cooling / 5, why: `${l.cooling}/5${l.coolingNote ? '. ' + l.coolingNote : ''}` },
      display: { v: 0.45 * PANELS[l.panel] + 0.35 * resV + 0.2 * clamp(l.hz / 240), why: `${l.displaySize}" ${RES[l.displayRes].label} ${l.panel}, ${l.hz}Hz` },
      upgrade: { v: 0.6 * (l.ramUpgradeable ? 1 : 0) + 0.4 * (l.storageSlots >= 2 ? 1 : 0), why: `${l.ramUpgradeable ? 'RAM upgradeable' : 'RAM soldered'}, ${l.storageSlots >= 2 ? 'spare M.2 slot' : 'single M.2 slot'}` },
      portability: { v: l.weight ? clamp((3.6 - l.weight) / 1.8) : 0.4, why: l.weight ? `${l.weight} kg (${(l.weight * 2.205).toFixed(1)} lb)` : 'Weight unknown' }
    };
  }

  const scoreCache = new Map();
  function scoreFor(l, pk) {
    const key = l.id + '|' + pk + '|' + l._v;
    if (scoreCache.has(key)) return scoreCache.get(key);
    let res;
    if (pk === 'labs') {
      const a = scoreFor(l, 'ai').total, s = scoreFor(l, 'soc').total, v = scoreFor(l, 'vm').total;
      res = { total: Math.round((a + s + v) / 3), parts: [], notes: [], sub: { ai: a, soc: s, vm: v } };
    } else {
      const p = PROFILES[pk], c = components(l);
      let total = 0; const parts = [];
      for (const [k, w] of Object.entries(p.w)) {
        const pts = c[k].v * w * 100;
        total += pts;
        parts.push({ k, label: COMP_LABELS[k], pts, max: w * 100, ratio: c[k].v, why: c[k].why });
      }
      const notes = []; let penalty = 0;
      if (l.ram < 32 && ['soc', 'vm', 'ai', 'multitask'].includes(pk)) { penalty += 6; notes.push('−6 points: under 32GB RAM, below the minimum this tracker targets for labs and heavy multitasking.'); }
      if (pk === 'gaming' && l.tgp && l.tgp < 100) { penalty += 3; notes.push('−3 points: GPU TGP under 100W limits sustained gaming performance.'); }
      if (pk === 'ai' && l.vram <= 8) notes.push('8GB VRAM handles roughly 7–8B parameter models at 4-bit. Bigger models spill into system RAM and slow down a lot.');
      if (pk === 'soc' || pk === 'vm') notes.push(`Rough guide: ${Math.max(1, Math.floor((l.ramMax || l.ram) / 8) - 1)} lab VMs at 8GB each once RAM is ${l.ramUpgradeable && l.ramMax > l.ram ? 'upgraded to ' + l.ramMax + 'GB' : 'at ' + l.ram + 'GB'}, keeping some memory for the host.`);
      res = { total: clamp(Math.round(total - penalty), 0, 100), parts, notes, penalty };
    }
    scoreCache.set(key, res);
    return res;
  }
  function strengths(l, pk) {
    if (pk === 'labs') pk = 'vm';
    const parts = scoreFor(l, pk).parts.filter(p => p.max >= 5).sort((a, b) => b.ratio - a.ratio);
    const strong = parts.filter(p => p.ratio >= 0.8).slice(0, 2).map(p => p.label);
    const weak = parts.filter(p => p.ratio < 0.55).slice(-2).map(p => p.label);
    return [strong.length ? 'Strong: ' + strong.join(', ') : '', weak.length ? 'Weaker: ' + weak.join(', ') : ''].filter(Boolean).join(' · ') || 'Balanced profile';
  }
  const valueIndex = (l, pk) => { const p = curPrice(l); return p ? scoreFor(l, pk).total / (p / 1000) : 0; };
  const grade = s => s >= 85 ? 'great' : s >= 70 ? 'good' : s >= 55 ? 'ok' : 'low';
  const profileLabel = pk => pk === 'labs' ? 'AI & SOC labs' : PROFILES[pk].short;

  /* =========================================================
   * 7. Small render helpers
   * ======================================================= */
  function statusBadge(l) {
    const s = statusOf(l);
    if (s === 'demo') return '<span class="badge badge-demo" title="Demonstration data. Not a real price.">Demo data</span>';
    if (s === 'seen') return `<span class="badge badge-seen" title="Recorded by the RTX Deal Hunter browser extension from the store page you opened">${I('check')}Seen in browser</span>${l.available === false ? '<span class="badge badge-warn">Out of stock</span>' : ''}`;
    if (s === 'archive') return `<span class="badge badge-archive" title="Price read from a Wayback Machine snapshot of the retailer's page">Archived price</span>`;
    if (s === 'auto') return `<span class="badge badge-auto" title="Read automatically by the scheduled price checker">${I('refresh')}Auto-checked</span>${l.available === false ? '<span class="badge badge-warn">Out of stock</span>' : ''}`;
    if (s === 'verified') return `<span class="badge badge-ok" title="You confirmed this price on the retailer page">${I('check')}Verified</span>`;
    if (s === 'unverified') return '<span class="badge badge-warn" title="Price not confirmed on the retailer page">Unverified</span>';
    return '<span class="badge">No price</span>';
  }
  function deltaHtml(st, compact) {
    if (!st) return '';
    let h = '';
    if (st.dPrev != null && st.dPrev !== 0) {
      const down = st.dPrev < 0;
      h += `<span class="delta ${down ? 'down' : 'up'}">${I(down ? 'down' : 'up')}${money(Math.abs(st.dPrev))} (${Math.abs(st.dPrevPct).toFixed(1)}%)</span>${compact ? '' : '<span class="muted small"> vs previous</span>'}`;
    } else if (st.count > 1) {
      h += '<span class="delta flat">No change</span>';
    }
    if (st.isLow) h += ' <span class="pill pill-low">Lowest recorded</span>';
    return h;
  }
  function amazonAsin(url) {
    const m = String(url || '').match(/amazon\.com\/(?:[^/]+\/)?(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    return m ? m[1].toUpperCase() : null;
  }
  function historyLinks(l) {
    const asin = amazonAsin(l.url);
    if (!asin) return '';
    return `<div class="history-links small"><span class="muted">Amazon price history:</span>
      <a href="https://camelcamelcamel.com/product/${asin}" target="_blank" rel="noopener noreferrer">camelcamelcamel${I('external')}</a>
      <a href="https://keepa.com/#!product/1-${asin}" target="_blank" rel="noopener noreferrer">Keepa${I('external')}</a></div>`;
  }
  // Price in effect at time t: the last observation on or before t
  function priceAt(l, t) {
    let p = null;
    for (const o of l.history) { if (new Date(o.t) <= t) p = o; else break; }
    return p;
  }
  function retailerLink(l) {
    const r = RETAILER_MAP[l.retailer];
    if (l.url) return { href: l.url, label: 'View deal', exact: true };
    if (r && r.search) return { href: r.search(l.name), label: r.name, exact: false };
    return null;
  }
  function scoreRing(s, size = 46) {
    const r = (size - 6) / 2, c = 2 * Math.PI * r, off = c * (1 - s / 100);
    return `<div class="ring ring-${grade(s)}" style="width:${size}px;height:${size}px" role="img" aria-label="Score ${s} out of 100">
      <svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
      <span>${s}</span></div>`;
  }
  function sparkline(h) {
    if (h.length < 2) return '<div class="spark spark-empty"></div>';
    const ps = h.slice(-12).map(o => o.price);
    const lo = Math.min(...ps), hi = Math.max(...ps), rg = hi - lo || 1;
    const pts = ps.map((p, i) => `${(i / (ps.length - 1) * 100).toFixed(1)},${(26 - (p - lo) / rg * 22).toFixed(1)}`).join(' ');
    const down = ps[ps.length - 1] < ps[0];
    return `<svg class="spark ${down ? 'spark-down' : 'spark-up'}" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function priceHtml(l, st, big) {
    if (!st) return '<div class="price muted">No price yet</div>';
    const list = l.listPrice && l.listPrice > st.cur ? ` <s>${money(l.listPrice)}</s>` : '';
    return `<div class="price ${big ? 'price-big' : ''} ${l.demo ? 'is-demo' : ''}">${money(st.cur)}${l.demo ? '<span class="demo-tag">demo</span>' : ''}${list}</div>`;
  }

  /* =========================================================
   * 8. Filters
   * ======================================================= */
  const SORTS = [
    ['score', 'Best score'], ['value', 'Best value (score per $1k)'], ['drop', 'Biggest drop from high'],
    ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['gpu', 'GPU tier: high to low'], ['checked', 'Recently checked']
  ];
  function applyFilters(list, f, pk, cap) {
    const q = f.q.trim().toLowerCase();
    let out = list.filter(l => {
      const p = curPrice(l);
      if (q) {
        const hay = [l.name, l.brand, l.cpu, GPUS[l.gpu].label, RETAILER_MAP[l.retailer].name, l.panel, l.notes].join(' ').toLowerCase();
        if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
      }
      if (f.gpu !== 'all' && l.gpu !== f.gpu) return false;
      if (f.brand !== 'all' && l.brand !== f.brand) return false;
      if (f.retailer !== 'all' && l.retailer !== f.retailer) return false;
      if (f.ram && l.ram < f.ram) return false;
      const mn = num(f.min), mx = num(f.max);
      if (mn != null && (p == null || p < mn)) return false;
      if (mx != null && (p == null || p > mx)) return false;
      if (cap != null && (p == null || p > cap)) return false;
      if (f.status !== 'all' && statusOf(l) !== f.status) return false;
      return true;
    });
    const sort = f.sort || 'score';
    const P = l => curPrice(l) ?? Infinity;
    const cmp = {
      'score': (a, b) => scoreFor(b, pk).total - scoreFor(a, pk).total || P(a) - P(b),
      'value': (a, b) => valueIndex(b, pk) - valueIndex(a, pk),
      'drop': (a, b) => ((priceStats(b) || {}).belowHighPct || 0) - ((priceStats(a) || {}).belowHighPct || 0) || valueIndex(b, pk) - valueIndex(a, pk),
      'price-asc': (a, b) => P(a) - P(b),
      'price-desc': (a, b) => P(b) - P(a),
      'gpu': (a, b) => GPU_ORDER.indexOf(b.gpu) - GPU_ORDER.indexOf(a.gpu) || P(a) - P(b),
      'checked': (a, b) => new Date((latest(b) || {}).t || 0) - new Date((latest(a) || {}).t || 0)
    }[sort];
    return out.sort(cmp);
  }
  function breakdownBars(s, compact) {
    return `<div class="bars ${compact ? 'bars-compact' : ''}">${s.parts.filter(p => p.max > 0).sort((a, b) => b.max - a.max).map(p => `
      <div class="bar-row" title="${esc(p.why)}">
        <span class="bar-label">${esc(p.label)}</span>
        <span class="bar"><span style="width:${(p.ratio * 100).toFixed(0)}%"></span></span>
        <span class="bar-val">${p.pts.toFixed(1)}<span class="muted">/${p.max.toFixed(0)}</span></span>
        ${compact ? '' : `<span class="bar-why muted small">${esc(p.why)}</span>`}
      </div>`).join('')}</div>`;
  }
  /* ---------- Dashboard ---------- */
  function shoppingDates(year) {
    const nov1 = new Date(year, 10, 1);
    const firstThu = 1 + ((4 - nov1.getDay() + 7) % 7);
    const thanks = new Date(year, 10, firstThu + 21);
    return { bf: new Date(year, 10, thanks.getDate() + 1), cm: new Date(year, 10, thanks.getDate() + 4) };
  }
  function countdown() {
    const now = new Date();
    let { bf, cm } = shoppingDates(now.getFullYear());
    const cmEnd = new Date(cm.getTime() + DAY);
    if (now >= cmEnd) ({ bf, cm } = shoppingDates(now.getFullYear() + 1));
    const dfmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (now >= bf && now < new Date(cm.getTime() + DAY)) {
      return { live: true, title: now >= cm ? 'Cyber Monday is live' : 'Black Friday weekend is live', sub: `Cyber Monday: ${dfmt(cm)}`, bf, cm };
    }
    const ms = bf - now, d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600e3), m = Math.floor(ms % 3600e3 / 60e3);
    return { live: false, d, h, m, bf, cm, title: `Black Friday ${bf.getFullYear()}`, sub: `${dfmt(bf)} · Cyber Monday ${dfmt(cm)}` };
  }
  function feedState() {
    const m = state.feedMeta;
    if (location.protocol === 'file:') return { tone: 'warn', title: 'Automatic checks need the published site', body: 'You opened index.html as a local file, which can\'t load feed.json. Publish to GitHub Pages (or run a local server) to see automatic prices.' };
    if (!state.settings.autoFeed || !state.settings.feedUrl) return { tone: 'warn', title: 'Automatic loading is off', body: 'Turn it on in Settings → Automatic price checks.' };
    if (!m) return { tone: 'warn', title: 'Waiting for the first automatic check', body: 'Set up the GitHub Action (see README). Its first run creates the price feed this site loads.' };
    if (m.error) return { tone: 'warn', title: 'Couldn\'t load the price feed', body: m.error };
    if (!m.generated) return { tone: 'warn', title: 'No automatic check has run yet', body: 'Open your repository → Actions → "Check laptop prices" → Run workflow. Check the setup steps in README if it fails.' };
    const age = Date.now() - new Date(m.generated);
    const stale = age > 8 * 3600e3;
    return { tone: stale ? 'warn' : 'good', title: `Last automatic check ${ago(m.generated)}`, body: stale ? 'That is longer than expected (checks run every 3 hours). Look at Actions in your repository for errors.' : `${m.schedule || 'Every 3 hours'}. This page reloads the feed every 15 minutes while it is open.` };
  }
  function autoPanel() {
    const f = feedState(), m = state.feedMeta || {};
    const srcs = (m.sources || []).slice(0, 8);
    return `<h2>${I('refresh')}Automatic price checks</h2>
      <p class="auto-status auto-${f.tone}"><strong>${esc(f.title)}.</strong> ${esc(f.body)}</p>
      ${srcs.length ? `<ul class="source-list">${srcs.map(x => `<li><span class="src-dot src-${esc(x.status)}"></span><span>${esc(x.name)}</span><span class="muted small">${esc(x.detail || x.status)}</span></li>`).join('')}</ul>` : ''}
      <p class="muted small">Prices come from Best Buy's official API and from the price data retailers publish on product pages you track. Sites that block automated checks are flagged so you can log those by hand with ${I('plus')}.</p>`;
  }
  /* ---------- Black Friday report ---------- */
  function bfAnalysis(l, dates) {
    const { bf, cm } = dates;
    const now = new Date();
    const saleStart = new Date(bf.getTime() - 7 * DAY), saleEnd = new Date(cm.getTime() + DAY);
    const baseT = new Date(bf.getTime() - 20 * DAY);
    const during = now >= saleStart;
    const inSale = l.history.filter(o => new Date(o.t) >= saleStart && new Date(o.t) < saleEnd);
    let sale = null, saleLabel;
    if (during && inSale.length) { sale = inSale.reduce((a, b) => b.price < a.price ? b : a); saleLabel = 'Lowest in sale week'; }
    else if (!during && latest(l)) { sale = latest(l); saleLabel = 'Today'; }
    const ref = during ? baseT : new Date(now.getTime() - 20 * DAY);
    const base = priceAt(l, ref);
    const pre = l.history.filter(o => new Date(o.t) > ref && new Date(o.t) < (during ? saleStart : now));
    const preHigh = pre.length ? Math.max(...pre.map(o => o.price)) : null;
    const low30 = l.history.filter(o => new Date(o.t) >= new Date(ref.getTime() - 10 * DAY) && new Date(o.t) < (during ? saleStart : now));
    const lowBefore = low30.length ? Math.min(...low30.map(o => o.price)) : null;
    if (!base || !sale) return { l, base, sale, saleLabel, verdict: 'nodata', firstT: l.history[0] ? l.history[0].t : null };
    const d = sale.price - base.price, pct = d / base.price * 100;
    let verdict = Math.abs(pct) < 3 ? 'same' : pct < 0 ? 'drop' : 'up';
    if (verdict !== 'up' && preHigh && preHigh > base.price * 1.03 && sale.price >= base.price * 0.97) verdict = 'inflated';
    if (verdict === 'drop' && lowBefore && sale.price > lowBefore * 1.01) verdict = 'drop-not-lowest';
    return { l, base, sale, saleLabel, d, pct, preHigh, lowBefore, verdict };
  }
  const VERDICT = {
    drop: ['good', 'Real drop', 'Lower than 20 days earlier and the lowest in this period.'],
    'drop-not-lowest': ['ok', 'Lower, but not the lowest', 'Cheaper than 20 days earlier, but it was cheaper still at some point before.'],
    same: ['muted', 'About the same', 'Within 3% of the price 20 days earlier.'],
    inflated: ['warn', 'Raised, then "discounted"', 'The price went up after the 20-day mark, so the sale mostly undoes that increase.'],
    up: ['bad', 'Higher than before', 'More expensive than 20 days earlier.'],
    nodata: ['muted', 'Not enough history', 'No price was recorded around 20 days before.']
  };
  function renderBfReport() {
    const now = new Date();
    let dates = shoppingDates(now.getFullYear());
    if (now > new Date(dates.cm.getTime() + 14 * DAY)) dates = shoppingDates(now.getFullYear());
    const during = now >= new Date(dates.bf.getTime() - 7 * DAY);
    const rows = visible().map(l => bfAnalysis(l, dates));
    const order = { drop: 0, 'drop-not-lowest': 1, same: 2, inflated: 3, up: 4, nodata: 5 };
    rows.sort((a, b) => order[a.verdict] - order[b.verdict] || (a.pct ?? 0) - (b.pct ?? 0));
    const withData = rows.filter(r => r.verdict !== 'nodata');
    const avg = withData.length ? withData.reduce((n, r) => n + r.pct, 0) / withData.length : null;
    const counts = Object.fromEntries(Object.keys(VERDICT).map(k => [k, rows.filter(r => r.verdict === k).length]));
    const dfmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const baseDate = during ? new Date(dates.bf.getTime() - 20 * DAY) : new Date(now.getTime() - 20 * DAY);
    view().innerHTML = pageHead('Black Friday Report', during
      ? `Lowest price during sale week (${dfmt(new Date(dates.bf.getTime() - 7 * DAY))} – ${dfmt(dates.cm)}) compared with the price 20 days before Black Friday (${dfmt(baseDate)}).`
      : `Black Friday is ${dfmt(dates.bf)}. Until sale week starts, this compares today's price with the price 20 days ago (${dfmt(baseDate)}). It switches to sale-week prices automatically.`) + `
      <div class="notice">${I('info')}<div>This shows whether a "deal" is really cheaper than before. Past prices come from automatic checks, prices you logged, and archived copies of retailer pages (Wayback Machine). Laptops tracked only recently show "Not enough history". For Amazon, use the camelcamelcamel or Keepa links in each laptop's details for longer history.</div></div>
      <section class="kpis">
        ${kpi('Laptops with history', `${withData.length} / ${rows.length}`, 'Have a price from 20 days earlier')}
        ${kpi('Average change', avg == null ? '—' : (avg <= 0 ? '−' : '+') + Math.abs(avg).toFixed(1) + '%', during ? 'Sale-week low vs 20 days before' : 'Today vs 20 days ago', avg != null && avg < -3 ? 'good' : '')}
        ${kpi('Real drops', counts.drop + counts['drop-not-lowest'], `${counts.drop} at their lowest`)}
        ${kpi('Raised, then "discounted"', counts.inflated, 'Watch out for these')}
      </section>
      ${rows.length ? `<div class="table-wrap"><table class="bf-table">
        <thead><tr><th>Laptop</th><th class="num">20 days before</th><th class="num">${during ? 'Sale-week low' : 'Today'}</th><th class="num">Change</th><th>Verdict</th></tr></thead>
        <tbody>${rows.map(r => {
          const v = VERDICT[r.verdict];
          return `<tr>
            <td><button class="linklike" data-action="detail" data-id="${esc(r.l.id)}">${esc(r.l.name)}</button>${r.l.demo ? ' <span class="badge badge-demo">Demo</span>' : ''}<div class="muted small">${GPUS[r.l.gpu].label} · ${esc(RETAILER_MAP[r.l.retailer].name)}</div></td>
            <td class="num">${r.base ? money(r.base.price) + `<div class="muted small">${esc(fmtDay(r.base.t))}${r.base.status === 'archive' ? ' · archive' : ''}</div>` : '<span class="muted">—</span>'}</td>
            <td class="num">${r.sale ? money(r.sale.price) + `<div class="muted small">${esc(fmtDay(r.sale.t))}</div>` : '<span class="muted">—</span>'}</td>
            <td class="num">${r.d != null ? `<span class="delta ${r.d < 0 ? 'down' : r.d > 0 ? 'up' : 'flat'}">${r.d < 0 ? '−' : r.d > 0 ? '+' : ''}${money(Math.abs(r.d))} (${Math.abs(r.pct).toFixed(1)}%)</span>` : '<span class="muted">—</span>'}</td>
            <td><span class="verdict v-${v[0]}" title="${esc(v[2])}">${esc(v[1])}</span>${r.verdict === 'nodata' && r.firstT ? `<div class="muted small">History starts ${esc(fmtDay(r.firstT))}</div>` : ''}</td>
          </tr>`;
        }).join('')}</tbody></table></div>
        <ul class="plain-list small mt">${Object.entries(VERDICT).map(([k, v]) => `<li><span class="verdict v-${v[0]}">${esc(v[1])}</span> ${esc(v[2])}</li>`).join('')}</ul>` : emptyState('Nothing tracked yet', 'Install the extension and open laptop pages to fill this report.')}`;
  }

  /* ---------- Compare ---------- */
  function renderCompare() {
    const ls = state.compare.map(getL).filter(Boolean);
    const options = visible().filter(l => !state.compare.includes(l.id)).sort((a, b) => a.name.localeCompare(b.name));
    const picker = ls.length < 4 ? `<label class="field compare-pick"><span class="sr-only">Add a laptop to compare</span><select id="compare-add"><option value="">+ Add a laptop to compare…</option>${options.map(l => `<option value="${esc(l.id)}">${esc(l.name)}${l.demo ? ' (demo)' : ''}</option>`).join('')}</select></label>` : '<span class="muted small">Up to 4 laptops at a time.</span>';
    let body;
    if (!ls.length) body = emptyState('Nothing to compare yet', 'Use the compare icon on any card, or pick laptops above.', ' ');
    else {
      const best = (fn, hi = true) => { const vals = ls.map(fn); const target = hi ? Math.max(...vals) : Math.min(...vals); return vals.map(v => ls.length > 1 && v === target && Number.isFinite(v)); };
      const row = (label, cells, bests) => `<tr><th scope="row">${label}</th>${cells.map((c, i) => `<td class="${bests && bests[i] ? 'best' : ''}">${c}</td>`).join('')}</tr>`;
      const st = ls.map(priceStats);
      const rows = [
        row('Price', ls.map((l, i) => priceHtml(l, st[i]) + `<div class="small">${statusBadge(l)}</div>`), best((l) => curPrice(l) ?? Infinity, false)),
        row('Last checked', ls.map((l, i) => st[i] ? `<span title="${esc(fmtDate(st[i].lastT))}">${ago(st[i].lastT)}</span> · ${esc(RETAILER_MAP[l.retailer].name)}` : '—')),
        row('Lowest / highest', ls.map((l, i) => st[i] ? `${money(st[i].lo)} / ${money(st[i].hi)}` : '—')),
        `<tr class="sec"><th colspan="${ls.length + 1}">Graphics</th></tr>`,
        row('GPU', ls.map(l => `<span class="gpu-chip g${l.gpu}">${GPUS[l.gpu].label}</span>`), best(l => GPUS[l.gpu].perf)),
        row('VRAM', ls.map(l => l.vram + 'GB'), best(l => l.vram)),
        row('TGP', ls.map(l => l.tgp ? l.tgp + 'W' : '—'), best(l => l.tgp || 0)),
        `<tr class="sec"><th colspan="${ls.length + 1}">System</th></tr>`,
        row('CPU', ls.map(l => esc(l.cpu || CPU_MAP[l.cpuClass].label)), best(l => CPU_MAP[l.cpuClass].score)),
        row('RAM', ls.map(l => l.ram + 'GB'), best(l => l.ram)),
        row('RAM upgrade', ls.map(l => l.ramUpgradeable ? `Yes, to ${l.ramMax}GB` : 'Soldered'), best(l => l.ramUpgradeable ? l.ramMax : 0)),
        row('Storage', ls.map(l => `${fmtStorage(l.storage)} · ${l.storageSlots} slot${l.storageSlots > 1 ? 's' : ''}`), best(l => l.storage + l.storageSlots)),
        row('Cooling', ls.map(l => `${l.cooling}/5${l.coolingNote ? `<div class="muted small">${esc(l.coolingNote)}</div>` : ''}`), best(l => l.cooling)),
        row('Display', ls.map(l => `${l.displaySize}" ${RES[l.displayRes].label} ${esc(l.panel)} ${l.hz}Hz`), best(l => components(l).display.v)),
        row('Weight', ls.map(l => l.weight ? l.weight + ' kg' : '—'), best(l => l.weight || Infinity, false)),
        row('Upgradeability', ls.map(l => esc(components(l).upgrade.why)), best(l => components(l).upgrade.v)),
        `<tr class="sec"><th colspan="${ls.length + 1}">Scores (out of 100)</th></tr>`,
        ...PROFILE_KEYS.map(k => row(PROFILES[k].label, ls.map(l => { const s = scoreFor(l, k).total; return `<span class="score-pill sp-${grade(s)}">${s}</span>`; }), best(l => scoreFor(l, k).total))),
        row('Value (gaming score per $1k)', ls.map(l => valueIndex(l, 'gaming').toFixed(1)), best(l => valueIndex(l, 'gaming'))),
        `<tr><th scope="row"></th>${ls.map(l => `<td><div class="row-actions"><button class="btn btn-sm" data-action="detail" data-id="${esc(l.id)}">Details</button><button class="btn btn-sm btn-ghost" data-action="compare-toggle" data-id="${esc(l.id)}">Remove</button></div></td>`).join('')}</tr>`
      ];
      body = `<div class="table-wrap"><table class="compare-table"><thead><tr><th></th>${ls.map(l => `<th scope="col"><div class="muted small">${esc(l.brand)}</div>${esc(l.name)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <p class="muted small">Highlighted cells are the best in each row. Scores ignore price; value divides the gaming score by price.</p>`;
    }
    view().innerHTML = pageHead('Compare Laptops', 'Side by side: specs, upgrade paths and scores for all six workloads.', `<div class="row-actions">${picker}${ls.length ? '<button class="btn btn-ghost btn-sm" data-action="compare-clear">Clear</button>' : ''}</div>`) + body;
    const sel = $('#compare-add');
    if (sel) sel.addEventListener('change', () => { if (sel.value) { toggleCompare(sel.value, true); } });
  }

  function obsTable(l) {
    if (!l.history.length) return '<p class="muted">No prices logged yet.</p>';
    const rows = l.history.map((o, i) => ({ o, i })).reverse();
    return `<div class="table-wrap"><table class="obs-table"><thead><tr><th>Date & time</th><th>Price</th><th>Change</th><th>Status</th><th>Source / note</th><th></th></tr></thead><tbody>${rows.map(({ o, i }) => {
      const prev = l.history[i - 1];
      const d = prev ? o.price - prev.price : null;
      return `<tr><td>${esc(fmtDate(o.t))}</td><td class="num">${money(o.price)}</td><td>${d == null ? '<span class="muted">first</span>' : d === 0 ? '<span class="muted">—</span>' : `<span class="delta ${d < 0 ? 'down' : 'up'}">${d < 0 ? '−' : '+'}${money(Math.abs(d)).slice(1)}</span>`}</td><td><span class="badge ${o.status === 'verified' ? 'badge-ok' : o.status === 'auto' ? 'badge-auto' : o.status === 'archive' ? 'badge-archive' : o.status === 'seen' ? 'badge-seen' : o.status === 'demo' ? 'badge-demo' : 'badge-warn'}">${o.status}</span></td><td class="muted small">${esc([o.source, o.note].filter(Boolean).join(' · ')) || '—'}</td><td><button class="icon-btn" data-action="del-obs" data-id="${esc(l.id)}" data-i="${i}" title="Delete this observation">${I('trash')}</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  /* ---------- Chart (dependency-free SVG) ---------- */
  function niceTicks(lo, hi, n = 4) {
    const span = hi - lo || 1;
    const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
    return out;
  }
  function drawChart(el, obs, opts = {}) {
    if (!el) return;
    ui.charts = ui.charts.filter(c => document.body.contains(c.el) && c.el !== el);
    ui.charts.push({ el, obs, opts });
    if (!obs.length) { el.innerHTML = '<div class="chart-empty muted">No observations yet. Log a price to start the chart.</div>'; return; }
    const W = Math.max(280, el.clientWidth || 640), H = opts.h || (W < 500 ? 220 : 280);
    const P = { l: 58, r: 14, t: 16, b: 30 };
    const xs = obs.map(o => +new Date(o.t)), ys = obs.map(o => o.price);
    let x0 = Math.min(...xs), x1 = Math.max(...xs, Date.now());
    if (x1 - x0 < DAY) { x0 -= DAY / 2; x1 += DAY / 2; }
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = (hi - lo) * 0.18 || hi * 0.05;
    const y0 = lo - pad, y1 = hi + pad;
    const X = t => P.l + (t - x0) / (x1 - x0) * (W - P.l - P.r);
    const Y = v => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
    let d = `M${X(xs[0]).toFixed(1)},${Y(ys[0]).toFixed(1)}`;
    for (let i = 1; i < xs.length; i++) d += `H${X(xs[i]).toFixed(1)}V${Y(ys[i]).toFixed(1)}`;
    d += `H${X(x1).toFixed(1)}`;
    const area = d + `V${H - P.b}H${X(xs[0]).toFixed(1)}Z`;
    const yt = niceTicks(y0, y1, 4), span = x1 - x0;
    const nx = W < 500 ? 3 : 5;
    const xt = Array.from({ length: nx }, (_, i) => x0 + span * i / (nx - 1));
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Price history chart from ${money(lo)} to ${money(hi)}">
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="area-top"/><stop offset="1" class="area-bot"/></linearGradient></defs>
      ${yt.map(v => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axis" x="${P.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${money(v)}</text>`).join('')}
      ${xt.map((t, i) => `<text class="axis" x="${X(t).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}">${fmtDay(t)}</text>`).join('')}
      ${obs.length > 1 ? `<line class="ref-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(lo)}" y2="${Y(lo)}"/><line class="ref-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(hi)}" y2="${Y(hi)}"/>
      <text class="ref-label" x="${W - P.r}" y="${Y(lo) + 14}" text-anchor="end">Low ${money(lo)}</text><text class="ref-label" x="${W - P.r}" y="${Y(hi) - 6}" text-anchor="end">High ${money(hi)}</text>` : ''}
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${d}" class="price-line"/>
      ${obs.map((o, i) => `<circle class="pt pt-${o.status}" cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="${obs.length > 30 ? 2.5 : 4}"/>`).join('')}
      <line class="hover-line" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" visibility="hidden"/>
      <rect class="hit" x="${P.l}" y="${P.t}" width="${W - P.l - P.r}" height="${H - P.t - P.b}" fill="transparent"/>
    </svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), hl = el.querySelector('.hover-line');
    const move = ev => {
      const rect = svg.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (W / rect.width);
      let best = 0, bd = Infinity;
      xs.forEach((x, i) => { const dd = Math.abs(X(x) - mx); if (dd < bd) { bd = dd; best = i; } });
      const o = obs[best], px = X(xs[best]);
      hl.setAttribute('x1', px); hl.setAttribute('x2', px); hl.setAttribute('visibility', 'visible');
      const prev = obs[best - 1];
      const ch = prev ? o.price - prev.price : null;
      tip.innerHTML = `<strong>${money(o.price)}</strong>${ch ? ` <span class="delta ${ch < 0 ? 'down' : 'up'}">${ch < 0 ? '−' : '+'}${money(Math.abs(ch)).slice(1)}</span>` : ''}<div class="muted">${esc(fmtDate(o.t))}</div><div class="muted">${esc(o.status)}${o.source ? ' · ' + esc(o.source) : ''}</div>`;
      tip.hidden = false;
      const left = px / W * rect.width;
      tip.style.left = Math.min(Math.max(left, 70), rect.width - 70) + 'px';
      tip.style.top = (Y(ys[best]) / H * rect.height - 10) + 'px';
    };
    const leave = () => { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); };
    const hit = el.querySelector('.hit');
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
  }

  /* =========================================================
   * 10. Modals
   * ======================================================= */
  let lastFocus = null;
  function openModal(html, { wide = false, label = 'Dialog' } = {}) {
    lastFocus = document.activeElement;
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"></div><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${I('x')}</button>${html}</div>`;
    root.hidden = false;
    document.body.classList.add('modal-open');
    const f = root.querySelector('input:not([type=hidden]), select, textarea, button:not(.modal-close)');
    (f || root.querySelector('.modal-close')).focus({ preventScroll: true });
  }
  function closeModal() {
    const root = $('#modal-root');
    if (root.hidden) return;
    root.hidden = true; root.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function confirmModal(title, body, yesLabel, onYes, danger = true) {
    openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p><div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-yes">${esc(yesLabel)}</button></div>`, { label: title });
    $('#confirm-yes').addEventListener('click', () => { closeModal(); onYes(); });
  }

  function openLogPrice(id) {
    const l = getL(id); if (!l) return;
    const st = priceStats(l);
    openModal(`
      <h2>Log a price</h2>
      <p class="muted small">${esc(l.name)} · ${esc(RETAILER_MAP[l.retailer].name)}${st ? ` · last ${money(st.cur)} (${ago(st.lastT)})` : ''}</p>
      ${l.demo ? '<div class="notice notice-demo small">This is a demo laptop. Prices you log here stay marked as demo. To track it for real, use Edit, turn off "demo", and add the product URL.</div>' : ''}
      <form id="price-form" class="form" novalidate>
        <div class="form-grid">
          <label class="fl"><span>Price you see (USD)</span><input name="price" type="number" step="0.01" min="1" inputmode="decimal" required placeholder="1999.99"></label>
          <label class="fl"><span>Observed at</span><input name="t" type="datetime-local" value="${localInputValue(new Date())}" required></label>
        </div>
        <fieldset class="fl"><legend>Is this price verified?</legend>
          <label class="radio"><input type="radio" name="status" value="verified" ${l.demo ? 'disabled' : 'checked'}><span><strong>Verified.</strong> I saw it on the retailer's own product page or cart just now.</span></label>
          <label class="radio"><input type="radio" name="status" value="unverified" ${l.demo ? 'disabled' : ''}><span><strong>Unverified.</strong> From an ad, a newsletter, a forum post or a friend.</span></label>
        </fieldset>
        <label class="fl"><span>Source or note (optional)</span><input name="note" type="text" maxlength="200" placeholder="e.g. Best Buy app, member price, open-box"></label>
        <label class="fl"><span>List / regular price (optional)</span><input name="listPrice" type="number" step="0.01" min="0" inputmode="decimal" value="${l.listPrice ?? ''}"></label>
        <div class="form-error" hidden></div>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${I('check')}Save price</button></div>
      </form>`, { label: 'Log a price' });
    $('#price-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const price = num(fd.get('price'));
      const t = new Date(fd.get('t'));
      const err = $('.form-error');
      if (!price || price <= 0 || price > 100000) { err.textContent = 'Enter a price between $1 and $100,000.'; err.hidden = false; return; }
      if (isNaN(t) || t > Date.now() + 60e3) { err.textContent = 'Choose a valid date and time that is not in the future.'; err.hidden = false; return; }
      const lp = num(fd.get('listPrice'));
      l.listPrice = lp && lp > 0 ? lp : null;
      const prev = curPrice(l);
      l.history.push(normObs({ t: t.toISOString(), price, status: l.demo ? 'demo' : (fd.get('status') || 'unverified'), source: 'Manual entry', note: fd.get('note') }));
      l.history.sort(byT);
      touch(l); save(); closeModal(); rerender();
      const d = prev != null ? price - prev : null;
      toast(d == null ? `Saved ${money(price)}` : d < 0 ? `Saved ${money(price)}: down ${money(-d)}` : d > 0 ? `Saved ${money(price)}: up ${money(d)}` : `Saved ${money(price)}: no change`, d < 0 ? 'good' : '');
    });
  }

  function openLaptopForm(id) {
    const l = id ? getL(id) : null;
    const v = l || { gpu: '5070ti', vram: 12, ram: 32, ramMax: 64, ramUpgradeable: true, storage: 1024, storageSlots: 2, displaySize: 16, displayRes: 'QHD', panel: 'IPS', hz: 240, cooling: 4, retailer: 'bestbuy', brand: 'Lenovo Legion' };
    const opt = (val, label, cur) => `<option value="${esc(val)}" ${String(val) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
    const brands = [...new Set([...BRANDS, v.brand])];
    openModal(`
      <h2>${l ? 'Edit laptop' : 'Add a laptop'}</h2>
      <p class="muted small">Copy the specs from the retailer's product page. Paste the product URL so "View deal" opens the exact listing.</p>
      <form id="laptop-form" class="form" novalidate>
        <div class="form-grid">
          <label class="fl span-2"><span>Model name *</span><input name="name" required maxlength="140" value="${esc(v.name || '')}" placeholder="e.g. Lenovo Legion Pro 7i Gen 10 (RTX 5080, 32GB, 2TB)"></label>
          <label class="fl"><span>Brand</span><select name="brand">${brands.map(b => opt(b, b, v.brand)).join('')}</select></label>
          <label class="fl"><span>Retailer</span><select name="retailer">${RETAILERS.map(r => opt(r.id, r.name, v.retailer)).join('')}</select></label>
          <label class="fl span-2"><span>Product URL</span><input name="url" type="url" maxlength="800" value="${esc(v.url || '')}" placeholder="https://www.bestbuy.com/site/…"></label>
          <label class="fl"><span>GPU *</span><select name="gpu" id="lf-gpu">${GPU_ORDER.map(k => opt(k, GPUS[k].label, v.gpu)).join('')}</select></label>
          <label class="fl"><span>VRAM (GB)</span><input name="vram" id="lf-vram" type="number" min="4" max="48" value="${v.vram}"></label>
          <label class="fl"><span>GPU TGP (W)</span><input name="tgp" type="number" min="35" max="250" value="${v.tgp ?? ''}" placeholder="e.g. 175"></label>
          <label class="fl"><span>CPU model</span><input name="cpu" maxlength="80" value="${esc(v.cpu || '')}" placeholder="Intel Core Ultra 9 275HX"></label>
          <label class="fl span-2"><span>CPU class (used for scoring)</span><select name="cpuClass">${CPU_CLASSES.map(c => opt(c.id, c.label, v.cpuClass || 'u9hx')).join('')}</select></label>
          <label class="fl"><span>RAM installed (GB)</span><input name="ram" type="number" min="4" max="256" value="${v.ram}"></label>
          <label class="fl"><span>Max RAM (GB)</span><input name="ramMax" type="number" min="4" max="256" value="${v.ramMax ?? v.ram}"></label>
          <label class="check span-2"><input type="checkbox" name="ramUpgradeable" ${v.ramUpgradeable ? 'checked' : ''}><span>RAM is upgradeable (SO-DIMM slots, not soldered)</span></label>
          <label class="fl"><span>SSD (GB)</span><select name="storage">${[512, 1024, 2048, 4096, 8192].map(s => opt(s, fmtStorage(s), v.storage)).join('')}</select></label>
          <label class="fl"><span>M.2 slots</span><select name="storageSlots">${[1, 2, 3, 4].map(s => opt(s, s, v.storageSlots)).join('')}</select></label>
          <label class="fl"><span>Screen size (in)</span><input name="displaySize" type="number" step="0.1" min="10" max="20" value="${v.displaySize}"></label>
          <label class="fl"><span>Resolution</span><select name="displayRes">${Object.entries(RES).map(([k, r]) => opt(k, r.label, v.displayRes)).join('')}</select></label>
          <label class="fl"><span>Panel</span><select name="panel">${Object.keys(PANELS).map(p => opt(p, p, v.panel)).join('')}</select></label>
          <label class="fl"><span>Refresh rate (Hz)</span><input name="hz" type="number" min="60" max="500" value="${v.hz}"></label>
          <label class="fl"><span>Cooling rating (1–5)</span><select name="cooling">${[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(s => opt(s, s + (s === 5 ? ' (excellent)' : s === 1 ? ' (poor)' : ''), v.cooling)).join('')}</select></label>
          <label class="fl"><span>Weight (kg)</span><input name="weight" type="number" step="0.01" min="0.8" max="6" value="${v.weight ?? ''}"></label>
          <label class="fl span-2"><span>Cooling notes</span><input name="coolingNote" maxlength="160" value="${esc(v.coolingNote || '')}" placeholder="From reviews: vapor chamber, fan noise, throttling…"></label>
          <label class="fl"><span>List / regular price</span><input name="listPrice" type="number" step="0.01" min="0" value="${v.listPrice ?? ''}"></label>
          ${l ? '' : `<label class="fl"><span>Current price (optional)</span><input name="price" type="number" step="0.01" min="1" placeholder="Logged now"></label>
          <label class="check span-2"><input type="checkbox" name="verified" checked><span>I confirmed this price on the retailer's own page just now</span></label>`}
          <label class="fl span-2"><span>Notes</span><textarea name="notes" rows="2" maxlength="600">${esc(l && !l.demo ? l.notes : '')}</textarea></label>
          ${l && l.demo ? '<label class="check span-2"><input type="checkbox" name="demo" checked><span>Demo entry (uncheck to treat this as your own tracked laptop; existing demo prices stay labeled demo)</span></label>' : ''}
        </div>
        <div class="form-error" hidden></div>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${I('check')}${l ? 'Save changes' : 'Add laptop'}</button></div>
      </form>`, { wide: true, label: l ? 'Edit laptop' : 'Add a laptop' });
    $('#lf-gpu').addEventListener('change', e => { $('#lf-vram').value = GPUS[e.target.value].vram; });
    $('#laptop-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const err = $('#laptop-form .form-error');
      const raw = Object.fromEntries(fd.entries());
      raw.ramUpgradeable = fd.has('ramUpgradeable'); raw.ramUpgradeKnown = true;
      if (!raw.name.trim()) { err.textContent = 'Model name is required.'; err.hidden = false; return; }
      if (raw.url && !safeUrl(raw.url)) { err.textContent = 'The product URL must start with https:// or http://'; err.hidden = false; return; }
      if (l) {
        const keepDemo = l.demo && fd.has('demo');
        const merged = normalizeLaptop({ ...l, ...raw, specsFrom: '', id: l.id, demo: keepDemo, history: l.history, watch: l.watch, target: l.target, addedAt: l.addedAt, notes: keepDemo ? l.notes : raw.notes });
        Object.assign(l, merged); touch(l); save(); closeModal(); rerender(); toast('Changes saved');
      } else {
        const price = num(raw.price);
        const nl = normalizeLaptop({ ...raw, id: uid(), history: price ? [{ t: new Date().toISOString(), price, status: fd.has('verified') ? 'verified' : 'unverified', source: 'Manual entry' }] : [] });
        if (!nl) { err.textContent = 'Please check the GPU and model name.'; err.hidden = false; return; }
        state.laptops.push(nl); save(); closeModal(); rerender(); toast('Laptop added', 'good');
      }
    });
  }

  function openHowScores() {
    const comps = Object.keys(COMP_LABELS);
    openModal(`
      <h2>How scores work</h2>
      <p class="muted">Every laptop gets an estimated score out of 100 for each workload. Each factor is rated from 0 to 1 using the specs below, then multiplied by that workload's weight. Price is not part of the score; "value" divides the score by price.</p>
      <div class="table-wrap"><table class="weights"><thead><tr><th>Factor</th>${PROFILE_KEYS.map(k => `<th>${PROFILES[k].short}</th>`).join('')}</tr></thead><tbody>
        ${comps.map(c => `<tr><th scope="row">${COMP_LABELS[c]}</th>${PROFILE_KEYS.map(k => { const w = PROFILES[k].w[c] || 0; return `<td class="${w >= .25 ? 'hi' : ''}">${w ? Math.round(w * 100) : '·'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>
      <h3>How each factor is rated</h3>
      <ul class="plain-list small">
        <li><strong>GPU performance:</strong> GPU tier index (5050 = 42 up to 5090 = 100), reduced when TGP is below 175W.</li>
        <li><strong>VRAM:</strong> VRAM ÷ 24GB. This matters most for local AI models.</li>
        <li><strong>CPU:</strong> class score from the CPU class list (HX chips rate highest).</li>
        <li><strong>RAM:</strong> 75% from installed RAM (64GB = full marks) and 25% from the upgrade ceiling if the RAM isn't soldered.</li>
        <li><strong>Storage:</strong> 70% capacity (2TB = full) and 30% for a second M.2 slot.</li>
        <li><strong>Cooling:</strong> your 1–5 rating ÷ 5. Base it on reviews of sustained load, not marketing.</li>
        <li><strong>Display:</strong> panel (OLED > Mini-LED > IPS), resolution and refresh rate.</li>
        <li><strong>Upgradeability:</strong> socketed RAM (60%) and a spare M.2 slot (40%).</li>
        <li><strong>Portability:</strong> lighter is better, from 3.6 kg (zero) to 1.8 kg (full).</li>
        <li><strong>Penalties:</strong> −6 for under 32GB RAM in lab, AI and multitasking scores. −3 for gaming when GPU TGP is under 100W.</li>
      </ul>
      <p class="muted small">These are transparent estimates to help shortlist laptops, not benchmark results. Check reviews for thermals, noise and build quality. You can change the weights in <code>script.js</code> (look for <code>PROFILES</code>).</p>
      <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">Got it</button></div>`, { wide: true, label: 'How scores work' });
  }

  /* =========================================================
   * 11. Import / export / feed
   * ======================================================= */
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  function exportJSON() {
    const data = { format: 'rtx-deal-hunter-backup', version: 1, exportedAt: new Date().toISOString(), note: 'Laptops with demo: true contain demonstration prices, not real deals.', settings: state.settings, compare: state.compare, laptops: state.laptops.map(({ _v, ...l }) => l) };
    download(`rtx-deal-hunter-backup-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
    toast('Backup downloaded');
  }
  const CSV_COLS = ['laptop_id', 'name', 'brand', 'gpu', 'vram_gb', 'tgp_w', 'cpu', 'ram_gb', 'ram_max_gb', 'ram_upgradeable', 'storage_gb', 'storage_slots', 'display_in', 'display_res', 'panel', 'hz', 'cooling', 'weight_kg', 'retailer', 'url', 'list_price_usd', 'price_usd', 'status', 'observed_at', 'source', 'note', 'demo'];
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;   // spreadsheet formula-injection guard
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCSV() {
    const rows = [CSV_COLS];
    for (const l of state.laptops) {
      const base = [l.id, l.name, l.brand, GPUS[l.gpu].label, l.vram, l.tgp, l.cpu, l.ram, l.ramMax, l.ramUpgradeable, l.storage, l.storageSlots, l.displaySize, l.displayRes, l.panel, l.hz, l.cooling, l.weight, l.retailer, l.url, l.listPrice];
      if (!l.history.length) rows.push([...base, '', '', '', '', '', l.demo]);
      for (const o of l.history) rows.push([...base, o.price, o.status, o.t, o.source, o.note, l.demo]);
    }
    download(`rtx-deal-hunter-prices-${stamp()}.csv`, '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
    toast('CSV downloaded');
  }
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
  }
  function csvToLaptops(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('The CSV has no data rows.');
    const head = rows[0].map(h => h.trim().toLowerCase());
    const col = name => head.indexOf(name);
    if (col('name') < 0 || col('gpu') < 0) throw new Error('The CSV needs at least "name" and "gpu" columns (plus "price_usd" for prices).');
    const unq = s => (s || '').replace(/^'(?=[=+\-@\t\r])/, '');
    const get = (r, n) => { const i = col(n); return i < 0 ? '' : unq(r[i]).trim(); };
    const groups = new Map();
    for (const r of rows.slice(1)) {
      const key = get(r, 'laptop_id') || (get(r, 'name') + '|' + get(r, 'retailer')).toLowerCase();
      if (!groups.has(key)) groups.set(key, {
        id: get(r, 'laptop_id') || undefined, name: get(r, 'name'), brand: get(r, 'brand'), gpu: get(r, 'gpu'), vram: get(r, 'vram_gb'), tgp: get(r, 'tgp_w'), cpu: get(r, 'cpu'),
        ram: get(r, 'ram_gb'), ramMax: get(r, 'ram_max_gb'), ramUpgradeable: get(r, 'ram_upgradeable'), storage: get(r, 'storage_gb'), storageSlots: get(r, 'storage_slots'),
        displaySize: get(r, 'display_in'), displayRes: get(r, 'display_res'), panel: get(r, 'panel'), hz: get(r, 'hz'), cooling: get(r, 'cooling'), weight: get(r, 'weight_kg'),
        retailer: get(r, 'retailer'), url: get(r, 'url'), listPrice: get(r, 'list_price_usd'), demo: get(r, 'demo'), history: []
      });
      const price = get(r, 'price_usd') || get(r, 'price');
      if (price) groups.get(key).history.push({ price, status: get(r, 'status'), verified: get(r, 'verified'), t: get(r, 'observed_at') || new Date().toISOString(), source: get(r, 'source') || 'CSV import', note: get(r, 'note') });
    }
    return [...groups.values()];
  }
  function mergeLaptop(n) {
    const low = s => String(s || '').toLowerCase();
    const ex = state.laptops.find(l => l.id === n.id) || (n.url && state.laptops.find(l => l.url && l.url === n.url)) || state.laptops.find(l => low(l.name) === low(n.name) && l.retailer === n.retailer);
    if (!ex) { if (state.laptops.some(l => l.id === n.id)) n.id = uid(); state.laptops.push(n); return { added: 1, obs: n.history.length }; }
    let added = 0;
    for (const o of n.history) {
      if (!ex.history.some(h => h.t === o.t && h.price === o.price)) { ex.history.push(ex.demo ? { ...o, status: 'demo' } : o); added++; }
    }
    ex.history.sort(byT);
    if (!ex.url && n.url) ex.url = n.url;
    if (n.auto) {   // fresh status from the automatic checker
      if (n.listPrice) ex.listPrice = n.listPrice;
      if (n.checkedAt && (!ex.checkedAt || n.checkedAt > ex.checkedAt)) { ex.checkedAt = n.checkedAt; ex.checkStatus = n.checkStatus; ex.checkDetail = n.checkDetail; ex.available = n.available; }
    } else if (n.listPrice && !ex.listPrice) ex.listPrice = n.listPrice;
    touch(ex);
    return { added: 0, obs: added };
  }
  function mergeAll(raws) {
    let lap = 0, obs = 0, skipped = 0;
    for (const r of raws) {
      const n = normalizeLaptop(r);
      if (!n) { skipped++; continue; }
      const res = mergeLaptop(n); lap += res.added; obs += res.obs;
    }
    return { lap, obs, skipped };
  }
  function feedToRaws(data, sourceLabel) {
    const items = Array.isArray(data) ? data : (data.items || data.laptops || []);
    if (!Array.isArray(items)) throw new Error('No "items" array found in the feed.');
    const isAutoFeed = data && data.format === 'rtx-deal-hunter-feed' && data.version >= 2;
    return items.map(it => ({
      ...it, auto: isAutoFeed || it.auto,
      history: Array.isArray(it.history) && it.history.length ? it.history.map(o => ({ ...o, source: o.source || sourceLabel }))
        : (it.price != null ? [{ price: it.price, t: it.observedAt || data.generated || new Date().toISOString(), status: it.demo ? 'demo' : (toBool(it.verified) ? 'verified' : 'unverified'), source: it.source || sourceLabel }] : [])
    }));
  }
  async function importFile(file) {
    if (file.size > 5 * 1024 * 1024) { toast('That file is larger than 5 MB.', 'error'); return; }
    const text = await file.text();
    try {
      let raws, data = null;
      if (/\.csv$/i.test(file.name) || /^﻿?\s*[a-z_]+,/i.test(text.slice(0, 200))) raws = csvToLaptops(text);
      else {
        data = JSON.parse(text);
        raws = data.format === 'rtx-deal-hunter-backup' ? data.laptops : feedToRaws(data, 'Import: ' + file.name);
      }
      if (!Array.isArray(raws)) throw new Error('Unrecognized file format.');
      const doIt = () => {
        if (state.settings.importMode === 'replace') {
          state.laptops = [];
          if (data && data.format === 'rtx-deal-hunter-backup' && data.settings) state.settings = { ...DEFAULT_SETTINGS, ...data.settings, importMode: 'replace' };
          state.compare = [];
        }
        const r = mergeAll(raws);
        save(); applyTheme(); rerender();
        toast(`Imported: ${r.lap} new laptop${r.lap === 1 ? '' : 's'}, ${r.obs} new price${r.obs === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} skipped (missing name or GPU)` : ''}.`, 'good');
      };
      if (state.settings.importMode === 'replace') confirmModal('Replace all data?', `This deletes the ${state.laptops.length} laptops in this browser and loads ${raws.length} from "${file.name}". Export a backup first if you might need them.`, 'Replace data', doIt);
      else doIt();
    } catch (e) {
      toast('Import failed: ' + e.message, 'error');
    }
  }
  let feedBusy = false;
  async function refreshFeed(silent) {
    const raw = (state.settings.feedUrl || '').trim();
    if (!raw) { if (!silent) openRefreshInfo(); return; }
    let url;
    try { url = new URL(raw, location.href); } catch { if (!silent) toast('The feed URL is not valid.', 'error'); return; }
    if (!/^https?:$/.test(url.protocol)) { if (!silent) openRefreshInfo(); return; }
    if (feedBusy) return; feedBusy = true;
    const btns = $$('[data-action=refresh]'); btns.forEach(b => b.classList.add('spinning'));
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
    try {
      url.searchParams.set('_', Date.now());   // bypass caches so new checks show up
      const res = await fetch(url.href, { cache: 'no-store', signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(res.status === 404 ? 'feed.json was not found. Upload it with the project files.' : 'HTTP ' + res.status);
      const data = await res.json();
      const r = mergeAll(feedToRaws(data, 'Feed: ' + url.hostname));
      // Prices recorded by the browser extension live in manual.json next to feed.json
      try {
        const m = new URL('manual.json', url); m.searchParams.set('_', Date.now());
        const mr = await fetch(m.href, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (mr.ok) { const md = await mr.json(); const r2 = mergeAll(feedToRaws(md, 'Browser extension')); r.lap += r2.lap; r.obs += r2.obs; state.extMeta = { generated: md.generated || null, items: (md.items || []).length }; }
      } catch { /* no extension data yet */ }
      state.feedMeta = { generated: data.generated || null, schedule: data.schedule || '', sources: Array.isArray(data.sources) ? data.sources.slice(0, 30) : [], items: (data.items || []).length, error: null };
      state.settings.lastFeedAt = new Date().toISOString();
      // First real data in: hide the demo entries so they don't mix with real prices
      if (r.lap && state.settings.showDemo && state.laptops.some(l => l.demo) && state.laptops.some(l => l.auto)) {
        state.settings.showDemo = false;
        toast('Real prices loaded. Demo data is now hidden; you can turn it back on in Settings.', 'good');
      }
      save(); rerender();
      if (!silent || r.lap || r.obs) toast(r.lap || r.obs ? `Prices updated: ${r.lap} new laptop${r.lap === 1 ? '' : 's'}, ${r.obs} new price${r.obs === 1 ? '' : 's'}.` : 'Prices are up to date.', r.lap || r.obs ? 'good' : '');
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'Loading the price feed timed out.' : `Couldn't load the price feed (${e.message}).`;
      state.feedMeta = { ...(state.feedMeta || {}), error: msg };
      save(); if (currentView === 'overview') rerender();
      if (!silent) toast(msg, 'error');
    } finally { feedBusy = false; clearTimeout(to); btns.forEach(b => b.classList.remove('spinning')); }
  }
  function exportTracked() {
    const base = { _help: 'Laptops the automatic checker watches. See README.', bestbuy: { enabled: true, gpus: ['5050', '5060', '5070', '5070 Ti', '5080', '5090'], minRamGB: 16, skus: [], maxPages: 2 }, items: [] };
    const go = cur => {
      const out = { ...base, ...cur, items: [] };
      const keep = (cur && Array.isArray(cur.items)) ? cur.items.filter(i => i && i.url) : [];
      const urls = new Set(keep.map(i => i.url));
      const mine = state.laptops.filter(l => !l.demo && !l.auto && l.url && !urls.has(l.url)).map(l => ({
        id: l.id, name: l.name, url: l.url, retailer: l.retailer, brand: l.brand, gpu: GPUS[l.gpu].label, vram: l.vram, tgp: l.tgp, cpu: l.cpu, cpuClass: l.cpuClass,
        ram: l.ram, ramMax: l.ramMax, ramUpgradeable: l.ramUpgradeable, storage: l.storage, storageSlots: l.storageSlots, displaySize: l.displaySize, displayRes: l.displayRes,
        panel: l.panel, hz: l.hz, cooling: l.cooling, coolingNote: l.coolingNote, weight: l.weight, listPrice: l.listPrice
      }));
      out.items = [...keep, ...mine];
      download('tracked.json', JSON.stringify(out, null, 2) + '\n', 'application/json');
      toast(`tracked.json downloaded with ${out.items.length} product page${out.items.length === 1 ? '' : 's'}. Upload it to your repository.`, 'good');
    };
    if (/^https?:$/.test(location.protocol)) fetch('tracked.json?_=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(go);
    else go(null);
  }


  /* =========================================================
   * 9. Layout helpers
   * ======================================================= */
  let currentView = 'overview';
  let routeParam = '';
  const view = () => $('#view');
  const pageHead = (title, sub, extra = '') => `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="lead">${esc(sub)}</p>` : ''}</div>${extra ? `<div class="page-actions">${extra}</div>` : ''}</header>`;
  const kpi = (label, value, sub, tone = '') => `<div class="stat ${tone}"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div>${sub ? `<div class="stat-sub">${esc(sub)}</div>` : ''}</div>`;
  function emptyState(title, body, action) {
    return `<div class="empty"><div class="empty-ico">${I('search')}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${action === undefined ? `<div class="row-actions center"><a class="btn btn-primary" href="#/guide">${I('info')}How to add laptops</a><button class="btn" data-action="load-demo">Load sample data</button></div>` : action}</div>`;
  }
  const storeName = l => (RETAILER_MAP[l.retailer] || RETAILER_MAP.other).name;
  const specLine = l => [l.cpu ? l.cpu.replace(/^(Intel|AMD)\s+/i, '').replace(/Core\s+/i, '') : '', l.ram ? l.ram + 'GB' : '', l.storage ? fmtStorage(l.storage) : '', l.displaySize ? `${l.displaySize}" ${l.panel !== 'IPS' ? l.panel : ''}`.trim() : ''].filter(Boolean).join(' · ');
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const pctTxt = (v, digits = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(digits) + '%';
  const deltaChip = (d, pct) => d == null || d === 0 ? '' : `<span class="delta ${d < 0 ? 'down' : 'up'}">${I(d < 0 ? 'down' : 'up')}${money(Math.abs(d))}${pct != null ? ` <span class="delta-pct">${Math.abs(pct).toFixed(1)}%</span>` : ''}</span>`;
  const SOURCE_LABEL = { seen: 'Seen in browser', auto: 'Auto-checked', archive: 'Archived', verified: 'Verified by you', unverified: 'Logged by you', demo: 'Sample data' };

  /* Is this a good price? Plain-language verdict from the recorded history. */
  function priceVerdict(l) {
    const st = priceStats(l);
    if (!st) return { tone: 'muted', title: 'No price yet', body: 'Open this laptop\'s store page with the extension installed, or log a price with the button above.' };
    if (st.count < 2) return { tone: 'muted', title: 'Not enough history yet', body: `One price recorded so far (${money(st.cur)}). Each new check adds to the history, and the verdict appears after the second one.` };
    const above = (st.cur - st.lo) / st.lo * 100;
    const lowObs = l.history.find(o => o.price === st.lo);
    const when = lowObs ? fmtDay(lowObs.t) : '';
    if (st.cur <= st.lo) return { tone: 'good', title: 'Lowest price recorded', body: `${money(st.cur)} is the lowest of ${st.count} recorded prices, ${money(st.belowHigh)} below the highest (${money(st.hi)}).` };
    if (above <= 3) return { tone: 'good', title: 'Good price', body: `Within ${above.toFixed(1)}% of the lowest recorded price (${money(st.lo)} on ${when}).` };
    if (above <= 10) return { tone: 'ok', title: 'Fair price', body: `${above.toFixed(1)}% above the lowest recorded price (${money(st.lo)} on ${when}). Set a target price to get alerted if it drops.` };
    return { tone: 'warn', title: 'Wait if you can', body: `${above.toFixed(1)}% above the lowest recorded price (${money(st.lo)} on ${when}). It has been cheaper before.` };
  }

  /* Market statistics used on the overview */
  function marketStats(list) {
    const now = Date.now();
    const priced = list.filter(l => curPrice(l) != null);
    const allObs = list.flatMap(l => l.history.map(o => ({ o, l })));
    const last24 = allObs.filter(x => now - new Date(x.o.t) < DAY).length;
    const weekDrops = priced.filter(l => { const w = priceAt(l, new Date(now - 7 * DAY)); return w && curPrice(l) < w.price; });
    const ranked = priced.map(l => ({ l, st: priceStats(l) })).filter(x => x.st.count > 1 && x.st.belowHighPct > 0).sort((a, b) => b.st.belowHighPct - a.st.belowHighPct || valueIndex(b.l, 'gaming') - valueIndex(a.l, 'gaming'));
    const best = ranked[0] || (priced.length ? { l: [...priced].sort((a, b) => valueIndex(b, 'gaming') - valueIndex(a, 'gaming'))[0] } : null);
    const byGpu = GPU_ORDER.map(k => {
      const ls = priced.filter(l => l.gpu === k);
      const cheapest = ls.length ? ls.reduce((a, b) => curPrice(a) <= curPrice(b) ? a : b) : null;
      return { k, n: ls.length, cheapest, med: median(ls.map(curPrice)) };
    });
    const byStore = RETAILERS.map(r => ({ r, n: list.filter(l => l.retailer === r.id).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
    return { priced, allObs, last24, weekDrops, best, byGpu, byStore };
  }
  /* Price index: average change of each laptop's price relative to its first recorded price, per day */
  function priceIndex(list, days = 30) {
    const withH = list.filter(l => l.history.length);
    if (!withH.length) return [];
    const first = Math.min(...withH.map(l => +new Date(l.history[0].t)));
    const start = Math.max(first, Date.now() - days * DAY);
    const pts = [];
    for (let t = new Date(new Date(start).toDateString()).getTime() + DAY - 1; t < Date.now() + DAY; t += DAY) {
      const end = new Date(Math.min(t, Date.now()));
      const ratios = withH.filter(l => new Date(l.history[0].t) <= end).map(l => priceAt(l, end).price / l.history[0].price - 1);
      if (ratios.length) pts.push({ t: end.toISOString(), v: ratios.reduce((a, b) => a + b, 0) / ratios.length * 100, n: ratios.length });
    }
    return pts;
  }
  function lineChart(el, pts, { fmt = v => v.toFixed(1), h = 200, zero = false } = {}) {
    if (!el) return;
    if (pts.length < 2) { el.innerHTML = '<div class="chart-empty">The trend appears after prices are recorded on two different days.</div>'; return; }
    const W = Math.max(280, el.clientWidth || 600), P = { l: 46, r: 12, t: 12, b: 26 };
    const xs = pts.map(p => +new Date(p.t)), ys = pts.map(p => p.v);
    let lo = Math.min(...ys, zero ? 0 : Infinity), hi = Math.max(...ys, zero ? 0 : -Infinity);
    if (hi - lo < 1) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * .15; lo -= pad; hi += pad;
    const X = t => P.l + (t - xs[0]) / ((xs[xs.length - 1] - xs[0]) || 1) * (W - P.l - P.r);
    const Y = v => P.t + (1 - (v - lo) / (hi - lo)) * (h - P.t - P.b);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
    const ticks = niceTicks(lo, hi, 3);
    const gid = 'li' + Math.random().toString(36).slice(2, 7);
    el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="Trend chart">
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="area-top"/><stop offset="1" class="area-bot"/></linearGradient></defs>
      ${ticks.map(v => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
      ${zero && lo < 0 && hi > 0 ? `<line class="ref-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(0)}" y2="${Y(0)}"/>` : ''}
      <text class="axis" x="${P.l}" y="${h - 6}">${fmtDay(pts[0].t)}</text><text class="axis" x="${W - P.r}" y="${h - 6}" text-anchor="end">${fmtDay(pts[pts.length - 1].t)}</text>
      <path d="${d}L${X(xs[xs.length - 1])},${h - P.b}L${X(xs[0])},${h - P.b}Z" fill="url(#${gid})"/>
      <path d="${d}" class="price-line"/>
      <circle class="pt pt-auto" cx="${X(xs[xs.length - 1])}" cy="${Y(ys[ys.length - 1])}" r="4"/>
      <line class="hover-line" x1="0" x2="0" y1="${P.t}" y2="${h - P.b}" visibility="hidden"/>
      <rect class="hit" x="${P.l}" y="${P.t}" width="${W - P.l - P.r}" height="${h - P.t - P.b}" fill="transparent"/>
    </svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), hl = el.querySelector('.hover-line');
    const hit = el.querySelector('.hit');
    hit.addEventListener('pointermove', ev => {
      const r = svg.getBoundingClientRect(), mx = (ev.clientX - r.left) * W / r.width;
      let bi = 0; xs.forEach((x, i) => { if (Math.abs(X(x) - mx) < Math.abs(X(xs[bi]) - mx)) bi = i; });
      hl.setAttribute('x1', X(xs[bi])); hl.setAttribute('x2', X(xs[bi])); hl.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.innerHTML = `<strong>${esc(fmt(pts[bi].v))}</strong><div class="muted">${fmtDay(pts[bi].t)} · ${pts[bi].n} laptops</div>`;
      tip.style.left = Math.min(Math.max(X(xs[bi]) / W * r.width, 60), r.width - 60) + 'px'; tip.style.top = (Y(pts[bi].v) / h * r.height - 8) + 'px';
    });
    hit.addEventListener('pointerleave', () => { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); });
    ui.charts.push({ el, redraw: () => lineChart(el, pts, { fmt, h, zero }) });
  }

  /* Laptop card */
  function lcard(l, pk = state.settings.profile) {
    const st = priceStats(l), s = scoreFor(l, pk);
    const v = st && st.count > 1 ? priceVerdict(l) : null;
    const lastSrc = latest(l) ? SOURCE_LABEL[latest(l).status] : '';
    return `<article class="lcard ${l.demo ? 'is-demo' : ''}">
      <a class="lcard-link" href="#/laptop/${encodeURIComponent(l.id)}" aria-label="${esc(l.name)}"></a>
      <div class="lc-top"><span class="gpu-chip g${l.gpu}">${GPUS[l.gpu].label}</span><span class="lc-store">${esc(storeName(l))}</span>${l.demo ? '<span class="tag tag-demo">Sample</span>' : ''}</div>
      <h3 class="lc-name">${esc(l.name)}</h3>
      <p class="lc-spec">${esc(specLine(l))}</p>
      <div class="lc-price">
        <div><strong class="${l.demo ? 'demo-price' : ''}">${st ? money(st.cur) : '—'}</strong>${st && st.dPrev ? deltaChip(st.dPrev, st.dPrevPct) : ''}</div>
        ${sparkline(l.history)}
      </div>
      <div class="lc-foot">
        <span class="lc-score sc-${grade(s.total)}" title="${esc(PROFILES[pk === 'labs' ? 'vm' : pk]?.label || 'Score')}">${s.total}<small>/100</small></span>
        ${v ? `<span class="lc-verdict v-${v.tone}">${esc(v.title)}</span>` : `<span class="lc-time">${st ? esc(lastSrc) + ' · ' + ago(st.lastT) : 'No price yet'}</span>`}
        <button class="star ${l.watch ? 'on' : ''}" data-action="watch" data-id="${esc(l.id)}" aria-pressed="${l.watch}" title="${l.watch ? 'Remove from watchlist' : 'Add to watchlist'}">${I('star')}</button>
      </div>
    </article>`;
  }

  /* =========================================================
   * 10. Pages
   * ======================================================= */
  const NAV = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'laptops', label: 'Laptops', icon: 'chip' },
    { id: 'compare', label: 'Compare', icon: 'columns' },
    { id: 'black-friday', label: 'Black Friday', icon: 'bolt' },
    { id: 'watchlist', label: 'Watchlist', icon: 'star' }
  ];
  const ALIASES = { dashboard: 'overview', deals: 'laptops', gpus: 'laptops', gaming: 'laptops', labs: 'laptops', under1000: 'laptops', under1500: 'laptops', under2000: 'laptops', bfreport: 'black-friday', history: 'laptops', retailers: 'settings' };

  /* ---------- Overview ---------- */
  function checklist(list) {
    if (state.settings.hideChecklist) return '';
    const mine = list.filter(l => !l.demo);
    const steps = [
      { done: !!(state.extMeta && state.extMeta.generated) || mine.some(l => l.history.some(o => o.status === 'seen')), title: 'Install the browser extension', body: 'It records prices from Amazon, Best Buy and other store pages you open.', link: '#/guide' },
      { done: mine.length >= 5, title: `Track 5 laptops (${Math.min(mine.length, 5)}/5)`, body: 'Open RTX 50-series laptop pages you\'re interested in. Each one is added automatically.', link: '#/guide' },
      { done: list.some(l => l.target), title: 'Set a target price', body: 'Open a laptop, then set the price you\'d pay. You get an alert when it\'s reached.', link: '#/watchlist' },
      { done: state.compare.length >= 2, title: 'Compare two laptops', body: 'Use Compare on a laptop page to see specs and scores side by side.', link: '#/laptops' }
    ];
    const done = steps.filter(s => s.done).length;
    if (done === steps.length) return '';
    return `<section class="panel checklist">
      <div class="panel-head"><div><h2>Get started</h2><p class="muted small">${done} of ${steps.length} done</p></div><button class="btn btn-ghost btn-sm" data-action="hide-checklist">Hide</button></div>
      <div class="progress"><span style="width:${done / steps.length * 100}%"></span></div>
      <ol class="steps">${steps.map(s => `<li class="${s.done ? 'done' : ''}"><span class="step-dot">${s.done ? I('check') : ''}</span><a href="${s.link}"><strong>${esc(s.title)}</strong><span>${esc(s.body)}</span></a></li>`).join('')}</ol>
    </section>`;
  }
  function renderOverview() {
    const list = visible();
    const ms = marketStats(list);
    const cd = countdown();
    const lastT = list.map(lastCheck).filter(Boolean).sort().pop();
    const idx = priceIndex(list);
    const idxNow = idx.length ? idx[idx.length - 1].v : null;
    const recent = ms.allObs.sort((a, b) => new Date(b.o.t) - new Date(a.o.t)).slice(0, 8);
    const best = ms.best;
    const bestSt = best ? priceStats(best.l) : null;
    const bestV = best ? priceVerdict(best.l) : null;

    view().innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">${I('bolt')}${cd.live ? esc(cd.title) : `Black Friday in ${cd.d} day${cd.d === 1 ? '' : 's'}`} <span class="muted">· ${esc(cd.sub)}</span></p>
          <h1>RTX 50-series laptop prices,<br>tracked for you.</h1>
          <p class="lead">${list.length ? `${list.length} laptops from ${ms.byStore.length} store${ms.byStore.length === 1 ? '' : 's'}, ${ms.allObs.length} prices recorded. Last update ${lastT ? ago(lastT) : '—'}.` : 'Nothing tracked yet. Install the browser extension and open a few laptop pages to begin.'}</p>
        </div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/laptops">${I('chip')}Browse laptops</a>
          <a class="btn" href="#/black-friday">${I('bolt')}Black Friday report</a>
        </div>
      </section>

      ${checklist(list)}

      ${list.length ? `
      <section class="stats">
        ${kpi('Laptops tracked', list.length, `${ms.priced.length} with a price`)}
        ${kpi('Prices recorded', ms.allObs.length, `${ms.last24} in the last 24 hours`)}
        ${kpi('Cheaper than a week ago', ms.weekDrops.length, ms.priced.length ? `of ${ms.priced.length} laptops` : '', ms.weekDrops.length ? 'good' : '')}
        ${kpi('Average price change', idxNow == null ? '—' : pctTxt(idxNow), 'since each laptop was first seen', idxNow != null && idxNow < -1 ? 'good' : idxNow > 1 ? 'bad' : '')}
      </section>

      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h2>Best deal right now</h2><a class="small" href="#/laptops?sort=drop">All deals →</a></div>
          ${best ? `<a class="feature" href="#/laptop/${encodeURIComponent(best.l.id)}">
            <div class="feature-top"><span class="gpu-chip g${best.l.gpu}">${GPUS[best.l.gpu].label}</span><span class="muted small">${esc(storeName(best.l))}</span></div>
            <h3>${esc(best.l.name)}</h3>
            <div class="feature-price"><strong>${money(bestSt.cur)}</strong>${bestSt.belowHigh > 0 ? `<span class="delta down">${I('down')}${money(bestSt.belowHigh)} below its high</span>` : ''}</div>
            <p class="verdict-line v-${bestV.tone}">${esc(bestV.title)}. <span>${esc(bestV.body)}</span></p>
            <p class="muted small">Gaming score ${scoreFor(best.l, 'gaming').total}/100 · ${esc(specLine(best.l))}</p>
          </a>` : '<p class="muted">Deals show here once laptops have at least two recorded prices.</p>'}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Price trend</h2><span class="muted small">Last 30 days</span></div>
          <p class="muted small">Average change in tracked laptops' prices compared with the first price recorded for each. Below zero means prices are falling.</p>
          <div class="chart" id="index-chart"></div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-head"><h2>Cheapest laptop for each GPU</h2><a class="small" href="#/laptops">Browse all →</a></div>
        <div class="table-wrap flat"><table class="gpu-tbl">
          <thead><tr><th>GPU</th><th>Cheapest tracked</th><th class="num">Price</th><th class="num">Median</th><th class="num">Tracked</th></tr></thead>
          <tbody>${ms.byGpu.map(g => `<tr>
            <td><a href="#/laptops?gpu=${g.k}" class="gpu-chip g${g.k}">${GPUS[g.k].label}</a><div class="muted small">${GPUS[g.k].vram}GB VRAM</div></td>
            <td>${g.cheapest ? `<a href="#/laptop/${encodeURIComponent(g.cheapest.id)}">${esc(g.cheapest.name)}</a><div class="muted small">${esc(storeName(g.cheapest))}</div>` : '<span class="muted">None tracked yet</span>'}</td>
            <td class="num">${g.cheapest ? `<strong>${money(curPrice(g.cheapest))}</strong>` : '—'}</td>
            <td class="num">${g.med ? money(g.med) : '—'}</td>
            <td class="num">${g.n}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>

      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h2>Recent price activity</h2></div>
          ${recent.length ? `<ul class="activity">${recent.map(({ o, l }) => {
            const i = l.history.indexOf(o), prev = l.history[i - 1];
            const d = prev ? o.price - prev.price : null;
            return `<li><span class="act-ico ${d == null ? 'new' : d < 0 ? 'down' : d > 0 ? 'up' : 'same'}">${I(d == null ? 'plus' : d < 0 ? 'down' : d > 0 ? 'up' : 'check')}</span>
              <div class="act-main"><a href="#/laptop/${encodeURIComponent(l.id)}">${esc(l.name)}</a><div class="muted small">${d == null ? 'First price' : d < 0 ? `Dropped ${money(-d)}` : d > 0 ? `Rose ${money(d)}` : 'No change'} · ${esc(storeName(l))} · ${esc(SOURCE_LABEL[o.status] || '')}</div></div>
              <div class="act-side"><strong>${money(o.price)}</strong><div class="muted small">${ago(o.t)}</div></div></li>`;
          }).join('')}</ul>` : '<p class="muted">No prices yet.</p>'}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Where prices come from</h2><a class="small" href="#/settings">Details →</a></div>
          ${sourcesSummary(list)}
          <h3 class="sub">Laptops by store</h3>
          <div class="bars-list">${ms.byStore.map(x => `<div class="bl-row"><span>${esc(x.r.name)}</span><span class="bar"><span style="width:${x.n / ms.byStore[0].n * 100}%"></span></span><span class="num">${x.n}</span></div>`).join('') || '<p class="muted small">—</p>'}</div>
        </section>
      </div>` : emptyState('No laptops yet', 'Install the browser extension (see the guide), then open RTX 50-series laptop pages on Amazon, Best Buy or other stores. They show up here within a few minutes.')}`;
    lineChart($('#index-chart'), idx, { fmt: v => pctTxt(v), zero: true });
  }
  function sourcesSummary(list) {
    const count = s => list.reduce((n, l) => n + l.history.filter(o => o.status === s).length, 0);
    const f = feedState();
    const rows = [
      ['seen', 'Browser extension', state.extMeta && state.extMeta.generated ? `Last sync ${ago(state.extMeta.generated)}` : 'Not connected yet'],
      ['auto', 'Automatic checks (GitHub)', f.title],
      ['archive', 'Web archive (past prices)', 'Looked up once per laptop'],
      ['verified', 'Logged by you', 'Prices you entered with +']
    ];
    return `<ul class="sources">${rows.map(([k, name, sub]) => `<li><i class="dot dot-${k === 'verified' ? 'verified' : k}"></i><div><strong>${esc(name)}</strong><div class="muted small">${esc(sub)}</div></div><span class="num">${count(k) + (k === 'verified' ? count('unverified') : 0)}</span></li>`).join('')}</ul>`;
  }

  /* ---------- Laptops (browse) ---------- */
  const DEFAULT_F = { q: '', gpu: 'all', budget: 0, use: '', ram32: false, store: 'all', sort: 'score' };
  ui.f = { ...DEFAULT_F };
  function parseQuery() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const f = { ...DEFAULT_F, q: ui.f.q };
    if (q.get('gpu') && GPUS[q.get('gpu')]) f.gpu = q.get('gpu');
    if (q.get('budget')) f.budget = +q.get('budget') || 0;
    if (q.get('use')) f.use = q.get('use');
    if (q.get('sort')) f.sort = q.get('sort');
    if (q.get('store')) f.store = q.get('store');
    if (q.get('ram32')) f.ram32 = true;
    return f;
  }
  function renderLaptops() {
    const f = ui.f;
    const chip = (key, val, label) => `<button class="chip ${String(f[key]) === String(val) ? 'on' : ''}" data-action="f" data-k="${key}" data-v="${esc(val)}">${label}</button>`;
    const stores = RETAILERS.filter(r => visible().some(l => l.retailer === r.id));
    view().innerHTML = pageHead('Laptops', 'Every RTX 50-series laptop you track. Filter by GPU, budget and what you\'ll use it for.', `<button class="btn btn-sm" data-action="add-laptop">${I('plus')}Add manually</button>`) + `
      <div class="filterbar">
        <label class="search"><span class="sr-only">Search</span>${I('search')}<input type="search" id="f-q" value="${esc(f.q)}" placeholder="Search model, brand or CPU"></label>
        <div class="chips"><span class="chips-label">GPU</span>${chip('gpu', 'all', 'All')}${GPU_ORDER.map(k => chip('gpu', k, GPUS[k].label.replace('RTX ', ''))).join('')}</div>
        <div class="chips"><span class="chips-label">Budget</span>${chip('budget', 0, 'Any')}${chip('budget', 1000, 'Under $1,000')}${chip('budget', 1500, 'Under $1,500')}${chip('budget', 2000, 'Under $2,000')}${chip('budget', 3000, 'Under $3,000')}</div>
        <div class="chips"><span class="chips-label">Best for</span>${chip('use', '', 'Anything')}${chip('use', 'gaming', 'AAA gaming')}${chip('use', 'labs', 'AI & SOC labs')}${chip('use', 'everyday', 'Everyday')}
          <span class="chips-sep"></span><button class="chip ${f.ram32 ? 'on' : ''}" data-action="f" data-k="ram32" data-v="${!f.ram32}">32GB+ RAM</button></div>
        <div class="filter-row">
          <label class="sel"><span>Store</span><select id="f-store"><option value="all">All stores</option>${stores.map(r => `<option value="${r.id}" ${f.store === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
          <label class="sel"><span>Sort</span><select id="f-sort">${[['score', 'Best score'], ['drop', 'Biggest drop from high'], ['value', 'Best value for money'], ['price-asc', 'Lowest price'], ['price-desc', 'Highest price'], ['checked', 'Recently updated']].map(([v, t]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <button class="btn btn-ghost btn-sm" data-action="f-reset">Reset</button>
        </div>
      </div>
      <p class="result-meta" id="result-meta"></p>
      <div id="results"></div>`;
    const run = () => {
      const pk = f.use || state.settings.profile;
      const list = applyFilters(visible(), { q: f.q, gpu: f.gpu, brand: 'all', retailer: f.store, ram: f.ram32 ? 32 : 0, min: '', max: '', status: 'all', sort: f.sort }, pk, f.budget || null);
      const prices = list.map(curPrice).filter(p => p != null);
      $('#result-meta').innerHTML = list.length ? `<strong>${list.length}</strong> laptop${list.length === 1 ? '' : 's'}${prices.length ? ` · from <strong>${money(Math.min(...prices))}</strong> · median ${money(median(prices))}` : ''}${f.use ? ` · scored for ${esc(f.use === 'labs' ? 'AI & SOC labs' : PROFILES[f.use].label.toLowerCase())}` : ''}` : '';
      $('#results').innerHTML = list.length ? `<div class="cards">${list.map(l => lcard(l, pk)).join('')}</div>` : (visible().length ? emptyState('No laptops match', 'Try fewer filters.', '<button class="btn" data-action="f-reset">Reset filters</button>') : emptyState('No laptops yet', 'Install the browser extension and open RTX 50-series laptop pages, or add one manually.'));
    };
    ui.rerunResults = run;
    $('#f-q').addEventListener('input', debounce(() => { f.q = $('#f-q').value; run(); }, 120));
    $('#f-store').addEventListener('change', e => { f.store = e.target.value; run(); });
    $('#f-sort').addEventListener('change', e => { f.sort = e.target.value; run(); });
    run();
  }

  /* ---------- Laptop page ---------- */
  function renderLaptop(id) {
    const l = getL(id);
    if (!l) { view().innerHTML = emptyState('Laptop not found', 'It may have been removed.', '<a class="btn" href="#/laptops">Back to laptops</a>'); return; }
    const st = priceStats(l), v = priceVerdict(l), link = retailerLink(l);
    const inCmp = state.compare.includes(l.id);
    const pk = state.settings.profile;
    const w20 = priceAt(l, new Date(Date.now() - 20 * DAY));
    const avg = l.history.length ? l.history.reduce((a, o) => a + o.price, 0) / l.history.length : null;
    view().innerHTML = `
      <nav class="crumbs"><a href="#/laptops">Laptops</a> <span>/</span> ${GPUS[l.gpu].label}</nav>
      <section class="lp-head">
        <div class="lp-title">
          <div class="lc-top"><span class="gpu-chip g${l.gpu}">${GPUS[l.gpu].label}</span><span class="lc-store">${esc(storeName(l))}</span>${statusBadge(l)}</div>
          <h1>${esc(l.name)}</h1>
          <p class="lead">${esc(specLine(l))}</p>
        </div>
        <div class="lp-price">
          <div class="big-price ${l.demo ? 'demo-price' : ''}">${st ? money(st.cur) : '—'}</div>
          ${st && st.dPrev ? `<div>${deltaChip(st.dPrev, st.dPrevPct)} <span class="muted small">vs previous</span></div>` : ''}
          ${l.listPrice && st && l.listPrice > st.cur ? `<div class="muted small">List ${money(l.listPrice)} · save ${money(l.listPrice - st.cur)}</div>` : ''}
          <div class="muted small">${st ? `Updated ${ago(st.lastT)} · ${esc(SOURCE_LABEL[latest(l).status] || '')}` : ''}</div>
        </div>
      </section>
      <div class="lp-actions">
        ${link ? `<a class="btn btn-primary" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">${link.exact ? 'Open at ' + esc(storeName(l)) : 'Search ' + esc(storeName(l))}${I('external')}</a>` : ''}
        <button class="btn ${l.watch ? 'on' : ''}" data-action="watch" data-id="${esc(l.id)}">${I('star')}${l.watch ? 'Watching' : 'Watch'}</button>
        <button class="btn ${inCmp ? 'on' : ''}" data-action="compare-toggle" data-id="${esc(l.id)}">${I('columns')}${inCmp ? 'In compare' : 'Compare'}</button>
        <button class="btn btn-ghost" data-action="log-price" data-id="${esc(l.id)}">${I('plus')}Log a price</button>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(l.id)}">${I('edit')}Edit</button>
        <button class="btn btn-ghost btn-sm danger" data-action="delete" data-id="${esc(l.id)}">${I('trash')}</button>
      </div>

      <section class="verdict-box v-${v.tone}">
        <div class="vb-title">${esc(v.title)}</div><p>${esc(v.body)}</p>
        <label class="target">Alert me at <span class="dollar">$</span><input type="number" min="0" step="10" inputmode="numeric" id="target" value="${l.target ?? ''}" placeholder="target price"></label>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Price history</h2><span class="legend small"><span><i class="dot dot-seen"></i>Browser</span><span><i class="dot dot-auto"></i>Automatic</span><span><i class="dot dot-archive"></i>Archive</span><span><i class="dot dot-verified"></i>You</span></span></div>
        <div class="chart" id="lp-chart"></div>
        ${historyLinks(l)}
        ${st ? `<div class="stats stats-sm">
          ${kpi('Lowest', money(st.lo), st.count > 1 ? fmtDay(l.history.find(o => o.price === st.lo).t) : '', 'good')}
          ${kpi('Highest', money(st.hi), st.count > 1 ? fmtDay(l.history.find(o => o.price === st.hi).t) : '')}
          ${kpi('Average', money(avg), `${st.count} price${st.count === 1 ? '' : 's'} recorded`)}
          ${kpi('vs 20 days ago', w20 ? pctTxt((st.cur - w20.price) / w20.price * 100) : '—', w20 ? `was ${money(w20.price)}` : 'No price that far back', w20 && st.cur < w20.price ? 'good' : w20 && st.cur > w20.price ? 'bad' : '')}
        </div>` : ''}
      </section>

      <div class="grid-2">
        <section class="panel">
          <h2>Specifications</h2>
          ${l.specsFrom ? `<p class="muted small">${esc(l.specsFrom)}</p>` : ''}
          <dl class="spec-table">
            <div><dt>GPU</dt><dd>${GPUS[l.gpu].label}, ${l.vram}GB VRAM${l.tgp ? `, ${l.tgp}W` : ''}</dd></div>
            <div><dt>CPU</dt><dd>${esc(l.cpu || CPU_MAP[l.cpuClass].label)}</dd></div>
            <div><dt>Memory</dt><dd>${l.ram}GB · ${l.ramUpgradeable ? 'upgradeable to ' + l.ramMax + 'GB' : l.ramUpgradeKnown === false ? 'upgradeability unknown' : 'soldered'}</dd></div>
            <div><dt>Storage</dt><dd>${fmtStorage(l.storage)} · ${l.storageSlots} M.2 slot${l.storageSlots > 1 ? 's' : ''}</dd></div>
            <div><dt>Display</dt><dd>${l.displaySize}" ${RES[l.displayRes].label} ${esc(l.panel)}, ${l.hz}Hz</dd></div>
            <div><dt>Cooling</dt><dd>${l.cooling}/5${l.coolingNote ? ' · ' + esc(l.coolingNote) : ''}</dd></div>
            <div><dt>Weight</dt><dd>${l.weight ? l.weight + ' kg' : '—'}</dd></div>
            <div><dt>Store</dt><dd>${esc(storeName(l))}${l.url ? ` · <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">product page</a>` : ''}</dd></div>
          </dl>
          <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(l.id)}">${I('edit')}Correct specs</button>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>How well it fits</h2><button class="linkbtn small" data-action="how-scores">How scores work</button></div>
          <div class="fit-list">${PROFILE_KEYS.map(k => { const s = scoreFor(l, k); return `<details class="fit"><summary><span>${esc(PROFILES[k].label)}</span><span class="bar"><span class="sc-${grade(s.total)}" style="width:${s.total}%"></span></span><strong>${s.total}</strong></summary>${breakdownBars(s)}${s.notes.length ? `<ul class="score-notes">${s.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</details>`; }).join('')}</div>
          <p class="muted small">Estimates from the specs, out of 100. Tap a row to see why.</p>
        </section>
      </div>

      <details class="panel collapsible"><summary><h2>All recorded prices (${l.history.length})</h2></summary>${obsTable(l)}</details>`;
    drawChart($('#lp-chart'), l.history, { h: 260 });
    $('#target').addEventListener('change', e => { const t = num(e.target.value); l.target = t > 0 ? t : null; touch(l); save(); toast(l.target ? `You'll be alerted at ${money(l.target)}` : 'Target removed'); });
    document.title = `${l.name} · RTX Deal Hunter`;
  }

  /* ---------- Watchlist ---------- */
  function renderWatchlist() {
    const ls = visible().filter(l => l.watch);
    view().innerHTML = pageHead('Watchlist', 'Laptops you\'re following. Set a target price on each one; it turns green when a recorded price reaches it.') +
      (ls.length ? `<div class="wl">${ls.sort((a, b) => (curPrice(a) ?? 1e9) - (curPrice(b) ?? 1e9)).map(l => {
        const st = priceStats(l), v = priceVerdict(l), link = retailerLink(l);
        const hit = l.target && st && st.cur <= l.target;
        return `<article class="wl-row ${hit ? 'hit' : ''}">
          <div class="wl-main"><a href="#/laptop/${encodeURIComponent(l.id)}" class="wl-name">${esc(l.name)}</a><div class="muted small">${GPUS[l.gpu].label} · ${esc(storeName(l))} · ${st ? 'updated ' + ago(st.lastT) : 'no price yet'}</div>
            <div class="wl-verdict v-${v.tone}">${esc(v.title)}</div></div>
          ${sparkline(l.history)}
          <div class="wl-price"><strong>${st ? money(st.cur) : '—'}</strong>${st && st.dPrev ? deltaChip(st.dPrev, st.dPrevPct) : ''}</div>
          <label class="wl-target"><span class="muted small">Target</span><input type="number" min="0" step="10" inputmode="numeric" data-target-id="${esc(l.id)}" value="${l.target ?? ''}" placeholder="$"><span class="small ${hit ? 'ok' : 'muted'}">${l.target && st ? (hit ? 'Reached' : money(st.cur - l.target) + ' to go') : ''}</span></label>
          <div class="wl-actions">${link ? `<a class="btn btn-sm" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">Check price${I('external')}</a>` : ''}<button class="star on" data-action="watch" data-id="${esc(l.id)}" title="Remove">${I('star')}</button></div>
        </article>`;
      }).join('')}</div>
      <p class="muted small mt">Tip: open these store pages once a day during Black Friday week. With the extension installed, each visit records the latest price.</p>`
        : emptyState('Nothing on your watchlist', 'Tap the star on any laptop to follow it here.', '<a class="btn btn-primary" href="#/laptops">Browse laptops</a>'));
    $$('[data-target-id]').forEach(inp => inp.addEventListener('change', () => {
      const l = getL(inp.dataset.targetId); const v = num(inp.value); l.target = v > 0 ? v : null; touch(l); save(); renderWatchlist();
    }));
  }

  /* ---------- Guide ---------- */
  function renderGuide() {
    view().innerHTML = pageHead('How it works', 'Everything you need to know, in five minutes.', '<button class="btn btn-sm" data-action="tour">Replay the tour</button>') + `
      <section class="guide-steps">
        <div class="gstep"><span>1</span><h3>Install the extension</h3><p>Load the <code>extension</code> folder in Chrome or Edge (chrome://extensions → Developer mode → Load unpacked) and connect it to GitHub in its Settings. Full steps are in the README.</p></div>
        <div class="gstep"><span>2</span><h3>Browse like normal</h3><p>Open RTX 50-series laptop pages on Amazon, Best Buy, B&amp;H, Newegg, Walmart, Dell, HP, Lenovo and more. Each visit saves the price, and a small badge shows how it changed.</p></div>
        <div class="gstep"><span>3</span><h3>Let the site do the math</h3><p>Prices appear here a few minutes later, with history charts, a verdict on each price, scores and the Black Friday report.</p></div>
      </section>

      <section class="panel">
        <h2>Where prices come from</h2>
        <div class="table-wrap flat"><table>
          <thead><tr><th>Label</th><th>Source</th><th>How often</th></tr></thead>
          <tbody>
            <tr><td><span class="badge badge-seen">Seen in browser</span></td><td>The extension reads the price on a store page you opened.</td><td>Every visit</td></tr>
            <tr><td><span class="badge badge-auto">Auto-checked</span></td><td>A scheduled GitHub job checks stores that allow it (and Best Buy, if you have an API key).</td><td>Every 3 hours</td></tr>
            <tr><td><span class="badge badge-archive">Archived price</span></td><td>Older prices read from saved copies of store pages on web.archive.org.</td><td>Once per laptop</td></tr>
            <tr><td><span class="badge badge-ok">Verified</span> / <span class="badge badge-warn">Unverified</span></td><td>Prices you typed in with "Log a price".</td><td>When you add them</td></tr>
          </tbody></table></div>
      </section>

      <section class="panel">
        <h2>Reading the numbers</h2>
        <dl class="defs">
          <div><dt>Price verdict</dt><dd><b>Lowest price recorded</b> or <b>Good price</b> (within 3% of the lowest) means buy with confidence. <b>Fair price</b> is within 10%. <b>Wait if you can</b> means it has been noticeably cheaper before.</dd></div>
          <div><dt>Score out of 100</dt><dd>How well the specs fit a use: AAA gaming, SOC labs, local AI, VMs, multitasking or everyday work. GPU tier, VRAM, RAM, cooling and upgradeability carry the most weight. <button class="linkbtn" data-action="how-scores">See the formula</button></dd></div>
          <div><dt>Price trend</dt><dd>On the Overview: the average change of every laptop's price compared with the first price recorded for it. Negative means prices are falling.</dd></div>
          <div><dt>Black Friday verdicts</dt><dd>Compare each laptop's sale price with its price 20 days before Black Friday. "Raised, then discounted" flags stores that raised a price before cutting it.</dd></div>
        </dl>
      </section>

      <section class="panel">
        <h2>Questions</h2>
        <div class="faq">
          <details><summary>Why can't Amazon and Best Buy be checked automatically?</summary><p>Both stores block automated checks from servers, and their official data feeds need a business email (Best Buy) or an affiliate account with regular sales (Amazon). The extension records the prices you see while browsing instead, which needs no special access.</p></details>
          <details><summary>Where is my data stored?</summary><p>On this site, in your browser. The extension and the automatic checks also save prices to <code>manual.json</code> and <code>feed.json</code> in your GitHub repository, so every device shows the same history. Nothing goes to any other server.</p></details>
          <details><summary>Why does a laptop say "Not enough history"?</summary><p>A verdict needs at least two recorded prices. Open the laptop's store page again on another day, and the history fills in.</p></details>
          <details><summary>The specs on a laptop look wrong.</summary><p>Specs added automatically come from the product title, so details like TGP, cooling and RAM upgradeability can be missing. Open the laptop and click "Correct specs"; scores update right away.</p></details>
          <details><summary>How do I see older Amazon prices?</summary><p>Amazon laptops have camelcamelcamel and Keepa links on their page, both of which keep long price histories.</p></details>
        </div>
      </section>`;
  }

  /* ---------- Settings ---------- */
  function renderSettings() {
    const s = state.settings;
    const sampleCount = state.laptops.filter(l => l.demo).length;
    const f = feedState();
    view().innerHTML = pageHead('Settings', '') + `
      <div class="settings">
        <section class="panel">
          <h2>Price sources</h2>
          ${sourcesSummary(visible())}
          <p class="auto-status auto-${f.tone}"><strong>${esc(f.title)}.</strong> ${esc(f.body)}</p>
          ${state.feedMeta && state.feedMeta.sources && state.feedMeta.sources.length ? `<details class="small"><summary>Automatic check details</summary><ul class="source-list">${state.feedMeta.sources.map(x => `<li><span class="src-dot src-${esc(x.status)}"></span><span>${esc(x.name)}</span><span class="muted">${esc(x.detail || x.status)}</span></li>`).join('')}</ul></details>` : ''}
          <div class="row-actions mt"><button class="btn btn-sm btn-primary" data-action="refresh">${I('refresh')}Reload prices now</button><button class="btn btn-sm" data-action="export-tracked">${I('download')}Download tracked.json</button></div>
          <details class="small mt"><summary>Advanced: feed address</summary>
            <form class="inline-form" id="feed-form"><input type="text" id="feed-url" value="${esc(s.feedUrl)}" placeholder="feed.json" spellcheck="false"><button class="btn btn-sm" type="submit">Save</button></form>
            <label class="switch"><input type="checkbox" id="auto-feed" ${s.autoFeed ? 'checked' : ''}><span>Load automatic prices when the site opens</span></label>
          </details>
        </section>

        <section class="panel">
          <h2>Your data</h2>
          <p class="muted small">Watchlist, targets, edits and prices you log are kept in this browser. Export a backup before clearing browser data or switching devices.</p>
          <div class="row-actions"><button class="btn btn-sm" data-action="export-json">${I('download')}Backup (JSON)</button><button class="btn btn-sm" data-action="export-csv">${I('download')}Prices (CSV)</button><button class="btn btn-sm" data-action="import-file">${I('upload')}Import…</button></div>
          <div class="seg seg-sm mt">${[['merge', 'Import adds to my data'], ['replace', 'Import replaces my data']].map(([m, t]) => `<button class="seg-btn ${s.importMode === m ? 'on' : ''}" data-action="import-mode" data-mode="${m}">${t}</button>`).join('')}</div>
          <h3 class="sub">Sample data</h3>
          <p class="muted small">${sampleCount ? `${sampleCount} sample laptops with made-up prices are loaded${s.showDemo ? ' and visible' : ' but hidden'}.` : 'Load sample laptops with made-up prices to explore the site.'}</p>
          <div class="row-actions">${sampleCount ? `<label class="switch"><input type="checkbox" id="show-demo" ${s.showDemo ? 'checked' : ''}><span>Show sample data</span></label><button class="btn btn-sm btn-ghost danger" data-action="clear-demo">Remove samples</button>` : '<button class="btn btn-sm" data-action="load-demo">Load sample data</button>'}</div>
          <h3 class="sub">Start over</h3>
          <button class="btn btn-sm btn-ghost danger" data-action="reset-all">${I('trash')}Erase everything in this browser</button>
        </section>

        <section class="panel">
          <h2>Preferences</h2>
          <h3 class="sub">Theme</h3>
          <div class="seg">${['dark', 'light'].map(t => `<button class="seg-btn ${s.theme === t ? 'on' : ''}" data-action="set-theme" data-theme="${t}">${I(t === 'dark' ? 'moon' : 'sun')}${t === 'dark' ? 'Dark' : 'Light'}</button>`).join('')}</div>
          <h3 class="sub">Score laptops for</h3>
          <div class="radio-list">${PROFILE_KEYS.map(k => `<label class="radio"><input type="radio" name="profile" value="${k}" ${s.profile === k ? 'checked' : ''}><span>${esc(PROFILES[k].label)}</span></label>`).join('')}</div>
          <button class="linkbtn small" data-action="how-scores">How scores work</button>
        </section>

        <section class="panel">
          <h2>Stores</h2>
          <ul class="store-list">${RETAILERS.filter(r => r.id !== 'other').map(r => `<li><div><strong>${esc(r.name)}</strong><div class="muted small">${esc(r.note)}</div></div><a class="btn btn-sm btn-ghost" href="${esc(r.search('RTX 50 gaming laptop'))}" target="_blank" rel="noopener noreferrer">Shop${I('external')}</a></li>`).join('')}</ul>
        </section>
      </div>`;
    const sd = $('#show-demo'); if (sd) sd.addEventListener('change', e => { s.showDemo = e.target.checked; save(); renderSettings(); });
    $('#auto-feed').addEventListener('change', e => { s.autoFeed = e.target.checked; save(); if (s.autoFeed) refreshFeed(true); });
    $$('input[name=profile]').forEach(r => r.addEventListener('change', () => { s.profile = r.value; save(); toast('Scores now shown for ' + PROFILES[r.value].label.toLowerCase()); }));
    $('#feed-form').addEventListener('submit', e => { e.preventDefault(); s.feedUrl = $('#feed-url').value.trim() || 'feed.json'; save(); toast('Saved'); });
  }

  /* ---------- Welcome tour ---------- */
  const TOUR = [
    { icon: 'chart', title: 'Welcome to RTX Deal Hunter', body: 'It keeps a price history for every RTX 50-series laptop you\'re considering, so you can tell a real deal from a fake one, especially around Black Friday.' },
    { icon: 'external', title: 'Prices come from your browsing', body: 'The browser extension records the price whenever you open a laptop on Amazon, Best Buy, B&H and other stores. Automatic checks and web archives fill in the rest.' },
    { icon: 'check', title: 'Every laptop gets a verdict', body: 'Open a laptop to see its price chart and a plain answer: "Lowest price recorded", "Good price", "Fair price" or "Wait if you can". Set a target to get an alert.' },
    { icon: 'bolt', title: 'Then check the Black Friday report', body: 'It compares sale prices with prices 20 days earlier and flags stores that raised prices before "discounting" them.' }
  ];
  function openTour(i = 0) {
    const t = TOUR[i];
    openModal(`<div class="tour">
      <div class="tour-ico">${I(t.icon)}</div>
      <h2>${esc(t.title)}</h2><p>${esc(t.body)}</p>
      <div class="tour-dots">${TOUR.map((_, j) => `<span class="${j === i ? 'on' : ''}"></span>`).join('')}</div>
      <div class="modal-actions">${i ? `<button class="btn btn-ghost" id="tour-back">Back</button>` : `<button class="btn btn-ghost" id="tour-skip">Skip</button>`}<button class="btn btn-primary" id="tour-next">${i === TOUR.length - 1 ? 'Get started' : 'Next'}</button></div>
    </div>`, { label: 'Welcome tour' });
    const done = () => { state.settings.tourDone = true; save(); closeModal(); };
    $('#tour-next').onclick = () => i === TOUR.length - 1 ? (done(), location.hash = state.laptops.length ? '#/overview' : '#/guide') : openTour(i + 1);
    const b = $('#tour-back'); if (b) b.onclick = () => openTour(i - 1);
    const sk = $('#tour-skip'); if (sk) sk.onclick = done;
  }

  /* =========================================================
   * 11. Chrome, routing, actions
   * ======================================================= */
  function touch(l) { l._v = (l._v || 0) + 1; }
  function toggleCompare(id, force) {
    const i = state.compare.indexOf(id);
    if (i >= 0 && force !== true) { state.compare.splice(i, 1); toast('Removed from compare'); }
    else if (i < 0) {
      if (state.compare.length >= 4) { toast('Compare holds up to 4 laptops. Remove one first.', 'error'); return; }
      state.compare.push(id); toast(state.compare.length > 1 ? 'Added to compare' : 'Added. Pick one more laptop to compare.');
    }
    save(); rerender();
  }
  function toast(msg, tone = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + (tone ? 'toast-' + tone : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, tone === 'error' ? 6000 : 3000);
  }
  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme;
    $('meta[name=theme-color]').setAttribute('content', state.settings.theme === 'light' ? '#ffffff' : '#0a0b0d');
    $('#theme-btn').innerHTML = I(state.settings.theme === 'light' ? 'moon' : 'sun');
  }
  function renderNav() {
    const counts = { watchlist: visible().filter(l => l.watch).length, compare: state.compare.length };
    const item = n => `<a href="#/${n.id}" class="${currentView === n.id ? 'active' : ''}" ${currentView === n.id ? 'aria-current="page"' : ''}>${I(n.icon)}<span>${esc(n.label)}</span>${counts[n.id] ? `<em>${counts[n.id]}</em>` : ''}</a>`;
    $('#nav').innerHTML = NAV.map(item).join('');
    $('#tabbar').innerHTML = NAV.map(item).join('');
  }
  function renderTray() {
    const tray = $('#compare-tray');
    const ls = state.compare.map(getL).filter(Boolean);
    state.compare = ls.map(l => l.id);
    if (!ls.length || currentView === 'compare') { tray.hidden = true; return; }
    tray.hidden = false;
    tray.innerHTML = `<div class="tray-items">${ls.map(l => `<span class="tray-item">${esc(l.name.length > 24 ? l.name.slice(0, 23) + '…' : l.name)}<button data-action="compare-toggle" data-id="${esc(l.id)}" aria-label="Remove">${I('x')}</button></span>`).join('')}</div><a class="btn btn-primary btn-sm" href="#/compare">Compare ${ls.length}</a>`;
  }
  function updateChrome() {
    const pill = $('#status-pill'), m = state.feedMeta;
    const lastT = visible().map(lastCheck).filter(Boolean).sort().pop();
    pill.innerHTML = `<i class="live ${lastT && Date.now() - new Date(lastT) < 6 * 3600e3 ? 'on' : ''}"></i>${lastT ? 'Updated ' + ago(lastT) : 'No prices yet'}`;
    pill.title = (m && m.generated ? 'Automatic check: ' + fmtDate(m.generated) + '\n' : '') + (state.extMeta && state.extMeta.generated ? 'Extension sync: ' + fmtDate(state.extMeta.generated) + '\n' : '') + 'Click to reload prices';
    renderNav(); renderTray();
  }
  function rerender() {
    if (currentView === 'laptops' && ui.rerunResults && $('#results')) ui.rerunResults();
    else { const y = window.scrollY; renderView(); window.scrollTo(0, y); }
    updateChrome();
  }
  function renderView() {
    ui.rerunResults = null; ui.charts = [];
    ({ overview: renderOverview, laptops: renderLaptops, laptop: () => renderLaptop(routeParam), compare: renderCompare, 'black-friday': renderBfReport, watchlist: renderWatchlist, settings: renderSettings, guide: renderGuide }[currentView] || renderOverview)();
  }
  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    let [key, param] = raw.split('?')[0].split('/');
    key = ALIASES[key] || key || 'overview';
    const legacy = raw.split('?')[0];
    const changed = currentView !== key || routeParam !== decodeURIComponent(param || '');
    currentView = ['overview', 'laptops', 'laptop', 'compare', 'black-friday', 'watchlist', 'settings', 'guide'].includes(key) ? key : 'overview';
    routeParam = decodeURIComponent(param || '');
    if (currentView === 'laptops') {
      ui.f = parseQuery();
      const legacyMap = { under1000: { budget: 1000 }, under1500: { budget: 1500 }, under2000: { budget: 2000 }, gaming: { use: 'gaming' }, labs: { use: 'labs' }, deals: { sort: 'drop' } };
      Object.assign(ui.f, legacyMap[legacy] || {});
    }
    closeModal();
    renderView();
    updateChrome();
    const nav = NAV.find(n => n.id === currentView);
    if (currentView !== 'laptop') document.title = `${nav ? nav.label : currentView === 'guide' ? 'How it works' : currentView === 'settings' ? 'Settings' : 'Overview'} · RTX Deal Hunter`;
    if (changed) { window.scrollTo(0, 0); view().focus({ preventScroll: true }); }
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const id = a.dataset.id;
    switch (a.dataset.action) {
      case 'detail': location.hash = '#/laptop/' + encodeURIComponent(id); break;
      case 'watch': { e.preventDefault(); const l = getL(id); l.watch = !l.watch; touch(l); save(); toast(l.watch ? 'Added to watchlist' : 'Removed from watchlist'); rerender(); break; }
      case 'compare-toggle': e.preventDefault(); toggleCompare(id); break;
      case 'compare-clear': state.compare = []; save(); rerender(); break;
      case 'log-price': openLogPrice(id); break;
      case 'check': setTimeout(() => openLogPrice(id), 50); break;
      case 'edit': openLaptopForm(id); break;
      case 'add-laptop': openLaptopForm(null); break;
      case 'delete': {
        const l = getL(id);
        confirmModal('Delete this laptop?', `"${l.name}" and its ${l.history.length} recorded prices will be removed from this browser.`, 'Delete', () => {
          state.laptops = state.laptops.filter(x => x.id !== id);
          state.compare = state.compare.filter(x => x !== id);
          save(); toast('Laptop deleted'); location.hash = '#/laptops';
        });
        break;
      }
      case 'del-obs': {
        const l = getL(id), i = Number(a.dataset.i), o = l.history[i];
        confirmModal('Delete this price?', `${money(o.price)} recorded ${fmtDate(o.t)}.`, 'Delete', () => { l.history.splice(i, 1); touch(l); save(); rerender(); toast('Price deleted'); });
        break;
      }
      case 'close-modal': if (a.tagName !== 'A') e.preventDefault(); closeModal(); break;
      case 'refresh': refreshFeed(false); break;
      case 'theme': state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); if (currentView === 'settings') renderSettings(); break;
      case 'set-theme': state.settings.theme = a.dataset.theme; save(); applyTheme(); renderSettings(); break;
      case 'f': {
        const k = a.dataset.k; let v = a.dataset.v;
        ui.f[k] = k === 'budget' ? +v : k === 'ram32' ? v === 'true' : v;
        const q = new URLSearchParams();
        for (const [kk, vv] of Object.entries(ui.f)) if (kk !== 'q' && vv && vv !== 'all' && !(kk === 'sort' && vv === 'score')) q.set(kk, vv);
        history.replaceState(null, '', '#/laptops' + (q.toString() ? '?' + q : ''));
        const y = scrollY; renderLaptops(); scrollTo(0, y); break;
      }
      case 'f-reset': ui.f = { ...DEFAULT_F }; history.replaceState(null, '', '#/laptops'); renderLaptops(); break;
      case 'hide-checklist': state.settings.hideChecklist = true; save(); renderOverview(); break;
      case 'tour': openTour(0); break;
      case 'how-scores': openHowScores(); break;
      case 'export-json': exportJSON(); break;
      case 'export-csv': exportCSV(); break;
      case 'export-tracked': exportTracked(); break;
      case 'import-file': $('#import-input').click(); break;
      case 'import-mode': state.settings.importMode = a.dataset.mode; save(); renderSettings(); break;
      case 'clear-demo': confirmModal('Remove sample data?', 'All sample laptops and their made-up prices will be deleted. Your own laptops stay.', 'Remove', () => {
        const ids = new Set(state.laptops.filter(l => l.demo).map(l => l.id));
        state.laptops = state.laptops.filter(l => !l.demo); state.compare = state.compare.filter(x => !ids.has(x));
        save(); rerender(); toast('Sample data removed');
      }); break;
      case 'load-demo': mergeAll(buildDemo()); state.settings.showDemo = true; save(); rerender(); toast('Sample data loaded. Prices are made up.'); break;
      case 'reset-all': confirmModal('Erase everything?', 'This deletes every laptop, price and setting stored in this browser. Prices saved in your GitHub repository load again on the next refresh.', 'Erase all', () => {
        try { localStorage.removeItem(STORE_KEY); } catch { }
        state = { laptops: [], settings: { ...DEFAULT_SETTINGS, tourDone: true }, compare: [], seededAt: new Date().toISOString() };
        save(); applyTheme(); rerender(); toast('All data erased');
      }); break;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal-root').hidden) closeModal();
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $('#modal-root').hidden) { e.preventDefault(); $('#global-search').focus(); }
    if (e.key === 'Tab' && !$('#modal-root').hidden) {
      const f = $$('#modal-root .modal a[href], #modal-root .modal button:not([disabled]), #modal-root .modal input:not([disabled]), #modal-root .modal select, #modal-root .modal textarea').filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $('#import-input').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
  const gs = $('#global-search');
  gs.addEventListener('keydown', e => {
    if (e.key === 'Enter') { ui.f = { ...DEFAULT_F, q: gs.value }; if (currentView === 'laptops') renderLaptops(); else location.hash = '#/laptops'; gs.blur(); }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', debounce(() => ui.charts.filter(c => document.body.contains(c.el)).forEach(c => c.redraw ? c.redraw() : drawChart(c.el, c.obs, c.opts)), 200));
  window.addEventListener('storage', e => { if (e.key === STORE_KEY) { load(); applyTheme(); rerender(); } });
  setInterval(() => { if ($('#modal-root').hidden && !document.hidden) updateChrome(); }, 60e3);

  /* ---------- boot ---------- */
  load();
  applyTheme();
  route();
  if (!state.settings.tourDone) setTimeout(() => openTour(0), 400);
  if (state.settings.autoFeed) refreshFeed(true);
  setInterval(() => { if (state.settings.autoFeed && !document.hidden) refreshFeed(true); }, 15 * 60e3);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.settings.autoFeed && (!state.settings.lastFeedAt || Date.now() - new Date(state.settings.lastFeedAt) > 10 * 60e3)) refreshFeed(true);
  });
})();
