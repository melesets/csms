import React, { createContext, useContext, useEffect, useState } from 'react';

export type ShiftType = 'Morning' | 'Evening' | 'Night' | 'All';

interface ShiftContextType {
  shift: ShiftType;
  setShift: (s: ShiftType) => void;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shift, setShift] = useState<ShiftType>('All');

  useEffect(() => {
    const saved = localStorage.getItem('isbar_shift');
    if (saved === 'Morning' || saved === 'Evening' || saved === 'Night' || saved === 'All') {
      setShift(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('isbar_shift', shift);
  }, [shift]);

  return (
    <ShiftContext.Provider value={{ shift, setShift }}>
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = (): ShiftContextType => {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be used within a ShiftProvider');
  return ctx;
};


