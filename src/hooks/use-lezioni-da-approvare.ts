import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

/**
 * Lezioni private in attesa di approvazione.
 * Unico punto di lettura e di scrittura: lo usano sia il riquadro della Dashboard
 * sia la linguetta "Da approvare" della pagina Lezioni Private, così i due
 * elenchi e le due azioni non possono divergere.
 */

export const QUERY_KEY_LEZIONI_DA_APPROVARE = ["lezioni_da_approvare"] as const;

export type LezioneDaApprovare = {
  id: string;
  data: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  ricorrente: boolean | null;
  note: string | null;
  istruttore_id: string | null;
  created_at: string | null;
  istruttore: { id: string; nome: string; cognome: string; colore?: string | null } | null;
  atleti: { id: string; nome: string; cognome: string; foto_url?: string | null; foto_path?: string | null }[];
};

export function use_lezioni_da_approvare(refetch_interval?: number) {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: [...QUERY_KEY_LEZIONI_DA_APPROVARE, club_id],
    enabled: !!club_id,
    refetchInterval: refetch_interval,
    queryFn: async (): Promise<LezioneDaApprovare[]> => {
      // Le più vicine per prime: chi approva guarda cosa succede domani.
      const { data, error } = await supabase
        .from("lezioni_private")
        .select("id, data, ora_inizio, ora_fine, ricorrente, note, istruttore_id, created_at")
        .eq("club_id", club_id)
        .eq("richiede_approvazione", true)
        .eq("annullata", false)
        .order("data", { ascending: true })
        .order("ora_inizio", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];

      const lez_ids = rows.map((r) => r.id);
      const ist_ids = [...new Set(rows.map((r) => r.istruttore_id).filter(Boolean))] as string[];

      const [lpa_res, ist_res] = await Promise.all([
        supabase.from("lezioni_private_atlete").select("lezione_id, atleta_id").in("lezione_id", lez_ids),
        ist_ids.length
          ? supabase.from("istruttori").select("id, nome, cognome, colore").in("id", ist_ids)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      if (lpa_res.error) throw lpa_res.error;
      if ((ist_res as any).error) throw (ist_res as any).error;

      const lpa = lpa_res.data ?? [];
      const atl_ids = [...new Set(lpa.map((x: any) => x.atleta_id))];
      let atleti: any[] = [];
      if (atl_ids.length) {
        const { data: a_data, error: a_err } = await supabase
          .from("atleti")
          .select("id, nome, cognome, foto_url, foto_path")
          .in("id", atl_ids);
        if (a_err) throw a_err;
        atleti = a_data ?? [];
      }

      const a_map = new Map(atleti.map((a: any) => [a.id, a]));
      const i_map = new Map(((ist_res as any).data ?? []).map((i: any) => [i.id, i]));
      const atleti_per_lezione = new Map<string, any[]>();
      lpa.forEach((x: any) => {
        const arr = atleti_per_lezione.get(x.lezione_id) ?? [];
        const a = a_map.get(x.atleta_id);
        if (a) arr.push(a);
        atleti_per_lezione.set(x.lezione_id, arr);
      });

      return rows.map((r: any) => ({
        ...r,
        istruttore: r.istruttore_id ? (i_map.get(r.istruttore_id) ?? null) : null,
        atleti: atleti_per_lezione.get(r.id) ?? [],
      }));
    },
  });
}

/** Invalida tutte e tre le letture toccate da un'approvazione o da un rifiuto. */
function invalida_tutto(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUERY_KEY_LEZIONI_DA_APPROVARE });
  qc.invalidateQueries({ queryKey: ["lezioni_private"] });
  qc.invalidateQueries({ queryKey: ["richieste_lezioni_private"] });
}

export function use_approva_lezione_privata(opts?: {
  onSuccess?: () => void;
  onError?: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lezioni_private")
        .update({ richiede_approvazione: false })
        .eq("id", id)
        .eq("club_id", get_current_club_id());
      if (error) throw error;
    },
    onSuccess: () => {
      invalida_tutto(qc);
      opts?.onSuccess?.();
    },
    onError: (e) => opts?.onError?.(e),
  });
}

export function use_rifiuta_lezione_privata(opts?: {
  onSuccess?: () => void;
  onError?: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      note_attuale,
      motivo,
    }: {
      id: string;
      note_attuale: string | null;
      motivo: string;
    }) => {
      const nuove_note = `${note_attuale ?? ""}${note_attuale ? " | " : ""}RIFIUTATA: ${motivo}`.trim();
      const { error } = await supabase
        .from("lezioni_private")
        .update({ annullata: true, richiede_approvazione: false, note: nuove_note })
        .eq("id", id)
        .eq("club_id", get_current_club_id());
      if (error) throw error;
    },
    onSuccess: () => {
      invalida_tutto(qc);
      opts?.onSuccess?.();
    },
    onError: (e) => opts?.onError?.(e),
  });
}
