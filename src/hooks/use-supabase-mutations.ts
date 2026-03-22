import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, DEMO_CLUB_ID } from "@/lib/supabase";

const GIORNI_DB = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const GARA_LIVELLI_DB = [
  "Pulcini",
  "Stellina 1",
  "Stellina 2",
  "Stellina 3",
  "Stellina 4",
  "Interbronzo",
  "Bronzo",
  "Interargento",
  "Argento",
  "Interoro",
  "Oro",
] as const;
const GARA_CARRIERE_DB = ["Artistica", "Stile", "Entrambe"] as const;

function normalize_day(value?: string) {
  if (!value) return "Lunedì";
  const normalized = value.trim().toLowerCase();
  const match = GIORNI_DB.find((day) => day.toLowerCase() === normalized);
  return match ?? "Lunedì";
}

function normalize_gara_livello(value?: string) {
  if (!value) return "Pulcini";
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  const aliases: Record<string, string> = {
    pulcini: "Pulcini",
    "stellina 1": "Stellina 1",
    stellina1: "Stellina 1",
    "stellina 2": "Stellina 2",
    stellina2: "Stellina 2",
    "stellina 3": "Stellina 3",
    stellina3: "Stellina 3",
    "stellina 4": "Stellina 4",
    stellina4: "Stellina 4",
    interbronzo: "Interbronzo",
    bronzo: "Bronzo",
    interargento: "Interargento",
    argento: "Argento",
    interoro: "Interoro",
    oro: "Oro",
  };
  return aliases[normalized] ?? GARA_LIVELLI_DB.find((level) => level.toLowerCase() === normalized) ?? "Pulcini";
}

function normalize_gara_carriera(value?: string) {
  if (!value) return "Entrambe";
  const normalized = value.trim().toLowerCase();
  return GARA_CARRIERE_DB.find((item) => item.toLowerCase() === normalized) ?? "Entrambe";
}

function normalize_time(value?: string, fallback = "09:00:00") {
  if (!value) return fallback;
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed;
}

async function insert_lezioni_private_atlete(lezioni: { id: string }[], atleti_ids: string[], costo_totale: number) {
  if (!lezioni.length || !atleti_ids.length) return;
  const quota = costo_totale / atleti_ids.length;
  const rows = lezioni.flatMap((lezione) =>
    atleti_ids.map((atleta_id) => ({ lezione_id: lezione.id, atleta_id, quota_costo: quota })),
  );
  const { error } = await supabase.from("lezioni_private_atlete").insert(rows);
  if (error) throw error;
}

async function elimina_lezione_singola(id: string) {
  const { error: e1 } = await supabase.from("lezioni_private_atlete").delete().eq("lezione_id", id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("lezioni_private").delete().eq("id", id);
  if (e2) throw e2;
}

// ─── Atleti ────────────────────────────────────────────────
export function use_upsert_atleta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        cognome: data.cognome,
        data_nascita: data.data_nascita,
        percorso_amatori: data.percorso_amatori || "pulcini",
        carriera_artistica: data.carriera_artistica || null,
        carriera_stile: data.carriera_stile || null,
        atleta_federazione: data.atleta_federazione || false,
        ore_pista_stagione: data.ore_pista_stagione || 0,
        genitore1_nome: data.genitore1_nome || "",
        genitore1_cognome: data.genitore1_cognome || "",
        genitore1_telefono: data.genitore1_telefono || "",
        genitore1_email: data.genitore1_email || "",
        genitore2_nome: data.genitore2_nome || "",
        genitore2_cognome: data.genitore2_cognome || "",
        genitore2_telefono: data.genitore2_telefono || "",
        genitore2_email: data.genitore2_email || "",
        attivo: data.attivo !== false,
        note: data.note || "",
        disco_in_preparazione: data.disco_in_preparazione || null,
        tag_nfc: data.tag_nfc || null,
        foto_url: data.foto_url || null,
        disco_url: data.disco_url || null,
        ruolo_pista: data.ruolo_pista || "atleta",
        compenso_orario_pista: data.compenso_orario_pista || 0,
        attivo_come_monitore: data.attivo_come_monitore || false,
      };
      if (data.id) {
        const { error } = await supabase.from("atleti").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("atleti").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atleti"] }),
  });
}

