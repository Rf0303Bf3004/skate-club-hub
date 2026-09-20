// Regole Gioventù e Sport (G+S) per l'anagrafica istruttori.
// Funzioni pure: nessun React, nessuna chiamata al database.
// Le regole sono SEGNALAZIONI, mai blocchi: il salvataggio deve sempre riuscire.

import { format_data_completa } from "@/lib/format-data";

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

/** Mesi concessi per sostenere l'esame G+S dall'inizio dell'attività nel club. */
export const MESI_TERMINE_ESAME_GS = 12;

/** Livelli per cui la qualifica G+S va conseguita. */
const LIVELLI_CON_ESAME = ["istruttore", "monitrice"];

function anno_nascita(data_nascita?: string | null): number | null {
  if (!data_nascita) return null;
  const anno = parseInt(String(data_nascita).slice(0, 4), 10);
  return Number.isFinite(anno) ? anno : null;
}

function a_data(valore?: string | null): Date | null {
  if (!valore) return null;
  const testo = /^\d{4}-\d{2}-\d{2}$/.test(valore) ? `${valore}T00:00:00` : valore;
  const d = new Date(testo);
  return isNaN(d.getTime()) ? null : d;
}

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${g}`;
}

/**
 * Aggiunge mesi a una data reggendo il 29 febbraio: se il giorno non esiste
 * nel mese di arrivo si usa l'ultimo giorno di quel mese.
 */
function aggiungi_mesi(d: Date, mesi: number): Date {
  const giorno = d.getDate();
  const arrivo = new Date(d.getFullYear(), d.getMonth() + mesi, 1);
  const ultimo_giorno = new Date(arrivo.getFullYear(), arrivo.getMonth() + 1, 0).getDate();
  arrivo.setDate(Math.min(giorno, ultimo_giorno));
  return arrivo;
}

/**
 * Termine entro cui sostenere l'esame G+S.
 * Forzato a mano se il club ha scritto una data, altrimenti 12 mesi
 * dall'inizio dell'attività. Senza nessuno dei due dati non c'è termine.
 */
export function termine_esame_gs(istruttore: IstruttoreGs): { data: string; forzato: boolean } | null {
  const forzato = a_data(istruttore.gs_termine_esame);
  if (forzato) return { data: iso(forzato), forzato: true };
  const inizio = a_data(istruttore.data_inizio_attivita);
  if (inizio) return { data: iso(aggiungi_mesi(inizio, MESI_TERMINE_ESAME_GS)), forzato: false };
  return null;
}

/** Giorni interi che mancano al termine dell'esame: negativi se è già passato. */
export function giorni_al_termine_gs(istruttore: IstruttoreGs, oggi: Date = new Date()): number | null {
  const termine = termine_esame_gs(istruttore);
  if (!termine) return null;
  const d = a_data(termine.data);
  if (!d) return null;
  const inizio_giornata = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  return Math.round((d.getTime() - inizio_giornata.getTime()) / 86400000);
}

/** Vero quando per questa persona l'esame G+S è ancora da dare. */
export function esame_gs_da_dare(istruttore: IstruttoreGs): boolean {
  const livello = istruttore.livello_istruttore || "istruttore";
  const qualifica = (istruttore.qualifica_gs || "nessuna") as QualificaGs;
  return LIVELLI_CON_ESAME.includes(livello) && qualifica !== "monitore_gs";
}

/** Segnalazione legata al termine dell'esame G+S, se la persona lo deve ancora dare. */
export function segnalazione_esame_gs(
  istruttore: IstruttoreGs,
  t: Tradurre,
  oggi: Date = new Date()
): SegnalazioneGs | null {
  if (!esame_gs_da_dare(istruttore)) return null;
  const termine = termine_esame_gs(istruttore);
  if (!termine) return { gravita: "ambra", testo: t("gs.segnalazione.senza_termine") };
  const giorni = giorni_al_termine_gs(istruttore, oggi) ?? 0;
  const data = format_data_completa(termine.data);
  if (giorni < 0) {
    return { gravita: "rosso", testo: t("gs.segnalazione.esame_scaduto", { data, giorni: Math.abs(giorni) }) };
  }
  if (giorni <= GIORNI_PREAVVISO_GS) {
    return { gravita: "ambra", testo: t("gs.segnalazione.esame_vicino", { data, giorni }) };
  }
  return { gravita: "info", testo: t("gs.segnalazione.esame_previsto", { data, giorni }) };
}

/**
 * Elenco delle segnalazioni G+S per una persona.
 * Un campo vuoto (data di nascita o validità mancante) non genera mai
 * una segnalazione di età o di scadenza: il vuoto non è un dato.
 */
export function segnalazioni_gs(
  istruttore: IstruttoreGs,
  t: Tradurre,
  oggi: Date = new Date()
): SegnalazioneGs[] {
  const segnalazioni: SegnalazioneGs[] = [];
  const livello = istruttore.livello_istruttore || "istruttore";
  const qualifica = (istruttore.qualifica_gs || "nessuna") as QualificaGs;

  // Monitrice: la qualifica G+S è obbligatoria.
  if (livello === "monitrice" && qualifica !== "monitore_gs") {
    segnalazioni.push({ gravita: "rosso", testo: t("gs.segnalazione.monitrice_senza_gs") });
  }

  // Monitrice troppo giovane: confronto per anno civile, non per giorno esatto.
  if (livello === "monitrice") {
    const anno = anno_nascita(istruttore.data_nascita);
    if (anno !== null && oggi.getFullYear() - anno < ETA_MINIMA_GS) {
      segnalazioni.push({ gravita: "rosso", testo: t("gs.segnalazione.eta_insufficiente") });
    }
  }

  // Esame G+S ancora da dare: la gravità dipende dal termine.
  const esame = segnalazione_esame_gs(istruttore, t, oggi);
  if (esame) segnalazioni.push(esame);

  // Scadenza del riconoscimento: vale per qualunque livello.
  const validita = a_data(istruttore.gs_valido_fino);
  if (validita) {
    const inizio_giornata = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    const giorni = Math.round((validita.getTime() - inizio_giornata.getTime()) / 86400000);
    const data_testo = format_data_completa(istruttore.gs_valido_fino);
    if (giorni < 0) {
      segnalazioni.push({ gravita: "rosso", testo: t("gs.segnalazione.scaduto", { data: data_testo }) });
    } else if (giorni <= GIORNI_PREAVVISO_GS) {
      segnalazioni.push({ gravita: "ambra", testo: t("gs.segnalazione.in_scadenza", { data: data_testo }) });
    }
  }

  // Aiuto monitrice con qualifica 'nessuna' o '1418coach': è regolare, nessuna segnalazione.
  return segnalazioni;
}

/** Gravità complessiva: rosso, poi ambra, poi info. */
export function gravita_massima(segnalazioni: SegnalazioneGs[]): "rosso" | "ambra" | "info" | null {
  if (segnalazioni.some((s) => s.gravita === "rosso")) return "rosso";
  if (segnalazioni.some((s) => s.gravita === "ambra")) return "ambra";
  if (segnalazioni.some((s) => s.gravita === "info")) return "info";
  return null;
}

export interface RigaPromemoriaGs<T extends IstruttoreGs = IstruttoreGs> {
  istruttore: T;
  segnalazione: SegnalazioneGs;
  /** Data ISO del termine, oppure null se nessun termine è stato fissato. */
  termine: string | null;
  giorni: number | null;
}

/** Vero se la persona è ancora in servizio nel club. */
function attivo(i: IstruttoreGs): boolean {
  return i.attivo !== false && i.stato_staff !== "sospeso";
}

/**
 * Persone attive che devono ancora dare l'esame G+S, dalla più urgente alla meno.
 * La logica sta qui una volta sola: le tre home la riusano, non la copiano.
 */
export function staff_da_ricordare<T extends IstruttoreGs>(
  lista_istruttori: T[],
  t: Tradurre,
  oggi: Date = new Date()
): RigaPromemoriaGs<T>[] {
  const righe: RigaPromemoriaGs<T>[] = [];
  for (const i of lista_istruttori ?? []) {
    if (!attivo(i)) continue;
    const segnalazione = segnalazione_esame_gs(i, t, oggi);
    if (!segnalazione) continue;
    const termine = termine_esame_gs(i);
    righe.push({
      istruttore: i,
      segnalazione,
      termine: termine ? termine.data : null,
      giorni: giorni_al_termine_gs(i, oggi),
    });
  }
  // Prima i termini più vicini o più scaduti; chi non ha nessun termine in fondo.
  righe.sort((a, b) => {
    if (a.giorni === null && b.giorni === null) return 0;
    if (a.giorni === null) return 1;
    if (b.giorni === null) return -1;
    return a.giorni - b.giorni;
  });
  return righe;
}
