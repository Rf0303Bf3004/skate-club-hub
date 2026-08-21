import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

// ─── Tipi ──────────────────────────────────────────────────
export interface RisorsaStruttura {
  id: string;
  club_id: string;
  nome: string;
  tipo: "ghiaccio" | "palestra";
  ordine: number;
  attiva: boolean;
  colore: string | null;
  capienza_max: number | null;
  is_ospite: boolean;
  nome_struttura_ospitante: string | null;
  indirizzo_ospitante: string | null;
  evento_campo_id: string | null;
}


// ─── Lettura ───────────────────────────────────────────────
export function use_risorse_strutture() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["risorse_strutture", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risorse_strutture" as any)
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("tipo")
        .order("ordine")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as any[]) as RisorsaStruttura[];
    },
  });
}

// ─── Eventi/Campi del club (per collegare risorse ospiti) ──
export interface EventoCampoOpzione {
  id: string;
  nome: string;
  data_inizio: string | null;
  data_fine: string | null;
}

export function use_eventi_campi_opzioni() {
  return useQuery({
    enabled: !!get_current_club_id(),
    queryKey: ["eventi_campi_opzioni", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventi_campi" as any)
        .select("id, nome, data_inizio, data_fine")
        .eq("club_id", get_current_club_id())
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]) as EventoCampoOpzione[];
    },
  });
}

// ─── Mutation ──────────────────────────────────────────────
export function use_upsert_risorsa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RisorsaStruttura> & { id?: string }) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");
      const row: Record<string, any> = { ...payload, club_id };
      if (!row.id) delete row.id;
      const { data, error } = await supabase
        .from("risorse_strutture" as any)
        .upsert(row as any)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risorse_strutture"] });
    },
  });
}

export function use_elimina_risorsa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("risorse_strutture" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risorse_strutture"] });
    },
  });
}
