// AI provider registry - manages multiple LLM providers with failover
//
// =============================================================================
//
// HOW IT WORKS
// ─────────────
// The system tries each provider in the PROVIDERS array from top to bottom.
// The first enabled, healthy provider is used. If it fails (rate limit, quota,
// network error), the next one is tried automatically — no manual intervention.
//
// HOW TO ADD A NEW PROVIDER
// ──────────────────────────
// 1. Write a call function (or reuse callOpenAICompat for any OpenAI-compatible API)
// 2. Add an entry to the PROVIDERS array below
// 3. Add the required env vars to your .env (see .env.example)
// 4. Done — restart the server
//
// PROVIDER TYPES SUPPORTED
// ─────────────────────────
// • Local (Ollama, LM Studio, Jan AI, llama.cpp server, text-generation-webui)
// • Google Gemini (Flash, Pro, Lite)
// • OpenAI (GPT-4o, GPT-4o Mini, etc.)
// • Any OpenAI-compatible API (Groq, Together AI, Anyscale, Mistral, etc.)
// =============================================================================

const env = process.env;

// ── Gemini base URL ────────────────────────────────────────────────────────────
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// =============================================================================
// LOW-LEVEL CALL FUNCTIONS
// =============================================================================

/**
 * callOpenAICompat
 * ─────────────────
 * Universal caller for any OpenAI-compatible API.
 * Works with: OpenAI, Ollama, LM Studio, Jan AI, Groq, Mistral, Together AI,
 *             llama.cpp server, text-generation-webui, LocalAI, etc.
 *
 * @param {string}      baseUrl  - e.g. "http://localhost:11434" or "https://api.openai.com"
 * @param {string}      model    - model name, e.g. "llama3.2" or "gpt-4o-mini"
 * @param {string|null} apiKey   - Bearer token; pass null for keyless local servers
 * @param {Array}       messages - [{ role: 'system'|'user'|'assistant', content: string }]
 * @param {object}      opts     - { maxTokens, temperature, jsonMode }
 */
