import React, { createContext, useContext, useEffect, useState } from 'react';

interface SearchContextType {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [query, setQuery] = useState<string>('');

  // Optional: restore last search on load
  useEffect(() => {
    const saved = localStorage.getItem('isbar_search_query');
    if (saved) setQuery(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('isbar_search_query', query);
  }, [query]);

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = (): SearchContextType => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within a SearchProvider');
  return ctx;
};


