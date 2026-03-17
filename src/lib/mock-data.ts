// All mock data for the CPA Manager demo

export interface club_config {
  id: string;
  nome_club: string;
  citta: string;
  paese: string;
  email: string;
  telefono: string;
  logo_url: string;
  config_lezioni_private: {
    max_lezioni_contemporanee: number | null;
    max_atlete_condivisa: number | null;
    durata_slot_minuti: number;
  };
  stagione_attiva: {
    nome: string;
    data_inizio: string;
    data_fine: string;
  };
}

export interface atleta {
  id: string;
  nome: string;
  cognome: string;
  data_nascita: string;
  foto_url: string;
  livello_amatori: 'pulcini' | 'stellina_1' | 'stellina_2' | 'stellina_3' | 'stellina_4';
  percorso_amatori_completato: boolean;
  carriera_artistica: '' | 'interbronzo' | 'bronzo' | 'interargento' | 'argento' | 'interoro' | 'oro';
  carriera_stile: '' | 'interbronzo' | 'bronzo' | 'interargento' | 'argento' | 'interoro' | 'oro';
  atleta_federazione: boolean;
  ore_pista_stagione: number;
  stato: 'attivo' | 'inattivo';
  club_id: string;
  note: string;
  genitore_1: { nome: string; cognome: string; telefono: string; email: string };
  genitore_2?: { nome: string; cognome: string; telefono: string; email: string };
  data_aggiunta: string;
}

export interface istruttore {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  foto_url: string;
  costo_minuto: number;
  stato: 'attivo' | 'inattivo';
  club_id: string;
  note: string;
  disponibilita: Record<string, { ora_inizio: string; ora_fine: string }[]>;
}

export interface corso {
  id: string;
  nome: string;
  tipo: 'ghiaccio' | 'off_ice' | 'danza' | 'stretching' | 'altro';
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
  costo_mensile: number;
  costo_annuale: number;
  stagione_id: string;
  istruttori_ids: string[];
  atleti_ids: string[];
  stato: 'attivo' | 'inattivo';
  club_id: string;
}

export interface gara {
  id: string;
  nome: string;
  data: string;
  ora: string;
  club_ospitante: string;
  localita: string;
  livello_minimo: string;
  carriera: 'artistica' | 'stile' | 'entrambe';
  costo_iscrizione: number;
  costo_accompagnamento: number;
  note: string;
  club_id: string;
  atleti_iscritti: {
    atleta_id: string;
    punteggio: number | null;
    posizione: number | null;
    medaglia: '' | 'oro' | 'argento' | 'bronzo';
  }[];
}

export interface lezione_privata {
  id: string;
  istruttore_id: string;
  atleti_ids: string[];
  data: string;
  ora_inizio: string;
  ora_fine: string;
  ricorrente: boolean;
  costo: number;
  club_id: string;
}

export interface fattura {
  id: string;
  numero: string;
  atleta_id: string;
  descrizione: string;
  importo: number;
  scadenza: string;
  stato: 'pagata' | 'da_pagare';
  club_id: string;
}

export interface comunicazione {
  id: string;
  titolo: string;
  testo: string;
  data: string;
  tipo_destinatari: 'tutti' | 'per_corso' | 'per_atleta' | 'solo_istruttori';
  corso_id?: string;
  atleta_id?: string;
  club_id: string;
}

export interface stagione {
  id: string;
  nome: string;
  tipo: 'regolare' | 'pre_season' | 'post_season' | 'campo';
  data_inizio: string;
  data_fine: string;
  attiva: boolean;
  club_id: string;
}

export interface campo_allenamento {
  id: string;
  nome: string;
  data_inizio: string;
  data_fine: string;
  luogo: string;
  club_ospitante: string;
  costo_diurno: number;
  costo_completo: number;
  note: string;
  club_id: string;
  iscrizioni: { atleta_id: string; tipo: 'diurno' | 'completo' | 'parziale'; giorni?: string[] }[];
}

const CLUB_ID = 'club_001';

