// Regole Gioventù e Sport (G+S) per l'anagrafica istruttori.
// Funzioni pure: nessun React, nessuna chiamata al database.
// Le regole sono SEGNALAZIONI, mai blocchi: il salvataggio deve sempre riuscire.

export type QualificaGs = "nessuna" | "monitore_gs" | "coach_1418";

export const QUALIFICHE_GS: QualificaGs[] = ["nessuna", "monitore_gs", "coach_1418"];

export interface IstruttoreGs {
  id?: string;
  nome?: string | null;
  cognome?: string | null;
  user_id?: string | null;
  livello_istruttore?: string | null;
  qualifica_gs?: string | null;
  numero_gs?: string | null;
  gs_valido_fino?: string | null;
  data_nascita?: string | null;
  /** Quando la persona ha iniziato a lavorare nel club. */
  data_inizio_attivita?: string | null;
  /** Termine per l'esame G+S forzato a mano dal club. */
  gs_termine_esame?: string | null;
  attivo?: boolean | null;
  stato_staff?: string | null;
}

export interface SegnalazioneGs {
  gravita: "rosso" | "ambra" | "info";
  testo: string;
}

/** Traduttore iniettato: la funzione resta pura e senza dipendenze da React. */
type Tradurre = (chiave: string, opzioni?: Record<string, unknown>) => string;

/** Età minima G+S calcolata per anno civile: anno corrente meno anno di nascita. */
export const ETA_MINIMA_GS = 17;

/** Giorni entro cui un riconoscimento in scadenza va segnalato in ambra. */
export const GIORNI_PREAVVISO_GS = 90;

/**
 * Il resto delle regole G+S (obbligo, termini, scadenze) vive nella funzione SQL
 * `referto_gs`: qui non si duplica nulla, si conservano solo i tipi condivisi.
 */
