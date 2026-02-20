/**
 * Dark Pattern Detector v3.0
 * Detects manipulative UX patterns on websites and overlays an analysis panel.
 *
 * v3 fixes over v2:
 *  - All detectors skip our own panel (#__dpd_panel__) — no self-flagging
 *  - Urgency: walkTextNodes() deduplicates at the LEAF level, preventing ancestor
 *    re-traversal from multiplying findings for a single phrase
 *  - Countdowns: requires actual time-like content (00:00 / Xh Ym), not just class names
 *  - Urgency: removed /\bcountdown\b/ word match (covered by dedicated detector)
 *  - Roach Motel: one finding per button, not per ancestor container
 *  - Disguised Ads: minimum 20×20px visible size guard
 *  - New: Social Proof Manipulation detector
 *  - New: Privacy Zuckering detector
 *  - Improved cleanup on close (uses attribute instead of JS property)
 *
 * Usage: Paste into browser console. Run again to toggle panel off.
 */
(function () {
  "use strict";

  // ─── Toggle: remove panel + outlines if already open ─────────────────────
  const prev = document.getElementById("__dpd_panel__");
  if (prev) {
    prev.remove();
    document.querySelectorAll("[data-dpd-marked]").forEach(el => {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.boxShadow = "";
      el.removeAttribute("data-dpd-marked");
      el.removeAttribute("data-dpd");
    });
    return;
  }

  // ─── State ────────────────────────────────────────────────────────────────
  const findings = []; // { category, severity, element, message, excerpt }

  // ─── Severity weights ─────────────────────────────────────────────────────
  const SEVERITY = { critical: 10, high: 6, medium: 3, low: 1 };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Returns true if el is inside our own detector panel */
  function isInPanel(el) {
    return !!el.closest("#__dpd_panel__");
  }

  function getText(el) {
    return (el.innerText || el.textContent || "").trim().toLowerCase();
  }

  function getExcerpt(el, maxLen = 60) {
    const t = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    return t.length > maxLen ? t.slice(0, maxLen) + "…" : t;
  }

  function severityColor(s) {
    return (
      { critical: "#ff2d55", high: "#ff6b00", medium: "#ffd60a", low: "#34c759" }[s] || "#aaa"
    );
  }

  function record(element, category, severity, message) {
    if (element && isInPanel(element)) return; // never flag our own UI
    findings.push({
      category,
      severity,
      element: element || null,
      message,
      excerpt: element ? getExcerpt(element) : "",
    });
    if (element && !element.hasAttribute("data-dpd-marked")) {
      element.setAttribute("data-dpd-marked", "1");
      element.style.outline = `3px solid ${severityColor(severity)}`;
      element.style.outlineOffset = "2px";
      element.setAttribute("data-dpd", message);
    }
  }

  function matchesAny(text, patterns) {
    return patterns.some(p =>
      typeof p === "string" ? text.includes(p) : p.test(text)
    );
  }

  function totalScore() {
    return findings.reduce((acc, f) => acc + SEVERITY[f.severity], 0);
  }

  /**
   * Walk TEXT NODES across the document.
   * KEY FIX: tracks seen parentElements so a single phrase only produces
   * ONE finding even though the tree walker visits it via multiple ancestors.
   */
  function walkTextNodes(patterns, cb) {
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      if (["SCRIPT", "STYLE", "NOSCRIPT", "META"].includes(el.tagName)) continue;
      if (isInPanel(el)) continue;
      const text = (node.textContent || "").toLowerCase().trim();
      if (!text) continue;
      if (patterns.some(p => (typeof p === "string" ? text.includes(p) : p.test(text)))) {
        seen.add(el);
        cb(el, text);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETECTION RULES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 1. PRE-CHECKED BOXES — user enrolled without action
   */
  function detectPreCheckedBoxes() {
    document.querySelectorAll(
      "input[type='checkbox']:checked, input[type='radio']:checked"
    ).forEach(el => {
      if (isInPanel(el)) return;
      const label =
        el.closest("label") ||
        (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
      const context = getText(label || el.parentElement || el);
      const isSub = matchesAny(context, [
        "subscri", "newsletter", "marketing", "partner", "third party", "opt",
      ]);
      record(
        label || el,
        "Forced Continuity",
        isSub ? "critical" : "medium",
        isSub
          ? "Pre-checked opt-in box — user automatically enrolled"
          : "Pre-checked checkbox — verify intent"
      );
    });
  }

  /**
   * 2. URGENCY / SCARCITY — pressure language
   * FIX: uses walkTextNodes for leaf-level dedup.
   *      Removed /\bcountdown\b/ (handled by detectCountdowns).
   */
  function detectUrgency() {
    const URGENCY_PATTERNS = [
      /\blimited[\s-]time\b/,
      /\bonly\s+\d+\s+left\b/,
      /\bhurry[\s!]/,
      /\bact\s+now\b/,
      /\blast\s+chance\b/,
      /\bexpires?\s+in\b/,
      /\bending\s+soon\b/,
      /\bselling\s+fast\b/,
      /\btoday\s+only\b/,
      /\bflash\s+sale\b/,
      /\bdon.?t\s+miss\b/,
      /\bwhile\s+stocks?\s+last\b/,
      /\balmost\s+gone\b/,
    ];
    walkTextNodes(URGENCY_PATTERNS, el => {
      record(el, "Scarcity / Urgency", "high", "Urgency language — may create artificial pressure");
    });
  }

  /**
   * 3. COUNTDOWN TIMERS
   * FIX: only flags elements containing actual time-like content (00:00 or "2h 30m").
   *      Previously matched any element with 'timer' anywhere in its class/id name.
   */
  function detectCountdowns() {
    const sel = [
      "[class*='countdown']", "[class*='timer']",
      "[id*='countdown']",   "[id*='timer']",
      "[data-countdown]",    "[data-timer]",
    ].join(",");

    document.querySelectorAll(sel).forEach(el => {
      if (isInPanel(el) || el.offsetHeight === 0) return;
      const text = (el.textContent || "").trim();
      // Must contain a recognisable timer pattern
      const looksLikeTimer =
        /\d{1,2}:\d{2}/.test(text) ||
        /\d+\s*(hr|hour|min|minute|sec|second)/i.test(text);
      if (looksLikeTimer) {
        record(
          el,
          "Scarcity / Urgency",
          "high",
          "Countdown timer — may fabricate an artificial deadline"
        );
      }
    });
  }

  /**
   * 4. HIDDEN COSTS — fees disclosed only at checkout
   */
  function detectHiddenCosts() {
    const COST_PATTERNS = [
      /\bprocessing\s+fee\b/,
      /\bconvenience\s+fee\b/,
      /\bservice\s+fee\b/,
      /\bbooking\s+fee\b/,
      /\bhandling\s+fee\b/,
      /\bsurcharge\b/,
      /\badded\s+at\s+checkout\b/,
      /\bextra\s+charges?\s+apply\b/,
    ];
    walkTextNodes(COST_PATTERNS, el => {
      record(el, "Hidden Costs", "high", "Fee language found — verify cost transparency");
    });
  }

  /**
   * 5. CONFIRM-SHAMING — guilt-tripping decline copy
   */
  function detectConfirmShaming() {
    const SHAME_PATTERNS = [
      /no,?\s+i\s+don.?t\s+want/i,
      /no\s+thanks,?\s+i\s+(hate|prefer not|don.?t)/i,
      /i\s+don.?t\s+want\s+to\s+save/i,
      /i\s+prefer\s+to\s+pay\s+full/i,
      /no,?\s+i\s+enjoy\s+missing/i,
      /i\s+don.?t\s+want\s+(deals?|discounts?|offers?)/i,
    ];
    document.querySelectorAll("a, button, label").forEach(el => {
      if (isInPanel(el)) return;
      const text = getText(el);
      if (SHAME_PATTERNS.some(p => p.test(text))) {
        record(el, "Confirm-shaming", "high", "Confirm-shaming language on decline option");
      }
    });
  }

  /**
   * 6. ROACH MOTEL — easy sign-up, opaque cancellation
   * FIX: one finding per button element, not per parent container match.
   */
  function detectRoachMotel() {
    const SUBSCRIBE_WORDS = [
      "subscribe", "sign up", "join now", "start free", "get started",
    ];
    const seen = new Set();
    document.querySelectorAll("button, a").forEach(el => {
      if (isInPanel(el) || seen.has(el)) return;
      const text = getText(el);
      if (!matchesAny(text, SUBSCRIBE_WORDS)) return;
      const section =
        el.closest("section, article, form, [class*='plan'], [class*='pricing']") ||
        el.parentElement?.parentElement ||
        document.body;
      const sectionText = getText(section);
      const hasCancel =
        /cancel\s+anytime|easy\s+cancel|no\s+commitment|no\s+contract/.test(sectionText);
      if (!hasCancel) {
        seen.add(el);
        record(
          el,
          "Roach Motel",
          "medium",
          "Subscription CTA with no visible cancellation info nearby"
        );
      }
    });
  }

  /**
   * 7. DISGUISED ADS — unlabeled sponsored content
   * FIX: minimum 20×20 px visible size guard; excludes our panel.
   */
  function detectDisguisedAds() {
    const sel = [
      "[class*='sponsored']",
      "[class*='promoted']",
      "[data-ad-slot]",
      "[data-ad]",
      "ins.adsbygoogle",
    ].join(",");
    document.querySelectorAll(sel).forEach(el => {
      if (isInPanel(el)) return;
      if (el.offsetHeight < 20 || el.offsetWidth < 20) return;
      const text = getText(el);
      if (!/sponsored|advertisement|paid|promoted|\bad\b/.test(text)) {
        record(el, "Disguised Ads", "medium", "Ad/sponsored element with no clear label");
      }
    });
  }

  /**
   * 8. TRICK QUESTIONS — double negatives in form labels
   */
  function detectTrickQuestions() {
    document.querySelectorAll("label").forEach(el => {
      if (isInPanel(el)) return;
      const text = getText(el);
      if (/uncheck.*not|not.*uncheck|deselect.*not|opt.out.*not\s+receive/i.test(text)) {
        record(el, "Trick Questions", "critical", "Double-negative phrasing — very confusing opt-out");
      }
    });
  }

  /**
   * 9. PRICE ANCHORING / STRIKETHROUGH PRICES
   */
  function detectFakePrices() {
    const sel = [
      "s", "del",
      "[class*='original-price']", "[class*='was-price']",
      "[class*='old-price']",      "[class*='list-price']",
      "[class*='strike']",         "[class*='mrp']",
    ].join(",");
    document.querySelectorAll(sel).forEach(el => {
      if (isInPanel(el) || el.offsetHeight === 0) return;
      const text = el.textContent.trim();
      if (/[\$£€₹]\s*[\d,]+|\d{2,}/.test(text)) {
        record(
          el,
          "Price Anchoring",
          "low",
          "Strikethrough price — verify if original price is genuine"
        );
      }
    });
  }

  /**
   * 10. AUTOPLAY MEDIA — unexpected audio/video
   */
  function detectAutoplayMedia() {
    document.querySelectorAll("video[autoplay], audio[autoplay]").forEach(el => {
      if (isInPanel(el)) return;
      const muted = el.hasAttribute("muted");
      record(
        el,
        "Intrusive UX",
        muted ? "low" : "medium",
        muted
          ? "Autoplay muted video"
          : "Autoplay video/audio with sound — disruptive"
      );
    });
  }

  /**
   * 11. INTRUSIVE POPUPS / MODALS
   */
  function detectPopups() {
    const sel = [
      "[role='dialog']",
      "[class*='modal']",
      "[class*='popup']",
      "[class*='lightbox']",
      "[class*='overlay']",
    ].join(",");
    document.querySelectorAll(sel).forEach(el => {
      if (isInPanel(el)) return;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      if (el.offsetHeight < 80) return;
      record(el, "Intrusive UX", "medium", "Modal/popup overlay — may interrupt user flow");
    });
  }

  /**
   * 12. MISLEADING RE-SUBSCRIBE BUTTONS
   */
  function detectMisleadingButtons() {
    document.querySelectorAll("button, input[type='submit'], a[role='button']").forEach(el => {
      if (isInPanel(el)) return;
      const text = getText(el);
      if (/keep\s+me\s+subscribed|yes.*keep|stay\s+subscribed/i.test(text)) {
        record(
          el,
          "Forced Continuity",
          "high",
          "Re-subscribe button disguised on unsubscribe page"
        );
      }
    });
  }

  /**
   * 13. SOCIAL PROOF MANIPULATION — fabricated/unverifiable popularity
   */
  function detectSocialProofManipulation() {
    const SOCIAL_PATTERNS = [
      /\d+\s*(people|users?|customers?|others?)\s+(are\s+)?(viewing|looking at|watching)\s+this/i,
      /\d+\s*k?\+?\s*bought\s+in\s+(past|last)\s+\d*\s*(hour|day|week)/i,
      /only\s+\d+\s+left\s+in\s+stock/i,
      /\d+\s+sold\s+in\s+(the\s+)?last\s+\d+\s+hours?/i,
      /trending\s+now/i,
    ];
    walkTextNodes(SOCIAL_PATTERNS, el => {
      record(
        el,
        "Social Proof Manipulation",
        "medium",
        "Unverifiable popularity signal — may be fabricated"
      );
    });
  }

  /**
   * 14. PRIVACY ZUCKERING — buried consent / data-sharing copy
   */
  function detectPrivacyZuckering() {
    const PRIVACY_PATTERNS = [
      /we\s+may\s+share\s+your\s+(data|information)\s+with\s+(partners?|third)/i,
      /by\s+(continuing|using|clicking).*(you\s+agree|accept)/i,
      /your\s+data\s+helps\s+us\s+(improve|personalise|personalize)/i,
    ];
    walkTextNodes(PRIVACY_PATTERNS, el => {
      const fs = parseFloat(window.getComputedStyle(el).fontSize || "16");
      record(
        el,
        "Privacy Zuckering",
        fs < 12 ? "high" : "medium",
        "Consent / data-sharing language — verify clarity and prominence"
      );
    });
  }

  // ─── Run all detectors ────────────────────────────────────────────────────
  detectPreCheckedBoxes();
  detectUrgency();
  detectCountdowns();
  detectHiddenCosts();
  detectConfirmShaming();
  detectRoachMotel();
  detectDisguisedAds();
  detectTrickQuestions();
  detectFakePrices();
  detectAutoplayMedia();
  detectPopups();
  detectMisleadingButtons();
  detectSocialProofManipulation();
  detectPrivacyZuckering();

  // ─── Compute score + risk level ───────────────────────────────────────────
  const score = totalScore();
  const riskLabel =
    score === 0 ? "Clean"     :
    score < 10  ? "Low Risk"  :
    score < 25  ? "Moderate"  :
    score < 50  ? "High Risk" : "Very High Risk";
  const riskColor =
    score === 0 ? "#34c759" :
    score < 10  ? "#34c759" :
    score < 25  ? "#ffd60a" :
    score < 50  ? "#ff6b00" : "#ff2d55";

  // Group by category
  const grouped = {};
  findings.forEach(f => {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  });

  const categoryIcons = {
    "Forced Continuity":         "🔄",
    "Scarcity / Urgency":        "⏳",
    "Hidden Costs":              "💸",
    "Confirm-shaming":           "😬",
    "Roach Motel":               "🪤",
    "Disguised Ads":             "🎭",
    "Trick Questions":           "❓",
    "Price Anchoring":           "🏷️",
    "Intrusive UX":              "📢",
    "Social Proof Manipulation": "👥",
    "Privacy Zuckering":         "🔏",
  };

  const fillWidth = Math.min((score / 60) * 100, 100);

  // ─── Build panel HTML ─────────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = "__dpd_panel__";

  panel.innerHTML = `
    <style>
      #__dpd_panel__ {
        position: fixed;
        top: 12px;
        right: 12px;
        width: 350px;
        max-height: 88vh;
        background: #0d0d0d;
        color: #e8e8e8;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        font-size: 12px;
        border-radius: 14px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07);
        z-index: 2147483647;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        user-select: none;
      }
      #__dpd_panel__ * { box-sizing: border-box; margin: 0; padding: 0; }

      .__dpd_header__ {
        padding: 14px 16px 12px;
        background: #111;
        border-bottom: 1px solid #222;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        flex-shrink: 0;
      }
      .__dpd_title__ {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #555;
        margin-bottom: 8px;
      }
      .__dpd_score_row__ { display: flex; align-items: center; gap: 12px; }
      .__dpd_score__ {
        font-size: 36px;
        font-weight: 800;
        line-height: 1;
        color: ${riskColor};
        text-shadow: 0 0 20px ${riskColor}55;
      }
      .__dpd_risk__  { font-size: 12px; color: ${riskColor}; font-weight: 700; letter-spacing: 0.5px; }
      .__dpd_count__ { font-size: 10px; color: #555; margin-top: 3px; }

      .__dpd_close__ {
        background: #1e1e1e;
        border: 1px solid #2a2a2a;
        color: #666;
        font-size: 14px;
        cursor: pointer;
        line-height: 1;
        padding: 5px 8px;
        border-radius: 6px;
        flex-shrink: 0;
        transition: background 0.1s, color 0.1s;
      }
      .__dpd_close__:hover { background: #2a2a2a; color: #fff; }

      .__dpd_bar__ { height: 3px; background: #1a1a1a; flex-shrink: 0; }
      .__dpd_bar_fill__ {
        height: 100%;
        background: linear-gradient(90deg, #ff6b00, ${riskColor});
        width: ${fillWidth}%;
        transition: width 1.2s cubic-bezier(0.22,1,0.36,1);
      }

      .__dpd_body__ { overflow-y: auto; flex: 1; padding: 8px 0 4px; }
      .__dpd_body__::-webkit-scrollbar { width: 4px; }
      .__dpd_body__::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }

      .__dpd_cat__ { padding: 4px 14px 2px; }
      .__dpd_cat_header__ {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 7px 2px;
        color: #999;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        border-bottom: 1px solid #1c1c1c;
      }
      .__dpd_cat_badge__ {
        margin-left: auto;
        background: #1e1e1e;
        border: 1px solid #2a2a2a;
        border-radius: 20px;
        padding: 1px 8px;
        font-size: 10px;
        color: #777;
      }
      .__dpd_findings__ { padding: 4px 0 2px; }

      .__dpd_finding__ {
        padding: 8px 10px;
        margin: 3px 0;
        border-radius: 7px;
        background: #111;
        border-left: 3px solid transparent;
        cursor: pointer;
        transition: background 0.12s;
      }
      .__dpd_finding__:hover { background: #191919; }
      .__dpd_finding_msg__ { color: #ccc; line-height: 1.5; margin-bottom: 4px; font-size: 11.5px; }
      .__dpd_finding_excerpt__ {
        color: #444;
        font-size: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .__dpd_sev__ {
        display: inline-block;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        margin-right: 6px;
        vertical-align: middle;
      }

      .__dpd_empty__ {
        padding: 32px 20px;
        text-align: center;
        color: #34c759;
        font-size: 13px;
        line-height: 1.8;
      }
      .__dpd_footer__ {
        padding: 8px 16px;
        border-top: 1px solid #1a1a1a;
        color: #333;
        font-size: 10px;
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
      }
    </style>

    <div class="__dpd_header__">
      <div>
        <div class="__dpd_title__">🕵️ Dark Pattern Detector</div>
        <div class="__dpd_score_row__">
          <div class="__dpd_score__">${score}</div>
          <div>
            <div class="__dpd_risk__">${riskLabel}</div>
            <div class="__dpd_count__">
              ${findings.length} finding${findings.length !== 1 ? "s" : ""}
              &nbsp;·&nbsp;
              ${Object.keys(grouped).length} categor${Object.keys(grouped).length !== 1 ? "ies" : "y"}
            </div>
          </div>
        </div>
      </div>
      <button class="__dpd_close__" id="__dpd_close_btn__">✕</button>
    </div>

    <div class="__dpd_bar__"><div class="__dpd_bar_fill__"></div></div>

    <div class="__dpd_body__" id="__dpd_body__">
      ${
        findings.length === 0
          ? `<div class="__dpd_empty__">
               ✅ No dark patterns detected.<br>
               <span style="color:#2a2a2a;font-size:10px">This page appears clean.</span>
             </div>`
          : Object.entries(grouped).map(([cat, items]) => `
              <div class="__dpd_cat__">
                <div class="__dpd_cat_header__">
                  <span>${categoryIcons[cat] || "⚠️"}</span>
                  <span>${cat}</span>
                  <span class="__dpd_cat_badge__">${items.length}</span>
                </div>
                <div class="__dpd_findings__">
                  ${items.map(f => `
                    <div class="__dpd_finding__"
                         style="border-left-color:${severityColor(f.severity)}"
                         data-idx="${findings.indexOf(f)}">
                      <div class="__dpd_finding_msg__">
                        <span class="__dpd_sev__"
                              style="background:${severityColor(f.severity)}22;
                                     color:${severityColor(f.severity)}">
                          ${f.severity}
                        </span>${f.message}
                      </div>
                      ${f.excerpt
                        ? `<div class="__dpd_finding_excerpt__">"${f.excerpt}"</div>`
                        : ""}
                    </div>
                  `).join("")}
                </div>
              </div>
            `).join("")
      }
    </div>

    <div class="__dpd_footer__">
      <span>Click any finding to scroll to element</span>
      <span>v3.0</span>
    </div>
  `;

  document.body.appendChild(panel);

  // ─── Close ────────────────────────────────────────────────────────────────
  document.getElementById("__dpd_close_btn__").addEventListener("click", () => {
    panel.remove();
    findings.forEach(f => {
      if (!f.element) return;
      f.element.style.outline = "";
      f.element.style.outlineOffset = "";
      f.element.style.boxShadow = "";
      f.element.removeAttribute("data-dpd-marked");
      f.element.removeAttribute("data-dpd");
    });
  });

  // ─── Click row → scroll + pulse ───────────────────────────────────────────
  document.getElementById("__dpd_body__").addEventListener("click", e => {
    const row = e.target.closest(".__dpd_finding__");
    if (!row) return;
    const f = findings[parseInt(row.dataset.idx, 10)];
    if (!f?.element) return;
    f.element.scrollIntoView({ behavior: "smooth", block: "center" });
    const color = severityColor(f.severity);
    f.element.style.outline = `5px solid ${color}`;
    f.element.style.boxShadow = `0 0 18px ${color}88`;
    setTimeout(() => {
      f.element.style.outline = `3px solid ${color}`;
      f.element.style.boxShadow = "";
    }, 1500);
  });

  // ─── Console summary ──────────────────────────────────────────────────────
  console.groupCollapsed(
    `%c[DarkPatternDetector v3] Score: ${score} (${riskLabel}) | ${findings.length} findings`,
    `color:${riskColor};font-weight:bold`
  );
  Object.entries(grouped).forEach(([cat, items]) => {
    console.groupCollapsed(`  ${categoryIcons[cat] || "⚠️"} ${cat} (${items.length})`);
    items.forEach(f => console.log(`  [${f.severity.toUpperCase()}] ${f.message}`, f.element));
    console.groupEnd();
  });
  console.groupEnd();
})();