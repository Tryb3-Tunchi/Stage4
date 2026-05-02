# AI Page Summarizer — Chrome Extension

A Manifest V3 Chrome Extension that extracts content from any webpage and uses **Google Gemini 1.5 Flash** to generate a structured summary with bullet points, key insights, estimated reading time, and word count.

---

## Features

- ⚡ One-click page summarization
- ◆ Bullet-point key points (4–6 per page)
- 💡 AI-generated deeper insights
- ⏱ Estimated reading time
- 📄 Word count
- 🔄 30-minute summary cache per URL — no duplicate API calls
- 📋 Copy summary to clipboard
- 🌙 Dark / light mode toggle (persisted)
- ♿ Keyboard accessible with visible focus states
- 🔐 API key isolated in background service worker only

---

## Local Installation

This extension is **not published to the Chrome Web Store**. Install it locally in 4 steps.

### Step 1 — Get your free Gemini API key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the generated key

### Step 2 — Configure the extension

1. Clone or download this repository
2. In the project root, copy the example config:
   ```bash
   cp config.example.js config.js
   ```
3. Open `config.js` and paste your API key:
   ```js
   export const GEMINI_API_KEY = "your-actual-key-here";
   ```

### Step 3 — Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder (the one containing `manifest.json`)
5. The extension icon appears in your Chrome toolbar

### Step 4 — Use it

1. Navigate to any article, blog post, or news page
2. Click the extension icon in the toolbar
3. Click **Summarize Page**
4. Your AI summary appears in seconds

---

## File Structure

```
chrome-extension/
├── manifest.json          ← MV3 config, permissions, entry points
├── background.js          ← Service worker: message router, caching
├── ai.js                  ← AI provider module (Gemini calls live here)
├── content.js             ← Injected into pages: content extraction only
├── config.js              ← YOUR API KEY — gitignored, never committed
├── config.example.js      ← Safe template — committed to repo
├── .gitignore             ← Ensures config.js is never committed
├── popup/
│   ├── popup.html         ← Extension popup markup
│   ├── popup.js           ← UI logic, messaging, state management
│   └── popup.css          ← Styles, dark/light mode
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Webpage (any URL)                                   │
│                                                      │
│  content.js                                          │
│  • Injected at document_idle                         │
│  • Extracts readable text via priority heuristics    │
│    article → main → [role=main] → CMS classes        │
│    → largest div → body fallback                     │
│  • Responds to EXTRACT_CONTENT messages only         │
│  • Zero API access. Zero secrets.                    │
└───────────────────┬──────────────────────────────────┘
                    │  chrome.tabs.sendMessage
                    ▼
┌──────────────────────────────────────────────────────┐
│  popup.js (Extension Popup)                          │
│                                                      │
│  • Renders UI (title, button, loading, summary)      │
│  • Requests content from content.js                  │
│  • Forwards payload to background.js                 │
│  • Renders structured response                       │
│  • Handles dark/light mode, copy, clear              │
│  • Zero API access. Zero secrets.                    │
└───────────────────┬──────────────────────────────────┘
                    │  chrome.runtime.sendMessage
                    ▼
┌──────────────────────────────────────────────────────┐
│  background.js (Service Worker)                      │
│                                                      │
│  • Message router (switch on message.type)           │
│  • Checks chrome.storage.local cache first           │
│  • Delegates AI call to ai.js                        │
│  • Caches result for 30 minutes                      │
│  • Returns structured summary to popup               │
└───────────────────┬──────────────────────────────────┘
                    │  calls
                    ▼
┌──────────────────────────────────────────────────────┐
│  ai.js (AI Provider Module)                          │
│                                                      │
│  • Only file with API key access                     │
│  • Builds structured prompt                          │
│  • Calls Gemini 1.5 Flash via fetch                  │
│  • Validates and parses JSON response                │
│  • Graceful fallback if parsing fails                │
└───────────────────┬──────────────────────────────────┘
                    │  HTTPS fetch
                    ▼
             Google Gemini API
```

---

## AI Integration

| Property      | Value                                            |
| ------------- | ------------------------------------------------ |
| Provider      | Google Gemini                                    |
| Model         | `gemini-1.5-flash`                               |
| Why Gemini    | Free tier, fast, reliable structured output      |
| Content limit | 12,000 chars sent to API (~3,000 tokens)         |
| Temperature   | 0.3 — low for consistent, factual summaries      |
| Output format | Strict JSON prompt, validated on parse           |
| Fallback      | Raw text returned as single bullet if JSON fails |

---

## Security Decisions

| Decision                         | Reason                                               |
| -------------------------------- | ---------------------------------------------------- |
| API key in `config.js` only      | Isolated from all page-facing scripts                |
| `config.js` in `.gitignore`      | Key never reaches version control                    |
| `config.example.js` committed    | Others know the expected config shape                |
| `ai.js` isolated module          | Single responsibility; only file needing key access  |
| Content script has no API access | Principle of least privilege                         |
| Popup has no API access          | Key cannot be extracted via devtools on popup        |
| All AI output via `textContent`  | Prevents XSS — never uses `innerHTML` for AI data    |
| `host_permissions` scoped        | Only `generativelanguage.googleapis.com` whitelisted |
| Input trimmed to 12k chars       | Prevents oversized requests and cost spikes          |

---

## Modular Design (Stage 4b Ready)

The codebase is intentionally modular for easy extension:

- **Add a new AI action** → add a `case` in `background.js` message router
- **Swap AI provider** → edit `ai.js` only, nothing else changes
- **Add new UI features** → extend `popup.html` + `popup.js`
- **Add settings page** → new `options.html` + declare in `manifest.json`

---

## Trade-offs and Limitations

- **Local key storage** — For a published extension a proxy server would be the correct approach. Acceptable for a local extension per the task spec.
- **Heuristic extraction** — Content extraction is heuristic-based. May be imperfect on SPAs, paywalled content, or heavily JS-rendered pages.
- **chrome.storage cache** — Cleared when browser data is wiped. Not persistent across reinstalls.
- **Gemini only** — Swapping to OpenAI requires editing the URL and request format in `ai.js` only.

---

## Demo Video

[Add your 2–5 minute demo video link here]