export const mock_club: club_config = {
  id: CLUB_ID,
  nome_club: 'Demo Skating Club',
  citta: 'Lugano',
  paese: 'Svizzera',
  email: 'info@demoskating.ch',
  telefono: '+41 91 123 45 67',
  logo_url: '',
  config_lezioni_private: {
    max_lezioni_contemporanee: null,
    max_atlete_condivisa: 3,
    durata_slot_minuti: 20,
  },
  stagione_attiva: {
    nome: 'Stagione 2025/2026',
    data_inizio: '2025-09-01',
    data_fine: '2026-06-30',
  },
};

export const mock_atleti: atleta[] = [
  {
    id: 'atl_001', nome: 'Sofia', cognome: 'Bernasconi', data_nascita: '2014-03-15',
    foto_url: '', livello_amatori: 'stellina_3', percorso_amatori_completato: false,
    carriera_artistica: '', carriera_stile: '', atleta_federazione: false,
    ore_pista_stagione: 48, stato: 'attivo', club_id: CLUB_ID, note: '',
    genitore_1: { nome: 'Laura', cognome: 'Bernasconi', telefono: '+41 79 111 2233', email: 'laura.b@email.ch' },
    data_aggiunta: '2025-09-05',
  },
  {
    id: 'atl_002', nome: 'Emma', cognome: 'Müller', data_nascita: '2012-07-22',
    foto_url: '', livello_amatori: 'stellina_4', percorso_amatori_completato: true,
    carriera_artistica: 'bronzo', carriera_stile: 'interbronzo', atleta_federazione: true,
    ore_pista_stagione: 92, stato: 'attivo', club_id: CLUB_ID, note: 'Talento promettente',
    genitore_1: { nome: 'Hans', cognome: 'Müller', telefono: '+41 79 222 3344', email: 'hans.m@email.ch' },
    genitore_2: { nome: 'Anna', cognome: 'Müller', telefono: '+41 79 222 3345', email: 'anna.m@email.ch' },
    data_aggiunta: '2025-09-02',
  },
  {
    id: 'atl_003', nome: 'Giulia', cognome: 'Rossi', data_nascita: '2010-01-10',
    foto_url: '', livello_amatori: 'stellina_4', percorso_amatori_completato: true,
    carriera_artistica: 'argento', carriera_stile: 'interargento', atleta_federazione: true,
    ore_pista_stagione: 134, stato: 'attivo', club_id: CLUB_ID, note: '',
    genitore_1: { nome: 'Marco', cognome: 'Rossi', telefono: '+41 79 333 4455', email: 'marco.r@email.ch' },
    data_aggiunta: '2024-09-01',
  },
  {
    id: 'atl_004', nome: 'Liam', cognome: 'Frei', data_nascita: '2016-11-03',
    foto_url: '', livello_amatori: 'pulcini', percorso_amatori_completato: false,
    carriera_artistica: '', carriera_stile: '', atleta_federazione: false,
    ore_pista_stagione: 12, stato: 'attivo', club_id: CLUB_ID, note: 'Nuovo iscritto',
    genitore_1: { nome: 'Sarah', cognome: 'Frei', telefono: '+41 79 444 5566', email: 'sarah.f@email.ch' },
    data_aggiunta: '2026-01-15',
  },
  {
    id: 'atl_005', nome: 'Chiara', cognome: 'Bentivoglio', data_nascita: '2009-05-28',
    foto_url: '', livello_amatori: 'stellina_4', percorso_amatori_completato: true,
    carriera_artistica: 'oro', carriera_stile: 'argento', atleta_federazione: true,
    ore_pista_stagione: 156, stato: 'attivo', club_id: CLUB_ID, note: 'Campionessa regionale',
    genitore_1: { nome: 'Paolo', cognome: 'Bentivoglio', telefono: '+41 79 555 6677', email: 'paolo.b@email.ch' },
    genitore_2: { nome: 'Elena', cognome: 'Bentivoglio', telefono: '+41 79 555 6678', email: 'elena.b@email.ch' },
    data_aggiunta: '2023-09-01',
  },
  {
    id: 'atl_006', nome: 'Mia', cognome: 'Zanetti', data_nascita: '2015-08-19',
    foto_url: '', livello_amatori: 'stellina_1', percorso_amatori_completato: false,
    carriera_artistica: '', carriera_stile: '', atleta_federazione: false,
    ore_pista_stagione: 24, stato: 'attivo', club_id: CLUB_ID, note: '',
    genitore_1: { nome: 'Fabio', cognome: 'Zanetti', telefono: '+41 79 666 7788', email: 'fabio.z@email.ch' },
    data_aggiunta: '2025-10-20',
  },
];

