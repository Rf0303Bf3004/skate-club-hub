// Campagna iscrizioni di stagione: letture e scritture in un punto solo.
// Tutte le funzioni del database esistono già: qui non si crea né si modifica
// niente, si chiamano le RPC così come sono.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

export interface StatoCampagna {
  invitati: number;
  confermati: number;
  non_rinnovati: number;
  domande_in_attesa: number;
  scadenza: string | null;
  aperta: boolean;
}

export interface RigaRegistro {
  atleta_id: string;
  status: string;
  confermato_il: string | null;
  confermato_da: string | null;
  note: string | null;
  livello: string | null;
  atleta: {
    id: string;
    nome: string | null;
    cognome: string | null;
    codice_atleta: string | null;
    categoria: string | null;
    livello_amatori: string | null;
    livello_artistica: string | null;
  } | null;
}

export interface Domanda {
  id: string;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  sesso: string | null;
  genitore1_nome: string | null;
  genitore1_cognome: string | null;
  genitore1_email: string | null;
  genitore1_telefono: string | null;
  genitore1_indirizzo: string | null;
  genitore1_cap: string | null;
  genitore1_citta: string | null;
  genitore1_cantone: string | null;
  genitore1_paese_iso: string | null;
  contratto_accettato_at: string | null;
  livello_dichiarato: string | null;
  esperienza: string | null;
  club_provenienza: string | null;
  note_famiglia: string | null;
  consenso_foto_video: boolean | null;
  partecipa_gare: boolean | null;
  intende_test_livello: boolean | null;
  created_at: string;
}

/** Numeri della campagna per la stagione indicata. */
export function use_stato_campagna(stagione_id?: string | null) {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["stato_campagna_iscrizioni", club_id, stagione_id],
    enabled: !!club_id && !!stagione_id,
    staleTime: 0,
    queryFn: async (): Promise<StatoCampagna> => {
      const { data, error } = await supabase.rpc("stato_campagna_iscrizioni" as any, {
        p_club: club_id,
        p_stagione: stagione_id,
      });
      if (error) throw error;
      const riga = (Array.isArray(data) ? data[0] : data) as any;
      return {
        invitati: Number(riga?.invitati ?? 0),
        confermati: Number(riga?.confermati ?? 0),
        non_rinnovati: Number(riga?.non_rinnovati ?? 0),
        domande_in_attesa: Number(riga?.domande_in_attesa ?? 0),
        scadenza: riga?.scadenza ?? null,
        aperta: !!riga?.aperta,
      };
    },
  });
}

/** Registro di stagione: chi è invitato, confermato, non rinnovato. */
export function use_registro_stagione(stagione_id?: string | null) {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["registro_stagione", club_id, stagione_id],
    enabled: !!club_id && !!stagione_id,
    staleTime: 0,
    queryFn: async (): Promise<RigaRegistro[]> => {
      // Niente join: fra atleti_storici_stagioni e atleti non esiste una chiave
      // esterna dichiarata, quindi le anagrafiche si leggono a parte.
      const { data, error } = await supabase
        .from("atleti_storici_stagioni")
        .select("atleta_id, status, confermato_il, confermato_da, note, livello")
        .eq("club_id", club_id)
        .eq("stagione_id", stagione_id);
      if (error) throw error;
      const righe = (data ?? []) as any[];
      const ids = [...new Set(righe.map((r) => r.atleta_id).filter(Boolean))];

      const anagrafiche = new Map<string, RigaRegistro["atleta"]>();
      for (let i = 0; i < ids.length; i += 200) {
        const blocco = ids.slice(i, i + 200);
        const { data: atleti, error: err_atleti } = await supabase
          .from("atleti")
          .select("id, nome, cognome, codice_atleta, categoria, livello_amatori, livello_artistica")
          .eq("club_id", club_id)
          .in("id", blocco);
        // Una lettura fallita non diventa una lista senza nomi: si ferma qui.
        if (err_atleti) throw err_atleti;
        ((atleti ?? []) as any[]).forEach((a) => anagrafiche.set(a.id, a as any));
      }

      return righe.map((r) => ({
        atleta_id: r.atleta_id,
        status: r.status,
        confermato_il: r.confermato_il ?? null,
        confermato_da: r.confermato_da ?? null,
        note: r.note ?? null,
        livello: r.livello ?? null,
        atleta: anagrafiche.get(r.atleta_id) ?? null,
      }));
    },

  });
}

