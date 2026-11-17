# RTX Deal Hunter

A free gaming laptop deal tracker for Black Friday and Cyber Monday 2026 that **checks prices automatically every 3 hours**.

It tracks laptops with RTX 5050, 5060, 5070, 5070 Ti, 5080 and 5090 GPUs, keeps a price history for each one, charts it, and scores every laptop out of 100 for six workloads: AAA gaming, SOC labs, local AI/ML, VMs and Docker (Wazuh, Suricata), heavy multitasking, and everyday use.

No servers, no database, no paid APIs. The website is plain HTML, CSS and JavaScript on GitHub Pages. The automatic checks run on **GitHub Actions**, which is free for public repositories.

---

## How automatic checking works

```
 every 3 hours                                    when you open the site
┌──────────────────────┐   commits    ┌───────────┐   loads   ┌──────────────────────┐
│ GitHub Action        │ ───────────▶ │ feed.json │ ───────▶ │ Website (your browser)│
│ scripts/check-prices │              │ (in repo) │           │ charts, scores, alerts│
└──────────────────────┘              └───────────┘           └──────────────────────┘
   reads: Best Buy API + product pages listed in tracked.json
```

1. **Every 3 hours**, the workflow in `.github/workflows/check-prices.yml` runs `scripts/check-prices.mjs` on GitHub's servers.
2. The script collects prices from two sources:
   - **Best Buy Products API (official, free key).** It finds every RTX 5050–5090 laptop Best Buy lists and reads the current sale price, regular price and online availability. New models show up automatically.
   - **Product pages you list in `tracked.json`** (Lenovo, Dell, HP, B&H, ASUS, MSI, Acer, Newegg and others). The script reads the price the retailer publishes in the page's built-in product data (schema.org / meta tags).
3. It adds new prices to `feed.json` and commits the file to your repository. Unchanged prices are logged at most once a day.
4. The website loads `feed.json` when it opens, again every 15 minutes while it stays open, and whenever you come back to the tab. New prices go into each laptop's history and chart, the watchlist highlights target prices that have been reached, and every card shows when it was last checked.

### Past prices (before you started tracking)

Once per laptop, the checker also looks up archived copies of the product page on the **Wayback Machine** (web.archive.org) from the last 45 days. It reads the price each copy showed and adds it to the history, labeled **Archived price**. The retailer itself is never contacted for this. How much it finds depends on how often archive.org saved that page: popular pages often have several copies, and new or obscure pages may have none. Laptops with nothing archived are retried every few days.

### Amazon

Amazon blocks automated page checks, and its official product API (Creators API) is only open to Amazon affiliates with an approved account and at least 10 qualifying sales in the last 30 days. So Amazon works like this:
- Add the laptop with its Amazon link (`https://www.amazon.com/dp/…`) and log prices with **+**.
- Its details page links to **camelcamelcamel** and **Keepa**, which keep years of Amazon price history for free on their sites.
- The Wayback backfill still runs for Amazon links and recovers whatever archived copies show.

### Browser extension (Amazon, Best Buy and every other store)

Stores block GitHub's servers, but not you. The **RTX Deal Hunter Companion** extension in the `extension` folder records prices from product pages **you open yourself** in Chrome or Edge. It never visits pages on its own, never clicks anything, and only runs on the supported store sites.

What it does:
- Open any RTX 5050–5090 laptop page on **Amazon, Best Buy, B&H, Newegg, Walmart, Dell, HP, Lenovo, Micro Center, Costco, Acer, ASUS or MSI**, and it saves the price, list price, stock status, seller (Amazon) and time.
- A small badge in the corner shows the price and how it changed since you last saw it. Pages that aren't tracked yet get a **Track** button.
- Its toolbar popup lists every laptop with current price, change, lowest seen, a target price, and a link back to the store.
- It sends a desktop notification when a price drops or reaches your target.
- It syncs to `manual.json` in your repository, so the website (charts, history, Black Friday Report) shows these prices on every device. Prices from several computers are merged.

