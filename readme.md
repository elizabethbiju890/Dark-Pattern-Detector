<p align="center">
  <img src="./img.png" alt="Project Banner" width="100%">
</p>

# Dark Pattern Detector 🕵️

## Basic Details

### Team Name: Code_Blooded_21

### Team Members
- Member 1: Alena Thankam Ullas - Mar Baselios College of Engineering
- Member 2: Elizabeth Biju - Mar Baselios College of Engineering

### Hosted Project Link
[Add your GitHub Pages / hosted link here]

### Project Description
A Chrome browser extension that automatically scans any webpage and detects manipulative UX design patterns (dark patterns) used by websites to deceive or pressure users. It highlights flagged elements directly on the page with color-coded outlines and stores findings in a persistent cross-site database dashboard.

### The Problem Statement
Detection and Prevention of Dark Patterns in Web Interfaces — websites use deceptive design techniques like fake urgency, hidden costs, pre-checked opt-ins, and guilt-tripping copy to manipulate users into unintended actions.

### The Solution
A lightweight browser extension that injects a detection engine into every webpage, runs 13 independent pattern-matching algorithms, scores the page by severity, visually highlights only the most manipulative elements, and logs all findings to a searchable database so users can track which sites are the worst offenders over time.

---

## Technical Details

### Technologies/Components Used

**For Software:**
- Languages used: JavaScript (ES6+), HTML5, CSS3
- Frameworks used: None (Vanilla JS)
- Libraries used: Chrome Extension APIs (Manifest V3) — storage, tabs, scripting, activeTab
- Tools used: VS Code, Git, Chrome DevTools

---

## Features

- Feature 1: **13-Rule Detection Engine** — Detects pre-checked opt-in boxes, urgency badges, countdown timers, hidden fees, confirm-shaming, roach motel subscribe buttons, disguised ads, trick questions, fake strikethrough prices, autoplay media, intrusive popups, social proof manipulation, and privacy zuckering.
- Feature 2: **Smart Highlighting** — Only critical and high severity findings get visual outlines on the page (orange/red). Medium and low findings are logged in the panel only, so the page doesn't look over-flagged.
- Feature 3: **Weighted Risk Scoring** — Every finding is scored by severity (Critical=10, High=6, Medium=3, Low=1) and summed into a risk tier: Clean / Low / Moderate / High / Very High Risk.
- Feature 4: **Persistent Cross-Site Database** — Every scan is saved to chrome.storage. The database dashboard (database.html) tracks all scanned sites, avg/peak scores, pattern breakdowns, and a full scan history with search and filter.
- Feature 5: **Popup Summary** — Clicking the extension icon shows the current page's risk score, findings count, and top detected categories. Includes a Scan Page button and a link to the full database.
- Feature 6: **False Positive Prevention** — Leaf-level text-node deduplication, navigation/filter element exclusion, and content-length guards ensure normal UI elements like filter checkboxes and nav links are never flagged.

---

## Implementation

### For Software:

#### Installation
```bash
# 1. Clone or download this repository
git clone https://github.com/your-username/dark-pattern-database

# 2. Open Chrome and navigate to:
chrome://extensions

# 3. Enable Developer Mode (toggle, top right)

# 4. Click "Load unpacked" and select the dark-pattern-database folder

# 5. The 🕵️ icon will appear in your Chrome toolbar
```

#### Run
```bash
# No build step needed — pure JS extension

# To use:
# 1. Visit any website (e.g. amazon.in, booking.com, a checkout page)
# 2. Click the 🕵️ Dark Pattern Detector icon in the toolbar
# 3. Click "Scan Page" — a floating panel appears on the page
# 4. Click any finding to scroll to and highlight the element
# 5. Click "📊 DB" to open the full database dashboard
# 6. Click the icon again to dismiss the panel
```

---

## Project Documentation

### For Software:

#### Screenshots (Add at least 3)

![Screenshot1](screenshots/scan-amazon.png)
*Detector panel showing score 15 (Moderate) on Amazon.in deals page — "Limited time deal" badges highlighted in orange*

