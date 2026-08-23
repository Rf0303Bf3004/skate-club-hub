import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useMemo } from "react";
import { use_risorse_strutture, type RisorsaStruttura } from "@/hooks/use-risorse-strutture";

/**
 * Fase 6 — Planning unificato (SOLA LETTURA).
 *
 * Normalizza in un unico flusso di eventi le due fonti che oggi convivono:
 *  - Griglia Ghiaccio  → `griglia_blocchi` + `griglia_sessioni` (per data)
 *  - Planning classico → `planning_settimane` + `planning_corsi_settimana` (ricorrente per corso)
 *
 * NOTA sul mapping risorsa per il Planning classico:
 * la tabella `corsi` NON ha una colonna `risorsa_id` (verificato sul database reale),
 * quindi la corsia viene dedotta dal booleano `corsi.usa_ghiaccio`:
 *   usa_ghiaccio = true  → prima risorsa attiva di tipo `ghiaccio`
 *   usa_ghiaccio = false → prima risorsa attiva di tipo `palestra`
 *   nessuna risorsa corrispondente → `risorsa_id = null` ("Non assegnata a una risorsa")
 */

export type FonteEvento = "griglia" | "planning";

export interface EventoUnificato {
  /** chiave univoca fra le due fonti */
  id: string;
  fonte: FonteEvento;
  /** id della riga sorgente (griglia_sessioni.id oppure planning_corsi_settimana.id) */
  ref_id: string;
  data: string; // YYYY-MM-DD
  ora_inizio: string; // HH:MM
  ora_fine: string; // HH:MM
  inizio_min: number;
  fine_min: number;
  risorsa_id: string | null;
  tipo_risorsa: "ghiaccio" | "palestra" | null;
  titolo: string;
  istruttori: string[];
  annullato: boolean;
  /** solo planning: occorrenza extra o sostituzione */
  eccezione: boolean;
}

export function hhmm(t?: string | null): string {
  return (t ?? "").slice(0, 5);
}

