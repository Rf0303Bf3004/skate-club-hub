// Una sola fonte per stagione per il "quanto ha incassato il club".
//
// Regola dichiarata una volta per tutta l'area economica della Relazione:
//  - se nella stagione ci sono almeno SOGLIA_FATTURE fatture emesse (stato
//    diverso da bozza e annullata), comandano le fatture e il bilancio non
//    viene usato per quel numero;
//  - altrimenti comanda `bilancio_stagione`, e le fatture di quella stagione
//    non compaiono in nessun totale;
//  - se non c'è nessun bilancio, restano le poche fatture: non c'è nulla con
//    cui contraddirsi, e l'etichetta dice comunque da dove viene il numero.
//
// Le due fonti non si sommano e non si mescolano mai. Se il club ha entrambe
// (bilancio compilato e almeno SOGLIA_FATTURE fatture) restano due blocchi
// separati, con due titoli diversi e la riga che spiega perché differiscono.

import { supabase } from "@/lib/supabase";
import i18n from "@/i18n";
import type { Stagione } from "./moduli";

export const SOGLIA_FATTURE = 10;

export type Fonte = "fatture" | "bilancio" | "nessuna";

export interface BilancioStagione {
  totale_entrate: number;
  totale_uscite: number;
  saldo: number;
  cassa_iniziale: number | null;
  cassa_finale: number | null;
}

export interface FatturaStagione {
  id: string;
  importo: number;
  data_emissione: string | null;
  data_pagamento: string | null;
  ragione_sociale_id: string | null;
  righe: any;
}

export interface EsitoFonte {
  fonte: Fonte;
  /** Fatture emesse nella stagione (mai bozze, mai annullate). */
  fatture: FatturaStagione[];
  n_fatture: number;
  fatturato: number;
  incassato: number;
  bilancio: BilancioStagione | null;
  /** Bilancio compilato e fatture al comando: due blocchi separati, mai affiancati. */
  due_blocchi: boolean;
}

/** Testo dell'area economica, nella lingua corrente. */
export const testo_economia = (chiave: string, opzioni: Record<string, any> = {}): string =>
  i18n.t(`relazione.economia.${chiave}`, { ns: "dashboard", ...opzioni }) as string;

function dentro(data: string | null | undefined, stag: Stagione): boolean {
  if (!stag.data_inizio || !stag.data_fine) return true;
  if (!data) return false;
  const d = String(data).slice(0, 10);
  return d >= stag.data_inizio && d <= stag.data_fine;
}

function scegli(n_fatture: number, bilancio: BilancioStagione | null): Fonte {
  if (n_fatture >= SOGLIA_FATTURE) return "fatture";
  if (bilancio) return "bilancio";
  if (n_fatture > 0) return "fatture";
  return "nessuna";
}

async function leggiBilancio(club_id: string, stagione_id: string): Promise<BilancioStagione | null> {
  const { data, error } = await supabase
    .from("bilancio_stagione")
    .select("totale_entrate,totale_uscite,saldo,cassa_iniziale,cassa_finale")
    .eq("club_id", club_id).eq("stagione_id", stagione_id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const b = data as any;
  const entrate = Number(b.totale_entrate) || 0;
  const uscite = Number(b.totale_uscite) || 0;
  return {
    totale_entrate: entrate,
    totale_uscite: uscite,
    saldo: b.saldo == null ? entrate - uscite : Number(b.saldo) || 0,
    cassa_iniziale: b.cassa_iniziale == null ? null : Number(b.cassa_iniziale) || 0,
    cassa_finale: b.cassa_finale == null ? null : Number(b.cassa_finale) || 0,
  };
}

/** Fonte economica della stagione, con i dati già pronti. Se una lettura fallisce, l'errore risale. */
export async function fetchFonteEconomica(club_id: string, stagione: Stagione): Promise<EsitoFonte> {
  const { data, error } = await supabase
    .from("fatture")
    .select("id,importo,data_emissione,data_pagamento,stato,ragione_sociale_id,righe")
    .eq("club_id", club_id);
  if (error) throw error;
  const fatture = ((data ?? []) as any[])
    .filter((f) => f.stato !== "bozza" && f.stato !== "annullata" && dentro(f.data_emissione, stagione))
    .map((f) => ({
      id: String(f.id),
      importo: Number(f.importo) || 0,
      data_emissione: f.data_emissione ?? null,
      data_pagamento: f.data_pagamento ?? null,
      ragione_sociale_id: f.ragione_sociale_id ?? null,
      righe: f.righe,
    }));

  const bilancio = await leggiBilancio(club_id, stagione.id);
  const fonte = scegli(fatture.length, bilancio);

  return {
    fonte,
    fatture,
    n_fatture: fatture.length,
    fatturato: fatture.reduce((s, f) => s + f.importo, 0),
    incassato: fatture.filter((f) => f.data_pagamento).reduce((s, f) => s + f.importo, 0),
    bilancio,
    due_blocchi: fonte === "fatture" && !!bilancio,
  };
}

/**
 * Sola fonte di una stagione, senza portarsi dietro i dati: serve per sapere se
 * due stagioni sono confrontabili. Se una lettura fallisce, l'errore risale.
 */
export async function fonteDiStagione(club_id: string, stagione: Stagione): Promise<Fonte> {
  const { data, error } = await supabase
    .from("fatture").select("data_emissione,stato").eq("club_id", club_id);
  if (error) throw error;
  const n = ((data ?? []) as any[]).filter(
    (f) => f.stato !== "bozza" && f.stato !== "annullata" && dentro(f.data_emissione, stagione),
  ).length;
  const bilancio = await leggiBilancio(club_id, stagione.id);
  return scegli(n, bilancio);
}
