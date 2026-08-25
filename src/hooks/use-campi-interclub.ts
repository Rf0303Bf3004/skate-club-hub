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
  clubs?: { nome: string | null } | null;
};

export const STATI_CAMPO = ["bozza", "aperto", "chiuso", "concluso"] as const;

// ── Campi ospitati dal mio club ──────────────────────────────
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
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventoCampoInterClub[];
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
      return (data ?? []) as unknown as CampoClubPartecipante[];
    },
  });
}

export function use_clubs_opzioni() {
  return useQuery({
    queryKey: ["clubs_opzioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs" as any)
        .select("id, nome")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string }[];
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

// ── Adesioni: matrice gruppo × club ──────────────────────────
export type AdesioneRiga = { atleta_id: string; club_id: string | null; campo_gruppo_id: string | null };

export function use_campo_adesioni(evento_campo_id: string | null, gruppi_ids: string[]) {
  return useQuery({
    queryKey: ["campi_adesioni", evento_campo_id, gruppi_ids.join(",")],
    enabled: !!evento_campo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iscrizioni_eventi_campi" as any)
        .select("atleta_id, stato, atleta:atleta_id(club_id)")
        .eq("evento_campo_id", evento_campo_id);
      if (error) throw error;
      const iscrizioni = (data ?? []) as any[];

      let mappa_gruppi = new Map<string, string>();
      if (gruppi_ids.length > 0) {
        const { data: assegnazioni, error: err_gruppi } = await supabase
          .from("griglia_sessioni_atleti" as any)
          .select("atleta_id, campo_gruppo_id")
          .in("campo_gruppo_id", gruppi_ids);
        if (!err_gruppi) {
          mappa_gruppi = new Map(
            ((assegnazioni ?? []) as any[])
              .filter((a) => a.atleta_id && a.campo_gruppo_id)
              .map((a) => [a.atleta_id as string, a.campo_gruppo_id as string]),
          );
        }
      }

      return iscrizioni.map((i) => ({
        atleta_id: i.atleta_id as string,
        club_id: (i.atleta?.club_id ?? null) as string | null,
        campo_gruppo_id: mappa_gruppi.get(i.atleta_id as string) ?? null,
      })) as AdesioneRiga[];
    },
  });
}
