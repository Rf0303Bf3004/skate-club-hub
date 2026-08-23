import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

/**
 * Proposte commerciali (Fase 5 — Planning Ghiaccio unificato).
 * Una proposta raggruppa più occorrenze settimanali (righe `corsi`)
 * sotto lo stesso nome/prezzo/livello.
 */
export interface Proposta {
  id: string;
  club_id: string;
  stagione_id: string | null;
  nome: string;
  descrizione: string | null;
  livello_id: string | null;
  prezzo_mensile: number | null;
  attiva: boolean;
  created_at: string;
}

export function use_proposte(solo_attive = true) {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["proposte", club_id, solo_attive],
    enabled: !!club_id,
    queryFn: async (): Promise<Proposta[]> => {
      let q = supabase
        .from("proposte" as any)
        .select("*")
        .eq("club_id", club_id as string)
        .order("nome");
      if (solo_attive) q = q.eq("attiva", true);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]) as Proposta[];
    },
  });
}

export function use_crea_proposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      prezzo_mensile?: number | null;
      livello_id?: string | null;
      descrizione?: string | null;
    }): Promise<Proposta> => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");

      const { data: stagioni, error: err_st } = await supabase
        .from("stagioni")
        .select("id,attiva,data_inizio")
        .eq("club_id", club_id)
        .order("data_inizio", { ascending: false });
      if (err_st) throw err_st;
      const lista = (stagioni ?? []) as any[];
      const stagione = lista.find((s) => s.attiva) ?? lista[0] ?? null;

      const { data, error } = await supabase
        .from("proposte" as any)
        .insert({
          club_id,
          stagione_id: stagione?.id ?? null,
          nome: input.nome.trim(),
          descrizione: input.descrizione ?? null,
          livello_id: input.livello_id ?? null,
          prezzo_mensile: input.prezzo_mensile ?? null,
          attiva: true,
        } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as Proposta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposte"] });
    },
  });
}

export interface PoolProposta {
  proposta: Proposta;
  /** Corso/occorrenza della proposta nel giorno corrente (se esiste). */
  corso_id: string | null;
  atleta_ids: string[];
}

/**
 * Pool "per proposta" per il giorno indicato: per ogni proposta attiva restituisce
 * l'occorrenza (riga `corsi`) di quel giorno-settimana e i suoi iscritti attivi.
 */
export function use_pool_proposte(giorno: string | null) {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["pool_proposte", club_id, giorno],
    enabled: !!club_id && !!giorno,
    queryFn: async (): Promise<PoolProposta[]> => {
      const { data: prop, error: err_p } = await supabase
        .from("proposte" as any)
        .select("*")
        .eq("club_id", club_id as string)
        .eq("attiva", true)
        .order("nome");
      if (err_p) throw err_p;
      const proposte = ((prop ?? []) as any[]) as Proposta[];
      if (proposte.length === 0) return [];

      const { data: corsi, error: err_c } = await supabase
        .from("corsi")
        .select("id,proposta_id,giorno")
        .eq("club_id", club_id as string)
        .eq("giorno", giorno as string)
        .not("proposta_id", "is", null);
      if (err_c) throw err_c;
      const lista_corsi = (corsi ?? []) as any[];

      const corsi_ids = lista_corsi.map((c) => c.id);
      const iscrizioni_per_corso = new Map<string, string[]>();
      if (corsi_ids.length > 0) {
        const { data: isc, error: err_i } = await supabase
          .from("iscrizioni_corsi")
          .select("corso_id,atleta_id,attiva")
          .in("corso_id", corsi_ids);
        if (err_i) throw err_i;
        for (const r of ((isc ?? []) as any[]).filter((x) => x.attiva !== false)) {
          iscrizioni_per_corso.set(r.corso_id, [...(iscrizioni_per_corso.get(r.corso_id) ?? []), r.atleta_id]);
        }
      }

      return proposte.map((p) => {
        const corso = lista_corsi.find((c) => c.proposta_id === p.id) ?? null;
        return {
          proposta: p,
          corso_id: corso?.id ?? null,
          atleta_ids: corso ? iscrizioni_per_corso.get(corso.id) ?? [] : [],
        };
      });
    },
  });
}
