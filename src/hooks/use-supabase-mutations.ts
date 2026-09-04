import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

function cid() {
  return get_current_club_id();
}

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
  return aliases[normalized] ?? GARA_LIVELLI_DB.find((l) => l.toLowerCase() === normalized) ?? "Pulcini";
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
  const { data: lezione, error: lezione_error } = await supabase
    .from("lezioni_private")
    .select("id, data, ora_inizio, ora_fine, istruttore_id")
    .eq("id", id)
    .maybeSingle();
  if (lezione_error) throw lezione_error;

  const { error: planning_private_error } = await supabase
    .from("planning_private_settimana")
    .delete()
    .eq("lezione_privata_id", id);
  if (planning_private_error) throw planning_private_error;

  if (lezione?.data && lezione.ora_inizio && lezione.ora_fine && lezione.istruttore_id) {
    const { data: corso_links, error: corso_links_error } = await supabase
      .from("corsi_istruttori")
      .select("corso_id")
      .eq("istruttore_id", lezione.istruttore_id);
    if (corso_links_error) throw corso_links_error;

    const corso_ids = Array.from(new Set((corso_links ?? []).map((row) => row.corso_id).filter(Boolean)));
    if (corso_ids.length > 0) {
      const { data: corsi_privati, error: corsi_error } = await supabase
        .from("corsi")
        .select("id")
        .in("id", corso_ids)
        .eq("tipo", "privata");
      if (corsi_error) throw corsi_error;

      const private_corso_ids = (corsi_privati ?? []).map((row) => row.id);
      if (private_corso_ids.length > 0) {
        const { error: planning_corsi_error } = await supabase
          .from("planning_corsi_settimana")
          .delete()
          .in("corso_id", private_corso_ids)
          .eq("data", lezione.data)
          .eq("ora_inizio", lezione.ora_inizio)
          .eq("ora_fine", lezione.ora_fine)
          .eq("istruttore_id", lezione.istruttore_id);
        if (planning_corsi_error) throw planning_corsi_error;
      }
    }
  }

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
      const club_id = cid();
      // Nuovo modello strutturato. Se categoria è valorizzata, derivo
      // livello_attuale legacy come fallback compatibile per le pagine
      // che ancora leggono il vecchio campo.
      const categoria = data.categoria || undefined;
      const derived_livello_attuale =
        categoria === "pulcini" ? "Pulcini" :
        categoria === "amatori" ? (data.livello_amatori || "Stellina 1") :
        categoria === "artistica" ? (data.livello_artistica || data.livello_amatori || "Interbronzo") :
        (data.livello_attuale || "Pulcini");
      const livello_attuale_nuovo = derived_livello_attuale;
      const payload: Record<string, any> = {
        club_id,
        nome: data.nome,
        cognome: data.cognome,
        data_nascita: data.data_nascita,
        livello_attuale: livello_attuale_nuovo,
        livello_in_preparazione: data.livello_in_preparazione || null,
        // legacy (manteniamo per backward compat solo se passati esplicitamente)
        carriera_artistica: data.carriera_artistica ?? data.livello_artistica ?? null,
        carriera_stile: data.carriera_stile ?? data.livello_stile ?? null,
        // nuovo modello
        ...(categoria !== undefined ? { categoria } : {}),
        ...(data.livello_amatori !== undefined ? { livello_amatori: (["Stellina 1","Stellina 2","Stellina 3","Stellina 4"].includes(data.livello_amatori) ? data.livello_amatori : null) } : {}),
        ...(data.livello_artistica !== undefined ? { livello_artistica: data.livello_artistica || null } : {}),
        ...(data.livello_artistica_in_preparazione !== undefined ? { livello_artistica_in_preparazione: data.livello_artistica_in_preparazione || null } : {}),
        ...(data.livello_stile !== undefined ? { livello_stile: data.livello_stile || null } : {}),
        ...(data.livello_stile_in_preparazione !== undefined ? { livello_stile_in_preparazione: data.livello_stile_in_preparazione || null } : {}),
        atleta_federazione: !!data.atleta_federazione,
        atleta_esterno: !!data.atleta_esterno,
        ...(data.ragione_sociale_id !== undefined ? { ragione_sociale_id: data.ragione_sociale_id || null } : {}),
        ...(data.ragione_sociale_listino_id !== undefined ? { ragione_sociale_listino_id: data.ragione_sociale_listino_id || null } : {}),
        // gerarchia: federazione implica agonista
        agonista: !!(data.agonista || data.atleta_federazione),
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
        ...(data.foto_path !== undefined ? { foto_path: data.foto_path || null } : {}),
        disco_url: data.disco_url || null,
        ruolo_pista: data.ruolo_pista || "atleta",
        compenso_orario_pista: data.compenso_orario_pista || 0,
        attivo_come_monitore: data.attivo_come_monitore || false,
        ...(data.e_aiuto_monitrice !== undefined ? { e_aiuto_monitrice: !!data.e_aiuto_monitrice } : {}),
        ...(data.e_monitrice !== undefined ? { e_monitrice: !!data.e_monitrice } : {}),
        telefono: data.telefono || "",
        sesso: data.sesso || null,
        codice_fiscale: data.codice_fiscale || "",
        indirizzo: data.indirizzo || "",
        cap: data.cap || null,
        citta: data.citta || null,
        cantone: data.cantone || null,
        genitore1_indirizzo: data.genitore1_indirizzo || null,
        genitore1_cap: data.genitore1_cap || null,
        genitore1_citta: data.genitore1_citta || null,
        genitore1_cantone: data.genitore1_cantone || null,
        genitore2_indirizzo: data.genitore2_indirizzo || null,
        genitore2_cap: data.genitore2_cap || null,
        genitore2_citta: data.genitore2_citta || null,
        genitore2_cantone: data.genitore2_cantone || null,
        licenza_sis_numero: data.licenza_sis_numero || "",
        licenza_sis_categoria: data.licenza_sis_categoria || "",
        licenza_sis_disciplina: data.licenza_sis_disciplina || "",
        licenza_sis_validita_a: data.licenza_sis_validita_a || null,
      };

      let atleta_id: string | undefined = data.id;
      let livello_attuale_precedente: string | null = null;
      let atleta_creato: any = null;


      if (data.id) {
        // Recupero livello attuale precedente per decidere se aggiornare lo storico
        const { data: prev } = await supabase
          .from("atleti")
          .select("livello_attuale")
          .eq("id", data.id)
          .maybeSingle();
        livello_attuale_precedente = prev?.livello_attuale ?? null;

        const { error } = await supabase.from("atleti").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("atleti")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        atleta_id = inserted?.id;
        atleta_creato = inserted;
      }


      // Storico livelli: chiudi la voce attiva e aprine una nuova quando livello_attuale cambia
      // (o quando si crea un nuovo atleta).
      const livello_cambiato =
        !data.id || (livello_attuale_precedente && livello_attuale_precedente !== livello_attuale_nuovo);

      if (livello_cambiato && atleta_id) {
        const oggi = new Date().toISOString().slice(0, 10);
        // Chiudi voce attiva precedente
        await supabase
          .from("storico_livelli_atleta")
          .update({ data_fine: oggi })
          .eq("atleta_id", atleta_id)
          .is("data_fine", null);
        // Inserisci nuova voce attiva
        await supabase.from("storico_livelli_atleta").insert({
          atleta_id,
          livello: livello_attuale_nuovo,
          carriera: "comune",
          data_inizio: oggi,
          data_fine: null,
        });
      }

      return { atleta: atleta_creato, is_new: !data.id };
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
      const { error: e9 } = await supabase.from("corsi_monitori").delete().eq("persona_id", id);
      if (e9) throw e9;
      const { error: e10a } = await supabase.from("presenze_corso").delete().eq("atleta_id", id);
      if (e10a) throw e10a;
      const { error: e10b } = await supabase.from("presenze_staff_corso").delete().eq("persona_id", id);
      if (e10b) throw e10b;
      const { error: e11 } = await supabase.from("atleti").delete().eq("id", id);
      if (e11) throw e11;
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
      const { error } = await supabase.rpc("migra_atleta", {
        p_atleta_id: data.atleta_id,
        p_atleta_nome: data.atleta_nome,
        p_club_origine_id: cid(),
        p_club_destinazione_id: data.club_destinazione_id,
        p_note: data.note || null,
      });
      if (error) throw error;
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
        club_id: cid(),
        nome: data.nome,
        cognome: data.cognome,
        // email/telefono possono essere non visibili al chiamante (column-level REVOKE):
        // includili nel payload solo se effettivamente forniti, per non sovrascriverli con "".
        ...(data.email !== undefined ? { email: data.email || "" } : {}),
        ...(data.telefono !== undefined ? { telefono: data.telefono || "" } : {}),
        costo_minuto_lezione_privata: data.costo_minuto_lezione_privata || 0,
        attivo: data.attivo !== false,
        note: data.note || "",
        user_id: data.user_id || null,
        foto_url: data.foto_url || null,
        tag_nfc: data.tag_nfc || null,
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
      const club_id_val = cid();
      if (!club_id_val) {
        throw new Error("Nessun club selezionato. Effettua nuovamente il login e riprova.");
      }

      // Validazione tipo: deve essere binario "Ghiaccio" | "Off-Ice" (vincolo CHECK in DB).
      const tipo_norm = (data.tipo || "").trim();
      if (tipo_norm !== "Ghiaccio" && tipo_norm !== "Off-Ice") {
        throw new Error('Il campo "Tipo" è obbligatorio e deve essere "Ghiaccio" o "Off-Ice".');
      }

      // Niente fallback silenziosi: se il form non valorizza giorno/ora, salviamo NULL.
      const giorno_in = (data.giorno ?? "").toString().trim();
      const giorno_val = giorno_in
        ? GIORNI_DB.find((d) => d.toLowerCase() === giorno_in.toLowerCase()) ?? null
        : null;
      const ora_inizio_val = data.ora_inizio ? normalize_time(data.ora_inizio) : null;
      const ora_fine_val = data.ora_fine ? normalize_time(data.ora_fine) : null;

      const payload: any = {
        club_id: club_id_val,
        nome: (data.nome || "").trim(),
        tipo: tipo_norm,
        categoria: tipo_norm === "Off-Ice" ? (data.categoria?.trim() || null) : null,
        giorno: giorno_val,
        ora_inizio: ora_inizio_val,
        ora_fine: ora_fine_val,
        costo_mensile: data.costo_mensile || 0,
        costo_annuale: data.costo_annuale || 0,
        attivo: data.attivo !== false,
        note: data.note || "",
      };
      if (data.livello_richiesto !== undefined) {
        // Valore "tutti"/stringa vuota indica nessun filtro: salviamo NULL (FK a livelli.nome).
        const liv = data.livello_richiesto;
        payload.livello_richiesto = liv && liv !== "tutti" ? liv : null;
      }
      if (data.percorso !== undefined) payload.percorso = data.percorso || null;
      if (data.stagione_id) payload.stagione_id = data.stagione_id;

      // Debug log per diagnosi salvataggio: visibile in console del browser.
      // eslint-disable-next-line no-console
      console.debug("[use_upsert_corso] payload:", payload, "club_id:", club_id_val);
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
        const { error: de } = await supabase.from("corsi_istruttori").delete().eq("corso_id", corso_id);
        if (de) throw de;
        if (unique_ids.length > 0) {
          const rows = unique_ids.map((istruttore_id) => ({ corso_id, istruttore_id }));
          const { error: ie } = await supabase
            .from("corsi_istruttori")
            .upsert(rows, { onConflict: "corso_id,istruttore_id" });
          if (ie) throw ie;
        }
      }
      if (data.monitori !== undefined || data.aiuto_monitori !== undefined) {
        const { error: dm } = await supabase.from("corsi_monitori").delete().eq("corso_id", corso_id);
        if (dm) throw dm;
        const monitori_rows: any[] = [];
        for (const pid of data.monitori || []) monitori_rows.push({ corso_id, persona_id: pid, tipo: "monitore" });
        for (const pid of data.aiuto_monitori || [])
          monitori_rows.push({ corso_id, persona_id: pid, tipo: "aiuto_monitore" });
        if (monitori_rows.length > 0) {
          const { error: im } = await supabase.from("corsi_monitori").insert(monitori_rows);
          if (im) throw im;
        }
      }
      return corso_id;
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
      const { error: e0 } = await supabase.from("planning_corsi_settimana").delete().eq("corso_id", id);
      if (e0) throw e0;
      const { error: e1 } = await supabase.from("corsi_istruttori").delete().eq("corso_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("iscrizioni_corsi").delete().eq("corso_id", id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("corsi_monitori").delete().eq("corso_id", id);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from("presenze_corso").delete().eq("corso_id", id);
      if (e4) throw e4;
      const { error: e4b } = await supabase.from("presenze_staff_corso").delete().eq("corso_id", id);
      if (e4b) throw e4b;
      const { error: e5 } = await supabase.from("corsi").delete().eq("id", id);
      if (e5) throw e5;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corsi"] });
      qc.invalidateQueries({ queryKey: ["planning_corsi_settimana"] });
    },
  });
}

