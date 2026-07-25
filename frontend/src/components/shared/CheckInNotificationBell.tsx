// Check-in notification bell - shows recent staff check-in/out events
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../api';
import { formatEthiopianTime } from '../../utils/ethiopianCalendar';
import { Bell, LogIn, LogOut, X } from 'lucide-react';

interface CheckInEvent {
  id: string;
  username: string;
  action: 'check-in' | 'check-out';
  timestamp: string;
  department: string;
}

export const CheckInNotificationBell = () => {
  const [events, setEvents] = useState<CheckInEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const fetchRecentEvents = useCallback(async () => {
    try {
      const data = await apiGet('/shifts/check-in-logs?limit=10');
      const newEvents: CheckInEvent[] = data.logs.map((log: any) => ({
        id: log.id,
        username: log.username,
        action: log.is_active ? 'check-in' : 'check-out',
        timestamp: log.is_active ? log.start_time : (log.end_time || log.start_time),
        department: log.department,
      }));
      setEvents(newEvents);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchRecentEvents();
    const handleStaffUpdate = () => {
      fetchRecentEvents();
      setUnread(prev => prev + 1);
    };
    window.addEventListener('staff-updated', handleStaffUpdate);
    return () => window.removeEventListener('staff-updated', handleStaffUpdate);
  }, [fetchRecentEvents]);

  const clearUnread = () => setUnread(0);

  return (
    <div className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) clearUnread(); }}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {events.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No recent activity</div>
              ) : (
                events.map(event => (
                  <div key={event.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        event.action === 'check-in' ? 'bg-emerald-100' : 'bg-orange-100'
                      }`}>
                        {event.action === 'check-in'
                          ? <LogIn className="w-4 h-4 text-emerald-600" />
                          : <LogOut className="w-4 h-4 text-orange-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{event.username}</p>
                        <p className="text-xs text-gray-500">
                          {event.action === 'check-in' ? 'Checked in' : 'Checked out'} · {event.department}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatEthiopianTime(new Date(event.timestamp), 'short')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
