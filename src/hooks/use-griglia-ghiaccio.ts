import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// ─── Tipi ──────────────────────────────────────────────────
export interface GrigliaSpecialita {
  id: string;
  club_id: string;
  nome: string;
  ordine: number;
  attivo: boolean;
  descrizione_messaggio?: string | null;
}

export interface GrigliaSessioneAtleta {
  id: string;
  atleta_id: string;
  nome: string;
  cognome: string;
}

export interface GrigliaSessioneIstruttore {
  id: string;
  istruttore_id: string;
  nome: string;
  cognome: string;
}

export interface GrigliaSessione {
  id: string;
  blocco_id: string;
  ordine: number;
  ora_inizio: string;
  ora_fine: string;
  specialita_id: string | null;
  specialita_testo_libero: string | null;
  specialita_nome: string | null;
  specialita_descrizione: string | null;
  pista: string | null;
  messaggio_atleti: string | null;
  note: string | null;
  atleti: GrigliaSessioneAtleta[];
  istruttori: GrigliaSessioneIstruttore[];
}

export interface GrigliaBlocco {
  id: string;
  club_id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  titolo: string | null;
  stato: "bozza" | "pubblicato";
  creato_da: string | null;
  pubblicato_at: string | null;
  sessioni: GrigliaSessione[];
}

// ─── Specialità ────────────────────────────────────────────
export function use_griglia_specialita() {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id(),
    queryKey: ["griglia_specialita", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("griglia_specialita" as any)
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("ordine");
      if (error) throw error;
      return ((data ?? []) as any[]) as GrigliaSpecialita[];
    },
  });
}

// ─── Blocchi del giorno (idratati) ─────────────────────────
export function use_griglia_blocchi_giorno(data_giorno: string) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id() && !!data_giorno,
    queryKey: ["griglia_blocchi_giorno", get_current_club_id(), data_giorno],
    queryFn: async () => {
      const club_id = get_current_club_id();
      const { data: blocchi, error: err_blocchi } = await supabase
        .from("griglia_blocchi" as any)
        .select("*")
        .eq("club_id", club_id)
        .eq("data", data_giorno)
        .order("ora_inizio");
      if (err_blocchi) throw err_blocchi;
      const lista_blocchi = (blocchi ?? []) as any[];
      if (lista_blocchi.length === 0) return [] as GrigliaBlocco[];

      const blocchi_ids = lista_blocchi.map((b: any) => b.id);
      const { data: sessioni, error: err_sess } = await supabase
        .from("griglia_sessioni" as any)
        .select("*")
        .in("blocco_id", blocchi_ids)
        .order("ordine");
      if (err_sess) throw err_sess;
      const lista_sessioni = (sessioni ?? []) as any[];
      const sessioni_ids = lista_sessioni.map((s: any) => s.id);

      const [spec_res, sa_res, si_res, atleti_res, ist_res] = await Promise.all([
        supabase.from("griglia_specialita" as any).select("id,nome,descrizione_messaggio").eq("club_id", club_id),
        sessioni_ids.length
          ? supabase.from("griglia_sessioni_atleti" as any).select("*").in("sessione_id", sessioni_ids)
          : Promise.resolve({ data: [], error: null } as any),
        sessioni_ids.length
          ? supabase.from("griglia_sessioni_istruttori" as any).select("*").in("sessione_id", sessioni_ids)
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("atleti").select("id,nome,cognome").eq("club_id", club_id),
        supabase.from("istruttori").select("id,nome,cognome").eq("club_id", club_id),
      ]);

      const spec_map = new Map<string, any>();
      ((spec_res.data ?? []) as any[]).forEach((s: any) => spec_map.set(s.id, s));
      const atleti_map = new Map<string, any>();
      ((atleti_res.data ?? []) as any[]).forEach((a: any) => atleti_map.set(a.id, a));
      const ist_map = new Map<string, any>();
      ((ist_res.data ?? []) as any[]).forEach((i: any) => ist_map.set(i.id, i));
      const sa = (sa_res.data ?? []) as any[];
      const si = (si_res.data ?? []) as any[];

      return lista_blocchi.map((b: any) => ({
        ...b,
        sessioni: lista_sessioni
          .filter((s: any) => s.blocco_id === b.id)
          .map((s: any) => ({
            ...s,
            specialita_nome: s.specialita_id ? spec_map.get(s.specialita_id)?.nome ?? null : null,
            specialita_descrizione: s.specialita_id
              ? spec_map.get(s.specialita_id)?.descrizione_messaggio ?? null
              : null,
            atleti: sa
              .filter((x: any) => x.sessione_id === s.id)
              .map((x: any) => ({
                id: x.id,
                atleta_id: x.atleta_id,
                nome: atleti_map.get(x.atleta_id)?.nome ?? "",
                cognome: atleti_map.get(x.atleta_id)?.cognome ?? x.atleta_id.slice(0, 8),
              })),
            istruttori: si
              .filter((x: any) => x.sessione_id === s.id)
              .map((x: any) => ({
                id: x.id,
                istruttore_id: x.istruttore_id,
                nome: ist_map.get(x.istruttore_id)?.nome ?? "",
                cognome: ist_map.get(x.istruttore_id)?.cognome ?? x.istruttore_id.slice(0, 8),
              })),
          })),
      })) as GrigliaBlocco[];
    },
  });
}

