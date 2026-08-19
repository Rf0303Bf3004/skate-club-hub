import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

// ─── Tipi ──────────────────────────────────────────────────
export interface RagioneSociale {
  id: string;
  club_id: string;
  nome: string;
  partita_iva: string | null;
  numero_iva: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  paese_iso: string | null;
  iban: string | null;
  intestatario_iban: string | null;
  banca: string | null;
  logo_url: string | null;
  colore_primario: string | null;
  attivo: boolean;
  ordine: number;
}

export interface RagioneSocialeListino {
  id: string;
  ragione_sociale_id: string;
  nome: string;
  prezzo_slot_chf: number | null;
  descrizione: string | null;
  attivo: boolean;
  ordine: number;
}

// ─── Ragioni sociali ───────────────────────────────────────
export function use_ragioni_sociali() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["ragioni_sociali", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ragioni_sociali" as any)
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("ordine")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as any[]) as RagioneSociale[];
    },
  });
}

export function use_upsert_ragione_sociale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RagioneSociale> & { id?: string }) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");
      const row: Record<string, any> = { ...payload, club_id };
      if (!row.id) delete row.id;
      const { data, error } = await supabase
        .from("ragioni_sociali" as any)
        .upsert(row as any)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ragioni_sociali"] });
    },
  });
}

export function use_elimina_ragione_sociale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ragioni_sociali" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ragioni_sociali"] });
      qc.invalidateQueries({ queryKey: ["ragioni_sociali_listini"] });
    },
  });
}

// ─── Listini ───────────────────────────────────────────────
export function use_listini_ragione_sociale(ragione_sociale_id?: string | null) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!ragione_sociale_id,
    queryKey: ["ragioni_sociali_listini", ragione_sociale_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ragioni_sociali_listini" as any)
        .select("*")
        .eq("ragione_sociale_id", ragione_sociale_id)
        .order("ordine")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as any[]) as RagioneSocialeListino[];
    },
  });
}

export function use_upsert_listino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RagioneSocialeListino> & { ragione_sociale_id: string }) => {
      const row: Record<string, any> = { ...payload };
      if (!row.id) delete row.id;
      const { data, error } = await supabase
        .from("ragioni_sociali_listini" as any)
        .upsert(row as any)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ragioni_sociali_listini"] });
    },
  });
}

export function use_elimina_listino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ragioni_sociali_listini" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ragioni_sociali_listini"] });
    },
  });
}

// ─── Tariffe istruttore per ragione sociale ────────────────
export interface IstruttoreTariffaRS {
  id: string;
  istruttore_id: string;
  ragione_sociale_id: string;
  tariffa_oraria_chf: number | null;
  note: string | null;
}

export function use_tariffe_istruttore(istruttore_id?: string | null) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!istruttore_id,
    queryKey: ["istruttori_ragioni_sociali_tariffe", istruttore_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("istruttori_ragioni_sociali_tariffe" as any)
        .select("*")
        .eq("istruttore_id", istruttore_id);
      if (error) throw error;
      return ((data ?? []) as any[]) as IstruttoreTariffaRS[];
    },
  });
}

export function use_upsert_tariffa_istruttore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      istruttore_id: string;
      ragione_sociale_id: string;
      tariffa_oraria_chf: number | null;
      note?: string | null;
    }) => {
      const { error } = await supabase
        .from("istruttori_ragioni_sociali_tariffe" as any)
        .upsert(
          {
            istruttore_id: payload.istruttore_id,
            ragione_sociale_id: payload.ragione_sociale_id,
            tariffa_oraria_chf: payload.tariffa_oraria_chf,
            note: payload.note ?? null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "istruttore_id,ragione_sociale_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["istruttori_ragioni_sociali_tariffe"] });
    },
  });
}