export function use_elimina_atleta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("lezioni_private_atlete").delete().eq("atleta_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("iscrizioni_corsi").delete().eq("atleta_id", id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("iscrizioni_gare").delete().eq("atleta_id", id);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from("iscrizioni_campo").delete().eq("atleta_id", id);
      if (e4) throw e4;
      const { error: e5 } = await supabase.from("fatture").delete().eq("atleta_id", id);
      if (e5) throw e5;
      const { error: e6 } = await supabase.from("presenze").delete().eq("persona_id", id);
      if (e6) throw e6;
      const { error: e7 } = await supabase.from("storico_livelli_atleta").delete().eq("atleta_id", id);
      if (e7) throw e7;
      const { error: e8 } = await supabase.from("ore_pista_monitors").delete().eq("atleta_id", id);
      if (e8) throw e8;
      const { error: e9 } = await supabase.from("atleti").delete().eq("id", id);
      if (e9) throw e9;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atleti"] }),
  });
}

// ─── Istruttori ────────────────────────────────────────────
export function use_upsert_istruttore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        cognome: data.cognome,
        email: data.email || "",
        telefono: data.telefono || "",
        costo_minuto_lezione_privata: data.costo_minuto_lezione_privata || 0,
        attivo: data.attivo !== false,
        note: data.note || "",
        foto_url: data.foto_url || null,
        tag_nfc: data.tag_nfc || null,
        ruolo: data.ruolo || "istruttore",
        compenso_orario: data.compenso_orario || 0,
      };
      if (data.id) {
        const { error } = await supabase.from("istruttori").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("istruttori").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["istruttori"] }),
  });
}

export function use_elimina_istruttore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("presenze").delete().eq("persona_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("disponibilita_istruttori").delete().eq("istruttore_id", id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("corsi_istruttori").delete().eq("istruttore_id", id);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from("istruttori").delete().eq("id", id);
      if (e4) throw e4;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["istruttori"] }),
  });
}

// ─── Corsi ─────────────────────────────────────────────────
export function use_upsert_corso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload: any = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        tipo: data.tipo || "",
        giorno: normalize_day(data.giorno),
        ora_inizio: normalize_time(data.ora_inizio, "08:00:00"),
        ora_fine: normalize_time(data.ora_fine, "09:00:00"),
        costo_mensile: data.costo_mensile || 0,
        costo_annuale: data.costo_annuale || 0,
        attivo: data.attivo !== false,
        note: data.note || "",
      };
      if (data.stagione_id) payload.stagione_id = data.stagione_id;
      let corso_id = data.id;
      if (data.id) {
        const { error } = await supabase.from("corsi").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("corsi").insert(payload).select("id").single();
        if (error) throw error;
        corso_id = inserted.id;
      }
      if (data.istruttori_ids) {
        const unique_ids = Array.from(new Set((data.istruttori_ids as string[]).filter(Boolean)));
        const { error: delete_error } = await supabase.from("corsi_istruttori").delete().eq("corso_id", corso_id);
        if (delete_error) throw delete_error;
        if (unique_ids.length > 0) {
          const rows = unique_ids.map((istruttore_id) => ({ corso_id, istruttore_id }));
          const { error: insert_error } = await supabase
            .from("corsi_istruttori")
            .upsert(rows, { onConflict: "corso_id,istruttore_id" });
          if (insert_error) throw insert_error;
        }
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["corsi"] });
    },
  });
}

export function use_elimina_corso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("corsi_istruttori").delete().eq("corso_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("iscrizioni_corsi").delete().eq("corso_id", id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("corsi").delete().eq("id", id);
      if (e3) throw e3;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["corsi"] }),
  });
}

// ─── Gare ──────────────────────────────────────────────────
export function use_upsert_gara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload: any = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        data: data.data,
        ora: normalize_time(data.ora, "09:00:00"),
        club_ospitante: data.club_ospitante || "",
        indirizzo_club_ospitante: data.indirizzo_club_ospitante || "",
        localita: data.localita || "",
        livello_minimo: normalize_gara_livello(data.livello_minimo),
        carriera: normalize_gara_carriera(data.carriera),
        costo_iscrizione: data.costo_iscrizione || 0,
        costo_accompagnamento: data.costo_accompagnamento || 0,
        note: data.note || "",
      };
      if (data.stagione_id) payload.stagione_id = data.stagione_id;
      if (data.id) {
        const { error } = await supabase.from("gare_calendario").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gare_calendario").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gare"] }),
  });
}

