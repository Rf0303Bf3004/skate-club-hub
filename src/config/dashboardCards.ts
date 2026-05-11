export type AreaDashboard =
  | 'finanziaria'
  | 'atleti'
  | 'sportiva'
  | 'operativa'
  | 'ghiaccio'
  | 'comunicazioni';

export interface DashboardCard {
  codice: string;
  area: AreaDashboard;
  titolo: string;
  descrizione: string;
  destinazioneClick: string;
  cliccabile: boolean;
  icona: string;
}

export interface AreaConfig {
  codice: AreaDashboard;
  label: string;
  colore: string;
}

export interface RuoloConfig {
  codice: string;
  label: string;
}

export const CARDS: DashboardCard[] = [
  // FINANZIARIA (7)
  {
    codice: 'fatturato_mese',
    area: 'finanziaria',
    titolo: 'Fatturato mese',
    descrizione: 'CHF totale fatture emesse mese corrente',
    destinazioneClick: '/fatture?filtro=mese',
    cliccabile: true,
    icona: 'Banknote',
  },
  {
    codice: 'fatturato_anno',
    area: 'finanziaria',
    titolo: 'Fatturato anno',
    descrizione: 'CHF totale stagione',
    destinazioneClick: '/fatture?filtro=stagione',
    cliccabile: true,
    icona: 'TrendingUp',
  },
  {
    codice: 'da_incassare',
    area: 'finanziaria',
    titolo: 'Da incassare',
    descrizione: 'CHF + n fatture in attesa',
    destinazioneClick: '/fatture?filtro=da_pagare',
    cliccabile: true,
    icona: 'Wallet',
  },
  {
    codice: 'fatture_scadute',
    area: 'finanziaria',
    titolo: 'Fatture scadute',
    descrizione: 'n + CHF scadute',
    destinazioneClick: '/fatture?filtro=scadute',
    cliccabile: true,
    icona: 'AlertCircle',
  },
  {
    codice: 'cash_flow',
    area: 'finanziaria',
    titolo: 'Cash flow proiettato',
    descrizione: 'grafico 3 mesi avanti',
    destinazioneClick: '/fatture?vista=calendario',
    cliccabile: true,
    icona: 'BarChart3',
  },
  {
    codice: 'compensi_mese',
    area: 'finanziaria',
    titolo: 'Compensi del mese',
    descrizione: 'CHF da pagare a istruttori e monitori',
    destinazioneClick: '/compensi?mese=corrente',
    cliccabile: true,
    icona: 'CreditCard',
  },
  {
    codice: 'fatturato_yoy',
    area: 'finanziaria',
    titolo: 'Fatturato YoY',
    descrizione: 'confronto stagione vs precedente',
    destinazioneClick: '/fatture?vista=confronto',
    cliccabile: true,
    icona: 'Scale',
  },

  // ATLETI (5)
  {
    codice: 'atleti_attivi',
    area: 'atleti',
    titolo: 'Atleti attivi',
    descrizione: 'conteggio totale',
    destinazioneClick: '/atleti?filtro=attivi',
    cliccabile: true,
    icona: 'Users',
  },
  {
    codice: 'atleti_yoy',
    area: 'atleti',
    titolo: 'Atleti YoY',
    descrizione: 'stagione corrente vs precedente',
    destinazioneClick: '/atleti?vista=confronto',
    cliccabile: true,
    icona: 'UserCheck',
  },
  {
    codice: 'distribuzione_livelli',
    area: 'atleti',
    titolo: 'Distribuzione per livello',
    descrizione: 'grafico a barre',
    destinazioneClick: '/atleti?vista=per_livello',
    cliccabile: true,
    icona: 'LayoutGrid',
  },
  {
    codice: 'compleanni_30gg',
    area: 'atleti',
    titolo: 'Compleanni 30 giorni',
    descrizione: 'lista prossimi',
    destinazioneClick: '/atleti?vista=compleanni',
    cliccabile: true,
    icona: 'Cake',
  },
  {
    codice: 'tessere_sis_scadenza',
    area: 'atleti',
    titolo: 'Tessere SIS in scadenza',
    descrizione: 'n atleti con licenza < 60gg',
    destinazioneClick: '/atleti?filtro=sis_scadenza',
    cliccabile: true,
    icona: 'ShieldAlert',
  },

  // SPORTIVA (6)
  {
    codice: 'atleti_pronti_test',
    area: 'sportiva',
    titolo: 'Atleti pronti per test',
    descrizione: 'n fermi sullo stesso livello',
    destinazioneClick: '/test-livello?vista=candidati',
    cliccabile: true,
    icona: 'Medal',
  },
  {
    codice: 'medagliere',
    area: 'sportiva',
    titolo: 'Medagliere stagione',
    descrizione: 'top atleti per podi',
    destinazioneClick: '/risultati-gara?vista=medagliere',
    cliccabile: true,
    icona: 'Trophy',
  },
  {
    codice: 'prossime_gare',
    area: 'sportiva',
    titolo: 'Prossime gare',
    descrizione: 'lista 5 con countdown',
    destinazioneClick: '/gare-calendario',
    cliccabile: true,
    icona: 'CalendarCheck',
  },
  {
    codice: 'da_iscrivere_gare',
    area: 'sportiva',
    titolo: 'Atleti da iscrivere a gare aperte',
    descrizione: 'n',
    destinazioneClick: '/iscrizioni-gare?filtro=non_iscritti',
    cliccabile: true,
    icona: 'ClipboardList',
  },
  {
    codice: 'storico_gare_stagione',
    area: 'sportiva',
    titolo: 'Storico gare stagione',
    descrizione: 'gare disputate',
    destinazioneClick: '/gare-calendario?filtro=disputate',
    cliccabile: true,
    icona: 'History',
  },
  {
    codice: 'risultati_yoy',
    area: 'sportiva',
    titolo: 'Risultati gara YoY',
    descrizione: 'podi/top5/top10 vs anno scorso',
    destinazioneClick: '/risultati-gara?vista=confronto',
    cliccabile: true,
    icona: 'BarChart4',
  },

  // OPERATIVA (5)
  {
    codice: 'iscrizioni_pendenti',
    area: 'operativa',
    titolo: 'Iscrizioni pendenti',
    descrizione: 'n da approvare',
    destinazioneClick: '/richieste-iscrizione',
    cliccabile: true,
    icona: 'UserPlus',
  },
  {
    codice: 'richieste_private',
    area: 'operativa',
    titolo: 'Richieste lezioni private',
    descrizione: 'n da approvare',
    destinazioneClick: '/lezioni-private?filtro=da_approvare',
    cliccabile: true,
    icona: 'MessageSquarePlus',
  },
  {
    codice: 'istruttori_oggi',
    area: 'operativa',
    titolo: 'Istruttori disponibili oggi',
    descrizione: 'lista con ore',
    destinazioneClick: '/planning-istruttori',
    cliccabile: true,
    icona: 'UserCheck2',
  },
  {
    codice: 'carico_istruttori',
    area: 'operativa',
    titolo: 'Carico ore istruttori',
    descrizione: 'grafico settimana',
    destinazioneClick: '/istruttori?vista=carico',
    cliccabile: true,
    icona: 'PieChart',
  },
  {
    codice: 'presenze_settimana',
    area: 'operativa',
    titolo: 'Presenze settimana',
    descrizione: 'percent per corso',
    destinazioneClick: '/presenze?vista=settimana',
    cliccabile: true,
    icona: 'Percent',
  },

  // GHIACCIO (2)
  {
    codice: 'occupazione_ghiaccio',
    area: 'ghiaccio',
    titolo: 'Occupazione ghiaccio',
    descrizione: 'percent slot pieni settimana',
    destinazioneClick: '/disponibilita-ghiaccio',
    cliccabile: true,
    icona: 'Thermometer',
  },
  {
    codice: 'slot_non_assegnati',
    area: 'ghiaccio',
    titolo: 'Slot non assegnati',
    descrizione: 'n ore prenotate non usate',
    destinazioneClick: '/planning-settimana?filtro=buchi',
    cliccabile: true,
    icona: 'Timer',
  },

  // COMUNICAZIONI (3)
  {
    codice: 'comunicazione_rapida',
    area: 'comunicazioni',
    titolo: 'Comunicazione rapida',
    descrizione: 'widget di invio',
    destinazioneClick: '',
    cliccabile: false,
    icona: 'Send',
  },
  {
    codice: 'ultime_comunicazioni',
    area: 'comunicazioni',
    titolo: 'Ultime comunicazioni',
    descrizione: 'lista delle 5 recenti',
    destinazioneClick: '/comunicazioni',
    cliccabile: true,
    icona: 'Inbox',
  },
  {
    codice: 'rsvp_scaduti',
    area: 'comunicazioni',
    titolo: 'RSVP scaduti senza risposta',
    descrizione: 'n eventi con rsvp scaduto',
    destinazioneClick: '/comunicazioni?filtro=rsvp_scaduti',
    cliccabile: true,
    icona: 'MailWarning',
  },
];

export const AREE: AreaConfig[] = [
  { codice: 'finanziaria', label: 'Area Finanziaria', colore: 'emerald' },
  { codice: 'atleti', label: 'Area Atleti', colore: 'blue' },
  { codice: 'sportiva', label: 'Area Sportiva', colore: 'amber' },
  { codice: 'operativa', label: 'Area Operativa', colore: 'purple' },
  { codice: 'ghiaccio', label: 'Area Ghiaccio', colore: 'cyan' },
  { codice: 'comunicazioni', label: 'Area Comunicazioni', colore: 'rose' },
];

export const RUOLI_DASHBOARD: RuoloConfig[] = [
  { codice: 'presidente', label: 'Presidente' },
  { codice: 'segreteria', label: 'Segreteria' },
  { codice: 'dt', label: 'Direttore Tecnico' },
  { codice: 'istruttore', label: 'Istruttore' },
  { codice: 'aiuto_monitore', label: 'Aiuto Monitore' },
];
