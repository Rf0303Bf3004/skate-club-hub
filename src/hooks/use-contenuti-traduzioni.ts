import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

type Lingua = "it" | "de" | "fr" | "en" | "rm";

const LINGUE_SUPPORTATE: Lingua[] = ["it", "de", "fr", "en", "rm"];

export type TraduzioniMap = Record<string, Record<string, string>>; // record_id -> campo -> testo

/**
 * Carica le traduzioni del CONTENUTO (tabella `contenuti_traduzioni`) per un
 * insieme di record e restituisce un getter con fallback silenzioso all'originale.
 */
export function use_contenuti_traduzioni(tabella: string, record_ids: string[]) {
  const { i18n } = useTranslation();
  const lingua = (i18n.language || "it").slice(0, 2) as Lingua;
  const attiva = LINGUE_SUPPORTATE.includes(lingua) && lingua !== "it";
  const [mappa, set_mappa] = useState<TraduzioniMap>({});

  const chiave = record_ids.filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!attiva || !chiave) {
      set_mappa({});
      return;
    }
    let annullato = false;
    (async () => {
      const ids = chiave.split(",");
      const { data, error } = await supabase
        .from("contenuti_traduzioni")
        .select(`record_id, campo, ${lingua}`)
        .eq("tabella", tabella)
        .in("record_id", ids);
      if (annullato || error || !data) return;
      const next: TraduzioniMap = {};
      for (const riga of data as any[]) {
        const valore = riga?.[lingua];
        if (!valore) continue;
        next[riga.record_id] = { ...(next[riga.record_id] ?? {}), [riga.campo]: valore };
      }
      set_mappa(next);
    })();
    return () => {
      annullato = true;
    };
  }, [tabella, chiave, lingua, attiva]);

  const traduci = (record_id: string | null | undefined, campo: string, originale?: string | null) =>
    (record_id ? mappa[record_id]?.[campo] : undefined) ?? originale ?? "";

  return { traduci, mappa, lingua, attiva };
}