export function use_elimina_gara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("iscrizioni_gare").delete().eq("gara_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("gare_calendario").delete().eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gare"] }),
  });
}

export function use_iscrivi_atleta_gara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      atleta_id: string;
      gara_id: string;
      carriera?: string;
      livello_atleta?: string;
      punteggio?: number;
      voto_giudici?: number;
      posizione?: number;
      medaglia?: string;
      costo_iscrizione?: number;
      costo_accompagnamento?: number;
    }) => {
      const { error } = await supabase.from("iscrizioni_gare").insert({
        atleta_id: data.atleta_id,
        gara_id: data.gara_id,
        carriera: data.carriera || "",
        livello_atleta: data.livello_atleta || null,
        punteggio: data.punteggio || null,
        voto_giudici: data.voto_giudici || null,
        posizione: data.posizione || null,
        medaglia: data.medaglia || null,
        costo_iscrizione: data.costo_iscrizione || 0,
        costo_accompagnamento: data.costo_accompagnamento || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gare"] }),
  });
}

// ─── Lezioni Private ───────────────────────────────────────
export function use_crea_lezione_privata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const base_payload = {
        club_id: DEMO_CLUB_ID,
        istruttore_id: data.istruttore_id,
        ora_inizio: normalize_time(data.ora_inizio, "00:00:00"),
        ora_fine: normalize_time(data.ora_fine, "00:20:00"),
        durata_minuti: data.durata_minuti || 20,
        ricorrente: !!data.ricorrente,
        condivisa: (data.atleti_ids?.length || 0) > 1,
        costo_totale: data.costo_totale || 0,
        annullata: false,
        note: data.note || "",
      };
      if (data.ricorrente) {
        const { data: stagione, error: stagione_error } = await supabase
          .from("stagioni")
          .select("id, data_fine")
          .eq("club_id", DEMO_CLUB_ID)
          .eq("attiva", true)
          .eq("tipo", "Regolare")
          .order("data_fine", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (stagione_error) throw stagione_error;
        if (!stagione?.data_fine) throw new Error("Nessuna stagione Regolare attiva trovata");
        const start_date = new Date(`${data.data}T00:00:00`);
        const end_date = new Date(`${stagione.data_fine}T00:00:00`);
        const lesson_rows: any[] = [];
        for (const current = new Date(start_date); current <= end_date; current.setDate(current.getDate() + 7)) {
          lesson_rows.push({
            ...base_payload,
            data:
              current.getFullYear() +
              "-" +
              String(current.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(current.getDate()).padStart(2, "0"),
          });
        }
        const { data: inserted, error } = await supabase.from("lezioni_private").insert(lesson_rows).select("id");
        if (error) throw error;
        await insert_lezioni_private_atlete(inserted ?? [], data.atleti_ids || [], data.costo_totale || 0);
        return inserted;
      }
      const { data: lezione, error } = await supabase
        .from("lezioni_private")
        .insert({ ...base_payload, data: data.data })
        .select("id")
        .single();
      if (error) throw error;
      await insert_lezioni_private_atlete(lezione ? [lezione] : [], data.atleti_ids || [], data.costo_totale || 0);
      return lezione;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lezioni_private"] }),
  });
}

export function use_aggiungi_atleta_lezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      lezione_id: string;
      atleta_id: string;
      nuovo_costo_totale: number;
      modalita_costo: "dividi" | "manuale";
      atleti_ids_esistenti: string[];
    }) => {
      const tutti_atleti = [...data.atleti_ids_esistenti, data.atleta_id];
      const quota = data.nuovo_costo_totale / tutti_atleti.length;
      const { error: err_update } = await supabase
        .from("lezioni_private")
        .update({ costo_totale: data.nuovo_costo_totale, condivisa: true })
        .eq("id", data.lezione_id);
      if (err_update) throw err_update;
      for (const aid of data.atleti_ids_esistenti) {
        const { error } = await supabase
          .from("lezioni_private_atlete")
          .update({ quota_costo: quota })
          .eq("lezione_id", data.lezione_id)
          .eq("atleta_id", aid);
        if (error) throw error;
      }
      const { error: err_insert } = await supabase
        .from("lezioni_private_atlete")
        .insert({ lezione_id: data.lezione_id, atleta_id: data.atleta_id, quota_costo: quota });
      if (err_insert) throw err_insert;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lezioni_private"] }),
  });
}

