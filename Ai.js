// ai.js — AI provider module (Gemini Free Tier)
import { GEMINI_API_KEY } from "./config.js";

// Use Gemma 4 26B — FREE: 1,500 requests/day, actually works
const MODEL = "gemma-4-26b-a4b-it";

// ── Main entry point ─────────────────────────────────
export async function summarizePage({ title, content }) {
  try {
    const trimmed = content.slice(0, 10000);
    const prompt = buildPrompt(title, trimmed);
    const raw = await callGemini(prompt);
    return parseResponse(raw);
  } catch (error) {
    console.error("Summarize error:", error);
    return {
      oneLiner: "Error generating summary",
      bullets: [error.message],
      insights: ["Check API key or network connection"],
      readingTime: "—",
      wordCount: 0,
    };
  }
}

// ── Gemini API call (FIXED) ─────────────────────────
async function callGemini(prompt) {
  // CORRECT URL format
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

// ── Prompt that forces JSON output ───────────────────
function buildPrompt(title, content) {
  return `.

Summarize this webpage as JSON using this EXACT structure:

{
    "oneLiner": "one sentence summary under 20 words",
    "bullets": ["key point 1", "key point 2", "key point 3", "key point 4"],
    "insights": ["insight 1", "insight 2"],
    "readingTime": "2 min read",
    "wordCount": 500
}

Title: ${title}

Content:
${content.substring(0, 8000)}

Output ONLY the JSON object. Start with { and end with }. Do not include any other text.`;
}

// ── Parse JSON response ──────────────────────────────
function parseResponse(raw) {
  try {
    // Clean up common issues
    let cleaned = raw.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");

    // Find the JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const p = JSON.parse(cleaned);

    return {
      oneLiner: p.oneLiner || "Summary of webpage",
      bullets: Array.isArray(p.bullets)
        ? p.bullets.slice(0, 6)
        : ["Key points extracted"],
      insights: Array.isArray(p.insights)
        ? p.insights.slice(0, 3)
        : ["Insights from content"],
      readingTime: p.readingTime || "1 min read",
      wordCount: typeof p.wordCount === "number" ? p.wordCount : 0,
    };
  } catch (e) {
    console.error("JSON parse failed:", e.message);
    console.error("Raw response:", raw.substring(0, 500));

    return {
      oneLiner: "Summary parsing failed",
      bullets: [
        "The AI did not return valid JSON",
        `Raw: ${raw.substring(0, 100)}...`,
      ],
      insights: ["Try again or check API key"],
      readingTime: "—",
      wordCount: 0,
    };
  }
}
