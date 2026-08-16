// Shift management context - current shift, active sessions, and shift operations
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { apiGet } from '../api';

export type ShiftType = 'Morning' | 'Afternoon' | 'Night' | 'Day' | 'Evening' | 'All' | string;

export interface ShiftContextData {
  current: ShiftType;
  incoming?: ShiftType;
  isHandoverWindow: boolean;
  minutesToHandover: number | null;
  handoverWindowMinutes?: number;
}

interface ShiftContextType {
  shift: ShiftType;
  setShift: (s: ShiftType) => void;
  shiftContext: ShiftContextData;
  activeSession: any | null; // Keep for backwards compatibility within components, but typically unitSession handles this
  loading: boolean;
  refreshShiftContext: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [shift, setShift] = useState<ShiftType>('All');
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [shiftContext, setShiftContext] = useState<ShiftContextData>({
    current: 'All',
    isHandoverWindow: false,
    minutesToHandover: null
  });

  const refreshShiftContext = useCallback(async () => {
    if (!user || !user.department || user.role === 'admin') {
      setShiftContext({ current: 'All', isHandoverWindow: false, minutesToHandover: null });
      setShift('All');
      return;
    }

    try {
      const data = await apiGet(`/shifts/context?department=${encodeURIComponent(user.department)}`);
      setShiftContext(data);
      setShift(data.current);
    } catch (err: any) {
      if (err?.status === 401) return;
      console.error('Failed to refresh shift context:', err);
    }
  }, [user]);

  useEffect(() => {
    refreshShiftContext();
    // Sync shift context every 1 minute
    const timer = setInterval(() => {
      refreshShiftContext();
    }, 60000);
    return () => clearInterval(timer);
  }, [refreshShiftContext]);

  useEffect(() => {
    const loadActiveSession = async () => {
      if (!user || user.role === 'admin' || user.role === 'superadmin') {
        setActiveSession(null);
        return;
      }
      try {
        const data = await apiGet(`/shifts/active-staff/${encodeURIComponent(user.department || '')}`);
        const mine = (data || []).find(
          (s: any) => s.session_id && String(s.username).toLowerCase() === String(user.username).toLowerCase()
        );
        if (mine) {
          const session = {
            id: mine.session_id,
            ward: mine.department,
            shiftName: mine.shift_name,
            username: mine.username,
            name: mine.name,
            profession: mine.profession,
          };
          setActiveSession(session);
          localStorage.setItem('active_shift_session', JSON.stringify(session));
        } else {
          setActiveSession(null);
          localStorage.removeItem('active_shift_session');
        }
      } catch (err) {
        console.error('Failed to load active shift session:', err);
      }
    };

    loadActiveSession();
    // Re-sync when admin checks staff in/out or when user changes
    window.addEventListener('staff-updated', loadActiveSession);
    const timer = setInterval(loadActiveSession, 30000);
    setLoading(false);
    return () => {
      window.removeEventListener('staff-updated', loadActiveSession);
      clearInterval(timer);
    };
  }, [user]);

  return (
    <ShiftContext.Provider value={{ 
      shift, 
      setShift, 
      shiftContext, 
      activeSession, 
      loading, 
      refreshShiftContext 
    }}>
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = (): ShiftContextType => {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be used within a ShiftProvider');
  return ctx;
};