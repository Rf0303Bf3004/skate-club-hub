import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmButton from "@/components/common/ConfirmButton";
import NotaPermesso from "@/components/common/NotaPermesso";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import { Plus, ArrowLeft, Trash2, X, CheckCircle, Send, Search, Printer } from "lucide-react";
import { createPortal } from "react-dom";
import { use_club } from "@/hooks/use-supabase-data";
import {
  ComunicazioneFormSection,
  empty_comunicazione_state,
  invia_comunicazione_evento,
  default_titolo_test,
  default_testo_test,
  type ComunicazioneFormState,
} from "@/components/comunicazioni/ComunicazioneFormSection";
import {
  get_livello_gara,
  TEST_BASE_PASSAGGI,
  TEST_CARRIERA_PASSAGGI,
  get_passaggi_validi_per_atleta,
  apply_esito_propagation,
  apply_promozione_atleta,
  type Disciplina,
  type Passaggio,
  type TestAtletaRow,
} from "@/lib/atleta-livello";
import { use_tariffe_test, LIVELLI_TARIFFA } from "@/components/setup/TariffeTestSection";

// ─── Tipi ───────────────────────────────────────────────────────────────
type TestLivello = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  nome: string;
  data: string | null;
  ora: string | null;
  luogo: string | null;
  tipo: "base" | "in_gara" | string;
  gara_id: string | null;
  club_ospitante: string | null;
  costo_iscrizione: number | null;
  scadenza_disdetta: string | null;
  // legacy / deprecated
  livello_attuale: string | null;
  livello_accesso: string | null;
  note: string | null;
  created_at: string;
};

type StatoInvito = "invitata" | "accettata" | "rifiutata" | "annullata" | "ritirata";

type TestAtleta = TestAtletaRow & {
  note_istruttore: string | null;
  stato: StatoInvito | null;
  invitata_at: string | null;
  risposta_at: string | null;
  stato_da: string | null;
  stato_motivo: string | null;
  costo_applicato: number | null;
  costo_previsto: number | null;
  disdetta_nei_termini: boolean | null;
  presente: boolean | null;
};

const STATO_INVITO_BADGE: Record<StatoInvito, string> = {
  invitata: "bg-muted text-muted-foreground border-border",
  accettata: "bg-green-100 text-green-800 border-green-200",
  rifiutata: "bg-destructive/10 text-destructive border-destructive/20",
  annullata: "bg-muted/50 text-muted-foreground/60 border-border/50 line-through",
  ritirata: "bg-orange-100 text-orange-800 border-orange-200",
};

type Atleta = {
  id: string;
  nome: string;
  cognome: string;
  attivo: boolean | null;
  data_nascita: string | null;
  livello_attuale: string | null;
  carriera_artistica: string | null;
  carriera_stile: string | null;
  categoria: string | null;
  livello_amatori: string | null;
  livello_artistica: string | null;
  livello_stile: string | null;
};

type Gara = {
  id: string;
  nome: string;
  data: string | null;
  ora: string | null;
  luogo: string | null;
  club_ospitante: string | null;
};

function get_esito_options(t: (k: string) => string): { value: TestAtleta["esito"]; label: string; cls: string }[] {
  return [
    { value: "in_attesa",     label: t("level_tests.esito_in_attesa"),     cls: "bg-muted text-muted-foreground" },
    { value: "superato",      label: t("level_tests.passed"),      cls: "bg-green-100 text-green-800" },
    { value: "non_superato",  label: t("level_tests.failed"),  cls: "bg-destructive/10 text-destructive" },
    { value: "non_sostenuto", label: t("level_tests.esito_non_sostenuto"), cls: "bg-muted text-muted-foreground italic" },
  ];
}

// Tutti i passaggi possibili (accesso → target): il test si riferisce a uno solo di questi.
const TUTTI_PASSAGGI: Passaggio[] = [...TEST_BASE_PASSAGGI, ...TEST_CARRIERA_PASSAGGI];

const passaggio_di_accesso = (accesso: string | null | undefined): Passaggio | null =>
  TUTTI_PASSAGGI.find((p) => p.accesso === accesso) ?? null;

/** Catena di passaggi consecutivi a partire dal passaggio del test. */
const passaggi_da_accesso = (accesso: string | null | undefined): Passaggio[] => {
  const idx = TUTTI_PASSAGGI.findIndex((p) => p.accesso === accesso);
  return idx >= 0 ? TUTTI_PASSAGGI.slice(idx) : [];
};

const etichetta_passaggio = (p: Passaggio) =>
  `${p.target} (riservato alle atlete ${p.accesso})`;

// ─── Form state nuovo test ───────────────────────────────────────────────
type NuovoTestForm = {
  tipo: "base" | "in_gara";
  nome: string;
  livello_accesso: string;
  data: string;
  ora: string;
  luogo: string;
  club_ospitante: string;
  costo_iscrizione: string;
  scadenza_disdetta: string;
  gara_id: string;
  note: string;
};

const empty_form: NuovoTestForm = {
  tipo: "base",
  nome: "",
  livello_accesso: "",
  data: "",
  ora: "",
  luogo: "",
  club_ospitante: "",
  costo_iscrizione: "",
  scadenza_disdetta: "",
  gara_id: "",
  note: "",
};


// Riepilogo livelli convocate per la card di lista
function summarize_livelli(t: (k: string, o?: any) => string, rows: { livello_target: string; disciplina: string | null }[]): string {
  if (rows.length === 0) return t("level_tests.count_athletes_zero");
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.disciplina ? `${r.livello_target} ${r.disciplina === "artistica" ? t("level_tests.discipline_artistica") : t("level_tests.discipline_stile")}` : r.livello_target;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // unique atleti = rows distinte per ordine=1 idealmente; qui contiamo step totali
  const parts = Array.from(counts.entries()).map(([k, n]) => `${n} ${k}`);
  return parts.join(", ");
}

