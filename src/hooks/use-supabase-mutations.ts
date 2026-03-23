import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, CURRENT_CLUB_ID } from "@/lib/supabase";

// Helper per ottenere sempre il club_id aggiornato
function cid() { return CURRENT_CLUB_ID; }

const GIORNI_DB = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const GARA_LIVELLI_DB = ["Pulcini","Stellina 1","Stellina 2","Stellina 3","Stellina 4","Interbronzo","Bronzo","Interargento","Argento","Interoro","Oro"] as const;
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
    pulcini: "Pulcini", "stellina 1": "Stellina 1", stellina1: "Stellina 1",
    "stellina 2": "Stellina 2", stellina2: "Stellina 2", "stellina 3": "Stellina 3",
    stellina3: "Stellina 3", "stellina 4": "Stellina 4", stellina4: "Stellina 4",
    interbronzo: "Interbronzo", bronzo: "Bronzo", interargento: "Interargento",
    argento: "Argento", interoro: "Interoro", oro: "Oro",
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
        club_id: cid(),
        nome: data.nome, cognome: data.cognome, data_nascita: data.data_nascita,
        percorso_amatori: data.percorso_amatori || "pulcini",
        carriera_artistica: data.carriera_artistica || null,
        carriera_stile: data.carriera_stile || null,
        atleta_federazione: data.atleta_federazione || false,
        ore_pista_stagione: data.ore_pista_stagione || 0,
        genitore1_nome: data.genitore1_nome || "", genitore1_cognome: data.genitore1_cognome || "",
        genitore1_telefono: data.genitore1_telefono || "", genitore1_email: data.genitore1_email || "",
        genitore2_nome: data.genitore2_nome || "", genitore2_cognome: data.genitore2_cognome || "",
        genitore2_telefono: data.genitore2_telefono || "", genitore2_email: data.genitore2_email || "",
        attivo: data.attivo !== false, note: data.note || "",
        disco_in_preparazione: data.disco_in_preparazione || null,
        tag_nfc: data.tag_nfc || null, foto_url: data.foto_url || null,
        disco_url: data.disco_url || null, ruolo_pista: data.ruolo_pista || "atleta",
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

// ─── Migrazione atleta ─────────────────────────────────────
export function use_migra_atleta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      atleta_id: string;
      atleta_nome: string;
      club_destinazione_id: string;
      note?: string;
    }) => {
      // 1. Sposta l'atleta nel nuovo club
      const { error: e1 } = await supabase.from("atleti")
        .update({ club_id: data.club_destinazione_id })
        .eq("id", data.atleta_id);
      if (e1) throw e1;

      // 2. Rimuovi iscrizioni ai corsi del vecchio club (non applicabili nel nuovo)
      const { error: e2 } = await supabase.from("iscrizioni_corsi")
        .delete().eq("atleta_id", data.atleta_id);
      if (e2) throw e2;

      // 3. Registra la migrazione
      const { error: e3 } = await supabase.from("migrazioni").insert({
        tipo: "atleta",
        persona_id: data.atleta_id,
        persona_nome: data.atleta_nome,
        club_origine_id: cid(),
        club_destinazione_id: data.club_destinazione_id,
        note: data.note || null,
      });
      if (e3) throw e3;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atleti"] });
    },
  });
}

// ─── Migrazione istruttore ─────────────────────────────────
export function use_migra_istruttore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      istruttore_id: string;
      istruttore_nome: string;
      club_destinazione_id: string;
      note?: string;
    }) => {
      // 1. Sposta l'istruttore nel nuovo club
      const { error: e1 } = await supabase.from("istruttori")
        .update({ club_id: data.club_destinazione_id })
        .eq("id", data.istruttore_id);
      if (e1) throw e1;

      // 2. Rimuovi dai corsi del vecchio club
      const { error: e2 } = await supabase.from("corsi_istruttori")
        .delete().eq("istruttore_id", data.istruttore_id);
      if (e2) throw e2;

      // 3. Registra la migrazione
      const { error: e3 } = await supabase.from("migrazioni").insert({
        tipo: "istruttore",
        persona_id: data.istruttore_id,
        persona_nome: data.istruttore_nome,
        club_origine_id: cid(),
        club_destinazione_id: data.club_destinazione_id,
        note: data.note || null,
      });
      if (e3) throw e3;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["istruttori"] });
    },
  });
}

// ─── Istruttori ────────────────────────────────────────────
export function use_upsert_istruttore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: cid(), nome: data.nome, cognome: data.cognome,
        email: data.email || "", telefono: data.telefono || "",
        costo_minuto_lezione_privata: data.costo_minuto_lezione_privata || 0,
        attivo: data.attivo !== false, note: data.note || "",
        foto_url: data.foto_url || null, tag_nfc: data.tag_nfc || null,
        ruolo: data.ruolo || "istruttore", compenso_orario: data.compenso_orario || 0,
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
        club_id: cid(), nome: data.nome, tipo: data.tipo || "",
        giorno: normalize_day(data.giorno),
        ora_inizio: normalize_time(data.ora_inizio, "08:00:00"),
        ora_fine: normalize_time(data.ora_fine, "09:00:00"),
        costo_mensile: data.costo_mensile || 0, costo_annuale: data.costo_annuale || 0,
        attivo: data.attivo !== false, note: data.note || "",
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
            .from("corsi_istruttori").upsert(rows, { onConflict: "corso_id,istruttore_id" });
          if (insert_error) throw insert_error;
        }
      }
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["corsi"] }); },
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
        club_id: cid(), nome: data.nome, data: data.data,
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
      const { error: e1 } = await supabase.from("iscrizioni_gare"