export const mock_istruttori: istruttore[] = [
  {
    id: 'ist_001', nome: 'Marco', cognome: 'Colombo', email: 'marco.c@demoskating.ch',
    telefono: '+41 79 100 0001', foto_url: '', costo_minuto: 1.50, stato: 'attivo',
    club_id: CLUB_ID, note: 'Istruttore capo',
    disponibilita: {
      lunedi: [{ ora_inizio: '08:00', ora_fine: '12:00' }, { ora_inizio: '14:00', ora_fine: '18:00' }],
      martedi: [{ ora_inizio: '08:00', ora_fine: '12:00' }],
      mercoledi: [{ ora_inizio: '08:00', ora_fine: '12:00' }, { ora_inizio: '14:00', ora_fine: '18:00' }],
      giovedi: [{ ora_inizio: '14:00', ora_fine: '18:00' }],
      venerdi: [{ ora_inizio: '08:00', ora_fine: '17:00' }],
    },
  },
  {
    id: 'ist_002', nome: 'Elena', cognome: 'Bianchi', email: 'elena.b@demoskating.ch',
    telefono: '+41 79 100 0002', foto_url: '', costo_minuto: 1.20, stato: 'attivo',
    club_id: CLUB_ID, note: 'Specialista danza su ghiaccio',
    disponibilita: {
      lunedi: [{ ora_inizio: '14:00', ora_fine: '18:00' }],
      martedi: [{ ora_inizio: '08:00', ora_fine: '12:00' }, { ora_inizio: '14:00', ora_fine: '18:00' }],
      mercoledi: [{ ora_inizio: '14:00', ora_fine: '18:00' }],
      giovedi: [{ ora_inizio: '08:00', ora_fine: '12:00' }, { ora_inizio: '14:00', ora_fine: '18:00' }],
      sabato: [{ ora_inizio: '09:00', ora_fine: '13:00' }],
    },
  },
  {
    id: 'ist_003', nome: 'Thomas', cognome: 'Wyss', email: 'thomas.w@demoskating.ch',
    telefono: '+41 79 100 0003', foto_url: '', costo_minuto: 1.00, stato: 'attivo',
    club_id: CLUB_ID, note: 'Preparazione fisica e off-ice',
    disponibilita: {
      lunedi: [{ ora_inizio: '16:00', ora_fine: '20:00' }],
      mercoledi: [{ ora_inizio: '16:00', ora_fine: '20:00' }],
      venerdi: [{ ora_inizio: '16:00', ora_fine: '20:00' }],
      sabato: [{ ora_inizio: '08:00', ora_fine: '12:00' }],
    },
  },
];

export const mock_corsi: corso[] = [
  {
    id: 'cor_001', nome: 'Ghiaccio Avanzato', tipo: 'ghiaccio', giorno: 'lunedi',
    ora_inizio: '14:20', ora_fine: '15:40', costo_mensile: 120, costo_annuale: 1080,
    stagione_id: 'stag_001', istruttori_ids: ['ist_001'], atleti_ids: ['atl_002', 'atl_003', 'atl_005'],
    stato: 'attivo', club_id: CLUB_ID,
  },
  {
    id: 'cor_002', nome: 'Ghiaccio Base', tipo: 'ghiaccio', giorno: 'mercoledi',
    ora_inizio: '15:00', ora_fine: '16:00', costo_mensile: 90, costo_annuale: 810,
    stagione_id: 'stag_001', istruttori_ids: ['ist_001'], atleti_ids: ['atl_001', 'atl_004', 'atl_006'],
    stato: 'attivo', club_id: CLUB_ID,
  },
  {
    id: 'cor_003', nome: 'Danza su Ghiaccio', tipo: 'danza', giorno: 'martedi',
    ora_inizio: '16:00', ora_fine: '17:00', costo_mensile: 100, costo_annuale: 900,
    stagione_id: 'stag_001', istruttori_ids: ['ist_002'], atleti_ids: ['atl_002', 'atl_003', 'atl_005'],
    stato: 'attivo', club_id: CLUB_ID,
  },
  {
    id: 'cor_004', nome: 'Off Ice Training', tipo: 'off_ice', giorno: 'venerdi',
    ora_inizio: '16:30', ora_fine: '17:30', costo_mensile: 70, costo_annuale: 630,
    stagione_id: 'stag_001', istruttori_ids: ['ist_003'], atleti_ids: ['atl_001', 'atl_002', 'atl_003', 'atl_005', 'atl_006'],
    stato: 'attivo', club_id: CLUB_ID,
  },
];

