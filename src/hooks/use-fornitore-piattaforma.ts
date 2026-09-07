import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Anagrafica del fornitore della piattaforma (la società che vende Ice Arena
// Manager ai club). Unica fonte di verità: tabella `fornitore_piattaforma`
// (solo superadmin) e vista `fornitore_piattaforma_pubblico` (leggibile da
// tutti, senza dati finanziari).

export type FornitorePubblico = {
  nome: string;
  indirizzo: string;
  cap: string;
  citta: string;
  cantone: string | null;
  paese: string;
  ide: string | null;
  email_info: string;
};

export type FornitoreCompleto = FornitorePubblico & {
  paese_iso: string;
  numero_iva: string | null;
  iban: string | null;
  email_fatture: string | null;
};

// Valori di riserva: la pagina privacy non deve mai restare bianca.
export const FORNITORE_FALLBACK: FornitorePubblico = {
  nome: "SC2-INTECH Sagl",
  indirizzo: "Piazza Nosetto 4b",
  cap: "6500",
  citta: "Bellinzona",
  cantone: "TI",
  paese: "Svizzera",
  ide: "CHE-489.434.744",
  email_info: "info@icearena.ch",
};

export function use_fornitore_pubblico() {
  const q = useQuery({
    queryKey: ["fornitore_piattaforma_pubblico"],
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<FornitorePubblico> => {
      const { data, error } = await supabase
        .from("fornitore_piattaforma_pubblico" as any)
        .select("nome, indirizzo, cap, citta, cantone, paese, ide, email_info")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Anagrafica fornitore non trovata");
      return data as unknown as FornitorePubblico;
    },
  });
  // Nessuno sfarfallio: finché carica (o se fallisce) si usano i valori di riserva.
  return { fornitore: q.data ?? FORNITORE_FALLBACK, is_loading: q.isLoading };
}

export function use_fornitore_completo() {
  const q = useQuery({
    queryKey: ["fornitore_piattaforma"],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<FornitoreCompleto | null> => {
      const { data, error } = await supabase
        .from("fornitore_piattaforma" as any)
        .select("nome, indirizzo, cap, citta, cantone, paese, paese_iso, ide, numero_iva, iban, email_info, email_fatture")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as FornitoreCompleto) ?? null;
    },
  });
  return { fornitore: q.data ?? null, is_loading: q.isLoading };
}
