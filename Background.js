// background.js — Service Worker / Message Router
// Receives messages from popup, coordinates ai.js and storage.
// API key never leaves this module boundary.

import { summarizePage } from './ai.js'

const CACHE_PREFIX = 'summary_'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ── Message router ────────────────────────────────────
// To add new features in Stage 4b: add a new case here
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {

    case 'SUMMARIZE':
      handleSummarize(message.payload)
        .then(result  => sendResponse({ ok: true,  data: result }))
        .catch(error  => sendResponse({ ok: false, error: error.message }))
      return true // keep channel open for async

    case 'CLEAR_CACHE':
      clearCache(message.payload.url)
        .then(()    => sendResponse({ ok: true }))
        .catch(err  => sendResponse({ ok: false, error: err.message }))
      return true

    default:
      sendResponse({ ok: false, error: `Unknown message type: ${message.type}` })
  }
})

// ── Summarize handler ─────────────────────────────────
async function handleSummarize({ url, title, content }) {
  if (!content || content.trim().length < 50) {
    throw new Error('Not enough content found on this page to summarize.')
  }

  // Return cached result if fresh
  const cached = await getCache(url)
  if (cached) return { ...cached, fromCache: true }

  // Call AI (all provider logic lives in ai.js)
  const summary = await summarizePage({ title, content })

  // Persist to cache
  await setCache(url, summary)

  return { ...summary, fromCache: false }
}

// ── Cache helpers ─────────────────────────────────────
function cacheKey(url) {
  return CACHE_PREFIX + btoa(encodeURIComponent(url)).slice(0, 80)
}

async function getCache(url) {
  const key    = cacheKey(url)
  const result = await chrome.storage.local.get(key)
  const entry  = result[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key)
    return null
  }
  return entry.data
}

async function setCache(url, data) {
  const key = cacheKey(url)
  await chrome.storage.local.set({ [key]: { data, ts: Date.now() } })
}

async function clearCache(url) {
  await chrome.storage.local.remove(cacheKey(url))
}