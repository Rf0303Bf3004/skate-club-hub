import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface KpiPitchRow {
  club_id: string;
  stagione_id: string | null;
  atleti_totali: number | null;
  atleti_agonisti: number | null;
  atleti_nuovi_stagione: number | null;
  corsi_attivi: number | null;
  ore_ghiaccio_settimanali: number | null;
  gare_stagione: number | null;
  staff_totale: number | null;
  presenza_media_settimanale: number | null;
}

export function useKpiPitch(club_id?: string | null) {
  return useQuery({
    queryKey: ["kpi_pitch_sponsor", club_id],
    enabled: !!club_id,
    queryFn: async (): Promise<KpiPitchRow | null> => {
      const { data, error } = await supabase
        .from("kpi_pitch_sponsor" as any)
        .select("*")
        .eq("club_id", club_id!)
        .maybeSingle();
      if (error) return null;
      return (data as any) ?? null;
    },
  });
}

/** Restituisce solo le voci con valore > 0, label localizzata. */
export function kpi_visibili(k: KpiPitchRow | null | undefined): { label: string; value: string }[] {
  if (!k) return [];
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, n: number | null | undefined, suffix = "") => {
    const v = Number(n ?? 0);
    if (v > 0) rows.push({ label, value: `${v.toLocaleString("it-CH")}${suffix}` });
  };
  push("Atleti tesserati", k.atleti_totali);
  push("Atleti agonisti", k.atleti_agonisti);
  push("Nuovi atleti questa stagione", k.atleti_nuovi_stagione);
  push("Corsi attivi", k.corsi_attivi);
  push("Ore di ghiaccio settimanali", k.ore_ghiaccio_settimanali, " h");
  push("Gare in calendario stagione", k.gare_stagione);
  push("Staff tecnico attivo", k.staff_totale);
  push("Presenza media settimanale", k.presenza_media_settimanale);
  return rows;
}