export function use_annulla_lezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lezione_id: string) => {
      await elimina_lezione_singola(lezione_id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lezioni_private"] }),
  });
}

export function use_annulla_ricorrenze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await elimina_lezione_singola(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lezioni_private"] }),
  });
}

// ─── Fatture ───────────────────────────────────────────────
export function use_segna_fattura_pagata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fatture")
        .update({ pagata: true, data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

export function use_elimina_fattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fatture").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

export function use_genera_fatture_mensili() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const now = new Date();
      const anno = now.getFullYear();
      const mese = now.getMonth() + 1;
      const mese_str = String(mese).padStart(2, "0");
      const data_inizio_mese = `${anno}-${mese_str}-01`;
      const data_fine_mese = new Date(anno, mese, 0).toISOString().split("T")[0];
      const scadenza = data_fine_mese;
      const mese_label = now.toLocaleString("it-CH", { month: "long", year: "numeric" });

      const { data: fatture_esistenti } = await supabase
        .from("fatture")
        .select("numero")
        .eq("club_id", DEMO_CLUB_ID)
        .order("numero", { ascending: false })
        .limit(1);
      let next_num = 1;
      if (fatture_esistenti?.length) {
        const match = fatture_esistenti[0].numero?.match(/(\d+)/);
        if (match) next_num = parseInt(match[1]) + 1;
      }

      const fatture_da_creare: any[] = [];

      const { data: corsi } = await supabase.from("corsi").select("*").eq("club_id", DEMO_CLUB_ID).eq("attivo", true);
      const { data: iscrizioni_corsi } = await supabase.from("iscrizioni_corsi").select("*").eq("attiva", true);

      for (const isc of iscrizioni_corsi || []) {
        const corso = (corsi || []).find((c: any) => c.id === isc.corso_id);
        if (!corso || !corso.costo_mensile) continue;
        fatture_da_creare.push({
          club_id: DEMO_CLUB_ID,
          atleta_id: isc.atleta_id,
          numero: `F-${String(next_num++).padStart(4, "0")}`,
          descrizione: `Corso ${corso.nome} - ${mese_label}`,
          importo: corso.costo_mensile,
          data_emissione: now.toISOString().split("T")[0],
          data_scadenza: scadenza,
          pagata: false,
          tipo: "corso",
          riferimento_id: corso.id,
        });
      }

      const { data: lezioni_mese } = await supabase
        .from("lezioni_private")
        .select("*, lezioni_private_atlete(*)")
        .eq("club_id", DEMO_CLUB_ID)
        .gte("data", data_inizio_mese)
        .lte("data", data_fine_mese)
        .eq("annullata", false);

      const totale_per_atleta: Record<string, number> = {};
      for (const lezione of lezioni_mese || []) {
        for (const la of lezione.lezioni_private_atlete || []) {
          totale_per_atleta[la.atleta_id] = (totale_per_atleta[la.atleta_id] || 0) + (la.quota_costo || 0);
        }
      }

      for (const [atleta_id, totale] of Object.entries(totale_per_atleta)) {
        if (totale <= 0) continue;
        fatture_da_creare.push({
          club_id: DEMO_CLUB_ID,
          atleta_id,
          numero: `F-${String(next_num++).padStart(4, "0")}`,
          descrizione: `Lezioni private - ${mese_label}`,
          importo: totale,
          data_emissione: now.toISOString().split("T")[0],
          data_scadenza: scadenza,
          pagata: false,
          tipo: "lezione_privata",
          riferimento_id: null,
        });
      }

      if (fatture_da_creare.length > 0) {
        const { error } = await supabase.from("fatture").insert(fatture_da_creare);
        if (error) throw error;
      }

      return fatture_da_creare.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

// ─── Comunicazioni ─────────────────────────────────────────
export function use_crea_comunicazione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("comunicazioni").insert({
        club_id: DEMO_CLUB_ID,
        titolo: data.titolo,
        testo: data.testo,
        tipo_destinatari: data.tipo_destinatari || "tutti",
        corso_id: data.corso_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comunicazioni"] }),
  });
}

// ─── Stagioni ──────────────────────────────────────────────
export function use_upsert_stagione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        tipo: data.tipo || "Regolare",
        data_inizio: data.data_inizio,
        data_fine: data.data_fine,
        attiva: data.attiva === true || data.attiva === "true",
      };
      if (data.id) {
        const { error } = await supabase.from("stagioni").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stagioni").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stagioni"] }),
  });
}