// ─── Helper invalidazione ──────────────────────────────────
function use_invalidate_griglia() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["griglia_blocchi_giorno"] });
    qc.invalidateQueries({ queryKey: ["griglia_specialita"] });
  };
}

// ─── Mutation blocchi ──────────────────────────────────────
export function use_upsert_blocco() {
  const invalidate = use_invalidate_griglia();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      data: string;
      ora_inizio: string;
      ora_fine: string;
      titolo?: string | null;
    }) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");
      if (input.id) {
        const { error } = await supabase
          .from("griglia_blocchi" as any)
          .update({
            data: input.data,
            ora_inizio: input.ora_inizio,
            ora_fine: input.ora_fine,
            titolo: input.titolo ?? null,
          } as any)
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("griglia_blocchi" as any)
        .insert({
          club_id,
          data: input.data,
          ora_inizio: input.ora_inizio,
          ora_fine: input.ora_fine,
          titolo: input.titolo ?? null,
          stato: "bozza",
          creato_da: session?.user_id ?? null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any)?.id as string;
    },
    onSuccess: invalidate,
  });
}

export function use_pubblica_blocco() {
  const invalidate = use_invalidate_griglia();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blocco: string | GrigliaBlocco) => {
      const blocco_id = typeof blocco === "string" ? blocco : blocco.id;
      const club_id = get_current_club_id();
      const { error } = await supabase
        .from("griglia_blocchi" as any)
        .update({ stato: "pubblicato", pubblicato_at: new Date().toISOString() } as any)
        .eq("id", blocco_id);
      if (error) throw error;

      // Invio convocazioni: una comunicazione per atleta e per sessione con messaggio.
      let inviate = 0;
      const sessioni = typeof blocco === "string" ? [] : blocco.sessioni ?? [];
      if (!club_id || sessioni.length === 0) return { blocco_id, inviate };

      const adesso = new Date().toISOString();
      const data_evento = typeof blocco === "string" ? null : blocco.data ?? null;

      for (const s of sessioni) {
        const testo = (s.messaggio_atleti ?? "").trim();
        if (!testo || (s.atleti ?? []).length === 0) continue;
        for (const a of s.atleti) {
          const payload: any = {
            club_id,
            titolo: "Convocazione allenamento",
            testo,
            corpo: testo,
            tipo: "convocazione",
            tipo_destinatari: "atleti",
            atleti_ids: [a.atleta_id],
            atleta_id: a.atleta_id,
            data_evento,
            stato: "inviata",
            inviata_at: adesso,
          };
          const { error: err_com } = await supabase.from("comunicazioni").insert(payload);
          if (err_com) throw err_com;
          inviate += 1;
        }
      }
      return { blocco_id, inviate };
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
    },
  });
}