export const mock_stagioni: stagione[] = [
  { id: 'stag_001', nome: 'Stagione 2025/2026', tipo: 'regolare', data_inizio: '2025-09-01', data_fine: '2026-06-30', attiva: true, club_id: CLUB_ID },
  { id: 'stag_002', nome: 'Pre Season 2025', tipo: 'pre_season', data_inizio: '2025-08-01', data_fine: '2025-08-31', attiva: false, club_id: CLUB_ID },
  { id: 'stag_003', nome: 'Campo Estivo 2025', tipo: 'campo', data_inizio: '2025-07-01', data_fine: '2025-07-14', attiva: false, club_id: CLUB_ID },
];

export const mock_gare: gara[] = [
  {
    id: 'gar_001', nome: 'Trofeo Città di Lugano', data: '2026-04-12', ora: '09:00',
    club_ospitante: 'HC Lugano Skating', localita: 'Lugano', livello_minimo: 'stellina_2',
    carriera: 'artistica', costo_iscrizione: 45, costo_accompagnamento: 80, note: '',
    club_id: CLUB_ID,
    atleti_iscritti: [
      { atleta_id: 'atl_002', punteggio: null, posizione: null, medaglia: '' },
      { atleta_id: 'atl_003', punteggio: null, posizione: null, medaglia: '' },
      { atleta_id: 'atl_005', punteggio: null, posizione: null, medaglia: '' },
    ],
  },
  {
    id: 'gar_002', nome: 'Campionato Regionale Ticino', data: '2026-05-20', ora: '08:30',
    club_ospitante: 'SC Bellinzona', localita: 'Bellinzona', livello_minimo: 'interbronzo',
    carriera: 'entrambe', costo_iscrizione: 60, costo_accompagnamento: 100, note: 'Gara qualificazione nazionale',
    club_id: CLUB_ID,
    atleti_iscritti: [
      { atleta_id: 'atl_003', punteggio: null, posizione: null, medaglia: '' },
      { atleta_id: 'atl_005', punteggio: null, posizione: null, medaglia: '' },
    ],
  },
  {
    id: 'gar_003', nome: 'Interclub Amatori Zurigo', data: '2026-02-08', ora: '10:00',
    club_ospitante: 'ZSC Ice Stars', localita: 'Zurigo', livello_minimo: 'stellina_1',
    carriera: 'artistica', costo_iscrizione: 35, costo_accompagnamento: 60, note: '',
    club_id: CLUB_ID,
    atleti_iscritti: [
      { atleta_id: 'atl_001', punteggio: 28.5, posizione: 3, medaglia: 'bronzo' },
      { atleta_id: 'atl_002', punteggio: 42.3, posizione: 1, medaglia: 'oro' },
      { atleta_id: 'atl_006', punteggio: 18.2, posizione: 8, medaglia: '' },
    ],
  },
];

