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
      // Fallback for admin or logged-out
      setShiftContext({ current: 'All', isHandoverWindow: false, minutesToHandover: null });
      setShift('All');
      return;
    }

    try {
      const data = await apiGet(`/shifts/context?department=${encodeURIComponent(user.department)}`);
      setShiftContext(data);
      setShift(data.current);
    } catch (err) {
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
    // Backwards compatibility for activeSession
    const stored = localStorage.getItem('active_shift_session');
    if (stored) {
      setActiveSession(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

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