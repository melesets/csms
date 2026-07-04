// Floating AI chat panel - draggable, expandable, with markdown rendering and file attachments
// Integrates with useAI hook for streaming responses and screen context
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Wifi, WifiOff, Paperclip, Image as ImageIcon,
  User, Loader2, FileText, RotateCcw, File,
  Sparkles, Zap, BarChart3, Shield, Database, HeartPulse, Maximize2, Minimize2,
} from 'lucide-react';
import { useAI, ChatMessage } from '../../hooks/useAI';
import { useScreenContext } from '../../contexts/ScreenContext';
import styles from './AIAssistantPanel.module.css';

function newId() { return `msg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`; }

const QUICK_ACTIONS = [
  { icon: HeartPulse, label: 'Analyze Handover', prompt: 'Analyze the current handover data for completeness and clinical risk' },
  { icon: Database, label: 'Query Database', prompt: 'Show me a summary of the hospital database — patients, staff, and resources' },
  { icon: BarChart3, label: 'Department Report', prompt: 'Generate a department performance report' },
  { icon: Shield, label: 'Clinical Risk', prompt: 'Assess clinical risk for the current patient data' },
];

function renderInline(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return null;
  const codeParts = text.split(/`([^`]+)`/g);
  const withCode = codeParts.map((part, j) => {
    if (j % 2 === 1) {
      return (
        <code key={`${keyPrefix}-code-${j}`} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[11px] font-mono border border-indigo-100">
          {part}
        </code>
      );
    }
    const biParts = part.split(/(\*\*\*.*?\*\*\*|___.*?___)/g);
    return biParts.map((biPart, k) => {
      if (/^\*\*\*.*\*\*\*$|^___.*___$/.test(biPart)) {
        return <strong key={`${keyPrefix}-bi-${k}`}><em>{biPart.slice(3, -3)}</em></strong>;
      }
      const bParts = biPart.split(/(\*\*.*?\*\*)/g);
      return bParts.map((bPart, m) => {
        if (/^\*\*.*\*\*$/.test(bPart)) {
          return <strong key={`${keyPrefix}-b-${m}`}>{bPart.slice(2, -2)}</strong>;
        }
        const iParts = bPart.split(/(\*[^*]+\*|_[^_]+_)/g);
        return iParts.map((iPart, n) => {
          if (/^\*.*\*$/.test(iPart) && iPart.length > 2) {
            return <em key={`${keyPrefix}-i-${n}`}>{iPart.slice(1, -1)}</em>;
          }
          if (/^_.*_$/.test(iPart) && iPart.length > 2) {
            return <em key={`${keyPrefix}-iu-${n}`}>{iPart.slice(1, -1)}</em>;
          }
          const linkParts = iPart.split(/(\[.*?\]\(.*?\))/g);
          return linkParts.map((lPart, p) => {
            const linkMatch = lPart.match(/^\[(.+?)\]\((.+?)\)$/);
            if (linkMatch) {
              return (
                <a key={`${keyPrefix}-link-${p}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-600 underline hover:text-indigo-800 text-xs">
                  {linkMatch[1]}
                </a>
              );
            }
            return <span key={`${keyPrefix}-txt-${p}`}>{lPart}</span>;
          });
        });
      });
    });
  });
  return <>{withCode}</>;
}

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { elements.push(<div key={`sp-${blockKey++}`} className="h-1" />); i++; continue; }
    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) { elements.push(<hr key={`hr-${blockKey++}`} className="my-2 border-gray-200" />); i++; continue; }
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++;
      elements.push(
        <div key={`code-${blockKey++}`} className="my-2 rounded-lg overflow-hidden border border-gray-200">
          {lang && <div className="px-3 py-1 bg-gray-100 text-[10px] text-gray-500 font-medium uppercase tracking-wider">{lang}</div>}
          <pre className="p-3 bg-gray-50 overflow-x-auto text-[11px] font-mono text-gray-800 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { quoteLines.push(lines[i].trim().slice(1).trim()); i++; }
      elements.push(
        <blockquote key={`bq-${blockKey++}`} className="my-2 pl-3 border-l-3 border-gray-300 bg-gray-50 rounded-r-md py-2 text-xs text-gray-600 italic">
          {renderInline(quoteLines.join(' '), `bq-${blockKey}`)}
        </blockquote>
      );
      continue;
    }
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().split('|').map(c => c.trim()).filter(Boolean);
        tableRows.push(cells);
        i++;
      }
      const dataRows = tableRows.filter(row => !row.every(c => /^[-:]+$/.test(c)));
      if (dataRows.length > 0) {
        elements.push(
          <div key={`tbl-${blockKey++}`} className="my-2 overflow-x-auto">
            <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
              <thead><tr className="bg-gray-100">{dataRows[0].map((cell, ci) => (
                <th key={ci} className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b border-gray-200">{cell}</th>
              ))}</tr></thead>
              <tbody>{dataRows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>{row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1.5 text-gray-800 border-b border-gray-100">{renderInline(cell, `td-${blockKey}-${ri}-${ci}`)}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = ['text-lg', 'text-base', 'text-sm', 'text-xs', 'text-[11px]', 'text-[10px]'];
      const margins = ['mb-2 mt-3', 'mb-1.5 mt-2', 'mb-1 mt-1.5', 'mb-0.5 mt-1', 'mb-0.5', 'mb-0.5'];
      elements.push(
        <div key={`h-${blockKey++}`} className={`${sizes[level - 1]} font-bold text-gray-900 ${margins[level - 1]}`}>
          {renderInline(headingMatch[2], `h-${blockKey}`)}
        </div>
      );
      i++; continue;
    }
    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && (/^[-*]\s/.test(lines[i].trim()) || (lines[i].trim() && !lines[i].trim().startsWith('-') && !lines[i].trim().startsWith('*') && items.length > 0 && /^\s/.test(lines[i])))) {
        if (/^[-*]\s/.test(lines[i].trim())) { items.push(lines[i].trim().slice(2)); } else { items[items.length - 1] += ' ' + lines[i].trim(); }
        i++;
      }
      elements.push(
        <ul key={`ul-${blockKey++}`} className="my-1.5 ml-3 space-y-0.5 list-disc list-inside text-xs text-gray-800">
          {items.map((item, li) => (<li key={li}>{renderInline(item, `li-${blockKey}-${li}`)}</li>))}
        </ul>
      );
      continue;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && (/^\d+\.\s/.test(lines[i].trim()) || (lines[i].trim() && !/^\d+\.\s/.test(lines[i].trim()) && items.length > 0 && /^\s/.test(lines[i])))) {
        if (/^\d+\.\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s/, '')); } else { items[items.length - 1] += ' ' + lines[i].trim(); }
        i++;
      }
      elements.push(
        <ol key={`ol-${blockKey++}`} className="my-1.5 ml-3 space-y-0.5 list-decimal list-inside text-xs text-gray-800">
          {items.map((item, li) => (<li key={li}>{renderInline(item, `oli-${blockKey}-${li}`)}</li>))}
        </ol>
      );
      continue;
    }
    elements.push(<p key={`p-${blockKey++}`} className="text-xs text-gray-800 leading-relaxed my-1">{renderInline(line, `p-${blockKey}`)}</p>);
    i++;
  }
  return <>{elements}</>;
}

