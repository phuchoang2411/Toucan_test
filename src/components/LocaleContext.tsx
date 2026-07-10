import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { setLocale } from '../strings';

const LocaleContext = createContext<'en' | 'vi'>('vi');

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale] = useState<'en' | 'vi'>(() => {
    return (localStorage.getItem('locale') as 'en' | 'vi') ?? 'vi';
  });

  useEffect(() => {
    setLocale(locale);
    localStorage.setItem('locale', locale);
  }, [locale]);

  return (
    <LocaleContext.Provider value={locale}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
