import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getByPath, interpolate, LOCALES, translations } from './translations';

const STORAGE_KEY = 'bcl.locale';

const I18nContext = createContext(null);

export function I18nProvider({ children, initialLocale = 'vi' }) {
  const [locale, setLocaleState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (LOCALES.includes(saved)) return saved;
    } catch {
      /* ignore */
    }
    return LOCALES.includes(initialLocale) ? initialLocale : 'vi';
  });

  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (path, vars) => {
      let p = path;
      if (typeof p === 'string' && (p.startsWith('days.') || p.startsWith('daysFull.'))) {
        const parts = p.split('.');
        if (parts.length > 1) {
          p = parts[0] + '.' + parts[1].toLowerCase();
        }
      }
      const primary = getByPath(translations[locale], p);
      const fallback = getByPath(translations.en, p);
      const raw = primary ?? fallback ?? path;
      return typeof raw === 'string' ? interpolate(raw, vars) : raw;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, locales: LOCALES }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

