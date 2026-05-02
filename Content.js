// content.js — Content Script
// Injected into every page. Extracts readable text only.
// No AI calls. No API key. No external requests.

(function () {
  if (window.__aiSummarizerLoaded) return;
  window.__aiSummarizerLoaded = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "EXTRACT_CONTENT") {
      try {
        const content = extractContent();
        sendResponse({ ok: true, content });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }
  });

  // ── Extraction strategy (priority order) ─────────────
  function extractContent() {
    // 1. Semantic article tag
    const article = best(document.querySelectorAll("article"));
    if (article) return clean(article.innerText);

    // 2. Main content tag
    const main = document.querySelector("main");
    if (main && charLen(main) > 300) return clean(main.innerText);

    // 3. ARIA main landmark
    const ariaMain = document.querySelector('[role="main"]');
    if (ariaMain && charLen(ariaMain) > 300) return clean(ariaMain.innerText);

    // 4. Common CMS content class names
    const cms = [
      ".post-content",
      ".article-content",
      ".entry-content",
      ".story-body",
      ".article-body",
      ".post-body",
      ".content-body",
      "#article-body",
      ".td-post-content",
      ".prose",
      ".rich-text",
    ];
    for (const sel of cms) {
      const el = document.querySelector(sel);
      if (el && charLen(el) > 300) return clean(el.innerText);
    }

    // 5. Heuristic — largest block that isn't chrome furniture
    const candidate = largestContentBlock();
    if (candidate && charLen(candidate) > 300)
      return clean(candidate.innerText);

    // 6. Full body fallback
    return clean(document.body.innerText);
  }

  // Pick the article element with the most text
  function best(els) {
    let winner = null,
      max = 0;
    els.forEach((el) => {
      const n = charLen(el);
      if (n > max) {
        max = n;
        winner = el;
      }
    });
    return max > 300 ? winner : null;
  }

  // Tags and class patterns to skip
  const SKIP_TAGS = new Set([
    "NAV",
    "HEADER",
    "FOOTER",
    "ASIDE",
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "FORM",
  ]);
  const SKIP_PATTERN =
    /nav|menu|sidebar|footer|header|comment|cookie|ad-|banner|popup|modal/i;

  function largestContentBlock() {
    let winner = null,
      max = 0;
    document.querySelectorAll("div, section").forEach((el) => {
      if (SKIP_TAGS.has(el.tagName)) return;
      if (SKIP_PATTERN.test(el.className + " " + (el.id || ""))) return;
      const n = charLen(el);
      if (n > max) {
        max = n;
        winner = el;
      }
    });
    return winner;
  }

  function charLen(el) {
    return (el.innerText || "").trim().length;
  }

  function clean(text) {
    return text
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 15000);
  }
})();
