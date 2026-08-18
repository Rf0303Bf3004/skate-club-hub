import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

/**
 * Modalità di gestione configurata per un'area operativa del club.
 * Default SEMPRE "standard" se non esiste alcuna riga o durante il caricamento.
 */
export function useModalitaArea(area: string): {
  modalita: string;
  is_loading: boolean;
} {
  const club_id = get_current_club_id();

  const { data, isLoading } = useQuery({
    queryKey: ["moduli_gestione_club", club_id, area],
    enabled: !!club_id && !!area,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moduli_gestione_club" as any)
        .select("modalita")
        .eq("club_id", club_id)
        .eq("area", area)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
  });

  return {
    modalita: (data?.modalita as string) || "standard",
    is_loading: isLoading,
  };
}
