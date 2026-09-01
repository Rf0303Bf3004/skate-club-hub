import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

export type EventoCampoInterClub = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  nome: string;
  modalita: string;
  data_inizio: string | null;
  data_fine: string | null;
  luogo: string | null;
  descrizione: string | null;
  costo: number | null;
  contatti: string | null;
  note: string | null;
  stato: string;
  scadenza_adesioni: string | null;
  quota_atleta: number | null;
  quota_club_default: number | null;
};

export type CampoGruppo = {
  id: string;
  evento_campo_id: string;
  nome: string;
  criterio: string | null;
  ordine: number;
  capienza_max: number | null;
};

export type CampoClubPartecipante = {
  id: string;
  evento_campo_id: string;
  club_id: string | null;
  club_esterno_nome: string | null;
  stato: string;
  quota_club: number | null;
  stato_pagamento: string;
  valido_dal: string;
  valido_al: string;
  invitato_da: string | null;
  invitato_at: string;
  accettato_at: string | null;
  token?: string | null;
  fatt_ragione_sociale?: string | null;
  fatt_indirizzo?: string | null;
  fatt_cap?: string | null;
  fatt_citta?: string | null;
  fatt_paese_iso?: string | null;
  fatt_email?: string | null;
  fatt_referente?: string | null;
  clubs?: { nome: string | null } | null;
};


export const STATI_CAMPO = ["bozza", "aperto", "chiuso", "concluso"] as const;

// ── Campi ospitati dal mio club (dichiarati inter-club) ──────
export type EventoCampoOspitato = EventoCampoInterClub & {
  multi_club?: boolean | null;
  n_invitati: number;
  n_accettati: number;
};

export function use_campi_ospitati() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["campi_interclub_ospitati", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventi_campi" as any)
        .select("*")
        .eq("club_id", club_id)
        .eq("multi_club", true)
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      const eventi = (data ?? []) as unknown as EventoCampoOspitato[];
      if (eventi.length === 0) return eventi;
      const { data: part, error: err_part } = await supabase
        .from("campi_club_partecipanti" as any)
        .select("evento_campo_id, stato")
        .in(
          "evento_campo_id",
          eventi.map((e) => e.id),
        );
      if (err_part) throw err_part;
      const righe = (part ?? []) as any[];
      return eventi.map((e) => {
        const suoi = righe.filter((p) => p.evento_campo_id === e.id);
        return {
          ...e,
          n_invitati: suoi.length,
          n_accettati: suoi.filter((p) => p.stato === "accettato").length,
        };
      });
    },
  });
}



// ── Campi a cui il mio club è invitato ───────────────────────
export type CampoInvitato = {
  partecipazione: CampoClubPartecipante;
  evento: EventoCampoInterClub | null;
};

export function use_campi_invitati() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["campi_interclub_invitati", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campi_club_partecipanti" as any)
        .select("*, evento:evento_campo_id(*)")
        .eq("club_id", club_id);
      if (error) throw error;
      const righe = (data ?? []) as any[];
      return righe
        .filter((r) => !r.evento || r.evento.club_id !== club_id)
        .map((r) => ({
          partecipazione: r as CampoClubPartecipante,
          evento: (r.evento ?? null) as EventoCampoInterClub | null,
        })) as CampoInvitato[];
    },
  });
}

export function use_rispondi_invito_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accetta }: { id: string; accetta: boolean }) => {
      const { error } = await supabase
        .from("campi_club_partecipanti" as any)
        .update({
          stato: accetta ? "accettato" : "rifiutato",
          accettato_at: accetta ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campi_interclub_invitati"] });
      qc.invalidateQueries({ queryKey: ["campi_partecipanti"] });
    },
  });
}

// ── Informazioni campo ───────────────────────────────────────
export function use_aggiorna_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("eventi_campi" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campi_interclub_ospitati"] });
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
    },
  });
}

