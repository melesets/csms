// AI assistant hook - manages chat messages, streaming, and provider connections
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  askAI,
  isOnline,
  initConnectivityMonitor,
  AIRequestType,
  AIResponse,
  ChatMessage,
  askAIStream,
  generateISBAR,
  ISBARStructure,
  generateReport,
  summarizeISBAR,
  scoreRisk,
  getSuggestions,
  fullAnalysis,
  ISBARSummary,
  ISBARRiskScore,
  ISBARFullAnalysis,
} from '../services/aiService';

export type { ChatMessage, AIResponse, ISBARStructure, ISBARSummary, ISBARRiskScore, ISBARFullAnalysis };

interface UseAIReturn {
  online:  boolean;
  loading: boolean;
  ask: (type: AIRequestType, context: Record<string, any>, history?: ChatMessage[]) => Promise<AIResponse>;
  askStream: (type: AIRequestType, context: Record<string, any>, history: ChatMessage[], onChunk: (text: string, provider?: string) => void) => Promise<void>;
  generateFullISBAR:   (context: Record<string, any>)                    => Promise<ISBARStructure | null>;
  generateFromText:    (rawText: string, partial?: Record<string, any>)  => Promise<Record<string, any> | null>;
  summarize:           (isbarData: Record<string, any>)                  => Promise<ISBARSummary | null>;
  riskScore:           (isbarData: Record<string, any>)                  => Promise<ISBARRiskScore | null>;
  suggest:             (isbarData: Record<string, any>, freeText?: string) => Promise<Record<string, string> | null>;
  analyzeAll:          (isbarData: Record<string, any>)                  => Promise<ISBARFullAnalysis | null>;
}

export function useAI(): UseAIReturn {
  const [online,  setOnline]  = useState<boolean>(isOnline());
  const [loading, setLoading] = useState<boolean>(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cleanupRef.current = initConnectivityMonitor(setOnline);
    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, []);

  const withLoading = useCallback(
    <T>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      return fn().finally(() => setLoading(false));
    },
    [],
  );

  const ask = useCallback(
    (type: AIRequestType, context: Record<string, any>, history: ChatMessage[] = []) =>
      withLoading(async () => {
        const result = await askAI(type, context, history);
        setOnline(result.isOnline);
        return result;
      }),
    [withLoading],
  );

  const askStreamFn = useCallback(
    (type: AIRequestType, context: Record<string, any>, history: ChatMessage[] = [], onChunk: (text: string, provider?: string) => void) =>
      withLoading(() => askAIStream(type, context, history, onChunk)),
    [withLoading],
  );

  const generateFullISBAR = useCallback(
    (context: Record<string, any>) => withLoading(() => generateISBAR(context)),
    [withLoading],
  );

  const generateFromText = useCallback(
    (rawText: string, partial?: Record<string, any>) => withLoading(() => generateReport(rawText, partial)),
    [withLoading],
  );

  const summarize = useCallback(
    (isbarData: Record<string, any>) => withLoading(() => summarizeISBAR(isbarData)),
    [withLoading],
  );

  const riskScore = useCallback(
    (isbarData: Record<string, any>) => withLoading(() => scoreRisk(isbarData)),
    [withLoading],
  );

  const suggest = useCallback(
    (isbarData: Record<string, any>, freeText?: string) => withLoading(() => getSuggestions(isbarData, freeText)),
    [withLoading],
  );

  const analyzeAll = useCallback(
    (isbarData: Record<string, any>) => withLoading(() => fullAnalysis(isbarData)),
    [withLoading],
  );

  return {
    online,
    loading,
    ask,
    askStream: askStreamFn,
    generateFullISBAR,
    generateFromText,
    summarize,
    riskScore,
    suggest,
    analyzeAll,
  };
}
