// ai.js — AI provider module
// Only this file calls the external AI API.
// To swap providers for Stage 4b: edit only this file.

import { GEMINI_API_KEY } from "./config.js";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── Main entry point called by background.js ─────────
export async function summarizePage({ title, content }) {
  const trimmed = content.slice(0, 12000);
  const prompt = buildPrompt(title, trimmed);
  const raw = await callGemini(prompt);
  return parseResponse(raw);
}

// ── Gemini API call ───────────────────────────────────
async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

// ── Prompt ────────────────────────────────────────────
function buildPrompt(title, content) {
  return `You are a precise webpage summarizer. Analyze the content below and respond ONLY with valid JSON — no markdown, no code fences, just raw JSON.

PAGE TITLE: ${title}

CONTENT:
${content}

Return exactly this JSON shape:
{
  "oneLiner": "One sentence, max 20 words",
  "bullets": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "insights": ["insight 1", "insight 2", "insight 3"],
  "readingTime": "X min read",
  "wordCount": 1234
}

Rules:
- bullets: 4–6 key points extracted from the content
- insights: 2–3 deeper observations or takeaways
- readingTime: based on 200 words per minute average
- wordCount: approximate word count of the original text
- No text outside the JSON object`;
}

// ── Parse + validate AI response ──────────────────────
function parseResponse(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const p = JSON.parse(cleaned);
    return {
      oneLiner: typeof p.oneLiner === "string" ? p.oneLiner : "",
      bullets: Array.isArray(p.bullets) ? p.bullets : [],
      insights: Array.isArray(p.insights) ? p.insights : [],
      readingTime: typeof p.readingTime === "string" ? p.readingTime : "—",
      wordCount: typeof p.wordCount === "number" ? p.wordCount : 0,
    };
  } catch {
    // Graceful fallback — return raw as single bullet
    return {
      oneLiner: "",
      bullets: [raw.slice(0, 300)],
      insights: [],
      readingTime: "—",
      wordCount: 0,
    };
  }
}