**Install (Chrome or Edge):**
1. Unzip the project on your computer. Keep the `extension` folder somewhere permanent, such as Documents.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** (top right in Chrome, left side in Edge).
4. Click **Load unpacked** and choose the `extension` folder.
5. Pin it: click the puzzle-piece icon in the toolbar, then the pin next to **RTX Deal Hunter Companion**.

**Connect it to your site (optional, recommended):**
1. On GitHub, go to your profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name it `rtx-deal-hunter extension`, set an expiration (for example 90 days), choose **Only select repositories**, and pick `rtx-deal-hunter`.
3. Under **Repository permissions**, set **Contents** to **Read and write**. Leave everything else at No access.
4. Click **Generate token** and copy it.
5. Click the extension icon → **Settings**. Enter your GitHub username, the repository name and the token, then **Save** and **Sync now**.

The token is stored only in this browser's extension storage, and it can only change files in this one repository. To revoke it, delete it on GitHub. Prices sync about 1 minute after they're recorded, and the website shows them once GitHub Pages republishes (1–2 minutes).

**Tips:**
- During Black Friday week, open your watchlist laptops once a day (the website's links and the popup both open the store pages). Each visit records a fresh price.
- Amazon prices can come from third-party sellers. The extension saves the seller name with each price.
- If a store redesigns its pages and a price stops being read, the badge says "no price found". Log it with **+** on the website until the reader is updated.

### Black Friday Report

The **Black Friday Report** page compares each laptop's price 20 days before Black Friday with its lowest price during sale week (Thanksgiving week through Cyber Monday). Before sale week starts, it compares today with 20 days ago. Each laptop gets a verdict: *Real drop*, *Lower, but not the lowest*, *About the same*, *Raised, then "discounted"* (the price went up before the sale), *Higher than before*, or *Not enough history*.

### Rules the checker follows

- It **honors robots.txt**. If a site says automated tools may not read a page, that page is skipped and marked "skipped".
- It goes **slowly**: one product page every 3–5 seconds, a few times a day.
- Stores that refuse 3 times in a row are only retried **once a day**.
- It **never bypasses blocks.** If a retailer refuses automated access (HTTP 403, a CAPTCHA or bot check), it doesn't retry or disguise itself. The laptop is marked **"Auto-check blocked: check manually"**, and you can use *Check at retailer* → *Log price* for that one.
- It never invents a price. If no machine-readable price is found, nothing is recorded.

**What to expect:** Best Buy through the API is reliable. Many big retailers (Amazon, Walmart, Best Buy's website, Newegg) block automated page reads from cloud servers, so expect some of those to show "blocked". Manufacturer stores and B&H work more often. The dashboard's **Automatic price checks** panel shows which sources worked on the last run.

### Price labels

| Label | Meaning |
|---|---|
| **Auto-checked** | Read by the scheduled checker from the Best Buy API or the retailer's own page data |
| **Verified** | You confirmed it yourself on the retailer's page |
| **Unverified** | You logged it from an ad, newsletter, forum or friend |
| **Demo data** | Made-up sample prices. Hidden automatically once real prices arrive |

---

## Setup (about 10 minutes)

### 1. Put the project on GitHub
1. Create a **new public repository** on GitHub, for example `rtx-deal-hunter`.
2. Click **Add file → Upload files**. Drag in **everything inside the project folder**, including the hidden `.github` folder and the `.nojekyll` file. `index.html` must be at the top level.
   - If your computer hides the `.github` folder, use the git commands below, or create the workflow on GitHub instead: **Add file → Create new file**, name it `.github/workflows/check-prices.yml`, and paste in the contents.
3. Click **Commit changes**.

### 2. Turn on the website
**Settings → Pages →** Source *Deploy from a branch*, Branch `main`, folder `/ (root)` → **Save**. After a minute or two the site is at `https://YOUR-USERNAME.github.io/rtx-deal-hunter/`.

### 3. Let the Action save prices
**Settings → Actions → General → Workflow permissions →** choose **Read and write permissions** → **Save**.

### 4. Add your Best Buy API key (recommended)
1. Sign up at **https://developer.bestbuy.com**. Best Buy no longer issues keys to free email addresses such as Gmail or Yahoo, so use a work, school or other non-free address.
2. Copy your key.
3. In the repository: **Settings → Secrets and variables → Actions → New repository secret**. Name it `BESTBUY_API_KEY` and paste the key as the value.

The key stays secret. It is never put in the website or in `feed.json`.

Without a key, the checker still reads the product pages you list in `tracked.json`.

### 5. Run the first check
**Actions** tab → **Check laptop prices** → **Run workflow**. It takes 1–3 minutes. Open the run to see a log of every source and price. Then open your site: the dashboard shows "Last automatic check … ago", and the demo data is hidden automatically.

From then on it runs every 3 hours by itself. You can also press **Run workflow** whenever you want an immediate check, for example on Thanksgiving night.

### Using git instead of uploading
```bash
git init && git add . && git commit -m "RTX Deal Hunter"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rtx-deal-hunter.git
git push -u origin main
```

---

## Tracking specific laptops from other stores

1. In the site, click **Add laptop**, paste the **product page URL** and fill in the specs.
2. Go to **Settings → Automatic price checks → Download tracked.json**. The file keeps your existing settings and adds every laptop of yours that has a URL.
3. In the repository, upload `tracked.json` and replace the old one. Uploading it starts a check right away.

You can also edit `tracked.json` directly on GitHub:

```json
{
  "bestbuy": {
    "enabled": true,
    "gpus": ["5050", "5060", "5070", "5070 Ti", "5080", "5090"],
    "minRamGB": 16,
    "skus": [6575404],
    "maxPages": 2
  },
  "items": [
    {
      "id": "legion-pro-7i-lenovo",
      "name": "Lenovo Legion Pro 7i Gen 10 (RTX 5080, 32GB, 2TB)",
      "url": "https://www.lenovo.com/us/en/p/laptops/legion-laptops/...",
      "retailer": "lenovo",
      "gpu": "RTX 5080", "vram": 16, "tgp": 175,
      "cpu": "Intel Core Ultra 9 275HX",
      "ram": 32, "ramMax": 64, "ramUpgradeable": true,
      "storage": 2048, "storageSlots": 2,
      "displaySize": 16, "displayRes": "QHD", "panel": "OLED", "hz": 240,
      "cooling": 5, "weight": 2.7
    }
  ]
}
```

- `bestbuy.minRamGB`: skip Best Buy listings with less RAM. Set it to 32 to match the tracker's priorities.
- `bestbuy.skus`: extra Best Buy SKUs to always check.
- Only `name`, `url` and `gpu` are required per item. The more specs you give, the better the scores.
- Retailer IDs: `bestbuy, amazon, newegg, dell, lenovo, asus, hp, msi, acer, walmart, microcenter, bh, costco, other`.

**About Best Buy specs:** laptops found through the API get their specs from the listing title (GPU, CPU, RAM, SSD, screen size, refresh rate, panel). TGP, cooling and RAM upgradeability aren't in the title, so those cards show "upgrade unknown" and a note. Open a laptop, click **Edit** and fill those in from reviews. The scores update right away.

**How often it runs:** edit the `cron` line in the workflow file. `17 */3 * * *` means every 3 hours. During the Black Friday week you could use `17 * * * *` (hourly). GitHub may start scheduled runs a few minutes late during busy periods.

---

## Everyday use

- **Dashboard:** Black Friday countdown, automatic check status, top picks, recent price drops, and laptops that need a manual check.
- **My Watchlist:** star laptops and set a **target price**. Each new automatic price is compared against it.
- **Price History:** chart, lowest and highest recorded prices, and today's price compared with the previous check, about a week ago, and the first price recorded.
- **Compare:** up to 4 laptops side by side with all six scores.
- **Manual entry:** for stores that block automated checks, use **+ / Log price**.
- **Back up:** Settings → Export JSON (everything) or CSV (one row per price).

Your watchlist, targets, manual prices and edits are saved in **this browser** (localStorage). Automatic prices are saved in `feed.json` in your repository, so they are the same on every device. Manual entries are not, so use Export/Import to move them.

Keyboard: `/` jumps to search, `Esc` closes dialogs.

---

## How scores work

Nine factors are each rated from 0 to 1, then weighted per workload, giving a total out of 100:

| Factor | Gaming | SOC labs | AI / ML | VMs | Multitask | Everyday |
|---|---|---|---|---|---|---|
| GPU performance (tier, reduced below 175W TGP) | 40 | 4 | 25 | 2 | 5 | 4 |
| GPU VRAM (÷ 24GB) | 10 | 2 | 32 | – | – | – |
| CPU class | 12 | 26 | 8 | 28 | 24 | 16 |
| RAM (installed + upgrade ceiling) | 6 | 30 | 15 | 34 | 30 | 12 |
| Storage (capacity + spare M.2) | 4 | 14 | 8 | 16 | 8 | 10 |
| Cooling (1–5 rating) | 15 | 8 | 8 | 8 | 8 | 10 |
| Display (panel, resolution, Hz) | 10 | 2 | – | – | 13 | 28 |
| Upgradeability | 3 | 14 | 4 | 12 | 7 | 5 |
| Portability (weight) | – | – | – | – | 5 | 15 |

Penalties: −6 for under 32GB RAM in the SOC, VM, AI and multitasking scores, and −3 in gaming when GPU TGP is under 100W. Each laptop's details view shows the points earned for every factor and why. These are estimates for shortlisting, not benchmarks. To change the weights, edit `PROFILES` in `script.js`.

---

## Files

```
├── index.html                         App shell
├── style.css                          Styles (dark + light)
├── script.js                          App logic, scoring, charts
├── feed.json                          Prices written by the Action (starts empty)
├── tracked.json                       What the Action checks
├── scripts/check-prices.mjs           The price checker (Node 20, no packages)
├── .github/workflows/check-prices.yml Schedule for the checker
├── assets/favicon.svg
├── .nojekyll
└── README.md
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard says "Waiting for the first automatic check" | Run the workflow (Setup step 5) and check that it succeeded in the Actions tab. |
| The workflow fails at "Save feed.json" with a permission error | Setup step 3: give Actions read and write permissions. |
| Best Buy shows "API key rejected" | Check the `BESTBUY_API_KEY` secret name and value. New keys can take a little while to activate. |
| A laptop says "Auto-check blocked" | That retailer refuses automated reads. Use *Check at retailer* and log the price by hand. |
| New prices take a few minutes to appear | GitHub Pages redeploys after each commit (1–2 min), and the site reloads the feed every 15 minutes. Press **Refresh** to reload it right away. |
| Opening `index.html` from your computer shows no automatic prices | Browsers block loading `feed.json` from local files. Use the GitHub Pages site, or run `python3 -m http.server` in the folder and open `http://localhost:8000`. |
| Scheduled runs stopped | GitHub pauses schedules in repositories with no activity for 60 days. Open Actions and re-enable the workflow. |

## Testing the checker locally
```bash
BESTBUY_API_KEY=yourkey node scripts/check-prices.mjs
```
It prints every source and price, then updates `feed.json`.

## Privacy and security

- The website has no analytics, cookies or third-party scripts, and a strict Content Security Policy.
- The API key lives only in GitHub Secrets and is hidden in logs.
- Everything loaded or imported is cleaned and HTML-escaped. Only `http(s)` links are allowed.
- CSV exports guard against spreadsheet formula injection.
- Use the price data within each retailer's terms. The Best Buy API is for personal and non-commercial use unless you have a partner agreement.
