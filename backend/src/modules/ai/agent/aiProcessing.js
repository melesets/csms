// =============================================================================
// |Adare AI AGENT — AI Processing Layer
// =============================================================================
// Orchestrates AI calls with the modular pipeline. Uses the provider registry
// from aiProviders.js and prompt templates from promptTemplates.js.
// =============================================================================

import { callAI, callAIJson, callGeminiContents, callGeminiStream } from '../aiProviders.js';
import { getTemplate } from './promptTemplates.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

/**
 * Process a request through the AI pipeline.
 *
 * @param {string} templateId - Prompt template to use
 * @param {object} ctx        - Normalized context data
 * @param {object} opts       - { stream: bool, jsonMode: bool, maxTokens, temperature }
 * @returns {object|ReadableStream} AI response
 */
export async function processAI(templateId, ctx = {}, opts = {}) {
  const prompt = getTemplate(templateId, ctx);
  const { stream = false, jsonMode = false, maxTokens = 2048, temperature = 0.3 } = opts;

  // ── Attachment path: use Gemini multimodal ──────────────────────────────
  const attachments = ctx.attachments;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (hasAttachments && !stream) {
    return processWithAttachments(templateId, ctx, opts);
  }

  // ── Streaming path ───────────────────────────────────────────────────────
  if (stream) {
    return processStream(templateId, ctx, opts);
  }

  // ── Standard (non-streaming) path ───────────────────────────────────────
  if (jsonMode) {
    const messages = buildMessages(templateId, ctx);
    const result = await callAIJson(messages, SYSTEM_PROMPT, { temperature, maxTokens, jsonMode: true });
    return { text: null, json: result.json, provider: result.provider };
  }

  const messages = buildMessages(templateId, ctx);
  const result = await callAI(messages, SYSTEM_PROMPT, { temperature, maxTokens });
  return { text: result.text, provider: result.provider };
}

/**
 * Process with attachments using Gemini multimodal.
 */
async function processWithAttachments(templateId, ctx, opts) {
  const { maxTokens = 3072, temperature = 0.3 } = opts;
  const prompt = getTemplate(templateId, ctx);
  const geminiContents = [];

  // Add chat history if present
  if (Array.isArray(ctx.chatHistory)) {
    ctx.chatHistory.forEach(m => {
      geminiContents.push({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.text }] });
    });
  }

  // Build parts: attachments + prompt
  const parts = [...attachmentsToGeminiParts(ctx.attachments), { text: prompt }];
  geminiContents.push({ role: 'user', parts });

  const text = await callGeminiContents('gemini-flash-latest', geminiContents, SYSTEM_PROMPT, {
    temperature,
    maxTokens,
  });

  return { text, provider: 'Gemini Flash (Vision)' };
}

/**
 * Process with streaming (Gemini SSE).
 */
async function processStream(templateId, ctx, opts) {
  const { maxTokens = 3072, temperature = 0.4 } = opts;
  const prompt = getTemplate(templateId, ctx);
  const geminiContents = [];

  if (Array.isArray(ctx.chatHistory)) {
    ctx.chatHistory.forEach(m => {
      geminiContents.push({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.text }] });
    });
  }

  const hasAttachments = Array.isArray(ctx.attachments) && ctx.attachments.length > 0;
  const parts = hasAttachments
    ? [...attachmentsToGeminiParts(ctx.attachments), { text: prompt }]
    : [{ text: prompt }];

  geminiContents.push({ role: 'user', parts });

  const streamResult = await callGeminiStream(geminiContents, SYSTEM_PROMPT, {
    temperature,
    maxTokens,
  });

  // Return stream info — the route handler will process SSE events
  return streamResult;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMessages(templateId, ctx) {
  const prompt = getTemplate(templateId, ctx);

  if (templateId === 'chat' && Array.isArray(ctx.chatHistory) && ctx.chatHistory.length > 0) {
    const msgs = ctx.chatHistory.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));
    msgs.push({ role: 'user', content: prompt });
    return msgs;
  }

  return [{ role: 'user', content: prompt }];
}

function extractBase64FromDataUrl(dataUrl = '') {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

function attachmentsToGeminiParts(attachments = []) {
  const parts = [];
  if (!Array.isArray(attachments)) return parts;

  for (const a of attachments) {
    const kind = String(a?.kind || '').toLowerCase();
    const name = String(a?.name || 'attachment');

    if (kind === 'text') {
      const text = String(a?.text || '').slice(0, 50_000);
      if (text.trim().length > 0) {
        parts.push({ text: `[ATTACHED TEXT FILE: ${name}]\n${text}` });
      }
      continue;
    }

    if (kind === 'image') {
      const parsed = extractBase64FromDataUrl(a?.dataUrl);
      if (parsed?.data) {
        parts.push({ text: `[ATTACHED IMAGE: ${name}]` });
        parts.push({ inlineData: { mimeType: parsed.mimeType || a?.mimeType || 'image/png', data: parsed.data } });
      }
      continue;
    }

    if (kind === 'file') {
      const parsed = extractBase64FromDataUrl(a?.dataUrl);
      if (parsed?.data) {
        parts.push({ text: `[ATTACHED FILE: ${name}]` });
        parts.push({ inlineData: { mimeType: parsed.mimeType || a?.mimeType || 'application/octet-stream', data: parsed.data } });
      }
    }
  }

  return parts;
}

function attachmentsToTextBlock(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  const chunks = [];
  for (const a of attachments) {
    const kind = String(a?.kind || '').toLowerCase();
    const name = String(a?.name || 'attachment');
    if (kind === 'text') {
      const text = String(a?.text || '').slice(0, 50_000);
      if (text.trim().length > 0) chunks.push(`[ATTACHED TEXT FILE: ${name}]\n${text}`);
    } else if (kind === 'image') {
      chunks.push(`[ATTACHED IMAGE: ${name}] (Image provided — requires Gemini vision-capable provider to interpret.)`);
    } else if (kind === 'file') {
      chunks.push(`[ATTACHED FILE: ${name}] (Binary file provided — requires Gemini multimodal support to interpret.)`);
    }
  }
  return chunks.length > 0 ? `\n\n[ATTACHMENTS]\n${chunks.join('\n\n')}` : '';
}

export { attachmentsToGeminiParts, attachmentsToTextBlock, extractBase64FromDataUrl };
