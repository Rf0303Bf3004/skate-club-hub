import { useQuery } from "@tanstack/react-query";
import { supabase, DEMO_CLUB_ID } from "@/lib/supabase";

// ─── Club & Setup ──────────────────────────────────────────
export function use_club() {
  return useQuery({
    queryKey: ["club", DEMO_CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("*").eq("id", DEMO_CLUB_ID).single();
      if (error) throw error;
      return data;
    },
  });
}

export function use_setup_club() {
  return useQuery({
    queryKey: ["setup_club", DEMO_CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase.from("setup_club").select("*").eq("club_id", DEMO_CLUB_ID).single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });
}

// ─── Stagioni ──────────────────────────────────────────────
export function use_stagioni() {
  return useQuery({
    queryKey: ["stagioni", DEMO_CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stagioni")
        .select("*")
        .eq("club_id", DEMO_CLUB_ID)
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Atleti ────────────────────────────────────────────────
export function use_atleti() {
  return useQuery({
    queryKey: ["atleti", DEMO_CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase.from("atleti").select("*").eq("club_id", DEMO_CLUB_ID).order("cognome");
      if (error) throw error;
      return (data ?? []).map(transform_atleta);
    },
  });
}

function transform_atleta(a: any) {
  return {
    ...a,
    livello_amatori: a.percorso_amatori || "pulcini",
    percorso_amatori_completato: !!(a.carriera_artistica || a.carriera_stile),
    stato: a.attivo ? "attivo" : "inattivo",
    ore_pista_stagione: a.ore_pista_stagione ?? 0,
    genitore_1: {
      nome: a.genitore1_nome || "",
      cognome: a.genitore1_cognome || "",
      telefono: a.genitore1_telefono || "",
      email: a.genitore1_email || "",
    },
    genitore_2: a.genitore2_nome
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

// ─── Istruttori ────────────────────────────────────────────
export function use_istruttori() {
  return useQuery({
    queryKey: ["istruttori", DEMO_CLUB_ID],
    queryFn: async () => {
      const [ist_res, disp_res] = await Promise.all([
        supabase.from("istruttori").select("*").eq("club_id", DEMO_CLUB_ID).order("cognome"),
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
    queryKey: ["corsi", DEMO_CLUB_ID],
    queryFn: async () => {
      const [corsi_res, ci_res, ic_res] = await Promise.all([
        supabase.from("corsi").select("*").eq("club_id", DEMO_CLUB_ID).order("giorno"),
        supabase.from("corsi_istruttori").select("*"),
        supabase.from("iscrizioni_corsi").select("*"),
      ]);
      if (corsi_res.error) throw corsi_res.error;
      const ci = ci_res.data ?? [];
      const ic = ic_res.data ?? [];
      return (corsi_res.data ?? []).map((c) => ({
        ...c,
        stato: c.attivo ? "attivo" : "inattivo",
        istruttori_ids: ci.filter((x) => x.corso_id === c.id).map((x) => x.istruttore_id),
        atleti_ids: ic.filter((x) => x.corso_id === c.id && x.attiva !== false).map((x) => x.atleta_id),
      }));
    },
  });
}

// ─── Gare ──────────────────────────────────────────────────
export function use_gare() {
  return useQuery({
    queryKey: ["gare", DEMO_CLUB_ID],
    queryFn: async () => {
      const [gare_res, isc_res] = await Promise.all([
        supabase.from("gare_calendario").select("*").eq("club_id", DEMO_CLUB_ID).order("data"),
        supabase.from("iscrizioni_gare").select("*"),
      ]);
      if (gare_res.error) throw gare_res.error;
      const isc = isc_res.data ?? [];
      return (gare_res.data ?? []).map((g) => ({
        ...g,
        atleti_iscritti: isc
          .filter((x) => x.gara_id === g.id)
          .map((x) => ({
            id: x.id,
            atleta_id: x.atleta_id,
            carriera: x.carriera || "",
            punteggio: x.punteggio,
            punteggio_tecnico: x.punteggio_tecnico,
            punteggio_artistico: x.punteggio_artistico,
            posizione: x.posizione,
            medaglia: x.medaglia || "",
            voto_giudici: x.voto_giudici,
            note: x.note || "",
          })),
      }));
    },
  });
}

// ─── Lezioni Private ───────────────────────────────────────
export function use_lezioni_private() {
  return useQuery({
    queryKey: ["lezioni_private", DEMO_CLUB_ID],
    queryFn: async () => {
      const [lez_res, la_res] = await Promise.all([
        supabase.from("lezioni_private").select("*").eq("club_id", DEMO_CLUB_ID).order("data"),
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
    queryKey: ["fatture", DEMO_CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatture")
        .select("*")
        .eq("club_id", DEMO_CLUB_ID)
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
    queryKey: ["comunicazioni", DEMO_CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicazioni")
        .select("*")
        .eq("club_id", DEMO_CLUB_ID)
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
    queryKey: ["campi", DEMO_CLUB_ID],
    queryFn: async () => {
      const [camp_res, isc_res] = await Promise.all([
        supabase.from("campi_allenamento").select("*").eq("club_id", DEMO_CLUB_ID).order("data_inizio"),
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
    queryKey: ["presenze", DEMO_CLUB_ID, today],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("presenze")
        .select("*")
        .eq("club_id", DEMO_CLUB_ID)
        .eq("data", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return rows ?? [];
    },
    refetchInterval: 30000, // aggiorna ogni 30 secondi
  });
}

// ─── Helper functions ──────────────────────────────────────
export function get_atleta_name_from_list(atleti: any[], id: string): string {
  const a = atleti.find((x: any) => x.id === id);
  return a ? `${a.nome} ${a.cognome}` : id;
}

export function get_istruttore_name_from_list(istruttori: any[], id: string): string {
  const i = istruttori.find((x: any) => x.id === id);
  return i ? `${i.nome} ${i.cognome}` : id;
}