// ── Gruppi ───────────────────────────────────────────────────
export function use_campo_gruppi(evento_campo_id: string | null) {
  return useQuery({
    queryKey: ["campi_gruppi", evento_campo_id],
    enabled: !!evento_campo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campi_gruppi" as any)
        .select("*")
        .eq("evento_campo_id", evento_campo_id)
        .order("ordine", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CampoGruppo[];
    },
  });
}

export function use_salva_gruppo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gruppo: Partial<CampoGruppo> & { evento_campo_id: string }) => {
      if (gruppo.id) {
        const { id, ...patch } = gruppo;
        const { error } = await supabase.from("campi_gruppi" as any).update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campi_gruppi" as any).insert(gruppo);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campi_gruppi", v.evento_campo_id] }),
  });
}

export function use_elimina_gruppo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; evento_campo_id: string }) => {
      const { error } = await supabase.from("campi_gruppi" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campi_gruppi", v.evento_campo_id] }),
  });
}

export function use_riordina_gruppi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gruppi }: { gruppi: CampoGruppo[]; evento_campo_id: string }) => {
      for (let i = 0; i < gruppi.length; i++) {
        const { error } = await supabase
          .from("campi_gruppi" as any)
          .update({ ordine: i + 1 })
          .eq("id", gruppi[i].id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campi_gruppi", v.evento_campo_id] }),
  });
}

// ── Club partecipanti ────────────────────────────────────────
export function use_campo_partecipanti(evento_campo_id: string | null) {
  return useQuery({
    queryKey: ["campi_partecipanti", evento_campo_id],
    enabled: !!evento_campo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campi_club_partecipanti" as any)
        .select("*, clubs:club_id(nome)")
        .eq("evento_campo_id", evento_campo_id)
        .order("invitato_at", { ascending: true });
      if (error) throw error;
      const righe = (data ?? []) as unknown as CampoClubPartecipante[];
      // Le policy su `clubs` nascondono gli altri club: il nome si recupera da `elenco_club`.
      const mancanti = righe.filter((r) => r.club_id && !r.clubs?.nome).map((r) => r.club_id as string);
      if (mancanti.length > 0) {
        const { data: elenco } = await supabase
          .from("elenco_club" as any)
          .select("id, nome")
          .in("id", mancanti);
        const per_id = new Map(((elenco ?? []) as any[]).map((c) => [c.id, c.nome as string | null]));
        return righe.map((r) =>
          r.club_id && !r.clubs?.nome && per_id.has(r.club_id)
            ? { ...r, clubs: { nome: per_id.get(r.club_id) ?? null } }
            : r,
        );
      }
      return righe;
    },
  });
}

export function use_clubs_opzioni() {
  return useQuery({
    queryKey: ["elenco_club_opzioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elenco_club" as any)
        .select("id, nome, citta")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string; citta: string | null }[];
    },
  });
}

export function use_invita_club() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      evento_campo_id: string;
      club_id: string | null;
      club_esterno_nome: string | null;
      quota_club: number | null;
      valido_dal: string;
      valido_al: string;
    }) => {
      const { error } = await supabase
        .from("campi_club_partecipanti" as any)
        .insert({ ...payload, stato: "invitato" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campi_partecipanti", v.evento_campo_id] }),
  });
}

export function use_aggiorna_partecipante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown>; evento_campo_id: string }) => {
      const { error } = await supabase.from("campi_club_partecipanti" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campi_partecipanti", v.evento_campo_id] }),
  });
}

export function use_elimina_partecipante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; evento_campo_id: string }) => {
      const { error } = await supabase.from("campi_club_partecipanti" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campi_partecipanti", v.evento_campo_id] }),
  });
}

// ── Iscrizioni atleti al campo ───────────────────────────────
export type IscrizioneCampo = {
  id: string;
  evento_campo_id: string;
  atleta_id: string;
  club_id: string | null;
  campo_gruppo_id: string | null;
  stato: string | null;
  atleta?: {
    nome: string | null;
    cognome: string | null;
    club_id: string | null;
    club_provenienza: string | null;
    ospite_di_campo_id: string | null;
    data_nascita?: string | null;
    livello_dichiarato?: string | null;
    livello_attuale?: string | null;
    carriera_artistica?: string | null;
    carriera_stile?: string | null;
  } | null;
};