export function min_da_hhmm(t?: string | null): number {
  const [h, m] = hhmm(t).split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

export function iso_da_date(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function add_giorni(data_iso: string, n: number): string {
  const d = new Date(`${data_iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso_da_date(d);
}

/** Lunedì della settimana che contiene la data indicata. */
export function lunedi_di_iso(data_iso: string): string {
  const d = new Date(`${data_iso}T00:00:00`);
  const dow = d.getDay(); // 0 = domenica
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return iso_da_date(d);
}

async function fetch_eventi_griglia(club_id: string, da: string, a: string): Promise<EventoUnificato[]> {
  const { data: blocchi, error } = await supabase
    .from("griglia_blocchi" as any)
    .select("id,data,risorsa_id")
    .eq("club_id", club_id)
    .gte("data", da)
    .lte("data", a);
  if (error) throw error;
  const lista_blocchi = (blocchi ?? []) as any[];
  if (lista_blocchi.length === 0) return [];

  const blocchi_ids = lista_blocchi.map((b) => b.id);
  const { data: sessioni, error: err_s } = await supabase
    .from("griglia_sessioni" as any)
    .select("id,blocco_id,ora_inizio,ora_fine,specialita_id,specialita_testo_libero,corso_id")
    .in("blocco_id", blocchi_ids);
  if (err_s) throw err_s;
  const lista_sessioni = (sessioni ?? []) as any[];
  const sessioni_ids = lista_sessioni.map((s) => s.id);

  const [spec_res, corsi_res, si_res, ist_res] = await Promise.all([
    supabase.from("griglia_specialita" as any).select("id,nome").eq("club_id", club_id),
    supabase.from("corsi").select("id,nome").eq("club_id", club_id),
    sessioni_ids.length
      ? supabase.from("griglia_sessioni_istruttori" as any).select("sessione_id,istruttore_id").in("sessione_id", sessioni_ids)
      : Promise.resolve({ data: [], error: null } as any),
    supabase.from("istruttori").select("id,nome,cognome").eq("club_id", club_id),
  ]);

  const spec_map = new Map<string, string>();
  (((spec_res as any)?.data ?? []) as any[]).forEach((s) => spec_map.set(s.id, s.nome));
  const corsi_map = new Map<string, string>();
  (((corsi_res as any)?.data ?? []) as any[]).forEach((c) => corsi_map.set(c.id, c.nome));
  const ist_map = new Map<string, string>();
  (((ist_res as any)?.data ?? []) as any[]).forEach((i) =>
    ist_map.set(i.id, `${i.nome ?? ""} ${i.cognome ?? ""}`.trim() || String(i.id).slice(0, 8)),
  );
  const per_sessione = new Map<string, string[]>();
  (((si_res as any)?.data ?? []) as any[]).forEach((r) => {
    const arr = per_sessione.get(r.sessione_id) ?? [];
    const nome = ist_map.get(r.istruttore_id);
    if (nome) arr.push(nome);
    per_sessione.set(r.sessione_id, arr);
  });

  const blocco_map = new Map<string, any>();
  lista_blocchi.forEach((b) => blocco_map.set(b.id, b));

  return lista_sessioni.map((s) => {
    const b = blocco_map.get(s.blocco_id);
    const titolo =
      (s.corso_id ? corsi_map.get(s.corso_id) : null) ||
      (s.specialita_id ? spec_map.get(s.specialita_id) : null) ||
      s.specialita_testo_libero ||
      "Sessione";
    return {
      id: `g:${s.id}`,
      fonte: "griglia" as const,
      ref_id: s.id,
      data: b?.data ?? "",
      ora_inizio: hhmm(s.ora_inizio),
      ora_fine: hhmm(s.ora_fine),
      inizio_min: min_da_hhmm(s.ora_inizio),
      fine_min: min_da_hhmm(s.ora_fine),
      risorsa_id: b?.risorsa_id ?? null,
      tipo_risorsa: null,
      titolo,
      istruttori: per_sessione.get(s.id) ?? [],
      annullato: false,
      eccezione: false,
    };
  });
}

async function fetch_eventi_planning(club_id: string, da: string, a: string): Promise<EventoUnificato[]> {
  const { data: settimane, error } = await supabase
    .from("planning_settimane" as any)
    .select("id,data_lunedi")
    .eq("club_id", club_id)
    .gte("data_lunedi", add_giorni(da, -7))
    .lte("data_lunedi", a);
  if (error) throw error;
  const ids = ((settimane ?? []) as any[]).map((s) => s.id);
  if (ids.length === 0) return [];

  const { data: occorrenze, error: err_o } = await supabase
    .from("planning_corsi_settimana" as any)
    .select("id,corso_id,data,ora_inizio,ora_fine,istruttore_id,annullato,sostituisce_id,is_evento_extra,titolo_override")
    .in("settimana_id", ids)
    .gte("data", da)
    .lte("data", a);
  if (err_o) throw err_o;
  const lista = (occorrenze ?? []) as any[];
  if (lista.length === 0) return [];

  const [corsi_res, ist_res] = await Promise.all([
    supabase.from("corsi").select("id,nome,usa_ghiaccio").eq("club_id", club_id),
    supabase.from("istruttori").select("id,nome,cognome").eq("club_id", club_id),
  ]);
  const corsi_map = new Map<string, any>();
  (((corsi_res as any)?.data ?? []) as any[]).forEach((c) => corsi_map.set(c.id, c));
  const ist_map = new Map<string, string>();
  (((ist_res as any)?.data ?? []) as any[]).forEach((i) =>
    ist_map.set(i.id, `${i.nome ?? ""} ${i.cognome ?? ""}`.trim() || String(i.id).slice(0, 8)),
  );

  return lista.map((o) => {
    const corso = o.corso_id ? corsi_map.get(o.corso_id) : null;
    const usa_ghiaccio = corso ? corso.usa_ghiaccio !== false : true;
    return {
      id: `p:${o.id}`,
      fonte: "planning" as const,
      ref_id: o.id,
      data: o.data,
      ora_inizio: hhmm(o.ora_inizio),
      ora_fine: hhmm(o.ora_fine),
      inizio_min: min_da_hhmm(o.ora_inizio),
      fine_min: min_da_hhmm(o.ora_fine),
      risorsa_id: null,
      tipo_risorsa: (usa_ghiaccio ? "ghiaccio" : "palestra") as "ghiaccio" | "palestra",
      titolo: o.titolo_override || corso?.nome || "Corso",
      istruttori: o.istruttore_id && ist_map.get(o.istruttore_id) ? [ist_map.get(o.istruttore_id) as string] : [],
      annullato: !!o.annullato,
      eccezione: !!o.sostituisce_id || !!o.is_evento_extra,
    };
  });
}

/** Applica il fallback di corsia alle occorrenze del Planning classico. */
function assegna_risorse(eventi: EventoUnificato[], risorse: RisorsaStruttura[]): EventoUnificato[] {
  const prima_ghiaccio = risorse.find((r) => r.tipo === "ghiaccio" && r.attiva && !r.is_ospite) ??
    risorse.find((r) => r.tipo === "ghiaccio" && r.attiva) ?? null;
  const prima_palestra = risorse.find((r) => r.tipo === "palestra" && r.attiva && !r.is_ospite) ??
    risorse.find((r) => r.tipo === "palestra" && r.attiva) ?? null;
  const tipo_per_id = new Map<string, "ghiaccio" | "palestra">();
  risorse.forEach((r) => tipo_per_id.set(r.id, r.tipo));

  return eventi.map((e) => {
    if (e.fonte === "griglia") {
      return { ...e, tipo_risorsa: e.risorsa_id ? tipo_per_id.get(e.risorsa_id) ?? null : null };
    }
    const target = e.tipo_risorsa === "palestra" ? prima_palestra : prima_ghiaccio;
    return { ...e, risorsa_id: target?.id ?? null };
  });
}

/**
 * Eventi normalizzati (Griglia + Planning classico) nell'intervallo [da_iso, a_iso].
 * Sola lettura: nessuna mutation, nessun drag-and-drop.
 */
export function use_eventi_unificati(da_iso: string, a_iso: string) {
  const club_id = get_current_club_id();
  const { data: risorse = [], isLoading: is_loading_risorse } = use_risorse_strutture();

  const query = useQuery({
    enabled: !!club_id && !!da_iso && !!a_iso,
    staleTime: 30_000,
    queryKey: ["eventi_unificati", club_id, da_iso, a_iso],
    queryFn: async () => {
      const [g, p] = await Promise.all([
        fetch_eventi_griglia(club_id as string, da_iso, a_iso),
        fetch_eventi_planning(club_id as string, da_iso, a_iso),
      ]);
      return [...g, ...p];
    },
  });

  const eventi = useMemo(
    () => assegna_risorse(query.data ?? [], risorse),
    [query.data, risorse],
  );

  return {
    eventi,
    risorse,
    is_loading: query.isLoading || is_loading_risorse,
    error: query.error,
  };
}
