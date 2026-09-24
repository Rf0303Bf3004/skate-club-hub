import { useCallback, useEffect, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Tutto ciò che riguarda `diagnosi_avvio_club`, condiviso da pagina di avvio,
 * home della presidenza, banner della dashboard e procedura guidata.
 * Le colonne `area`, `controllo`, `dettaglio` arrivano dal database in italiano
 * e non si traducono.
 */

export interface RigaDiagnosi {
  passo: number;
  area: string;
  controllo: string;
  esito: string;
  dettaglio: string | null;
  blocca: boolean;
}

/** Ruoli a cui si rivolgono lista di avvio e procedura guidata. */
export const RUOLI_AVVIO_CLUB = ["presidente", "vicepresidente", "admin"];

/** Destinazione di un controllo; `chiave` = onboarding.avvio.destinazioni.<chiave>, `aiuto` = onboarding.avvio.aiuto.<aiuto>. */
export interface RottaAvvio {
  to: string;
  chiave: string;
  aiuto?: string;
}

const DATI_CLUB: RottaAvvio = { to: "/setup-club?tab=club", chiave: "dati_club" };
const GHIACCIO: RottaAvvio = { to: "/setup-club?tab=ghiaccio", chiave: "ghiaccio" };
const FATTURAZIONE: RottaAvvio = { to: "/setup-club?tab=fatturazione", chiave: "fatturazione" };
const STAGIONI: RottaAvvio = { to: "/stagioni", chiave: "stagioni" };
const ATLETI: RottaAvvio = { to: "/atleti", chiave: "atleti" };

/**
 * Mappa unica per numero di passo (identificativo stabile di diagnosi_avvio_club),
 * usata da barra guidata, pagina di avvio e banner della dashboard.
 * Passo 11 conta le SCHEDE in `istruttori`, non gli accessi: porta a Istruttori.
 */
const ROTTA_PER_PASSO: Record<number, RottaAvvio> = {
  1: DATI_CLUB,
  2: DATI_CLUB,
  3: { to: "/utenti", chiave: "utenti" },
  4: { to: "/ruoli-permessi", chiave: "ruoli_permessi" },
  6: STAGIONI,
  7: STAGIONI,
  8: GHIACCIO,
  9: GHIACCIO,
  10: GHIACCIO,
  11: { to: "/istruttori", chiave: "istruttori", aiuto: "istruttore_scheda" },
  12: { to: "/corsi", chiave: "corsi" },
  13: ATLETI,
  14: ATLETI,
  15: ATLETI,
  16: FATTURAZIONE,
  17: FATTURAZIONE,
  18: FATTURAZIONE,
  19: FATTURAZIONE,
  20: FATTURAZIONE,
  21: { to: "/comunicazioni", chiave: "comunicazioni" },
  22: ATLETI,
};

/** Solo ripiego, per passi che la funzione aggiungesse in futuro. Area = valore del database. */
const RIPIEGO_PER_AREA: Record<string, RottaAvvio> = {
  Anagrafica: DATI_CLUB,
  Accesso: { to: "/utenti", chiave: "utenti" },
  Stagione: STAGIONI,
  Ghiaccio: GHIACCIO,
  Offerta: { to: "/corsi", chiave: "corsi" },
  Atleti: ATLETI,
  Fatturazione: FATTURAZIONE,
  Comunicazioni: { to: "/comunicazioni", chiave: "comunicazioni" },
  "App famiglie": ATLETI,
};

const RIPIEGO: RottaAvvio = { to: "/setup-club", chiave: "setup_club" };

/** Rotta di una riga: prima la mappa per passo, poi il ripiego per area. */
export const rotta_riga = (r: Pick<RigaDiagnosi, "passo" | "area">): RottaAvvio =>
  ROTTA_PER_PASSO[r.passo] ?? RIPIEGO_PER_AREA[r.area] ?? RIPIEGO;

export const riga_bloccante_aperta = (r: RigaDiagnosi) => r.blocca && r.esito !== "✓";

export const ha_bloccanti_aperti = (righe: RigaDiagnosi[]) => righe.some(riga_bloccante_aperta);

/**
 * Conteggio unico dell'avanzamento, usato da pagina di avvio e procedura guidata.
 * Denominatore stabile = tutte le righe (la funzione marca `blocca` solo sui controlli
 * che falliscono, quindi contare i bloccanti farebbe muovere numeratore e denominatore insieme).
 */
export function avanzamento_avvio(righe: RigaDiagnosi[]) {
  const a_posto = righe.filter((r) => r.esito === "✓").length;
  const totale = righe.length;
  const bloccanti_aperte = righe.filter(riga_bloccante_aperta).length;
  const percentuale = totale > 0 ? Math.round((a_posto / totale) * 100) : 0;
  return { a_posto, totale, bloccanti_aperte, percentuale };
}

/** Passo corrente: la prima riga bloccante aperta, in ordine di `passo`. */
export const passo_corrente_avvio = (righe: RigaDiagnosi[]) =>
  [...righe].sort((a, b) => a.passo - b.passo).find(riga_bloccante_aperta);

/** Prefisso della chiave di cache della diagnosi (una sola chiave in tutto il portale). */
export const CHIAVE_DIAGNOSI_AVVIO = "diagnosi_avvio_club";

/** Fa rileggere la diagnosi a chi la sta mostrando (pagina di avvio, home, barra). */
export const invalida_diagnosi_avvio = (qc: QueryClient) =>
  qc.invalidateQueries({ queryKey: [CHIAVE_DIAGNOSI_AVVIO] });

/** Lettura condivisa (stessa chiave di cache ovunque). */
export function use_diagnosi_avvio(club_id: string | undefined, enabled = true, intervallo_ms: number | false = false) {
  return useQuery({
    queryKey: [CHIAVE_DIAGNOSI_AVVIO, club_id],
    enabled: enabled && !!club_id,
    refetchOnWindowFocus: true,
    // Rete di sicurezza per scritture che non passano da un'invalidazione: solo dove richiesto.
    refetchInterval: intervallo_ms,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("diagnosi_avvio_club" as any, { p_club: club_id });
      if (error) throw error;
      return (data ?? []) as RigaDiagnosi[];
    },
  });
}

