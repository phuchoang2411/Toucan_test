import { createContext, Fragment, useCallback, useContext, useState, type ReactNode } from 'react';
import { getLocale, setLocale as setModuleLocale, type Locale } from '../strings';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({ locale: getLocale(), setLocale: () => {} });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  const setLocale = useCallback((next: Locale) => {
    setModuleLocale(next);
    localStorage.setItem('locale', next);
    setLocaleState(next);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {/* Keying on locale remounts the subtree so every t()/labelFor() call
          re-evaluates with the new language — t() reads a plain module
          variable, not React state, so a normal re-render wouldn't pick up
          the change on its own. */}
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