// ─── Corsi monitori ────────────────────────────────────────
export function use_salva_corsi_monitori() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      corso_id: string;
      monitori: { persona_id: string; tipo: "monitore" | "aiuto_monitore" }[];
    }) => {
      const { error: de } = await supabase.from("corsi_monitori").delete().eq("corso_id", data.corso_id);
      if (de) throw de;
      if (data.monitori.length > 0) {
        const rows = data.monitori.map((m) => ({ corso_id: data.corso_id, persona_id: m.persona_id, tipo: m.tipo }));
        const { error: ie } = await supabase.from("corsi_monitori").insert(rows);
        if (ie) throw ie;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corsi_monitori"] });
      qc.invalidateQueries({ queryKey: ["tutti_corsi_monitori"] });
      qc.invalidateQueries({ queryKey: ["corsi"] });
    },
  });
}

// ─── Presenze corso ────────────────────────────────────────
export function use_upsert_presenza_corso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      corso_id: string;
      persona_id: string;
      tipo_persona: "istruttore" | "monitore" | "aiuto_monitore";
      data: string;
      stato: "attesa" | "confermato" | "assente" | "sostituito";
      sostituto_id?: string;
      note?: string;
    }) => {
      const { error } = await supabase.from("presenze_staff_corso").upsert(
        {
          corso_id: data.corso_id,
          persona_id: data.persona_id,
          tipo_persona: data.tipo_persona,
          data: data.data,
          stato: data.stato,
          sostituto_id: data.sostituto_id || null,
          note: data.note || null,
        },
        { onConflict: "corso_id,persona_id,data" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["presenze_staff_corso", vars.corso_id, vars.data] });
    },
  });
}

