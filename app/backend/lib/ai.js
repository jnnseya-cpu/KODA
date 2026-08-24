'use strict';
// KODA AI gateway — the ONE place the app talks to a real LLM.
//
// Auto-detects whichever provider key is configured (Anthropic → OpenAI → Gemini)
// and exposes a single `generate()`. Env-gated: if no key is set it reports
// unavailable and callers fall back to templates WITHOUT charging ACU — so the
// "AI" features are honest (real generation when configured, clearly-labelled
// template preview when not). Uses global fetch (Node >=18) with a hard timeout;
// never throws into a request unless the caller awaits and handles it.
const MODEL_ANTHROPIC = process.env.KODA_AI_MODEL || 'claude-3-5-haiku-latest';
const MODEL_OPENAI    = process.env.KODA_AI_MODEL_OPENAI || 'gpt-4o-mini';
const MODEL_GEMINI    = process.env.KODA_AI_MODEL_GEMINI || 'gemini-1.5-flash';

function provider() {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}
const available = () => provider() !== null;

async function withTimeout(promise, ms, ctrl) {
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await promise; } finally { clearTimeout(t); }
}

// generate({ system, prompt, maxTokens }) -> plain text. Throws on failure so the
// caller can fall back to a template and skip the ACU charge.
async function generate({ system = '', prompt, maxTokens = 900 } = {}) {
  const p = provider();
  if (!p) throw new Error('ai_not_configured');
  if (!prompt) throw new Error('empty_prompt');
  const ctrl = new AbortController();

  if (p === 'anthropic') {
    const res = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL_ANTHROPIC, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
    }), 20000, ctrl);
    if (!res.ok) throw new Error('anthropic_' + res.status);
    const j = await res.json();
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    if (!text) throw new Error('anthropic_empty');
    return text;
  }

  if (p === 'openai') {
    const msgs = system ? [{ role: 'system', content: system }, { role: 'user', content: prompt }] : [{ role: 'user', content: prompt }];
    const res = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: MODEL_OPENAI, max_tokens: maxTokens, messages: msgs }),
    }), 20000, ctrl);
    if (!res.ok) throw new Error('openai_' + res.status);
    const j = await res.json();
    const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').trim();
    if (!text) throw new Error('openai_empty');
    return text;
  }

  // gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_GEMINI}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const body = { contents: [{ role: 'user', parts: [{ text: (system ? system + '\n\n' : '') + prompt }] }], generationConfig: { maxOutputTokens: maxTokens } };
  const res = await withTimeout(fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), 20000, ctrl);
  if (!res.ok) throw new Error('gemini_' + res.status);
  const j = await res.json();
  const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(pt => pt.text).join('').trim();
  if (!text) throw new Error('gemini_empty');
  return text;
}

module.exports = { available, provider, generate };
