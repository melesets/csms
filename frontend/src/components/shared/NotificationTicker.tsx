// NotificationTicker - smart running-text notifications in the app header.
// Replaces the feedback bell: scrolls feedback alerts (new submissions for
// admins, responses for givers) and fresh check-in/out activity as a marquee.
// Click the strip to open the Feedback page. Hidden when nothing to show.
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { formatEthiopianTime } from '../../utils/ethiopianCalendar';
import { Megaphone, MessageSquare } from 'lucide-react';

interface FeedItem {
  id: number;
  userName: string;
  subject: string;
}

interface CheckInEvent {
  id: string;
  username: string;
  action: 'check-in' | 'check-out';
  timestamp: string;
  department: string;
}

export const NotificationTicker = ({ onNavigate }: { onNavigate?: (page: string) => void }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [events, setEvents] = useState<CheckInEvent[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet('/feedback/unread-count');
      setUnread(data.count || 0);
    } catch {}
    try {
      const recent = await apiGet('/feedback/recent?limit=5');
      setItems((recent || []).map((i: any) => ({ id: i.id, userName: i.userName, subject: i.subject })));
    } catch {}
    try {
      const data = await apiGet('/shifts/check-in-logs?limit=8');
      setEvents((data.logs || []).map((log: any) => ({
        id: log.id,
        username: log.username,
        action: log.is_active ? 'check-in' : 'check-out',
        timestamp: log.is_active ? log.start_time : (log.end_time || log.start_time),
        department: log.department,
      })));
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

  // Build the smart message list — only show what matters right now
  const messages: string[] = [];
  if (unread > 0) {
    messages.push(isAdmin
      ? `You have ${unread} new feedback submission${unread > 1 ? 's' : ''}`
      : `You have ${unread} new response${unread > 1 ? 's' : ''} to your feedback`);
    items.slice(0, 3).forEach(i => messages.push(isAdmin ? `${i.userName}: "${i.subject}"` : `Your feedback: "${i.subject}"`));
  }
  const freshCutoff = Date.now() - 15 * 60 * 1000;
  events.filter(e => new Date(e.timestamp).getTime() > freshCutoff).slice(0, 3)
    .forEach(e => messages.push(`${e.username} ${e.action === 'check-in' ? 'checked in' : 'checked out'} · ${e.department}`));

  if (messages.length === 0) return null;

  const line = messages.join('   •   ');

  return (
    <button
      onClick={() => onNavigate?.('feedback')}
      className="w-full bg-[#003153] text-white text-[11px] font-semibold flex items-center overflow-hidden hover:bg-[#002640] transition-colors"
      title="Running notifications — click to open Feedback"
    >
      <span className="shrink-0 flex items-center gap-1.5 px-3 h-8 bg-[#0a4a7a]">
        <Megaphone className="w-3.5 h-3.5 text-amber-300" />
        <span className="hidden sm:inline">Updates</span>
      </span>
      <span className="relative flex-1 overflow-hidden whitespace-nowrap h-8 group">
        <span className="notification-marquee">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap pr-10">
            {unread > 0 && <MessageSquare className="w-3.5 h-3.5 text-sky-300 animate-pulse shrink-0" />}
            {line}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap pr-10" aria-hidden>
            {unread > 0 && <MessageSquare className="w-3.5 h-3.5 text-sky-300 animate-pulse shrink-0" />}
            {line}
          </span>
        </span>
      </span>
    </button>
  );
};