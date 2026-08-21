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
  provenienza: string | null;
}

export interface GrigliaSessioneIstruttore {
  id: string;
  istruttore_id: string;
  nome: string;
  cognome: string;
  user_id?: string | null;
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
  fuori_disponibilita?: boolean | null;
  motivo_forzatura?: string | null;
  forzato_da?: string | null;
  forzato_at?: string | null;
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
  risorsa_id: string | null;
  fuori_disponibilita?: boolean | null;
  motivo_forzatura?: string | null;
  forzato_da?: string | null;
  forzato_at?: string | null;
  sessioni: GrigliaSessione[];
}

// ─── Disponibilità dichiarata per giorno + risorsa ─────────
export const GIORNI_IT_SETTIMANA = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

export function giorno_it_da_data(data_iso: string): string {
  return GIORNI_IT_SETTIMANA[new Date(`${data_iso}T00:00:00`).getDay()];
}

export interface FasciaDisponibilita {
  ora_inizio: string;
  ora_fine: string;
}

export function use_disponibilita_giorno(
  risorsa_id: string | null,
  giorno_settimana: string | null,
  tipo: "ghiaccio" | "pulizia" = "ghiaccio",
) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id() && !!risorsa_id && !!giorno_settimana,
    queryKey: ["disponibilita_giorno", get_current_club_id(), risorsa_id, giorno_settimana, tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilita_ghiaccio" as any)
        .select("ora_inizio,ora_fine")
        .eq("club_id", get_current_club_id())
        .eq("risorsa_id", risorsa_id as string)
        .eq("giorno", giorno_settimana as string)
        .eq("tipo", tipo)
        .order("ora_inizio");
      if (error) throw error;
      return ((data ?? []) as any[]) as FasciaDisponibilita[];
    },
  });
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
export async function fetch_blocchi_giorno(
  club_id: string,
  data_giorno: string,
  risorsa_id?: string | null,
): Promise<GrigliaBlocco[]> {
  let q = supabase
    .from("griglia_blocchi" as any)
    .select("*")
    .eq("club_id", club_id)
    .eq("data", data_giorno);
  if (risorsa_id) q = q.eq("risorsa_id", risorsa_id);
  const { data: blocchi, error: err_blocchi } = await q.order("ora_inizio");
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

  const [spec_res, sa_res, si_res, atleti_res, ist_res, rs_res] = await Promise.all([
    supabase.from("griglia_specialita" as any).select("id,nome,descrizione_messaggio").eq("club_id", club_id),
    sessioni_ids.length
      ? supabase.from("griglia_sessioni_atleti" as any).select("*").in("sessione_id", sessioni_ids)
      : Promise.resolve({ data: [], error: null } as any),
    sessioni_ids.length
      ? supabase.from("griglia_sessioni_istruttori" as any).select("*").in("sessione_id", sessioni_ids)
      : Promise.resolve({ data: [], error: null } as any),
    supabase.from("atleti").select("id,nome,cognome,ragione_sociale_id,atleta_esterno").eq("club_id", club_id),
    supabase.from("istruttori").select("id,nome,cognome,user_id").eq("club_id", club_id),
    supabase.from("ragioni_sociali" as any).select("id,nome").eq("club_id", club_id),
  ]);

  const spec_map = new Map<string, any>();
  ((spec_res.data ?? []) as any[]).forEach((s: any) => spec_map.set(s.id, s));
  const rs_map = new Map<string, string>();
  ((rs_res.data ?? []) as any[]).forEach((r: any) => rs_map.set(r.id, r.nome));
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
          .map((x: any) => {
            const at = atleti_map.get(x.atleta_id);
            const provenienza = at?.ragione_sociale_id
              ? rs_map.get(at.ragione_sociale_id) ?? null
              : at?.atleta_esterno
                ? "Esterno"
                : null;
            return {
              id: x.id,
              atleta_id: x.atleta_id,
              nome: at?.nome ?? "",
              cognome: at?.cognome ?? x.atleta_id.slice(0, 8),
              provenienza,
            };
          }),
        istruttori: si
          .filter((x: any) => x.sessione_id === s.id)
          .map((x: any) => ({
            id: x.id,
            istruttore_id: x.istruttore_id,
            nome: ist_map.get(x.istruttore_id)?.nome ?? "",
            cognome: ist_map.get(x.istruttore_id)?.cognome ?? x.istruttore_id.slice(0, 8),
            user_id: ist_map.get(x.istruttore_id)?.user_id ?? null,
          })),
      })),
  })) as GrigliaBlocco[];
}

export function use_griglia_blocchi_giorno(data_giorno: string, risorsa_id?: string | null) {
  return useQuery({
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!get_current_club_id() && !!data_giorno,
    queryKey: ["griglia_blocchi_giorno", get_current_club_id(), data_giorno, risorsa_id ?? null],
    queryFn: async () => fetch_blocchi_giorno(get_current_club_id() as string, data_giorno, risorsa_id),
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
      risorsa_id?: string | null;
      fuori_disponibilita?: boolean;
      motivo_forzatura?: string | null;
    }) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");
      const forzatura =
        input.fuori_disponibilita === undefined
          ? {}
          : {
              fuori_disponibilita: input.fuori_disponibilita,
              motivo_forzatura: input.fuori_disponibilita ? input.motivo_forzatura ?? null : null,
              forzato_da: input.fuori_disponibilita ? session?.user_id ?? null : null,
              forzato_at: input.fuori_disponibilita ? new Date().toISOString() : null,
            };
      if (input.id) {
        const patch: Record<string, any> = {
          data: input.data,
          ora_inizio: input.ora_inizio,
          ora_fine: input.ora_fine,
          titolo: input.titolo ?? null,
          ...forzatura,
        };
        if (input.risorsa_id !== undefined) patch.risorsa_id = input.risorsa_id;
        const { error } = await supabase
          .from("griglia_blocchi" as any)
          .update(patch as any)
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
          risorsa_id: input.risorsa_id ?? null,
          stato: "bozza",
          creato_da: session?.user_id ?? null,
          ...forzatura,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any)?.id as string;
    },
    onSuccess: invalidate,
  });
}