export const mock_fatture: fattura[] = [
  { id: 'fat_001', numero: 'F-2026-001', atleta_id: 'atl_001', descrizione: 'Quota mensile Marzo 2026 - Ghiaccio Base + Off Ice', importo: 160, scadenza: '2026-03-31', stato: 'da_pagare', club_id: CLUB_ID },
  { id: 'fat_002', numero: 'F-2026-002', atleta_id: 'atl_002', descrizione: 'Quota mensile Marzo 2026 - Ghiaccio Avanzato + Danza + Off Ice', importo: 290, scadenza: '2026-03-31', stato: 'da_pagare', club_id: CLUB_ID },
  { id: 'fat_003', numero: 'F-2026-003', atleta_id: 'atl_003', descrizione: 'Quota mensile Marzo 2026 - Ghiaccio Avanzato + Danza + Off Ice', importo: 290, scadenza: '2026-03-31', stato: 'da_pagare', club_id: CLUB_ID },
  { id: 'fat_004', numero: 'F-2026-004', atleta_id: 'atl_005', descrizione: 'Quota mensile Marzo 2026 - Ghiaccio Avanzato + Danza + Off Ice', importo: 290, scadenza: '2026-03-31', stato: 'da_pagare', club_id: CLUB_ID },
  { id: 'fat_005', numero: 'F-2026-005', atleta_id: 'atl_001', descrizione: 'Quota mensile Febbraio 2026', importo: 160, scadenza: '2026-02-28', stato: 'pagata', club_id: CLUB_ID },
  { id: 'fat_006', numero: 'F-2026-006', atleta_id: 'atl_002', descrizione: 'Quota mensile Febbraio 2026', importo: 290, scadenza: '2026-02-28', stato: 'pagata', club_id: CLUB_ID },
  { id: 'fat_007', numero: 'F-2026-007', atleta_id: 'atl_004', descrizione: 'Iscrizione gara Interclub Zurigo', importo: 35, scadenza: '2026-01-31', stato: 'pagata', club_id: CLUB_ID },
];

export const mock_comunicazioni: comunicazione[] = [
  { id: 'com_001', titolo: 'Orario modificato Danza su Ghiaccio', testo: 'Informiamo che a partire dalla prossima settimana il corso di Danza su Ghiaccio inizierà alle 16:30 anziché alle 16:00.', data: '2026-03-10', tipo_destinatari: 'per_corso', corso_id: 'cor_003', club_id: CLUB_ID },
  { id: 'com_002', titolo: 'Iscrizioni Trofeo Città di Lugano', testo: 'Ricordiamo che le iscrizioni al Trofeo Città di Lugano del 12 aprile chiudono il 25 marzo. Confermate la partecipazione al più presto.', data: '2026-03-08', tipo_destinatari: 'tutti', club_id: CLUB_ID },
  { id: 'com_003', titolo: 'Riunione istruttori', testo: 'Riunione programmazione fine stagione: venerdì 21 marzo ore 18:00 in sala riunioni.', data: '2026-03-05', tipo_destinatari: 'solo_istruttori', club_id: CLUB_ID },
];

export const mock_lezioni_private: lezione_privata[] = [
  { id: 'lez_001', istruttore_id: 'ist_001', atleti_ids: ['atl_005'], data: '2026-03-17', ora_inizio: '10:00', ora_fine: '10:20', ricorrente: true, costo: 30, club_id: CLUB_ID },
  { id: 'lez_002', istruttore_id: 'ist_002', atleti_ids: ['atl_002', 'atl_003'], data: '2026-03-18', ora_inizio: '09:00', ora_fine: '09:20', ricorrente: true, costo: 12, club_id: CLUB_ID },
  { id: 'lez_003', istruttore_id: 'ist_001', atleti_ids: ['atl_003'], data: '2026-03-19', ora_inizio: '11:00', ora_fine: '11:20', ricorrente: false, costo: 30, club_id: CLUB_ID },
];

export const mock_campi: campo_allenamento[] = [
  {
    id: 'camp_001', nome: 'Campo Estivo Davos 2026', data_inizio: '2026-07-07', data_fine: '2026-07-13',
    luogo: 'Davos', club_ospitante: 'SC Davos Ice', costo_diurno: 80, costo_completo: 180,
    note: 'Portare abbigliamento per allenamento off-ice', club_id: CLUB_ID,
    iscrizioni: [
      { atleta_id: 'atl_002', tipo: 'completo' },
      { atleta_id: 'atl_003', tipo: 'completo' },
      { atleta_id: 'atl_005', tipo: 'diurno' },
    ],
  },
];

// Helpers
export function get_atleta_name(id: string): string {
  const a = mock_atleti.find(x => x.id === id);
  return a ? `${a.nome} ${a.cognome}` : id;
}

export function get_istruttore_name(id: string): string {
  const i = mock_istruttori.find(x => x.id === id);
  return i ? `${i.nome} ${i.cognome}` : id;
}

export function calculate_age(data_nascita: string): number {
  const birth = new Date(data_nascita);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function days_until(date_str: string): number {
  const target = new Date(date_str);
  const today = new Date();
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
