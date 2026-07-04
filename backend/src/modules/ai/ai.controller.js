// AI controller - handles all AI assistant endpoints (chat, analyze, generate, stream)

import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  chatPipeline,
  chatStreamPipeline,
  handoverSummarizePipeline,
  handoverAnalyzePipeline,
  reportGeneratePipeline,
  auditAnalyzePipeline,
  clinicalRiskPipeline,
  isbarPipeline,
  dbQueryPipeline,
  listAgentTemplates,
} from './agent/agentPipeline.js';
import { listProviders } from './aiProviders.js';

export const getProviders = (req, res) => {
  res.json({
    providers: listProviders(),
    templates: listAgentTemplates(),
    agent: '|Adare AI Agent v2.0',
    architecture: 'Ingestion → Validation → DB Context → AI Processing → Reporting',
  });
};

export const handoverAnalyze = asyncHandler(async (req, res) => {
  const result = await handoverAnalyzePipeline(req.body);
  res.json(result);
});

export const handoverSummarize = asyncHandler(async (req, res) => {
  const result = await handoverSummarizePipeline(req.body);
  res.json(result);
});

export const reportGenerate = asyncHandler(async (req, res) => {
  const result = await reportGeneratePipeline(req.body);
  res.json(result);
});

export const auditAnalyze = asyncHandler(async (req, res) => {
  const result = await auditAnalyzePipeline(req.body);
  res.json(result);
});

export const chat = asyncHandler(async (req, res) => {
  const { type = 'chat', context = {}, history = [] } = req.body;
  if (type === 'chat') {
    const result = await chatPipeline({ ...context, history });
    return res.json(result);
  }
  const result = await isbarPipeline(type, { ...context, history });
  res.json(result);
});

export const stream = asyncHandler(async (req, res) => {
  const { type = 'chat', context = {}, history = [] } = req.body;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const streamResult = await chatStreamPipeline({ ...context, history });
    if (streamResult.ok && streamResult.body) {
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      for await (const chunk of streamResult.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const raw = trimmed.replace(/^data: /, '');
          if (raw === '[DONE]') continue;
          try {
            const obj = JSON.parse(raw);
            const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) res.write(`data: ${JSON.stringify({ text, provider: streamResult.provider })}\n\n`);
          } catch {}
        }
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    const fallback = await chatPipeline({ ...context, history });
    res.write(`data: ${JSON.stringify({ text: fallback.text, provider: fallback.provider })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Stream error: ' + err.message })}\n\n`);
    res.end();
  }
});

export const generateForm = asyncHandler(async (req, res) => {
  const { context = {} } = req.body;
  const result = await isbarPipeline('generate-full-isbar', context);
  try {
    const json = JSON.parse(result.text);
    if (!json || Object.keys(json).length === 0) return res.status(500).json({ error: 'AI returned empty response.' });
    res.json({ ...json, _provider: result.provider });
  } catch {
    res.status(500).json({ error: 'Failed to parse AI JSON response' });
  }
});

export const generateReport = asyncHandler(async (req, res) => {
  const { rawText, partialFields } = req.body;
  if (!rawText) return res.status(400).json({ error: 'rawText is required' });
  const result = await chatPipeline({
    message: `Convert this raw clinical note into structured ISBAR JSON.\n\nRAW TEXT:\n${rawText}\n\n${partialFields ? `PRE-FILLED FIELDS:\n${JSON.stringify(partialFields, null, 2)}\n` : ''}Return ONLY valid JSON with: patientName, age, mrn, bedNumber, department, stability, situation, background, assessment, recommendation, temperature, heartRate, bloodPressure, respiratoryRate, oxygenSaturation`,
  });
  res.json({ text: result.text, isAIGenerated: true, provider: result.provider });
});

export const summarize = asyncHandler(async (req, res) => {
  const { isbarData } = req.body;
  if (!isbarData) return res.status(400).json({ error: 'isbarData is required' });
  const result = await handoverAnalyzePipeline({ handoverData: isbarData });
  res.json(result);
});

export const riskScore = asyncHandler(async (req, res) => {
  const { isbarData } = req.body;
  if (!isbarData) return res.status(400).json({ error: 'isbarData is required' });
  const result = await clinicalRiskPipeline({ handoverData: isbarData });
  res.json(result);
});

export const suggestions = asyncHandler(async (req, res) => {
  const { isbarData, freeText } = req.body;
  if (!isbarData) return res.status(400).json({ error: 'isbarData is required' });
  const result = await chatPipeline({
    message: `Review this partial ISBAR and suggest improved text for incomplete fields.\n\nDATA:\n${JSON.stringify(isbarData, null, 2)}\n${freeText ? `\nADDITIONAL CONTEXT: ${freeText}` : ''}\n\nReturn ONLY valid JSON. Keys = ISBAR field names. Values = suggested improved text. Only include fields that are empty or need improvement.`,
  });
  res.json({ text: result.text, isAIGenerated: true, provider: result.provider });
});

export const fullAnalysis = asyncHandler(async (req, res) => {
  const { isbarData } = req.body;
  if (!isbarData) return res.status(400).json({ error: 'isbarData is required' });
  const result = await handoverAnalyzePipeline({ handoverData: isbarData });
  res.json(result);
});

export const dbQuery = asyncHandler(async (req, res) => {
  const { sql, params = [] } = req.body;
  if (!sql || typeof sql !== 'string') return res.status(400).json({ error: 'sql query string is required' });
  const result = await dbQueryPipeline(sql, params);
  res.json(result);
});