export function use_elimina_blocco() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (blocco_id: string) => {
      const { error } = await supabase.from("griglia_blocchi" as any).delete().eq("id", blocco_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ─── Mutation sessioni ─────────────────────────────────────
export function use_upsert_sessione() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      blocco_id: string;
      ordine: number;
      ora_inizio: string;
      ora_fine: string;
      specialita_id?: string | null;
      specialita_testo_libero?: string | null;
      note?: string | null;
      pista?: string | null;
      messaggio_atleti?: string | null;
    }) => {
      // XOR: mai entrambi valorizzati
      const usa_testo = !!input.specialita_testo_libero && !input.specialita_id;
      const payload = {
        blocco_id: input.blocco_id,
        ordine: input.ordine,
        ora_inizio: input.ora_inizio,
        ora_fine: input.ora_fine,
        specialita_id: usa_testo ? null : input.specialita_id ?? null,
        specialita_testo_libero: usa_testo ? input.specialita_testo_libero : null,
        note: input.note ?? null,
        pista: input.pista ?? null,
        messaggio_atleti: input.messaggio_atleti ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from("griglia_sessioni" as any).update(payload as any).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("griglia_sessioni" as any)
        .insert(payload as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any)?.id as string;
    },
    onSuccess: invalidate,
  });
}

export function use_elimina_sessione() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (sessione_id: string) => {
      const { error } = await supabase.from("griglia_sessioni" as any).delete().eq("id", sessione_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ─── Assegnazioni ──────────────────────────────────────────
export function use_assegna_atleta_sessione() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (input: { sessione_id: string; atleta_id: string }) => {
      const { error } = await supabase
        .from("griglia_sessioni_atleti" as any)
        .insert({ sessione_id: input.sessione_id, atleta_id: input.atleta_id } as any);
      if (error && !`${error.message}`.includes("duplicate")) throw error;
    },
    onSuccess: invalidate,
  });
}

export function use_rimuovi_atleta_sessione() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (input: { sessione_id: string; atleta_id: string }) => {
      const { error } = await supabase
        .from("griglia_sessioni_atleti" as any)
        .delete()
        .eq("sessione_id", input.sessione_id)
        .eq("atleta_id", input.atleta_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function use_assegna_istruttore_sessione() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (input: { sessione_id: string; istruttore_id: string }) => {
      const { error } = await supabase
        .from("griglia_sessioni_istruttori" as any)
        .insert({ sessione_id: input.sessione_id, istruttore_id: input.istruttore_id } as any);
      if (error && !`${error.message}`.includes("duplicate")) throw error;
    },
    onSuccess: invalidate,
  });
}

export function use_rimuovi_istruttore_sessione() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (input: { sessione_id: string; istruttore_id: string }) => {
      const { error } = await supabase
        .from("griglia_sessioni_istruttori" as any)
        .delete()
        .eq("sessione_id", input.sessione_id)
        .eq("istruttore_id", input.istruttore_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ─── CRUD specialità ───────────────────────────────────────
export function use_upsert_specialita() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      nome: string;
      ordine: number;
      attivo?: boolean;
      descrizione_messaggio?: string | null;
    }) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");
      if (input.id) {
        const { error } = await supabase
          .from("griglia_specialita" as any)
          .update({
            nome: input.nome,
            ordine: input.ordine,
            attivo: input.attivo ?? true,
            descrizione_messaggio: input.descrizione_messaggio ?? null,
          } as any)
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("griglia_specialita" as any)
        .insert({
          club_id,
          nome: input.nome,
          ordine: input.ordine,
          attivo: input.attivo ?? true,
          descrizione_messaggio: input.descrizione_messaggio ?? null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any)?.id as string;
    },
    onSuccess: invalidate,
  });
}

export function use_elimina_specialita() {
  const invalidate = use_invalidate_griglia();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("griglia_specialita" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
