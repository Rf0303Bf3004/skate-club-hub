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
import it_segreteria from '@/locales/it/segreteria.json';
import it_superadmin from '@/locales/it/superadmin.json';
import it_portale from '@/locales/it/portale.json';
import it_corsi from '@/locales/it/corsi.json';
import it_istruttori from '@/locales/it/istruttori.json';
import it_planning from '@/locales/it/planning.json';
import it_calendario from '@/locales/it/calendario.json';

import fr_common from '@/locales/fr/common.json';
import fr_atleti from '@/locales/fr/atleti.json';
import fr_fatture from '@/locales/fr/fatture.json';
import fr_dashboard from '@/locales/fr/dashboard.json';
import fr_onboarding from '@/locales/fr/onboarding.json';
import fr_settings from '@/locales/fr/settings.json';
import fr_communications from '@/locales/fr/communications.json';
import fr_events from '@/locales/fr/events.json';
import fr_mobile from '@/locales/fr/mobile.json';
import fr_validation from '@/locales/fr/validation.json';
import fr_errors from '@/locales/fr/errors.json';
import fr_portale from '@/locales/fr/portale.json';
import fr_istruttori from '@/locales/fr/istruttori.json';
import fr_planning from '@/locales/fr/planning.json';
import fr_calendario from '@/locales/fr/calendario.json';

import de_common from '@/locales/de/common.json';
import de_atleti from '@/locales/de/atleti.json';
import de_fatture from '@/locales/de/fatture.json';
import de_dashboard from '@/locales/de/dashboard.json';
import de_onboarding from '@/locales/de/onboarding.json';
import de_settings from '@/locales/de/settings.json';
import de_communications from '@/locales/de/communications.json';
import de_events from '@/locales/de/events.json';
import de_mobile from '@/locales/de/mobile.json';
import de_validation from '@/locales/de/validation.json';
import de_errors from '@/locales/de/errors.json';
import de_portale from '@/locales/de/portale.json';
import de_istruttori from '@/locales/de/istruttori.json';
import de_planning from '@/locales/de/planning.json';
import de_calendario from '@/locales/de/calendario.json';

import en_common from '@/locales/en/common.json';
import en_atleti from '@/locales/en/atleti.json';
import en_fatture from '@/locales/en/fatture.json';
import en_dashboard from '@/locales/en/dashboard.json';
import en_onboarding from '@/locales/en/onboarding.json';
import en_settings from '@/locales/en/settings.json';
import en_communications from '@/locales/en/communications.json';
import en_events from '@/locales/en/events.json';
import en_mobile from '@/locales/en/mobile.json';
import en_validation from '@/locales/en/validation.json';
import en_errors from '@/locales/en/errors.json';
import en_portale from '@/locales/en/portale.json';
import en_istruttori from '@/locales/en/istruttori.json';
import en_planning from '@/locales/en/planning.json';
import en_calendario from '@/locales/en/calendario.json';

import rm_portale from '@/locales/rm/portale.json';
import rm_common from '@/locales/rm/common.json';
import rm_onboarding from '@/locales/rm/onboarding.json';

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
  'segreteria',
  'superadmin',
  'portale',
  'corsi',
  'istruttori',
  'planning',
  'calendario',
] as const;

export const SUPPORTED_LOCALES = ['it', 'de', 'fr', 'rm', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const resources = {
  it: {
    common: it_common, atleti: it_atleti, fatture: it_fatture, dashboard: it_dashboard,
    onboarding: it_onboarding, settings: it_settings, communications: it_communications,
    events: it_events, mobile: it_mobile, validation: it_validation, errors: it_errors,
    segreteria: it_segreteria, superadmin: it_superadmin, portale: it_portale,
    corsi: it_corsi, istruttori: it_istruttori, planning: it_planning, calendario: it_calendario,
  },
  fr: {
    common: fr_common, atleti: fr_atleti, fatture: fr_fatture, dashboard: fr_dashboard,
    onboarding: fr_onboarding, settings: fr_settings, communications: fr_communications,
    events: fr_events, mobile: fr_mobile, validation: fr_validation, errors: fr_errors,
    portale: fr_portale, istruttori: fr_istruttori, planning: fr_planning, calendario: fr_calendario,
  },
  de: {
    common: de_common, atleti: de_atleti, fatture: de_fatture, dashboard: de_dashboard,
    onboarding: de_onboarding, settings: de_settings, communications: de_communications,
    events: de_events, mobile: de_mobile, validation: de_validation, errors: de_errors,
    portale: de_portale, istruttori: de_istruttori, planning: de_planning, calendario: de_calendario,
  },
  en: {
    common: en_common, atleti: en_atleti, fatture: en_fatture, dashboard: en_dashboard,
    onboarding: en_onboarding, settings: en_settings, communications: en_communications,
    events: en_events, mobile: en_mobile, validation: en_validation, errors: en_errors,
    portale: en_portale, istruttori: en_istruttori, planning: en_planning, calendario: en_calendario,
  },
  rm: { common: rm_common, onboarding: rm_onboarding, portale: rm_portale },
};

/**
 * Lingua di partenza anche senza utente autenticato (pagine pubbliche):
 * 1) preferenza salvata, 2) lingua del browser se il portale la supporta
 * (l'inglese non e' mai un ripiego: i club sono in Ticino), 3) italiano.
 */
function lingua_iniziale(): SupportedLocale {
  try {
    const salvata = localStorage.getItem('app_language');
    if (salvata && (SUPPORTED_LOCALES as readonly string[]).includes(salvata)) {
      return salvata as SupportedLocale;
    }
  } catch { /* storage non disponibile */ }
  const lingue = typeof navigator !== 'undefined'
    ? [navigator.language, ...(navigator.languages ?? [])]
    : [];
  for (const l of lingue) {
    const corta = (l ?? '').slice(0, 2).toLowerCase();
    // 'en' escluso di proposito: si ricade sull'italiano.
    if (['it', 'de', 'fr', 'rm'].includes(corta)) return corta as SupportedLocale;
  }
  return 'it';
}

const chiavi_mancanti_viste = new Set<string>();

/** Avviso console per chiave di traduzione mancante, una sola volta per chiave. */
export function avvisa_chiave_mancante(namespace: string, chiave: string): void {
  const id = `${namespace}:${chiave}`;
  if (chiavi_mancanti_viste.has(id)) return;
  chiavi_mancanti_viste.add(id);
  console.warn(`[i18n] chiave mancante nel namespace "${namespace}": "${chiave}"`);
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: lingua_iniziale(),
      fallbackLng: 'it',
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      defaultNS: 'common',
      ns: NAMESPACES as unknown as string[],
      interpolation: { escapeValue: false },
      detection: {
        // Nessun rilevamento automatico: la lingua la decide `lingua_iniziale()`
        // (localStorage -> browser fra le lingue del portale -> italiano).
        order: [],
        caches: [],
      },
      returnNull: false,
      react: { useSuspense: false },
      // Una chiave mancante non deve comparire grezza a schermo senza lasciare
      // traccia: avviso in console, una sola volta per chiave (altrimenti si
      // ripete a ogni render e la console diventa illeggibile).
      missingKeyHandler: (lngs, ns, key) => {
        avvisa_chiave_mancante(String(ns), String(key));
      },
    });
}

export default i18n;
