import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

// ─── Club & Setup ──────────────────────────────────────────
export function use_club() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["club"],
    queryFn: async () => {
      const club_id = get_current_club_id();
      if (!club_id || club_id === "00000000-0000-0000-0000-000000000002") return null;
      const { data, error } = await supabase.from("clubs").select("*").eq("id", club_id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function use_setup_club() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["setup_club", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setup_club")
        .select("*")
        .eq("club_id", get_current_club_id())
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

// ─── Stagioni ──────────────────────────────────────────────
export function use_stagioni() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["stagioni", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stagioni")
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Atleti ────────────────────────────────────────────────
// Ordine livelli: prima carriera federale (dal più alto), poi amatori
const LIVELLO_ORDER: Record<string, number> = {
  "Oro": 1, "Argento": 2, "Bronzo": 3, "Interbronzo": 4,
  "Stelline 4": 5, "Stelline 3": 6, "Stelline 2": 7, "Stelline 1": 8,
  "Pulcini": 9,
};

function get_livello(a: any): string {
  return a.carriera_artistica || a.carriera_stile || a.percorso_amatori || "Pulcini";
}

function livello_rank(a: any): number {
  return LIVELLO_ORDER[get_livello(a)] ?? 99;
}

export function use_atleti() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["atleti", get_current_club_id()],
    queryFn: async () => {
      const club_id = get_current_club_id(); const { data, error } = await supabase.from("atleti").select("*").or("club_id.eq." + club_id + ",club_appartenenza.eq." + club_id);
      if (error) throw error;
      const mapped = (data ?? []).map(transform_atleta);
      return mapped.sort((a, b) => {
        const lvl = livello_rank(a) - livello_rank(b);
        if (lvl !== 0) return lvl;
        return (a.cognome || "").localeCompare(b.cognome || "", "it");
      });
    },
  });
}

function transform_atleta(a: any) {
  return {
    ...a,
    // camelCase aliases per il componente
    percorsoAmatori: a.percorso_amatori || "Pulcini",
    carrieraArtistica: a.carriera_artistica || undefined,
    carrieraStile: a.carriera_stile || undefined,
    atletaFederazione: a.atleta_federazione || false,
    dataNascita: a.data_nascita || "",
    orePista: a.ore_pista_stagione ?? 0,
    foto: a.foto_url || undefined,
    // snake_case originali mantenuti
    livello_amatori: a.percorso_amatori || "Pulcini",
    percorso_amatori_completato: !!(a.carriera_artistica || a.carriera_stile),
    stato: a.attivo ? "attivo" : "inattivo",
    ore_pista_stagione: a.ore_pista_stagione ?? 0,
    genitore1: {
      nome: a.genitore1_nome || "",
      cognome: a.genitore1_cognome || "",
      telefono: a.genitore1_telefono || "",
      email: a.genitore1_email || "",
    },
    genitore2: a.genitore2_nome
      ? {
          nome: a.genitore2_nome,
          cognome: a.genitore2_cognome || "",
          telefono: a.genitore2_telefono || "",
          email: a.genitore2_email || "",
        }
      : undefined,
    data_aggiunta: a.created_at || a.id,
  };
}

// ─── Atleti monitori ───────────────────────────────────────
export function use_atleti_monitori() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["atleti_monitori", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("*")
        .eq("club_id", get_current_club_id())
        .in("ruolo_pista", ["monitore", "aiuto_monitore"])
        .eq("attivo", true)
        .order("cognome");
      if (error) throw error;
      return (data ?? []).map(transform_atleta);
    },
  });
}