export function use_elimina_stagione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stagioni").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stagioni"] }),
  });
}

// ─── Campi di allenamento ──────────────────────────────────
export function use_upsert_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        data_inizio: data.data_inizio,
        data_fine: data.data_fine,
        luogo: data.luogo || "",
        club_ospitante: data.club_ospitante || "",
        costo_diurno: data.costo_diurno || 0,
        costo_completo: data.costo_completo || 0,
        note: data.note || "",
      };
      if (data.id) {
        const { error } = await supabase.from("campi_allenamento").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campi_allenamento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campi"] }),
  });
}

export function use_elimina_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("iscrizioni_campo").delete().eq("campo_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("campi_allenamento").delete().eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campi"] }),
  });
}

export function use_iscrivi_atleta_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { campo_id: string; atleta_id: string; tipo: string; costo_totale: number }) => {
      const { error } = await supabase.from("iscrizioni_campo").insert({
        campo_id: data.campo_id,
        atleta_id: data.atleta_id,
        tipo: data.tipo,
        costo_totale: data.costo_totale,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campi"] }),
  });
}

// ─── Disponibilità istruttori ──────────────────────────────
export function use_save_disponibilita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      istruttore_id: string;
      disponibilita: Record<string, { ora_inizio: string; ora_fine: string }[]>;
    }) => {
      const { error: del_err } = await supabase
        .from("disponibilita_istruttori")
        .delete()
        .eq("istruttore_id", data.istruttore_id);
      if (del_err) throw del_err;
      const rows: any[] = [];
      for (const [giorno, slots] of Object.entries(data.disponibilita)) {
        for (const s of slots)
          rows.push({ istruttore_id: data.istruttore_id, giorno, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine });
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("disponibilita_istruttori").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["istruttori"] }),
  });
}

// ─── Presenze ──────────────────────────────────────────────
// FIX: aggiunto riferimento_id e tipo_riferimento per appello atlete
export function use_segna_presenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      persona_id: string;
      tipo_persona: "istruttore" | "atleta";
      data: string;
      ora_entrata?: string;
      metodo: "nfc" | "manuale";
      note?: string;
      riferimento_id?: string;
      tipo_riferimento?: "corso" | "lezione_privata" | "libero";
    }) => {
      // Per l'appello atlete: cerca presenza specifica per corso/lezione
      // Per istruttori: cerca presenza generica del giorno
      const query = supabase
        .from("presenze")
        .select("id")
        .eq("club_id", DEMO_CLUB_ID)
        .eq("persona_id", data.persona_id)
        .eq("data", data.data);

      if (data.riferimento_id) {
        query.eq("riferimento_id", data.riferimento_id);
      } else {
        query.is("riferimento_id", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("presenze")
          .update({ ora_uscita: data.ora_entrata || new Date().toTimeString().slice(0, 5) })
          .eq("id", existing.id);
        if (error) throw error;
        return { tipo: "uscita" };
      } else {
        const { error } = await supabase.from("presenze").insert({
          club_id: DEMO_CLUB_ID,
          persona_id: data.persona_id,
          tipo_persona: data.tipo_persona,
          data: data.data,
          ora_entrata: data.ora_entrata || new Date().toTimeString().slice(0, 5),
          metodo: data.metodo,
          note: data.note || null,
          riferimento_id: data.riferimento_id || null,
          tipo_riferimento: data.tipo_riferimento || null,
        });
        if (error) throw error;
        return { tipo: "entrata" };
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["presenze", DEMO_CLUB_ID, vars.data] });
    },
  });
}

export function use_elimina_presenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("presenze").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presenze"] });
    },
  });
}
