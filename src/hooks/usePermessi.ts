import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { is_admin_like } from "@/lib/roles";

/**
 * Hook centralizzato per i permessi di sezione.
 * - superadmin/admin: bypass totale (sempre true)
 * - ruoli granulari: legge ruoli_permessi_sezioni filtrato per club_id + ruolo
 */
export function usePermessiSezioniMatrix(): {
  visibile_set: Set<string>;
  is_admin_like: boolean;
  is_loading: boolean;
} {
  const { session } = useAuth();
  const admin_like = is_admin_like(session?.ruolo);

  const { data = [], isLoading } = useQuery({
    queryKey: ["ruoli_permessi_sezioni", session?.club_id, session?.ruolo],
    enabled: !!session?.club_id && !!session?.ruolo && !admin_like,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ruoli_permessi_sezioni" as any)
        .select("codice_sezione, visibile")
        .eq("club_id", session!.club_id)
        .eq("ruolo", session!.ruolo);
      if (error) return [];
      return data ?? [];
    },
  });

  const visibile_set = useMemo(() => {
    const s = new Set<string>();
    for (const p of data as any[]) if (p.visibile) s.add(p.codice_sezione);
    return s;
  }, [data]);

  return { visibile_set, is_admin_like: admin_like, is_loading: isLoading };
}

/** True se l'utente loggato può vedere la sezione `codice_sezione`. */
export function useHasPermesso(codice_sezione: string): boolean {
  const { visibile_set, is_admin_like: admin_like } = usePermessiSezioniMatrix();
  if (admin_like) return true;
  return visibile_set.has(codice_sezione);
}

/** Hook analogo per le card di Dashboard. */
export function useDashboardCardsMatrix(): {
  visibile_set: Set<string>;
  is_admin_like: boolean;
} {
  const { session } = useAuth();
  const admin_like = is_admin_like(session?.ruolo);

  const { data = [] } = useQuery({
    queryKey: ["dashboard_card_permessi_self", session?.club_id, session?.ruolo],
    enabled: !!session?.club_id && !!session?.ruolo && !admin_like,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_card_permessi")
        .select("codice_card, visibile")
        .eq("club_id", session!.club_id)
        .eq("ruolo", session!.ruolo);
      if (error) return [];
      return data ?? [];
    },
  });

  const visibile_set = useMemo(() => {
    const s = new Set<string>();
    for (const p of data as any[]) if (p.visibile) s.add(p.codice_card);
    return s;
  }, [data]);

  return { visibile_set, is_admin_like: admin_like };
}

export function useHasDashboardCard(codice_card: string): boolean {
  const { visibile_set, is_admin_like: admin_like } = useDashboardCardsMatrix();
  if (admin_like) return true;
  return visibile_set.has(codice_card);
}