// ─── Istruttori ────────────────────────────────────────────
export function use_istruttori() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["istruttori", get_current_club_id()],
    queryFn: async () => {
      const [ist_res, disp_res] = await Promise.all([
        supabase.from("istruttori").select("*").eq("club_id", get_current_club_id()).order("cognome"),
        supabase.from("disponibilita_istruttori").select("*"),
      ]);
      if (ist_res.error) throw ist_res.error;
      if (disp_res.error) throw disp_res.error;
      const disp_all = disp_res.data ?? [];
      return (ist_res.data ?? []).map((i) => {
        const disp_map: Record<string, { ora_inizio: string; ora_fine: string }[]> = {};
        disp_all
          .filter((d) => d.istruttore_id === i.id)
          .forEach((d) => {
            if (!disp_map[d.giorno]) disp_map[d.giorno] = [];
            disp_map[d.giorno].push({ ora_inizio: d.ora_inizio, ora_fine: d.ora_fine });
          });
        return {
          ...i,
          costo_minuto: i.costo_minuto_lezione_privata ?? 0,
          stato: i.attivo ? "attivo" : "inattivo",
          disponibilita: disp_map,
        };
      });
    },
  });
}

// ─── Corsi ─────────────────────────────────────────────────
export function use_corsi() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["corsi", get_current_club_id()],
    queryFn: async () => {
      const [corsi_res, ci_res, ic_res, cm_res] = await Promise.all([
        supabase.from("corsi").select("*").eq("club_id", get_current_club_id()).order("giorno"),
        supabase.from("corsi_istruttori").select("*"),
        supabase.from("iscrizioni_corsi").select("*"),
        supabase.from("corsi_monitori").select("*"),
      ]);
      if (corsi_res.error) throw corsi_res.error;
      const ci = ci_res.data ?? [];
      const ic = ic_res.data ?? [];
      const cm = cm_res.data ?? [];
      return (corsi_res.data ?? []).map((c) => ({
        ...c,
        stato: c.attivo ? "attivo" : "inattivo",
        istruttori_ids: ci.filter((x) => x.corso_id === c.id).map((x) => x.istruttore_id),
        atleti_ids: ic.filter((x) => x.corso_id === c.id && x.attiva !== false).map((x) => x.atleta_id),
        monitori: cm.filter((x) => x.corso_id === c.id && x.tipo === "monitore").map((x) => x.persona_id),
        aiuto_monitori: cm.filter((x) => x.corso_id === c.id && x.tipo === "aiuto_monitore").map((x) => x.persona_id),
      }));
    },
  });
}

// ─── Corsi monitori ────────────────────────────────────────
export function use_corsi_monitori(corso_id?: string) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!corso_id,
    queryKey: ["corsi_monitori", corso_id],
    queryFn: async () => {
      if (!corso_id) return [];
      const { data, error } = await supabase.from("corsi_monitori").select("*").eq("corso_id", corso_id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function use_tutti_corsi_monitori() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["tutti_corsi_monitori"],
    queryFn: async () => {
      const { data, error } = await supabase.from("corsi_monitori").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Presenze corso ────────────────────────────────────────
export function use_presenze_corso(corso_id?: string, data?: string) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!corso_id && !!data,
    queryKey: ["presenze_corso", corso_id, data],
    queryFn: async () => {
      if (!corso_id || !data) return [];
      const { data: rows, error } = await supabase
        .from("presenze_corso")
        .select("*")
        .eq("corso_id", corso_id)
        .eq("data", data);
      if (error) throw error;
      return rows ?? [];
    },
  });
}