![Screenshot2](screenshots/database-dashboard.png)
*Database dashboard showing tracked sites, risk scores, pattern breakdown bar charts, and recent scan history*

![Screenshot3](screenshots/popup.png)
*Extension popup showing current page risk score, finding count, and quick access to the database*

#### Diagrams

**System Architecture:**

![Architecture Diagram](docs/architecture.png)
*User visits page → content.js injected → 13 detectors run → findings scored and deduplicated → panel rendered + data saved to chrome.storage → database.html reads storage for cross-site tracking*

**Application Workflow:**

![Workflow](docs/workflow.png)
*Click extension icon → popup.js queries active tab + storage → user clicks Scan Page → scripting API injects content.js → DOM analysed → panel overlaid on page → findings stored → database auto-updates*

---

## Detection Engine — All 13 Rules

| # | Pattern | Severity | What It Catches |
|---|---------|----------|-----------------|
| 1 | Pre-checked Boxes | Critical | Subscription/marketing opt-in checkboxes checked by default |
| 2 | Urgency Language | High | "Limited time deal", "act now", "almost gone" on badge elements |
| 3 | Countdown Timers | High | Visible timers with actual time content (00:00, Xh Ym) |
| 4 | Hidden Costs | High | Processing fee, convenience fee, surcharge, "added at checkout" |
| 5 | Confirm-shaming | High | "No thanks, I hate saving money" style decline copy |
| 6 | Roach Motel | Medium | Subscribe buttons with no cancellation info visible nearby |
| 7 | Disguised Ads | Medium | Sponsored elements with no clear "Sponsored" label |
| 8 | Trick Questions | Critical | Double-negative opt-out phrasing e.g. "Uncheck to not receive" |
| 9 | Price Anchoring | Low | Strikethrough MRP/original prices — highlighted only if 50%+ off claimed |
| 10 | Autoplay Media | Medium | Autoplay video/audio with sound |
| 11 | Intrusive Popups | Medium | Visible modals/dialogs interrupting page flow |
| 12 | Social Proof Manipulation | Medium | "5K+ bought in past month", "Only 3 left in stock" |
| 13 | Privacy Zuckering | High/Medium | Buried consent copy — High if font < 12px |

---

## Scoring System

| Severity | Points |
|----------|--------|
| Critical | 10 |
| High | 6 |
| Medium | 3 |
| Low | 1 |

| Risk Tier | Score Range |
|-----------|-------------|
| Clean | 0 |
| Low Risk | 1–9 |
| Moderate | 10–24 |
| High Risk | 25–49 |
| Very High Risk | 50+ |

---

## Project Demo

### Video
https://youtu.be/V0Nnt17v7_Q

*Demonstrates scanning amazon.in/deals — extension detects "Limited time deal" urgency badges, MRP strikethrough prices, and "Subscribe & Save" roach motel pattern. Shows database dashboard updating in real time.*

### Additional Demos
[GitHub repo link] | [Chrome Extension ZIP download]

---

## AI Tools Used

**Tool Used:** Chat GPT, Geminie, Claude (Anthropic)

**Purpose:** Full-stack code generation, iterative debugging, false positive diagnosis

- Built the 13-rule detection engine from scratch with regex pattern matching
- Diagnosed and fixed false positive bug where "Limited time deal" was generating 200+ findings due to ancestor node re-traversal — fixed with leaf-level deduplication
- Designed the database.html dashboard UI with site tracking, bar charts, search/filter
- Built popup.html and popup.js for the toolbar interface
- Iteratively tuned highlighting logic so only critical/high findings get page outlines

**Percentage of AI-generated code:** ~85%

**Human Contributions:**
- Problem framing and dark pattern taxonomy research
- Real-world testing on Amazon.in, Flipkart, booking sites
- Identifying false positives from live screenshots and iterating on fixes
- Chrome extension setup, manifest configuration, and debugging
- Presentation and documentation

---

## Team Contributions

- Alena Thankam Ullas: Chrome extension architecture, manifest setup, content script integration, popup UI, live site testing, bug identification and reporting
- Elizabeth Biju: Dark pattern research and taxonomy, detection rule design, CSS styling, database dashboard testing, documentation and README

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