// Lettura separata degli atleti (esplicita e verificata): gli atleti vengono
// letti a parte e uniti lato client alle iscrizioni.
async function carica_atleti_iscritti(atleta_ids: string[]) {
  if (atleta_ids.length === 0) return new Map<string, IscrizioneCampo["atleta"]>();
  const { data, error } = await supabase
    .from("atleti" as any)
    .select(
      "id, nome, cognome, club_id, club_provenienza, ospite_di_campo_id, data_nascita, livello_dichiarato, livello_attuale, carriera_artistica, carriera_stile",
    )
    .in("id", atleta_ids);
  if (error) throw error;
  return new Map(((data ?? []) as any[]).map((a) => [a.id as string, a as IscrizioneCampo["atleta"]]));
}

export function use_campo_iscrizioni(evento_campo_id: string | null) {
  return useQuery({
    queryKey: ["campi_iscrizioni", evento_campo_id],
    enabled: !!evento_campo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iscrizioni_eventi_campi" as any)
        .select("id, evento_campo_id, atleta_id, club_id, campo_gruppo_id, stato")
        .eq("evento_campo_id", evento_campo_id);
      if (error) throw error;
      const righe = (data ?? []) as unknown as IscrizioneCampo[];
      const per_id = await carica_atleti_iscritti(righe.map((r) => r.atleta_id));
      return righe.map((r) => ({ ...r, atleta: per_id.get(r.atleta_id) ?? null }));
    },
  });
}

export function use_toggle_iscrizione_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      evento_campo_id: string;
      atleta_id: string;
      iscritto: boolean;
      campo_gruppo_id?: string | null;
    }) => {
      if (v.iscritto) {
        const { error } = await supabase
          .from("iscrizioni_eventi_campi" as any)
          .delete()
          .eq("evento_campo_id", v.evento_campo_id)
          .eq("atleta_id", v.atleta_id);
        if (error) throw error;
      } else {
        // club_id è ricavato dal trigger lato database: non va inviato dal client
        const { error } = await supabase.from("iscrizioni_eventi_campi" as any).insert({
          evento_campo_id: v.evento_campo_id,
          atleta_id: v.atleta_id,
          campo_gruppo_id: v.campo_gruppo_id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["campi_iscrizioni", v.evento_campo_id] });
      qc.invalidateQueries({ queryKey: ["campi_adesioni", v.evento_campo_id] });
    },
  });
}

export function use_aggiorna_gruppo_iscrizione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; campo_gruppo_id: string | null; evento_campo_id: string }) => {
      const { error } = await supabase
        .from("iscrizioni_eventi_campi" as any)
        .update({ campo_gruppo_id: v.campo_gruppo_id })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["campi_iscrizioni", v.evento_campo_id] });
      qc.invalidateQueries({ queryKey: ["campi_adesioni", v.evento_campo_id] });
    },
  });
}

// ── Adesioni: matrice gruppo × club ──────────────────────────
export type AdesioneRiga = {
  atleta_id: string;
  club_id: string | null;
  campo_gruppo_id: string | null;
  atleta?: { club_provenienza: string | null; ospite_di_campo_id: string | null } | null;
};

export function use_campo_adesioni(evento_campo_id: string | null) {
  return useQuery({
    queryKey: ["campi_adesioni", evento_campo_id],
    enabled: !!evento_campo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iscrizioni_eventi_campi" as any)
        .select("atleta_id, club_id, campo_gruppo_id")
        .eq("evento_campo_id", evento_campo_id);
      if (error) throw error;
      const righe = (data ?? []) as unknown as AdesioneRiga[];
      const per_id = await carica_atleti_iscritti(righe.map((r) => r.atleta_id));
      return righe.map((r) => ({ ...r, atleta: per_id.get(r.atleta_id) ?? null }));
    },
  });
}


