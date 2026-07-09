// AI Patient Dashboard - Real AI-powered clinical intelligence
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain,
  Send,
  RefreshCw,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Target,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AiInsight {
  type: 'pattern' | 'concern' | 'improvement' | 'action_needed';
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  patients: string[];
  reasoning: string;
}

interface InsightsResponse {
  summary: string;
  insights: AiInsight[];
}

export const AIPatientDashboard: React.FC = () => {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeView, setActiveView] = useState<'insights' | 'chat'>('insights');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch('/api/ai/patients/insights');
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      }
    } catch (err) {
      console.error('Failed to fetch insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim(), timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/patients/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text || 'No response generated.',
          timestamp: new Date(),
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Analysis service unavailable. Please try again.',
          timestamp: new Date(),
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please check if the backend is running.',
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'concern': return <AlertTriangle className="w-4 h-4" />;
      case 'improvement': return <TrendingUp className="w-4 h-4" />;
      case 'action_needed': return <Target className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getInsightStyle = (type: string, priority: string) => {
    if (priority === 'high') return 'border-red-200 bg-red-50/60';
    if (type === 'concern') return 'border-amber-200 bg-amber-50/40';
    if (type === 'improvement') return 'border-green-200 bg-green-50/40';
    if (type === 'action_needed') return 'border-orange-200 bg-orange-50/40';
    return 'border-blue-200 bg-blue-50/40';
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const suggestedQuestions = [
    'Which patient needs the most urgent attention right now?',
    'Compare the two most critical patients',
    'What vitals should I monitor closely this shift?',
    'Any patients likely to improve soon?',
    'Summarize all patients in 3 sentences',
  ];

  return (
    <div className="space-y-5">
      {/* View Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveView('insights')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-semibold transition-all flex-1 justify-center ${
            activeView === 'insights' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          AI Insights
        </button>
        <button
          onClick={() => setActiveView('chat')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-semibold transition-all flex-1 justify-center ${
            activeView === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Clinical Q&A
        </button>
      </div>

      {/* AI Insights View */}
      {activeView === 'insights' && (
        <div className="space-y-4">
          {/* Refresh Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {insights?.summary ? 'AI analysis complete' : 'Loading analysis...'}
            </div>
            <button
              onClick={fetchInsights}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
              Refresh Analysis
            </button>
          </div>

          {/* AI Summary */}
          {insights?.summary && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ward Status Overview</h3>
                  <p className="text-sm text-gray-800 leading-relaxed">{insights.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {insightsLoading && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">AI is analyzing patient data...</p>
                <p className="text-xs text-indigo-600">Reading vitals, detecting patterns, generating clinical insights</p>
              </div>
            </div>
          )}

          {/* Insights List */}
          {insights?.insights && insights.insights.length > 0 ? (
            <div className="space-y-3">
              {insights.insights.map((insight, idx) => (
                <div key={idx} className={`bg-white border rounded-xl p-4 ${getInsightStyle(insight.type, insight.priority)}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      insight.priority === 'high' ? 'bg-red-100 text-red-600' :
                      insight.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getPriorityBadge(insight.priority)}`}>
                          {insight.priority}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {insight.type.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">{insight.title}</h4>
                      <p className="text-xs text-gray-700 leading-relaxed mb-2">{insight.detail}</p>
                      {insight.reasoning && (
                        <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">AI Reasoning</p>
                          <p className="text-[11px] text-gray-600 leading-relaxed">{insight.reasoning}</p>
                        </div>
                      )}
                      {insight.patients && insight.patients.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {insight.patients.map((name, pi) => (
                            <span key={pi} className="inline-flex items-center px-2 py-0.5 bg-white rounded-full text-[10px] font-semibold text-gray-600 border border-gray-200">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !insightsLoading && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No AI insights available</p>
              <p className="text-xs text-gray-400 mt-1">Click Refresh Analysis to generate clinical insights</p>
            </div>
          )}
        </div>
      )}

      {/* Clinical Q&A Chat View */}
      {activeView === 'chat' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '500px' }}>
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 bg-gray-50">
            <Brain className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Clinical AI Assistant</p>
              <p className="text-[10px] text-gray-500">Powered by Llama 3.3 · Ask anything about your patients</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Brain className="w-10 h-10 text-indigo-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500 mb-1">Ask me about your patients</p>
                <p className="text-xs text-gray-400 mb-4">I have access to all patient data, vitals, and clinical history</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setChatInput(q)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-medium hover:bg-indigo-100 transition-colors border border-indigo-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#003153] text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Brain className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">AI</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/50' : 'text-gray-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">AI</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                placeholder="Ask about patients, vitals, trends..."
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={chatLoading}
              />
              <button
                onClick={handleChat}
                disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2.5 bg-[#003153] text-white rounded-xl hover:bg-[#004a7a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
