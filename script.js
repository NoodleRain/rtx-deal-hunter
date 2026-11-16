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
    { id: 'amazon', name: 'Amazon', home: 'https://www.amazon.com/', search: q => `https://www.amazon.com/s?k=${enc(q)}`, note: 'Confirm "Ships from" and "Sold by". Third-party sellers can differ from Amazon pricing.' },
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
    state = { laptops: buildDemo(), settings: { ...DEFAULT_SETTINGS }, compare: [], seededAt: new Date().toISOString() };
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
    let status = ['verified', 'unverified', 'demo', 'auto'].includes(o.status) ? o.status : (toBool(o.verified) ? 'verified' : 'unverified');
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

  function card(l, pk) {
    const st = priceStats(l), s = scoreFor(l, pk), g = GPUS[l.gpu], r = RETAILER_MAP[l.retailer];
    const inCmp = state.compare.includes(l.id);
    const link = retailerLink(l);
    const hit = l.target && st && st.cur <= l.target;
    return `<article class="card ${l.demo ? 'card-demo' : ''}" data-id="${esc(l.id)}">
      <header class="card-head"><span class="brand">${esc(l.brand)}</span><div class="badges">${hit ? '<span class="badge badge-ok">Target hit</span>' : ''}${statusBadge(l)}</div></header>
      <h3 class="card-title"><button class="linklike" data-action="detail" data-id="${esc(l.id)}">${esc(l.name)}</button></h3>
      <div class="gpu-line"><span class="gpu-chip g${l.gpu}">${g.label}</span><span class="muted">${l.vram}GB VRAM${l.tgp ? ' · ' + l.tgp + 'W' : ''}</span></div>
      <dl class="spec-list">
        <div><dt>CPU</dt><dd>${esc(l.cpu || CPU_MAP[l.cpuClass].label)}</dd></div>
        <div><dt>RAM</dt><dd>${l.ram}GB ${l.ramUpgradeable ? `<span class="ok">→ ${l.ramMax}GB</span>` : l.ramUpgradeKnown === false ? '<span class="muted">upgrade unknown</span>' : '<span class="muted">soldered</span>'}</dd></div>
        <div><dt>SSD</dt><dd>${fmtStorage(l.storage)}${l.storageSlots > 1 ? ` <span class="muted">· ${l.storageSlots} slots</span>` : ''}</dd></div>
        <div><dt>Display</dt><dd>${l.displaySize}" ${RES[l.displayRes].label} ${esc(l.panel)} ${l.hz}Hz</dd></div>
      </dl>
      <div class="price-block">
        <div>${priceHtml(l, st)}<div class="delta-line">${deltaHtml(st, true)}</div></div>
        ${sparkline(l.history)}
      </div>
      <button class="score-line" data-action="detail" data-id="${esc(l.id)}" title="See how this score is calculated">${scoreRing(s.total)}<div><div class="score-label">${profileLabel(pk)} score</div><div class="muted small">${esc(strengths(l, pk))}</div></div></button>
      <footer class="card-foot">
        ${l.checkStatus && l.checkStatus !== 'ok' ? `<div class="auto-warn small" title="${esc(l.checkDetail)}">${I('info')}Auto-check ${l.checkStatus === 'no-price' ? "couldn't find a price" : l.checkStatus}: check manually</div>` : ''}
        <div class="checked">${I('clock')}<span>${st ? `${esc(r.name)} · <time datetime="${st.lastT}" title="${esc(fmtDate(st.lastT))}">checked ${ago(st.lastT)}</time>` : esc(r.name) + (lastCheck(l) ? ' · tried ' + ago(lastCheck(l)) : ' · not checked')}</span></div>
        <div class="card-actions">
          <button class="icon-btn ${l.watch ? 'on' : ''}" data-action="watch" data-id="${esc(l.id)}" aria-pressed="${l.watch}" title="${l.watch ? 'Remove from watchlist' : 'Add to watchlist'}">${I('star')}</button>
          <button class="icon-btn ${inCmp ? 'on' : ''}" data-action="compare-toggle" data-id="${esc(l.id)}" aria-pressed="${inCmp}" title="${inCmp ? 'Remove from compare' : 'Add to compare'}">${I('columns')}</button>
          <button class="icon-btn" data-action="log-price" data-id="${esc(l.id)}" title="Log a price you saw">${I('plus')}</button>
          ${link ? `<a class="btn btn-sm" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" title="${link.exact ? 'Open the saved product page' : 'Search for this model at the retailer'}">${esc(link.label)}${I('external')}</a>` : ''}
        </div>
      </footer>
    </article>`;
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
  function filterBar(defSort) {
    const f = ui.filters;
    const brands = [...new Set([...BRANDS, ...state.laptops.map(l => l.brand)])].filter(b => state.laptops.some(l => l.brand === b));
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
    return `<div class="filters" role="search">
      <label class="field field-search"><span class="sr-only">Search</span>${I('search')}<input type="search" id="f-q" value="${esc(f.q)}" placeholder="Search model, brand, CPU…"></label>
      <label class="field"><span class="sr-only">GPU</span><select id="f-gpu">${opt('all', 'All GPUs', f.gpu)}${GPU_ORDER.map(k => opt(k, GPUS[k].label, f.gpu)).join('')}</select></label>
      <label class="field"><span class="sr-only">RAM</span><select id="f-ram">${opt(0, 'Any RAM', f.ram)}${opt(16, '16GB+', f.ram)}${opt(32, '32GB+', f.ram)}${opt(64, '64GB+', f.ram)}</select></label>
      <label class="field"><span class="sr-only">Brand</span><select id="f-brand">${opt('all', 'All brands', f.brand)}${brands.map(b => opt(b, b, f.brand)).join('')}</select></label>
      <label class="field"><span class="sr-only">Retailer</span><select id="f-retailer">${opt('all', 'All retailers', f.retailer)}${RETAILERS.map(r => opt(r.id, r.name, f.retailer)).join('')}</select></label>
      <div class="field field-range"><label><span class="sr-only">Minimum price</span><input type="number" id="f-min" inputmode="numeric" min="0" step="50" placeholder="Min $" value="${esc(f.min)}"></label><span class="muted">–</span><label><span class="sr-only">Maximum price</span><input type="number" id="f-max" inputmode="numeric" min="0" step="50" placeholder="Max $" value="${esc(f.max)}"></label></div>
      <label class="field"><span class="sr-only">Price status</span><select id="f-status">${opt('all', 'All prices', f.status)}${opt('verified', 'Verified only', f.status)}${opt('auto', 'Auto-checked', f.status)}${opt('unverified', 'Unverified', f.status)}${opt('demo', 'Demo data', f.status)}</select></label>
      <label class="field"><span class="sr-only">Sort</span><select id="f-sort">${SORTS.map(([v, l]) => opt(v, l, f.sort || defSort)).join('')}</select></label>
      <button class="btn btn-ghost btn-sm" data-action="reset-filters">Reset</button>
    </div>`;
  }
  function bindFilters(rerun) {
    const map = { 'f-q': 'q', 'f-gpu': 'gpu', 'f-ram': 'ram', 'f-brand': 'brand', 'f-retailer': 'retailer', 'f-min': 'min', 'f-max': 'max', 'f-status': 'status', 'f-sort': 'sort' };
    const deb = debounce(rerun, 120);
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        ui.filters[key] = key === 'ram' ? Number(el.value) : el.value;
        if (key === 'q') $('#global-search').value = el.value;
        el.tagName === 'SELECT' ? rerun() : deb();
      });
    }
  }

  /* =========================================================
   * 9. Views
   * ======================================================= */
  const NAV = [
    { group: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'deals', label: 'Best Deals', icon: 'flame' },
    { id: 'gpus', label: 'RTX 5050–5090', icon: 'chip' },
    { id: 'compare', label: 'Compare Laptops', icon: 'columns' },
    { id: 'history', label: 'Price History', icon: 'chart' },
    { id: 'watchlist', label: 'My Watchlist', icon: 'star' },
    { group: 'Best picks' },
    { id: 'gaming', label: 'Best for AAA Gaming', icon: 'gamepad' },
    { id: 'labs', label: 'Best for AI & SOC Labs', icon: 'shield' },
    { group: 'By budget' },
    { id: 'under1000', label: 'Under $1,000', icon: 'dollar' },
    { id: 'under1500', label: 'Under $1,500', icon: 'dollar' },
    { id: 'under2000', label: 'Under $2,000', icon: 'dollar' },
    { group: 'More' },
    { id: 'retailers', label: 'Retailer Directory', icon: 'store' },
    { id: 'settings', label: 'Settings', icon: 'sliders' }
  ];

  const LIST_VIEWS = {
    deals:     { title: 'Best Deals', sub: 'Sorted by how far each price sits below its highest recorded price, then by value.', sort: 'drop' },
    gpus:      { title: 'RTX 5050–5090', sub: 'Browse by GPU tier. VRAM and TGP decide how a laptop GPU actually performs.', sort: 'gpu', gpuChips: true },
    gaming:    { title: 'Best for AAA Gaming', sub: 'Weighted toward GPU tier, TGP, cooling and display quality.', sort: 'score', profile: 'gaming', explain: true },
    labs:      { title: 'Best for AI & SOC Labs', sub: 'Combined score for local AI, SOC/security labs and VM/Docker workloads (Wazuh, Suricata, Security Onion).', sort: 'score', profile: 'labs', explain: true },
    under1000: { title: 'Under $1,000', sub: 'Current price at or under $1,000, sorted by value.', sort: 'value', cap: 1000 },
    under1500: { title: 'Under $1,500', sub: 'Current price at or under $1,500, sorted by value.', sort: 'value', cap: 1500 },
    under2000: { title: 'Under $2,000', sub: 'Current price at or under $2,000, sorted by value.', sort: 'value', cap: 2000 }
  };

  let currentView = 'dashboard';
  const view = () => $('#view');

  function pageHead(title, sub, extra = '') {
    return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>${extra}</div>`;
  }
  function demoNotice() {
    if (!state.settings.showDemo || !state.laptops.some(l => l.demo)) return '';
    return `<div class="notice notice-demo">${I('info')}<div><strong>Demo data is showing.</strong> Entries marked <span class="badge badge-demo">Demo data</span> have made-up prices. They show how the tracker works and are not real deals. Hide or remove them in <a href="#/settings">Settings</a>, then add laptops you find.</div></div>`;
  }

  function renderListView(key) {
    const cfg = LIST_VIEWS[key];
    const pk = cfg.profile || state.settings.profile;
    let extra = '';
    if (cfg.gpuChips) {
      extra = `<div class="gpu-chips" role="tablist">${['all', ...GPU_ORDER].map(k => {
        const n = visible().filter(l => k === 'all' || l.gpu === k).length;
        return `<button role="tab" class="chip ${ui.filters.gpu === k ? 'on' : ''}" data-action="set-gpu" data-gpu="${k}" aria-selected="${ui.filters.gpu === k}">${k === 'all' ? 'All' : GPUS[k].label}<span class="chip-n">${n}</span></button>`;
      }).join('')}</div>${gpuTable()}`;
    }
    if (key === 'labs') {
      extra = `<div class="seg" role="tablist">${[['labs', 'Combined'], ['ai', 'Local AI / ML'], ['soc', 'SOC labs'], ['vm', 'VMs & Docker']].map(([k, l]) => `<button role="tab" class="seg-btn ${ui.aiTab === k ? 'on' : ''}" data-action="ai-tab" data-tab="${k}" aria-selected="${ui.aiTab === k}">${l}</button>`).join('')}</div>`;
    }
    view().innerHTML = pageHead(cfg.title, cfg.sub, `<button class="btn btn-ghost btn-sm" data-action="how-scores">${I('info')}How scores work</button>`) + demoNotice() + extra + filterBar(cfg.sort) + '<div class="result-meta" id="result-meta"></div><div id="results"></div>';
    const run = () => {
      const p = key === 'labs' ? ui.aiTab : pk;
      const list = applyFilters(visible(), { ...ui.filters, sort: ui.filters.sort || cfg.sort }, p, cfg.cap);
      $('#result-meta').textContent = `${list.length} laptop${list.length === 1 ? '' : 's'}${cfg.cap ? ' at or under ' + money(cfg.cap) : ''}`;
      if (!list.length) { $('#results').innerHTML = emptyState('No laptops match these filters.', 'Reset the filters or add a laptop you found.'); return; }
      $('#results').innerHTML = cfg.explain ? `<ol class="ranked">${list.map((l, i) => rankedRow(l, p, i + 1)).join('')}</ol>` : `<div class="grid">${list.map(l => card(l, p)).join('')}</div>`;
    };
    ui.rerunResults = run;
    bindFilters(run);
    run();
  }

  function rankedRow(l, pk, rank) {
    const st = priceStats(l);
    const s = scoreFor(l, pk);
    const breakdown = pk === 'labs'
      ? `<div class="sub-scores">${['ai', 'soc', 'vm'].map(k => `<div><span class="muted small">${PROFILES[k].short}</span><strong>${s.sub[k]}</strong></div>`).join('')}</div>`
      : breakdownBars(s, true);
    const link = retailerLink(l);
    return `<li class="ranked-row ${l.demo ? 'card-demo' : ''}">
      <div class="rank">${rank}</div>
      <div class="ranked-main">
        <div class="ranked-top"><button class="linklike ranked-name" data-action="detail" data-id="${esc(l.id)}">${esc(l.name)}</button>${statusBadge(l)}</div>
        <div class="muted small">${GPUS[l.gpu].label} ${l.vram}GB${l.tgp ? ' · ' + l.tgp + 'W' : ''} · ${esc(l.cpu)} · ${l.ram}GB${l.ramUpgradeable ? '→' + l.ramMax : ''} · ${fmtStorage(l.storage)} · ${l.displaySize}" ${esc(l.panel)} · cooling ${l.cooling}/5</div>
        ${breakdown}
        ${s.notes && s.notes.length ? `<ul class="score-notes">${s.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="ranked-side">
        ${scoreRing(s.total, 56)}
        ${priceHtml(l, st)}
        <div class="small">${deltaHtml(st, true)}</div>
        <div class="row-actions">
          <button class="icon-btn ${l.watch ? 'on' : ''}" data-action="watch" data-id="${esc(l.id)}" title="Watch">${I('star')}</button>
          <button class="icon-btn ${state.compare.includes(l.id) ? 'on' : ''}" data-action="compare-toggle" data-id="${esc(l.id)}" title="Compare">${I('columns')}</button>
          ${link ? `<a class="icon-btn" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" title="${esc(link.label)}">${I('external')}</a>` : ''}
        </div>
      </div>
    </li>`;
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
  function gpuTable() {
    return `<div class="gpu-table">${GPU_ORDER.map(k => {
      const g = GPUS[k];
      const ls = visible().filter(l => l.gpu === k && curPrice(l));
      const lo = ls.length ? Math.min(...ls.map(curPrice)) : null;
      return `<div class="gpu-cell ${ui.filters.gpu === k ? 'on' : ''}"><span class="gpu-chip g${k}">${g.label}</span><div class="gpu-meta"><span>${g.vram}GB VRAM</span><span class="muted">${g.tier}</span></div><div class="gpu-perf"><span style="width:${g.perf}%"></span></div><div class="small muted">Perf. index ${g.perf} · ${lo ? 'from ' + money(lo) : 'none tracked'}</div></div>`;
    }).join('')}</div><p class="muted small gpu-foot">The performance index is a rough estimate for ranking (RTX 5090 Laptop = 100), not a benchmark. The same GPU can perform very differently depending on TGP and cooling.</p>`;
  }
  function emptyState(title, body, action = '') {
    return `<div class="empty">${I('search', 'ico-lg')}<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p>${action || `<button class="btn btn-primary" data-action="add-laptop">${I('plus')}Add a laptop</button>`}</div>`;
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
  function renderDashboard() {
    const list = visible();
    const pk = state.settings.profile;
    const cd = countdown();
    const verified = state.laptops.reduce((n, l) => n + l.history.filter(o => o.status === 'verified').length, 0);
    const watch = list.filter(l => l.watch);
    const hits = watch.filter(l => l.target && curPrice(l) != null && curPrice(l) <= l.target);
    const lastT = list.map(lastCheck).filter(Boolean).sort().pop();
    const drops = list.map(l => ({ l, st: priceStats(l) })).filter(x => x.st && x.st.dPrev < 0).sort((a, b) => a.st.dPrevPct - b.st.dPrevPct).slice(0, 5);
    const top = applyFilters(list, { ...ui.filters, q: '', gpu: 'all', brand: 'all', retailer: 'all', ram: 0, min: '', max: '', status: 'all', sort: 'score' }, pk).slice(0, 3);
    const stale = list.filter(l => !l.demo && (!lastCheck(l) || Date.now() - new Date(lastCheck(l)) > 3 * DAY || (l.checkStatus && l.checkStatus !== 'ok'))).slice(0, 5);

    view().innerHTML = `
      ${pageHead('Dashboard', 'Track RTX 50-series laptop prices into Black Friday and Cyber Monday.')}
      <section class="hero">
        <div class="hero-count">
          <div class="eyebrow">${I('bolt')}${esc(cd.title)}</div>
          ${cd.live ? `<div class="count-live">Deals are live</div>` : `<div class="count"><div><strong>${cd.d}</strong><span>days</span></div><div><strong>${cd.h}</strong><span>hours</span></div><div><strong>${cd.m}</strong><span>min</span></div></div>`}
          <div class="muted small">${esc(cd.sub)}</div>
        </div>
        <div class="hero-how">
          ${autoPanel()}
        </div>
      </section>
      ${demoNotice()}
      <section class="kpis">
        ${kpi('Laptops tracked', list.length, `${list.filter(l => l.auto).length} automatic · ${list.filter(l => !l.demo && !l.auto).length} added by you`)}
        ${kpi('Watchlist', watch.length, hits.length ? `${hits.length} at or below target` : 'Set targets in My Watchlist', hits.length ? 'good' : '')}
        ${kpi('Auto-checked prices', state.laptops.reduce((n, l) => n + l.history.filter(o => o.status === 'auto').length, 0), verified + ' verified by you')}
        ${kpi('Last price check', lastT ? ago(lastT) : '—', lastT ? fmtDate(lastT) : 'No prices logged')}
      </section>
      <div class="dash-grid">
        <section class="panel">
          <div class="panel-head"><h2>Top picks · ${esc(PROFILES[pk].short)}</h2><a href="#/${pk === 'gaming' ? 'gaming' : 'deals'}" class="small">See all</a></div>
          ${top.length ? `<div class="grid grid-tight">${top.map(l => card(l, pk)).join('')}</div>` : emptyState('Nothing tracked yet', 'Add a laptop to get started.')}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Recent price drops</h2><a href="#/deals" class="small">Best deals</a></div>
          ${drops.length ? `<ul class="mini-list">${drops.map(({ l, st }) => `<li><button class="linklike" data-action="detail" data-id="${esc(l.id)}">${esc(l.name)}</button>${l.demo ? '<span class="badge badge-demo">Demo</span>' : ''}<span class="mini-right">${money(st.cur)} <span class="delta down">${I('down')}${Math.abs(st.dPrevPct).toFixed(1)}%</span></span></li>`).join('')}</ul>` : '<p class="muted">No drops recorded yet. Log at least two prices for a laptop to see changes.</p>'}
          <div class="panel-head mt"><h2>Needs a price check</h2></div>
          ${stale.length ? `<ul class="mini-list">${stale.map(l => `<li><button class="linklike" data-action="detail" data-id="${esc(l.id)}">${esc(l.name)}</button><span class="mini-right"><span class="muted small">${l.checkStatus && l.checkStatus !== 'ok' ? 'auto-check ' + esc(l.checkStatus) : lastCheck(l) ? ago(lastCheck(l)) : 'never'}</span> <button class="btn btn-sm" data-action="log-price" data-id="${esc(l.id)}">Log price</button></span></li>`).join('')}</ul>` : '<p class="muted small">Laptops show here when their last check is over 3 days old or the automatic checker was blocked.</p>'}
          <div class="panel-head mt"><h2>By GPU</h2><a href="#/gpus" class="small">Browse</a></div>
          <div class="gpu-dist">${GPU_ORDER.map(k => { const n = list.filter(l => l.gpu === k).length; const max = Math.max(1, ...GPU_ORDER.map(x => list.filter(l => l.gpu === x).length)); return `<a href="#/gpus" data-action="set-gpu" data-gpu="${k}" class="gpu-dist-row"><span class="gpu-chip g${k}">${GPUS[k].label}</span><span class="bar"><span style="width:${n / max * 100}%"></span></span><span class="bar-val">${n}</span></a>`; }).join('')}</div>
        </section>
      </div>`;
  }
  const kpi = (label, value, sub, tone = '') => `<div class="kpi ${tone}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-sub muted small">${esc(sub)}</div></div>`;

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

  /* ---------- Price history ---------- */
  function renderHistory() {
    const list = visible().slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) { view().innerHTML = pageHead('Price History', '') + emptyState('No laptops tracked', 'Add a laptop and log prices to build its history.'); return; }
    if (!ui.historyId || !list.some(l => l.id === ui.historyId)) ui.historyId = (list.find(l => l.watch) || list[0]).id;
    const l = getL(ui.historyId);
    const st = priceStats(l);
    const cmpRow = (label, d, pctv) => d == null ? `<div class="cmp-row"><span>${label}</span><span class="muted">—</span></div>` : `<div class="cmp-row"><span>${label}</span><span class="delta ${d < 0 ? 'down' : d > 0 ? 'up' : 'flat'}">${d === 0 ? 'Same' : (d < 0 ? '−' : '+') + money(Math.abs(d)).slice(1) + (pctv != null ? ` (${Math.abs(pctv).toFixed(1)}%)` : '')}</span></div>`;
    view().innerHTML = `
      ${pageHead('Price History', 'Every price you log is saved with its date and time, in this browser.', `<div class="row-actions"><label class="field"><span class="sr-only">Choose laptop</span><select id="hist-pick">${list.map(x => `<option value="${esc(x.id)}" ${x.id === l.id ? 'selected' : ''}>${esc(x.name)}${x.demo ? ' (demo)' : ''}</option>`).join('')}</select></label><button class="btn btn-primary btn-sm" data-action="log-price" data-id="${esc(l.id)}">${I('plus')}Log price</button></div>`)}
      <div class="notice">${I('info')}<div>History is stored in <strong>this browser on this device</strong>. It survives closing and reopening the browser, but not clearing site data, private windows or switching devices. Use <a href="#/settings">Settings → Export</a> to back it up or move it.</div></div>
      <section class="panel">
        <div class="panel-head"><div><h2>${esc(l.name)}</h2><div class="muted small">${GPUS[l.gpu].label} · ${esc(RETAILER_MAP[l.retailer].name)} ${statusBadge(l)}</div></div>${priceHtml(l, st, true)}</div>
        <div class="chart" id="hist-chart"></div>
        <div class="legend small muted"><span><i class="dot dot-auto"></i>Auto-checked</span><span><i class="dot dot-verified"></i>Verified</span><span><i class="dot dot-unverified"></i>Unverified</span><span><i class="dot dot-demo"></i>Demo</span><span><i class="dash"></i>Lowest / highest recorded</span></div>
      </section>
      ${st ? `<div class="hist-grid">
        <section class="panel">
          <h2>Summary</h2>
          <div class="stats">
            <div><span class="muted small">Current</span><strong>${money(st.cur)}</strong></div>
            <div><span class="muted small">Lowest recorded</span><strong class="ok">${money(st.lo)}</strong></div>
            <div><span class="muted small">Highest recorded</span><strong>${money(st.hi)}</strong></div>
            <div><span class="muted small">Below highest</span><strong>${money(st.belowHigh)} <span class="muted small">(${st.belowHighPct.toFixed(1)}%)</span></strong></div>
            <div><span class="muted small">Savings vs list</span><strong>${st.vsList != null ? money(st.vsList) + ` <span class="muted small">(${st.vsListPct.toFixed(1)}%)</span>` : '—'}</strong></div>
            <div><span class="muted small">Observations</span><strong>${st.count}</strong></div>
          </div>
        </section>
        <section class="panel">
          <h2>Today's price vs before</h2>
          ${cmpRow('vs previous check', st.dPrev, st.dPrevPct)}
          ${cmpRow('vs about 7 days ago', st.dWeek, st.dWeekPct)}
          ${cmpRow('vs first recorded', st.count > 1 ? st.dFirst : null, st.dFirstPct)}
          ${cmpRow('vs lowest recorded', st.count > 1 ? st.aboveLow : null, st.lo ? st.aboveLow / st.lo * 100 : null)}
          ${cmpRow('vs highest recorded', st.count > 1 ? -st.belowHigh : null, st.belowHighPct)}
          <p class="muted small">Last checked ${esc(fmtDate(st.lastT))} (${ago(st.lastT)}).</p>
        </section>
      </div>` : ''}
      <section class="panel">
        <div class="panel-head"><h2>Observations</h2><span class="muted small">Newest first</span></div>
        ${obsTable(l)}
      </section>`;
    drawChart($('#hist-chart'), l.history);
    $('#hist-pick').addEventListener('change', e => { ui.historyId = e.target.value; renderHistory(); });
  }
  function obsTable(l) {
    if (!l.history.length) return '<p class="muted">No prices logged yet.</p>';
    const rows = l.history.map((o, i) => ({ o, i })).reverse();
    return `<div class="table-wrap"><table class="obs-table"><thead><tr><th>Date & time</th><th>Price</th><th>Change</th><th>Status</th><th>Source / note</th><th></th></tr></thead><tbody>${rows.map(({ o, i }) => {
      const prev = l.history[i - 1];
      const d = prev ? o.price - prev.price : null;
      return `<tr><td>${esc(fmtDate(o.t))}</td><td class="num">${money(o.price)}</td><td>${d == null ? '<span class="muted">first</span>' : d === 0 ? '<span class="muted">—</span>' : `<span class="delta ${d < 0 ? 'down' : 'up'}">${d < 0 ? '−' : '+'}${money(Math.abs(d)).slice(1)}</span>`}</td><td><span class="badge ${o.status === 'verified' ? 'badge-ok' : o.status === 'auto' ? 'badge-auto' : o.status === 'demo' ? 'badge-demo' : 'badge-warn'}">${o.status}</span></td><td class="muted small">${esc([o.source, o.note].filter(Boolean).join(' · ')) || '—'}</td><td><button class="icon-btn" data-action="del-obs" data-id="${esc(l.id)}" data-i="${i}" title="Delete this observation">${I('trash')}</button></td></tr>`;
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
  window.addEventListener('resize', debounce(() => {
    ui.charts.filter(c => document.body.contains(c.el)).forEach(c => drawChart(c.el, c.obs, c.opts));
  }, 200));

  /* ---------- Watchlist ---------- */
  function renderWatchlist() {
    const ls = visible().filter(l => l.watch).sort((a, b) => (curPrice(a) ?? 1e9) - (curPrice(b) ?? 1e9));
    view().innerHTML = pageHead('My Watchlist', 'Star laptops to follow them here. Set a target price and you\'ll see it highlighted when a logged price reaches it.') +
      (ls.length ? `<div class="watch-list">${ls.map(l => {
        const st = priceStats(l);
        const hit = l.target && st && st.cur <= l.target;
        const gap = l.target && st ? st.cur - l.target : null;
        const link = retailerLink(l);
        return `<article class="watch-row ${hit ? 'hit' : ''} ${l.demo ? 'card-demo' : ''}">
          <div class="watch-main">
            <div class="ranked-top"><button class="linklike ranked-name" data-action="detail" data-id="${esc(l.id)}">${esc(l.name)}</button>${statusBadge(l)}${hit ? '<span class="badge badge-ok">Target hit</span>' : ''}</div>
            <div class="muted small">${GPUS[l.gpu].label} · ${l.ram}GB · ${fmtStorage(l.storage)} · ${esc(RETAILER_MAP[l.retailer].name)} · ${st ? 'checked ' + ago(st.lastT) : 'no price yet'}</div>
          </div>
          ${sparkline(l.history)}
          <div class="watch-price">${priceHtml(l, st)}<div class="small">${deltaHtml(st, true)}</div></div>
          <label class="watch-target"><span class="muted small">Target price</span><input type="number" min="0" step="10" inputmode="numeric" data-target-id="${esc(l.id)}" value="${l.target ?? ''}" placeholder="e.g. 1500"><span class="small ${hit ? 'ok' : 'muted'}">${gap == null ? '&nbsp;' : hit ? 'At or below target' : money(gap) + ' to go'}</span></label>
          <div class="row-actions">
            <button class="btn btn-sm" data-action="log-price" data-id="${esc(l.id)}">${I('plus')}Log price</button>
            ${link ? `<a class="btn btn-sm btn-ghost" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" data-action="check" data-id="${esc(l.id)}" title="Opens the retailer and a form to log what you see">${I('refresh')}Check now</a>` : ''}
            <button class="icon-btn on" data-action="watch" data-id="${esc(l.id)}" title="Remove from watchlist">${I('star')}</button>
          </div>
        </article>`;
      }).join('')}</div>` : emptyState('Your watchlist is empty', 'Use the star icon on any laptop to watch it.', '<a class="btn btn-primary" href="#/deals">Browse deals</a>'));
    $$('[data-target-id]').forEach(inp => inp.addEventListener('change', () => {
      const l = getL(inp.dataset.targetId);
      const v = num(inp.value);
      l.target = v && v > 0 ? v : null;
      touch(l); save(); renderWatchlist(); toast(l.target ? `Target set at ${money(l.target)}` : 'Target cleared');
    }));
  }

  /* ---------- Retailers ---------- */
  function renderRetailers() {
    view().innerHTML = pageHead('Retailer Directory', 'Official store links plus a ready-made search for RTX 50-series laptops at each one.') +
      `<div class="notice">${I('info')}<div>These links open the retailer's own site. Browsers block websites from reading other sites' prices (CORS), and automated scraping usually breaks retailer terms, so prices are entered by you, imported, or loaded from a JSON feed you control.</div></div>
      <div class="grid">${RETAILERS.filter(r => r.id !== 'other').map(r => {
        const ls = visible().filter(l => l.retailer === r.id && curPrice(l));
        const lo = ls.length ? ls.reduce((a, b) => curPrice(a) <= curPrice(b) ? a : b) : null;
        return `<article class="card retailer-card">
          <header class="card-head"><h3>${esc(r.name)}</h3><span class="badge">${ls.length} tracked</span></header>
          <p class="muted small">${esc(r.note)}</p>
          ${lo ? `<div class="small">Lowest tracked: <button class="linklike" data-action="detail" data-id="${esc(lo.id)}">${esc(lo.name)}</button> · ${money(curPrice(lo))}${lo.demo ? ' <span class="badge badge-demo">Demo</span>' : ''}</div>` : '<div class="small muted">Nothing tracked here yet.</div>'}
          <footer class="card-foot">
            <span class="muted small">Price access: manual entry</span>
            <div class="card-actions">
              <a class="btn btn-sm btn-ghost" href="${esc(r.home)}" target="_blank" rel="noopener noreferrer">Store${I('external')}</a>
              <a class="btn btn-sm" href="${esc(r.search('RTX 50 gaming laptop'))}" target="_blank" rel="noopener noreferrer">RTX 50 search${I('external')}</a>
            </div>
          </footer>
        </article>`;
      }).join('')}</div>`;
  }

  /* ---------- Settings ---------- */
  function renderSettings() {
    const s = state.settings;
    const demoCount = state.laptops.filter(l => l.demo).length;
    const kb = (storageBytes() / 1024).toFixed(1);
    view().innerHTML = pageHead('Settings', 'Appearance, scoring, backups and data sources.') + `
      <div class="settings">
        <section class="panel">
          <h2>Appearance</h2>
          <div class="seg">${['dark', 'light'].map(t => `<button class="seg-btn ${s.theme === t ? 'on' : ''}" data-action="set-theme" data-theme="${t}">${I(t === 'dark' ? 'moon' : 'sun')}${t === 'dark' ? 'Dark' : 'Light'}</button>`).join('')}</div>
        </section>

        <section class="panel">
          <h2>Primary use</h2>
          <p class="muted small">Cards and the dashboard show the score for this workload. Every score is still visible in each laptop's details and on Compare.</p>
          <div class="radio-list">${PROFILE_KEYS.map(k => `<label class="radio"><input type="radio" name="profile" value="${k}" ${s.profile === k ? 'checked' : ''}><span>${I(PROFILES[k].icon)}${esc(PROFILES[k].label)}</span></label>`).join('')}</div>
          <button class="btn btn-ghost btn-sm" data-action="how-scores">${I('info')}See the scoring weights</button>
        </section>

        <section class="panel">
          <h2>Demo data</h2>
          <p class="muted small">${demoCount} demo laptops are loaded. Their prices are made up to show how the site works. They are never real deals.</p>
          <label class="switch"><input type="checkbox" id="show-demo" ${s.showDemo ? 'checked' : ''}><span>Show demo data</span></label>
          <div class="row-actions">
            ${demoCount ? '<button class="btn btn-sm btn-danger-ghost" data-action="clear-demo">Remove demo data</button>' : '<button class="btn btn-sm" data-action="load-demo">Load demo data</button>'}
          </div>
        </section>

        <section class="panel">
          <h2>Backup, export & import</h2>
          <p class="muted small">JSON is a full backup (laptops, specs, every price, watchlist, settings). CSV has one row per price observation, which works well in Excel or Google Sheets and can be imported back.</p>
          <div class="row-actions">
            <button class="btn btn-sm" data-action="export-json">${I('download')}Export JSON</button>
            <button class="btn btn-sm" data-action="export-csv">${I('download')}Export CSV</button>
          </div>
          <div class="import-row">
            <div class="seg seg-sm">${[['merge', 'Merge with my data'], ['replace', 'Replace my data']].map(([m, l]) => `<button class="seg-btn ${s.importMode === m ? 'on' : ''}" data-action="import-mode" data-mode="${m}">${l}</button>`).join('')}</div>
            <button class="btn btn-sm btn-primary" data-action="import-file">${I('upload')}Import JSON or CSV</button>
          </div>
          <p class="muted small">Storage used: about ${kb} KB in this browser${storageOK ? '' : ' (<span class="warn">last save failed</span>)'}.</p>
        </section>

        <section class="panel">
          <h2>Automatic price checks</h2>
          <p class="muted small">A free GitHub Action in your repository checks prices every 3 hours and saves them to <code>feed.json</code>. This site loads that file when it opens and every 15 minutes after that.</p>
          <label class="switch"><input type="checkbox" id="auto-feed" ${s.autoFeed ? 'checked' : ''}><span>Load automatic prices</span></label>
          <form class="feed-form" id="feed-form">
            <label class="field grow"><span class="sr-only">Feed URL</span>${I('link')}<input type="text" id="feed-url" value="${esc(s.feedUrl)}" placeholder="feed.json" spellcheck="false"></label>
            <button class="btn btn-sm" type="submit">Save</button>
            <button class="btn btn-sm btn-primary" type="button" data-action="refresh">${I('refresh')}Reload now</button>
          </form>
          <p class="muted small">${state.feedMeta && state.feedMeta.generated ? 'Last check by the Action: ' + esc(fmtDate(state.feedMeta.generated)) + '. ' : ''}${s.lastFeedAt ? 'Loaded here ' + esc(ago(s.lastFeedAt)) + '.' : ''} Leave the URL as <code>feed.json</code> unless you host the feed somewhere else.</p>
          <h3 class="mt">Track specific product pages</h3>
          <p class="muted small">Best Buy laptops are found automatically once you add the API key. To track any other product page (Lenovo, Dell, HP, B&amp;H…), add the laptop here with its product URL, then download <code>tracked.json</code> and upload it to your repository, replacing the old one.</p>
          <button class="btn btn-sm" data-action="export-tracked">${I('download')}Download tracked.json</button>
        </section>

        <section class="panel">
          <h2>About your data</h2>
          <ul class="plain-list small">
            <li>Everything is saved in this browser's local storage on this device. Nothing is sent to a server.</li>
            <li>Another browser, another device, or a private window starts empty. Use export and import to move data.</li>
            <li>Clearing browser data for this site deletes your history. Export a backup first.</li>
            <li>Prices do not update by themselves. "Last checked" is the time you or your feed recorded a price.</li>
          </ul>
          <button class="btn btn-sm btn-danger-ghost" data-action="reset-all">${I('trash')}Erase all data in this browser</button>
        </section>
      </div>`;
    $('#show-demo').addEventListener('change', e => { s.showDemo = e.target.checked; save(); updateChrome(); renderSettings(); });
    $$('input[name=profile]').forEach(r => r.addEventListener('change', () => { s.profile = r.value; save(); toast('Primary use: ' + PROFILES[r.value].label); }));
    $('#auto-feed').addEventListener('change', e => { s.autoFeed = e.target.checked; save(); if (s.autoFeed) refreshFeed(true); updateChrome(); });
    $('#feed-form').addEventListener('submit', e => { e.preventDefault(); s.feedUrl = $('#feed-url').value.trim(); save(); toast(s.feedUrl ? 'Feed URL saved' : 'Feed URL cleared'); });
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

  function openDetail(id) {
    const l = getL(id); if (!l) return;
    const st = priceStats(l), link = retailerLink(l), pk = state.settings.profile;
    const tabs = PROFILE_KEYS.map(k => `<button class="seg-btn ${k === pk ? 'on' : ''}" data-detail-tab="${k}">${PROFILES[k].short}<span class="seg-n">${scoreFor(l, k).total}</span></button>`).join('');
    openModal(`
      <div class="detail-head">
        <div><div class="muted small">${esc(l.brand)}</div><h2>${esc(l.name)}</h2><div class="badges">${statusBadge(l)}${l.watch ? '<span class="badge">Watching</span>' : ''}</div></div>
        <div class="detail-price">${priceHtml(l, st, true)}<div class="small">${deltaHtml(st)}</div><div class="muted small">${st ? `${esc(RETAILER_MAP[l.retailer].name)} · checked <span title="${esc(fmtDate(st.lastT))}">${ago(st.lastT)}</span>` : 'No price logged'}</div></div>
      </div>
      ${l.demo ? `<div class="notice notice-demo">${I('info')}<div>${esc(DEMO_NOTE)}</div></div>` : ''}
      ${l.specsFrom ? `<div class="notice">${I('info')}<div>${esc(l.specsFrom)} Use Edit to correct them; the scores update right away.</div></div>` : ''}
      ${l.checkStatus && l.checkStatus !== 'ok' ? `<div class="notice">${I('info')}<div><strong>The last automatic check failed (${esc(l.checkStatus)}).</strong> ${esc(l.checkDetail)}. Check this one at the retailer and log the price by hand.</div></div>` : ''}
      <div class="row-actions detail-actions">
        ${link ? `<a class="btn btn-primary btn-sm" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" data-action="check" data-id="${esc(l.id)}">${I('refresh')}Check at ${esc(RETAILER_MAP[l.retailer].name)}</a>` : ''}
        <button class="btn btn-sm" data-action="log-price" data-id="${esc(l.id)}">${I('plus')}Log price</button>
        <button class="btn btn-sm btn-ghost" data-action="watch" data-id="${esc(l.id)}">${I('star')}${l.watch ? 'Unwatch' : 'Watch'}</button>
        <button class="btn btn-sm btn-ghost" data-action="compare-toggle" data-id="${esc(l.id)}">${I('columns')}${state.compare.includes(l.id) ? 'Remove from compare' : 'Compare'}</button>
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${esc(l.id)}">${I('edit')}Edit</button>
        <button class="btn btn-sm btn-danger-ghost" data-action="delete" data-id="${esc(l.id)}">${I('trash')}Delete</button>
      </div>
      <div class="chart chart-sm" id="detail-chart"></div>
      <div class="detail-grid">
        <section>
          <h3>Specifications</h3>
          <dl class="spec-table">
            <div><dt>GPU</dt><dd><span class="gpu-chip g${l.gpu}">${GPUS[l.gpu].label}</span> ${l.vram}GB VRAM${l.tgp ? ', ' + l.tgp + 'W TGP' : ''}</dd></div>
            <div><dt>CPU</dt><dd>${esc(l.cpu || '—')} <span class="muted small">(${esc(CPU_MAP[l.cpuClass].label)})</span></dd></div>
            <div><dt>RAM</dt><dd>${l.ram}GB · ${l.ramUpgradeable ? 'upgradeable to ' + l.ramMax + 'GB' : l.ramUpgradeKnown === false ? 'upgradeability unknown' : 'soldered'}</dd></div>
            <div><dt>Storage</dt><dd>${fmtStorage(l.storage)} · ${l.storageSlots} M.2 slot${l.storageSlots > 1 ? 's' : ''}</dd></div>
            <div><dt>Display</dt><dd>${l.displaySize}" ${RES[l.displayRes].label} ${esc(l.panel)} ${l.hz}Hz</dd></div>
            <div><dt>Cooling</dt><dd>${l.cooling}/5${l.coolingNote ? ' · ' + esc(l.coolingNote) : ''}</dd></div>
            <div><dt>Weight</dt><dd>${l.weight ? l.weight + ' kg' : '—'}</dd></div>
            <div><dt>List price</dt><dd>${money(l.listPrice)}</dd></div>
            <div><dt>Product URL</dt><dd>${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(l.url).hostname)}</a>` : '<span class="muted">Not set. Links use retailer search.</span>'}</dd></div>
            ${l.notes && !l.demo ? `<div><dt>Notes</dt><dd>${esc(l.notes)}</dd></div>` : ''}
          </dl>
        </section>
        <section>
          <h3>Estimated scores</h3>
          <div class="seg seg-scroll" role="tablist">${tabs}</div>
          <div id="detail-score"></div>
        </section>
      </div>
      <h3>Price observations</h3>
      ${obsTable(l)}`, { wide: true, label: l.name });
    const showTab = k => {
      $$('[data-detail-tab]').forEach(b => b.classList.toggle('on', b.dataset.detailTab === k));
      const s = scoreFor(l, k);
      $('#detail-score').innerHTML = `<div class="score-head">${scoreRing(s.total, 64)}<div><strong>${esc(PROFILES[k].label)}</strong><div class="muted small">${esc(strengths(l, k))}</div></div></div>${breakdownBars(s)}${s.notes.length ? `<ul class="score-notes">${s.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}<p class="muted small">Each bar shows points earned out of the points available for that factor in this workload. Hover or tap a row for the reason.</p>`;
    };
    $$('[data-detail-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.detailTab)));
    showTab(pk);
    requestAnimationFrame(() => drawChart($('#detail-chart'), l.history, { h: 200 }));
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

  function openRefreshInfo() {
    const f = feedState();
    openModal(`
      <h2>Price updates</h2>
      <p class="auto-status auto-${f.tone}"><strong>${esc(f.title)}.</strong> ${esc(f.body)}</p>
      <ol class="how-list">
        <li><strong>Automatic:</strong> the GitHub Action checks prices every 3 hours. You can also run it right away from your repository's Actions tab ("Run workflow").</li>
        <li><strong>By hand:</strong> for a store that blocks automated checks, open the laptop and press <em>Check at retailer</em>, then log what you see.</li>
        <li><strong>Import:</strong> load a JSON or CSV file of prices in Settings.</li>
      </ol>
      <div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">Close</button><a class="btn btn-primary" href="#/settings" data-action="close-modal">Open Settings</a></div>`, { label: 'Price updates' });
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
      save(); if (currentView === 'dashboard') rerender();
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
   * 12. Actions, chrome, routing
   * ======================================================= */
  function touch(l) { l._v = (l._v || 0) + 1; }
  function toggleCompare(id, force) {
    const i = state.compare.indexOf(id);
    if (i >= 0 && force !== true) { state.compare.splice(i, 1); toast('Removed from compare'); }
    else if (i < 0) {
      if (state.compare.length >= 4) { toast('Compare holds up to 4 laptops. Remove one first.', 'error'); return; }
      state.compare.push(id); toast('Added to compare');
    }
    save(); rerender();
  }
  function toast(msg, tone = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + (tone ? 'toast-' + tone : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, tone === 'error' ? 6000 : 3200);
  }
  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme;
    $('meta[name=theme-color]').setAttribute('content', state.settings.theme === 'light' ? '#f6f7f9' : '#0b0d11');
    $('#theme-btn').innerHTML = I(state.settings.theme === 'light' ? 'moon' : 'sun');
  }
  function renderNav() {
    $('#nav').innerHTML = NAV.map(n => n.group ? `<div class="nav-group">${esc(n.group)}</div>` :
      `<a href="#/${n.id}" class="nav-item ${currentView === n.id ? 'active' : ''}" ${currentView === n.id ? 'aria-current="page"' : ''}>${I(n.icon)}<span>${esc(n.label)}</span>${n.id === 'watchlist' ? `<span class="nav-n">${visible().filter(l => l.watch).length || ''}</span>` : ''}${n.id === 'compare' ? `<span class="nav-n">${state.compare.length || ''}</span>` : ''}</a>`).join('');
  }
  function renderTray() {
    const tray = $('#compare-tray');
    const ls = state.compare.map(getL).filter(Boolean);
    state.compare = ls.map(l => l.id);
    if (!ls.length || currentView === 'compare') { tray.hidden = true; return; }
    tray.hidden = false;
    tray.innerHTML = `<div class="tray-items">${ls.map(l => `<span class="tray-item">${esc(l.name.length > 26 ? l.name.slice(0, 25) + '…' : l.name)}<button data-action="compare-toggle" data-id="${esc(l.id)}" aria-label="Remove ${esc(l.name)}">${I('x')}</button></span>`).join('')}</div><a class="btn btn-primary btn-sm" href="#/compare">Compare ${ls.length}</a>`;
  }
  function updateChrome() {
    const pill = $('#demo-pill'), m = state.feedMeta;
    if (state.settings.autoFeed && m && m.generated && !m.error) { pill.hidden = false; pill.className = 'pill pill-auto'; pill.textContent = 'Auto-checked ' + ago(m.generated); pill.title = 'Last automatic price check: ' + fmtDate(m.generated); }
    else if (state.settings.showDemo && state.laptops.some(l => l.demo)) { pill.hidden = false; pill.className = 'pill pill-demo'; pill.textContent = 'Demo data on'; pill.title = ''; }
    else pill.hidden = true;
    renderNav(); renderTray();
  }
  function rerender() {
    if (ui.rerunResults && LIST_VIEWS[currentView] && $('#results')) {
      ui.rerunResults();
      if (LIST_VIEWS[currentView].gpuChips) { /* chip counts unaffected by most actions */ }
    } else {
      const y = window.scrollY;
      renderView();
      window.scrollTo(0, y);
    }
    updateChrome();
    if (!$('#modal-root').hidden) {
      const d = $('#modal-root .detail-head');
      if (d && ui.detailId && getL(ui.detailId)) openDetail(ui.detailId);
      else if (d) closeModal();
    }
  }
  function renderView() {
    ui.rerunResults = null;
    ui.charts = [];
    if (LIST_VIEWS[currentView]) return renderListView(currentView);
    ({ dashboard: renderDashboard, compare: renderCompare, history: renderHistory, watchlist: renderWatchlist, retailers: renderRetailers, settings: renderSettings }[currentView] || renderDashboard)();
  }
  function route() {
    const key = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'dashboard';
    const valid = NAV.some(n => n.id === key);
    const changed = currentView !== key;
    currentView = valid ? key : 'dashboard';
    if (changed) ui.filters.sort = '';
    document.body.classList.remove('nav-open');
    ui.detailId = null;
    closeModal();
    renderView();
    updateChrome();
    const nav = NAV.find(n => n.id === currentView);
    document.title = `${nav ? nav.label : 'Dashboard'} · RTX Deal Hunter`;
    if (changed) { window.scrollTo(0, 0); view().focus({ preventScroll: true }); }
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const id = a.dataset.id;
    switch (a.dataset.action) {
      case 'detail': ui.detailId = id; openDetail(id); break;
      case 'watch': { const l = getL(id); l.watch = !l.watch; touch(l); save(); toast(l.watch ? 'Added to watchlist' : 'Removed from watchlist'); rerender(); break; }
      case 'compare-toggle': toggleCompare(id); break;
      case 'compare-clear': state.compare = []; save(); rerender(); break;
      case 'log-price': ui.detailId = null; openLogPrice(id); break;
      case 'check': ui.detailId = null; setTimeout(() => openLogPrice(id), 50); break;  // link opens retailer in new tab
      case 'edit': ui.detailId = null; openLaptopForm(id); break;
      case 'add-laptop': openLaptopForm(null); break;
      case 'delete': {
        const l = getL(id);
        confirmModal('Delete this laptop?', `"${l.name}" and its ${l.history.length} price observations will be removed from this browser.`, 'Delete', () => {
          state.laptops = state.laptops.filter(x => x.id !== id);
          state.compare = state.compare.filter(x => x !== id);
          ui.detailId = null; save(); rerender(); toast('Laptop deleted');
        });
        break;
      }
      case 'del-obs': {
        const l = getL(id), i = Number(a.dataset.i), o = l.history[i];
        const reopen = ui.detailId;
        confirmModal('Delete this price?', `${money(o.price)} recorded ${fmtDate(o.t)}.`, 'Delete', () => {
          l.history.splice(i, 1); touch(l); save(); rerender();
          if (reopen) { ui.detailId = reopen; openDetail(reopen); }
          toast('Observation deleted');
        });
        break;
      }
      case 'close-modal': if (a.tagName !== 'A') e.preventDefault(); ui.detailId = null; closeModal(); break;
      case 'refresh': refreshFeed(false); break;
      case 'theme': state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); if (currentView === 'settings') renderSettings(); break;
      case 'set-theme': state.settings.theme = a.dataset.theme; save(); applyTheme(); renderSettings(); break;
      case 'nav-toggle': document.body.classList.toggle('nav-open'); break;
      case 'nav-close': document.body.classList.remove('nav-open'); break;
      case 'set-gpu': ui.filters.gpu = a.dataset.gpu; if (currentView === 'gpus') { e.preventDefault(); renderView(); } break;
      case 'ai-tab': ui.aiTab = a.dataset.tab; renderView(); break;
      case 'reset-filters': ui.filters = { q: '', gpu: 'all', brand: 'all', retailer: 'all', ram: 0, min: '', max: '', status: 'all', sort: '' }; $('#global-search').value = ''; renderView(); break;
      case 'how-scores': openHowScores(); break;
      case 'export-json': exportJSON(); break;
      case 'export-csv': exportCSV(); break;
      case 'export-tracked': exportTracked(); break;
      case 'import-file': $('#import-input').click(); break;
      case 'import-mode': state.settings.importMode = a.dataset.mode; save(); renderSettings(); break;
      case 'clear-demo': confirmModal('Remove demo data?', 'All laptops marked demo, and their made-up prices, will be deleted. Your own laptops stay.', 'Remove demo data', () => {
        const ids = new Set(state.laptops.filter(l => l.demo).map(l => l.id));
        state.laptops = state.laptops.filter(l => !l.demo); state.compare = state.compare.filter(x => !ids.has(x));
        save(); rerender(); toast('Demo data removed');
      }); break;
      case 'load-demo': mergeAll(buildDemo()); state.settings.showDemo = true; save(); rerender(); toast('Demo data loaded'); break;
      case 'reset-all': confirmModal('Erase everything?', 'This deletes every laptop, price and setting stored by RTX Deal Hunter in this browser. It cannot be undone.', 'Erase all', () => {
        try { localStorage.removeItem(STORE_KEY); } catch { }
        state = { laptops: [], settings: { ...DEFAULT_SETTINGS, showDemo: false }, compare: [], seededAt: new Date().toISOString() };
        save(); applyTheme(); rerender(); toast('All data erased');
      }); break;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#modal-root').hidden) { ui.detailId = null; closeModal(); } else document.body.classList.remove('nav-open'); }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $('#modal-root').hidden) { e.preventDefault(); $('#global-search').focus(); }
    if (e.key === 'Tab' && !$('#modal-root').hidden) {   // keep focus inside the dialog
      const f = $$('#modal-root .modal a[href], #modal-root .modal button:not([disabled]), #modal-root .modal input:not([disabled]), #modal-root .modal select, #modal-root .modal textarea').filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $('#import-input').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
  const gs = $('#global-search');
  gs.addEventListener('input', debounce(() => {
    ui.filters.q = gs.value;
    if (LIST_VIEWS[currentView] && $('#f-q')) { $('#f-q').value = gs.value; ui.rerunResults(); }
  }, 150));
  gs.addEventListener('keydown', e => {
    if (e.key === 'Enter') { ui.filters.q = gs.value; if (!LIST_VIEWS[currentView]) location.hash = '#/deals'; else ui.rerunResults(); }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', e => { if (e.key === STORE_KEY) { load(); applyTheme(); rerender(); } }); // sync between tabs
  setInterval(() => { if (currentView === 'dashboard' && $('#modal-root').hidden && !document.hidden) { const y = scrollY; renderDashboard(); scrollTo(0, y); } }, 60e3);

  /* ---------- boot ---------- */
  load();
  $('.nav-toggle').innerHTML = I('menu');
  $('.top-search-icon').innerHTML = I('search');
  $('#refresh-btn').innerHTML = I('refresh') + '<span class="hide-sm">Refresh</span>';
  $('#add-btn').innerHTML = I('plus') + '<span class="hide-sm">Add laptop</span>';
  applyTheme();
  route();
  if (state.settings.autoFeed) refreshFeed(true);
  setInterval(() => { if (state.settings.autoFeed && !document.hidden) refreshFeed(true); }, 15 * 60e3);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.settings.autoFeed && (!state.settings.lastFeedAt || Date.now() - new Date(state.settings.lastFeedAt) > 10 * 60e3)) refreshFeed(true);
  });
})();
