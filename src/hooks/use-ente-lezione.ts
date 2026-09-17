import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_ragioni_sociali, type RagioneSociale } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";

/**
 * Enti (ragioni sociali) che possono fatturare una lezione privata.
 * Il campo ha senso solo per i club in modalità `multi_ragione_sociale`
 * che hanno almeno un ente attivo: altrove non deve vedersi niente.
 */
export function use_enti_lezione(): {
  visibile: boolean;
  enti: RagioneSociale[];
  is_loading: boolean;
  is_error: boolean;
} {
  const { modalita, is_loading: modalita_loading } = useModalitaArea("fatturazione");
  const { data, isLoading, isError } = use_ragioni_sociali();
  const attivi = (data ?? []).filter((r) => r.attivo);
  return {
    visibile: modalita === "multi_ragione_sociale" && attivi.length > 0,
    enti: attivi,
    is_loading: modalita_loading || isLoading,
    is_error: isError,
  };
}

/**
 * Ente proposto dal database per quell'istruttore (NULL = il club).
 * È solo una proposta: chi inserisce può cambiarla.
 */
export function use_ente_predefinito(istruttore_id: string | null | undefined, abilitato: boolean) {
  return useQuery({
    queryKey: ["ente_lezione_predefinito", get_current_club_id(), istruttore_id],
    enabled: !!istruttore_id && abilitato,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ente_lezione_predefinito" as any, {
        p_istruttore: istruttore_id,
      } as any);
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

/** Nome dell'ente, per le etichette in lista e nel dettaglio. */
export function use_nome_ente(): (id: string | null | undefined) => string | null {
  const { data } = use_ragioni_sociali();
  return (id) => {
    if (!id) return null;
    const r = (data ?? []).find((x) => x.id === id);
    return r?.nome ?? null;
  };
}