export const AIAssistantPanel: React.FC = () => {
  const { online, loading, askStream } = useAI();
  const { getScreenTitle, getScreenData, getScreenFields } = useScreenContext();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [hasOpened, setHasOpened] = useState(false);
  const [activeProvider, setProvider] = useState<string>('|Adare AI');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  type Attachment = { id: string; kind: 'image' | 'text' | 'file'; name: string; mimeType: string; dataUrl?: string; text?: string; size: number; };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; dragging: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobileSheet = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 420px)').matches;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      if (!hasOpened) {
        setHasOpened(true);
        setMessages([{
          id: newId(), role: 'ai',
          text: online
            ? "Hi! I'm |Adare, your AI agent for Adare General Hospital. I can autonomously analyze patient records, generate handovers, query the database, assess clinical risk, and answer any medical question. What would you like me to do?"
            : "Hi! I'm |Adare, your AI agent for Adare General Hospital. Currently operating in offline mode.",
          isAIGenerated: online, timestamp: new Date(),
        }]);
      }
    }
  }, [open, hasOpened, online]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ai_assistant_panel_pos');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') setPanelPos({ x: parsed.x, y: parsed.y });
    } catch {}
  }, []);

  const clampPanelPos = useCallback((pos: { x: number; y: number }) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 400; const h = rect?.height ?? 600; const margin = 8;
    return {
      x: Math.min(Math.max(pos.x, margin), Math.max(margin, window.innerWidth - w - margin)),
      y: Math.min(Math.max(pos.y, margin), Math.max(margin, window.innerHeight - h - margin)),
    };
  }, []);

  useEffect(() => {
    const onResize = () => { if (!panelPos) return; setPanelPos(prev => prev ? clampPanelPos(prev) : prev); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [panelPos, clampPanelPos]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || !d.dragging) return;
      setPanelPos(clampPanelPos({ x: d.originX + (e.clientX - d.startX), y: d.originY + (e.clientY - d.startY) }));
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d || !d.dragging) return;
      dragRef.current = { ...d, dragging: false };
      setIsDragging(false);
      try { if (panelPos) localStorage.setItem('ai_assistant_panel_pos', JSON.stringify(panelPos)); } catch {}
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [panelPos, clampPanelPos]);

  const beginDrag = (e: React.PointerEvent) => {
    if (isMobileSheet || !open) return;
    const rect = panelRef.current?.getBoundingClientRect();
    const origin = panelPos ?? { x: rect?.left ?? 24, y: rect?.top ?? 24 };
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: origin.x, originY: origin.y, dragging: true };
    setIsDragging(true);
    if (!panelPos) setPanelPos(origin);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  const readFileAsText = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const MAX_FILES = 3, MAX_IMAGE_BYTES = 4 * 1024 * 1024, MAX_TEXT_BYTES = 200 * 1024, MAX_FILE_BYTES = 8 * 1024 * 1024;
    const next: Attachment[] = [];
    for (const f of arr) {
      if (attachments.length + next.length >= MAX_FILES) break;
      const isImage = f.type.startsWith('image/'), isText = f.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(f.name);
      if (isImage && f.size > MAX_IMAGE_BYTES) continue;
      if (isText && f.size > MAX_TEXT_BYTES) continue;
      if (!isImage && !isText && f.size > MAX_FILE_BYTES) continue;
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      if (isImage) { const dataUrl = await readFileAsDataUrl(f); next.push({ id, kind: 'image', name: f.name, mimeType: f.type || 'image/png', dataUrl, size: f.size }); }
      else if (isText) { const text = await readFileAsText(f); next.push({ id, kind: 'text', name: f.name, mimeType: f.type || 'text/plain', text, size: f.size }); }
      else { const dataUrl = await readFileAsDataUrl(f); next.push({ id, kind: 'file', name: f.name, mimeType: f.type || 'application/octet-stream', dataUrl, size: f.size }); }
    }
    if (next.length > 0) setAttachments(prev => [...prev, ...next]);
  }, [attachments]);

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));
  const formatBytes = (bytes: number) => { if (!bytes || bytes < 0) return '0 B'; const kb = bytes / 1024; return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`; };
  const fileExt = (name: string) => String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  const fileLabel = (a: Attachment) => { const ext = fileExt(a.name); if (a.kind === 'image') return ext?.toUpperCase() || 'IMAGE'; if (a.kind === 'text') return ext?.toUpperCase() || 'TEXT'; if (ext) return ext.toUpperCase(); return a.mimeType === 'application/pdf' ? 'PDF' : 'FILE'; };
  const fileIcon = (a: Attachment) => {
    if (a.kind === 'image') return <ImageIcon size={16} color="#475569" />;
    if (a.kind === 'text') return <FileText size={16} color="#475569" />;
    return fileExt(a.name) === 'pdf' ? <FileText size={16} color="#b91c1c" /> : <File size={16} color="#475569" />;
  };

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    setMessages(prev => [...prev, { id: newId(), role: 'user', text: trimmed, isAIGenerated: false, timestamp: new Date() }]);
    setInputText('');
    const outgoingAttachments = attachments; setAttachments([]);
    const history = messages.filter(m => m.role !== 'ai' || m.id !== messages[0]?.id);
    const contextText = replyTo ? `[REPLYING TO ${replyTo.role.toUpperCase()} MESSAGE: "${replyTo.text}"]\n${trimmed}` : trimmed;
    setReplyTo(null);
    const aiMsgId = newId();
    setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', text: '', isAIGenerated: online, timestamp: new Date() }]);
    await askStream('chat', { message: contextText, attachments: outgoingAttachments, isReply: !!replyTo, screenTitle: getScreenTitle(), screenData: getScreenData(), screenFields: getScreenFields() }, history, (chunkText, provider) => {
      if (provider) setProvider(provider);
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: chunkText, provider: provider ?? m.provider } : m));
    });
  }, [messages, askStream, online, attachments, replyTo]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!loading) sendMessage(inputText); } };
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    try { const items = e.clipboardData?.items; if (!items) return; const files: File[] = []; for (const it of Array.from(items)) { if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); } } if (files.length > 0) await addFiles(files); } catch {}
  };
  const clearChat = () => { if (window.confirm('Are you sure you want to clear the entire conversation?')) { setMessages([]); setHasOpened(false); setAttachments([]); setReplyTo(null); setInputText(''); } };
  const close = () => { setOpen(false); setReplyTo(null); };

  return (
    <>
      <div onClick={close} className={`${styles.backdrop} ${open ? styles.backdropOpen : ''} ${isExpanded ? styles.backdropExpanded : ''}`} />

      <button id="ai-assistant-toggle" onClick={() => setOpen(prev => !prev)} title="|Adare - AI Agent" aria-label="Toggle |Adare"
        className={`${styles.toggleBtn} ${online ? styles.toggleBtnOnline : ''} ${open ? styles.toggleBtnOpen : ''}`}>
        {open ? <X size={24} color="#fff" /> : <div className={styles.toggleBtnIcon}><Sparkles size={22} color="#fff" /></div>}
        <span className={`${styles.statusDot} ${online ? styles.statusDotOnline : ''}`} />
      </button>

      <div ref={panelRef} id="ai-assistant-panel"
        className={`${styles.panel} ${open ? styles.panelOpen : ''} ${isExpanded ? styles.panelExpanded : ''}`}
        style={panelPos && !isExpanded ? { left: `${panelPos.x}px`, top: `${panelPos.y}px`, bottom: 'unset', right: 'unset' } : undefined}>

        <div className={`${styles.header} ${online ? styles.headerOnline : ''} ${isDragging ? styles.headerDragging : ''}`}
          onPointerDown={beginDrag} title={isMobileSheet ? undefined : 'Drag to move'}>
          <div className={styles.headerGlow} />
          <div className={styles.headerLeft}>
            <div className={styles.headerLogo}><Sparkles size={20} color="#fff" /></div>
            <div>
              <div className={styles.headerTitle}>|Adare</div>
              <div className={styles.headerStatus}>
                {online ? <Wifi size={12} color="rgba(255,255,255,0.85)" /> : <WifiOff size={12} color="rgba(255,255,255,0.85)" />}
                <span className={styles.headerStatusText}>{online ? `Agent · ${activeProvider || '|Adare'}` : 'Offline mode'}</span>
                {online && <Zap size={10} color="#fbbf24" style={{ marginLeft: '2px' }} />}
              </div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button onClick={(e) => { e.stopPropagation(); setIsExpanded(prev => !prev); }} onPointerDown={(e) => e.stopPropagation()}
              title={isExpanded ? 'Minimize' : 'Expand'} className={styles.headerBtn}>
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); clearChat(); }} onPointerDown={(e) => e.stopPropagation()}
              title="Clear conversation" className={styles.headerBtn}>
              <RotateCcw size={16} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); close(); }} onPointerDown={(e) => e.stopPropagation()}
              title="Close" className={`${styles.headerBtn} ${styles.headerBtnClose}`}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateLogo}><Sparkles size={28} color="#fff" /></div>
              <h3 className={styles.emptyStateTitle}>|Adare Agent</h3>
              <p className={styles.emptyStateDesc}>Autonomous AI agent for Adare General Hospital.<br />Analyze handovers, query the database, assess risk, generate reports.</p>
              <div className={styles.quickActions}>
                {QUICK_ACTIONS.map((action, idx) => (
                  <button key={idx} onClick={() => sendMessage(action.prompt)} className={styles.quickActionBtn}>
                    <action.icon size={14} color="#003153" />{action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgRowUser : ''}`}>
              <div className={`${styles.msgAvatar} ${msg.role === 'user' ? styles.msgAvatarAi : ''}`}>
                {msg.role === 'user' ? <User size={16} color="#fff" /> : <Sparkles size={16} color="#fff" />}
              </div>
              <div className={`${styles.msgContent} ${msg.role === 'user' ? styles.msgContentUser : ''} ${isExpanded ? styles.msgContentExpanded : ''}`}>
                <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : ''}`}>
                  {renderMarkdown(msg.text)}
                  {msg.role === 'ai' && msg.text && (
                    <div className={styles.aiTag}>
                      <span className={`${styles.aiTagLabel} ${msg.isAIGenerated ? styles.aiTagLabelGenerated : ''}`}>
                        {msg.isAIGenerated ? '|Adare Agent' : 'Offline'}
                      </span>
                      <span className={styles.aiTagTime}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setReplyTo(msg)} title="Reply to this message" className={styles.replyBtn}>
                <RotateCcw size={14} style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>
          ))}

          {loading && (
            <div className={styles.typingRow}>
              <div className={`${styles.msgAvatar} ${online ? styles.msgAvatarAi : ''}`}><Sparkles size={16} color="#fff" /></div>
              <div className={styles.typingBubble}>
                <span className={`${styles.typingDot} ${styles.typingDot1}`} />
                <span className={`${styles.typingDot} ${styles.typingDot2}`} />
                <span className={`${styles.typingDot} ${styles.typingDot3}`} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {!online && (
          <div className={styles.offlineNotice}>
            <WifiOff size={14} color="#b45309" />
            <span className={styles.offlineNoticeText}>Offline — using built-in knowledge base</span>
          </div>
        )}

        <div className={styles.inputBar}>
          {replyTo && (
            <div className={styles.replyIndicator}>
              <div className={styles.replyIndicatorLeft}>
                <RotateCcw size={12} color="#003153" style={{ transform: 'rotate(90deg)' }} />
                <span className={styles.replyIndicatorLabel}>Replying to {replyTo.role.toUpperCase()}</span>
                <span className={styles.replyIndicatorText}>{replyTo.text.slice(0, 50)}{replyTo.text.length > 50 ? '...' : ''}</span>
              </div>
              <button onClick={() => setReplyTo(null)} className={styles.replyCloseBtn}><X size={14} /></button>
            </div>
          )}

          {attachments.length > 0 && (
            <div className={styles.attachments}>
              {attachments.map(a => (
                <div key={a.id} className={styles.attachmentCard}>
                  <button onClick={() => removeAttachment(a.id)} title="Remove" className={styles.attachmentRemove}><X size={10} color="#64748b" /></button>
                  <div className={styles.attachmentThumb}>
                    {a.kind === 'image' && a.dataUrl ? <img src={a.dataUrl} alt={a.name} /> : fileIcon(a)}
                  </div>
                  <div className={styles.attachmentInfo}>
                    <div className={styles.attachmentName}>{a.name}</div>
                    <div className={styles.attachmentMeta}>
                      <span className={styles.attachmentExt}>{fileLabel(a)}</span>
                      <span className={styles.attachmentSize}>{formatBytes(a.size)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.inputRow}>
            <input ref={fileInputRef} type="file" multiple accept="*/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json"
              style={{ display: 'none' }} onChange={async (e) => { if (e.target.files) await addFiles(e.target.files); e.currentTarget.value = ''; }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={loading} title="Attach files" aria-label="Attach"
              className={`${styles.attachBtn} ${loading ? styles.attachBtnDisabled : ''}`}>
              <Paperclip size={18} color="#475569" />
            </button>
            <textarea ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown}
              onPaste={handlePaste} placeholder="Ask |Adare anything — patients, records, reports, medical questions…" disabled={loading} rows={1}
              className={styles.textarea} />
            <button onClick={() => sendMessage(inputText)} disabled={loading || (!inputText.trim() && attachments.length === 0)}
              className={`${styles.sendBtn} ${loading || (!inputText.trim() && attachments.length === 0) ? styles.sendBtnDisabled : ''}`}>
              {loading ? <Loader2 size={18} color="#94a3b8" className={styles.spinner} /> : <Send size={18} color={(inputText.trim() || attachments.length > 0) ? '#fff' : '#94a3b8'} />}
            </button>
          </div>
        </div>

        <div className={styles.disclaimer}>
          <p className={styles.disclaimerText}>|Adare agent outputs are AI-generated — always verify clinically before action.</p>
        </div>
      </div>
    </>
  );
};