// ─── Gare ──────────────────────────────────────────────────
export function use_upsert_gara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload: any = {
        club_id: cid(),
        nome: data.nome,
        data: data.data,
        luogo: data.localita || data.luogo || "",
        tipo: data.tipo || "gara",
      };
      if (data.stagione_id) payload.stagione_id = data.stagione_id;
      if (data.id) {
        const { error } = await (supabase as any).from("gare_calendario").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("gare_calendario").insert(payload);
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
      const { error: e2 } = await (supabase as any).from("gare_calendario").delete().eq("id", id);
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
function monday_of_week(date_str: string) {
  const d = new Date(`${date_str}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function use_crea_lezione_privata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const base_payload = {
        club_id: cid(),
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
        const { data: stagione, error: se } = await supabase
          .from("stagioni")
          .select("id, data_fine")
          .eq("club_id", cid())
          .eq("attiva", true)
          .eq("tipo", "Regolare")
          .order("data_fine", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (se) throw se;
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
        .select("id, data, ora_inizio, ora_fine, istruttore_id")
        .single();
      if (error) throw error;
      await insert_lezioni_private_atlete(lezione ? [lezione] : [], data.atleti_ids || [], data.costo_totale || 0);

      const is_semi = (data.atleti_ids?.length || 0) > 1;
      const nomi = data.atleti_nomi?.length ? data.atleti_nomi : data.atleti_ids || [];
      const corso_nome = `${is_semi ? "Semi" : "Privata"} · ${nomi.join(", ")}`;
      const { data: new_corso } = await supabase.from("corsi").insert({
        club_id: cid(),
        nome: corso_nome,
        tipo: "privata",
        livello_richiesto: "tutti",
        costo_mensile: data.costo_totale || 0,
        note: data.note || "",
        giorno: null as any,
        ora_inizio: null as any,
        ora_fine: null as any,
      }).select("id").single();
      if (new_corso && data.istruttore_id) {
        await supabase.from("corsi_istruttori").insert({
          corso_id: new_corso.id,
          istruttore_id: data.istruttore_id,
        });
      }

      if (lezione && data.has_ice !== false) {
        const data_lunedi = monday_of_week(lezione.data);
        const { data: settimana } = await supabase
          .from("planning_settimane")
          .select("id")
          .eq("club_id", cid())
          .eq("data_lunedi", data_lunedi)
          .maybeSingle();

        if (settimana?.id) {
          const planning_payload = {
            data: lezione.data,
            ora_inizio: lezione.ora_inizio,
            ora_fine: lezione.ora_fine,
            istruttore_id: lezione.istruttore_id,
            annullato: false,
          };

          const { data: existing_planning, error: existing_planning_error } = await supabase
            .from("planning_private_settimana")
            .select("id")
            .eq("settimana_id", settimana.id)
            .eq("lezione_privata_id", lezione.id)
            .maybeSingle();
          if (existing_planning_error) throw existing_planning_error;

          if (existing_planning?.id) {
            const { error: planning_error } = await supabase
              .from("planning_private_settimana")
              .update(planning_payload)
              .eq("id", existing_planning.id);
            if (planning_error) throw planning_error;
          } else {
            const { error: planning_error } = await supabase
              .from("planning_private_settimana")
              .insert({
                settimana_id: settimana.id,
                lezione_privata_id: lezione.id,
                ...planning_payload,
              });
            if (planning_error) throw planning_error;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["corsi"] });
      return lezione;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lezioni_private"] }),
        qc.invalidateQueries({ queryKey: ["corsi"] }),
        qc.invalidateQueries({ queryKey: ["planning_settimana"] }),
        qc.invalidateQueries({ queryKey: ["planning_corsi_settimana"] }),
        qc.invalidateQueries({ queryKey: ["planning_private_settimana"] }),
      ]);
    },
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
      const { error: eu } = await supabase
        .from("lezioni_private")
        .update({ costo_totale: data.nuovo_costo_totale, condivisa: true })
        .eq("id", data.lezione_id);
      if (eu) throw eu;
      for (const aid of data.atleti_ids_esistenti) {
        const { error } = await supabase
          .from("lezioni_private_atlete")
          .update({ quota_costo: quota })
          .eq("lezione_id", data.lezione_id)
          .eq("atleta_id", aid);
        if (error) throw error;
      }
      const { error: ei } = await supabase
        .from("lezioni_private_atlete")
        .insert({ lezione_id: data.lezione_id, atleta_id: data.atleta_id, quota_costo: quota });
      if (ei) throw ei;
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
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lezioni_private"] }),
        qc.invalidateQueries({ queryKey: ["corsi"] }),
        qc.invalidateQueries({ queryKey: ["planning_settimana"] }),
        qc.invalidateQueries({ queryKey: ["planning_corsi_settimana"] }),
        qc.invalidateQueries({ queryKey: ["planning_private_settimana"] }),
      ]);
    },
  });
}

export function use_annulla_ricorrenze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await elimina_lezione_singola(id);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lezioni_private"] }),
        qc.invalidateQueries({ queryKey: ["corsi"] }),
        qc.invalidateQueries({ queryKey: ["planning_settimana"] }),
        qc.invalidateQueries({ queryKey: ["planning_corsi_settimana"] }),
        qc.invalidateQueries({ queryKey: ["planning_private_settimana"] }),
      ]);
    },
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

// ─── Motore di fatturazione (calcolo nel database) ─────────
// Nessun calcolo lato browser: la pagina Fatture chiama le funzioni del DB.

export type AnteprimaFatturaRiga = {
  descrizione: string;
  quantita?: number | null;
  prezzo_unitario?: number | null;
  importo: number;
  tipo?: string | null;
  voce?: string | null;
  periodo_da?: string | null;
  periodo_a?: string | null;
  giorni?: number | null;
  giorni_mese?: number | null;
};

export type AnteprimaFattura = {
  atleta_id: string;
  atleta: string;
  ragione_sociale_id: string | null;
  ragione_sociale: string | null;
  n_righe: number;
  totale: number;
  righe: AnteprimaFatturaRiga[];
  gia_fatturata: boolean;
  avviso: string | null;
};

export type EsitoGenerazione = {
  creata: boolean;
  atleta: string | null;
  numero: string | null;
  totale: number | null;
  motivo: string | null;
};

export function use_anteprima_fatture_periodo() {
  return useMutation({
    mutationFn: async (params: { anno: number; mese: number }): Promise<AnteprimaFattura[]> => {
      const { data, error } = await supabase.rpc("anteprima_fatture_periodo", {
        p_club: cid(),
        p_anno: params.anno,
        p_mese: params.mese,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        totale: Number(r.totale ?? 0),
        righe: Array.isArray(r.righe) ? (r.righe as AnteprimaFatturaRiga[]) : [],
      }));
    },
  });
}

export function use_genera_fatture_periodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { anno: number; mese: number }): Promise<EsitoGenerazione[]> => {
      const { data, error } = await supabase.rpc("genera_fatture_periodo", {
        p_club: cid(),
        p_anno: params.anno,
        p_mese: params.mese,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        totale: r.totale === null || r.totale === undefined ? null : Number(r.totale),
      }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

// ─── Ciclo di vita del documento ───────────────────────────
export function use_annulla_fattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { fattura_id: string; motivo: string }) => {
      const { data, error } = await supabase.rpc("annulla_fattura", {
        p_fattura: params.fattura_id,
        p_motivo: params.motivo,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

export function use_sostituisci_fattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { fattura_id: string; motivo: string }) => {
      const { data, error } = await supabase.rpc("sostituisci_fattura", {
        p_fattura: params.fattura_id,
        p_motivo: params.motivo,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

export function use_storna_fattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { fattura_id: string; motivo: string }) => {
      const { data, error } = await supabase.rpc("storna_fattura", {
        p_fattura: params.fattura_id,
        p_motivo: params.motivo,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

export function use_invia_email_fattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { fattura_id: string; email: string }) => {
      const { invia_fattura_email } = await import("@/lib/fattura-atleta-helpers");
      await invia_fattura_email(params.fattura_id, params.email);
      return params.email;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture"] }),
  });
}

// ─── Comunicazioni ─────────────────────────────────────────
// Ordine progressione (Pulcini=0 ... Oro=10). Usato per filtri "Per livello".
const LIVELLI_ORDER: Record<string, number> = {
  Pulcini: 0,
  "Stellina 1": 1,
  "Stellina 2": 2,
  "Stellina 3": 3,
  "Stellina 4": 4,
  Interbronzo: 5,
  Bronzo: 6,
  Interargento: 7,
  Argento: 8,
  Interoro: 9,
  Oro: 10,
};
// Soglie minime per categoria di destinatari "Per livello".
const SOGLIE_LIVELLO: Record<string, number> = {
  pulcini_only: 0,      // solo Pulcini
  stellina_1_plus: 1,   // Stellina 1 in su
  bronzo_plus: 6,       // Bronzo in su
  argento_plus: 8,      // Argento in su
  oro_plus: 10,         // Oro
};
function livello_atleta_max(a: any): number {
  const art = LIVELLI_ORDER[a?.carriera_artistica] ?? -1;
  const sti = LIVELLI_ORDER[a?.carriera_stile] ?? -1;
  if (art >= 0 || sti >= 0) return Math.max(art, sti);
  return LIVELLI_ORDER[a?.percorso_amatori] ?? 0;
}

export function use_crea_comunicazione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const club_id = cid();

      // FK opzionali per evento collegato (solo una può essere valorizzata)
      const fk_evento = {
        gara_id: data.gara_id ?? null,
        evento_straordinario_id: data.evento_straordinario_id ?? null,
        test_livello_id: data.test_livello_id ?? null,
      };

      const urgente = data.urgente === true;

      // Atleti specifici (selezione esplicita) → lista in atleti_ids (gestita dal trigger)
      if (
        data.tipo_destinatari === "atleti" &&
        Array.isArray(data.atleta_ids_manuali) &&
        data.atleta_ids_manuali.length > 0
      ) {
        const ids = Array.from(new Set(data.atleta_ids_manuali));
        const { error } = await supabase.from("comunicazioni").insert({
          club_id,
          titolo: data.titolo,
          testo: data.testo,
          tipo_destinatari: "atleti",
          atleti_ids: ids,
          urgente,
          ...fk_evento,
        });
        if (error) throw error;
        return;
      }

      if (
        Array.isArray(data.atleta_ids_manuali) &&
        data.atleta_ids_manuali.length > 0 &&
        ["per_corsi", "per_giorno", "per_istruttore"].includes(data.tipo_destinatari)
      ) {
        const { data: ins, error } = await supabase
          .from("comunicazioni")
          .insert({
            club_id,
            titolo: data.titolo,
            testo: data.testo,
            tipo_destinatari: "manuale",
            urgente,
            ...fk_evento,
          })
          .select("id")
          .single();
        if (error) throw error;

        const rows = Array.from(new Set(data.atleta_ids_manuali)).map((atleta_id: string) => ({
          comunicazione_id: ins.id,
          atleta_id,
        }));
        const { error: e_dest } = await supabase.from("comunicazioni_destinatari").insert(rows);
        if (e_dest) throw e_dest;
        return;
      }

      // Atlete che gareggiano (agonista oppure partecipa_gare)
      if (data.tipo_destinatari === "agoniste") {
        const { data: atleti_gare, error: e_ag } = await supabase
          .from("atleti")
          .select("id, agonista, partecipa_gare, attivo")
          .eq("club_id", club_id);
        if (e_ag) throw e_ag;
        const ids_gare = (atleti_gare ?? [])
          .filter((a: any) => a.attivo !== false && (a.agonista === true || a.partecipa_gare === true))
          .map((a: any) => a.id);

        const { data: ins_ag, error: e_ins_ag } = await supabase
          .from("comunicazioni")
          .insert({
            club_id,
            titolo: data.titolo,
            testo: data.testo,
            tipo_destinatari: "manuale",
            urgente,
            ...fk_evento,
          })
          .select("id")
          .single();
        if (e_ins_ag) throw e_ins_ag;
        if (ids_gare.length > 0) {
          const { error: e_dest_ag } = await supabase
            .from("comunicazioni_destinatari")
            .insert(ids_gare.map((atleta_id: string) => ({ comunicazione_id: ins_ag.id, atleta_id })));
          if (e_dest_ag) throw e_dest_ag;
        }
        return;
      }

      // Filtro per livello → popoliamo manualmente i destinatari (bypass trigger "tutti").
      if (data.tipo_destinatari === "per_livello" && data.livello_categoria) {

        const { data: atleti, error: e_at } = await supabase
          .from("atleti")
          .select("id, percorso_amatori, carriera_artistica, carriera_stile")
          .eq("club_id", club_id);
        if (e_at) throw e_at;
        const cat = data.livello_categoria as string;
        const ids: string[] = (atleti ?? [])
          .filter((a) => {
            const liv = livello_atleta_max(a);
            if (cat === "pulcini_only") return liv === 0;
            return liv >= (SOGLIE_LIVELLO[cat] ?? 0);
          })
          .map((a) => a.id);

        const { data: ins, error } = await supabase
          .from("comunicazioni")
          .insert({
            club_id,
            titolo: data.titolo,
            testo: data.testo,
            // 'manuale' evita che il trigger ripopoli su tutto il club.
            tipo_destinatari: "manuale",
            urgente,
            ...fk_evento,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (ids.length > 0) {
          const rows = ids.map((atleta_id) => ({ comunicazione_id: ins.id, atleta_id }));
          const { error: e_dest } = await supabase.from("comunicazioni_destinatari").insert(rows);
          if (e_dest) throw e_dest;
        }
        return;
      }

      const { error } = await supabase.from("comunicazioni").insert({
        club_id,
        titolo: data.titolo,
        testo: data.testo,
        tipo_destinatari: data.tipo_destinatari || "tutti",
        corso_id: data.corso_id || null,
        atleta_id: data.atleta_id || null,
        urgente,
        ...fk_evento,
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
        club_id: cid(),
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
        club_id: cid(),
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
      const club_id = cid();

      // Calcola la differenza rispetto alle fasce esistenti: elimina solo quelle
      // rimosse, inserisce solo quelle nuove, lascia intatte le invariate.
      const { data: attuali, error: fe } = await supabase
        .from("disponibilita_istruttori")
        .select("id, giorno, ora_inizio, ora_fine")
        .eq("istruttore_id", data.istruttore_id);
      if (fe) throw fe;

      const chiave = (giorno: string, ora_inizio: string, ora_fine: string) => `${giorno}|${ora_inizio}|${ora_fine}`;

      const nuove_chiavi = new Set<string>();
      for (const [giorno, slots] of Object.entries(data.disponibilita)) {
        for (const s of slots) nuove_chiavi.add(chiave(giorno, s.ora_inizio, s.ora_fine));
      }

      const attuali_map = new Map<string, string>(); // chiave -> id
      (attuali ?? []).forEach((r: any) => attuali_map.set(chiave(r.giorno, r.ora_inizio, r.ora_fine), r.id));

      const da_eliminare = (attuali ?? [])
        .filter((r: any) => !nuove_chiavi.has(chiave(r.giorno, r.ora_inizio, r.ora_fine)))
        .map((r: any) => r.id);

      const da_inserire: any[] = [];
      for (const [giorno, slots] of Object.entries(data.disponibilita)) {
        for (const s of slots) {
          const k = chiave(giorno, s.ora_inizio, s.ora_fine);
          if (!attuali_map.has(k)) {
            da_inserire.push({ club_id, istruttore_id: data.istruttore_id, giorno, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine });
          }
        }
      }

      if (da_eliminare.length > 0) {
        const { error } = await supabase.from("disponibilita_istruttori").delete().in("id", da_eliminare);
        if (error) throw error;
      }
      if (da_inserire.length > 0) {
        const { error } = await supabase.from("disponibilita_istruttori").insert(da_inserire);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["istruttori"] }),
  });
}

// ─── Presenze ──────────────────────────────────────────────
export type presenza_input = {
  persona_id: string;
  tipo_persona: "istruttore" | "atleta";
  data: string;
  ora_entrata?: string;
  metodo: "nfc" | "manuale";
  note?: string;
  riferimento_id?: string;
  tipo_riferimento?: "corso" | "lezione_privata" | "libero";
};

/**
 * Scrive UNA sola riga di presenza per persona/riferimento/data.
 * La tabella ha un vincolo UNIQUE (persona_id, tipo_persona, data,
 * riferimento_id, tipo_riferimento): l'inserimento usa ON CONFLICT ... DO UPDATE
 * (upsert), così un secondo salvataggio aggiorna la riga invece di duplicarla
 * o fallire. Con `riferimento_id` nullo il vincolo non scatta (NULLS DISTINCT),
 * quindi in quel caso la riga esistente viene cercata prima.
 */
async function scrivi_presenza(data: presenza_input): Promise<{ tipo: "entrata" | "uscita" }> {
  const ora = data.ora_entrata || new Date().toTimeString().slice(0, 5);
  const club_id = cid();

  const query = supabase
    .from("presenze")
    .select("id")
    .eq("club_id", club_id)
    .eq("persona_id", data.persona_id)
    .eq("tipo_persona", data.tipo_persona)
    .eq("data", data.data);
  if (data.riferimento_id) query.eq("riferimento_id", data.riferimento_id);
  else query.is("riferimento_id", null);

  const { data: esistenti, error: err_sel } = await query.limit(1);
  if (err_sel) throw err_sel;
  const existing = (esistenti ?? [])[0];

  if (existing) {
    const { error } = await supabase.from("presenze").update({ ora_uscita: ora }).eq("id", existing.id);
    if (error) throw error;
    return { tipo: "uscita" };
  }

  const riga = {
    club_id,
    persona_id: data.persona_id,
    tipo_persona: data.tipo_persona,
    data: data.data,
    ora_entrata: ora,
    metodo: data.metodo,
    note: data.note ?? null,
    riferimento_id: data.riferimento_id || null,
    tipo_riferimento: data.tipo_riferimento || null,
  };

  const { error } = await supabase
    .from("presenze")
    .upsert(riga as any, {
      onConflict: "persona_id,tipo_persona,data,riferimento_id,tipo_riferimento",
      ignoreDuplicates: false,
    });
  if (error) throw error;
  return { tipo: "entrata" };
}

export function use_segna_presenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: presenza_input) => scrivi_presenza(data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["presenze", cid(), vars.data] });
    },
  });
}

/**
 * Appello di gruppo: una riga per persona, mai N copie.
 * L'elenco in ingresso viene deduplicato sulla chiave del vincolo UNIQUE
 * prima della scrittura (è lì che nasceva la moltiplicazione).
 */
export function use_segna_presenze_massa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (righe: presenza_input[]) => {
      const per_chiave = new Map<string, presenza_input>();
      for (const r of righe) {
        if (!r?.persona_id) continue;
        const chiave = [
          r.persona_id,
          r.tipo_persona,
          r.data,
          r.riferimento_id ?? "",
          r.tipo_riferimento ?? "",
        ].join("|");
        per_chiave.set(chiave, r);
      }
      let scritte = 0;
      for (const r of per_chiave.values()) {
        await scrivi_presenza(r);
        scritte += 1;
      }
      return { scritte };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["presenze", cid(), vars[0]?.data] });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presenze"] }),
  });
}

// ─── Richieste Iscrizione ──────────────────────────────────
export function use_gestisci_richiesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      richiesta_id: string;
      azione: "approvata" | "rifiutata";
      atleta_id: string;
      atleta_nome: string;
      corso_id: string;
      corso_nome: string;
      note_risposta?: string;
      gestita_da?: string;
    }) => {
      // 1) Update request status
      const base_update = { stato: data.azione };
      const update_payload = data.note_risposta?.trim()
        ? { ...base_update, note_risposta: data.note_risposta.trim() }
        : base_update;

      let { error: err1 } = await supabase
        .from("richieste_iscrizione")
        .update(update_payload)
        .eq("id", data.richiesta_id);

      if (err1 && /note_risposta/i.test(err1.message || "")) {
        const retry = await supabase
          .from("richieste_iscrizione")
          .update(base_update)
          .eq("id", data.richiesta_id);
        err1 = retry.error;
      }

      if (err1) throw err1;

      // 2) If approved → create enrollment
      if (data.azione === "approvata") {
        const { error: err2 } = await supabase.from("iscrizioni_corsi").insert({
          atleta_id: data.atleta_id,
          corso_id: data.corso_id,
          attiva: true,
        });
        if (err2) throw err2;
      }

      // 3) Auto-create communication with atleta_id
      const titolo =
        data.azione === "approvata"
          ? `Iscrizione approvata — ${data.corso_nome}`
          : `Iscrizione rifiutata — ${data.corso_nome}`;
      const testo =
        data.azione === "approvata"
          ? `La richiesta di iscrizione di ${data.atleta_nome} al corso ${data.corso_nome} è stata approvata.`
          : `La richiesta di iscrizione di ${data.atleta_nome} al corso ${data.corso_nome} è stata rifiutata.${data.note_risposta ? " Motivo: " + data.note_risposta : ""}`;

      const { error: err3 } = await supabase.from("comunicazioni").insert({
        club_id: cid(),
        titolo,
        testo,
        tipo_destinatari: "per_atleta",
        atleta_id: data.atleta_id,
      });
      if (err3) throw err3;

      // 4) Invia notifica push se il device token esiste
      try {
        const { data: tokens } = await supabase
          .from("device_tokens")
          .select("token")
          .eq("atleta_id", data.atleta_id);
        if (tokens && tokens.length > 0) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tokens.map((t: any) => ({
              to: t.token,
              title: titolo,
              body: testo,
              sound: "default",
            }))),
          });
        }
      } catch (pushErr) {
        console.log("Push notification failed:", pushErr);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["richieste_iscrizione"] });
      qc.invalidateQueries({ queryKey: ["iscrizioni_corsi"] });
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
    },
  });
}

export function use_crea_richiesta_iscrizione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { atleta_id: string; corso_id: string; note_richiesta?: string }) => {
      const { error } = await supabase.from("richieste_iscrizione").insert({
        club_id: cid(),
        atleta_id: data.atleta_id,
        corso_id: data.corso_id,
        note_richiesta: data.note_richiesta || "",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["richieste_iscrizione"] }),
  });
}
