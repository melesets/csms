// Unified notification bell - one bell, red count badge.
// Pure incoming-feedback notifications: new feedback addressed to you
// (admin: everything new; staff: targeted items + replies on your own feedback).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPut, apiPost } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { formatEthiopianTimestamp } from '../../utils/ethiopianCalendar';
import {
  Bell, MessageSquare, HeartPulse, Users, Package, Pill, Building2,
  ShieldAlert, MessagesSquare, MonitorSmartphone, HelpCircle, Check,
  ChevronRight, Reply
} from 'lucide-react';

const CATEGORY_ICON: Record<string, { icon: any; cls: string }> = {
  patient_care:  { icon: HeartPulse,       cls: 'bg-rose-50 text-rose-600' },
  staffing:      { icon: Users,            cls: 'bg-blue-50 text-blue-600' },
  equipment:     { icon: Package,          cls: 'bg-amber-50 text-amber-600' },
  medication:    { icon: Pill,             cls: 'bg-violet-50 text-violet-600' },
  facility:      { icon: Building2,        cls: 'bg-teal-50 text-teal-600' },
  safety:        { icon: ShieldAlert,      cls: 'bg-red-50 text-red-600' },
  communication: { icon: MessagesSquare,   cls: 'bg-cyan-50 text-cyan-600' },
  information:   { icon: MonitorSmartphone, cls: 'bg-indigo-50 text-indigo-600' },
  other:         { icon: HelpCircle,       cls: 'bg-gray-100 text-gray-600' },
};

interface FeedItem {
  id: number;
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
  replyCount: number;
  createdAt: string;
}

interface FeedItem {
  id: number;
  userId: number;
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
  replyCount: number;
  hasNewReply: boolean;
  createdAt: string;
}

export const NotificationBell = ({ onNavigate }: { onNavigate?: (page: string) => void }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet('/feedback/unread-count');
      setUnread(data.count || 0);
      if (openRef.current) {
        const recent = await apiGet('/feedback/recent?limit=8');
        setItems(recent || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const iv = window.setInterval(refresh, 30000);
    const onFeedback = () => refresh();
    window.addEventListener('feedback-updated', onFeedback);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('feedback-updated', onFeedback);
    };
  }, [refresh]);

  const openDropdown = async () => {
    openRef.current = true;
    setIsOpen(true);
    try {
      const recent = await apiGet('/feedback/recent?limit=8');
      setItems(recent || []);
    } catch {}
  };

  const closeDropdown = () => {
    openRef.current = false;
    setIsOpen(false);
  };

  const handleItem = async (item: FeedItem) => {
    if (isAdmin) {
      try { await apiPut(`/feedback/${item.id}`, { isRead: true }); } catch {}
    } else {
      try { await apiPost(`/feedback/${item.id}/seen`); } catch {}
    }
    setUnread(prev => Math.max(0, prev - 1));
    setItems(prev => prev.filter(i => i.id !== item.id));
    closeDropdown();
    onNavigate?.('feedback');
  };

  return (
    <div className="relative">
      <button
        onClick={() => { isOpen ? closeDropdown() : openDropdown(); }}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeDropdown} />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {isAdmin ? 'Notifications' : 'Notifications'}
                </h3>
                <p className="text-[10px] text-gray-400">
                  {unread > 0
                    ? `${unread} unread ${unread === 1 ? 'item' : 'items'}`
                    : 'You are all caught up'}
                </p>
              </div>
              <button onClick={closeDropdown} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition">
                <Check className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {/* Incoming feedback notifications */}
              <div className="px-4 pt-3 pb-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                Incoming Feedback
              </div>
              {items.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <MessageSquare className="w-7 h-7 text-gray-200 mx-auto mb-1.5" />
                  <p className="text-xs text-gray-400">
                    {isAdmin ? 'No unread feedback' : 'No new incoming feedback'}
                  </p>
                </div>
              ) : items.map(item => {
                const cat = CATEGORY_ICON[item.category] || CATEGORY_ICON.other;
                const isOwnReply = !isAdmin && item.userId === user?.id;
                return (
                  <button key={item.id} onClick={() => handleItem(item)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50/70 transition-colors flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cat.cls}`}>
                      {(() => { const I = cat.icon; return <I className="w-4 h-4" />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-gray-900 truncate">{item.subject}</p>
                        {isOwnReply && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold text-blue-700 bg-blue-50 shrink-0">
                            <Reply className="w-2.5 h-2.5" /> replied
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">
                        {isAdmin
                          ? `${item.userName}${item.department ? ` · ${item.department}` : ''}${item.targetUserId && item.targetUserName ? ` → ${item.targetUserName}` : item.targetProfession ? ` → ${item.targetProfession}${item.targetDepartment ? ` · ${item.targetDepartment}` : ''}` : item.targetRole ? ` → ${item.targetRole}s` : item.targetDepartment ? ` → ${item.targetDepartment}` : ''}`
                          : isOwnReply
                            ? `New reply from ${item.replyCount ? 'your team' : 'the team'} · ${item.department || 'Administration'}`
                            : `New feedback for ${item.targetUserId && item.targetUserName ? 'you' : item.targetProfession ? item.targetProfession + 's' : item.targetRole ? item.targetRole + 's' : 'all staff'}`}
                      </p>
                      <p className="text-[9px] text-gray-400">{formatEthiopianTimestamp(item.createdAt)}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  </button>
                );
              })}
            </div>

            <button onClick={() => { closeDropdown(); onNavigate?.('feedback'); }}
              className="w-full py-2.5 text-[11px] font-bold text-[#003153] hover:bg-[#003153]/5 border-t border-gray-100 transition-colors">
              Open Feedback Page
            </button>
          </div>
        </>
      )}
    </div>
  );
};