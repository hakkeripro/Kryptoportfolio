import { createContext, useContext, useState, type ReactNode } from 'react';
import { translations, type Lang } from './translations';

const STORAGE_KEY = 'pl-lang';
const SUPPORTED: Lang[] = ['en', 'fi'];

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {
    // localStorage not available
  }
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser as Lang) ? (browser as Lang) : 'en';
}

type T = (typeof translations)['en'];

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = (l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
    setLangState(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] as T }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