/** Domande delle famiglie nuove ancora da esaminare. */
export function use_domande_iscrizione(stato = "in_attesa") {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["domande_iscrizione", club_id, stato],
    enabled: !!club_id,
    staleTime: 0,
    queryFn: async (): Promise<Domanda[]> => {
      const { data, error } = await supabase
        .from("domande_iscrizione")
        .select("*")
        .eq("club_id", club_id)
        .eq("stato", stato)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as Domanda[];
    },
  });
}

function use_invalida() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["stato_campagna_iscrizioni"] });
    qc.invalidateQueries({ queryKey: ["registro_stagione"] });
    qc.invalidateQueries({ queryKey: ["domande_iscrizione"] });
    qc.invalidateQueries({ queryKey: ["iscrizioni_in_attesa_totale"] });
    qc.invalidateQueries({ queryKey: ["atleti"] });
  };
}

/**
 * Quanti atleti verrebbero invitati aprendo la campagna: stessa selezione della
 * funzione apri_campagna_iscrizioni (attivi, non esterni, non anonimizzati, non
 * già presenti nel registro della stagione). Serve a mostrare il numero vero
 * PRIMA di eseguire: se la lettura fallisce non si mostra nessun numero.
 */
export function use_anteprima_apertura(stagione_id?: string | null) {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["anteprima_apertura_campagna", club_id, stagione_id],
    enabled: !!club_id && !!stagione_id,
    staleTime: 0,
    queryFn: async (): Promise<{ da_invitare: number; gia_presenti: number }> => {
      const { data: atleti, error } = await supabase
        .from("atleti")
        .select("id, attivo, atleta_esterno, anonimizzato_il")
        .eq("club_id", club_id);
      if (error) throw error;

      const { data: registro, error: err_registro } = await supabase
        .from("atleti_storici_stagioni")
        .select("atleta_id")
        .eq("club_id", club_id)
        .eq("stagione_id", stagione_id);
      if (err_registro) throw err_registro;

      const presenti = new Set(((registro ?? []) as any[]).map((r) => r.atleta_id));
      const idonei = ((atleti ?? []) as any[]).filter(
        (a) => (a.attivo ?? true) && !a.atleta_esterno && !a.anonimizzato_il,
      );
      return {
        da_invitare: idonei.filter((a) => !presenti.has(a.id)).length,
        gia_presenti: presenti.size,
      };
    },
  });
}

/** Nuovo link pubblico del club: quello di prima smette di funzionare. */
export function use_rigenera_token_iscrizioni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("club_mancante");
      const token = crypto.randomUUID().replace(/-/g, "");
      const { error } = await supabase.from("clubs").update({ iscrizioni_token: token }).eq("id", club_id);
      if (error) throw error;
      return token;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["club"] });
    },
  });
}

export function use_apri_campagna() {
  const invalida = use_invalida();
  return useMutation({
    mutationFn: async (p: { stagione_id: string; scadenza: string | null }) => {
      const { data, error } = await supabase.rpc("apri_campagna_iscrizioni" as any, {
        p_club: get_current_club_id(),
        p_stagione: p.stagione_id,
        p_scadenza: p.scadenza,
      });
      if (error) throw error;
      const riga = (Array.isArray(data) ? data[0] : data) as any;
      return {
        invitati: Number(riga?.invitati ?? 0),
        gia_presenti: Number(riga?.gia_presenti ?? 0),
      };
    },
    onSuccess: invalida,
  });
}