// ─── Gare ──────────────────────────────────────────────────
export function use_gare() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["gare", get_current_club_id()],
    queryFn: async () => {
      const [gare_res, isc_res, ris_res] = await Promise.all([
        (supabase as any).from("gare").select("*").eq("club_id", get_current_club_id()).order("data"),
        supabase.from("iscrizioni_gare").select("*"),
        supabase.from("risultati_gara").select("*"),
      ]);
      if (gare_res.error) throw gare_res.error;
      const isc = isc_res.data ?? [];
      const ris = ris_res.data ?? [];
      return (gare_res.data ?? []).map((g: any) => ({
        ...g,
        stagione_id: g.stagione_id || null,
        // Compat shims: la tabella `gare` usa `luogo`, l'UI legge anche `localita`
        localita: g.localita ?? g.luogo ?? "",
        luogo: g.luogo ?? g.localita ?? "",
        tipo: g.tipo || "gara",
        archiviata: g.archiviata ?? false,
        atleti_iscritti: isc
          .filter((x) => x.gara_id === g.id)
          .map((x) => ({
            id: x.id,
            atleta_id: x.atleta_id,
            carriera: x.carriera || "",
            disciplina: x.disciplina || "",
            livello_atleta: x.livello_atleta || null,
            punteggio: x.punteggio,
            punteggio_tecnico: x.punteggio_tecnico,
            punteggio_artistico: x.punteggio_artistico,
            posizione: x.posizione,
            medaglia: x.medaglia || "",
            voto_giudici: x.voto_giudici,
            note: x.note || "",
          })),
        risultati: ris.filter((r) => r.gara_id === g.id),
      }));
    },
  });
}

// ─── Lezioni Private ───────────────────────────────────────
export function use_lezioni_private() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["lezioni_private", get_current_club_id()],
    queryFn: async () => {
      const [lez_res, la_res] = await Promise.all([
        supabase.from("lezioni_private").select("*").eq("club_id", get_current_club_id()).order("data"),
        supabase.from("lezioni_private_atlete").select("*"),
      ]);
      if (lez_res.error) throw lez_res.error;
      const la = la_res.data ?? [];
      return (lez_res.data ?? []).map((l) => ({
        ...l,
        atleti_ids: la.filter((x) => x.lezione_id === l.id).map((x) => x.atleta_id),
        costo: l.costo_totale ?? 0,
      }));
    },
  });
}

// ─── Fatture ───────────────────────────────────────────────
export function use_fatture() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["fatture", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatture")
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("data_scadenza", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((f) => ({
        ...f,
        scadenza: f.data_scadenza,
        stato: f.pagata ? "pagata" : "da_pagare",
        importo: f.importo ?? 0,
      }));
    },
  });
}

// ─── Comunicazioni ─────────────────────────────────────────
export function use_comunicazioni() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["comunicazioni", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicazioni")
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        data: c.created_at?.split("T")[0] || "",
      }));
    },
  });
}

// ─── Campi di allenamento ──────────────────────────────────
export function use_campi() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["campi", get_current_club_id()],
    queryFn: async () => {
      const [camp_res, isc_res] = await Promise.all([
        supabase.from("campi_allenamento").select("*").eq("club_id", get_current_club_id()).order("data_inizio"),
        supabase.from("iscrizioni_campo").select("*"),
      ]);
      if (camp_res.error) throw camp_res.error;
      const isc = isc_res.data ?? [];
      return (camp_res.data ?? []).map((c) => ({
        ...c,
        iscrizioni: isc
          .filter((x) => x.campo_id === c.id)
          .map((x) => ({
            atleta_id: x.atleta_id,
            tipo: x.tipo || "diurno",
            giorni: x.giorni_selezionati,
          })),
      }));
    },
  });
}

// ─── Presenze ──────────────────────────────────────────────
export function use_presenze(data?: string) {
  const today = data || new Date().toISOString().split("T")[0];
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["presenze", get_current_club_id(), today],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("presenze")
        .select("*")
        .eq("club_id", get_current_club_id())
        .eq("data", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return rows ?? [];
    },
    refetchInterval: 30000,
  });
}

