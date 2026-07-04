// Screen context - provides screen size detection and context-aware data for AI
import React, { createContext, useContext, useRef, ReactNode, useCallback } from 'react';

interface ScreenContextType {
  getScreenTitle: () => string;
  getScreenData: () => Record<string, any>;
  getScreenFields: () => Array<{ name: string; label: string; type: string }>;
  setScreenContext: (title: string, data: Record<string, any>, fields?: Array<{ name: string; label: string; type: string }>) => void;
  clearScreenContext: () => void;
}

const ScreenContext = createContext<ScreenContextType | undefined>(undefined);

export const ScreenProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use refs for everything to prevent any global re-renders
  const screenTitleRef = useRef<string>('');
  const screenDataRef = useRef<Record<string, any>>({});
  const screenFieldsRef = useRef<Array<{ name: string; label: string; type: string }>>([]);

  const setScreenContext = useCallback((title: string, data: Record<string, any>, fields: Array<{ name: string; label: string; type: string }> = []) => {
    screenTitleRef.current = title;
    screenDataRef.current = data;
    screenFieldsRef.current = fields;
  }, []);

  const getScreenTitle = useCallback(() => screenTitleRef.current, []);
  const getScreenData = useCallback(() => screenDataRef.current, []);
  const getScreenFields = useCallback(() => screenFieldsRef.current, []);

  const clearScreenContext = useCallback(() => {
    screenTitleRef.current = '';
    screenDataRef.current = {};
    screenFieldsRef.current = [];
  }, []);

  return (
    <ScreenContext.Provider value={{ 
      getScreenTitle,
      getScreenData, 
      getScreenFields, 
      setScreenContext, 
      clearScreenContext 
    }}>
      {children}
    </ScreenContext.Provider>
  );
};

export const useScreenContext = () => {
  const context = useContext(ScreenContext);
  if (context === undefined) {
    throw new Error('useScreenContext must be used within a ScreenProvider');
  }
  return context;
};
