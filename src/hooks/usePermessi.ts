import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { is_admin_like } from "@/lib/roles";
import { registra_silenzioso } from "@/lib/errori";
import { card_visibile_di_default } from "@/config/dashboardCards";

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
      if (error) {
        await registra_silenzioso("usePermessi", "Lettura permessi sezioni", error, {
          ruolo: session?.ruolo,
        });
        return [];
      }
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

/**
 * Riquadri della Dashboard visibili al ruolo di chi è collegato.
 *
 * Tre stati, non due: la lettura può essere riuscita, fallita o non ancora
 * arrivata. E una tabella senza righe per quel club e quel ruolo significa
 * «mai configurato», non «tutto spento»: in quel caso valgono i valori di
 * partenza scritti in `src/config/dashboardCards.ts`.
 */
export function useDashboardCardsMatrix(): {
  visibile_set: Set<string>;
  is_admin_like: boolean;
  /** Falso finché non si sa: nessuna riga per questo club e questo ruolo. */
  configurato: boolean;
  ruolo: string | null;
  is_loading: boolean;
  is_error: boolean;
} {
  const { session } = useAuth();
  const admin_like = is_admin_like(session?.ruolo);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard_card_permessi_self", session?.club_id, session?.ruolo],
    enabled: !!session?.club_id && !!session?.ruolo && !admin_like,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_card_permessi")
        .select("codice_card, visibile")
        .eq("club_id", session!.club_id)
        .eq("ruolo", session!.ruolo);
      if (error) {
        await registra_silenzioso("usePermessi", "Lettura permessi card dashboard", error, {
          ruolo: session?.ruolo,
        });
        throw error;
      }
      return data ?? [];
    },
  });

  const visibile_set = useMemo(() => {
    const s = new Set<string>();
    for (const p of data ?? []) if (p.visibile) s.add(p.codice_card);
    return s;
  }, [data]);

  return {
    visibile_set,
    is_admin_like: admin_like,
    configurato: (data?.length ?? 0) > 0,
    ruolo: session?.ruolo ?? null,
    // L'amministrazione non interroga la tabella: per lei non c'è attesa.
    is_loading: admin_like ? false : isLoading,
    is_error: admin_like ? false : isError,
  };
}

/**
 * True se il riquadro va disegnato.
 * Se la matrice non è mai stata configurata (o la lettura è fallita) si usano
 * i valori di partenza del ruolo: meglio la Dashboard prevista che una vuota.
 */
export function useHasDashboardCard(codice_card: string): boolean {
  const { visibile_set, is_admin_like: admin_like, configurato, ruolo } = useDashboardCardsMatrix();
  if (admin_like) return true;
  if (configurato) return visibile_set.has(codice_card);
  return card_visibile_di_default(ruolo, codice_card);
}
