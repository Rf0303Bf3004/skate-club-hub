import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

/** Conti proposti: sono gli unici valori suggeriti nel codice, tutto il resto arriva dalle impostazioni. */
export const CONTI_PROPOSTI = {
  conto_debitori: "1100",
  conto_banca: "1020",
  conto_ricavi_default: "3000",
  conto_iva: "2200",
  conto_sconti: "3800",
} as const;

/** Tipi di voce fatturabile per i quali si può indicare un conto ricavi dedicato. */
export const VOCI_CONTABILI = [
  "Corso",
  "Corso annuale",
  "Pacchetto",
  "Pacchetto annuale",
  "Lezione Privata",
  "Test Livello",
  "Gara",
  "Altro",
] as const;

export type FormatoContabilita = "banana" | "cresus" | "csv";

export interface ImpostazioniContabilita {
  id?: string;
  club_id: string;
  ragione_sociale_id: string | null;
  formato: FormatoContabilita;
  conto_debitori: string | null;
  conto_banca: string | null;
  conto_sconti: string | null;
  conto_iva: string | null;
  codice_iva: string | null;
  conto_ricavi_default: string | null;
  conti_per_voce: Record<string, string>;
}

function normalizza(riga: any): ImpostazioniContabilita {
  let mappa: Record<string, string> = {};
  const grezzo = riga?.conti_per_voce;
  if (grezzo && typeof grezzo === "object" && !Array.isArray(grezzo)) {
    for (const [k, v] of Object.entries(grezzo as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) mappa[k] = v.trim();
    }
  }
  return {
    id: riga.id,
    club_id: riga.club_id,
    ragione_sociale_id: riga.ragione_sociale_id ?? null,
    formato: (riga.formato as FormatoContabilita) || "banana",
    conto_debitori: riga.conto_debitori ?? null,
    conto_banca: riga.conto_banca ?? null,
    conto_sconti: riga.conto_sconti ?? null,
    conto_iva: riga.conto_iva ?? null,
    codice_iva: riga.codice_iva ?? null,
    conto_ricavi_default: riga.conto_ricavi_default ?? null,
    conti_per_voce: mappa,
  };
}

/** Tutte le righe del club (quella generale + una per ogni ragione sociale). */
export function use_impostazioni_contabilita() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["impostazioni_contabilita", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impostazioni_contabilita" as any)
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return ((data ?? []) as any[]).map(normalizza);
    },
  });
}

export interface ImpostazioniRisolte extends Omit<ImpostazioniContabilita, "id" | "club_id"> {
  /** Falso se nessuna riga è ancora stata salvata: si usano i conti proposti. */
  configurato: boolean;
}

/** Impostazione valida per un ente: quella dell'ente vince su quella del club, poi i conti proposti. */
export function risolvi_impostazioni(
  righe: ImpostazioniContabilita[],
  ragione_sociale_id: string | null,
): ImpostazioniRisolte {
  const del_club = righe.find((r) => r.ragione_sociale_id === null) ?? null;
  const dell_ente = ragione_sociale_id
    ? righe.find((r) => r.ragione_sociale_id === ragione_sociale_id) ?? null
    : null;
  const pick = (campo: keyof ImpostazioniContabilita) =>
    (dell_ente?.[campo] as string | null) || (del_club?.[campo] as string | null) || null;

  return {
    ragione_sociale_id,
    formato: (dell_ente?.formato || del_club?.formato || "banana") as FormatoContabilita,
    conto_debitori: pick("conto_debitori") || CONTI_PROPOSTI.conto_debitori,
    conto_banca: pick("conto_banca") || CONTI_PROPOSTI.conto_banca,
    conto_sconti: pick("conto_sconti") || CONTI_PROPOSTI.conto_sconti,
    conto_iva: pick("conto_iva") || CONTI_PROPOSTI.conto_iva,
    conto_ricavi_default: pick("conto_ricavi_default") || CONTI_PROPOSTI.conto_ricavi_default,
    codice_iva: pick("codice_iva"),
    conti_per_voce: {
      ...(del_club?.conti_per_voce ?? {}),
      ...(dell_ente?.conti_per_voce ?? {}),
    },
    configurato: !!(dell_ente || del_club),
  };
}

/**
 * Salvataggio per la coppia (club_id, ragione_sociale_id).
 * La colonna dell'ente può essere nulla: la riga esistente viene cercata prima,
 * così l'aggiornamento non dipende da un indice unico con valori nulli.
 */
export function use_salva_impostazioni_contabilita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valori: Omit<ImpostazioniContabilita, "id" | "club_id">) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Nessun club selezionato.");

      const campi = {
        club_id,
        ragione_sociale_id: valori.ragione_sociale_id,
        formato: valori.formato,
        conto_debitori: valori.conto_debitori || null,
        conto_banca: valori.conto_banca || null,
        conto_sconti: valori.conto_sconti || null,
        conto_iva: valori.conto_iva || null,
        codice_iva: valori.codice_iva || null,
        conto_ricavi_default: valori.conto_ricavi_default || null,
        conti_per_voce: valori.conti_per_voce as any,
      };

      let q = supabase
        .from("impostazioni_contabilita" as any)
        .select("id")
        .eq("club_id", club_id);
      q = valori.ragione_sociale_id
        ? q.eq("ragione_sociale_id", valori.ragione_sociale_id)
        : q.is("ragione_sociale_id", null);
      const { data: esistente, error: err_lettura } = await q.maybeSingle();
      // Lettura fallita: non si scrive al buio.
      if (err_lettura) throw err_lettura;

      if (esistente) {
        const { data, error } = await supabase
          .from("impostazioni_contabilita" as any)
          .update(campi)
          .eq("id", (esistente as any).id)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Nessuna riga aggiornata.");
        return data;
      }

      const { data, error } = await supabase
        .from("impostazioni_contabilita" as any)
        .insert(campi)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Nessuna riga creata.");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impostazioni_contabilita"] });
    },
  });
}