// ── Atleti ospiti (club che non usano il portale) ─────────────
export type AtletaOspite = {
  id: string;
  nome: string | null;
  cognome: string | null;
  data_nascita: string | null;
  codice_atleta: string | null;
  club_provenienza: string | null;
  livello_dichiarato: string | null;
  ospite_dal: string | null;
  ospite_scade_il: string | null;
};

export function use_atleti_ospiti_campo(evento_campo_id: string | null) {
  return useQuery({
    queryKey: ["atleti_ospiti_campo", evento_campo_id],
    enabled: !!evento_campo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti" as any)
        .select("id, nome, cognome, data_nascita, codice_atleta, club_provenienza, livello_dichiarato, ospite_dal, ospite_scade_il")
        .eq("ospite_di_campo_id", evento_campo_id)
        .order("cognome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AtletaOspite[];
    },
  });
}

export type EsitoImportOspite = {
  riga: number;
  nome: string | null;
  cognome: string | null;
  codice_atleta: string | null;
  esito: string;
};

export type RigaOspiteInput = {
  nome: string;
  cognome: string;
  data_nascita: string | null;
  livello: string | null;
  dal: string | null;
  al: string | null;
  email: string | null;
  telefono: string | null;
  emergenza: string | null;
  note: string | null;
  consenso_foto: boolean | null;
  consenso_ricontatto: boolean | null;
};

export function use_registra_atleti_ospiti() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      evento_campo_id: string;
      club_provenienza: string;
      elenco: RigaOspiteInput[];
      campo_gruppo_id?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("registra_atleti_ospiti_massa" as any, {
        p_campo: v.evento_campo_id,
        p_club_provenienza: v.club_provenienza,
        p_elenco: v.elenco as any,
        p_gruppo: v.campo_gruppo_id ?? null,
      });
      if (error) throw error;
      return (data ?? []) as unknown as EsitoImportOspite[];
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["atleti_ospiti_campo", v.evento_campo_id] });
      qc.invalidateQueries({ queryKey: ["campi_iscrizioni", v.evento_campo_id] });
      qc.invalidateQueries({ queryKey: ["campi_adesioni", v.evento_campo_id] });
      qc.invalidateQueries({ queryKey: ["atleti"] });
    },
  });
}

// ── Fatturazione dei club ospiti ─────────────────────────────
export type AnteprimaFatturaOspite = {
  riga_partecipazione: string;
  club_ospite: string | null;
  n_atleti: number;
  n_righe: number;
  totale: number;
  righe: { descrizione: string; atleta: string; importo: number }[] | null;
  gia_fatturata: boolean;
  avviso: string | null;
};

export function use_anteprima_fatture_ospiti(evento_campo_id: string | null) {
  return useQuery({
    queryKey: ["anteprima_fatture_ospiti", evento_campo_id],
    enabled: !!evento_campo_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("anteprima_fatture_club_ospiti" as any, {
        p_campo: evento_campo_id,
      });
      if (error) throw error;
      return (data ?? []) as unknown as AnteprimaFatturaOspite[];
    },
  });
}

export function use_genera_fattura_club_ospite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { riga_partecipazione: string; evento_campo_id: string }) => {
      const { data, error } = await supabase.rpc("genera_fattura_club_ospite" as any, {
        p_riga: v.riga_partecipazione,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["anteprima_fatture_ospiti", v.evento_campo_id] });
      qc.invalidateQueries({ queryKey: ["fatture"] });
    },
  });
}

export function use_genera_link_club_ospite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { riga_partecipazione: string; evento_campo_id: string }) => {
      const { data, error } = await supabase.rpc("genera_link_club_ospite" as any, {
        p_riga: v.riga_partecipazione,
      });
      if (error) throw error;
      return String(data ?? "");
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campi_partecipanti", v.evento_campo_id] }),
  });
}
