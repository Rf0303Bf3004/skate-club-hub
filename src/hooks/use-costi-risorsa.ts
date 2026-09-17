import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

/**
 * Costo orario di una risorsa per una stagione.
 * Attenzione: vuoto (NULL) e 0 sono due cose diverse.
 * NULL = non lo sappiamo. 0 = il club non paga quelle ore.
 */
export interface CostoRisorsaStagione {
  id: string;
  club_id: string;
  risorsa_id: string;
  stagione_id: string;
  costo_orario_chf: number | null;
  note: string | null;
}

export function use_costi_risorsa(stagione_id: string | null | undefined) {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["costi_risorsa_stagione", club_id, stagione_id ?? null],
    enabled: !!club_id && !!stagione_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("costi_risorsa_stagione" as any)
        .select("*")
        .eq("club_id", club_id as string)
        .eq("stagione_id", stagione_id as string);
      if (error) throw error;
      return ((data ?? []) as any[]) as CostoRisorsaStagione[];
    },
  });
}

export function use_salva_costo_risorsa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { risorsa_id: string; stagione_id: string; costo_orario_chf: number | null }) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");
      const { error } = await supabase
        .from("costi_risorsa_stagione" as any)
        .upsert(
          {
            club_id,
            risorsa_id: p.risorsa_id,
            stagione_id: p.stagione_id,
            // Il vuoto resta vuoto: non lo trasformiamo in zero.
            costo_orario_chf: p.costo_orario_chf,
          } as any,
          { onConflict: "risorsa_id,stagione_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costi_risorsa_stagione"] });
    },
  });
}
