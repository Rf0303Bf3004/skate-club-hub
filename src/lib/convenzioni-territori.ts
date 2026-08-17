import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Nazione {
  id: string;
  nome: string;
  ordine: number;
}

export interface Regione {
  id: string;
  nazione_id: string;
  nome: string;
  ordine: number;
  convenzioni_nazioni?: Nazione | null;
}

export interface Provincia {
  id: string;
  regione_id: string;
  nome: string;
  ordine: number;
}

/** Etichetta compatta "Regione · Nazione" */
export function label_regione(r: Regione | null | undefined): string {
  if (!r) return "";
  const naz = r.convenzioni_nazioni?.nome;
  return naz ? `${r.nome} · ${naz}` : r.nome;
}

export function use_nazioni() {
  return useQuery({
    queryKey: ["convenzioni_nazioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenzioni_nazioni")
        .select("id, nome, ordine")
        .order("ordine")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Nazione[];
    },
  });
}

export function use_regioni() {
  return useQuery({
    queryKey: ["convenzioni_regioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenzioni_regioni")
        .select("id, nazione_id, nome, ordine, convenzioni_nazioni(id, nome, ordine)")
        .order("ordine")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as unknown as Regione[]);
    },
  });
}

export function use_province() {
  return useQuery({
    queryKey: ["convenzioni_province"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenzioni_province" as any)
        .select("id, regione_id, nome, ordine")
        .order("ordine")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as unknown as Provincia[]);
    },
  });
}

/** Raggruppa le regioni per nazione, rispettando l'ordine delle nazioni. */
export function raggruppa_per_nazione(nazioni: Nazione[], regioni: Regione[]) {
  return nazioni
    .map((n) => ({ nazione: n, regioni: regioni.filter((r) => r.nazione_id === n.id) }))
    .filter((g) => g.regioni.length > 0);
}

// ============== Creazione "al volo" ==============

export async function crea_nazione(nome: string, ordine: number): Promise<Nazione> {
  const { data, error } = await supabase
    .from("convenzioni_nazioni")
    .insert({ nome: nome.trim(), ordine })
    .select("id, nome, ordine")
    .single();
  if (error) throw error;
  return data as Nazione;
}

export async function crea_regione(nazione_id: string, nome: string, ordine: number): Promise<Regione> {
  const { data, error } = await supabase
    .from("convenzioni_regioni")
    .insert({ nazione_id, nome: nome.trim(), ordine })
    .select("id, nazione_id, nome, ordine")
    .single();
  if (error) throw error;
  return data as unknown as Regione;
}

export async function crea_provincia(regione_id: string, nome: string, ordine: number): Promise<Provincia> {
  const { data, error } = await supabase
    .from("convenzioni_province" as any)
    .insert({ regione_id, nome: nome.trim(), ordine })
    .select("id, regione_id, nome, ordine")
    .single();
  if (error) throw error;
  return data as unknown as Provincia;
}
