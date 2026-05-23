/**
 * Shim retrocompatibile sopra react-i18next.
 *
 * Mantiene l'API legacy (`useI18n`, `t`, `set_locale`, `LOCALE_LABELS`, `Locale`,
 * `I18nProvider`) usata dai file pre-esistenti senza richiedere refactor immediato.
 *
 * Le chiavi flat legacy (es. `t('salva')`) vengono cercate nel namespace `common`.
 * I nuovi file devono usare direttamente `useTranslation('namespace')` di react-i18next
 * con chiavi gerarchiche (es. `t('list.title')`).
 *
 * L'interpolazione legacy `{0}, {1}, ...` viene tradotta in post-processing per
 * compatibilità (i18next nativo usa `{{name}}`).
 */
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LOCALES } from '@/i18n';

export type Locale = 'it' | 'de' | 'fr' | 'rm' | 'en';

interface I18nContextType {
  locale: Locale;
  set_locale: (l: Locale) => void;
  t: (key: string, ...args: string[]) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'it',
  set_locale: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t: i18nT, i18n: i18nInstance } = useTranslation('common');
  const [locale, set_locale_state] = useState<Locale>((i18nInstance.language?.slice(0, 2) as Locale) || 'it');

  useEffect(() => {
    const handler = (lng: string) => {
      const short = (lng?.slice(0, 2) || 'it') as Locale;
      if ((SUPPORTED_LOCALES as readonly string[]).includes(short)) set_locale_state(short);
    };
    i18nInstance.on('languageChanged', handler);
    return () => { i18nInstance.off('languageChanged', handler); };
  }, [i18nInstance]);

  const set_locale = useCallback((l: Locale) => {
    i18n.changeLanguage(l);
    try { localStorage.setItem('app_language', l); } catch { /* no-op */ }
  }, []);

  const t = useCallback((key: string, ...args: string[]) => {
    // Cerca prima nel namespace di default (common), con fallback al key stesso
    let text = i18nT(key, { defaultValue: key }) as string;
    // Interpolazione legacy {0}, {1}, ...
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, String(arg ?? ''));
    });
    return text;
  }, [i18nT]);

  return (
    <I18nContext.Provider value={{ locale, set_locale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

export const LOCALE_LABELS: Record<Locale, string> = {
  it: 'Italiano',
  de: 'Deutsch',
  fr: 'Français',
  rm: 'Rumantsch',
  en: 'English',
};
