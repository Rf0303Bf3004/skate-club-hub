import { format_local_iso } from "@/lib/planning-occorrenze";
// Conteggio delle atlete legato alla stagione scelta: un solo punto, usato da
// paragraphGenerator, kpiData e dai moduli grafici. La stagione in corso si
// conta viva di oggi; una stagione chiusa si legge dallo storico di quella
// stagione. Se lo storico non c'è, il numero non si scrive.

import { supabase } from "@/lib/supabase";
import type { Stagione } from "@/lib/relazione/moduli";

/** La stagione è quella in corso se oggi cade fra le sue date. */
export function stagione_in_corso(stag: Stagione): boolean {
  if (!stag?.data_inizio || !stag?.data_fine) return false;
  const oggi = format_local_iso(new Date());
  return oggi >= String(stag.data_inizio).slice(0, 10) && oggi <= String(stag.data_fine).slice(0, 10);
}

/**
 * Le atlete della stagione scelta. In corso: anagrafico vivo. Chiusa: le
 * righe dello storico di quella stagione, arricchite con l'anagrafica.
 * La lettura fallisce con un throw: chi chiama decide se scrivere.
 */
export async function fetchAtletiDellaStagione(
  club_id: string,
  stagione: Stagione,
  colonne = "id,agonista,livello_attuale,categoria,data_nascita",
): Promise<any[] | null> {
  if (stagione_in_corso(stagione)) {
    const { data, error } = await supabase
      .from("atleti").select(colonne).eq("club_id", club_id).eq("attivo", true);
    if (error) throw error;
    return (data ?? []) as any[];
  }
  const { data: storico, error: e1 } = await supabase
    .from("atleti_storici_stagioni").select("atleta_id")
    .eq("club_id", club_id).eq("stagione_id", stagione.id).eq("status", "attivo");
  if (e1) throw e1;
  const ids = ((storico ?? []) as any[]).map((r) => r.atleta_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("atleti").select(colonne).in("id", ids);
  if (error) throw error;
  return (data ?? []) as any[];
}
