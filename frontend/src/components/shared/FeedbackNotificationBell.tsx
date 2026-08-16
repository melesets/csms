// Feedback notification bell - live badge + dropdown for both sides:
// admins see incoming (unread) feedback; givers see new replies/status responses.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPut, apiPost } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { formatEthiopianTimestamp } from '../../utils/ethiopianCalendar';
import {
  Bell, MessageSquare, HeartPulse, Users, Package, Pill, Building2,
  ShieldAlert, MessagesSquare, MonitorSmartphone, HelpCircle, Check, ChevronRight
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
  category: string;
  subject: string;
  replyCount: number;
  createdAt: string;
}

export const FeedbackNotificationBell = ({ onNavigate }: { onNavigate?: (page: string) => void }) => {
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
    const onUpdate = () => refresh();
    window.addEventListener('feedback-updated', onUpdate);
    window.addEventListener('staff-updated', onUpdate);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('feedback-updated', onUpdate);
      window.removeEventListener('staff-updated', onUpdate);
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
      setUnread(prev => Math.max(0, prev - 1));
      setItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      try { await apiPost(`/feedback/${item.id}/seen`); } catch {}
      setUnread(prev => Math.max(0, prev - 1));
      setItems(prev => prev.filter(i => i.id !== item.id));
    }
    closeDropdown();
    onNavigate?.('feedback');
  };

  return (
    <div className="relative">
      <button
        onClick={() => { isOpen ? closeDropdown() : openDropdown(); }}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
        title={isAdmin ? 'Incoming feedback' : 'Feedback responses'}
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
                  {isAdmin ? 'Incoming Feedback' : 'Feedback Responses'}
                </h3>
                <p className="text-[10px] text-gray-400">
                  {unread} {unread === 1 ? (isAdmin ? 'new submission' : 'response') : (isAdmin ? 'new submissions' : 'responses')}
                </p>
              </div>
              <button onClick={closeDropdown} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition">
                <Check className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {items.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    {isAdmin ? 'No unread feedback' : 'No new responses'}
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">
                    {isAdmin ? 'New submissions will appear here' : 'Replies to your feedback will appear here'}
                  </p>
                </div>
              ) : items.map(item => {
                const cat = CATEGORY_ICON[item.category] || CATEGORY_ICON.other;
                return (
                  <button key={item.id} onClick={() => handleItem(item)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50/70 transition-colors flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cat.cls}`}>
                      {(() => { const I = cat.icon; return <I className="w-4 h-4" />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.subject}</p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {isAdmin
                          ? `${item.userName}${item.department ? ` · ${item.department}` : ''}`
                          : 'The team has responded'}
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