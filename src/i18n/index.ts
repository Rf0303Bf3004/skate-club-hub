import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import it_common from '@/locales/it/common.json';
import it_atleti from '@/locales/it/atleti.json';
import it_fatture from '@/locales/it/fatture.json';
import it_dashboard from '@/locales/it/dashboard.json';
import it_onboarding from '@/locales/it/onboarding.json';
import it_settings from '@/locales/it/settings.json';
import it_communications from '@/locales/it/communications.json';
import it_events from '@/locales/it/events.json';
import it_mobile from '@/locales/it/mobile.json';
import it_validation from '@/locales/it/validation.json';
import it_errors from '@/locales/it/errors.json';

export const NAMESPACES = [
  'common',
  'atleti',
  'fatture',
  'dashboard',
  'onboarding',
  'settings',
  'communications',
  'events',
  'mobile',
  'validation',
  'errors',
] as const;

export const SUPPORTED_LOCALES = ['it', 'de', 'fr', 'rm', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const resources = {
  it: {
    common: it_common,
    atleti: it_atleti,
    fatture: it_fatture,
    dashboard: it_dashboard,
    onboarding: it_onboarding,
    settings: it_settings,
    communications: it_communications,
    events: it_events,
    mobile: it_mobile,
    validation: it_validation,
    errors: it_errors,
  },
  // Slot riservati per Step 2 (FR/DE/EN) e RM (mantenuto per retrocompatibilità,
  // tradurrà via fallback a IT finché non popolato).
  de: {},
  fr: {},
  rm: {},
  en: {},
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: undefined, // lasciato al detector
      fallbackLng: 'it',
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      defaultNS: 'common',
      ns: NAMESPACES as unknown as string[],
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'app_language',
        caches: ['localStorage'],
      },
      returnNull: false,
      react: { useSuspense: false },
    });
}

export default i18n;
