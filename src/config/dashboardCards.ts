/**
 * I riquadri della Dashboard.
 *
 * Regola: un riquadro esiste solo se risponde a «cosa devo fare oggi».
 * Come è organizzato il club sta in Setup, non qui.
 *
 * Questo elenco contiene SOLO i blocchi che `DashboardPage.tsx` disegna davvero,
 * ciascuno con il suo `codice`. Ogni destinazione è una rotta che esiste in
 * `App.tsx`: se un riquadro non ha una pagina dove approfondire, `destinazione`
 * è `null` e il riquadro non è cliccabile.
 *
 * Il presidente ha una Dashboard sua (`PresidentDashboard.tsx`): non è
 * configurabile da qui e non compare in `RUOLI_DASHBOARD`.
 */

/** Raggruppamento per urgenza di chi guarda, non per area del club. */
export type GruppoDashboard = 'da_fare' | 'oggi' | 'andamento';

export interface DashboardCard {
  codice: string;
  gruppo: GruppoDashboard;
  /** Rotta esistente in App.tsx, oppure null se il riquadro non è cliccabile. */
  destinazione: string | null;
  icona: string;
}

export interface GruppoConfig {
  codice: GruppoDashboard;
  /** Chiave i18n nel namespace `settings`. */
  chiave_label: string;
  classi_intestazione: string;
}

export interface RuoloConfig {
  codice: string;
  /** Chiave i18n nel namespace `settings`. */
  chiave_label: string;
}

export const CARDS: DashboardCard[] = [
  // ─── Da fare: aspettano una decisione ───────────────────
  {
    codice: 'richieste_iscrizione',
    gruppo: 'da_fare',
    destinazione: '/richieste-iscrizione',
    icona: 'UserPlus',
  },
  {
    codice: 'richieste_private',
    gruppo: 'da_fare',
    destinazione: '/lezioni-private?tab=richieste',
    icona: 'MessageSquarePlus',
  },
  {
    codice: 'fatture_scadenza',
    gruppo: 'da_fare',
    destinazione: '/fatture',
    icona: 'AlertTriangle',
  },

  // ─── Oggi: cosa succede nelle prossime ore ──────────────
  {
    codice: 'agenda_giorno',
    gruppo: 'oggi',
    destinazione: null,
    icona: 'Clock',
  },
  {
    codice: 'compleanni_oggi',
    gruppo: 'oggi',
    destinazione: null,
    icona: 'Cake',
  },
  {
    codice: 'compleanni_settimana',
    gruppo: 'oggi',
    destinazione: '/atleti',
    icona: 'Gift',
  },
  {
    codice: 'istruttori_oggi',
    gruppo: 'oggi',
    destinazione: '/istruttori',
    icona: 'UserCheck',
  },
  {
    codice: 'comunicazione_rapida',
    gruppo: 'oggi',
    destinazione: null,
    icona: 'Send',
  },

  // ─── Andamento: numeri da tenere d'occhio ───────────────
  {
    codice: 'kpi_atleti_attivi',
    gruppo: 'andamento',
    destinazione: '/atleti',
    icona: 'Users',
  },
  {
    codice: 'kpi_corsi_attivi',
    gruppo: 'andamento',
    destinazione: '/corsi',
    icona: 'BookOpen',
  },
  {
    codice: 'kpi_prossime_gare',
    gruppo: 'andamento',
    destinazione: '/gare',
    icona: 'Trophy',
  },
  {
    codice: 'kpi_da_incassare',
    gruppo: 'andamento',
    destinazione: '/fatture',
    icona: 'CreditCard',
  },
  {
    codice: 'prossime_gare',
    gruppo: 'andamento',
    destinazione: '/gare',
    icona: 'CalendarCheck',
  },
  {
    codice: 'medagliere',
    gruppo: 'andamento',
    destinazione: '/medagliere',
    icona: 'Medal',
  },
  {
    codice: 'ultime_iscrizioni',
    gruppo: 'andamento',
    destinazione: '/atleti',
    icona: 'UserCheck2',
  },
  {
    codice: 'ultime_comunicazioni',
    gruppo: 'andamento',
    destinazione: '/comunicazioni',
    icona: 'Inbox',
  },
];

export const GRUPPI: GruppoConfig[] = [
  {
    codice: 'da_fare',
    chiave_label: 'roles.dashboard_cards.gruppi.da_fare',
    classi_intestazione: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    codice: 'oggi',
    chiave_label: 'roles.dashboard_cards.gruppi.oggi',
    classi_intestazione: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  {
    codice: 'andamento',
    chiave_label: 'roles.dashboard_cards.gruppi.andamento',
    classi_intestazione: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
];

/** Il presidente non c'è: la sua Dashboard è un'altra pagina. */
export const RUOLI_DASHBOARD: RuoloConfig[] = [
  { codice: 'segreteria', chiave_label: 'roles.dashboard_cards.ruoli.segreteria' },
  { codice: 'dt', chiave_label: 'roles.dashboard_cards.ruoli.dt' },
  { codice: 'istruttore', chiave_label: 'roles.dashboard_cards.ruoli.istruttore' },
  { codice: 'aiuto_monitore', chiave_label: 'roles.dashboard_cards.ruoli.aiuto_monitore' },
];

export const TUTTI_I_CODICI: string[] = CARDS.map((c) => c.codice);

/**
 * Valori di partenza per ruolo.
 * Valgono finché il club non ha mai configurato la matrice: una tabella vuota
 * significa «mai configurato», non «tutto spento».
 */
export const CARDS_DEFAULT_PER_RUOLO: Record<string, string[]> = {
  // Chi tiene la segreteria: iscrizioni, soldi, compleanni, comunicazioni.
  segreteria: [
    'richieste_iscrizione',
    'fatture_scadenza',
    'compleanni_oggi',
    'compleanni_settimana',
    'agenda_giorno',
    'comunicazione_rapida',
    'ultime_comunicazioni',
  ],
  // Direzione tecnica: niente fatture, niente iscrizioni.
  dt: [
    'richieste_private',
    'agenda_giorno',
    'istruttori_oggi',
    'compleanni_oggi',
    'compleanni_settimana',
    'prossime_gare',
    'kpi_prossime_gare',
  ],
  // Chi sta sul ghiaccio: la propria giornata e i compleanni.
  istruttore: ['agenda_giorno', 'compleanni_oggi', 'compleanni_settimana'],
  aiuto_monitore: ['agenda_giorno', 'compleanni_oggi', 'compleanni_settimana'],
  // Amministrazione: tutto.
  admin: TUTTI_I_CODICI,
  superadmin: TUTTI_I_CODICI,
};

/** Vero se quel ruolo vede quel riquadro quando la matrice non è mai stata configurata. */
export function card_visibile_di_default(ruolo: string | null | undefined, codice: string): boolean {
  if (!ruolo) return false;
  const def = CARDS_DEFAULT_PER_RUOLO[ruolo];
  if (!def) return false;
  return def.includes(codice);
}
