import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";

/**
 * Programmi musicali delle atlete (bucket privato `dischi-musicali`).
 * Il percorso dei file è sempre `{club_id}/{atleta_id}/{nomefile}.{est}`
 * e l'ascolto avviene solo con collegamenti firmati: mai getPublicUrl.
 */

export const BUCKET_DISCHI = "dischi-musicali";
export const DURATA_FIRMA_SEC = 300;

export type TipoProgramma = "corto" | "libero" | "esibizione" | "gala";

export const TIPI_PROGRAMMA: TipoProgramma[] = ["corto", "libero", "esibizione", "gala"];

export interface ProgrammaMusicale {
  id: string;
  atleta_id: string;
  club_id: string;
  tipo: string;
  titolo_brano: string | null;
  file_path: string | null;
  durata_sec: number | null;
  in_preparazione: boolean;
  attivo: boolean;
}

export interface PuntoProgramma {
  id: string;
  programma_id: string;
  nome: string;
  secondi: number;
  secondi_fine: number | null;
  ordine: number;
}

const CAMPI_PROGRAMMA =
  "id, atleta_id, club_id, tipo, titolo_brano, file_path, durata_sec, in_preparazione, attivo";

/** Firma un percorso del bucket privato. Lancia se non è possibile. */
export async function firma_disco(file_path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_DISCHI)
    .createSignedUrl(file_path, DURATA_FIRMA_SEC);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("signed url mancante");
  return data.signedUrl;
}

/** Costruisce il percorso obbligatorio richiesto dalle regole di sicurezza. */
export function percorso_disco(club_id: string, atleta_id: string, nome_file: string): string {
  return `${club_id}/${atleta_id}/${nome_file}`;
}

/** Programmi attivi di un gruppo di atlete (usato a bordo pista). */
export function use_programmi_atleti(atleta_ids: string[]) {
  const club_id = get_current_club_id();
  const chiave = React.useMemo(() => [...atleta_ids].sort().join(","), [atleta_ids]);

  const query = useQuery({
    queryKey: ["programmi_musicali_gruppo", club_id, chiave],
    enabled: !!club_id && atleta_ids.length > 0,
    queryFn: async (): Promise<ProgrammaMusicale[]> => {
      const { data, error } = await supabase
        .from("programmi_musicali")
        .select(CAMPI_PROGRAMMA)
        .eq("club_id", club_id)
        .eq("attivo", true)
        .in("atleta_id", atleta_ids)
        .order("tipo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProgrammaMusicale[];
    },
  });

  React.useEffect(() => {
    if (query.isError) segnala_errore("Programmi musicali", "lettura programmi", query.error);
  }, [query.isError, query.error]);

  return query;
}

/** Tutti i programmi di una singola atleta (anche non attivi): scheda atleta. */
export function use_programmi_atleta(atleta_id: string | null) {
  const club_id = get_current_club_id();

  const query = useQuery({
    queryKey: ["programmi_musicali_atleta", club_id, atleta_id],
    enabled: !!club_id && !!atleta_id,
    queryFn: async (): Promise<ProgrammaMusicale[]> => {
      const { data, error } = await supabase
        .from("programmi_musicali")
        .select(CAMPI_PROGRAMMA)
        .eq("club_id", club_id)
        .eq("atleta_id", atleta_id as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProgrammaMusicale[];
    },
  });

  React.useEffect(() => {
    if (query.isError) segnala_errore("Programmi musicali", "lettura programmi atleta", query.error);
  }, [query.isError, query.error]);

  return query;
}

/** Punti salvati di un programma. */
export function use_punti_programma(programma_id: string | null) {
  const query = useQuery({
    queryKey: ["punti_programma", programma_id],
    enabled: !!programma_id,
    queryFn: async (): Promise<PuntoProgramma[]> => {
      const { data, error } = await supabase
        .from("punti_programma")
        .select("id, programma_id, nome, secondi, secondi_fine, ordine")
        .eq("programma_id", programma_id as string)
        .order("ordine", { ascending: true })
        .order("secondi", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PuntoProgramma[];
    },
  });

  React.useEffect(() => {
    if (query.isError) segnala_errore("Programmi musicali", "lettura punti", query.error);
  }, [query.isError, query.error]);

  return query;
}