// ─── Storico livelli atleta ────────────────────────────────
export function use_storico_livelli(atleta_id: string) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!atleta_id,
    queryKey: ["storico_livelli", atleta_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storico_livelli_atleta")
        .select("*")
        .eq("atleta_id", atleta_id)
        .order("data_inizio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Tutti i club ──────────────────────────────────────────
export function use_tutti_club() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["tutti_club"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("id, nome, citta").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Adesioni Atleta ───────────────────────────────────────
export function use_adesioni_atleta() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["adesioni_atleta", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adesioni_atleta")
        .select("*")
        .eq("club_id", get_current_club_id())
        .eq("stato", "attiva");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function is_atleta_attivo_oggi(adesioni: any[], atleta_id: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return adesioni.some(
    (ad) => ad.atleta_id === atleta_id && ad.data_inizio <= today && ad.data_fine >= today
  );
}

// ─── Helpers ──────────────────────────────────────────────
export function get_stagione_per_data(stagioni: any[], data: string): any | null {
  return stagioni.find((s: any) => data >= s.data_inizio && data <= s.data_fine) || null;
}

export function get_atleta_name_from_list(atleti: any[], id: string): string {
  const a = atleti.find((x: any) => x.id === id);
  return a ? `${a.nome} ${a.cognome}` : id;
}

export function get_istruttore_name_from_list(istruttori: any[], id: string): string {
  const i = istruttori.find((x: any) => x.id === id);
  return i ? `${i.nome} ${i.cognome}` : id;
}

// ─── Richieste Iscrizione ──────────────────────────────────
export function use_richieste_iscrizione() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["richieste_iscrizione", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("richieste_iscrizione")
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => !r.tipo || r.tipo === "corso")
        .map((r: any) => ({
          ...r,
          corso_id: r.corso_id ?? r.riferimento_id ?? "",
          note_richiesta: r.note_richiesta ?? r.note ?? "",
          note_risposta: r.note_risposta ?? "",
        }));
    },
  });
}

// ─── Disponibilità Ghiaccio ────────────────────────────────
export function use_disponibilita_ghiaccio() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["disponibilita_ghiaccio", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilita_ghiaccio")
        .select("*")
        .eq("club_id", get_current_club_id())
        .eq("tipo", "ghiaccio");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Corso Completo Logic ──────────────────────────────────
function _time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

export type CorsoCompletoResult = {
  completo: boolean;
  motivo?: string;
};

export function check_corso_completo(corso: any, disp_ghiaccio: any[]): CorsoCompletoResult {
  // 1. Must have giorno, ora_inizio, ora_fine
  if (!corso.giorno || !corso.ora_inizio || !corso.ora_fine) {
    return { completo: false, motivo: "Giorno/orario non definito" };
  }

  // 2. Per i corsi NON-ghiaccio (Off-Ice, Danza, Pilates, ecc.) basta avere orario definito
  const tipo_lower = (corso.tipo || "").toLowerCase().trim();
  if (tipo_lower !== "ghiaccio") {
    return { completo: true };
  }

  // 3. Solo per i corsi Ghiaccio: verifica che l'orario rientri nelle fasce ghiaccio
  const slots_giorno = disp_ghiaccio.filter((s: any) => s.giorno === corso.giorno);
  if (slots_giorno.length === 0) {
    return { completo: false, motivo: "Nessun ghiaccio disponibile per " + corso.giorno };
  }

  const corso_start = _time_to_min(corso.ora_inizio);
  const corso_end = _time_to_min(corso.ora_fine);
  const coperto = slots_giorno.some(
    (s: any) => _time_to_min(s.ora_inizio) <= corso_start && _time_to_min(s.ora_fine) >= corso_end
  );

  if (!coperto) {
    return { completo: false, motivo: "Orario fuori disponibilità ghiaccio" };
  }

  return { completo: true };
}

/**
 * Returns a filtered list of only complete courses + the raw check function.
 */
export function use_corsi_completi() {
  const { data: corsi = [], ...rest } = use_corsi();
  const { data: disp_ghiaccio = [] } = use_disponibilita_ghiaccio();

  const corsi_completi = corsi.filter((c: any) => check_corso_completo(c, disp_ghiaccio).completo);

  return { corsi_completi, corsi, disp_ghiaccio, ...rest };
}
