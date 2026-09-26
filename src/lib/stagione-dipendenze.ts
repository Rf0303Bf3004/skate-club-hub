import { supabase } from "@/lib/supabase";

/**
 * Tabelle che hanno un vincolo su `stagioni(id)` (letto dal database il
 * 26.09.2026: 38 tabelle), raggruppate in categorie comprensibili.
 * Se il database aggiunge una tabella, va aggiunta qui; in ogni caso il
 * rifiuto del database resta la protezione vera ed è tradotto a video.
 */
export const CATEGORIE_DIPENDENZE: Record<string, string[]> = {
  storico: [
    "atleti_storici_stagioni", "risultati_storici_stagioni", "test_storici_stagioni",
    "richieste_iscrizione_storiche", "iscrizioni_pacchetti_storiche", "motivi_abbandono_aggregati",
  ],
  lezioni_private: ["lezioni_private_storiche"],
  settimane_planning: ["planning_settimane"],
  ghiaccio: [
    "impostazioni_planning", "griglia_blocchi", "configurazione_ghiaccio",
    "disponibilita_ghiaccio", "ore_pista_disponibili",
  ],
  corsi: ["corsi"],
  iscrizioni: ["adesioni_atleta", "contratti_accettati", "domande_iscrizione"],
  catalogo: ["catalogo_livelli", "catalogo_pacchetti_opzionali", "proposte"],
  gare: ["gare_calendario", "programmi_musicali", "atleta_ppc_elementi"],
  test: ["test_livello"],
  eventi: ["eventi_campi", "eventi_esterni", "eventi_pubblici", "eventi_straordinari"],
  contabilita: [
    "cassa_movimenti", "bilancio_stagione", "ricavi_per_fonte",
    "costi_istruttori", "costi_risorsa_stagione", "ore_lavorate_istruttori",
  ],
  relazione: [
    "relazione_preferenze", "relazioni_allegati", "relazioni_blocchi_testo", "relazioni_paragrafi_auto",
  ],
};

export interface DipendenzaStagione {
  categoria: string;
  totale: number;
}

/**
 * Conta, letto adesso, cosa è collegato a una stagione. Una sola lettura
 * fallita fa fallire tutto (throw): chi chiama non deve cancellare.
 * Restituisce solo le categorie con almeno una riga.
 */
export async function conta_dipendenze_stagione(stagione_id: string): Promise<DipendenzaStagione[]> {
  const voci = Object.entries(CATEGORIE_DIPENDENZE).flatMap(([categoria, tabelle]) =>
    tabelle.map((tabella) => ({ categoria, tabella })),
  );
  const conteggi = await Promise.all(
    voci.map(async ({ categoria, tabella }) => {
      const { count, error } = await supabase
        .from(tabella as never)
        .select("*", { count: "exact", head: true })
        .eq("stagione_id", stagione_id);
      if (error) throw error;
      if (count === null || count === undefined) throw new Error("count_mancante");
      return { categoria, count };
    }),
  );
  const per_categoria = new Map<string, number>();
  for (const c of conteggi) per_categoria.set(c.categoria, (per_categoria.get(c.categoria) ?? 0) + c.count);
  return Object.keys(CATEGORIE_DIPENDENZE)
    .map((categoria) => ({ categoria, totale: per_categoria.get(categoria) ?? 0 }))
    .filter((d) => d.totale > 0);
}
