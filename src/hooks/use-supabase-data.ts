import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase, get_current_club_id } from "@/lib/supabase";

// Helper che legge il club_id dalla sessione React (si aggiorna dopo il login)
function useClubId() {
  const { session } = useAuth();
  return session?.club_id || "";
}


// ─── Club & Setup ──────────────────────────────────────────
export function use_club() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["club"],
    queryFn: async () => {
      const club_id = cid;
      if (!club_id || club_id === "00000000-0000-0000-0000-000000000002") return null;
      const { data, error } = await supabase.from("clubs").select("*").eq("id", club_id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function use_setup_club() {
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["setup_club", cid],
    queryFn: async () => {
      const { data, error } = await supabase.from("setup_club").select("*").eq("club_id", cid).single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });
}

// ─── Stagioni ──────────────────────────────────────────────
export function use_stagioni() {
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["stagioni", cid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stagioni")
        .select("*")
        .eq("club_id", cid)
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Atleti ────────────────────────────────────────────────
export function use_atleti() {
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["atleti", cid],
    queryFn: async () => {
      const { data, error } = await supabase.from("atleti").select("*").eq("club_id", cid).order("cognome");
      if (error) throw error;
      return (data ?? []).map(transform_atleta);
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["atleti_monitori", cid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("*")
        .eq("club_id", cid)
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["istruttori", cid],
    queryFn: async () => {
      const [ist_res, disp_res] = await Promise.all([
        supabase.from("istruttori").select("*").eq("club_id", cid).order("cognome"),
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["corsi", cid],
    queryFn: async () => {
      const [corsi_res, ci_res, ic_res, cm_res] = await Promise.all([
        supabase.from("corsi").select("*").eq("club_id", cid).order("giorno"),
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
    enabled: !!cid,
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["gare", cid],
    queryFn: async () => {
      const [gare_res, isc_res] = await Promise.all([
        supabase.from("gare_calendario").select("*").eq("club_id", cid).order("data"),
        supabase.from("iscrizioni_gare").select("*"),
      ]);
      if (gare_res.error) throw gare_res.error;
      const isc = isc_res.data ?? [];
      return (gare_res.data ?? []).map((g) => ({
        ...g,
        stagione_id: g.stagione_id || null,
        atleti_iscritti: isc
          .filter((x) => x.gara_id === g.id)
          .map((x) => ({
            id: x.id,
            atleta_id: x.atleta_id,
            carriera: x.carriera || "",
            livello_atleta: x.livello_atleta || null,
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["lezioni_private", cid],
    queryFn: async () => {
      const [lez_res, la_res] = await Promise.all([
        supabase.from("lezioni_private").select("*").eq("club_id", cid).order("data"),
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["fatture", cid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatture")
        .select("*")
        .eq("club_id", cid)
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["comunicazioni", cid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicazioni")
        .select("*")
        .eq("club_id", cid)
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
  const cid = useClubId();
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!cid,
    queryKey: ["campi", cid],
    queryFn: async () => {
      const [camp_res, isc_res] = await Promise.all([
        supabase.from("campi_allenamento").select("*").eq("club_id", cid).order("data_inizio"),
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
    enabled: !!cid,
    queryKey: ["presenze", cid, today],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("presenze")
        .select("*")
        .eq("club_id", cid)
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
    enabled: !!cid,
    queryKey: ["tutti_club"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("id, nome, citta").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
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