function hhmm_short(t?: string | null): string {
  return (t ?? "").slice(0, 5);
}

/** Riga testuale di una sessione, stesso contenuto del riepilogo stampabile. */
export function riga_sessione_istruttore(s: GrigliaSessione): string {
  const spec = s.specialita_nome || s.specialita_testo_libero || "Allenamento";
  const desc = s.specialita_descrizione ? ` (${s.specialita_descrizione})` : "";
  const pista = s.pista ? `${s.pista} ` : "";
  const atleti = (s.atleti ?? []).map((a) => `${a.nome} ${a.cognome}`.trim()).join(", ");
  return `${hhmm_short(s.ora_inizio)}–${hhmm_short(s.ora_fine)} ${pista}${spec}${desc} — Atleti: ${atleti || "—"}`;
}

export interface RiepilogoIstruttore {
  istruttore_id: string;
  nome: string;
  user_id: string | null;
  righe: string[];
}

/** Raggruppa tutte le sessioni per istruttore, ordinate per orario. */
export function riepilogo_istruttori_da_blocchi(blocchi: GrigliaBlocco[]): RiepilogoIstruttore[] {
  const map = new Map<string, { nome: string; user_id: string | null; righe: { ora: number; testo: string }[] }>();
  for (const b of blocchi) {
    for (const s of b.sessioni ?? []) {
      const testo = riga_sessione_istruttore(s);
      const ora = Number(hhmm_short(s.ora_inizio).replace(":", ""));
      for (const i of s.istruttori ?? []) {
        const nome = `${i.nome} ${i.cognome}`.trim() || i.istruttore_id.slice(0, 8);
        const cur = map.get(i.istruttore_id) ?? { nome, user_id: i.user_id ?? null, righe: [] };
        if (i.user_id) cur.user_id = i.user_id;
        cur.righe.push({ ora, testo });
        map.set(i.istruttore_id, cur);
      }
    }
  }
  return Array.from(map.entries())
    .map(([istruttore_id, v]) => ({
      istruttore_id,
      nome: v.nome,
      user_id: v.user_id,
      righe: v.righe.sort((a, b) => a.ora - b.ora).map((r) => r.testo),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
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
      let istruttori_avvisati = 0;
      let istruttori_senza_account = 0;
      const sessioni = typeof blocco === "string" ? [] : blocco.sessioni ?? [];
      const data_evento = typeof blocco === "string" ? null : blocco.data ?? null;
      if (!club_id) return { blocco_id, inviate, istruttori_avvisati, istruttori_senza_account };

      const adesso = new Date().toISOString();

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

      // ─── Convocazioni istruttori: una sola comunicazione al giorno per istruttore ───
      if (data_evento) {
        const blocchi_giorno = await fetch_blocchi_giorno(club_id, data_evento);
        const riepilogo = riepilogo_istruttori_da_blocchi(
          blocchi_giorno.filter((b) => b.stato === "pubblicato" || b.id === blocco_id),
        );

        // Sostituisci le convocazioni istruttore già create per questa data (niente duplicati).
        const { error: err_del } = await supabase
          .from("comunicazioni")
          .delete()
          .eq("club_id", club_id)
          .eq("sotto_tipo", "griglia_convocazione")
          .eq("data_evento", data_evento);
        if (err_del) throw err_del;

        const label_giorno = new Date(`${data_evento}T00:00:00`).toLocaleDateString("it-CH", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });

        for (const i of riepilogo) {
          if (!i.user_id) {
            istruttori_senza_account += 1;
            continue;
          }
          const testo = [`Le tue sessioni di ${label_giorno}:`, ...i.righe.map((r) => `• ${r}`)].join("\n");
          const { data: com, error: err_com } = await supabase
            .from("comunicazioni")
            .insert({
              club_id,
              titolo: `Convocazione ghiaccio — ${label_giorno}`,
              testo,
              corpo: testo,
              tipo: "convocazione",
              sotto_tipo: "griglia_convocazione",
              // NON 'staff': eviterebbe il trigger che invia a tutto lo staff del club
              tipo_destinatari: "staff_selezionati",
              data_evento,
              stato: "inviata",
              inviata_at: adesso,
            } as any)
            .select("id")
            .single();
          if (err_com) throw err_com;
          const { error: err_dest } = await supabase.from("comunicazioni_destinatari_staff").insert({
            comunicazione_id: (com as any).id,
            user_id: i.user_id,
            club_id,
            stato: "inviata",
          } as any);
          if (err_dest) throw err_dest;
          istruttori_avvisati += 1;
        }
      }

      return { blocco_id, inviate, istruttori_avvisati, istruttori_senza_account };
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
      qc.invalidateQueries({ queryKey: ["miei_reminder_staff"] });
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