async function callOpenAICompat(baseUrl, model, apiKey, messages, opts = {}) {
  const { maxTokens = 512, temperature = 0.3, jsonMode = false } = opts;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(jsonMode && { response_format: { type: 'json_object' } }),
  };

  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const res  = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err  = new Error(`${model} @ ${baseUrl} → HTTP ${res.status}: ${text.slice(0, 100)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * callGemini
 * ──────────
 * Calls Google Gemini using its native generateContent API.
 * Converts the canonical messages array to Gemini's contents format internally.
 *
 * @param {string} model    - e.g. "gemini-2.0-flash", "gemini-1.5-pro"
 * @param {Array}  messages - canonical [{ role, content }] array
 * @param {string} systemPrompt
 * @param {object} opts     - { maxTokens, temperature, jsonMode }
 */
async function callGemini(model, messages, systemPrompt, opts = {}) {
  const { maxTokens = 512, temperature = 0.3, jsonMode = false } = opts;

  if (!env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY not set');
    err.status = 503;
    throw err;
  }

  // Convert canonical messages → Gemini contents format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(jsonMode && { responseMimeType: 'application/json' }),
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err  = new Error(`Gemini ${model} → HTTP ${res.status}: ${text.slice(0, 100)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * callGeminiContents
 * ─────────────────
 * Calls Gemini using a pre-built `contents` array.
 * This supports multimodal parts (e.g. inlineData images) for vision use cases.
 *
 * @param {string} model
 * @param {Array}  contents - Gemini-native contents array
 * @param {string} systemPrompt
 * @param {object} opts     - { maxTokens, temperature, jsonMode }
 */
export async function callGeminiContents(model, contents, systemPrompt, opts = {}) {
  const { maxTokens = 512, temperature = 0.3, jsonMode = false } = opts;

  if (!env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY not set');
    err.status = 503;
    throw err;
  }

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(jsonMode && { responseMimeType: 'application/json' }),
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Gemini ${model} → HTTP ${res.status}: ${text.slice(0, 100)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================
//
// ORDER MATTERS — providers are tried top-to-bottom.
// Recommended order: local → free cloud → paid cloud
//
// Each provider object:
//   id:       unique string identifier (used in logs and UI)
//   label:    human-readable name shown in the chat panel
//   enabled:  function returning boolean — false = skip this provider
//   call:     async function(messages, systemPrompt, opts) => string (the AI reply)
//             messages = canonical [{ role: 'user'|'assistant', content }] array
//             DO NOT include the system prompt in messages — pass it separately
// =============================================================================

export const PROVIDERS = [

  // ── LOCAL PROVIDERS ─────────────────────────────────────────────────────────
  // These run on your own machine — no internet, no API costs, full privacy.
  // Models are downloaded once and run locally.

  {
    // Ollama — https://ollama.com
    // Install: winget install Ollama.Ollama  (or download from site)
    // Start:   ollama serve
    // Models:  ollama pull llama3.2   (or mistral, phi4, gemma3, qwen2.5, etc.)
    // Enable:  set OLLAMA_ENABLED=true in .env
    id:      'ollama',
    label:   `Ollama · ${env.OLLAMA_MODEL || 'llama3.2'} (Local)`,
    enabled: () => env.OLLAMA_ENABLED === 'true',
    call: (msgs, sys, opts) => callOpenAICompat(
      env.OLLAMA_BASE_URL || 'http://localhost:11434',
      env.OLLAMA_MODEL    || 'llama3.2',
      null,                             // no API key needed for local
      [{ role: 'system', content: sys }, ...msgs],
      opts,
    ),
  },

  {
    // LM Studio — https://lmstudio.ai
    // Install: download from site, load a model, enable "Local Server" in the app
    // Enable:  set LMSTUDIO_ENABLED=true in .env
    id:      'lmstudio',
    label:   `LM Studio · ${env.LMSTUDIO_MODEL || 'local-model'} (Local)`,
    enabled: () => env.LMSTUDIO_ENABLED === 'true',
    call: (msgs, sys, opts) => callOpenAICompat(
      env.LMSTUDIO_BASE_URL || 'http://localhost:1234',
      env.LMSTUDIO_MODEL    || 'local-model',
      null,
      [{ role: 'system', content: sys }, ...msgs],
      opts,
    ),
  },

  {
    // Jan AI — https://jan.ai
    // Install: download from site, load a model, enable "Local API Server"
    // Enable:  set JANAI_ENABLED=true in .env
    id:      'janai',
    label:   `Jan AI · ${env.JANAI_MODEL || 'local-model'} (Local)`,
    enabled: () => env.JANAI_ENABLED === 'true',
    call: (msgs, sys, opts) => callOpenAICompat(
      env.JANAI_BASE_URL || 'http://localhost:1337',
      env.JANAI_MODEL    || 'mistral-ins-7b-q4',
      null,
      [{ role: 'system', content: sys }, ...msgs],
      opts,
    ),
  },

  {
    // llama.cpp server — https://github.com/ggerganov/llama.cpp
    // Start: ./server -m model.gguf --port 8080
    // Enable: set LLAMACPP_ENABLED=true in .env
    id:      'llamacpp',
    label:   'llama.cpp (Local)',
    enabled: () => env.LLAMACPP_ENABLED === 'true',
    call: (msgs, sys, opts) => callOpenAICompat(
      env.LLAMACPP_BASE_URL || 'http://localhost:8080',
      env.LLAMACPP_MODEL    || 'default',
      null,
      [{ role: 'system', content: sys }, ...msgs],
      opts,
    ),
  },

  // ── FREE CLOUD PROVIDERS ─────────────────────────────────────────────────────
  // These are free (with rate limits). Get a key and add it to .env.

  {
    // Google Gemini 1.5 Flash — stable, well-supported, generous free tier
    // 'gemini-1.5-flash-latest' is the most reliable alias in the v1beta API
    // Key: https://aistudio.google.com/app/apikey (free)
    id:      'gemini-flash',
    label:   'Gemini Flash',
    enabled: () => !!env.GEMINI_API_KEY,
    call: (msgs, sys, opts) => callGemini('gemini-flash-latest', msgs, sys, opts),
  },

  {
    // Google Gemini 2.0 Flash — newer model, try as secondary
    id:      'gemini-2flash',
    label:   'Gemini 2.5 Flash',
    enabled: () => !!env.GEMINI_API_KEY,
    call: (msgs, sys, opts) => callGemini('gemini-2.5-flash', msgs, sys, opts),
  },

  {
    // Google Gemini 1.5 Pro — larger model, more reasoning (use -latest suffix for v1beta)
    id:      'gemini-pro',
    label:   'Gemini Pro',
    enabled: () => !!env.GEMINI_API_KEY,
    call: (msgs, sys, opts) => callGemini('gemini-pro-latest', msgs, sys, opts),
  },

  {
    // Google Gemini Flash Lite — lightest model, high quota
    id:      'gemini-lite',
    label:   'Gemini Flash Lite',
    enabled: () => !!env.GEMINI_API_KEY,
    call: (msgs, sys, opts) => callGemini('gemini-flash-lite-latest', msgs, sys, opts),
  },

  {
    // Groq — extremely fast inference, free tier available
    // Key: https://console.groq.com (free)
    // Models: llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it
    id:      'groq',
    label:   `Groq · ${env.GROQ_MODEL || 'llama-3.3-70b-versatile'} |Adare`,
    enabled: () => !!env.GROQ_API_KEY,
    call: (msgs, sys, opts) => callOpenAICompat(
      'https://api.groq.com/openai',
      env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      env.GROQ_API_KEY,
      [{ role: 'system', content: sys }, ...msgs],
      opts,
    ),
  },

  // ── PAID CLOUD PROVIDERS ─────────────────────────────────────────────────────
  // These are best-quality but have per-token costs.

  {
    // OpenAI GPT-4o Mini — cost-effective, high quality
    // Key: https://platform.openai.com/api-keys
    id:      'openai',
    label:   `OpenAI · ${env.OPENAI_MODEL || 'gpt-4o-mini'}`,
    enabled: () => !!env.OPENAI_API_KEY,
    call: (msgs, sys, opts) => callOpenAICompat(
      'https://api.openai.com',
      env.OPENAI_MODEL || 'gpt-4o-mini',
      env.OPENAI_API_KEY,
      [{ role: 'system', content: sys }, ...msgs],
      opts,
    ),
  },

  {
    // Mistral AI — European, GDPR-friendly, strong multilingual
    // Key: https://console.mistral.ai (free trial)
    id:      'mistral',
    label:   `Mistral · ${env.MISTRAL_MODEL || 'mistral-small-latest'}`,
    enabled: () => !!env.MISTRAL_API_KEY,
    call: (msgs, sys, opts) => callOpenAICompat(
      'https://api.mistral.ai',
      env.MISTRAL_MODEL || 'mistral-small-latest',
      env.MISTRAL_API_KEY,
      [{ role: 'system', content: sys }, ...msgs],
      opts,
    ),
  },

  // ── TEMPLATE — add your own provider here ────────────────────────────────────
  // {
  //   id:      'my-provider',
  //   label:   'My Custom Provider',
  //   enabled: () => !!env.MY_PROVIDER_API_KEY,
  //   call: (msgs, sys, opts) => callOpenAICompat(
  //     env.MY_PROVIDER_BASE_URL || 'https://api.example.com',
  //     env.MY_PROVIDER_MODEL    || 'my-model',
  //     env.MY_PROVIDER_API_KEY,
  //     [{ role: 'system', content: sys }, ...msgs],
  //     opts,
  //   ),
  // },

];

// =============================================================================
// ORCHESTRATOR — used by aiAssistant.js
// =============================================================================

/**
 * callAI
 * ───────
 * Tries each enabled provider in order. Falls back to the next on any error.
 * Returns { text, provider } — provider is the label shown in the UI.
 *
 * @param {Array}  messages    - canonical [{ role, content }] messages
 * @param {string} systemPrompt
 * @param {object} opts        - { maxTokens, temperature, jsonMode }
 */
export async function callAI(messages, systemPrompt, opts = {}) {
  const enabled = PROVIDERS.filter(p => p.enabled());

  if (enabled.length === 0) {
    throw new Error(
      'No AI providers are configured. Add at least one API key to .env, ' +
      'or set OLLAMA_ENABLED=true and run Ollama locally.',
    );
  }

  for (const provider of enabled) {
    try {
      console.log(`[AI] → Trying: ${provider.label}`);
      const text = await provider.call(messages, systemPrompt, opts);
      console.log(`[AI] ✅ Success: ${provider.label}`);
      return { text, provider: provider.label };
    } catch (err) {
      console.warn(`[AI] ⚠️  ${provider.label} failed (HTTP ${err.status ?? '?'}): ${err.message?.slice(0, 80)}`);
      // Always try the next provider regardless of error type
    }
  }

  throw new Error(
    `All ${enabled.length} provider(s) failed. Check server logs for details.`,
  );
}

/**
 * callAIJson
 * ───────────
 * Same as callAI but parses and returns a JSON object.
 * Strips markdown code fences if the model wraps its output in them.
 */
export async function callAIJson(messages, systemPrompt, opts = {}) {
  const { text, provider } = await callAI(messages, systemPrompt, {
    ...opts,
    jsonMode: true,
    maxTokens: opts.maxTokens ?? 1024,
  });

  let clean = text.trim();
  // Strip ```json ... ``` fences some models add even in JSON mode
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    return { json: JSON.parse(clean), provider };
  } catch {
    throw new Error(`JSON parse failed from ${provider}. Raw: ${clean.slice(0, 120)}`);
  }
}

/**
 * callGeminiStream
 * ─────────────────
 * Dedicated streaming function using Gemini's SSE endpoint.
 * Returns { ok: bool, body: ReadableStream | null, provider: string }
 * so the route handler can process the SSE events directly.
 */
export async function callGeminiStream(contents, systemPrompt, opts = {}) {
  const { temperature = 0.4, maxTokens = 1024 } = opts;
  if (!env.GEMINI_API_KEY) return { ok: false, body: null, provider: '' };

  const model = 'gemini-flash-latest'; // stable alias — works reliably in v1beta
  const url   = `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });
    return { ok: res.ok, body: res.ok ? res.body : null, provider: 'Gemini 1.5 Flash' };
  } catch {
    return { ok: false, body: null, provider: '' };
  }
}

/**
 * listProviders
 * ──────────────
 * Returns a summary of all providers and their current status.
 * Useful for the /api/ai/providers debug endpoint.
 */
export function listProviders() {
  return PROVIDERS.map(p => ({
    id:      p.id,
    label:   p.label,
    enabled: p.enabled(),
    status:  p.enabled() ? 'available' : 'disabled (no key/flag)',
  }));
}
