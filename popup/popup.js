// popup.js — Popup UI controller
// Talks to background.js via chrome.runtime.sendMessage
// Talks to content.js  via chrome.tabs.sendMessage
// Never touches the API key

'use strict'

// ── DOM ───────────────────────────────────────────────
const el = id => document.getElementById(id)

const summarizeBtn = el('summarizeBtn')
const clearBtn     = el('clearBtn')
const retryBtn     = el('retryBtn')
const themeBtn     = el('themeBtn')
const copyBtn      = el('copyBtn')

const pageTitleEl  = el('pageTitle')
const pageUrlEl    = el('pageUrl')
const loadingEl    = el('loading')
const errorEl      = el('error')
const errorTextEl  = el('errorText')
const summaryEl    = el('summary')
const emptyStateEl = el('emptyState')
const oneLinerEl   = el('oneLiner')
const bulletListEl = el('bulletList')
const insightListEl= el('insightList')
const readingTimeEl= el('readingTime')
const wordCountEl  = el('wordCount')
const cacheNoteEl  = el('cacheNote')

// ── State ─────────────────────────────────────────────
let currentTab  = null
let lastSummary = null

// ── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await restoreTheme()
  await loadTab()
})

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return
  currentTab = tab
  pageTitleEl.textContent = tab.title || 'Untitled page'
  pageTitleEl.title       = tab.title || ''
  pageUrlEl.textContent   = tab.url   || ''
  pageUrlEl.title         = tab.url   || ''
}

// ── Summarize ─────────────────────────────────────────
summarizeBtn.addEventListener('click', runSummarize)
retryBtn.addEventListener('click',    runSummarize)

async function runSummarize() {
  if (!currentTab) return

  showState('loading')

  try {
    // Step 1 — extract page text via content script
    const extracted = await extractFromPage(currentTab.id)
    if (!extracted.ok) throw new Error(extracted.error || 'Could not read this page.')

    // Step 2 — send to background for AI call
    const res = await chrome.runtime.sendMessage({
      type:    'SUMMARIZE',
      payload: {
        url:     currentTab.url,
        title:   currentTab.title || '',
        content: extracted.content,
      },
    })

    if (!res.ok) throw new Error(res.error || 'Summarization failed.')

    lastSummary = res.data
    renderSummary(res.data)

  } catch (err) {
    showError(err.message)
  }
}

// ── Extract content from page ─────────────────────────
function extractFromPage(tabId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' }, res => {
      if (chrome.runtime.lastError) {
        // Script not yet injected — inject then retry
        chrome.scripting.executeScript(
          { target: { tabId }, files: ['content.js'] },
          () => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: 'Cannot access this page. Try a regular article.' })
              return
            }
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' }, r =>
                resolve(r || { ok: false, error: 'No response from page.' })
              )
            }, 250)
          }
        )
      } else {
        resolve(res || { ok: false, error: 'No response from page.' })
      }
    })
  })
}

// ── Render summary ────────────────────────────────────
function renderSummary(data) {
  // One-liner
  if (data.oneLiner) {
    oneLinerEl.textContent = sanitize(data.oneLiner)
    oneLinerEl.classList.remove('hidden')
  } else {
    oneLinerEl.classList.add('hidden')
  }

  // Meta
  readingTimeEl.textContent = data.readingTime || '—'
  wordCountEl.textContent   = data.wordCount
    ? Number(data.wordCount).toLocaleString() + ' words'
    : '—'

  // Bullets
  bulletListEl.innerHTML = ''
  ;(data.bullets || []).forEach(point => {
    const li = document.createElement('li')
    li.textContent = sanitize(point)
    bulletListEl.appendChild(li)
  })

  // Insights
  insightListEl.innerHTML = ''
  ;(data.insights || []).forEach(insight => {
    const li = document.createElement('li')
    li.textContent = sanitize(insight)
    insightListEl.appendChild(li)
  })

  // Cache note
  cacheNoteEl.classList.toggle('hidden', !data.fromCache)

  showState('summary')
}

// ── Clear ─────────────────────────────────────────────
clearBtn.addEventListener('click', async () => {
  if (currentTab?.url) {
    await chrome.runtime.sendMessage({
      type:    'CLEAR_CACHE',
      payload: { url: currentTab.url },
    })
  }
  lastSummary = null
  showState('empty')
})

// ── Copy ──────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!lastSummary) return
  const text = buildCopyText(lastSummary)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copyBtn.textContent = '✓ Copied!'
  copyBtn.classList.add('copied')
  setTimeout(() => {
    copyBtn.innerHTML = '<span aria-hidden="true">📋</span> Copy'
    copyBtn.classList.remove('copied')
  }, 2000)
})

function buildCopyText(d) {
  const out = []
  if (d.oneLiner) out.push(d.oneLiner, '')
  if (d.bullets?.length)  { out.push('Key Points:');  d.bullets.forEach(b  => out.push(`• ${b}`));  out.push('') }
  if (d.insights?.length) { out.push('Insights:');    d.insights.forEach(i => out.push(`• ${i}`));  out.push('') }
  out.push(`Reading time: ${d.readingTime}`)
  return out.join('\n')
}

// ── Theme ─────────────────────────────────────────────
async function restoreTheme() {
  const { theme } = await chrome.storage.local.get('theme')
  applyTheme(theme || 'light')
}

themeBtn.addEventListener('click', async () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  await chrome.storage.local.set({ theme: next })
})

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  themeBtn.textContent = t === 'dark' ? '☀️' : '🌙'
  themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')
}

// ── State machine ──────────────────────────────────────
function showState(state) {
  loadingEl.classList.add('hidden')
  errorEl.classList.add('hidden')
  summaryEl.classList.add('hidden')
  emptyStateEl.classList.add('hidden')
  summarizeBtn.disabled = false

  if (state === 'loading') {
    loadingEl.classList.remove('hidden')
    summarizeBtn.disabled = true
  } else if (state === 'error') {
    errorEl.classList.remove('hidden')
  } else if (state === 'summary') {
    summaryEl.classList.remove('hidden')
  } else {
    emptyStateEl.classList.remove('hidden')
  }
}

function showError(msg) {
  errorTextEl.textContent = msg
  showState('error')
}

// ── XSS prevention — all AI output via textContent only
function sanitize(str) {
  const d = document.createElement('div')
  d.textContent = String(str)
  return d.textContent
}