// ─── Componente principale ──────────────────────────────────────────────
export default function TestLivelloPage() {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const { data: club_corrente } = use_club();
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const route_params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [view, set_view] = useState<"list" | "detail" | "new">(route_params.id ? "detail" : "list");
  const [selected_test_id, set_selected_test_id] = useState<string | null>(route_params.id ?? null);
  const [form, set_form] = useState<NuovoTestForm>({ ...empty_form });
  const [mostra_passati, set_mostra_passati] = useState(false);

  // ─── Sezione Comunicazione (form Nuovo Test) ────────────
  const [com_state, set_com_state] = useState<ComunicazioneFormState>(() => empty_comunicazione_state());
  const [com_touched, set_com_touched] = useState(false);
  const [com_dest_touched, set_com_dest_touched] = useState(false);


  const { data: corsi_lista = [] } = useQuery({
    queryKey: ["corsi_per_comunicazione", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corsi")
        .select("id, nome")
        .eq("club_id", club_id!)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  useEffect(() => {
    if (route_params.id && route_params.id !== selected_test_id) {
      set_selected_test_id(route_params.id);
      set_view("detail");
    }
    if (!route_params.id && view === "detail") {
      set_view("list");
      set_selected_test_id(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route_params.id]);

  // ─── Queries ────────────────────────────────────────────────────────
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["test_livello", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_livello")
        .select("*")
        .eq("club_id", club_id!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TestLivello[];
    },
  });

  const { data: atleti = [] } = useQuery({
    queryKey: ["atleti_test", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("id, nome, cognome, attivo, data_nascita, livello_attuale, carriera_artistica, carriera_stile, categoria, livello_amatori, livello_artistica, livello_stile")
        .eq("club_id", club_id!)
        .eq("attivo", true)
        .order("cognome");
      if (error) throw error;
      return (data ?? []) as Atleta[];
    },
  });

  const { data: gare = [] } = useQuery({
    queryKey: ["gare_calendario_test", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("gare_calendario")
        .select("id, nome, data, ora, luogo, club_ospitante")
        .eq("club_id", club_id!)
        .gte("data", today)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Gara[];
    },
  });

  const { data: test_atleti = [], refetch: refetch_atleti } = useQuery({
    queryKey: ["test_livello_atleti", selected_test_id],
    enabled: !!selected_test_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_livello_atleti")
        .select("*")
        .eq("test_id", selected_test_id!)
        .order("ordine", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TestAtleta[];
    },
  });

  // Counters aggregati (totale step) per ogni test in lista
  const { data: counters = {} } = useQuery({
    queryKey: ["test_livello_counters", club_id],
    enabled: !!club_id && tests.length > 0,
    queryFn: async () => {
      const ids = tests.map((t) => t.id);
      if (ids.length === 0) return {} as Record<string, { livello_target: string; disciplina: string | null }[]>;
      const { data, error } = await supabase
        .from("test_livello_atleti")
        .select("test_id, livello_target, disciplina")
        .in("test_id", ids);
      if (error) throw error;
      const map: Record<string, { livello_target: string; disciplina: string | null }[]> = {};
      for (const r of data ?? []) {
        const key = (r as any).test_id as string;
        if (!map[key]) map[key] = [];
        map[key].push({ livello_target: (r as any).livello_target, disciplina: (r as any).disciplina });
      }
      return map;
    },
  });

  const ESITO_OPTIONS = useMemo(() => get_esito_options(t), [t]);

  const selected_test = tests.find((t) => t.id === selected_test_id);

  // Filtro Attivi (oggi/futuri o senza data) vs Passati/Archiviati (data < oggi).
  // Nota: nulla viene cancellato dal DB, è solo un filtro UI.
  const today_iso = new Date().toISOString().split("T")[0];
  const get_data_test = (t: TestLivello): string | null => {
    if (t.tipo === "in_gara") return gare.find((g) => g.id === t.gara_id)?.data ?? t.data;
    return t.data;
  };
  const tests_passati = useMemo(
    () => tests.filter((t) => { const d = get_data_test(t); return d && d < today_iso; }),
    [tests, gare, today_iso],
  );
  const tests_attivi = useMemo(
    () => tests.filter((t) => { const d = get_data_test(t); return !d || d >= today_iso; }),
    [tests, gare, today_iso],
  );
  const tests_visibili = mostra_passati ? tests_passati : tests_attivi;

  // Atlete idonee al passaggio scelto nel form (livello attuale == accesso del test)
  const idonee_form = useMemo(
    () =>
      form.livello_accesso
        ? atleti.filter((a) => get_livello_gara(a as any) === form.livello_accesso)
        : [],
    [atleti, form.livello_accesso],
  );

  // Auto-sync default titolo/testo per la sezione Comunicazione (form Nuovo Test)
  useEffect(() => {
    if (com_touched) return;
    const gara = form.gara_id ? gare.find((g) => g.id === form.gara_id) : null;
    const data_eff = form.tipo === "in_gara" ? (gara?.data ?? "") : (form.data || "");
    set_com_state((p) => ({
      ...p,
      titolo: default_titolo_test(form.nome),
      testo: default_testo_test(form.nome, data_eff),
    }));
  }, [form.nome, form.data, form.tipo, form.gara_id, gare, com_touched]);

  // I destinatari predefiniti sono SOLO le atlete idonee al livello del test
  useEffect(() => {
    if (com_dest_touched) return;
    set_com_state((p) => ({
      ...p,
      tipo_destinatari: "atleti",
      atleti_ids: idonee_form.map((a) => a.id),
    }));
  }, [idonee_form, com_dest_touched]);

  const handle_com_change = (next: ComunicazioneFormState) => {
    if (next.titolo !== com_state.titolo || next.testo !== com_state.testo) set_com_touched(true);
    if (
      next.tipo_destinatari !== com_state.tipo_destinatari ||
      next.atleti_ids.length !== com_state.atleti_ids.length
    ) {
      set_com_dest_touched(true);
    }
    set_com_state(next);
  };


  // ─── Mutations ──────────────────────────────────────────────────────
  const create_test = useMutation({
    mutationFn: async () => {
      const gara = form.gara_id ? gare.find((g) => g.id === form.gara_id) : null;
      const payload: any = {
        club_id: club_id!,
        nome: form.nome,
        livello_accesso: form.livello_accesso,

        tipo: form.tipo,
        gara_id: form.tipo === "in_gara" ? (form.gara_id || null) : null,
        data: form.tipo === "in_gara" ? (gara?.data ?? null) : (form.data || null),
        ora: form.tipo === "in_gara" ? (gara?.ora ?? null) : (form.ora || null),
        luogo: form.tipo === "in_gara" ? (gara?.luogo ?? null) : (form.luogo || null),
        club_ospitante: form.tipo === "in_gara" ? (gara?.club_ospitante ?? null) : (form.club_ospitante || null),
        costo_iscrizione: form.costo_iscrizione ? Number(form.costo_iscrizione) : null,
        scadenza_disdetta: form.scadenza_disdetta || null,
        note: form.note || null,
      };
      const { data, error } = await supabase
        .from("test_livello")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Workflow comunicazione (se attivo)
      if (com_state.invia && data?.id) {
        try {
          const count = await invia_comunicazione_evento(supabase, {
            club_id: club_id!,
            state: com_state,
            fk: { test_livello_id: data.id },
          });
          toast.success(count ? t("level_tests.toast_communication_sent_to", { count }) : t("level_tests.toast_communication_sent"));
          qc.invalidateQueries({ queryKey: ["comunicazioni"] });
        } catch (com_err: any) {
          toast.error(t("level_tests.toast_test_created_comm_failed", { error: com_err?.message ?? "" }));
        }
      }

      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["test_livello"] });
      set_selected_test_id(data.id);
      navigate(`/test/${data.id}`);
      toast.success(t("level_tests.toast_test_created"));
    },
    onError: (e: any) => toast.error(t("level_tests.toast_create_error", { error: e?.message ?? "" })),
  });

  const update_livello_test = useMutation({
    mutationFn: async ({ id, accesso }: { id: string; accesso: string }) => {
      const { error } = await supabase
        .from("test_livello")
        .update({ livello_accesso: accesso } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test_livello"] });
      toast.success("Livello del test aggiornato");
    },
    onError: (e: any) => toast.error(t("level_tests.toast_generic_error", { error: e?.message ?? "" })),
  });

  const delete_test = useMutation({

    mutationFn: async (id: string) => {
      await supabase.from("test_livello_atleti").delete().eq("test_id", id);
      const { error } = await supabase.from("test_livello").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test_livello"] });
      navigate("/test");
      toast.success(t("level_tests.toast_test_deleted"));
    },
  });

  const remove_step = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_livello_atleti").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetch_atleti(); toast.success(t("level_tests.toast_convocation_removed")); },
  });

  const set_presenza = useMutation({
    mutationFn: async ({ atleta_id, valore }: { atleta_id: string; valore: boolean | null }) => {
      if (!selected_test_id) return;
      const { error } = await supabase
        .from("test_livello_atleti")
        .update({ presente: valore } as any)
        .eq("test_id", selected_test_id)
        .eq("atleta_id", atleta_id);
      if (error) throw error;
    },
    onSuccess: () => refetch_atleti(),
  });

  const update_field = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TestAtleta> }) => {
      const { error } = await supabase.from("test_livello_atleti").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch_atleti(),
  });

  const handle_change_esito = async (id: string, nuovo: "in_attesa" | "superato" | "non_superato" | "non_sostenuto") => {
    const prev_row = test_atleti.find((r) => r.id === id);
    const prev_esito = prev_row?.esito;
    await update_field.mutateAsync({ id, patch: { esito: nuovo } as any });
    await apply_esito_propagation(supabase as any, id, nuovo, test_atleti as TestAtletaRow[]);

    if (nuovo === "superato" && prev_esito !== "superato" && prev_row) {
      const atleta = atleti.find((a) => a.id === prev_row.atleta_id);
      if (atleta) {
        try {
          const result = await apply_promozione_atleta(supabase as any, atleta as any, {
            livello_target: prev_row.livello_target,
            disciplina: prev_row.disciplina ?? null,
          });
          if (result.promosso) {
            toast.success(t("level_tests.toast_promotion_success", { cognome: atleta.cognome, nome: atleta.nome, from: result.from, to: result.to }));
            const aid = prev_row.atleta_id;
            await Promise.all([
              qc.invalidateQueries({ queryKey: ["atleti_test"], refetchType: "all" }),
              qc.invalidateQueries({ queryKey: ["atleti"], refetchType: "all" }),
              qc.invalidateQueries({ queryKey: ["atleta", aid], refetchType: "all" }),
              qc.invalidateQueries({ queryKey: ["storico_test_atleta", aid], refetchType: "all" }),
              qc.invalidateQueries({ queryKey: ["storico_livelli", aid], refetchType: "all" }),
              qc.invalidateQueries({ queryKey: ["calendario-interattivo", aid], refetchType: "all" }),
            ]);
          } else {
            toast.info(t("level_tests.toast_promotion_skipped", { motivo: (result as any).skipped_motivo }));
          }
        } catch (e: any) {
          toast.error(t("level_tests.toast_promotion_error", { error: e?.message ?? "" }));
        }
      }
    } else if (prev_esito === "superato" && nuovo !== "superato") {
      toast.warning(t("level_tests.toast_esito_changed_warning"));
    }
    refetch_atleti();
  };

  // ─── Inviti atlete ─────────────────────────────────────────────────
  const [invite_selected, set_invite_selected] = useState<Set<string>>(new Set());
  const [search_invite, set_search_invite] = useState("");
  const [filtro_livello_invite, set_filtro_livello_invite] = useState<string>("tutti");
  const [invite_passaggi, set_invite_passaggi] = useState<Record<string, number>>({});
  const [annulla_atleta_id, set_annulla_atleta_id] = useState<string | null>(null);
  const [annulla_motivo, set_annulla_motivo] = useState("");

  // Una riga "invito" per atleta (la prima della catena, ordine min)
  const inviti_per_atleta = useMemo(() => {
    const map = new Map<string, TestAtleta>();
    for (const r of test_atleti) {
      const prev = map.get(r.atleta_id);
      if (!prev || r.ordine < prev.ordine) map.set(r.atleta_id, r);
    }
    return map;
  }, [test_atleti]);

  const inviti_lista = useMemo(() => Array.from(inviti_per_atleta.values()), [inviti_per_atleta]);

  const invito_stats = useMemo(() => {
    let invitate = 0, accettate = 0, rifiutate = 0, senza_risposta = 0, totale_accettate = 0;
    const accettate_ids = new Set<string>();
    for (const r of inviti_lista) {
      const s = (r.stato ?? "invitata") as StatoInvito;
      if (s === "annullata") continue;
      invitate++;
      if (s === "accettata") { accettate++; accettate_ids.add(r.atleta_id); }
      else if (s === "rifiutata") rifiutate++;
      else if (!r.risposta_at) senza_risposta++;
    }
    // Somma la quota congelata (costo_applicato) di tutti i passaggi delle accettate
    for (const riga of test_atleti) {
      if (accettate_ids.has(riga.atleta_id)) totale_accettate += Number(riga.costo_applicato ?? 0);
    }
    return { invitate, accettate, rifiutate, senza_risposta, totale_accettate };
  }, [inviti_lista, test_atleti]);

  // Listino tariffe per tipo di test (vince sul prezzo della singola giornata)
  const { data: tariffe_test = [] } = use_tariffe_test();
  const tariffe_attive = useMemo(
    () =>
      LIVELLI_TARIFFA.filter((liv) =>
        tariffe_test.some((t) => t.livello_target === liv && t.attiva !== false && t.prezzo != null),
      ),
    [tariffe_test],
  );

  const livelli_invite_disponibili = useMemo(() => {
    const set = new Set<string>();
    for (const a of atleti) set.add(get_livello_gara(a as any));
    return Array.from(set).sort();
  }, [atleti]);

  const atleti_invitabili = useMemo(() => {
    const terms = search_invite.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return atleti.filter((a) => {
      if (filtro_livello_invite !== "tutti" && get_livello_gara(a as any) !== filtro_livello_invite) return false;
      if (terms.length > 0) {
        const text = `${a.nome} ${a.cognome}`.toLowerCase();
        if (!terms.every((term) => text.includes(term))) return false;
      }
      return true;
    });
  }, [atleti, search_invite, filtro_livello_invite]);

  const toggle_invite = (id: string) => {
    set_invite_selected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Passaggi proposti per un'atleta (progressione tecnica)
  const passaggi_atleta = (atleta_id: string): Passaggio[] => {
    const a = atleti.find((x) => x.id === atleta_id);
    if (!a) return [];
    return get_passaggi_validi_per_atleta(a as any, "artistica");
  };

  const invita_selezionate = useMutation({
    mutationFn: async () => {
      if (!selected_test_id || invite_selected.size === 0) return { inserite: 0, duplicate: 0 };
      let inserite = 0, duplicate = 0;
      for (const atleta_id of invite_selected) {
        const atleta = atleti.find((a) => a.id === atleta_id);
        if (!atleta) continue;
        const passaggi = get_passaggi_validi_per_atleta(atleta as any, "artistica");
        const quanti = Math.max(1, Math.min(invite_passaggi[atleta_id] ?? 1, Math.max(passaggi.length, 1)));
        const rows = Array.from({ length: quanti }, (_, idx) => {
          const p = passaggi[idx] ?? null;
          return {
            test_id: selected_test_id,
            atleta_id,
            ordine: idx + 1,
            livello_accesso: p?.accesso ?? get_livello_gara(atleta as any),
            livello_target: p?.target ?? null,
            disciplina: p?.richiede_disciplina ? "artistica" : null,
            esito: "in_attesa",
          };
        });
        const { error } = await supabase.from("test_livello_atleti").insert(rows as any);
        if (error) {
          // Unicità (test_id, atleta_id, ordine): passaggio già presente → salto
          if ((error as any).code === "23505") { duplicate++; continue; }
          throw error;
        }
        inserite++;
      }
      return { inserite, duplicate };
    },
    onSuccess: ({ inserite, duplicate }) => {
      refetch_atleti();
      set_invite_selected(new Set());
      set_invite_passaggi({});
      if (inserite > 0) toast.success(t("level_tests.invite_sent", { count: inserite, defaultValue: `${inserite} atlete invitate` }));
      if (duplicate > 0) toast.info(t("level_tests.invite_duplicates", { count: duplicate, defaultValue: `${duplicate} erano già invitate: saltate` }));
    },
    onError: (e: any) => toast.error(t("level_tests.toast_generic_error", { error: e?.message ?? "" })),
  });

  const annulla_invito = useMutation({
    mutationFn: async ({ atleta_id, motivo }: { atleta_id: string; motivo: string }) => {
      const { data: user_data } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("test_livello_atleti")
        .update({ stato: "annullata", stato_motivo: motivo || null, stato_da: user_data.user?.id ?? null } as any)
        .eq("test_id", selected_test_id!)
        .eq("atleta_id", atleta_id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch_atleti();
      set_annulla_atleta_id(null);
      set_annulla_motivo("");
      toast.success(t("level_tests.invite_cancelled", { defaultValue: "Invito annullato" }));
    },
    onError: (e: any) => toast.error(t("level_tests.toast_generic_error", { error: e?.message ?? "" })),
  });

  // ─── Add Athlete Dialog (multitest chain) ────────────────────────────
  const [show_add, set_show_add] = useState(false);
  const [add_atleta_id, set_add_atleta_id] = useState<string>("");
  const [search_atleta, set_search_atleta] = useState("");
  const [chain, set_chain] = useState<{ accesso: string; target: string; richiede_disciplina: boolean; disciplina: Disciplina | "" }[]>([]);

  // Quando seleziono un atleta, pre-popolo la catena con il primo passaggio valido
  useEffect(() => {
    if (!add_atleta_id) { set_chain([]); return; }
    const atleta = atleti.find((a) => a.id === add_atleta_id);
    if (!atleta) return;
    const passaggi = get_passaggi_validi_per_atleta(atleta as any, "artistica");
    if (passaggi.length === 0) { set_chain([]); return; }
    const p = passaggi[0];
    set_chain([{ accesso: p.accesso, target: p.target, richiede_disciplina: p.richiede_disciplina, disciplina: p.richiede_disciplina ? "artistica" : "" }]);
  }, [add_atleta_id, atleti]);

  useEffect(() => {
    if (!show_add) { set_add_atleta_id(""); set_chain([]); set_search_atleta(""); }
  }, [show_add]);

  const all_passaggi = useMemo(() => [...TEST_BASE_PASSAGGI, ...TEST_CARRIERA_PASSAGGI], []);

  const next_passaggio_for_chain = (): Passaggio | null => {
    if (chain.length === 0) return null;
    const last_target = chain[chain.length - 1].target;
    // Per estendere la catena: il prossimo deve avere accesso == last_target.
    // Eccezione: dopo Stellina 4 → Interbronzo, il prossimo dipende dalla disciplina (carriera).
    return all_passaggi.find((p) => p.accesso === last_target) ?? null;
  };

  const add_chain_step = () => {
    const next = next_passaggio_for_chain();
    if (!next) { toast.info(t("level_tests.toast_no_next_step")); return; }
    // Se l'ultimo step aveva una disciplina (artistica/stile), il nuovo step la eredita
    const last_disc = chain[chain.length - 1]?.disciplina;
    set_chain([
      ...chain,
      {
        accesso: next.accesso,
        target: next.target,
        richiede_disciplina: next.richiede_disciplina,
        disciplina: next.richiede_disciplina ? (last_disc || "artistica") : "",
      },
    ]);
  };

  const remove_chain_step = (idx: number) => {
    set_chain(chain.slice(0, idx).concat(chain.slice(idx + 1)));
  };

  // Per il test in_gara, la disciplina è fissata a livello evento (derivata dalla gara o no)
  // Qui niente di automatico: il primo step propone artistica, l'utente può cambiare.

  const submit_add_chain = useMutation({
    mutationFn: async () => {
      if (!add_atleta_id || chain.length === 0 || !selected_test_id) return;
      const rows = chain.map((c, idx) => ({
        test_id: selected_test_id,
        atleta_id: add_atleta_id,
        ordine: idx + 1,
        livello_accesso: c.accesso,
        livello_target: c.target,
        disciplina: c.disciplina || null,
        esito: "in_attesa",
      }));
      const { error } = await supabase.from("test_livello_atleti").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch_atleti();
      set_show_add(false);
      toast.success(t("level_tests.toast_athlete_convoked"));
    },
    onError: (e: any) => toast.error(t("level_tests.toast_generic_error", { error: e?.message ?? "" })),
  });

  // Atlete già convocate (almeno uno step) per evitare doppia selezione del primo step
  const convocate_ids = new Set(test_atleti.map((ta) => ta.atleta_id));
  const atleti_per_add = atleti.filter((a) => !convocate_ids.has(a.id));

  const atleti_filtrati = useMemo(() => {
    if (!search_atleta.trim()) return atleti_per_add;
    const terms = search_atleta.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return atleti_per_add.filter((a) => {
      const text = `${a.nome} ${a.cognome}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [search_atleta, atleti_per_add]);

  // Raggruppa per atleta nel dettaglio
  const grouped_chains = useMemo(() => {
    const map = new Map<string, TestAtleta[]>();
    for (const r of test_atleti) {
      const key = r.atleta_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Ordina ogni catena per ordine
    for (const arr of map.values()) arr.sort((a, b) => a.ordine - b.ordine);
    return Array.from(map.entries());
  }, [test_atleti]);

  // ─── LIST VIEW ──────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{t("level_tests.page_title")}</h1>
          {puo_gestire_sportivo && (
            <Button onClick={() => { set_form({ ...empty_form }); set_view("new"); }}>
              <Plus className="w-4 h-4 mr-2" /> {t("level_tests.new")}
            </Button>
          )}
        </div>
        {!puo_gestire_sportivo && (
          <NotaPermesso testo="Sola lettura: solo lo staff di gestione può creare, modificare o eliminare i test di livello." />
        )}
        <div className="flex items-center gap-2">
          <Button
            variant={mostra_passati ? "outline" : "default"}
            size="sm"
            onClick={() => set_mostra_passati(false)}
          >
            {t("level_tests.active_count", { count: tests_attivi.length })}
          </Button>
          <Button
            variant={mostra_passati ? "default" : "outline"}
            size="sm"
            onClick={() => set_mostra_passati(true)}
          >
            {t("level_tests.archived_count", { count: tests_passati.length })}
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : tests_visibili.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            {mostra_passati ? t("level_tests.no_past_tests") : t("level_tests.no_active_tests")}
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tests_visibili.map((tv) => {
              const rows = counters[tv.id] ?? [];
              const n_atleti = new Set(test_atleti.filter((x) => x.test_id === tv.id).map((x) => x.atleta_id)).size;
              // se non ho ancora i test_atleti del test corrente, uso la lunghezza dei raw (step) per fallback
              const tipo_label = tv.tipo === "in_gara"
                ? (gare.find((g) => g.id === tv.gara_id)?.nome ? t("level_tests.test_in_gara_named", { name: gare.find((g) => g.id === tv.gara_id)?.nome }) : t("level_tests.test_in_gara"))
                : t("level_tests.test_base");
              return (
                <Card key={tv.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/test/${tv.id}`)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{tv.nome || tipo_label}</span>
                      <Badge variant="outline" className="capitalize ml-2 shrink-0">{tv.tipo === "in_gara" ? t("level_tests.type_in_gara_badge") : t("level_tests.type_base_badge")}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    {tv.data && <p>📅 {new Date(tv.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>}
                    {tv.luogo && <p>📍 {tv.luogo}{tv.club_ospitante ? ` · ${tv.club_ospitante}` : ""}</p>}
                    <p className="text-xs">
                      {rows.length === 0
                        ? t("level_tests.no_convocations")
                        : t("level_tests.steps_and_summary", { count: rows.length, summary: summarize_livelli(t, rows) })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── NEW TEST FORM ──────────────────────────────────────────────────
  if (view === "new") {
    const gara_sel = form.gara_id ? gare.find((g) => g.id === form.gara_id) : null;
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => set_view("list")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{t("level_tests.new_test_title")}</h1>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Step 1: tipo */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t("level_tests.type_label")}</label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className={`border rounded-md p-3 cursor-pointer transition ${form.tipo === "base" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <input type="radio" name="tipo" className="mr-2" checked={form.tipo === "base"} onChange={() => set_form({ ...form, tipo: "base", gara_id: "" })} />
                  <span className="font-medium">{t("level_tests.test_base")}</span>
                  <p className="text-xs text-muted-foreground mt-1">{t("level_tests.type_base_desc")}</p>
                </label>
                <label className={`border rounded-md p-3 cursor-pointer transition ${form.tipo === "in_gara" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <input type="radio" name="tipo" className="mr-2" checked={form.tipo === "in_gara"} onChange={() => set_form({ ...form, tipo: "in_gara" })} />
                  <span className="font-medium">{t("level_tests.test_in_gara")}</span>
                  <p className="text-xs text-muted-foreground mt-1">{t("level_tests.type_in_gara_desc")}</p>
                </label>
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("level_tests.name_label")}</label>
              <Input value={form.nome} onChange={(e) => set_form({ ...form, nome: e.target.value })} placeholder={t("level_tests.name_placeholder")} />
            </div>

            {/* Step 2A: base */}
            {form.tipo === "base" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-foreground">{t("level_tests.date_label")}</label>
                  <Input type="date" value={form.data} onChange={(e) => set_form({ ...form, data: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">{t("level_tests.time_label")}</label>
                  <Input type="time" value={form.ora} onChange={(e) => set_form({ ...form, ora: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">{t("level_tests.place_label")}</label>
                  <Input value={form.luogo} onChange={(e) => set_form({ ...form, luogo: e.target.value })} placeholder={t("level_tests.place_placeholder")} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">{t("level_tests.host_club_label")}</label>
                  <Input value={form.club_ospitante} onChange={(e) => set_form({ ...form, club_ospitante: e.target.value })} placeholder={t("level_tests.host_club_placeholder")} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">{t("level_tests.cost_label")}</label>
                  <Input type="number" step="0.01" value={form.costo_iscrizione} onChange={(e) => set_form({ ...form, costo_iscrizione: e.target.value })} />
                </div>
              </div>
            )}

            {/* Step 2B: in_gara */}
            {form.tipo === "in_gara" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">{t("level_tests.race_label")}</label>
                  <Select value={form.gara_id} onValueChange={(v) => set_form({ ...form, gara_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("level_tests.race_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      {gare.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">{t("level_tests.no_future_races")}</div>
                      ) : gare.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome} {g.data ? `· ${new Date(g.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {gara_sel && (
                  <div className="md:col-span-2 grid gap-2 md:grid-cols-3 text-sm bg-muted/40 rounded-md p-3">
                    <div><span className="text-muted-foreground">Data:</span> {gara_sel.data ? new Date(gara_sel.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}</div>
                    <div><span className="text-muted-foreground">Ora:</span> {gara_sel.ora?.slice(0, 5) || "-"}</div>
                    <div><span className="text-muted-foreground">Luogo:</span> {gara_sel.luogo || "-"}</div>
                    {gara_sel.club_ospitante && <div className="md:col-span-3"><span className="text-muted-foreground">{t("level_tests.race_host_club_prefix")}</span> {gara_sel.club_ospitante}</div>}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground">{t("level_tests.cost_label")}</label>
                  <Input type="number" step="0.01" value={form.costo_iscrizione} onChange={(e) => set_form({ ...form, costo_iscrizione: e.target.value })} />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Ultimo giorno per ritirarsi senza pagare</label>
              <Input type="date" value={form.scadenza_disdetta} onChange={(e) => set_form({ ...form, scadenza_disdetta: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Se resta vuoto, chi aderisce paga comunque.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">{t("level_tests.notes_label")}</label>
              <Textarea value={form.note} onChange={(e) => set_form({ ...form, note: e.target.value })} />
            </div>

            <ComunicazioneFormSection
              state={com_state}
              onChange={handle_com_change}
              corsi={corsi_lista.map((c) => ({ id: c.id, label: c.nome }))}
              atleti={atleti.map((a) => ({ id: a.id, label: `${a.cognome} ${a.nome}` }))}
            />

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => set_view("list")}>{t("level_tests.cancel")}</Button>
              <Button
                disabled={
                  !form.nome ||
                  (form.tipo === "in_gara" && !form.gara_id) ||
                  create_test.isPending
                }
                onClick={() => create_test.mutate()}
              >
                {com_state.invia ? (<><Send className="w-4 h-4 mr-1" /> {t("level_tests.create_and_communicate")}</>) : t("level_tests.create_test")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── DETAIL VIEW ────────────────────────────────────────────────────
  if (!selected_test) {
    return (
      <div className="py-12 text-center text-muted-foreground">{t("level_tests.test_not_found")}</div>
    );
  }

  const gara_link = selected_test.gara_id ? gare.find((g) => g.id === selected_test.gara_id) : null;

  // ─── Elenco iscritte stampabile ────────────────────────────────
  const iscritte_stampa = (() => {
    const gruppi = new Map<string, { atleta: Atleta | undefined; passi: TestAtleta[] }[]>();
    for (const r of inviti_lista) {
      if ((r.stato ?? "invitata") !== "accettata") continue;
      const atleta = atleti.find((a) => a.id === r.atleta_id);
      const livello = atleta ? get_livello_gara(atleta as any) : "—";
      const passi = test_atleti.filter((x) => x.atleta_id === r.atleta_id).sort((a, b) => a.ordine - b.ordine);
      if (!gruppi.has(livello)) gruppi.set(livello, []);
      gruppi.get(livello)!.push({ atleta, passi });
    }
    for (const arr of gruppi.values()) {
      arr.sort((a, b) => `${a.atleta?.cognome ?? ""} ${a.atleta?.nome ?? ""}`.localeCompare(`${b.atleta?.cognome ?? ""} ${b.atleta?.nome ?? ""}`));
    }
    return Array.from(gruppi.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();
  const totale_iscritte = iscritte_stampa.reduce((acc, [, arr]) => acc + arr.length, 0);
  const totale_quote_stampa = iscritte_stampa.reduce(
    (acc, [, arr]) =>
      acc +
      arr.reduce(
        (a, { passi }) => a + passi.reduce((p, s) => p + Number(s.costo_applicato ?? 0), 0),
        0,
      ),
    0,
  );

  const stampa_elenco = () => {
    document.body.classList.add("stampa-elenco-test");
    const cleanup = () => {
      document.body.classList.remove("stampa-elenco-test");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 50);
  };
  const next_for_dialog = next_passaggio_for_chain();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/test")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{selected_test.nome}</h1>
        <Badge variant="outline" className="capitalize">{selected_test.tipo === "in_gara" ? t("level_tests.type_in_gara_badge") : t("level_tests.type_base_badge")}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={stampa_elenco}>
            <Printer className="w-4 h-4 mr-1" /> Elenco iscritte
          </Button>
        </div>
        {puo_gestire_sportivo && (
          <div className="flex gap-2">
            <ConfirmButton
              titolo={t("level_tests.delete_confirm_title")}
              descrizione={t("level_tests.delete_confirm_desc")}
              on_conferma={() => delete_test.mutate(selected_test.id)}
            >
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" /> {t("level_tests.delete")}
              </Button>
            </ConfirmButton>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 grid gap-2 md:grid-cols-4 text-sm">
          <div><span className="text-muted-foreground">{t("level_tests.detail_date")}</span> {selected_test.data ? new Date(selected_test.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}</div>
          <div><span className="text-muted-foreground">{t("level_tests.detail_time")}</span> {selected_test.ora?.slice(0, 5) || "-"}</div>
          <div><span className="text-muted-foreground">{t("level_tests.detail_place")}</span> {selected_test.luogo || "-"}</div>
          <div><span className="text-muted-foreground">{t("level_tests.detail_club")}</span> {selected_test.club_ospitante || "-"}</div>
          {gara_link && (
            <div className="md:col-span-4 text-xs text-muted-foreground">
              {t("level_tests.detail_in_gara_label")} <strong>{gara_link.nome}</strong>
            </div>
          )}
          {selected_test.costo_iscrizione != null && (
            <div className="md:col-span-4"><span className="text-muted-foreground">{t("level_tests.detail_cost")}</span> CHF {Number(selected_test.costo_iscrizione).toFixed(2)}</div>
          )}
          <div className="md:col-span-4 text-xs text-muted-foreground">
            {tariffe_attive.length === 0
              ? "Nessun tipo di test ha una tariffa nel listino: vale il prezzo di questa giornata."
              : `Hanno già una tariffa nel listino: ${tariffe_attive.join(", ")}. Per questi tipi il listino vince sul prezzo della giornata.`}
          </div>
          <div className="md:col-span-4 text-sm">
            <span className="text-muted-foreground">Ultimo giorno per ritirarsi senza pagare:</span>{" "}
            {selected_test.scadenza_disdetta
              ? new Date(selected_test.scadenza_disdetta).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "nessuno — chi aderisce paga comunque"}
          </div>
        </CardContent>
      </Card>

      {/* ─── Invita le atlete ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{t("level_tests.invite_title", { defaultValue: "Invita le atlete" })}</CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{t("level_tests.invite_stats_invited", { count: invito_stats.invitate, defaultValue: `Invitate: ${invito_stats.invitate}` })}</span>
              <span className="text-green-700">{t("level_tests.invite_stats_accepted", { count: invito_stats.accettate, defaultValue: `Accettate: ${invito_stats.accettate}` })}</span>
              <span className="text-destructive">{t("level_tests.invite_stats_refused", { count: invito_stats.rifiutate, defaultValue: `Rifiutate: ${invito_stats.rifiutate}` })}</span>
              <span>{t("level_tests.invite_stats_pending", { count: invito_stats.senza_risposta, defaultValue: `Senza risposta: ${invito_stats.senza_risposta}` })}</span>
              {invito_stats.accettate > 0 && (
                <span className="font-medium text-foreground">
                  {t("level_tests.invite_stats_revenue", { amount: invito_stats.totale_accettate.toFixed(2), defaultValue: `Quota addebitata in fattura: CHF ${invito_stats.totale_accettate.toFixed(2)}` })}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {puo_gestire_sportivo && (
            <div className="border rounded-md overflow-hidden">
              <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={t("level_tests.search_athlete_placeholder")}
                    value={search_invite}
                    onChange={(e) => set_search_invite(e.target.value)}
                    className="h-9 pl-9 text-sm"
                  />
                </div>
                <Select value={filtro_livello_invite} onValueChange={set_filtro_livello_invite}>
                  <SelectTrigger className="w-44 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">{t("level_tests.invite_all_levels", { defaultValue: "Tutti i livelli" })}</SelectItem>
                    {livelli_invite_disponibili.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-[280px] overflow-y-auto divide-y divide-border/50">
                {atleti_invitabili.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t("level_tests.no_athlete_found")}</p>
                ) : atleti_invitabili.map((a) => {
                  const invito = inviti_per_atleta.get(a.id);
                  const gia_invitata = !!invito && (invito.stato ?? "invitata") !== "annullata";
                  const stato_inv = (invito?.stato ?? "invitata") as StatoInvito;
                  const selezionata = invite_selected.has(a.id);
                  const passaggi = selezionata ? passaggi_atleta(a.id) : [];
                  const quanti = Math.max(1, Math.min(invite_passaggi[a.id] ?? 1, Math.max(passaggi.length, 1)));
                  return (
                    <div key={a.id} className={gia_invitata ? "opacity-60" : ""}>
                      <div
                        role="button"
                        tabIndex={gia_invitata ? -1 : 0}
                        onClick={() => !gia_invitata && toggle_invite(a.id)}
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${gia_invitata ? "cursor-not-allowed" : "cursor-pointer hover:bg-accent"}`}
                      >
                        <Checkbox
                          checked={gia_invitata || selezionata}
                          disabled={gia_invitata}
                          onCheckedChange={() => !gia_invitata && toggle_invite(a.id)}
                        />
                        <span className="flex-1">{a.cognome} {a.nome}</span>
                        <span className="text-xs text-muted-foreground">{get_livello_gara(a as any)}</span>
                        {invito && (
                          <Badge variant="outline" className={`text-[10px] ${STATO_INVITO_BADGE[stato_inv]}`}>
                            {t(`level_tests.stato_${stato_inv}`, { defaultValue: stato_inv })}
                          </Badge>
                        )}
                      </div>
                      {selezionata && !gia_invitata && (
                        <div className="px-3 pb-3 pl-10 space-y-1">
                          {passaggi.length <= 1 ? (
                            <p className="text-xs text-muted-foreground">
                              Un solo passaggio: {passaggi[0] ? `${passaggi[0].accesso} → ${passaggi[0].target}` : get_livello_gara(a as any)}
                            </p>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Quanti passaggi fa</span>
                                <Select
                                  value={String(quanti)}
                                  onValueChange={(v) => set_invite_passaggi((prev) => ({ ...prev, [a.id]: Number(v) }))}
                                >
                                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {passaggi.map((_, i) => (
                                      <SelectItem key={i} value={String(i + 1)}>{i + 1}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {passaggi.slice(0, quanti).map((p, i) => (
                                  <li key={i}>{i + 1}. {p.accesso} → {p.target}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end p-2 border-t bg-muted/30">
                <Button
                  size="sm"
                  disabled={invite_selected.size === 0 || invita_selezionate.isPending}
                  onClick={() => invita_selezionate.mutate()}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {t("level_tests.invite_selected", { count: invite_selected.size, defaultValue: `Invita le selezionate (${invite_selected.size})` })}
                </Button>
              </div>
            </div>
          )}

          {/* Tabella invitate */}
          {inviti_lista.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">{t("level_tests.no_invites", { defaultValue: "Nessuna atleta invitata a questo test." })}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("level_tests.invite_col_name", { defaultValue: "Atleta" })}</TableHead>
                  <TableHead>{t("level_tests.invite_col_level", { defaultValue: "Livello" })}</TableHead>
                  <TableHead>{t("level_tests.invite_col_state", { defaultValue: "Stato" })}</TableHead>
                  <TableHead>{t("level_tests.invite_col_answered", { defaultValue: "Risposta" })}</TableHead>
                  <TableHead>Presenza</TableHead>
                  <TableHead>{t("level_tests.invite_col_fee", { defaultValue: "Quota" })}</TableHead>
                  {puo_gestire_sportivo && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviti_lista.map((r) => {
                  const atleta = atleti.find((a) => a.id === r.atleta_id);
                  const stato_inv = (r.stato ?? "invitata") as StatoInvito;
                  const passi = test_atleti
                    .filter((x) => x.atleta_id === r.atleta_id)
                    .sort((a, b) => a.ordine - b.ordine);
                  const presente_val = r.presente === null || r.presente === undefined ? "non_segnata" : (r.presente ? "presente" : "assente");
                  return (
                    <TableRow key={r.atleta_id} className={stato_inv === "annullata" ? "opacity-50" : ""}>
                      <TableCell className="font-medium text-sm align-top">
                        {atleta ? `${atleta.cognome} ${atleta.nome}` : r.atleta_id.slice(0, 8)}
                        <ul className="mt-1 space-y-0.5 text-xs font-normal text-muted-foreground">
                          {passi.map((s2) => {
                            const quota = stato_inv === "accettata" ? s2.costo_applicato : s2.costo_previsto;
                            return (
                              <li key={s2.id}>
                                {s2.ordine}. {s2.livello_accesso} → {s2.livello_target}
                                {s2.disciplina ? ` (${s2.disciplina === "artistica" ? "artistica" : "stile"})` : ""}
                                {" · "}
                                <span className="tabular-nums">
                                  {quota != null ? `CHF ${Number(quota).toFixed(2)}` : "—"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {atleta ? get_livello_gara(atleta as any) : "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className={STATO_INVITO_BADGE[stato_inv]}>
                          {t(`level_tests.stato_${stato_inv}`, { defaultValue: stato_inv })}
                        </Badge>
                        {stato_inv === "ritirata" && (
                          <p className={`mt-1 text-xs ${r.disdetta_nei_termini ? "text-muted-foreground" : "text-destructive"}`}>
                            {r.disdetta_nei_termini ? "ritiro nei termini" : "ritiro fuori termine, quota addebitata"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.risposta_at ? new Date(r.risposta_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        {puo_gestire_sportivo ? (
                          <Select
                            value={presente_val}
                            onValueChange={(v) =>
                              set_presenza.mutate({
                                atleta_id: r.atleta_id,
                                valore: v === "non_segnata" ? null : v === "presente",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="non_segnata">Non ancora segnata</SelectItem>
                              <SelectItem value="presente">Presente</SelectItem>
                              <SelectItem value="assente">Assente</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {presente_val === "non_segnata" ? "—" : presente_val === "presente" ? "Presente" : "Assente"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm align-top">
                        {(() => {
                          const tot = passi.reduce(
                            (acc, s4) =>
                              acc + Number((stato_inv === "accettata" ? s4.costo_applicato : s4.costo_previsto) ?? 0),
                            0,
                          );
                          return tot > 0 ? `CHF ${tot.toFixed(2)}` : "—";
                        })()}
                      </TableCell>
                      {puo_gestire_sportivo && (
                        <TableCell className="align-top">
                          {stato_inv !== "annullata" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive"
                              onClick={() => { set_annulla_atleta_id(r.atleta_id); set_annulla_motivo(""); }}
                            >
                              {t("level_tests.invite_cancel", { defaultValue: "Annulla invito" })}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {inviti_lista.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Segnare un'atleta assente non toglie la quota dalla fattura: l'addebito dipende dall'adesione e dall'ultimo giorno utile per ritirarsi, non dalla presenza.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("level_tests.athletes_convoked_count", { count: grouped_chains.length })}</CardTitle>
            {puo_gestire_sportivo && (
              <Button size="sm" onClick={() => set_show_add(true)}>
                <Plus className="w-4 h-4 mr-1" /> {t("level_tests.convoke_athlete")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {grouped_chains.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">{t("level_tests.no_athlete_convoked")}</p>
          ) : grouped_chains.map(([atleta_id, chain_rows]) => {
            const atleta = atleti.find((a) => a.id === atleta_id);
            const display_liv = atleta ? get_livello_gara(atleta as any) : "—";
            return (
              <Card key={atleta_id} className="border-l-4 border-l-primary/40">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {atleta ? `${atleta.cognome} ${atleta.nome}` : "—"}
                      <span className="ml-2 text-xs text-muted-foreground">{t("level_tests.current_level_prefix")} {display_liv}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {chain_rows.map((step, idx) => {
                      const is_first = idx === 0;
                      return (
                        <div key={step.id} className="grid gap-2 md:grid-cols-[auto_1fr_auto_auto_auto] items-center bg-muted/30 rounded-md px-3 py-2 text-sm">
                          <Badge variant="outline" className="font-mono">#{step.ordine}</Badge>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{step.livello_accesso}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{step.livello_target}</span>
                            {step.disciplina && (
                              <Badge variant="secondary" className="text-[10px]">
                                {step.disciplina === "artistica" ? "ART" : "STI"}
                              </Badge>
                            )}
                          </div>
                          {puo_gestire_sportivo && (step.stato ?? "invitata") === "accettata" ? (
                            <Select
                              value={step.esito}
                              onValueChange={(v) => handle_change_esito(step.id, v as "in_attesa" | "superato" | "non_superato" | "non_sostenuto")}
                            >
                              <SelectTrigger className="w-36 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ESITO_OPTIONS.map((o) => (
                                  <SelectItem
                                    key={o.value}
                                    value={o.value}
                                    disabled={o.value === "non_sostenuto" && is_first}
                                  >
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="w-fit">{ESITO_OPTIONS.find((o) => o.value === step.esito)?.label || step.esito}</Badge>
                          )}
                          {puo_gestire_sportivo ? (
                            <Input
                              className="h-8 text-xs"
                              defaultValue={step.note_istruttore || ""}
                              onBlur={(e) => update_field.mutate({ id: step.id, patch: { note_istruttore: e.target.value } as any })}
                              placeholder={t("level_tests.note_istruttore_placeholder")}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground truncate">{step.note_istruttore || "—"}</span>
                          )}
                          {puo_gestire_sportivo && (
                            <ConfirmButton
                              titolo={t("level_tests.remove_step_confirm_title", { ordine: step.ordine })}
                              descrizione={`${step.livello_accesso} → ${step.livello_target}`}
                              conferma_label={t("level_tests.remove_step_confirm_label")}
                              on_conferma={() => remove_step.mutate(step.id)}
                            >
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </ConfirmButton>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* ─── Convoca Atleta Dialog ─────────────────────────────────── */}
      <Dialog open={show_add} onOpenChange={set_show_add}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("level_tests.convoke_athlete_to", { name: selected_test.nome })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">{t("level_tests.athlete_label")}</label>
              {!add_atleta_id ? (
                <div className="mt-1 border rounded-md overflow-hidden">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={t("level_tests.search_athlete_placeholder")}
                      value={search_atleta}
                      onChange={(e) => set_search_atleta(e.target.value)}
                      className="h-12 pl-9 pr-9 text-base border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {search_atleta && (
                      <button
                        type="button"
                        onClick={() => set_search_atleta("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {atleti_filtrati.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t("level_tests.no_athlete_found")}</p>
                    ) : (
                      atleti_filtrati.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex items-center justify-between border-t border-border/50 first:border-t-0"
                          onClick={() => set_add_atleta_id(a.id)}
                        >
                          <span>{a.cognome} {a.nome}</span>
                          <span className="text-xs text-muted-foreground">{get_livello_gara(a as any)}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between px-3 py-2.5 border rounded-md bg-muted/30">
                  <span className="text-sm font-medium">
                    {(() => {
                      const a = atleti.find((x) => x.id === add_atleta_id);
                      return a ? `${a.cognome} ${a.nome}` : t("level_tests.athlete_selected_default");
                    })()}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { set_add_atleta_id(""); set_search_atleta(""); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {chain.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t("level_tests.chain_label")}</label>
                {chain.map((c, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-[auto_1fr_auto_auto] items-center bg-muted/30 rounded-md px-3 py-2 text-sm">
                    <Badge variant="outline" className="font-mono">#{idx + 1}</Badge>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.accesso}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{c.target}</span>
                    </div>
                    {c.richiede_disciplina ? (
                      <Select
                        value={c.disciplina || "artistica"}
                        onValueChange={(v) => {
                          // Aggiorna disciplina di questo step e propaga ai successivi che la richiedono
                          const next = [...chain];
                          for (let i = idx; i < next.length; i++) {
                            if (next[i].richiede_disciplina) next[i] = { ...next[i], disciplina: v as Disciplina };
                          }
                          set_chain(next);
                        }}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="artistica">{t("level_tests.discipline_artistica")}</SelectItem>
                          <SelectItem value="stile">{t("level_tests.discipline_stile")}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : <div />}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove_chain_step(idx)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {next_for_dialog && (
                  <Button variant="outline" size="sm" onClick={add_chain_step}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> {t("level_tests.add_step_button", { accesso: next_for_dialog.accesso, target: next_for_dialog.target })}
                  </Button>
                )}
              </div>
            )}

            {add_atleta_id && chain.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("level_tests.no_valid_step")}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => set_show_add(false)}>{t("level_tests.cancel")}</Button>
              <Button
                disabled={!add_atleta_id || chain.length === 0 || submit_add_chain.isPending}
                onClick={() => submit_add_chain.mutate()}
              >
                <CheckCircle className="w-4 h-4 mr-1" /> {t("level_tests.convoke")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Elenco iscritte (solo stampa) ─────────────────────────── */}
      {createPortal(
        <div id="elenco-test-print-root" className="hidden">
        <h1 style={{ fontSize: "18pt", fontWeight: 700, marginBottom: "2mm" }}>{selected_test.nome}</h1>
        <p style={{ fontSize: "11pt", marginBottom: "1mm" }}>
          {selected_test.data
            ? new Date(selected_test.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "data da definire"}
          {selected_test.ora ? ` · ${selected_test.ora.slice(0, 5)}` : ""}
          {selected_test.luogo ? ` · ${selected_test.luogo}` : ""}
        </p>
        <p style={{ fontSize: "11pt", marginBottom: "6mm" }}>{(club_corrente as any)?.nome ?? ""}</p>
        {iscritte_stampa.length === 0 ? (
          <p style={{ fontSize: "11pt" }}>Nessuna iscritta confermata.</p>
        ) : iscritte_stampa.map(([livello, righe]) => (
          <div key={livello} style={{ marginBottom: "6mm" }}>
            <h2 style={{ fontSize: "13pt", fontWeight: 700, marginBottom: "2mm" }}>
              {livello} — {righe.length} {righe.length === 1 ? "iscritta" : "iscritte"}
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5pt" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "1.5mm 1mm" }}>Cognome</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "1.5mm 1mm" }}>Nome</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "1.5mm 1mm" }}>Anno</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "1.5mm 1mm" }}>Passaggi</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "1.5mm 1mm", width: "20mm" }}>Presenza</th>
                </tr>
              </thead>
              <tbody>
                {righe.map(({ atleta, passi }) => (
                  <tr key={atleta?.id ?? Math.random()}>
                    <td style={{ borderBottom: "1px solid #999", padding: "2mm 1mm" }}>{atleta?.cognome ?? "—"}</td>
                    <td style={{ borderBottom: "1px solid #999", padding: "2mm 1mm" }}>{atleta?.nome ?? "—"}</td>
                    <td style={{ borderBottom: "1px solid #999", padding: "2mm 1mm" }}>
                      {atleta?.data_nascita ? String(atleta.data_nascita).slice(0, 4) : "—"}
                    </td>
                    <td style={{ borderBottom: "1px solid #999", padding: "2mm 1mm" }}>
                      {passi
                        .map(
                          (s3) =>
                            `${s3.livello_accesso} → ${s3.livello_target}` +
                            (s3.costo_applicato != null ? ` (CHF ${Number(s3.costo_applicato).toFixed(2)})` : ""),
                        )
                        .join("; ") || "—"}
                    </td>
                    <td style={{ borderBottom: "1px solid #999", padding: "2mm 1mm" }}>
                      <span style={{ display: "inline-block", width: "6mm", height: "6mm", border: "1px solid #000" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p style={{ fontSize: "10pt", marginTop: "8mm" }}>
          Totale iscritte: {totale_iscritte} · Totale quote: CHF {totale_quote_stampa.toFixed(2)} · Stampato il{" "}
          {new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
        </div>,
        document.body,
      )}

      {/* ─── Annulla invito Dialog ─────────────────────────────────── */}
      <Dialog open={!!annulla_atleta_id} onOpenChange={(open) => { if (!open) { set_annulla_atleta_id(null); set_annulla_motivo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("level_tests.cancel_invite_title", { defaultValue: "Annulla invito" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("level_tests.cancel_invite_desc", { defaultValue: "L'invito resta nello storico con stato «annullata». Scrivi il motivo:" })}
            </p>
            <Textarea
              value={annulla_motivo}
              onChange={(e) => set_annulla_motivo(e.target.value)}
              placeholder={t("level_tests.cancel_invite_reason_placeholder", { defaultValue: "Motivo dell'annullamento…" })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { set_annulla_atleta_id(null); set_annulla_motivo(""); }}>
                {t("level_tests.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={!annulla_motivo.trim() || annulla_invito.isPending}
                onClick={() => annulla_atleta_id && annulla_invito.mutate({ atleta_id: annulla_atleta_id, motivo: annulla_motivo.trim() })}
              >
                {t("level_tests.cancel_invite_confirm", { defaultValue: "Annulla invito" })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
