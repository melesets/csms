// Feedback Page - comprehensive feedback & communication channel
// Clinical feedback system: two-way conversation between the giver and the team,
// with notifications for both sides (incoming for admins, replies for givers).
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MessageSquare, Send, Star, Inbox, CheckCircle2, Clock, Search, Trash2,
  HeartPulse, Users, Package, Pill, Building2, ShieldAlert, MessagesSquare,
  MonitorSmartphone, HelpCircle, Bell, ChevronRight, X, ChevronDown,
  Paperclip, FileText, File as FileIcon, FileImage, FileSpreadsheet, FileArchive, Loader2,
  Check, CheckCheck, CornerUpLeft, Sparkles, ChevronLeft, Download, ExternalLink, ZoomIn
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { } from '../../types/auth';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload, getMediaUrl } from '../../api';
import { formatEthiopianTimestamp } from '../../utils/ethiopianCalendar';

interface Attachment {
  id: number;
  feedbackId: number | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  path: string;
  createdAt: string;
}

interface FeedbackItem {
  id: number;
  userId: number | null;
  userName: string;
  userRole: string | null;
department: string | null;
  targetDepartment: string | null;
  targetProfession: string | null;
  targetRole: string | null;
  targetUserId: number | null;
  targetUserName: string | null;
  category: string;
  subject: string;
  message: string;
  rating: number | null;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  giverSeenAt: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  hasNewReply: boolean;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

interface ReplyTo {
  id: number;
  senderName: string;
  snippet: string;
}

interface Reply {
  id: number;
  feedbackId: number;
  userId: number | null;
  userName: string;
  userRole: string | null;
  message: string;
  replyToId: number;
  replyTo: ReplyTo | null;
  seenAt: string | null;
  createdAt: string;
  attachments: Attachment[];
}

interface Stats {
  total: number;
  avgRating: number;
  unread: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  patient_care:  { label: 'Patient Care',           icon: HeartPulse,       color: 'text-rose-600',      bg: 'bg-rose-50 border-rose-200' },
  staffing:      { label: 'Staffing & Workload',    icon: Users,            color: 'text-blue-600',      bg: 'bg-blue-50 border-blue-200' },
  equipment:     { label: 'Equipment & Supplies',   icon: Package,          color: 'text-amber-600',     bg: 'bg-amber-50 border-amber-200' },
  medication:    { label: 'Medication & Pharmacy',  icon: Pill,             color: 'text-violet-600',    bg: 'bg-violet-50 border-violet-200' },
  facility:      { label: 'Facility & Environment', icon: Building2,        color: 'text-teal-600',      bg: 'bg-teal-50 border-teal-200' },
  safety:        { label: 'Patient Safety',         icon: ShieldAlert,      color: 'text-red-600',       bg: 'bg-red-50 border-red-200' },
  communication: { label: 'Communication & Handover', icon: MessagesSquare, color: 'text-cyan-600',      bg: 'bg-cyan-50 border-cyan-200' },
  information:   { label: 'System & Information',   icon: MonitorSmartphone,color: 'text-indigo-600',    bg: 'bg-indigo-50 border-indigo-200' },
  other:         { label: 'Other',                  icon: HelpCircle,       color: 'text-gray-600',      bg: 'bg-gray-50 border-gray-200' },
};

const STATUS_META: Record<string, { label: string; cls: string; bar: string }> = {
  new:         { label: 'New',         cls: 'bg-blue-100 text-blue-700',       bar: 'bg-blue-500' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700',     bar: 'bg-amber-500' },
  resolved:    { label: 'Resolved',    cls: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  closed:      { label: 'Closed',      cls: 'bg-gray-200 text-gray-600',       bar: 'bg-gray-400' },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Low',    cls: 'bg-gray-100 text-gray-500' },
  medium: { label: 'Medium', cls: 'bg-sky-100 text-sky-700' },
  high:   { label: 'High',   cls: 'bg-red-100 text-red-700' },
};

const emptyStats: Stats = { total: 0, avgRating: 0, unread: 0, byStatus: {}, byCategory: {} };

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];

const isImageFile = (a: { mimeType: string; originalName?: string }) =>
  a.mimeType?.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(a.originalName || '');

const isRich = (m: string) => /<[a-zA-Z]|&nbsp;/.test(m || '');

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const stripHtml = (html: string) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const targetLabel = (item: { targetUserName?: string | null; targetUserId?: number | null; targetProfession?: string | null; targetRole?: string | null; targetDepartment?: string | null }) => {
  if (item.targetUserId && item.targetUserName) return item.targetUserName;
  if (item.targetProfession) return `${item.targetProfession}${item.targetDepartment ? ` · ${item.targetDepartment}` : ''}`;
  if (item.targetRole) return `${item.targetRole === 'staff' ? 'Staff' : item.targetRole === 'user' ? 'Users' : item.targetRole === 'viewer' ? 'Viewers' : item.targetRole} (role)`;
  if (item.targetDepartment) return item.targetDepartment;
  return null;
};

const fileIcon = (name: string, mime: string) => {
  if (mime?.startsWith('image/')) return { icon: FileImage, cls: 'text-blue-600 bg-blue-50' };
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return { icon: FileText, cls: 'text-red-600 bg-red-50' };
  if (['doc', 'docx'].includes(ext || '')) return { icon: FileText, cls: 'text-indigo-600 bg-indigo-50' };
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return { icon: FileSpreadsheet, cls: 'text-emerald-600 bg-emerald-50' };
  if (['ppt', 'pptx'].includes(ext || '')) return { icon: FileIcon, cls: 'text-orange-600 bg-orange-50' };
  return { icon: FileArchive, cls: 'text-gray-600 bg-gray-100' };
};

// Telegram-style media viewer: full-screen lightbox with prev/next, inline PDF
// viewing, download, and open-in-new-tab — attachments stay inside the app.
const MediaViewer = ({ items, index, onClose, onNavigate }: {
  items: Attachment[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) => {
  const cur = items[index];
  const url = getMediaUrl(cur?.path);
  const isImage = cur ? isImageFile(cur) : false;
  const isPdf = !!cur && (cur.mimeType === 'application/pdf' || /\.pdf$/i.test(cur.originalName || ''));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && items.length > 1) onNavigate((index + 1) % items.length);
      if (e.key === 'ArrowLeft' && items.length > 1) onNavigate((index - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [index, items.length, onClose, onNavigate]);

  if (!cur || !url) return null;
  const prev = (index - 1 + items.length) % items.length;
  const next = (index + 1) % items.length;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 text-white shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-xs font-semibold text-gray-300 truncate min-w-0">
          {cur.originalName} · {formatSize(cur.sizeBytes)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <a href={url} download={cur.originalName} title="Download" className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <Download className="w-4 h-4" />
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onClose} title="Close (Esc)" className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 relative" onClick={e => e.stopPropagation()}>
        {isPdf ? (
          <iframe src={url} title={cur.originalName} className="w-full h-full bg-white" />
        ) : isImage ? (
          <img src={url} alt={cur.originalName}
            onLoad={() => setLoaded(true)}
            className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
        ) : (
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 max-w-sm mx-4 text-center">
            {(() => { const meta = fileIcon(cur.originalName, cur.mimeType); const I = meta.icon; return (
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${meta.cls}`}>
                <I className="w-8 h-8" />
              </div>
            ); })()}
            <p className="text-sm font-bold text-gray-800 break-all">{cur.originalName}</p>
            <p className="text-xs text-gray-400">{formatSize(cur.sizeBytes)}</p>
            <a href={url} download={cur.originalName}
              className="px-4 py-2 text-xs font-bold text-white bg-[#003153] rounded-xl hover:bg-[#002640] transition-colors">
              Download
            </a>
          </div>
        )}
        {items.length > 1 && (
          <>
            <button onClick={() => onNavigate(prev)} title="Previous (←)"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/20 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => onNavigate(next)} title="Next (→)"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/20 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
          {items.map((a, i) => (
            <button key={a.id} onClick={() => onNavigate(i)}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FeedbackPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [tab, setTab] = useState<'inbox' | 'submit' | 'mine'>(isAdmin ? 'inbox' : 'mine');
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [rMessage, setRMessage] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null);
  const [rAtts, setRAtts] = useState<Attachment[]>([]);
  const [rUploading, setRUploading] = useState<{ key: string; name: string; size: number; failed?: boolean }[]>([]);
  const [rDragOver, setRDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedMine, setExpandedMine] = useState<number | null>(null);

  // filters (admin inbox)
  const [fStatus, setFStatus] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fDept, setFDept] = useState('');
  const [fSearch, setFSearch] = useState('');

  // submit form
  const [sSubject, setSSubject] = useState('');
  const [sMessage, setSMessage] = useState('');
  const [sRole, setSRole] = useState('');
  const [sProf, setSProf] = useState('');
  const [sUser, setSUser] = useState('');
  const [users, setUsers] = useState<{ id: number; username: string; name: string; role: string; profession: string; department: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<{ key: string; name: string; size: number; failed?: boolean }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ subject: string; message: string; provider?: string; target: 'submit' | 'reply' } | null>(null);
  const [viewer, setViewer] = useState<{ items: Attachment[]; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const notifyRefresh = () => window.dispatchEvent(new Event('feedback-updated'));

  const openViewer = useCallback((items: Attachment[], index: number) => setViewer({ items, index }), []);

  const fetchStats = useCallback(async () => {
    try { setStats(await apiGet('/feedback/stats')); } catch {}
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (fStatus) q.set('status', fStatus);
      if (fCategory) q.set('category', fCategory);
      if (fPriority) q.set('priority', fPriority);
      if (fDept) q.set('department', fDept);
      if (fSearch.trim()) q.set('search', fSearch.trim());
      const data = await apiGet(`/feedback?${q.toString()}`);
      setItems(data.items || []);
      setSelected(prev => {
        if (!prev) return null;
        const fresh = (data.items || []).find(i => i.id === prev.id);
        return fresh || null;
      });
    } catch {}
    finally { setLoading(false); }
  }, [fStatus, fCategory, fPriority, fDept, fSearch]);

  useEffect(() => {
    fetchStats();
    fetchItems();
  }, [fetchStats, fetchItems]);

  useEffect(() => {
    apiGet('/users')
      .then(list => {
        if (Array.isArray(list)) setUsers(list);
      })
      .catch(() => {});
  }, []);

  const departments = useMemo(() => Array.from(new Set(items.map(i => i.department).filter(Boolean))).sort(), [items]);

  const loadReplies = useCallback(async (feedbackId: number) => {
    try {
      setReplies(await apiGet(`/feedback/${feedbackId}/replies`));
    } catch { setReplies([]); }
  }, []);

  const selectItem = useCallback(async (item: FeedbackItem) => {
    setSelected(item);
    if (isAdmin && !item.isRead) {
      try {
        const updated = await apiPost(`/feedback/${item.id}/seen`);
        setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
        setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
        notifyRefresh();
      } catch {}
    }
    loadReplies(item.id);
  }, [isAdmin, loadReplies]);

  const updateItem = useCallback(async (id: number, patch: Partial<FeedbackItem>) => {
    try {
      const updated = await apiPut(`/feedback/${id}`, patch);
      setItems(prev => prev.map(i => (i.id === id ? updated : i)));
      setSelected(prev => (prev?.id === id ? updated : prev));
      fetchStats();
      notifyRefresh();
      return true;
    } catch { showToast('Failed to update'); return false; }
  }, [fetchStats, showToast]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('Delete this feedback permanently? This removes the whole conversation.')) return;
    try {
      await apiDelete(`/feedback/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
      setSelected(null);
      setReplies([]);
      fetchStats();
      notifyRefresh();
      showToast('Feedback deleted');
    } catch { showToast('Failed to delete'); }
  }, [fetchStats, showToast]);

  const sendReply = useCallback(async (feedbackId: number) => {
    const clean = stripHtml(rMessage);
    if (!clean) return;
    setReplying(true);
    try {
      const created = await apiPost(`/feedback/${feedbackId}/replies`, {
        message: rMessage.trim(),
        replyToId: replyingTo?.id || 0,
        attachmentIds: rAtts.map(a => a.id),
      });
      setReplies(prev => [...prev, created]);
      setRMessage('');
      setReplyingTo(null);
      setRAtts([]);
      setRUploading([]);
      const item = items.find(i => i.id === feedbackId);
      if (item) setItems(prev => prev.map(i => (i.id === feedbackId ? {
        ...i,
        replyCount: i.replyCount + 1,
        lastReplyAt: created.createdAt,
        status: i.status === 'new' ? 'in_progress' : i.status,
      } : i)));
      if (selected?.id === feedbackId) {
        setSelected(prev => prev ? { ...prev, replyCount: prev.replyCount + 1, lastReplyAt: created.createdAt, status: prev.status === 'new' ? 'in_progress' : prev.status } : prev);
      }
      if (!isAdmin) {
        // Giver replied — mark own thread seen
        try { await apiPost(`/feedback/${feedbackId}/seen`); } catch {}
      }
      notifyRefresh();
    } catch { showToast('Failed to send reply'); }
    finally { setReplying(false); }
  }, [rMessage, replyingTo, rAtts, items, selected, isAdmin, showToast, notifyRefresh]);

  const uploadFiles = useCallback(async (fileList: FileList | File[], target: 'submit' | 'reply') => {
    const isSubmit = target === 'submit';
    const files = Array.from(fileList);
    const room = MAX_ATTACHMENTS - (isSubmit ? atts.length : rAtts.length) - (isSubmit ? uploading.length : rUploading.length);
    if (room <= 0) { showToast(`Maximum ${MAX_ATTACHMENTS} attachments`); return; }
    const picks = files.slice(0, room);
    for (const file of picks) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ACCEPTED_EXTENSIONS.includes(ext) && !file.type.startsWith('image/')) {
        showToast(`${file.name} — unsupported type (images, PDF, Word, Excel, PPT, TXT, CSV)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(`${file.name} — too large (max 10 MB)`);
        continue;
      }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (isSubmit) setUploading(prev => [...prev, { key, name: file.name, size: file.size }]);
      else setRUploading(prev => [...prev, { key, name: file.name, size: file.size }]);
      const fd = new FormData();
      fd.append('files', file);
      try {
        const saved = await apiUpload('/feedback/attachments', fd);
        if (saved && saved.length) {
          if (isSubmit) setAtts(prev => [...prev, saved[0]]);
          else setRAtts(prev => [...prev, saved[0]]);
          if (isSubmit) setUploading(prev => prev.filter(u => u.key !== key));
          else setRUploading(prev => prev.filter(u => u.key !== key));
        } else {
          if (isSubmit) setUploading(prev => prev.map(u => (u.key === key ? { ...u, failed: true } : u)));
          else setRUploading(prev => prev.map(u => (u.key === key ? { ...u, failed: true } : u)));
        }
      } catch (err: any) {
        showToast(err?.message || `Failed to upload ${file.name}`);
        if (isSubmit) setUploading(prev => prev.map(u => (u.key === key ? { ...u, failed: true } : u)));
        else setRUploading(prev => prev.map(u => (u.key === key ? { ...u, failed: true } : u)));
      }
    }
  }, [atts.length, rAtts.length, uploading.length, rUploading.length, showToast]);

  const runEnhance = useCallback(async (text: string, subject: string) => {
    const res = await apiPost('/feedback/enhance', { text, subject });
    return {
      subject: (res.subject && String(res.subject).trim()) || subject || '',
      message: String(res.text || '').trim(),
      provider: res.provider,
    };
  }, []);

  const handleEnhance = useCallback(async () => {
    const clean = stripHtml(sMessage);
    if (!clean) {
      showToast('Write your message first, then enhance it with AI');
      return;
    }
    setEnhancing(true);
    try {
      const enhanced = await runEnhance(clean, stripHtml(sSubject));
      if (!enhanced.message) throw new Error('AI returned an empty result');
      setAiPreview({ ...enhanced, target: 'submit' });
    } catch (err: any) {
      showToast(err?.message || 'AI enhance failed — try again');
    } finally {
      setEnhancing(false);
    }
  }, [sMessage, sSubject, runEnhance, showToast]);

  const handleEnhanceReply = useCallback(async () => {
    const clean = stripHtml(rMessage);
    if (!clean) {
      showToast('Write your reply first, then enhance it with AI');
      return;
    }
    setEnhancing(true);
    try {
      const enhanced = await runEnhance(clean, '');
      if (!enhanced.message) throw new Error('AI returned an empty result');
      setAiPreview({ ...enhanced, target: 'reply' });
    } catch (err: any) {
      showToast(err?.message || 'AI enhance failed — try again');
    } finally {
      setEnhancing(false);
    }
  }, [rMessage, runEnhance, showToast]);

  const handleSubmit = useCallback(async () => {
    const clean = stripHtml(sMessage);
    if (!sSubject.trim() || !clean) {
      showToast('Subject and message are required');
      return;
    }
    if (clean.length > 2000) {
      showToast('Message is too long (max 2000 characters)');
      return;
    }
    if (uploading.some(u => !u.failed)) {
      showToast('Wait for attachments to finish uploading');
      return;
    }
    setSending(true);
    try {
      await apiPost('/feedback', {
        subject: sSubject.trim(),
        message: sMessage.trim(),
        targetRole: sRole || null,
        targetProfession: sProf || null,
        targetUserId: sUser ? Number(sUser) : null,
        attachmentIds: atts.map(a => a.id),
      });
      setSent(true);
      setSSubject(''); setSMessage('');
      setAtts([]);
      fetchStats();
      notifyRefresh();
      if (!isAdmin) fetchItems();
      window.setTimeout(() => setSent(false), 4000);
    } catch { showToast('Failed to send feedback'); }
    finally { setSending(false); }
  }, [sSubject, sMessage, atts, uploading, fetchStats, fetchItems, isAdmin, showToast]);

  const openMine = useCallback(async (item: FeedbackItem) => {
    if (expandedMine === item.id) {
      setExpandedMine(null);
      return;
    }
    setExpandedMine(item.id);
    if (item.hasNewReply) {
      try {
        const updated = await apiPost(`/feedback/${item.id}/seen`);
        setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
        setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
        notifyRefresh();
      } catch {}
    }
    loadReplies(item.id);
  }, [expandedMine, loadReplies]);

  const statCards = [
    { label: 'Total Feedback', value: stats.total, icon: MessageSquare, cls: 'text-[#003153]' },
    { label: 'New', value: stats.byStatus.new || 0, icon: Inbox, cls: 'text-blue-600' },
    { label: 'In Progress', value: stats.byStatus.in_progress || 0, icon: Clock, cls: 'text-amber-600' },
    { label: 'Resolved', value: stats.byStatus.resolved || 0, icon: CheckCircle2, cls: 'text-emerald-600' },
    { label: 'Avg Rating', value: stats.avgRating ? `${stats.avgRating}★` : '—', icon: Star, cls: 'text-yellow-600' },
    ...(stats.unread > 0 || isAdmin ? [{ label: isAdmin ? 'Unread' : 'Responses', value: stats.unread, icon: Bell, cls: 'text-red-600' }] : []),
  ];

  const renderAttachments = (item: Attachment[], insideBubble = false) => {
    if (!item.length) return null;
    const images = item.filter(isImageFile);
    const files = item.filter(a => !isImageFile(a));
    const openAt = (a: Attachment) => openViewer(item, item.findIndex(x => x.id === a.id));
    return (
      <div className={insideBubble ? '' : 'mb-4'}>
        {images.length > 0 && (
          <div className={`grid gap-2 mb-2 ${images.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
            {images.map(a => (
              <a key={a.id} href={getMediaUrl(a.path)} onClick={e => { e.preventDefault(); openAt(a); }}
                className="group relative rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100 hover:ring-2 hover:ring-[#003153] transition-all cursor-zoom-in block">
                <img src={getMediaUrl(a.path)} alt={a.originalName} loading="lazy"
                  className="w-full h-full object-cover" />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[8px] font-semibold px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {a.originalName}
                </span>
              </a>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map(a => {
              const meta = fileIcon(a.originalName, a.mimeType);
              const isPdf = a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.originalName || '');
              return (
                <a key={a.id} href={getMediaUrl(a.path)} onClick={isPdf ? e => { e.preventDefault(); openAt(a); } : undefined}
                  target={isPdf ? undefined : '_blank'} rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-[#003153]/40 hover:bg-gray-50 transition-all max-w-[240px] ${isPdf ? 'cursor-zoom-in' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                    <meta.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-700 truncate">{a.originalName}</p>
                    <p className="text-[8px] text-gray-400">{formatSize(a.sizeBytes)}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderReplyComposer = (feedbackId: number) => (
    <div
      onDragOver={e => { e.preventDefault(); setRDragOver(true); }}
      onDragLeave={() => setRDragOver(false)}
      onDrop={e => { e.preventDefault(); setRDragOver(false); uploadFiles(e.dataTransfer.files, 'reply'); }}
      className={`transition-colors ${rDragOver ? 'ring-2 ring-[#003153] rounded-2xl' : ''}`}>
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-gray-100 border-l-[3px] border-[#003153] rounded-r-lg">
          <CornerUpLeft className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-[10px] font-bold text-[#003153] shrink-0">Replying to {replyingTo.senderName}</span>
          <span className="text-[10px] text-gray-500 truncate flex-1">"{replyingTo.snippet}"</span>
          <button onClick={() => setReplyingTo(null)} className="p-0.5 text-gray-400 hover:text-red-500 rounded shrink-0" title="Cancel reply">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <textarea
        value={rMessage}
        onChange={e => setRMessage(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(feedbackId); } }}
        placeholder="Write your reply... (Enter to send)"
        rows={4}
        className="w-full px-4 py-3 text-sm leading-relaxed border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003153] resize-y"
      />

      {(rUploading.length > 0 || rAtts.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {rUploading.map(u => (
            <div key={u.key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
              {u.failed
                ? <X className="w-4 h-4 text-red-500 shrink-0" />
                : <Loader2 className="w-4 h-4 text-[#003153] animate-spin shrink-0" />}
              <span className="text-xs font-semibold text-gray-700 truncate max-w-[160px]">{u.name}</span>
              <span className={`text-[9px] font-bold ${u.failed ? 'text-red-500' : 'text-gray-400'}`}>
                {u.failed ? 'Failed' : 'Uploading...'}
              </span>
            </div>
          ))}
          {rAtts.map(a => (
            <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
              {isImageFile(a) ? (
                <img src={getMediaUrl(a.path)} alt={a.originalName} className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                  {(() => { const I = fileIcon(a.originalName, a.mimeType).icon; return <I className={`w-4 h-4 ${fileIcon(a.originalName, a.mimeType).cls.split(' ')[0]}`} />; })()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate max-w-[160px]">{a.originalName}</p>
                <p className="text-[9px] text-gray-400">{formatSize(a.sizeBytes)}</p>
              </div>
              <button onClick={() => setRAtts(prev => prev.filter(x => x.id !== a.id))}
                className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0" title="Remove">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mt-2.5">
        <button onClick={() => replyFileRef.current?.click()}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#003153] bg-[#003153]/5 hover:bg-[#003153]/10 rounded-xl transition-colors"
          title="Attach files (images, PDF, Word, Excel, PPT, TXT, CSV)">
          <Paperclip className="w-4 h-4" /> Attach
          <span className="text-[9px] font-semibold text-gray-400">{rAtts.length}/{MAX_ATTACHMENTS}</span>
        </button>
        <button onClick={handleEnhanceReply} disabled={enhancing}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Polish your reply with AI">
          {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {enhancing ? 'Enhancing...' : 'Enhance with AI'}
        </button>
        <input ref={replyFileRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
          onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files, 'reply'); e.target.value = ''; }} />
        <span className="text-[10px] text-gray-400 hidden md:block">
          or drag & drop files onto the reply box — up to {MAX_ATTACHMENTS} files, 10 MB each
        </span>
        <button onClick={() => sendReply(feedbackId)} disabled={replying || !stripHtml(rMessage)}
          className="ml-auto flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#003153] hover:bg-[#002640] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Send className="w-3.5 h-3.5" /> {replying ? 'Sending...' : 'Reply'}
        </button>
      </div>
    </div>
  );

  const renderTicks = (seen: boolean, dark: boolean) => (
    <span className="inline-flex items-center gap-0.5 ml-1 -mb-1 align-middle">
      {seen
        ? <CheckCheck className={`w-3.5 h-3.5 ${dark ? 'text-sky-300' : 'text-sky-600'}`} />
        : <Check className={`w-3.5 h-3.5 ${dark ? 'text-white/40' : 'text-gray-300'}`} />}
    </span>
  );

  const renderQuote = (replyTo: ReplyTo, dark: boolean) => (
    <div className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-[3px] text-[10px] leading-snug ${
      dark ? 'bg-white/10 border-white/40 text-white/80' : 'bg-gray-50 border-[#003153] text-gray-600'
    }`}>
      <span className={`font-bold ${dark ? 'text-sky-200' : 'text-[#003153]'}`}>{replyTo.senderName}</span>
      <p className="truncate mt-0.5">{replyTo.snippet}</p>
    </div>
  );

  const renderBubble = (msg: { id: number; userName: string; userRole?: string | null; message: string; replyTo: ReplyTo | null; seen: boolean; mine: boolean; createdAt: string; html?: boolean; attachments?: Attachment[] }) => (
    <div key={msg.id} className={`flex gap-2.5 group ${msg.mine ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 ${
        msg.mine ? 'bg-[#003153] text-white' : 'bg-gray-200 text-gray-600'
      }`}>
        {msg.userName?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div className={`flex flex-col ${msg.mine ? 'items-end' : 'items-start'} max-w-[85%]`}>
        {msg.replyTo && renderQuote(msg.replyTo, msg.mine)}
        <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
          msg.mine ? 'bg-[#003153] text-white rounded-tr-md' : 'bg-gray-100 text-gray-700 rounded-tl-md'
        }`}>
          <div className={`text-[9px] font-bold mb-0.5 ${msg.mine ? 'text-white/60' : 'text-gray-400'}`}>
            {msg.userName}{msg.userRole === 'admin' || msg.userRole === 'superadmin' ? ' · Team' : ''} · {formatEthiopianTimestamp(msg.createdAt)}
          </div>
          {msg.html
            ? <span className="whitespace-pre-wrap [&_div]:my-0.5 [&_p]:my-0.5" dangerouslySetInnerHTML={{ __html: msg.message }} />
            : <span className="whitespace-pre-wrap">{msg.message}</span>}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-2 -mx-1.5 -mb-1 overflow-hidden">
              {renderAttachments(msg.attachments, true)}
            </div>
          )}
          {msg.mine && renderTicks(msg.seen, true)}
        </div>
        <button onClick={() => setReplyingTo({ id: msg.id, senderName: msg.userName, snippet: stripHtml(msg.message) })}
          className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 px-2 py-1 text-[9px] font-bold text-[#003153] bg-[#003153]/5 hover:bg-[#003153]/10 rounded-lg flex items-center gap-1">
          <CornerUpLeft className="w-2.5 h-2.5" /> Reply
        </button>
      </div>
    </div>
  );

  const renderThread = (item: FeedbackItem, compact = false) => (
    <div className={compact ? '' : 'mt-4'}>
      {!compact && replies.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <MessagesSquare className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Conversation ({replies.length} reply{replies.length > 1 ? 's' : ''})
          </span>
        </div>
      )}
      {compact ? (
        <div className="space-y-2 mt-3">
          {renderBubble({
            id: 0,
            userName: item.userName,
            userRole: item.userRole,
            message: item.message,
            replyTo: null,
            seen: !!item.isRead,
            mine: true,
            createdAt: item.createdAt,
            html: true,
            attachments: item.attachments,
          })}
          {replies.map(r => renderBubble({
            id: r.id,
            userName: r.userName,
            userRole: r.userRole,
            message: r.message,
            replyTo: r.replyTo,
            seen: !!r.seenAt,
            mine: r.userId === user?.id,
            createdAt: r.createdAt,
            html: isRich(r.message),
            attachments: r.attachments,
          }))}
          {renderReplyComposer(item.id)}
        </div>
      ) : (
        <div className="space-y-2">
          {replies.map(r => renderBubble({
            id: r.id,
            userName: r.userName,
            userRole: r.userRole,
            message: r.message,
            replyTo: r.replyTo,
            seen: !!r.seenAt,
            mine: r.userId === user?.id,
            createdAt: r.createdAt,
            html: isRich(r.message),
            attachments: r.attachments,
          }))}
          {replies.length === 0 && (
            <p className="text-center text-[11px] text-gray-400 py-2">No replies yet — start the conversation.</p>
          )}
          {renderReplyComposer(item.id)}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] px-4 py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Media viewer (Telegram-style lightbox) */}
      {viewer && (
        <MediaViewer
          items={viewer.items}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onNavigate={i => setViewer(prev => (prev ? { ...prev, index: i } : prev))}
        />
      )}

      {/* AI enhancement preview */}
      {aiPreview && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !enhancing && setAiPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-bold text-gray-900">AI-enhanced {aiPreview.target === 'reply' ? 'reply' : 'draft'}</h3>
              {aiPreview.provider && (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold text-violet-700 bg-violet-50">
                  {aiPreview.provider}
                </span>
              )}
              <span className="ml-auto text-[10px] text-gray-400">Review, edit, then accept</span>
            </div>
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              {aiPreview.target === 'submit' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Subject</label>
                  <input value={aiPreview.subject} onChange={e => setAiPreview(prev => prev ? { ...prev, subject: e.target.value } : prev)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003153]" />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Message <span className={`ml-2 ${stripHtml(aiPreview.message).length > 2000 ? 'text-red-500' : 'text-gray-300'}`}>{stripHtml(aiPreview.message).length}/2000</span>
                </label>
                <textarea value={aiPreview.message}
                  onChange={e => setAiPreview(prev => prev ? { ...prev, message: e.target.value } : prev)}
                  rows={8}
                  className="w-full px-3.5 py-3 text-sm leading-relaxed border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003153] resize-y" />
                {stripHtml(aiPreview.message).length > 2000 && (
                  <p className="text-[10px] font-semibold text-red-500 mt-1">Too long — shorten it before sending (max 2000 characters).</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setAiPreview(null)} disabled={enhancing}
                className="px-4 py-2 text-xs font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={async () => {
                setEnhancing(true);
                try {
                  const source = aiPreview.target === 'reply' ? rMessage : sMessage;
                  const enhanced = await runEnhance(stripHtml(source), aiPreview.target === 'submit' ? stripHtml(sSubject) : '');
                  if (enhanced.message) setAiPreview({ ...enhanced, target: aiPreview.target });
                  else showToast('AI returned an empty result — try again');
                } catch (err: any) {
                  showToast(err?.message || 'AI enhance failed — try again');
                } finally { setEnhancing(false); }
              }} disabled={enhancing}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors disabled:opacity-50">
                {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {enhancing ? 'Enhancing...' : 'Regenerate'}
              </button>
              <button onClick={() => {
                if (aiPreview.target === 'reply') {
                  setRMessage(aiPreview.message.trim());
                } else {
                  setSSubject(aiPreview.subject.trim());
                  setSMessage(aiPreview.message.trim());
                }
                setAiPreview(null);
                showToast('Enhanced by AI — review and send');
              }} disabled={enhancing || !aiPreview.message.trim() || stripHtml(aiPreview.message).length > 2000}
                className="ml-auto px-5 py-2 text-xs font-bold text-white bg-[#003153] hover:bg-[#002640] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + compact stats (icon & number only, no cards) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <div className="flex items-center gap-1 bg-white border border-gray-200/80 rounded-xl p-1 shadow-sm">
          {isAdmin && (
            <button onClick={() => { setTab('inbox'); fetchItems(); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'inbox' ? 'bg-[#003153] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              <Inbox className="w-3.5 h-3.5" /> Inbox
              {stats.unread > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${tab === 'inbox' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
                  {stats.unread}
                </span>
              )}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setTab('submit')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'submit' ? 'bg-[#003153] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              <Send className="w-3.5 h-3.5" /> Submit Feedback
            </button>
          )}
          {!isAdmin && (
            <button onClick={() => { setTab('mine'); fetchItems(); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'mine' ? 'bg-[#003153] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              <MessageSquare className="w-3.5 h-3.5" /> My Feedback
              {stats.unread > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${tab === 'mine' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
                  {stats.unread}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Compact stats — icon + number only (hidden on My Feedback, which has its own summary chips) */}
        {tab !== 'mine' && (
          <div className="flex items-center gap-4 ml-auto">
            {statCards.map(c => (
              <div key={c.label} className="flex items-center gap-1.5" title={c.label}>
                <c.icon className={`w-4 h-4 ${c.cls}`} />
                <span className="text-sm font-black text-gray-900 leading-none">{c.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {tab === 'inbox' && (
        <div className="flex-1 flex flex-col min-h-0 gap-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-3 shadow-sm flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={fSearch} onChange={e => setFSearch(e.target.value)}
                placeholder="Search subject, message, or person..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003153]" />
            </div>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white font-medium">
              <option value="">All Status</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={fCategory} onChange={e => setFCategory(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white font-medium">
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={fPriority} onChange={e => setFPriority(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white font-medium">
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={fDept} onChange={e => setFDept(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white font-medium">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Split pane */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* List */}
            <div className="w-[400px] shrink-0 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Inbox</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                    {stats.unread > 0 && <span className="ml-1.5 text-red-500 font-bold">{stats.unread} unread</span>}
                  </p>
                </div>
                {(fStatus || fCategory || fPriority || fDept || fSearch.trim()) && (
                  <button onClick={() => { setFStatus(''); setFCategory(''); setFPriority(''); setFDept(''); setFSearch(''); }}
                    className="text-[10px] font-bold text-[#003153] hover:underline shrink-0">
                    Clear filters
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-[#003153] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                    <Inbox className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-xs font-semibold text-gray-500">No feedback found</p>
                    <p className="text-[10px] text-gray-400 mt-1">Try adjusting the filters</p>
                  </div>
                ) : items.map(item => {
                  const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
                  const st = STATUS_META[item.status];
                  const pr = PRIORITY_META[item.priority];
                  return (
                    <button key={item.id} onClick={() => selectItem(item)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        selected?.id === item.id
                          ? 'border-[#003153]/30 bg-[#003153]/[0.04] shadow-sm ring-1 ring-[#003153]/10'
                          : 'border-gray-100 hover:border-gray-200 hover:shadow-sm hover:bg-gray-50/60'
                      } ${!item.isRead ? 'bg-blue-50/40 border-blue-100/70' : 'bg-white'}`}>
                      <div className={`w-1 h-full min-h-[46px] rounded-full shrink-0 mt-0.5 ${st.bar}`} />
                      <div className="relative mt-0.5 shrink-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.bg} ring-1 ring-black/5 shadow-sm`}>
                          {(() => { const I = cat.icon; return <I className={`w-5 h-5 ${cat.color}`} />; })()}
                        </div>
                        {!item.isRead && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full ring-2 ring-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs truncate ${!item.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                            {item.subject}
                          </p>
                          <span className={`ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.bar}`} /> {st.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 truncate">{stripHtml(item.message)}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 min-w-0">
                            <span className="w-4 h-4 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center text-[8px] font-bold shrink-0">
                              {item.userName?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                            <span className="truncate">{item.userName}{item.department ? ` · ${item.department}` : ''}</span>
                          </span>
                          {(() => { const lbl = targetLabel(item); return lbl ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold text-[#003153] bg-[#003153]/5 border border-[#003153]/15 shrink-0">
                              To: {lbl}
                            </span>
                          ) : null; })()}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold shrink-0 ${pr.cls}`}>
                            <span className="w-1 h-1 rounded-full bg-current" /> {pr.label}
                          </span>
                          <span className="ml-auto inline-flex items-center gap-2 text-[9px] text-gray-400 shrink-0">
                            <span className="inline-flex items-center gap-0.5">
                              <MessagesSquare className="w-2.5 h-2.5" /> {item.replyCount}
                            </span>
                            {item.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <Paperclip className="w-2.5 h-2.5" /> {item.attachments.length}
                              </span>
                            )}
                            <span>{formatEthiopianTimestamp(item.createdAt, { showRelative: true })}</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail / Conversation */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-200/80 shadow-sm min-h-0 overflow-y-auto">
              {!selected ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                  <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">Select a feedback item</p>
                  <p className="text-xs text-gray-400 mt-1">Read the report and reply to start the conversation</p>
                </div>
              ) : (
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${CATEGORY_META[selected.category]?.bg || CATEGORY_META.other.bg}`}>
                        {(() => { const I = (CATEGORY_META[selected.category] || CATEGORY_META.other).icon; return <I className={`w-5 h-5 ${(CATEGORY_META[selected.category] || CATEGORY_META.other).color}`} />; })()}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 leading-tight">{selected.subject}</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {(CATEGORY_META[selected.category] || CATEGORY_META.other).label} · {formatEthiopianTimestamp(selected.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateItem(selected.id, { isRead: !selected.isRead })}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${
                          selected.isRead
                            ? 'text-gray-500 border-gray-200 hover:bg-gray-100'
                            : 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
                        }`}>
                        {selected.isRead ? 'Mark Unread' : 'Mark Read'}
                      </button>
                      <button onClick={() => handleDelete(selected.id)}
                        className="px-3 py-1.5 text-[10px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_META[selected.status].cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[selected.status].bar}`} /> {STATUS_META[selected.status].label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${PRIORITY_META[selected.priority].cls}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" /> {PRIORITY_META[selected.priority].label}
                    </span>
                    {selected.rating ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-700">
                        {'★'.repeat(selected.rating)}{'☆'.repeat(5 - selected.rating)}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                      <span className="w-4 h-4 rounded-md bg-white text-gray-500 flex items-center justify-center text-[9px] font-bold">
                        {selected.userName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                      {selected.userName} · {selected.userRole || '—'}
                    </span>
                    {selected.department && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                        {selected.department}
                      </span>
                    )}
{(() => { const lbl = targetLabel(selected); return lbl ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-[#003153] bg-[#003153]/5 ring-1 ring-[#003153]/20">
                        To: {lbl}
                      </span>
                    ) : null; })()}
                  </div>

                  {/* Original message */}
                  <div className="group bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                        {selected.userName} · {formatEthiopianTimestamp(selected.createdAt)}
                      </span>
                      <button onClick={() => setReplyingTo({ id: 0, senderName: selected.userName, snippet: stripHtml(selected.message) })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-[9px] font-bold text-[#003153] bg-[#003153]/5 hover:bg-[#003153]/10 rounded-lg flex items-center gap-1">
                        <CornerUpLeft className="w-2.5 h-2.5" /> Reply
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selected.message }} />
                    {selected.attachments.length > 0 && (
                      <div className="mt-3">
                        {renderAttachments(selected.attachments, true)}
                      </div>
                    )}
                  </div>

                  {/* Conversation thread */}
                  {renderThread(selected)}

                  {/* Actions */}
                  <div className="flex flex-wrap items-end gap-4 border-t border-gray-100 pt-5 mt-5">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
                      <div className="flex gap-1.5">
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <button key={k} onClick={() => updateItem(selected.id, { status: k as any })}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                              selected.status === k
                                ? `${v.cls} border-transparent ring-2 ring-offset-1`
                                : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Priority</label>
                      <div className="flex gap-1.5">
                        {Object.entries(PRIORITY_META).map(([k, v]) => (
                          <button key={k} onClick={() => updateItem(selected.id, { priority: k as any })}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                              selected.priority === k
                                ? `${v.cls} border-transparent ring-2 ring-offset-1`
                                : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'submit' && (
        <div className="flex-1 flex flex-col min-h-0">
          {sent ? (
            <div className="flex-1 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-center">
              <div className="flex flex-col items-center py-16 text-center max-w-md px-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Feedback sent!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {sUser
                    ? 'The user has been notified. You can track replies and the status under My Feedback.'
                    : sProf
                      ? `${sProf} has been notified. You can track replies and the status under My Feedback.`
                      : sRole
                        ? `All ${sRole}s have been notified. You can track replies and the status under My Feedback.`
                        : 'All staff have been notified. You can track replies and the status under My Feedback.'}
                </p>
                <button onClick={() => { setSent(false); if (isAdmin) setTab('inbox'); else setTab('mine'); }}
                  className="mt-6 px-4 py-2 text-xs font-bold text-white bg-[#003153] hover:bg-[#002640] rounded-xl transition-colors">
                  {isAdmin ? 'View Inbox' : 'View My Feedback'}
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files, 'submit'); }}
              className={`bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 lg:p-8 flex flex-col gap-5 min-h-0 transition-colors ${dragOver ? 'ring-2 ring-[#003153] border-[#003153]/40' : ''}`}>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Share your feedback</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {isAdmin
                    ? 'Write feedback for a specific department or unit — they receive it, reply here, and you oversee everything.'
                    : 'Report an issue or suggestion for a department or unit. They receive it, reply here, and you get notified.'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Subject</label>
                <input value={sSubject} onChange={e => setSSubject(e.target.value)} maxLength={200}
                  placeholder="Short summary — e.g. Stock of paracetamol running low on Ward B"
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003153]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Role</label>
                  <select value={sRole} onChange={e => { setSRole(e.target.value); setSProf(''); setSUser(''); }}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003153]">
                    <option value="">All Roles</option>
                    <option value="staff">Staff</option>
                    <option value="user">Users</option>
                    <option value="viewer">Viewers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Profession</label>
                  <select value={sProf} onChange={e => { setSProf(e.target.value); setSUser(''); }}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003153]">
                    <option value="">All Professions</option>
                    {[...new Set(users.filter(u => !sRole || u.role === sRole).map(u => u.profession).filter(Boolean))].sort().map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">User</label>
                  <select value={sUser} onChange={e => setSUser(e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003153]">
                    <option value="">Select user...</option>
                    {users
                      .filter(u => !sRole || u.role === sRole)
                      .filter(u => !sProf || u.profession === sProf)
                      .map(u => (
                        <option key={u.id} value={String(u.id)}>
                          {u.name || u.username}{u.department ? ` • ${u.department}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 -mt-2">
                {sUser
                  ? `This feedback goes directly to the selected user.`
                  : sProf
                    ? `This feedback goes to all ${sProf}s — only they see it and can reply.`
                    : sRole
                      ? `This feedback goes to all ${sRole}s — only they see it and can reply.`
                      : 'This feedback is general — all staff can see it and reply.'}
              </p>

              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Message</label>
                <textarea
                  value={sMessage}
                  onChange={e => setSMessage(e.target.value)}
                  maxLength={2000}
                  placeholder="Write your feedback message..."
                  rows={10}
                  className="flex-1 w-full px-4 py-3 text-sm leading-relaxed border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003153] resize-y"
                />
              </div>

              {/* Attachment chips (inside the page) */}
              {(uploading.length > 0 || atts.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {uploading.map(u => (
                    <div key={u.key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                      {u.failed
                        ? <X className="w-4 h-4 text-red-500 shrink-0" />
                        : <Loader2 className="w-4 h-4 text-[#003153] animate-spin shrink-0" />}
                      <span className="text-xs font-semibold text-gray-700 truncate max-w-[160px]">{u.name}</span>
                      <span className={`text-[9px] font-bold ${u.failed ? 'text-red-500' : 'text-gray-400'}`}>
                        {u.failed ? 'Failed' : 'Uploading...'}
                      </span>
                    </div>
                  ))}
                  {atts.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
                      {isImageFile(a) ? (
                        <img src={getMediaUrl(a.path)} alt={a.originalName} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                          {(() => { const I = fileIcon(a.originalName, a.mimeType).icon; return <I className={`w-4 h-4 ${fileIcon(a.originalName, a.mimeType).cls.split(' ')[0]}`} />; })()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate max-w-[160px]">{a.originalName}</p>
                        <p className="text-[9px] text-gray-400">{formatSize(a.sizeBytes)}</p>
                      </div>
                      <button onClick={() => setAtts(prev => prev.filter(x => x.id !== a.id))}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0" title="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Composer bar */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#003153] bg-[#003153]/5 hover:bg-[#003153]/10 rounded-xl transition-colors"
                  title="Attach files (images, PDF, Word, Excel, PPT, TXT, CSV)">
                  <Paperclip className="w-4 h-4" /> Attach
                  <span className="text-[9px] font-semibold text-gray-400">{atts.length}/{MAX_ATTACHMENTS}</span>
                </button>
                <button onClick={handleEnhance} disabled={enhancing}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Polish your message with AI">
                  {enhancing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                  {enhancing ? 'Enhancing...' : 'Enhance with AI'}
                </button>
                <input ref={fileInputRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                  onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files, 'submit'); e.target.value = ''; }} />
                <span className="text-[10px] text-gray-400 hidden sm:block">
                  or drag & drop onto the page — up to {MAX_ATTACHMENTS} files, 10 MB each
                </span>
                <button onClick={handleSubmit} disabled={sending}
                  className="ml-auto flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-[#003153] hover:bg-[#002640] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send Feedback'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="flex-1 flex flex-col min-h-0 gap-4">
          {/* Summary chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Sent', value: items.length, icon: Send, cls: 'text-[#003153]' },
              { label: 'Awaiting response', value: items.filter(i => i.status === 'new').length, icon: Clock, cls: 'text-blue-600' },
              { label: 'In progress', value: items.filter(i => i.status === 'in_progress').length, icon: Loader2, cls: 'text-amber-600' },
              { label: 'Resolved', value: items.filter(i => i.status === 'resolved').length, icon: CheckCircle2, cls: 'text-emerald-600' },
            ].map(c => (
              <div key={c.label} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200/80 shadow-sm">
                <c.icon className={`w-3.5 h-3.5 ${c.cls}`} />
                <span className="text-sm font-black text-gray-900 leading-none">{c.value}</span>
                <span className="text-[9px] font-bold text-gray-400">{c.label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#003153] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200/80">
                <div className="w-14 h-14 bg-gradient-to-br from-[#003153]/10 to-[#003153]/5 rounded-2xl flex items-center justify-center mb-3">
                  <MessageSquare className="w-7 h-7 text-[#003153]/40" />
                </div>
                <p className="text-sm font-semibold text-gray-500">No feedback yet</p>
                <p className="text-xs text-gray-400 mt-1">Submit your first feedback — it will show up here with its status.</p>
              </div>
            ) : items.map(item => {
              const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
              const st = STATUS_META[item.status];
              const pr = PRIORITY_META[item.priority];
              const expanded = expandedMine === item.id;
              const isUnread = !!item.hasNewReply;
              const isOwnReply = isUnread && item.userId === user?.id;
              return (
                <div key={item.id} className={`rounded-2xl border overflow-hidden transition-all shrink-0 ${
                  expanded ? 'shadow-md ring-1 ring-[#003153]/5' : 'shadow-sm hover:shadow-md hover:-translate-y-px'
                } ${isUnread ? 'bg-blue-50/40 border-blue-200/70' : 'bg-white border-gray-200/80'}`}>
                  <button onClick={() => openMine(item)} className="w-full flex items-stretch text-left">
                    <div className="w-1.5 shrink-0 bg-[#003153]" />
                    <div className="flex-1 px-4 py-4 flex items-start gap-3.5">
                      <div className="relative shrink-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${cat.bg} ring-1 ring-black/5 shadow-sm`}>
                          {(() => { const I = cat.icon; return <I className={`w-5 h-5 ${cat.color}`} />; })()}
                        </div>
                        {isUnread && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full ring-2 ring-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm truncate ${isUnread ? 'font-black text-gray-900' : 'font-bold text-gray-900'}`}>{item.subject}</p>
                          {isOwnReply ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-200 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> New reply
                            </span>
                          ) : isUnread ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-blue-500 shadow-sm shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> New
                            </span>
                          ) : null}
                          {(() => { const lbl = targetLabel(item); return lbl ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-[#003153] bg-[#003153]/5 ring-1 ring-[#003153]/15">
                              To: {lbl}
                            </span>
                          ) : null; })()}
                          {item.rating ? (
                            <span className="text-[10px] text-yellow-500 font-bold">{'★'.repeat(item.rating)}</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2" dangerouslySetInnerHTML={{ __html: item.message }} />
                        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 ring-1 ring-gray-200/70 text-[9px] font-bold text-gray-500">
                            {(() => { const I = cat.icon; return <I className="w-3 h-3 text-gray-400" />; })()} {cat.label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                            <Clock className="w-3 h-3" /> {formatEthiopianTimestamp(item.createdAt, { showRelative: true })}
                          </span>
                          {item.replyCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600">
                              <MessagesSquare className="w-3 h-3" /> {item.replyCount} reply{item.replyCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {item.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                              <Paperclip className="w-3 h-3" /> {item.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold ${st.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.bar}`} /> {st.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold ${pr.cls}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" /> {pr.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center px-3 shrink-0">
                      <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 pl-[80px]">
                      <div className="bg-gray-50/70 rounded-2xl p-4">
                        {renderThread(item, true)}
                      </div>
                      {!isAdmin && (
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                            Update status:
                          </span>
                          {(['in_progress', 'resolved'] as const).map(s => (
                            <button key={s} onClick={() => updateItem(item.id, { status: s as any })}
                              disabled={item.status === s}
                              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all disabled:opacity-50 ${
                                item.status === s
                                  ? `${STATUS_META[s].cls} border-transparent ring-2 ring-offset-1`
                                  : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                              }`}>
                              {STATUS_META[s].label}
                            </button>
                          ))}
                          {item.status === 'resolved' && (
                            <span className="text-[10px] font-semibold text-emerald-600">This feedback is resolved — thanks for acting on it.</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}