export function use_chiudi_campagna() {
  const invalida = use_invalida();
  return useMutation({
    mutationFn: async (p: { stagione_id: string }) => {
      const { data, error } = await supabase.rpc("chiudi_campagna_iscrizioni" as any, {
        p_club: get_current_club_id(),
        p_stagione: p.stagione_id,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: invalida,
  });
}

export function use_conferma_rinnovo_segreteria() {
  const invalida = use_invalida();
  return useMutation({
    mutationFn: async (p: { atleta_id: string; stagione_id: string }) => {
      const { error } = await supabase.rpc("conferma_rinnovo" as any, {
        p_atleta: p.atleta_id,
        p_stagione: p.stagione_id,
        p_da: "segreteria",
      });
      if (error) throw error;
    },
    onSuccess: invalida,
  });
}

export function use_rifiuta_rinnovo_segreteria() {
  const invalida = use_invalida();
  return useMutation({
    mutationFn: async (p: { atleta_id: string; stagione_id: string; motivo: string }) => {
      const { error } = await supabase.rpc("rifiuta_rinnovo" as any, {
        p_atleta: p.atleta_id,
        p_stagione: p.stagione_id,
        p_motivo: p.motivo,
        p_da: "segreteria",
      });
      if (error) throw error;
    },
    onSuccess: invalida,
  });
}

export function use_approva_domanda() {
  const invalida = use_invalida();
  return useMutation({
    mutationFn: async (p: {
      domanda_id: string;
      livello: string;
      categoria: string | null;
      note: string | null;
      email_famiglia?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("approva_domanda_iscrizione" as any, {
        p_domanda: p.domanda_id,
        p_livello: p.livello,
        p_categoria: p.categoria,
        p_note: p.note,
      });
      if (error) throw error;
      const riga = (Array.isArray(data) ? data[0] : data) as any;
      if (!riga?.atleta_id) throw new Error("approvazione_senza_atleta");
      const atleta_id = String(riga.atleta_id);
      // La mail di conferma parte da sola, subito dopo l'approvazione: non
      // dipende da un bottone. L'esito (anche il fallimento) resta scritto nel
      // registro comunicazioni dalla funzione di invio. Un invio fallito NON
      // annulla l'approvazione: si riporta a chi ha approvato.
      const benvenuto = await invia_benvenuto({
        atleta_id,
        livello: p.livello,
        email_famiglia: p.email_famiglia ?? "",
      });
      return { atleta_id, codice_atleta: String(riga.codice_atleta ?? ""), benvenuto };
    },
    onSettled: invalida,
  });
}

export type EsitoBenvenuto =
  | { stato: "inviata" }
  | { stato: "senza_email" }
  | { stato: "provider_non_configurato" }
  | { stato: "fallita"; motivo: string };

/** Invia la mail di benvenuto e traduce la risposta in un esito leggibile. Non lancia. */
export async function invia_benvenuto(p: {
  atleta_id: string;
  livello: string;
  email_famiglia: string;
}): Promise<EsitoBenvenuto> {
  try {
    const { data, error } = await supabase.functions.invoke("invia-email-iscrizioni", {
      body: { tipo: "benvenuto", ...p },
    });
    const d = (data ?? {}) as any;
    if (error) {
      // Le risposte non-2xx arrivano come errore: se ne legge il corpo per il motivo.
      let corpo: any = null;
      try { corpo = await (error as any)?.context?.json?.(); } catch { corpo = null; }
      if (corpo?.error === "provider_email_non_configurato") return { stato: "provider_non_configurato" };
      return { stato: "fallita", motivo: String(corpo?.error ?? (error as any)?.message ?? "errore") };
    }
    if (d.error === "provider_email_non_configurato") return { stato: "provider_non_configurato" };
    if (d.error) return { stato: "fallita", motivo: String(d.error) };
    if (Number(d.senza_email ?? 0) > 0) return { stato: "senza_email" };
    if (Number(d.inviati ?? 0) > 0) return { stato: "inviata" };
    return { stato: "fallita", motivo: "nessun_invio" };
  } catch (e) {
    return { stato: "fallita", motivo: (e as Error)?.message ?? "errore" };
  }
}

export interface DomandaApprovata {
  id: string;
  nome: string;
  cognome: string;
  genitore1_email: string | null;
  livello_assegnato: string | null;
  atleta_id: string | null;
  gestita_il: string | null;
  /** Ultimo esito della mail di benvenuto; null = nessun tentativo registrato. */
  benvenuto: { stato: string; quando: string; motivo: string | null } | null;
}

/**
 * Domande approvate negli ultimi 30 giorni con l'esito della mail di benvenuto,
 * letto dal registro comunicazioni: una famiglia avvisata e una mai avvisata
 * non si confondono.
 */
export function use_domande_approvate_recenti() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["domande_iscrizione", club_id, "approvate_recenti"],
    enabled: !!club_id,
    staleTime: 0,
    queryFn: async (): Promise<DomandaApprovata[]> => {
      const da = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("domande_iscrizione")
        .select("id, nome, cognome, genitore1_email, livello_assegnato, atleta_id, gestita_il")
        .eq("club_id", club_id)
        .eq("stato", "approvata")
        .gte("gestita_il", da)
        .order("gestita_il", { ascending: false });
      if (error) throw error;
      const righe = (data ?? []) as any[];
      const ids = righe.map((r) => r.atleta_id).filter(Boolean) as string[];
      const esiti = new Map<string, { stato: string; quando: string; motivo: string | null }>();
      if (ids.length > 0) {
        const { data: com, error: c_err } = await supabase
          .from("comunicazioni")
          .select("atleta_id, stato, sotto_tipo, created_at")
          .eq("club_id", club_id)
          .eq("tipo", "benvenuto_iscrizione")
          .in("atleta_id", ids)
          .order("created_at", { ascending: false });
        if (c_err) throw c_err;
        for (const c of (com ?? []) as any[]) {
          if (!esiti.has(c.atleta_id)) {
            esiti.set(c.atleta_id, { stato: c.stato, quando: c.created_at, motivo: c.sotto_tipo ?? null });
          }
        }
      }
      return righe.map((r) => ({ ...r, benvenuto: r.atleta_id ? esiti.get(r.atleta_id) ?? null : null }));
    },
  });
}

export function use_rifiuta_domanda() {
  const invalida = use_invalida();
  return useMutation({
    mutationFn: async (p: { domanda_id: string; note: string | null }) => {
      const { error } = await supabase.rpc("rifiuta_domanda_iscrizione" as any, {
        p_domanda: p.domanda_id,
        p_note: p.note,
      });
      if (error) throw error;
    },
    onSuccess: invalida,
  });
}

export interface EsitoInvio {
  inviati: number;
  senza_email: number;
  senza_codice?: number;
  /** Messaggi spediti ma non finiti nel registro comunicazioni. */
  non_registrati?: number;
  falliti?: { atleta: string; motivo: string }[];
}

export function use_invia_email_iscrizioni() {
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>): Promise<EsitoInvio> => {
      const { data, error } = await supabase.functions.invoke("invia-email-iscrizioni", {
        body: payload,
      });
      if (error) throw error;
      const d = (data ?? {}) as any;
      if (d.error) throw new Error(d.messaggio ?? d.error);
      return {
        inviati: Number(d.inviati ?? 0),
        senza_email: Number(d.senza_email ?? 0),
        senza_codice: Number(d.senza_codice ?? 0),
        non_registrati: Number(d.non_registrati ?? 0),
        falliti: (d.falliti ?? []) as { atleta: string; motivo: string }[],
      };
    },
  });
}