// --- Preferenze locali della procedura guidata, per club -------------------

const EVENTO = "procedura_guidata_cambiata";
const chiave_nascosta = (club_id: string) => `procedura_guidata_nascosta:${club_id}`;
const chiave_pronto_chiuso = (club_id: string) => `procedura_guidata_pronto_chiuso:${club_id}`;

function leggi(chiave: string): boolean {
  try {
    return window.localStorage.getItem(chiave) === "1";
  } catch {
    // Browser che non permette localStorage: la procedura resta visibile.
    return false;
  }
}

function scrivi(chiave: string, valore: boolean) {
  try {
    if (valore) window.localStorage.setItem(chiave, "1");
    else window.localStorage.removeItem(chiave);
  } catch {
    // Non memorizzabile: la scelta vale solo finché la pagina resta aperta.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Stato "nascosta" e "pronto già chiuso" della procedura per un club, condiviso fra componenti. */
export function use_preferenze_procedura(club_id: string | undefined) {
  const [nascosta, set_nascosta] = useState(false);
  const [pronto_chiuso, set_pronto_chiuso] = useState(false);

  useEffect(() => {
    if (!club_id) return;
    const aggiorna = () => {
      set_nascosta(leggi(chiave_nascosta(club_id)));
      set_pronto_chiuso(leggi(chiave_pronto_chiuso(club_id)));
    };
    aggiorna();
    window.addEventListener(EVENTO, aggiorna);
    window.addEventListener("storage", aggiorna);
    return () => {
      window.removeEventListener(EVENTO, aggiorna);
      window.removeEventListener("storage", aggiorna);
    };
  }, [club_id]);

  const esci = useCallback(() => {
    set_nascosta(true);
    if (club_id) scrivi(chiave_nascosta(club_id), true);
  }, [club_id]);

  const chiudi_pronto = useCallback(() => {
    set_pronto_chiuso(true);
    if (club_id) scrivi(chiave_pronto_chiuso(club_id), true);
  }, [club_id]);

  const riprendi = useCallback(() => {
    set_nascosta(false);
    set_pronto_chiuso(false);
    if (club_id) {
      scrivi(chiave_nascosta(club_id), false);
      scrivi(chiave_pronto_chiuso(club_id), false);
    }
  }, [club_id]);

  return { nascosta, pronto_chiuso, esci, chiudi_pronto, riprendi };
}
