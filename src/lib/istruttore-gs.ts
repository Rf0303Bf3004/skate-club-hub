// Regole Gioventù e Sport (G+S) per l'anagrafica istruttori.
// Funzione pura: nessun React, nessuna chiamata al database.
// Le regole sono SEGNALAZIONI, mai blocchi: il salvataggio deve sempre riuscire.

import { format_data_completa } from "@/lib/format-data";

export type QualificaGs = "nessuna" | "monitore_gs" | "coach_1418";

export const QUALIFICHE_GS: QualificaGs[] = ["nessuna", "monitore_gs", "coach_1418"];

export interface IstruttoreGs {
  livello_istruttore?: string | null;
  qualifica_gs?: string | null;
  numero_gs?: string | null;
  gs_valido_fino?: string | null;
  data_nascita?: string | null;
}

export interface SegnalazioneGs {
  gravita: "rosso" | "ambra";
  testo: string;
}

/** Traduttore iniettato: la funzione resta pura e senza dipendenze da React. */
type Tradurre = (chiave: string, opzioni?: Record<string, unknown>) => string;

/** Età minima G+S calcolata per anno civile: anno corrente meno anno di nascita. */
export const ETA_MINIMA_GS = 17;

/** Giorni entro cui un riconoscimento in scadenza va segnalato in ambra. */
export const GIORNI_PREAVVISO_GS = 90;

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

  // Istruttore senza G+S: solo ambra, ha un anno di tempo per l'esame
  // (il portale non conserva la data di arrivo, quindi non si può essere più severi).
  if (livello === "istruttore" && qualifica !== "monitore_gs") {
    segnalazioni.push({ gravita: "ambra", testo: t("gs.segnalazione.istruttore_senza_gs") });
  }

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

/** Gravità complessiva: rosso se c'è almeno una segnalazione rossa, altrimenti ambra, altrimenti nulla. */
export function gravita_massima(segnalazioni: SegnalazioneGs[]): "rosso" | "ambra" | null {
  if (segnalazioni.some((s) => s.gravita === "rosso")) return "rosso";
  if (segnalazioni.length > 0) return "ambra";
  return null;
}
