import React, { useState, useMemo, useCallback, useRef, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_corsi, use_istruttori, use_stagioni, use_atleti } from "@/hooks/use-supabase-data";
import {
  X, Loader2, ChevronLeft, ChevronRight, Plus, Wrench, Eye, Check,
  ArrowLeft, LayoutGrid, Pencil, Undo2, Mail, Move, AlertTriangle, Calendar, Zap, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import AnnullaCorsoDialog from "@/components/planning/AnnullaCorsoDialog";
import SpostaCorsoDialog from "@/components/planning/SpostaCorsoDialog";
import AvvisaAtletiDialog from "@/components/planning/AvvisaAtletiDialog";

// ── ErrorBoundary ──
class PlanningErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PlanningPage crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-foreground font-bold">Errore nel Planning</p>
          <p className="text-sm text-muted-foreground max-w-md text-center">{this.state.error?.message}</p>
          <button className="text-sm text-primary underline" onClick={() => this.setState({ hasError: false, error: null })}>Riprova</button>
        </div>
      );
    }
    return this.props.children;
  }
}

class SidebarErrorBoundary extends Component<{ children: ReactNode; className: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; className: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Planning sidebar crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div data-sidebar className={this.props.className}>
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-card p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">Errore nella sidebar costruzione</p>
              <Button size="sm" variant="outline" onClick={() => this.setState({ hasError: false })}>
                Riprova
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PlanningPageWrapper() {
  return (
    <PlanningErrorBoundary>
      <PlanningPageInner />
    </PlanningErrorBoundary>
  );
}

// ── Constants ──
const getClubId = () => get_current_club_id();

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const GIORNI_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const OFF_ICE_TYPES = ["danza", "off-ice", "stretching"];
const OFF_ICE_COLORS: Record<string, string> = { danza: "#B83280", "off-ice": "#718096", stretching: "#276749" };
const PPM_FOCUS = 7;
const MESI_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

type ViewMode = 1 | 2 | 3 | 7;

function is_private_type(value?: string | null): boolean {
  return (value ?? "").trim().toLowerCase() === "privata";
}

// ── Date helpers ──
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun,1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekLabel(lunedi: Date): string {
  const dom = addDays(lunedi, 6);
  const d1 = lunedi.getDate();
  const d2 = dom.getDate();
  const m1 = MESI_IT[lunedi.getMonth()];
  const m2 = MESI_IT[dom.getMonth()];
  const y = dom.getFullYear();
  if (lunedi.getMonth() === dom.getMonth()) {
    return `${d1} – ${d2} ${m1} ${y}`;
  }
  return `${d1} ${m1} – ${d2} ${m2} ${y}`;
}

function dayIndexFromDate(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // 0=Mon...6=Sun
}

function time_to_min(t: any): number {
  if (!t || typeof t !== "string") return 0;
  const parts = t.split(":");
  const h = parseInt(parts[0] || "0", 10) || 0;
  const m = parseInt(parts[1] || "0", 10) || 0;
  return h * 60 + m;
}
function min_to_time(m: number): string {
  if (!Number.isFinite(m) || m < 0) m = 0;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function intersect_min(a_start: number, a_end: number, b_start: number, b_end: number): number {
  const s = Math.max(a_start, b_start);
  const e = Math.min(a_end, b_end);
  return e > s ? e - s : 0;
}

type InstructorHours = { disp: number; assegnate: number; libere: number; pct: number };

function calcola_ore_istruttore({
  istruttore,
  disponibilita,
  corsi,
  ice_by_day,
}: {
  istruttore: any;
  disponibilita: any[];
  corsi: any[];
  ice_by_day: Record<string, { s: number; e: number }[]>;
}): InstructorHours {
  if (!disponibilita?.length || !corsi?.length) {
    return { disp: 0, assegnate: 0, libere: 0, pct: 0 };
  }

  let disponibilita_minuti = 0;
  const disponibilita_per_giorno = istruttore?.disponibilita || {};

  GIORNI.forEach((giorno) => {
    const fasce_giornaliere: any[] = disponibilita_per_giorno[giorno] ?? [];
    const ghiaccio_giornaliero = ice_by_day[giorno] ?? [];

    fasce_giornaliere.forEach((fascia: any) => {
      const ds = time_to_min(fascia.ora_inizio);
      const de = time_to_min(fascia.ora_fine);

      ghiaccio_giornaliero.forEach((ice) => {
        disponibilita_minuti += intersect_min(ds, de, ice.s, ice.e);
      });
    });
  });

  let assegnate_minuti = 0;
  corsi.forEach((corso: any) => {
    if ((corso.istruttori_ids ?? []).includes(istruttore.id)) {
      assegnate_minuti += time_to_min(corso.ora_fine) - time_to_min(corso.ora_inizio);
    }
  });

  const disp = disponibilita_minuti / 60;
  const assegnate = assegnate_minuti / 60;
  const libere = Math.max(disp - assegnate, 0);
  const pct = disp > 0 ? (assegnate / disp) * 100 : 0;

  return { disp, assegnate, libere, pct };
}

// ── Data hooks ──
function use_config_ghiaccio() {
  return useQuery({
    queryKey: ["configurazione_ghiaccio", getClubId()],
    queryFn: async () => {
      const { data } = await supabase.from("configurazione_ghiaccio").select("*").eq("club_id", getClubId()).maybeSingle();
      return data;
    },
  });
}

function use_disponibilita_ghiaccio() {
  return useQuery({
    queryKey: ["disponibilita_ghiaccio", getClubId()],
    queryFn: async () => {
      const { data, error } = await supabase.from("disponibilita_ghiaccio").select("*").eq("club_id", getClubId());
      if (error) throw error;
      return data ?? [];
    },
  });
}

function use_disponibilita_istruttori() {
  return useQuery({
    queryKey: ["disponibilita_istruttori", getClubId()],
    queryFn: async () => {
      const { data, error } = await supabase.from("disponibilita_istruttori").select("*").eq("club_id", getClubId());
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Planning settimane hooks ──
function use_planning_settimana(data_lunedi: string, stagione_id: string | null) {
  return useQuery({
    queryKey: ["planning_settimana", getClubId(), data_lunedi, stagione_id],
    enabled: !!getClubId() && !!stagione_id,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      if (!stagione_id) return null;
      const { data, error } = await supabase
        .from("planning_settimane")
        .select("*")
        .eq("club_id", getClubId())
        .eq("data_lunedi", data_lunedi)
        .eq("stagione_id", stagione_id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

function use_planning_corsi(settimana_id: string | null) {
  return useQuery({
    queryKey: ["planning_corsi_settimana", settimana_id],
    enabled: !!settimana_id,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      if (!settimana_id) return [];
      const { data, error } = await supabase
        .from("planning_corsi_settimana")
        .select("*")
        .eq("settimana_id", settimana_id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function use_planning_private(settimana_id: string | null) {
  return useQuery({
    queryKey: ["planning_private_settimana", settimana_id],
    enabled: !!settimana_id,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      if (!settimana_id) return [];
      const { data, error } = await supabase
        .from("planning_private_settimana")
        .select("*")
        .eq("settimana_id", settimana_id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function use_private_lessons_week(data_lunedi: string, enabled: boolean) {
  return useQuery({
    queryKey: ["lezioni_private_settimana", getClubId(), data_lunedi],
    enabled,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const weekEnd = addDays(new Date(`${data_lunedi}T00:00:00`), 6);
      const weekEndISO = formatDateISO(weekEnd);
      const { data, error } = await supabase
        .from("lezioni_private")
        .select("id, data, ora_inizio, ora_fine, istruttore_id")
        .eq("club_id", getClubId())
        .eq("annullata", false)
        .gte("data", data_lunedi)
        .lte("data", weekEndISO);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function use_private_lessons_athletes(lesson_ids: string[]) {
  return useQuery({
    queryKey: ["lezioni_private_atlete_many", [...lesson_ids].sort().join(",")],
    enabled: lesson_ids.length > 0,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lezioni_private_atlete")
        .select("lezione_id, atleta_id")
        .in("lezione_id", lesson_ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function private_lesson_has_ice(lesson: any, ghiaccio_slots: any[]) {
  if (!lesson?.data || !lesson?.ora_inizio || !lesson?.ora_fine) return false;
  const dateObj = new Date(`${lesson.data}T00:00:00`);
  const day = dateObj.getDay();
  const giorno = GIORNI[day === 0 ? 6 : day - 1];
  const start = time_to_min(lesson.ora_inizio);
  const end = time_to_min(lesson.ora_fine);

  return ghiaccio_slots.some((slot: any) =>
    slot.giorno === giorno &&
    (slot.tipo ?? "ghiaccio") === "ghiaccio" &&
    time_to_min(slot.ora_inizio) < end &&
    time_to_min(slot.ora_fine) > start,
  );
}

// ── Livelli ──
const LIVELLI = ["pulcini","stellina1","stellina2","stellina3","stellina4","Interbronzo","Bronzo","Interargento","Argento","Interoro","Oro"];

// ══════════════════════════════════════════════════════════════
// SIDEBAR CARD (reusable for both views)
// ══════════════════════════════════════════════════════════════
function SidebarCard({ corso, istr_map, pick_corso, set_pick_corso }: {
  corso: any; istr_map: Record<string, any>; pick_corso: any; set_pick_corso: (c: any) => void;
}) {
  const istr_ids: string[] = corso.istruttori_ids ?? [];
  const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
  const istr_id_single = corso.istruttore_id;
  const istr_display = first_istr || (istr_id_single ? istr_map[istr_id_single] : null);
  const is_picked = pick_corso?.id === corso.id;
  const is_annullato = corso.annullato === true;
  return (
    <div
      className={`border rounded p-2 bg-card cursor-pointer hover:shadow-md transition-shadow space-y-1 ${is_picked ? "border-primary ring-2 ring-primary/30" : "border-border"} ${is_annullato ? "opacity-50" : ""}`}
      onClick={() => set_pick_corso(is_picked ? null : corso)}
    >
      <div className="flex items-center justify-between">
        <span className={`font-bold text-xs text-foreground block truncate flex-1 ${is_annullato ? "line-through" : ""}`}>{corso.nome}</span>
        {is_annullato && <X className="h-3 w-3 text-destructive flex-shrink-0" />}
        {is_picked && (
          <button onClick={(e) => { e.stopPropagation(); set_pick_corso(null); }} className="text-muted-foreground hover:text-foreground ml-1">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {istr_display && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: istr_display.colore || "#6B7280" }} />
          {istr_display.nome} {istr_display.cognome}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground block">{corso.atleti_ids?.length ?? 0} atleti</span>
    </div>
  );
}

function SidebarCostruzione({
  corsiDaPosizionare,
  istr_map,
  pick_corso,
  set_pick_corso,
  on_new_corso,
  on_new_privata,
  className,
  settimana,
  on_genera,
  on_pubblica,
  generating,
}: {
  corsiDaPosizionare: any[];
  istr_map: Record<string, any>;
  pick_corso: any;
  set_pick_corso: (c: any) => void;
  on_new_corso: () => void;
  on_new_privata: () => void;
  className: string;
  settimana: any | null;
  on_genera: () => void;
  on_pubblica: () => void;
  generating: boolean;
}) {
  return (
    <div data-sidebar className={className}>
      {/* Week actions */}
      {!settimana && (
        <Button size="sm" className="w-full text-xs gap-1.5 mb-2" onClick={on_genera} disabled={generating}>
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          Genera settimana
        </Button>
      )}
      {settimana?.stato === "bozza" && (
        <Button size="sm" variant="outline" className="w-full text-xs gap-1.5 mb-2 border-green-500 text-green-600 hover:bg-green-50" onClick={on_pubblica}>
          <CheckCircle2 className="h-3 w-3" /> Pubblica settimana
        </Button>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-foreground uppercase">Da posizionare ({corsiDaPosizionare.length})</span>
      </div>
      <Button size="sm" variant="outline" className="w-full text-xs" onClick={on_new_corso}>
        <Plus className="h-3 w-3 mr-1" /> Corso/Pacchetto
      </Button>
      <Button size="sm" variant="outline" className="w-full text-xs" onClick={on_new_privata}>
        <Plus className="h-3 w-3 mr-1" /> Lezione privata
      </Button>
      {corsiDaPosizionare.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-xs">
          <Check className="h-5 w-5 mx-auto text-green-500 mb-1" />
          Tutti i corsi posizionati
        </div>
      ) : (
        corsiDaPosizionare.map((corso: any) => (
          <SidebarCard key={corso.id} corso={corso} istr_map={istr_map} pick_corso={pick_corso} set_pick_corso={set_pick_corso} />
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
function PlanningPageInner() {
  const queryClient = useQueryClient();
  const configQuery = use_config_ghiaccio();
  const ghiaccioQuery = use_disponibilita_ghiaccio();
  const dispIstrQuery = use_disponibilita_istruttori();
  const corsiQuery = use_corsi();
  const istruttoriQuery = use_istruttori();
  const stagioniQuery = use_stagioni();
  const atletiQuery = use_atleti();
  // Carica TUTTE le iscrizioni attive del club per calcolare allarmi soft (capienza, sovraccarico istruttore, sotto soglia)
  const iscrizioniAllQuery = useQuery({
    queryKey: ["iscrizioni_corsi_all", getClubId()],
    queryFn: async () => {
      const { data } = await supabase.from("iscrizioni_corsi").select("corso_id, atleta_id, attiva");
      return (data ?? []).filter((i: any) => i.attiva !== false);
    },
  });
  const iscrizioni_all = iscrizioniAllQuery.data ?? [];

  const config = configQuery.data ?? null;
  const ghiaccio_slots = ghiaccioQuery.data ?? [];
  const disp_istr_raw = dispIstrQuery.data ?? [];
  const corsi_raw = corsiQuery.data ?? [];
  const istruttori_raw = istruttoriQuery.data ?? [];
  const stagioni_raw = stagioniQuery.data ?? [];
  const stagione_id = stagioni_raw.find((s: any) => s.attiva)?.id ?? stagioni_raw[0]?.id ?? null;
  const atleti_raw = atletiQuery.data ?? [];
  const loadingGhiaccio = ghiaccioQuery.isLoading;
  const loadingCorsi = corsiQuery.isLoading;
  const loadingIstr = istruttoriQuery.isLoading;

  // ── Week navigation state ──
  const [dataLunedi, setDataLunedi] = useState<Date>(() => getMondayOfWeek(new Date()));
  const dataLunediISO = formatDateISO(dataLunedi);

  // ── Planning settimana data ──
  const settimanaQuery = use_planning_settimana(dataLunediISO, stagione_id);
  const settimana = settimanaQuery.data ?? null;
  const settimana_id = settimana?.id ?? null;
  const planCorsiQuery = use_planning_corsi(settimana_id);
  const planPrivateQuery = use_planning_private(settimana_id);
  const weekPrivateLessonsQuery = use_private_lessons_week(dataLunediISO, !!settimana_id);
  const plan_corsi = planCorsiQuery.data ?? [];
  const plan_private = planPrivateQuery.data ?? [];
  const week_private_lessons = weekPrivateLessonsQuery.data ?? [];
  const private_lesson_ids = useMemo(
    () => Array.from(new Set(plan_private.map((item: any) => item.lezione_privata_id).filter(Boolean))),
    [plan_private],
  );
  const privateLessonAthletesQuery = use_private_lessons_athletes(private_lesson_ids);
  const private_lesson_athletes = privateLessonAthletesQuery.data ?? [];
  const is_generated = !!settimana;

  const [view_mode, set_view_mode] = useState<ViewMode>(7);
  const [day_offset, set_day_offset] = useState(0);
  const [build_mode, set_build_mode] = useState(false);
  const [focus_day, set_focus_day] = useState<string | null>(null);
  const [selected_corso_id, set_selected_corso_id] = useState<string | null>(null);
  const [pick_corso, set_pick_corso] = useState<any>(null);
  const [confirm_place, set_confirm_place] = useState<{ corso: any; giorno: string; ora_inizio: string; ora_fine: string } | null>(null);
  const [slot_manager_open, set_slot_manager_open] = useState(false);
  const [show_new_corso, set_show_new_corso] = useState(false);
  const [show_new_privata, set_show_new_privata] = useState(false);
  const [show_edit_corso, set_show_edit_corso] = useState<any>(null);
  const [annulla_dialog, set_annulla_dialog] = useState<any>(null);
  const [sposta_dialog, set_sposta_dialog] = useState<any>(null);
  const [avvisa_dialog, set_avvisa_dialog] = useState<{
    tipo: "annullamento" | "spostamento";
    planning_corso_id: string;
    contesto: any;
  } | null>(null);
  const [saving, set_saving] = useState(false);
  const [generating, set_generating] = useState(false);

  const loading = loadingGhiaccio || loadingCorsi || loadingIstr;

  const corsi_template = useMemo(() => (corsi_raw ?? []).filter((c: any) => c.attivo !== false && (stagione_id ? c.stagione_id === stagione_id : !c.stagione_id)), [corsi_raw, stagione_id]);
  const corsi_template_non_privati = useMemo(
    () => corsi_template.filter((c: any) => !is_private_type(c.tipo)),
    [corsi_template],
  );
  const corsi_template_non_privati_ids = useMemo(
    () => new Set(corsi_template_non_privati.map((c: any) => c.id)),
    [corsi_template_non_privati],
  );
  const istruttori: any[] = useMemo(() => istruttori_raw ?? [], [istruttori_raw]);
  const atleti: any[] = useMemo(() => atleti_raw ?? [], [atleti_raw]);
  const disp_istr = useMemo(() => disp_istr_raw ?? [], [disp_istr_raw]);
  const slots = useMemo(() => ghiaccio_slots ?? [], [ghiaccio_slots]);
  const private_lesson_meta = useMemo(() => {
    const athlete_ids_by_lesson = new Map<string, string[]>();

    private_lesson_athletes.forEach((row: any) => {
      if (!row?.lezione_id || !row?.atleta_id) return;
      const athlete_ids = athlete_ids_by_lesson.get(row.lezione_id) ?? [];
      if (!athlete_ids.includes(row.atleta_id)) athlete_ids.push(row.atleta_id);
      athlete_ids_by_lesson.set(row.lezione_id, athlete_ids);
    });

    const grouped: Record<string, { atleti_ids: string[]; nome: string }> = {};
    athlete_ids_by_lesson.forEach((athlete_ids, lesson_id) => {
      const athlete_names = athlete_ids
        .map((athlete_id) => {
          const atleta = atleti.find((item: any) => item.id === athlete_id);
          return atleta ? `${atleta.nome} ${atleta.cognome}`.trim() : null;
        })
        .filter(Boolean) as string[];

      grouped[lesson_id] = {
        atleti_ids: athlete_ids,
        nome: athlete_names.length
          ? `${athlete_names.length > 1 ? "Semi" : "Privata"} · ${athlete_names.join(", ")}`
          : "Privata",
      };
    });

    return grouped;
  }, [private_lesson_athletes, atleti]);
  const syncing_private_ids_ref = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!settimana_id || !week_private_lessons.length) return;

    const existing_private_ids = new Set(plan_private.map((item: any) => item.lezione_privata_id));
    const missing_lessons = week_private_lessons.filter((lesson: any) =>
      lesson.id &&
      lesson.data &&
      lesson.ora_inizio &&
      lesson.ora_fine &&
      !existing_private_ids.has(lesson.id) &&
      !syncing_private_ids_ref.current.has(lesson.id) &&
      private_lesson_has_ice(lesson, slots),
    );

    if (!missing_lessons.length) return;

    missing_lessons.forEach((lesson: any) => syncing_private_ids_ref.current.add(lesson.id));
    let cancelled = false;

    (async () => {
      const rows = missing_lessons.map((lesson: any) => ({
        settimana_id,
        lezione_privata_id: lesson.id,
        data: lesson.data,
        ora_inizio: lesson.ora_inizio,
        ora_fine: lesson.ora_fine,
        istruttore_id: lesson.istruttore_id,
        annullato: false,
      }));

      const { error } = await supabase.from("planning_private_settimana").insert(rows);
      if (error) {
        missing_lessons.forEach((lesson: any) => syncing_private_ids_ref.current.delete(lesson.id));
        console.error("Planning private sync error:", error);
        return;
      }

      if (!cancelled) {
        await queryClient.invalidateQueries({ queryKey: ["planning_private_settimana", settimana_id] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settimana_id, week_private_lessons, plan_private, slots, queryClient]);

  // ── Build unified course list for the grid ──
  // When generated: use planning_corsi_settimana rows mapped to display format
  // When template: use corsi_template
  const posizionati = useMemo(() => {
    if (is_generated) {
      // Map planning rows to display format with giorno name
      const corsi_items = plan_corsi
        .map((pc: any) => {
          const template = corsi_template.find((c: any) => c.id === pc.corso_id);
          if (is_private_type(template?.tipo)) return null;
          const dateObj = new Date(pc.data + "T00:00:00");
          const dayIdx = dayIndexFromDate(dateObj);
          return {
            id: pc.id, // use planning row id for operations
            corso_id: pc.corso_id,
            club_id: template?.club_id || getClubId(),
            nome: template?.nome || "?",
            tipo: template?.tipo || "",
            giorno: GIORNI[dayIdx],
            data: pc.data,
            ora_inizio: pc.ora_inizio,
            ora_fine: pc.ora_fine,
            istruttore_id: pc.istruttore_id,
            istruttori_ids: pc.istruttore_id ? [pc.istruttore_id] : (template?.istruttori_ids ?? []),
            atleti_ids: template?.atleti_ids ?? [],
            livello_richiesto: template?.livello_richiesto || "",
            costo_mensile: template?.costo_mensile || 0,
            note: template?.note || "",
            annullato: pc.annullato,
            motivo: pc.motivo,
            sostituisce_id: pc.sostituisce_id ?? null,
            settimana_id: pc.settimana_id,
            _is_plan_row: true,
          };
        })
        .filter((c: any) => c && !c.annullato) as any[];

      // Map private planning rows using the athletes linked to the specific lesson
      const private_items = plan_private.map((pp: any) => {
        const dateObj = new Date(pp.data + "T00:00:00");
        const dayIdx = dayIndexFromDate(dateObj);
        const private_meta = private_lesson_meta[pp.lezione_privata_id];
        return {
          id: pp.id,
          corso_id: pp.lezione_privata_id,
          lezione_privata_id: pp.lezione_privata_id,
          club_id: getClubId(),
          nome: private_meta?.nome || "Privata",
          tipo: "privata",
          giorno: GIORNI[dayIdx],
          data: pp.data,
          ora_inizio: pp.ora_inizio,
          ora_fine: pp.ora_fine,
          istruttore_id: pp.istruttore_id,
          istruttori_ids: pp.istruttore_id ? [pp.istruttore_id] : [],
          atleti_ids: private_meta?.atleti_ids ?? [],
          livello_richiesto: "",
          costo_mensile: 0,
          note: "",
          annullato: pp.annullato,
          motivo: pp.motivo,
          _is_plan_row: true,
        };
      }).filter((c: any) => !c.annullato);

      return [...corsi_items, ...private_items];
    }
    // Template mode: show positioned courses
    return corsi_template.filter((c: any) => c.giorno && c.ora_inizio && c.ora_fine);
  }, [is_generated, plan_corsi, plan_private, corsi_template, private_lesson_meta]);

  // Annullati for display (greyed out)
  const annullati = useMemo(() => {
    if (!is_generated) return [];
    return plan_corsi
      .map((pc: any) => {
        const template = corsi_template.find((c: any) => c.id === pc.corso_id);
        const tipo = (template?.tipo || "").toLowerCase();
        if (!pc.annullato || tipo === "privata") return null;
        const dateObj = new Date(pc.data + "T00:00:00");
        const dayIdx = dayIndexFromDate(dateObj);
        return {
          id: pc.id,
          corso_id: pc.corso_id,
          nome: template?.nome || "?",
          tipo: template?.tipo || "",
          giorno: GIORNI[dayIdx],
          data: pc.data,
          ora_inizio: pc.ora_inizio,
          ora_fine: pc.ora_fine,
          istruttori_ids: pc.istruttore_id ? [pc.istruttore_id] : [],
          annullato: true,
          motivo: pc.motivo,
          sostituisce_id: pc.sostituisce_id ?? null,
          // se esiste un altro record che lo sostituisce → è stato spostato
          sostituito_da: plan_corsi.find((p: any) => p.sostituisce_id === pc.id) || null,
          _is_plan_row: true,
        };
      })
      .filter(Boolean) as any[];
  }, [is_generated, plan_corsi, corsi_template]);

  const corsiDaPosizionare = useMemo(() => {
    return corsi_template.filter((c: any) => !is_private_type(c.tipo) && (!c.giorno || !c.ora_inizio || !c.ora_fine));
  }, [corsi_template]);

  // Instructor map
  const istr_map = useMemo(() => {
    const m: Record<string, any> = {};
    istruttori.forEach((i: any) => {
      m[i.id] = i;
    });
    return m;
  }, [istruttori]);

  // Visible days
  const visible_days = useMemo(() => {
    const start = day_offset;
    return GIORNI.slice(start, Math.min(start + view_mode, 7));
  }, [view_mode, day_offset]);

  // Date for each giorno in current week
  const date_for_giorno = useMemo(() => {
    const map: Record<string, string> = {};
    GIORNI.forEach((g, i) => {
      map[g] = formatDateISO(addDays(dataLunedi, i));
    });
    return map;
  }, [dataLunedi]);

  const set_view = (m: ViewMode) => {
    set_view_mode(m);
    set_day_offset((prev) => Math.min(prev, 7 - m));
  };
  const go_prev_week = () => setDataLunedi(prev => addDays(prev, -7));
  const go_next_week = () => setDataLunedi(prev => addDays(prev, 7));
  const go_today = () => setDataLunedi(getMondayOfWeek(new Date()));
  const go_prev = () => set_day_offset((p) => Math.max(0, p - view_mode));
  const go_next = () => set_day_offset((p) => Math.min(p + view_mode, 7 - view_mode));

  // Time range from data
  const { range_start, range_end } = useMemo(() => {
    let mn = 24 * 60, mx = 0;
    slots.forEach((s: any) => {
      mn = Math.min(mn, time_to_min(s.ora_inizio));
      mx = Math.max(mx, time_to_min(s.ora_fine));
    });
    posizionati.forEach((c: any) => {
      mn = Math.min(mn, time_to_min(c.ora_inizio));
      mx = Math.max(mx, time_to_min(c.ora_fine));
    });
    if (mn >= mx) { mn = 6 * 60; mx = 22 * 60; }
    mn = Math.floor(mn / 60) * 60;
    mx = Math.ceil(mx / 60) * 60;
    return { range_start: mn, range_end: mx };
  }, [slots, posizionati]);

  const total_min = Math.max(range_end - range_start, 1);

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let m = range_start; m <= range_end; m += 60) arr.push(m);
    return arr;
  }, [range_start, range_end]);

  const istr_hours = useMemo(() => {
    const result: Record<string, InstructorHours> = {};
    const ice_by_day: Record<string, { s: number; e: number }[]> = {};
    slots.forEach((sl: any) => {
      if ((sl.tipo ?? "ghiaccio") !== "ghiaccio") return;
      if (!ice_by_day[sl.giorno]) ice_by_day[sl.giorno] = [];
      ice_by_day[sl.giorno].push({ s: time_to_min(sl.ora_inizio), e: time_to_min(sl.ora_fine) });
    });

    istruttori.forEach((ist: any) => {
      result[ist.id] = calcola_ore_istruttore({
        istruttore: ist,
        disponibilita: slots,
        corsi: posizionati,
        ice_by_day,
      });
    });

    return result;
  }, [istruttori, posizionati, slots]);

  // ── Off-ice detection (DB-driven con fallback al tipo) ──
  const is_off_ice = useCallback((c: any) => {
    if (c?.usa_ghiaccio === false) return true;
    if (c?.usa_ghiaccio === true) return false;
    return OFF_ICE_TYPES.includes((c?.tipo || "").toLowerCase());
  }, []);

  // ── Conflitti istruttore: stesso istruttore, stesso giorno, orari sovrapposti ──
  const conflict_ids = useMemo(() => {
    const conflicts = new Set<string>();
    // raggruppa per (istruttore_id, giorno)
    const by_key: Record<string, any[]> = {};
    posizionati.forEach((c: any) => {
      const ids: string[] = c.istruttori_ids ?? [];
      ids.forEach((iid) => {
        if (!iid) return;
        const k = `${iid}__${c.giorno}`;
        if (!by_key[k]) by_key[k] = [];
        by_key[k].push(c);
      });
    });
    Object.values(by_key).forEach((arr) => {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const as = time_to_min(a.ora_inizio), ae = time_to_min(a.ora_fine);
          const bs = time_to_min(b.ora_inizio), be = time_to_min(b.ora_fine);
          if (as < be && bs < ae) {
            conflicts.add(a.id);
            conflicts.add(b.id);
          }
        }
      }
    });
    return conflicts;
  }, [posizionati]);

  // ── Iscritti per corso (per allarmi soft) ──
  const iscritti_per_corso = useMemo(() => {
    const m: Record<string, number> = {};
    iscrizioni_all.forEach((i: any) => { m[i.corso_id] = (m[i.corso_id] ?? 0) + 1; });
    return m;
  }, [iscrizioni_all]);

  // ── Parametri soft (NULL ⇒ allarme disattivato) ──
  const cap_max = config?.max_atleti_contemporanei ?? null;
  const max_per_istr = config?.max_atleti_per_istruttore ?? null;
  const min_iscritti = (config as any)?.min_iscritti_attivazione_corso ?? null;

  // ── Calcolo warnings per ciascun corso posizionato ──
  // Ritorna { hard: string[], soft: string[] } per id corso
  const warnings_by_id = useMemo(() => {
    const out: Record<string, { hard: string[]; soft: string[] }> = {};
    // Indicizza fasce ghiaccio e pulizia per giorno
    const ghiaccio_by_day: Record<string, Array<[number, number]>> = {};
    const pulizia_by_day: Record<string, Array<[number, number]>> = {};
    slots.forEach((s: any) => {
      const r: [number, number] = [time_to_min(s.ora_inizio), time_to_min(s.ora_fine)];
      const d = s.giorno;
      if ((s.tipo ?? "ghiaccio") === "ghiaccio") {
        (ghiaccio_by_day[d] ??= []).push(r);
      } else if (s.tipo === "pulizia") {
        (pulizia_by_day[d] ??= []).push(r);
      }
    });

    posizionati.forEach((c: any) => {
      const w = { hard: [] as string[], soft: [] as string[] };
      const cs = time_to_min(c.ora_inizio);
      const ce = time_to_min(c.ora_fine);
      const off_ice = is_off_ice(c);

      // HARD: solo per corsi su ghiaccio
      if (!off_ice) {
        // Fuori ghiaccio
        const day_ice = ghiaccio_by_day[c.giorno] ?? [];
        // calcola minuti coperti dalle fasce ghiaccio
        let covered = 0;
        day_ice.forEach(([gs, ge]) => {
          const o = Math.max(0, Math.min(ce, ge) - Math.max(cs, gs));
          covered += o;
        });
        const dur = ce - cs;
        if (covered < dur) {
          const fuori = dur - covered;
          w.hard.push(`Fuori ghiaccio (${fuori} min)`);
        }
        // Durante pulizia
        const day_clean = pulizia_by_day[c.giorno] ?? [];
        const overlap_clean = day_clean.some(([ps, pe]) => cs < pe && ps < ce);
        if (overlap_clean) w.hard.push("Durante pulizia");
      }

      // SOFT: sotto soglia iscritti (vale anche off-ice)
      if (min_iscritti != null) {
        const n_isc = iscritti_per_corso[c.corso_id_originale ?? c.id] ?? iscritti_per_corso[c.id] ?? 0;
        if (n_isc < min_iscritti) w.soft.push(`Sotto soglia attivazione (${n_isc}/${min_iscritti})`);
      }
      // SOFT: sovraccarico istruttore (atleti / istruttori)
      if (max_per_istr != null) {
        const n_isc = iscritti_per_corso[c.corso_id_originale ?? c.id] ?? iscritti_per_corso[c.id] ?? 0;
        const n_istr = Math.max(1, (c.istruttori_ids ?? []).length);
        if (n_isc / n_istr > max_per_istr) w.soft.push(`Sovraccarico istruttore (${n_isc}/${n_istr * max_per_istr})`);
      }

      if (w.hard.length || w.soft.length) out[c.id] = w;
    });

    // SOFT: capienza pista (somma iscritti corsi ghiaccio sovrapposti, per giorno)
    if (cap_max != null) {
      const ice_courses = posizionati.filter((c: any) => !is_off_ice(c));
      ice_courses.forEach((c: any) => {
        const cs = time_to_min(c.ora_inizio); const ce = time_to_min(c.ora_fine);
        const overlapping = ice_courses.filter((o: any) =>
          o.giorno === c.giorno && time_to_min(o.ora_inizio) < ce && cs < time_to_min(o.ora_fine)
        );
        const tot_atleti = overlapping.reduce((a: number, o: any) =>
          a + (iscritti_per_corso[o.corso_id_originale ?? o.id] ?? iscritti_per_corso[o.id] ?? 0), 0);
        if (tot_atleti > cap_max) {
          (out[c.id] ??= { hard: [], soft: [] }).soft.push(`Capienza superata (${tot_atleti}/${cap_max})`);
        }
      });
    }

    return out;
  }, [posizionati, slots, iscritti_per_corso, cap_max, max_per_istr, min_iscritti, is_off_ice]);

  const has_warning = useCallback((id: string) => {
    const w = warnings_by_id[id];
    return w ? { hard: w.hard.length > 0, soft: w.soft.length > 0, all: [...w.hard, ...w.soft] } : { hard: false, soft: false, all: [] };
  }, [warnings_by_id]);


  // Selected corso
  const selected_corso = useMemo(() => {
    if (!selected_corso_id) return null;
    return posizionati.find((c: any) => c.id === selected_corso_id) || null;
  }, [selected_corso_id, posizionati]);

  // ── Compute available placement slots per day (for two-click) ──
  const pick_slots_by_day = useMemo(() => {
    if (!pick_corso) return {} as Record<string, { start: number; end: number }[]>;
    const durata = pick_corso.ora_fine && pick_corso.ora_inizio
      ? time_to_min(pick_corso.ora_fine) - time_to_min(pick_corso.ora_inizio)
      : 60;
    const result: Record<string, { start: number; end: number }[]> = {};
    GIORNI.forEach((giorno) => {
      const day_ice = slots.filter((s: any) => s.giorno === giorno && (s.tipo ?? "ghiaccio") === "ghiaccio");
      const day_slots: { start: number; end: number }[] = [];
      day_ice.forEach((s: any) => {
        const gs = time_to_min(s.ora_inizio);
        const ge = time_to_min(s.ora_fine);
        for (let t = gs; t + durata <= ge; t += 5) {
          day_slots.push({ start: t, end: t + durata });
        }
      });
      if (day_slots.length > 0) result[giorno] = day_slots;
    });
    return result;
  }, [pick_corso, slots]);

  // Crea (se serve) la riga planning_settimane per la settimana corrente e ritorna l'id
  const ensure_settimana_id = useCallback(async (): Promise<string | null> => {
    if (settimana_id) return settimana_id;
    if (!stagione_id) {
      toast.error("Nessuna stagione attiva trovata.");
      return null;
    }
    // SELECT prima per evitare duplicati (race / vincoli mancanti)
    const { data: existing, error: sel_err } = await supabase
      .from("planning_settimane")
      .select("id")
      .eq("club_id", getClubId())
      .eq("stagione_id", stagione_id)
      .eq("data_lunedi", dataLunediISO)
      .maybeSingle();
    if (sel_err) {
      toast.error(sel_err.message);
      return null;
    }
    if (existing?.id) return existing.id;
    const { data: ins, error: ins_err } = await supabase
      .from("planning_settimane")
      .insert({
        club_id: getClubId(),
        stagione_id,
        data_lunedi: dataLunediISO,
        stato: "bozza",
      })
      .select("id")
      .maybeSingle();
    if (ins_err) {
      toast.error(ins_err.message);
      return null;
    }
    return ins?.id ?? null;
  }, [settimana_id, stagione_id, dataLunediISO]);

  // ── Refetch helpers ──
  const refetchSettimana = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["planning_settimana", getClubId(), dataLunediISO, stagione_id] });
    queryClient.invalidateQueries({ queryKey: ["planning_corsi_settimana"] });
    queryClient.invalidateQueries({ queryKey: ["planning_private_settimana"] });
  }, [queryClient, dataLunediISO, stagione_id]);

  // ── Genera settimana ──
  const generaSettimana = async () => {
    if (!stagione_id) {
      toast.error("Nessuna stagione attiva trovata.");
      return;
    }

    set_generating(true);
    try {
      // Step 1: Create week row
      const { data: newSett, error: e1 } = await supabase.from("planning_settimane").insert({
        club_id: getClubId(),
        stagione_id: stagione_id,
        data_lunedi: dataLunediISO,
        stato: "bozza",
      }).select().single();
      if (e1) throw e1;

      // Step 2: Find previous week
      const { data: ultimaSett } = await supabase.from("planning_settimane")
        .select("*")
        .eq("club_id", getClubId())
        .eq("stagione_id", stagione_id)
        .lt("data_lunedi", dataLunediISO)
        .order("data_lunedi", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Step 3: Copy courses
      if (ultimaSett) {
        const { data: corsiUltima } = await supabase.from("planning_corsi_settimana")
          .select("*")
          .eq("settimana_id", ultimaSett.id)
          .eq("annullato", false);

        const corsiUltimaNonPrivati = (corsiUltima ?? []).filter((c: any) => corsi_template_non_privati_ids.has(c.corso_id));
        if (corsiUltimaNonPrivati.length) {
          const nuoviCorsi = corsiUltimaNonPrivati.map((c: any) => {
            const dateObj = new Date(c.data + "T00:00:00");
            const giornoDaSett = dayIndexFromDate(dateObj);
            const nuovaData = addDays(dataLunedi, giornoDaSett);
            return {
              settimana_id: newSett.id,
              corso_id: c.corso_id,
              data: formatDateISO(nuovaData),
              ora_inizio: c.ora_inizio,
              ora_fine: c.ora_fine,
              istruttore_id: c.istruttore_id,
            };
          });
          await supabase.from("planning_corsi_settimana").insert(nuoviCorsi);
        }

        // Also copy private from previous week
        const { data: privateUltima } = await supabase.from("planning_private_settimana")
          .select("*")
          .eq("settimana_id", ultimaSett.id)
          .eq("annullato", false);

        if (privateUltima?.length) {
          const nuovePrivate = privateUltima.map((p: any) => {
            const dateObj = new Date(p.data + "T00:00:00");
            const giornoDaSett = dayIndexFromDate(dateObj);
            const nuovaData = addDays(dataLunedi, giornoDaSett);
            return {
              settimana_id: newSett.id,
              lezione_privata_id: p.lezione_privata_id,
              data: formatDateISO(nuovaData),
              ora_inizio: p.ora_inizio,
              ora_fine: p.ora_fine,
              istruttore_id: p.istruttore_id,
            };
          });
          await supabase.from("planning_private_settimana").insert(nuovePrivate);
        }
      } else {
        // First time: use template
          const corsiTemplate = corsi_template_non_privati.filter((c: any) => c.giorno && c.ora_inizio && c.ora_fine);
        if (corsiTemplate.length) {
          const nuoviCorsi = corsiTemplate.map((c: any) => {
            const offset = GIORNI.indexOf(c.giorno as any);
            const data = addDays(dataLunedi, offset >= 0 ? offset : 0);
            const istrId = (c.istruttori_ids ?? [])[0] || null;
            return {
              settimana_id: newSett.id,
              corso_id: c.id,
              data: formatDateISO(data),
              ora_inizio: c.ora_inizio,
              ora_fine: c.ora_fine,
              istruttore_id: istrId,
            };
          });
          await supabase.from("planning_corsi_settimana").insert(nuoviCorsi);
        }
      }

      // Step 4: Add ALL private lessons with dates in this week (not just recurring)
      const weekEnd = addDays(dataLunedi, 6);
      const weekEndISO = formatDateISO(weekEnd);
      const { data: privateInWeek } = await supabase.from("lezioni_private")
        .select("*")
        .eq("club_id", getClubId())
        .eq("annullata", false)
        .gte("data", dataLunediISO)
        .lte("data", weekEndISO);

      // Also add recurring private lessons that fall on this week's days
      const { data: privateRicorrenti } = await supabase.from("lezioni_private")
        .select("*")
        .eq("club_id", getClubId())
        .eq("ricorrente", true)
        .or(`data_revoca.is.null,data_revoca.gt.${dataLunediISO}`);

      // Merge: use Set to avoid duplicates by id
      const allPrivate = new Map<string, any>();
      (privateInWeek ?? []).forEach((p: any) => allPrivate.set(p.id, p));
      (privateRicorrenti ?? []).forEach((p: any) => {
        if (!allPrivate.has(p.id)) allPrivate.set(p.id, p);
      });

      const privateToInsert = Array.from(allPrivate.values())
        .filter((p: any) => p.data && p.ora_inizio && p.ora_fine)
        .map((p: any) => {
          const dateObj = new Date(p.data + "T00:00:00");
          const giornoOrig = dayIndexFromDate(dateObj);
          const isInWeek = privateInWeek?.some((pw: any) => pw.id === p.id);
          // For non-recurring lessons already in the week, use their actual date
          const finalData = isInWeek ? p.data : formatDateISO(addDays(dataLunedi, giornoOrig));
          return {
            settimana_id: newSett.id,
            lezione_privata_id: p.id,
            data: finalData,
            ora_inizio: p.ora_inizio,
            ora_fine: p.ora_fine,
            istruttore_id: p.istruttore_id,
          };
        });
      if (privateToInsert.length) {
        await supabase.from("planning_private_settimana").insert(privateToInsert);
      }

      // Step 5: Update copiata_da if from previous
      if (ultimaSett) {
        await supabase.from("planning_settimane").update({ copiata_da: ultimaSett.id }).eq("id", newSett.id);
      }

      refetchSettimana();
      toast.success("Settimana generata!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      set_generating(false);
    }
  };

  // ── Pubblica settimana ──
  const pubblicaSettimana = async () => {
    if (!settimana) return;
    try {
      const { error } = await supabase.from("planning_settimane").update({ stato: "pubblicata" }).eq("id", settimana.id);
      if (error) throw error;
      refetchSettimana();
      toast.success("Settimana pubblicata!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Actions ──
  const place_corso = async (corso: any, giorno: string, ora_inizio: string, ora_fine: string) => {
    if (is_generated && settimana) {
      // In generated mode: insert into planning_corsi_settimana
      set_saving(true);
      try {
        const data_giorno = date_for_giorno[giorno];
        const istrId = (corso.istruttori_ids ?? [])[0] || null;
        const { error } = await supabase.from("planning_corsi_settimana").insert({
          settimana_id: settimana.id,
          corso_id: corso.corso_id || corso.id,
          data: data_giorno,
          ora_inizio,
          ora_fine,
          istruttore_id: istrId,
        });
        if (error) throw error;
        refetchSettimana();
        toast.success(`${corso.nome} posizionato`);
        set_pick_corso(null);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        set_saving(false);
      }
      return;
    }

    // Template mode (original logic)
    const day_corsi = posizionati.filter((c: any) => c.giorno === giorno && c.id !== corso.id);
    const cs = time_to_min(ora_inizio);
    const ce = time_to_min(ora_fine);
    const conflicts = day_corsi.filter((c: any) => {
      const istr_ids: string[] = c.istruttori_ids ?? [];
      const corso_istr: string[] = corso.istruttori_ids ?? [];
      const same_istr = istr_ids.some((id) => corso_istr.includes(id));
      if (!same_istr) return false;
      const s = time_to_min(c.ora_inizio);
      const e = time_to_min(c.ora_fine);
      return s < ce && e > cs;
    });
    if (conflicts.length > 0) {
      const names = conflicts.map((c: any) => c.nome).join(", ");
      if (!window.confirm(`Conflitto con: ${names}. Continuare comunque?`)) return;
    }
    set_saving(true);
    try {
      const { error } = await supabase.from("corsi").update({ giorno, ora_inizio, ora_fine }).eq("id", corso.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["corsi"] });
      toast.success(`${corso.nome} posizionato`);
      set_pick_corso(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      set_saving(false);
    }
  };

  const remove_corso = async (corso: any) => {
    set_saving(true);
    try {
      if (corso._is_plan_row) {
        const is_private = (corso.tipo || "").toLowerCase() === "privata";
        if (is_private) {
          const table = corso.lezione_privata_id ? "planning_private_settimana" : "planning_corsi_settimana";
          const { error } = await supabase.from(table).delete().eq("id", corso.id);
          if (error) throw error;
          refetchSettimana();
          toast.info(`${corso.nome} rimossa dalla settimana`);
        } else {
          const { error } = await supabase.from("planning_corsi_settimana").update({ annullato: true }).eq("id", corso.id);
          if (error) throw error;
          refetchSettimana();
          toast.info(`${corso.nome} annullato`);
        }
      } else {
        const { error } = await supabase.from("corsi").update({
          giorno: null as any, ora_inizio: null as any, ora_fine: null as any,
        }).eq("id", corso.id);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["corsi"] });
        toast.info(`${corso.nome} rimosso dal planning`);
      }
      set_selected_corso_id(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      set_saving(false);
    }
  };

  // ── Confirmation dialog handler ──
  const handle_confirm_place = () => {
    if (!confirm_place) return;
    place_corso(confirm_place.corso, confirm_place.giorno, confirm_place.ora_inizio, confirm_place.ora_fine);
    set_confirm_place(null);
  };

  // ── Loading ──
  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // ══════════════════════════════════════════════════════════
  // FOCUS DAY (fullscreen overlay)
  // ══════════════════════════════════════════════════════════
  if (focus_day) {
    const day_ghiaccio = slots.filter((s: any) => s.giorno === focus_day && (s.tipo ?? "ghiaccio") === "ghiaccio");
    const day_pulizia = slots.filter((s: any) => s.giorno === focus_day && s.tipo === "pulizia");
    const day_corsi_ice = posizionati.filter((c: any) => c.giorno === focus_day && !is_off_ice(c));
    const day_corsi_off = posizionati.filter((c: any) => c.giorno === focus_day && is_off_ice(c));
    const day_annullati = annullati.filter((c: any) => c.giorno === focus_day);
    const day_ice_min = day_ghiaccio.reduce((a: number, s: any) => a + time_to_min(s.ora_fine) - time_to_min(s.ora_inizio), 0);

    let f_start = 24 * 60, f_end = 0;
    [...day_ghiaccio, ...day_pulizia].forEach((s: any) => {
      f_start = Math.min(f_start, time_to_min(s.ora_inizio));
      f_end = Math.max(f_end, time_to_min(s.ora_fine));
    });
    [...day_corsi_ice, ...day_corsi_off].forEach((c: any) => {
      f_start = Math.min(f_start, time_to_min(c.ora_inizio));
      f_end = Math.max(f_end, time_to_min(c.ora_fine));
    });
    if (f_start >= f_end) { f_start = 6 * 60; f_end = 22 * 60; }
    f_start = Math.floor(f_start / 60) * 60;
    f_end = Math.ceil(f_end / 60) * 60;
    const f_total = f_end - f_start;
    const grid_w = f_total * PPM_FOCUS;

    const compute_rows = (courses: any[]): any[][] => {
      if (!courses.length) return [];
      const sorted = [...courses].sort((a, b) => time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio));
      const rows: any[][] = [];
      sorted.forEach((c) => {
        const cs = time_to_min(c.ora_inizio);
        let placed = false;
        for (const row of rows) {
          if (time_to_min(row[row.length - 1].ora_fine) <= cs) { row.push(c); placed = true; break; }
        }
        if (!placed) rows.push([c]);
      });
      return rows;
    };

    const course_rows = compute_rows(day_corsi_ice);
    const ROW_H = 48;

    const f_ticks: number[] = [];
    for (let m = f_start; m <= f_end; m += 60) f_ticks.push(m);

    const sel = selected_corso;
    const focus_pick_slots = pick_corso ? (pick_slots_by_day[focus_day] ?? []) : [];
    const focus_date = date_for_giorno[focus_day] || "";

    return (
      <TooltipProvider delayDuration={200}>
        <div className="fixed inset-0 z-50 bg-background flex flex-col" onClick={(e) => {
          if (pick_corso && !(e.target as HTMLElement).closest('[data-grid]') && !(e.target as HTMLElement).closest('[data-sidebar]')) {
            set_pick_corso(null);
          }
        }}>

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
            <Button variant="ghost" size="sm" onClick={() => { set_focus_day(null); set_selected_corso_id(null); set_pick_corso(null); set_slot_manager_open(false); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Settimana
            </Button>
            <h2 className="text-lg font-bold text-foreground flex-1">
              {focus_day} {focus_date && <span className="text-sm font-normal text-muted-foreground ml-1">{focus_date}</span>}
            </h2>
            {settimana && (
              <Badge variant={settimana.stato === "pubblicata" ? "default" : "secondary"} className={`text-xs ${settimana.stato === "pubblicata" ? "bg-green-600" : ""}`}>
                {settimana.stato === "pubblicata" ? "PUBBLICATA" : "BOZZA"}
              </Badge>
            )}
            {pick_corso && <Badge variant="outline" className="border-primary text-primary text-xs">Selezionato: {pick_corso.nome}</Badge>}
            <span className="text-sm text-muted-foreground">{(day_ice_min / 60).toFixed(1)}h ghiaccio</span>
            {build_mode && (
              <Button size="sm" variant="outline" onClick={() => set_slot_manager_open(!slot_manager_open)}>
                <LayoutGrid className="h-4 w-4 mr-1" /> Slot ghiaccio
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar left - build mode backlog */}
            {build_mode && (
              <SidebarErrorBoundary className="w-[280px] flex-shrink-0 border-r border-border overflow-y-auto p-3 space-y-2 bg-muted/30">
                <SidebarCostruzione
                  className="w-[280px] flex-shrink-0 border-r border-border overflow-y-auto p-3 space-y-2 bg-muted/30"
                  corsiDaPosizionare={corsiDaPosizionare}
                  istr_map={istr_map}
                  pick_corso={pick_corso}
                  set_pick_corso={set_pick_corso}
                  on_new_corso={() => set_show_new_corso(true)}
                  on_new_privata={() => set_show_new_privata(true)}
                  settimana={settimana}
                  on_genera={generaSettimana}
                  on_pubblica={pubblicaSettimana}
                  generating={generating}
                />
              </SidebarErrorBoundary>
            )}

            {/* Main grid */}
            <div className="flex-1 overflow-auto p-4" data-grid>
              <div className="relative" style={{ width: grid_w, minHeight: (course_rows.length || 1) * ROW_H + 60 }}>
                {/* Hour lines */}
                {f_ticks.map((t) => (
                  <div key={t} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: (t - f_start) * PPM_FOCUS }}>
                    <span className="absolute -top-5 -translate-x-1/2 text-[10px] text-muted-foreground">{min_to_time(t)}</span>
                  </div>
                ))}

                {/* Background: default grey */}
                <div className="absolute inset-0" style={{ background: "#f5f4f0", borderRadius: 6 }} />

                {/* Ghiaccio slots background */}
                {day_ghiaccio.map((g: any, i: number) => (
                  <div key={`g${i}`} className="absolute" style={{
                    left: (time_to_min(g.ora_inizio) - f_start) * PPM_FOCUS,
                    width: (time_to_min(g.ora_fine) - time_to_min(g.ora_inizio)) * PPM_FOCUS,
                    top: 0, bottom: 0, background: "#EEEDFE", borderRadius: 6,
                  }} />
                ))}

                {/* Pulizia slots */}
                {day_pulizia.map((p: any, i: number) => (
                  <div key={`p${i}`} className="absolute z-[1]" style={{
                    left: (time_to_min(p.ora_inizio) - f_start) * PPM_FOCUS,
                    width: (time_to_min(p.ora_fine) - time_to_min(p.ora_inizio)) * PPM_FOCUS,
                    top: 4, bottom: 4,
                    backgroundColor: "#f0ede6",
                    backgroundImage: "radial-gradient(#8a8780 1.2px, transparent 1.6px)",
                    backgroundSize: "7px 7px",
                    borderRadius: 4, border: "1px solid #b0ada4",
                  }} />
                ))}

                {/* Two-click: green available slots */}
                {pick_corso && focus_pick_slots.map((ps, i) => (
                  <div
                    key={`pick${i}`}
                    className="absolute z-[5] cursor-pointer hover:opacity-80"
                    style={{
                      left: (ps.start - f_start) * PPM_FOCUS,
                      width: (ps.end - ps.start) * PPM_FOCUS,
                      top: 4, bottom: 4,
                      background: "rgba(72,187,120,0.25)",
                      border: "2px dashed #48BB78",
                      borderRadius: 4,
                    }}
                    onClick={() => set_confirm_place({ corso: pick_corso, giorno: focus_day!, ora_inizio: min_to_time(ps.start), ora_fine: min_to_time(ps.end) })}
                  >
                    <span className="text-[10px] font-bold text-green-700 px-1">{min_to_time(ps.start)}</span>
                  </div>
                ))}

                {/* Course blocks */}
                {course_rows.map((row, ri) =>
                  row.map((c: any) => {
                    const cs = time_to_min(c.ora_inizio);
                    const ce = time_to_min(c.ora_fine);
                    const istr_ids: string[] = c.istruttori_ids ?? [];
                    const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                    const colore = first_istr?.colore || "#3B82F6";
                    const w_px = (ce - cs) * PPM_FOCUS;
                    const is_private = (c.tipo || "").toLowerCase() === "privata";
                    const is_selected = selected_corso_id === c.id;
                    const is_conflict = conflict_ids.has(c.id);

                    // Private slots need more height to fit labels without overlap
                    const slot_h = is_private ? Math.max(ROW_H - 4, 52) : ROW_H - 12;

                    return (
                      <Tooltip key={c.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute z-[3] rounded flex flex-col justify-center overflow-hidden cursor-pointer ${is_selected ? "ring-2 ring-primary" : ""} ${is_conflict ? "animate-pulse" : ""}`}
                            style={{
                              left: (cs - f_start) * PPM_FOCUS,
                              width: w_px,
                              top: ri * ROW_H + 8,
                              height: slot_h,
                              background: is_private
                                ? `repeating-linear-gradient(-45deg, ${colore} 0px, ${colore} 3px, transparent 3px, transparent 8px)`
                                : colore,
                              border: is_conflict
                                ? "2px solid #DC2626"
                                : (is_private ? `2px dashed ${colore}` : `1px solid rgba(0,0,0,0.15)`),
                              borderRadius: 4,
                              color: "#fff",
                              boxShadow: is_conflict ? "0 0 0 2px rgba(220,38,38,0.35)" : undefined,
                            }}
                            onClick={() => set_selected_corso_id(c.id)}
                          >
                            {is_conflict && (
                              <AlertTriangle className="absolute top-0.5 right-0.5 h-3 w-3 text-white drop-shadow" style={{ filter: "drop-shadow(0 0 1px #DC2626)" }} />
                            )}
                            {is_private ? (
                              <div className="flex flex-col gap-0 px-1 py-0.5 overflow-hidden">
                                <span className="truncate rounded text-[11px] font-bold leading-tight" style={{ background: "rgba(255,255,255,0.92)", color: "#1a1a1a", padding: "1px 4px", position: "relative", zIndex: 1 }}>
                                  {c.nome}
                                </span>
                                {w_px > 70 && first_istr && (
                                  <span className="truncate rounded text-[10px] font-medium leading-tight" style={{ background: "rgba(255,255,255,0.92)", color: "#1a1a1a", padding: "1px 4px", position: "relative", zIndex: 1, marginTop: 1 }}>
                                    {first_istr.nome} {first_istr.cognome}
                                  </span>
                                )}
                                {w_px > 90 && c.livello_richiesto && (
                                  <span className="truncate rounded text-[9px] font-medium leading-tight" style={{ background: "rgba(255,255,255,0.92)", color: "#555", padding: "1px 4px", position: "relative", zIndex: 1, marginTop: 1 }}>
                                    {c.livello_richiesto}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <>
                                <span className="truncate px-1 leading-tight font-bold" style={{ fontSize: 12, color: "#fff" }}>{c.nome}</span>
                                {w_px > 70 && first_istr && (
                                  <span className="truncate px-1 leading-tight" style={{ fontSize: 10, opacity: 0.85, color: "#fff" }}>{first_istr.nome} {first_istr.cognome}</span>
                                )}
                                {w_px > 90 && c.livello_richiesto && (
                                  <span className="truncate px-1" style={{ fontSize: 9, opacity: 0.7, color: "#fff" }}>{c.livello_richiesto}</span>
                                )}
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="font-bold">{c.nome}</p>
                          {first_istr && <p className="text-xs">{first_istr.nome} {first_istr.cognome}</p>}
                          <p className="text-xs">{c.ora_inizio?.slice(0, 5)} – {c.ora_fine?.slice(0, 5)}</p>
                          {is_conflict && (
                            <p className="text-xs font-bold mt-1" style={{ color: "#DC2626" }}>⚠ Conflitto istruttore</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })
                )}

                {/* Annullati (greyed out with strikethrough) */}
                {day_annullati.map((c: any) => {
                  const cs = time_to_min(c.ora_inizio);
                  const ce = time_to_min(c.ora_fine);
                  return (
                    <Tooltip key={`ann-${c.id}`}>
                      <TooltipTrigger asChild>
                        <div className="absolute z-[2] rounded flex items-center px-1 overflow-hidden" style={{
                          left: (cs - f_start) * PPM_FOCUS,
                          width: (ce - cs) * PPM_FOCUS,
                          top: (course_rows.length) * ROW_H + 8,
                          height: 20,
                          background: "#e5e5e5",
                          border: "1px solid #ccc",
                          borderRadius: 4,
                        }}>
                          <X className="h-3 w-3 text-muted-foreground mr-1 flex-shrink-0" />
                          <span className="truncate text-[10px] text-muted-foreground line-through">{c.nome}</span>
                          {c.sostituito_da && (
                            <span className="ml-1 text-[9px] text-primary font-bold flex-shrink-0">↔ spostato</span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="line-through">{c.nome} (annullato)</p>
                        {c.motivo && <p className="text-xs">Motivo: {c.motivo}</p>}
                        {c.sostituito_da && <p className="text-xs text-primary">Spostato a {c.sostituito_da.data} {c.sostituito_da.ora_inizio?.slice(0,5)}</p>}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Off-ice section (separata dalla timeline ghiaccio) */}
                {day_corsi_off.length > 0 && (
                  <div className="absolute left-0 right-0" style={{ top: (course_rows.length || 1) * ROW_H + (day_annullati.length > 0 ? 34 : 4), height: 22 }}>
                    <div className="absolute inset-0" style={{
                      background: "#F3F4F6",
                      border: "1px dashed #9CA3AF",
                      borderRadius: 4,
                    }} />
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-wider px-1 rounded" style={{ background: "#9CA3AF", color: "#fff", zIndex: 2 }}>OFF-ICE</span>
                    {day_corsi_off.map((c: any) => {
                      const cs = time_to_min(c.ora_inizio);
                      const ce = time_to_min(c.ora_fine);
                      const istr_ids: string[] = c.istruttori_ids ?? [];
                      const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                      const colore = first_istr?.colore || OFF_ICE_COLORS[(c.tipo || "").toLowerCase()] || "#94A3B8";
                      const is_conflict = conflict_ids.has(c.id);
                      return (
                        <Tooltip key={c.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-1 bottom-1 rounded-sm cursor-pointer flex items-center px-1 overflow-hidden ${is_conflict ? "animate-pulse" : ""}`}
                              style={{
                                left: (cs - f_start) * PPM_FOCUS,
                                width: (ce - cs) * PPM_FOCUS,
                                background: colore,
                                border: is_conflict ? "2px solid #DC2626" : "none",
                                boxShadow: is_conflict ? "0 0 0 2px rgba(220,38,38,0.35)" : undefined,
                              }}
                              onClick={() => set_selected_corso_id(c.id)}
                            >
                              {is_conflict && <AlertTriangle className="h-2.5 w-2.5 text-white mr-1 flex-shrink-0" />}
                              <span className="truncate text-[10px] font-semibold" style={{ color: "#fff" }}>{c.nome}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-bold">{c.nome}</p>
                            {first_istr && <p className="text-xs">{first_istr.nome} {first_istr.cognome}</p>}
                            <p className="text-xs">Off-ice · {c.ora_inizio?.slice(0,5)}–{c.ora_fine?.slice(0,5)}</p>
                            {is_conflict && <p className="text-xs font-bold mt-1" style={{ color: "#DC2626" }}>⚠ Conflitto istruttore</p>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Detail panel right */}
            {sel && !slot_manager_open && (
              <DetailPanel
                corso={sel}
                istr_map={istr_map}
                atleti={atleti}
                build_mode={build_mode}
                on_close={() => set_selected_corso_id(null)}
                on_remove={() => remove_corso(sel)}
                on_edit={() => { set_show_edit_corso(sel); }}
                on_annulla_settimana={sel?._is_plan_row ? async () => {
                  const sid = await ensure_settimana_id();
                  if (!sid) return;
                  set_annulla_dialog({ ...sel, settimana_id: sid });
                } : undefined}
                on_sposta={sel?._is_plan_row ? () => set_sposta_dialog(sel) : undefined}
              />
            )}

            {/* Slot manager right */}
            {slot_manager_open && focus_day && (
              <SlotManagerPanel
                giorno={focus_day}
                slots={slots.filter((s: any) => s.giorno === focus_day)}
                istruttori={istruttori}
                disp_istr={disp_istr}
                on_close={() => set_slot_manager_open(false)}
                queryClient={queryClient}
              />
            )}
          </div>
        </div>

        {/* Modals */}
        {show_new_corso && (
          <NewCorsoModal open={show_new_corso} on_close={() => set_show_new_corso(false)} istruttori={istruttori} queryClient={queryClient} tipo="corso" stagione_id={stagione_id} />
        )}
        {show_new_privata && (
          <NewCorsoModal open={show_new_privata} on_close={() => set_show_new_privata(false)} istruttori={istruttori} queryClient={queryClient} tipo="privata" atleti={atleti} />
        )}
        {show_edit_corso && (
          <EditCorsoModal corso={show_edit_corso} on_close={() => set_show_edit_corso(null)} istruttori={istruttori} queryClient={queryClient} posizionati={posizionati} />
        )}

        {/* Confirmation dialog */}
        <ConfirmPlaceDialog confirm={confirm_place} saving={saving} on_confirm={handle_confirm_place} on_cancel={() => set_confirm_place(null)} />

        {annulla_dialog && (
          <AnnullaCorsoDialog
            open={!!annulla_dialog} on_close={() => set_annulla_dialog(null)}
            planning_corso_id={annulla_dialog.id} corso_nome={annulla_dialog.nome}
            corso_id_originale={annulla_dialog.corso_id || annulla_dialog.id}
            settimana_id={annulla_dialog.settimana_id || settimana?.id}
            ora_inizio_orig={annulla_dialog.ora_inizio} ora_fine_orig={annulla_dialog.ora_fine}
            istruttore_id={annulla_dialog.istruttore_id ?? (annulla_dialog.istruttori_ids?.[0] ?? null)}
            giorno={annulla_dialog.giorno} data={annulla_dialog.data}
            ora_inizio={annulla_dialog.ora_inizio} ora_fine={annulla_dialog.ora_fine}
            on_done={(pid, motivo) => { refetchSettimana(); set_selected_corso_id(null);
              set_avvisa_dialog({ tipo: "annullamento", planning_corso_id: pid,
                contesto: { corso_nome: annulla_dialog.nome, giorno: annulla_dialog.giorno, data: annulla_dialog.data, ora_inizio: annulla_dialog.ora_inizio, ora_fine: annulla_dialog.ora_fine, motivo } }); }}
          />
        )}
        {sposta_dialog && settimana && (
          <SpostaCorsoDialog
            open={!!sposta_dialog} on_close={() => set_sposta_dialog(null)}
            planning_corso={{ id: sposta_dialog.id, corso_id: sposta_dialog.corso_id, settimana_id: sposta_dialog.settimana_id || settimana.id, data: sposta_dialog.data, ora_inizio: sposta_dialog.ora_inizio, ora_fine: sposta_dialog.ora_fine, istruttore_id: sposta_dialog.istruttore_id, nome: sposta_dialog.nome }}
            data_lunedi={dataLunediISO} istruttori={istruttori} ghiaccio_slots={slots}
            on_done={(_n, original_id, new_data, new_ora) => { refetchSettimana(); set_selected_corso_id(null);
              set_avvisa_dialog({ tipo: "spostamento", planning_corso_id: original_id,
                contesto: { corso_nome: sposta_dialog.nome, giorno_originale: sposta_dialog.giorno, data_originale: sposta_dialog.data, ora_originale: sposta_dialog.ora_inizio, nuovo_giorno: GIORNI[dayIndexFromDate(new Date(new_data + "T00:00:00"))], nuova_data: new_data, nuova_ora: new_ora } }); }}
          />
        )}
        {avvisa_dialog && (
          <AvvisaAtletiDialog open={!!avvisa_dialog} on_close={() => set_avvisa_dialog(null)} tipo={avvisa_dialog.tipo} planning_corso_id={avvisa_dialog.planning_corso_id} contesto={avvisa_dialog.contesto} />
        )}

      </TooltipProvider>
    );
  }

  // ══════════════════════════════════════════════════════════
  // AGGREGATED VIEW (week / multi-day)
  // ══════════════════════════════════════════════════════════
  const view_label = visible_days.length === 1 ? visible_days[0] : `${visible_days[0]} — ${visible_days[visible_days.length - 1]}`;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 space-y-4" onClick={(e) => {
        if (pick_corso && !(e.target as HTMLElement).closest('[data-grid]') && !(e.target as HTMLElement).closest('[data-sidebar]')) {
          set_pick_corso(null);
        }
      }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-foreground">Planning Ghiaccio</h1>
          <div className="flex items-center gap-2">
            {settimana && (
              <Badge variant={settimana.stato === "pubblicata" ? "default" : "secondary"} className={`text-xs ${settimana.stato === "pubblicata" ? "bg-green-600" : ""}`}>
                {settimana.stato === "pubblicata" ? "PUBBLICATA" : "BOZZA"}
              </Badge>
            )}
            {pick_corso && <Badge variant="outline" className="border-primary text-primary text-xs">Selezionato: {pick_corso.nome}</Badge>}
            <Button size="sm" variant={build_mode ? "default" : "outline"} onClick={() => { set_build_mode(!build_mode); set_pick_corso(null); }} className="gap-1.5">
              {build_mode ? <><Eye className="h-4 w-4" /> Visualizzazione</> : <><Wrench className="h-4 w-4" /> Costruzione</>}
            </Button>
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={go_prev_week}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-semibold text-foreground min-w-[220px] text-center">{formatWeekLabel(dataLunedi)}</span>
            <Button variant="outline" size="sm" onClick={go_next_week}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={go_today} className="text-xs"><Calendar className="h-3.5 w-3.5 mr-1" />Oggi</Button>
          </div>
          <div className="inline-flex rounded-lg border border-border overflow-hidden ml-auto">
            {([1, 2, 3, 7] as ViewMode[]).map((m, idx) => (
              <button key={m} onClick={() => set_view(m)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${view_mode === m ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"} ${idx > 0 ? "border-l border-border" : ""}`}
              >
                {m === 1 ? "1g" : m === 2 ? "2g" : m === 3 ? "3g" : "7g"}
              </button>
            ))}
          </div>
          {view_mode < 7 && (
            <div className="inline-flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={go_prev} disabled={day_offset === 0}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium text-foreground min-w-[80px] text-center">{view_label}</span>
              <Button variant="outline" size="sm" onClick={go_next} disabled={day_offset + view_mode >= 7}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>

        {/* Template banner */}
        {!is_generated && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2.5 text-sm text-yellow-800 dark:text-yellow-200">
            <span>📋</span>
            <span><strong>Template</strong> — questa settimana non è ancora stata generata. {build_mode ? "Clicca 'Genera settimana' nella sidebar per crearla." : "Attiva la modalità Costruzione per generarla."}</span>
          </div>
        )}

        {/* Instructor legend with hour bars */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Istruttori</p>
          <div className="flex flex-wrap gap-2">
            {istruttori.map((ist: any) => {
              const h = istr_hours[ist.id] || { disp: 0, assegnate: 0, libere: 0, pct: 0 };
              const pct = h.pct;
              const bar_color = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#22C55E";
              return (
                <Tooltip key={ist.id}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
                      style={{ borderColor: ist.colore || "#6B7280", backgroundColor: `${ist.colore || "#6B7280"}15`, color: ist.colore || "#6B7280" }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ist.colore || "#6B7280" }} />
                      {ist.nome}
                      <span className="relative w-8 h-2 rounded-full bg-muted overflow-hidden">
                        <span className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: bar_color }} />
                      </span>
                      <span className="text-[10px]">{h.assegnate.toFixed(1)}h/{h.disp.toFixed(1)}h</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Disponibile: {h.disp.toFixed(1)}h</p>
                    <p>Assegnato: {h.assegnate.toFixed(1)}h</p>
                    <p>Libero: {h.libere.toFixed(1)}h</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Legend badges */}
        <div className="flex flex-wrap gap-2 text-xs items-center">
          <Tooltip><TooltipTrigger asChild><span className="px-2 py-0.5 rounded font-medium cursor-help" style={{ background: "#EEEDFE", color: "#7F77DD", border: "1px solid #AFA9EC" }}>Ghiaccio</span></TooltipTrigger><TooltipContent>Ghiaccio disponibile</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><span className="px-2 py-0.5 rounded font-medium cursor-help" style={{ backgroundColor: "#f0ede6", backgroundImage: "radial-gradient(#8a8780 1.2px, transparent 1.6px)", backgroundSize: "7px 7px", border: "1px solid #b0ada4" }}>Pulizia</span></TooltipTrigger><TooltipContent>Pulizia ghiaccio (pattern a puntini)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><span className="px-2 py-0.5 rounded font-medium cursor-help" style={{ background: "#F5F4F0", border: "1px solid #9CA3AF" }}>Off-ice</span></TooltipTrigger><TooltipContent>Sotto-fascia inferiore di ogni giorno (corsi fuori ghiaccio)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><span className="px-2 py-0.5 rounded font-medium cursor-help" style={{ background: "repeating-linear-gradient(-45deg, #6B7280 0px, #6B7280 3px, transparent 3px, transparent 8px)", border: "1px dashed #6B7280" }}>Privata</span></TooltipTrigger><TooltipContent>Lezione privata (pattern diagonale, colore istruttore)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><span className="px-2 py-0.5 rounded font-medium cursor-help" style={{ background: "#fff", border: "2px solid #DC2626" }}>⚠ Conflitto</span></TooltipTrigger><TooltipContent>Istruttore impegnato su due attività in sovrapposizione</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><span className="px-2 py-0.5 rounded font-medium cursor-help inline-flex items-center gap-1" style={{ border: "2px solid #DC2626", color: "#DC2626" }}><AlertTriangle className="h-3 w-3" />Conflitto</span></TooltipTrigger><TooltipContent>Stesso istruttore in due attività sovrapposte</TooltipContent></Tooltip>
        </div>

        {/* Main content: sidebar + grid */}
        <div className="flex gap-0">
          {/* Build mode sidebar */}
          {build_mode && (
            <SidebarErrorBoundary className="w-[280px] flex-shrink-0 border border-border rounded-lg overflow-y-auto p-3 space-y-2 bg-muted/30 mr-3">
              <SidebarCostruzione
                className="w-[280px] flex-shrink-0 border border-border rounded-lg overflow-y-auto p-3 space-y-2 bg-muted/30 mr-3"
                corsiDaPosizionare={corsiDaPosizionare}
                istr_map={istr_map}
                pick_corso={pick_corso}
                set_pick_corso={set_pick_corso}
                on_new_corso={() => set_show_new_corso(true)}
                on_new_privata={() => set_show_new_privata(true)}
                settimana={settimana}
                on_genera={generaSettimana}
                on_pubblica={pubblicaSettimana}
                generating={generating}
              />
            </SidebarErrorBoundary>
          )}

        {/* Grid */}
        <div className={`flex-1 border border-border rounded-lg overflow-x-auto ${is_generated ? "bg-card" : "bg-muted/40"}`} data-grid>
          {/* Time header */}
          <div className="flex border-b border-border sticky top-0 bg-card z-10">
            <div className="flex-shrink-0 border-r border-border" style={{ width: 100 }} />
            <div className="flex-1 relative" style={{ minWidth: total_min * 1.2 }}>
              {ticks.map((t) => (
                <span key={t} className="absolute text-[10px] text-muted-foreground top-0 -translate-x-1/2"
                  style={{ left: `${((t - range_start) / total_min) * 100}%` }}>{min_to_time(t)}</span>
              ))}
              <div className="h-5" />
            </div>
          </div>

          {/* Day rows */}
          {visible_days.map((giorno) => {
            const day_ghiaccio = slots.filter((s: any) => s.giorno === giorno && (s.tipo ?? "ghiaccio") === "ghiaccio");
            const day_pulizia = slots.filter((s: any) => s.giorno === giorno && s.tipo === "pulizia");
            const day_corsi_ice = posizionati.filter((c: any) => c.giorno === giorno && !is_off_ice(c));
            const day_corsi_off = posizionati.filter((c: any) => c.giorno === giorno && is_off_ice(c));
            const day_annullati_list = annullati.filter((c: any) => c.giorno === giorno);
            const day_pick = pick_corso ? (pick_slots_by_day[giorno] ?? []) : [];
            const giorno_idx = GIORNI.indexOf(giorno as any);
            const giorno_date_obj = addDays(dataLunedi, giorno_idx);
            const giorno_day_num = giorno_date_obj.getDate();

            // Lane packing
            const compute_rows = (courses: any[]): any[][] => {
              if (!courses.length) return [[]];
              const sorted = [...courses].sort((a, b) => time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio));
              const rows: any[][] = [];
              sorted.forEach((c) => {
                const cs = time_to_min(c.ora_inizio);
                let placed = false;
                for (const row of rows) {
                  if (time_to_min(row[row.length - 1].ora_fine) <= cs) { row.push(c); placed = true; break; }
                }
                if (!placed) rows.push([c]);
              });
              return rows.length > 0 ? rows : [[]];
            };
            const ice_course_rows = compute_rows(day_corsi_ice);
            const n_ice_rows = Math.max(ice_course_rows.length, 1);
            const ice_h = n_ice_rows * 26 + 12 + (day_pick.length > 0 ? 10 : 0) + (day_annullati_list.length > 0 ? 22 : 0);

            const off_course_rows = compute_rows(day_corsi_off);
            const has_off = day_corsi_off.length > 0;
            const n_off_rows = has_off ? off_course_rows.length : 0;
            const off_h = has_off ? (n_off_rows * 26 + 12) : 14;

            const day_h = ice_h + off_h + 1;

            const day_ice_ranges = day_ghiaccio.map((g: any) => ({
              start: time_to_min(g.ora_inizio),
              end: time_to_min(g.ora_fine),
            }));

            return (
              <div key={giorno} className="border-b-2 border-border last:border-b-0 cursor-pointer hover:bg-muted/20"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-green-slot]')) return;
                  set_focus_day(giorno);
                }}>
                <div className="flex">
                  {/* Day label spans both sub-rows */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center border-r border-border bg-muted px-2"
                    style={{ width: 100, minHeight: day_h }}>
                    <span className="text-xs font-bold text-foreground">{GIORNI_SHORT[giorno_idx]}</span>
                    <span className="text-[10px] text-muted-foreground">{giorno_day_num}</span>
                  </div>

                  {/* Stack: ICE on top, OFF-ICE below */}
                  <div className="flex-1 flex flex-col" style={{ minWidth: total_min * 1.2 }}>
                    {/* ─── SUB-ROW: GHIACCIO ─── */}
                    <div className="relative" style={{ height: ice_h }}>
                      <div className="absolute inset-0" style={{ background: is_generated ? "transparent" : "#f5f4f0" }} />

                      {day_ghiaccio.map((g: any, gi: number) => {
                        const gs = time_to_min(g.ora_inizio); const ge = time_to_min(g.ora_fine);
                        return <div key={`g${gi}`} className="absolute" style={{
                          left: `${((gs - range_start) / total_min) * 100}%`, width: `${((ge - gs) / total_min) * 100}%`,
                          top: 0, bottom: 0, background: "#EEEDFE",
                        }} />;
                      })}

                      {day_pulizia.map((p: any, pi: number) => {
                        const ps_start = time_to_min(p.ora_inizio); const pe = time_to_min(p.ora_fine);
                        return <div key={`p${pi}`} className="absolute" style={{
                          left: `${((ps_start - range_start) / total_min) * 100}%`, width: `${((pe - ps_start) / total_min) * 100}%`,
                          top: 0, bottom: 0,
                          backgroundColor: "#f0ede6",
                          backgroundImage: "radial-gradient(#8a8780 1.2px, transparent 1.6px)",
                          backgroundSize: "7px 7px",
                        }} />;
                      })}

                      {pick_corso && day_ice_ranges.map((range, ri) => (
                        <div
                          key={`green${ri}`}
                          data-green-slot
                          className="absolute z-[4] cursor-pointer"
                          style={{
                            left: `${((range.start - range_start) / total_min) * 100}%`,
                            width: `${((range.end - range.start) / total_min) * 100}%`,
                            top: 0, bottom: 0,
                            background: "rgba(72,187,120,0.18)",
                            border: "2px dashed #48BB78",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            set_focus_day(giorno);
                          }}
                        />
                      ))}

                      {ice_course_rows.map((row, ri) =>
                        row.map((c: any) => {
                          const cs = time_to_min(c.ora_inizio); const ce = time_to_min(c.ora_fine);
                          const istr_ids: string[] = c.istruttori_ids ?? [];
                          const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                          const colore = first_istr?.colore || "#3B82F6";
                          const is_private = (c.tipo || "").toLowerCase() === "privata";
                          const is_conflict = conflict_ids.has(c.id);
                          const w = has_warning(c.id);
                          // Outline "sandwich" bianco+colore+bianco — visibile su qualsiasi sfondo
                          const alarm_color = (w.hard || is_conflict) ? "#DC2626" : (w.soft ? "#CA8A04" : null);
                          const alarm_short = w.hard || is_conflict ? (is_conflict ? "Conflitto" : (warnings_by_id[c.id]?.hard[0] ?? "Allarme").split(" (")[0]) : (w.soft ? (warnings_by_id[c.id]?.soft[0] ?? "Attenzione").split(" (")[0] : null);
                          const sandwich_shadow = alarm_color
                            ? `inset 0 0 0 1px #fff, 0 0 0 2px ${alarm_color}, 0 0 0 3px #fff`
                            : (is_private ? `inset 0 0 0 1px ${colore}` : undefined);
                          const pulse = is_conflict || w.hard;
                          const livello = c.livello_richiesto && c.livello_richiesto !== "tutti" ? c.livello_richiesto : null;
                          return (
                            <Tooltip key={c.id}>
                              <TooltipTrigger asChild>
                                <div className={`absolute z-[3] rounded-sm overflow-hidden ${pulse ? "animate-pulse" : ""} flex items-center px-1`} style={{
                                  left: `${((cs - range_start) / total_min) * 100}%`,
                                  width: `${((ce - cs) / total_min) * 100}%`,
                                  top: 6 + ri * 26,
                                  height: 22,
                                  background: is_private
                                    ? `repeating-linear-gradient(-45deg, ${colore} 0px, ${colore} 3px, transparent 3px, transparent 8px)`
                                    : colore,
                                  boxShadow: sandwich_shadow,
                                  color: "#fff",
                                  fontSize: 9,
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  gap: 3,
                                }}>
                                  {alarm_color && (
                                    <span style={{ background: "#000", color: "#fff", borderRadius: 2, width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0, border: `1px solid ${alarm_color}` }}>⚠</span>
                                  )}
                                  <span className="truncate">{c.nome}{livello ? ` · ${livello}` : ""}{first_istr ? ` · ${first_istr.cognome}` : ""}</span>
                                  {alarm_color && alarm_short && (
                                    <span style={{ background: "#000", color: alarm_color === "#DC2626" ? "#FCA5A5" : "#FDE68A", padding: "1px 4px", borderRadius: 2, fontSize: 8, marginLeft: "auto", flexShrink: 0, fontWeight: 700, letterSpacing: 0.2, border: `1px solid ${alarm_color}` }}>
                                      {alarm_short.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-bold">{c.nome}</p>
                                {first_istr && <p className="text-xs">{first_istr.nome} {first_istr.cognome}</p>}
                                <p className="text-xs">{c.ora_inizio?.slice(0, 5)} – {c.ora_fine?.slice(0, 5)}</p>
                                {is_conflict && <p className="text-xs font-bold mt-1" style={{ color: "#DC2626" }}>⚠ Conflitto istruttore (anche su Off-Ice)</p>}
                                {w.all.map((msg, i) => (
                                  <p key={i} className="text-xs font-semibold mt-0.5" style={{ color: w.hard && i < (warnings_by_id[c.id]?.hard.length ?? 0) ? "#DC2626" : "#CA8A04" }}>⚠ {msg}</p>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })
                      )}

                      {day_annullati_list.map((c: any, ai: number) => {
                        const cs = time_to_min(c.ora_inizio); const ce = time_to_min(c.ora_fine);
                        return (
                          <Tooltip key={`ann-${c.id}`}>
                            <TooltipTrigger asChild>
                              <div className="absolute z-[2] rounded-sm" style={{
                                left: `${((cs - range_start) / total_min) * 100}%`,
                                width: `${((ce - cs) / total_min) * 100}%`,
                                top: 6 + n_ice_rows * 26 + ai * 22,
                                height: 18,
                                background: "#e0e0e0",
                                border: "1px solid #bbb",
                                opacity: 0.6,
                              }} />
                            </TooltipTrigger>
                            <TooltipContent><p className="line-through">{c.nome} (annullato)</p></TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>

                    {/* Inner separator */}
                    <div style={{ height: 1, background: "hsl(var(--border))" }} />

                    {/* ─── SUB-ROW: OFF-ICE ─── */}
                    <div className="relative" style={{ height: off_h, background: "#F5F4F0" }}>
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold tracking-wider px-1 rounded z-[1]"
                        style={{ background: "#9CA3AF", color: "#fff" }}>OFF-ICE</span>

                      {!has_off && (
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] italic text-muted-foreground">
                          — nessun off-ice —
                        </span>
                      )}

                      {has_off && off_course_rows.map((row, ri) =>
                        row.map((c: any) => {
                          const cs = time_to_min(c.ora_inizio); const ce = time_to_min(c.ora_fine);
                          const istr_ids: string[] = c.istruttori_ids ?? [];
                          const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                          const colore = first_istr?.colore || OFF_ICE_COLORS[(c.tipo || "").toLowerCase()] || "#94A3B8";
                          const is_conflict = conflict_ids.has(c.id);
                          const w = has_warning(c.id);
                          const alarm_color = (w.hard || is_conflict) ? "#DC2626" : (w.soft ? "#CA8A04" : null);
                          const alarm_short = w.hard || is_conflict ? (is_conflict ? "Conflitto" : (warnings_by_id[c.id]?.hard[0] ?? "Allarme").split(" (")[0]) : (w.soft ? (warnings_by_id[c.id]?.soft[0] ?? "Attenzione").split(" (")[0] : null);
                          const sandwich_shadow = alarm_color ? `inset 0 0 0 1px #fff, 0 0 0 2px ${alarm_color}, 0 0 0 3px #fff` : undefined;
                          const pulse = is_conflict || w.hard;
                          return (
                            <Tooltip key={c.id}>
                              <TooltipTrigger asChild>
                                <div className={`absolute z-[3] rounded-sm overflow-hidden ${pulse ? "animate-pulse" : ""} flex items-center px-1`} style={{
                                  left: `${((cs - range_start) / total_min) * 100}%`,
                                  width: `${((ce - cs) / total_min) * 100}%`,
                                  top: 6 + ri * 26,
                                  height: 22,
                                  background: colore,
                                  boxShadow: sandwich_shadow,
                                  color: "#fff",
                                  fontSize: 9,
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  gap: 3,
                                }}>
                                  {alarm_color && (
                                    <span style={{ background: "#000", color: "#fff", borderRadius: 2, width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0, border: `1px solid ${alarm_color}` }}>⚠</span>
                                  )}
                                  <span className="truncate">{c.nome}{first_istr ? ` · ${first_istr.cognome}` : ""}</span>
                                  {alarm_color && alarm_short && (
                                    <span style={{ background: "#000", color: alarm_color === "#DC2626" ? "#FCA5A5" : "#FDE68A", padding: "1px 4px", borderRadius: 2, fontSize: 8, marginLeft: "auto", flexShrink: 0, fontWeight: 700, letterSpacing: 0.2, border: `1px solid ${alarm_color}` }}>
                                      {alarm_short.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-bold">{c.nome} <span className="text-[10px] font-normal opacity-70">(OFF-ICE)</span></p>
                                {first_istr && <p className="text-xs">{first_istr.nome} {first_istr.cognome}</p>}
                                <p className="text-xs">{c.ora_inizio?.slice(0, 5)} – {c.ora_fine?.slice(0, 5)}</p>
                                {is_conflict && <p className="text-xs font-bold mt-1" style={{ color: "#DC2626" }}>⚠ Conflitto istruttore (anche su Ghiaccio)</p>}
                                {w.all.map((msg, i) => (
                                  <p key={i} className="text-xs font-semibold mt-0.5" style={{ color: w.hard && i < (warnings_by_id[c.id]?.hard.length ?? 0) ? "#DC2626" : "#CA8A04" }}>⚠ {msg}</p>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Modals */}
        {show_new_corso && (
          <NewCorsoModal open={show_new_corso} on_close={() => set_show_new_corso(false)} istruttori={istruttori} queryClient={queryClient} tipo="corso" stagione_id={stagione_id} />
        )}
        {show_new_privata && (
          <NewCorsoModal open={show_new_privata} on_close={() => set_show_new_privata(false)} istruttori={istruttori} queryClient={queryClient} tipo="privata" atleti={atleti} />
        )}
        {show_edit_corso && (
          <EditCorsoModal corso={show_edit_corso} on_close={() => set_show_edit_corso(null)} istruttori={istruttori} queryClient={queryClient} posizionati={posizionati} />
        )}

        {/* Confirmation dialog */}
        <ConfirmPlaceDialog confirm={confirm_place} saving={saving} on_confirm={handle_confirm_place} on_cancel={() => set_confirm_place(null)} />

        {annulla_dialog && (
          <AnnullaCorsoDialog
            open={!!annulla_dialog} on_close={() => set_annulla_dialog(null)}
            planning_corso_id={annulla_dialog.id} corso_nome={annulla_dialog.nome}
            corso_id_originale={annulla_dialog.corso_id || annulla_dialog.id}
            settimana_id={annulla_dialog.settimana_id || settimana?.id}
            ora_inizio_orig={annulla_dialog.ora_inizio} ora_fine_orig={annulla_dialog.ora_fine}
            istruttore_id={annulla_dialog.istruttore_id ?? (annulla_dialog.istruttori_ids?.[0] ?? null)}
            giorno={annulla_dialog.giorno} data={annulla_dialog.data}
            ora_inizio={annulla_dialog.ora_inizio} ora_fine={annulla_dialog.ora_fine}
            on_done={(pid, motivo) => { refetchSettimana(); set_selected_corso_id(null);
              set_avvisa_dialog({ tipo: "annullamento", planning_corso_id: pid,
                contesto: { corso_nome: annulla_dialog.nome, giorno: annulla_dialog.giorno, data: annulla_dialog.data, ora_inizio: annulla_dialog.ora_inizio, ora_fine: annulla_dialog.ora_fine, motivo } }); }}
          />
        )}
        {sposta_dialog && settimana && (
          <SpostaCorsoDialog
            open={!!sposta_dialog} on_close={() => set_sposta_dialog(null)}
            planning_corso={{ id: sposta_dialog.id, corso_id: sposta_dialog.corso_id, settimana_id: sposta_dialog.settimana_id || settimana.id, data: sposta_dialog.data, ora_inizio: sposta_dialog.ora_inizio, ora_fine: sposta_dialog.ora_fine, istruttore_id: sposta_dialog.istruttore_id, nome: sposta_dialog.nome }}
            data_lunedi={dataLunediISO} istruttori={istruttori} ghiaccio_slots={slots}
            on_done={(_n, original_id, new_data, new_ora) => { refetchSettimana(); set_selected_corso_id(null);
              set_avvisa_dialog({ tipo: "spostamento", planning_corso_id: original_id,
                contesto: { corso_nome: sposta_dialog.nome, giorno: sposta_dialog.giorno, data: sposta_dialog.data, ora_inizio: sposta_dialog.ora_inizio, ora_fine: sposta_dialog.ora_fine, nuova_data: new_data, nuova_ora: new_ora } }); }}
          />
        )}
        {avvisa_dialog && (
          <AvvisaAtletiDialog open={!!avvisa_dialog} on_close={() => set_avvisa_dialog(null)}
            tipo={avvisa_dialog.tipo} planning_corso_id={avvisa_dialog.planning_corso_id} contesto={avvisa_dialog.contesto} />
        )}
      </div>
    </TooltipProvider>
  );
}

// ══════════════════════════════════════════════════════════════
// CONFIRM PLACEMENT DIALOG
// ══════════════════════════════════════════════════════════════
function ConfirmPlaceDialog({ confirm, saving, on_confirm, on_cancel }: {
  confirm: { corso: any; giorno: string; ora_inizio: string; ora_fine: string } | null;
  saving: boolean; on_confirm: () => void; on_cancel: () => void;
}) {
  if (!confirm) return null;
  return (
    <Dialog open={!!confirm} onOpenChange={(o) => !o && on_cancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Conferma posizionamento</DialogTitle>
          <DialogDescription>
            Posizionare <strong>{confirm.corso.nome}</strong> il <strong>{confirm.giorno}</strong> dalle <strong>{confirm.ora_inizio}</strong> alle <strong>{confirm.ora_fine}</strong>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={on_cancel}>Annulla</Button>
          <Button onClick={on_confirm} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Conferma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// DETAIL PANEL
// ══════════════════════════════════════════════════════════════
function DetailPanel({ corso, istr_map, atleti, build_mode, on_close, on_remove, on_edit, on_annulla_settimana, on_sposta }: {
  corso: any; istr_map: Record<string, any>; atleti: any[]; build_mode: boolean;
  on_close: () => void; on_remove: () => void; on_edit: () => void;
  on_annulla_settimana?: () => void; on_sposta?: () => void;
}) {
  const is_private = (corso.tipo || "").toLowerCase() === "privata";
  const corso_id_for_query = corso.corso_id || corso.id;

  // Standard course enrollments
  const { data: iscrizioni } = useQuery({
    queryKey: ["iscrizioni_corsi", corso_id_for_query],
    queryFn: async () => {
      const { data } = await supabase.from("iscrizioni_corsi").select("*").eq("corso_id", corso_id_for_query).eq("attiva", true);
      return data ?? [];
    },
    enabled: !is_private,
  });

  // Private lesson athletes – direct lookup by lezione_privata_id, with fallback
  const lezione_privata_id_direct = corso.lezione_privata_id || null;
  const club_id_for_query = corso.club_id || null;

  // Fallback: find lezione_privata by extracting athlete names from corso.nome
  // and searching lezioni_private_atlete by atleta_id
  const { data: resolved_lezione } = useQuery({
    queryKey: ["resolve_lezione_privata_v2", corso_id_for_query, corso.nome],
    queryFn: async () => {
      const nome = corso.nome || "";
      // Extract athlete names from corso name like "Privata · Sofia Bernasconi" or "Semi · Name1, Name2"
      const after_dot = nome.includes("·") ? nome.split("·")[1]?.trim() : "";
      if (!after_dot) return null;
      const athlete_names = after_dot.split(",").map((n: string) => n.trim()).filter(Boolean);
      if (athlete_names.length === 0) return null;

      // Find matching atleti by first name
      const matched_atleti = athlete_names.map((an: string) => {
        const first_name = an.split(" ")[0];
        return atleti.find((a: any) =>
          a.nome === first_name || `${a.nome} ${a.cognome}` === an
        );
      }).filter(Boolean);

      if (matched_atleti.length === 0) return null;

      // Search lezioni_private_atlete for the first matched athlete
      const { data: lpa } = await supabase
        .from("lezioni_private_atlete")
        .select("lezione_id")
        .eq("atleta_id", matched_atleti[0].id);
      if (!lpa || lpa.length === 0) return null;
      if (lpa.length === 1) return lpa[0].lezione_id;

      // Multiple matches: verify which lezione has ALL the athletes
      for (const row of lpa) {
        const { data: all_atl } = await supabase
          .from("lezioni_private_atlete")
          .select("atleta_id")
          .eq("lezione_id", row.lezione_id);
        if (all_atl && all_atl.length === matched_atleti.length) {
          const ids = all_atl.map((a: any) => a.atleta_id);
          if (matched_atleti.every((ma: any) => ids.includes(ma.id))) {
            return row.lezione_id;
          }
        }
      }
      return lpa[0].lezione_id;
    },
    enabled: is_private && !lezione_privata_id_direct,
  });

  const lezione_privata_id = lezione_privata_id_direct || resolved_lezione || null;

  const { data: private_atlete } = useQuery({
    queryKey: ["lezioni_private_atlete_detail", lezione_privata_id],
    queryFn: async () => {
      if (!lezione_privata_id) return [];
      const { data } = await supabase
        .from("lezioni_private_atlete")
        .select("*")
        .eq("lezione_id", lezione_privata_id);
      return data ?? [];
    },
    enabled: is_private && !!lezione_privata_id,
  });

  const istr_ids: string[] = corso.istruttori_ids ?? [];
  const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;

  const enrolled = useMemo(() => {
    if (is_private) {
      if (!private_atlete) return [];
      return private_atlete.map((pa: any) => {
        const a = atleti.find((at: any) => at.id === pa.atleta_id);
        return a ? { id: pa.atleta_id, nome: `${a.nome} ${a.cognome}` } : { id: pa.atleta_id, nome: "?" };
      });
    }
    if (!iscrizioni) return [];
    return iscrizioni.map((i: any) => {
      const a = atleti.find((at: any) => at.id === i.atleta_id);
      return a ? { id: a.id, nome: `${a.nome} ${a.cognome}` } : { id: i.atleta_id, nome: "?" };
    });
  }, [is_private, iscrizioni, private_atlete, atleti]);

  return (
    <div className="w-[260px] flex-shrink-0 border-l border-border overflow-y-auto p-4 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-foreground text-sm truncate">{corso.nome}</span>
        <button onClick={on_close} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {corso.tipo && <p>Tipo: <span className="text-foreground font-medium">{corso.tipo}</span></p>}
        <p>{corso.giorno} · {corso.ora_inizio?.slice(0, 5)} – {corso.ora_fine?.slice(0, 5)}</p>
        <p>Durata: {corso.ora_inizio && corso.ora_fine ? time_to_min(corso.ora_fine) - time_to_min(corso.ora_inizio) : "?"} min</p>
        {first_istr && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: first_istr.colore || "#6B7280" }} />
            <span className="text-foreground font-medium">{first_istr.nome} {first_istr.cognome}</span>
          </div>
        )}
        {corso.costo_mensile > 0 && <p>Costo mensile: CHF {corso.costo_mensile}</p>}
        {corso.note && <p className="italic">{corso.note}</p>}
      </div>

      {/* Enrolled */}
      <div>
        <p className="text-xs font-bold text-foreground mb-1">{is_private ? "Atlete" : "Iscritti"} ({enrolled.length})</p>
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {enrolled.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5 text-xs text-foreground">
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">{a.nome.charAt(0)}</div>
              {a.nome}
            </div>
          ))}
        </div>
      </div>

      {/* Eccezioni di settimana — solo per planning rows non-private */}
      {corso._is_plan_row && !is_private && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground">Eccezioni questa settimana</p>
          {on_annulla_settimana && (
            <Button size="sm" variant="outline" className="w-full justify-start text-xs gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={on_annulla_settimana}>
              <Undo2 className="h-3 w-3" /> Annulla questo corso
            </Button>
          )}
          {on_sposta && (
            <Button size="sm" variant="outline" className="w-full justify-start text-xs gap-1.5" onClick={on_sposta}>
              <Move className="h-3 w-3" /> Sposta in altro giorno/ora
            </Button>
          )}
          {corso.sostituisce_id && (
            <p className="text-[10px] italic text-muted-foreground pt-1">↔ Spostato dal giorno originale</p>
          )}
        </div>
      )}

      {/* Actions */}
      {build_mode && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <Button size="sm" variant="outline" className="w-full justify-start text-xs gap-1.5" onClick={on_edit}>
            <Pencil className="h-3 w-3" /> Modifica
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start text-xs gap-1.5 text-destructive" onClick={on_remove}>
            <Undo2 className="h-3 w-3" /> {corso._is_plan_row ? "Annulla dalla settimana" : "Rimuovi dalla griglia"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SLOT MANAGER PANEL
// ══════════════════════════════════════════════════════════════
function SlotManagerPanel({ giorno, slots, istruttori, disp_istr, on_close, queryClient }: {
  giorno: string; slots: any[]; istruttori: any[]; disp_istr: any[];
  on_close: () => void; queryClient: any;
}) {
  const [new_tipo, set_new_tipo] = useState("ghiaccio");
  const [new_start, set_new_start] = useState("08:00");
  const [new_end, set_new_end] = useState("09:00");
  const [saving, set_saving] = useState(false);

  const add_slot = async () => {
    set_saving(true);
    try {
      const { error } = await supabase.from("disponibilita_ghiaccio").insert({
        club_id: getClubId(), giorno, tipo: new_tipo, ora_inizio: new_start, ora_fine: new_end,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["disponibilita_ghiaccio"] });
      toast.success("Slot aggiunto");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      set_saving(false);
    }
  };

  const delete_slot = async (id: string) => {
    const { error } = await supabase.from("disponibilita_ghiaccio").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      await queryClient.invalidateQueries({ queryKey: ["disponibilita_ghiaccio"] });
      toast.info("Slot eliminato");
    }
  };

  const day_istr = istruttori.map((ist: any) => {
    const d = (ist.disponibilita || {})[giorno] ?? [];
    const tot = d.reduce((a: number, s: any) => a + time_to_min(s.ora_fine) - time_to_min(s.ora_inizio), 0);
    return { ...ist, fasce: d, ore: tot / 60 };
  }).filter((x) => x.fasce.length > 0);

  return (
    <div className="w-[260px] flex-shrink-0 border-l border-border overflow-y-auto p-4 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-foreground text-sm">Slot Ghiaccio</span>
        <button onClick={on_close} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* Existing slots */}
      <div className="space-y-1">
        {slots.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
            <span className="font-medium">{s.tipo === "pulizia" ? "🧹" : "❄️"} {s.ora_inizio?.slice(0, 5)} – {s.ora_fine?.slice(0, 5)}</span>
            <button onClick={() => delete_slot(s.id)} className="text-destructive hover:text-destructive/80"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Select value={new_tipo} onValueChange={set_new_tipo}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ghiaccio">Ghiaccio</SelectItem>
            <SelectItem value="pulizia">Pulizia</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="time" value={new_start} onChange={(e) => set_new_start(e.target.value)} className="h-8 text-xs" />
          <Input type="time" value={new_end} onChange={(e) => set_new_end(e.target.value)} className="h-8 text-xs" />
        </div>
        <Button size="sm" className="w-full text-xs" onClick={add_slot} disabled={saving}>
          <Plus className="h-3 w-3 mr-1" /> Aggiungi
        </Button>
      </div>

      {/* Instructor availability */}
      <div className="pt-2 border-t border-border space-y-2">
        <p className="text-xs font-bold text-foreground">Disponibilità istruttori</p>
        {day_istr.map((ist) => (
          <div key={ist.id} className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ist.colore || "#6B7280" }} />
              <span className="font-medium text-foreground">{ist.nome} {ist.cognome}</span>
              <span className="text-muted-foreground ml-auto">{ist.ore.toFixed(1)}h</span>
            </div>
            {ist.fasce.map((f: any, fi: number) => (
              <span key={fi} className="text-[10px] text-muted-foreground block pl-3.5">
                {f.ora_inizio?.slice(0, 5)} – {f.ora_fine?.slice(0, 5)}
              </span>
            ))}
          </div>
        ))}
        {day_istr.length === 0 && <p className="text-xs text-muted-foreground italic">Nessun istruttore disponibile</p>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// NEW CORSO MODAL
// ══════════════════════════════════════════════════════════════
function AtletaSearchPlanning({ atleti, selected_ids, on_change, max }: {
  atleti: any[]; selected_ids: string[]; on_change: (ids: string[]) => void; max?: number;
}) {
  const [query, set_query] = useState("");
  const [open_dd, set_open_dd] = useState(false);
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return (atleti ?? []).slice(0, 12);
    return (atleti ?? []).filter((a: any) => `${a.nome} ${a.cognome}`.toLowerCase().includes(q)).slice(0, 12);
  }, [atleti, query]);

  const toggle = (id: string) => {
    if (selected_ids.includes(id)) {
      on_change(selected_ids.filter((i) => i !== id));
    } else {
      if (max && selected_ids.length >= max) return;
      on_change([...selected_ids, id]);
    }
  };

  return (
    <div className="relative">
      <div className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm flex items-center gap-2 cursor-text min-h-[38px]" onClick={() => set_open_dd(true)}>
        <input className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground" placeholder="Cerca atleta..." value={query}
          onChange={(e) => { set_query(e.target.value); set_open_dd(true); }} onFocus={() => set_open_dd(true)} />
      </div>
      {open_dd && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { set_open_dd(false); set_query(""); }} />
          <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2">Nessun atleta</p>
            ) : filtered.map((a: any) => {
              const sel = selected_ids.includes(a.id);
              const disabled_max = !sel && max != null && selected_ids.length >= max;
              return (
                <div key={a.id} onClick={() => !disabled_max && toggle(a.id)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors
                    ${sel ? "bg-primary/10 text-primary" : disabled_max ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50 text-foreground"}`}>
                  <span>{a.nome} {a.cognome}</span>
                  {sel && <Check className="w-4 h-4" />}
                </div>
              );
            })}
          </div>
        </>
      )}
      {selected_ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected_ids.map((id) => {
            const a = (atleti ?? []).find((x: any) => x.id === id);
            if (!a) return null;
            return (
              <span key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                {a.nome} {a.cognome}
                <button onClick={() => toggle(id)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCorsoModal({ open, on_close, istruttori, queryClient, tipo, atleti, stagione_id }: {
  open: boolean; on_close: () => void; istruttori: any[]; queryClient: any;
  tipo: "corso" | "privata"; atleti?: any[]; stagione_id?: string | null;
}) {
  const [nome, set_nome] = useState("");
  const [corso_tipo, set_corso_tipo] = useState(tipo === "privata" ? "privata" : "");
  const [istr_id, set_istr_id] = useState("");
  const [livello, set_livello] = useState("tutti");
  const [durata, set_durata] = useState(60);
  const [costo, set_costo] = useState<number | string>("");
  const [costo_min, set_costo_min] = useState<number | string>("");
  const [note, set_note] = useState("");
  const [atleti_ids, set_atleti_ids] = useState<string[]>([]);
  const [saving, set_saving] = useState(false);

  const MAX_ATLETI_SEMI = 3;
  const costo_totale = (parseFloat(String(costo_min)) || 0) * durata;
  const is_semiprivata = atleti_ids.length > 1;
  const quota_per_atleta = atleti_ids.length > 0 ? costo_totale / atleti_ids.length : 0;

  const save = async () => {
    if (tipo === "privata" && atleti_ids.length === 0) { toast.error("Seleziona almeno un atleta"); return; }
    const nomi_atleti = atleti_ids.map((id) => {
      const a = (atleti ?? []).find((x: any) => x.id === id);
      return a ? a.nome : "?";
    });
    const final_nome = tipo === "privata"
      ? `${is_semiprivata ? "Semi" : "Privata"} · ${nomi_atleti.join(", ")}`
      : nome;
    if (!final_nome.trim()) { toast.error("Nome obbligatorio"); return; }
    set_saving(true);
    try {
      let lezione_id: string | null = null;
      if (tipo === "privata") {
        const { data: lp, error: lp_err } = await supabase.from("lezioni_private").insert({
          club_id: getClubId(),
          istruttore_id: istr_id || null,
          data: null,
          ora_inizio: null,
          ora_fine: null,
          durata_minuti: durata,
          condivisa: is_semiprivata,
          costo_totale,
          ricorrente: false,
          annullata: false,
          note,
        }).select().single();
        if (lp_err) throw lp_err;
        lezione_id = lp.id;

        if (lezione_id && atleti_ids.length > 0) {
          const rows = atleti_ids.map((aid) => ({
            lezione_id: lezione_id!,
            atleta_id: aid,
            quota_costo: costo_totale / atleti_ids.length,
          }));
          const { error: at_err } = await supabase.from("lezioni_private_atlete").insert(rows);
          if (at_err) throw at_err;
        }
      }

      const { data: new_corso, error } = await supabase.from("corsi").insert({
        club_id: getClubId(), nome: final_nome, tipo: tipo === "privata" ? "privata" : corso_tipo,
        livello_richiesto: livello,
        costo_mensile: tipo === "privata" ? costo_totale : (parseFloat(String(costo)) || 0),
        note,
        stagione_id,
        giorno: null as any, ora_inizio: null as any, ora_fine: null as any,
      }).select().single();
      if (error) throw error;

      if (istr_id && new_corso) {
        await supabase.from("corsi_istruttori").insert({ corso_id: new_corso.id, istruttore_id: istr_id });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["corsi"] }),
        queryClient.invalidateQueries({ queryKey: ["planning_settimana"] }),
        queryClient.invalidateQueries({ queryKey: ["planning_corsi_settimana"] }),
      ]);
      toast.success(tipo === "privata" ? "Lezione privata creata" : "Corso creato");
      on_close();
      set_nome(""); set_corso_tipo(""); set_istr_id(""); set_note(""); set_costo(""); set_costo_min(""); set_atleti_ids([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      set_saving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && on_close()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipo === "privata" ? "Nuova lezione privata" : "Nuovo corso"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {tipo === "privata" && atleti ? (
            <div>
              <Label className="text-xs">Atleta/e {is_semiprivata && <Badge variant="outline" className="ml-2 text-[10px] border-green-500 text-green-600">SEMIPRIVATA</Badge>}</Label>
              <AtletaSearchPlanning atleti={atleti} selected_ids={atleti_ids} on_change={set_atleti_ids} max={MAX_ATLETI_SEMI} />
              {atleti_ids.length >= MAX_ATLETI_SEMI && <p className="text-xs text-muted-foreground mt-1">Massimo {MAX_ATLETI_SEMI} atleti per lezione semiprivata</p>}
            </div>
          ) : (
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={nome} onChange={(e) => set_nome(e.target.value)} />
            </div>
          )}
          {tipo === "corso" && (
            <div>
              <Label className="text-xs">Tipo</Label>
              <Input value={corso_tipo} onChange={(e) => set_corso_tipo(e.target.value)} placeholder="es. Ghiaccio, Danza..." />
            </div>
          )}
          <div>
            <Label className="text-xs">Istruttore</Label>
            <Select value={istr_id} onValueChange={set_istr_id}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                {istruttori.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nome} {i.cognome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {tipo !== "privata" && (
            <div>
              <Label className="text-xs">Livello</Label>
              <Select value={livello} onValueChange={set_livello}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti</SelectItem>
                  {LIVELLI.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs">Durata (min)</Label>
              <Input type="number" value={durata} onChange={(e) => set_durata(+e.target.value)} min={15} step={5} />
            </div>
            <div className="flex-1">
              {tipo === "privata" ? (
                <>
                  <Label className="text-xs">Costo al minuto (CHF/min)</Label>
                  <Input type="number" value={costo_min} onChange={(e) => set_costo_min(e.target.value)} step="0.10" placeholder="es. 1.50" onFocus={(e) => e.target.select()} />
                </>
              ) : (
                <>
                  <Label className="text-xs">Costo mensile (CHF)</Label>
                  <Input type="number" value={costo} onChange={(e) => set_costo(e.target.value)} min={0} onFocus={(e) => e.target.select()} />
                </>
              )}
            </div>
          </div>
          {tipo === "privata" && atleti_ids.length > 0 && (
            <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground">Costo totale lezione: <strong className="text-foreground">CHF {costo_totale.toFixed(2)}</strong></p>
              <p className="text-xs text-muted-foreground">Quota per atleta ({atleti_ids.length}): <strong className="text-foreground">CHF {quota_per_atleta.toFixed(2)}</strong></p>
            </div>
          )}
          <div>
            <Label className="text-xs">Note</Label>
            <Input value={note} onChange={(e) => set_note(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={on_close}>Annulla</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Crea</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// EDIT CORSO MODAL
// ══════════════════════════════════════════════════════════════
function EditCorsoModal({ corso, on_close, istruttori, queryClient, posizionati }: {
  corso: any; on_close: () => void; istruttori: any[]; queryClient: any; posizionati: any[];
}) {
  const [nome, set_nome] = useState(corso.nome || "");
  const [tipo, set_tipo] = useState(corso.tipo || "");
  const [istr_id, set_istr_id] = useState((corso.istruttori_ids ?? [])[0] || "");
  const [livello, set_livello] = useState(corso.livello_richiesto || "tutti");
  const [giorno, set_giorno] = useState(corso.giorno || "");
  const [ora_inizio, set_ora_inizio] = useState(corso.ora_inizio?.slice(0, 5) || "");
  const [ora_fine, set_ora_fine] = useState(corso.ora_fine?.slice(0, 5) || "");
  const [costo, set_costo] = useState<number | string>(corso.costo_mensile ?? "");
  const [note, set_note] = useState(corso.note || "");
  const [saving, set_saving] = useState(false);

  const save = async () => {
    set_saving(true);
    try {
      if (corso._is_plan_row) {
        // Editing a planning row: update planning_corsi_settimana
        const update: any = {};
        if (ora_inizio) update.ora_inizio = ora_inizio;
        if (ora_fine) update.ora_fine = ora_fine;
        if (istr_id) update.istruttore_id = istr_id;
        const { error } = await supabase.from("planning_corsi_settimana").update(update).eq("id", corso.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["planning_corsi_settimana"] });
        toast.success("Corso aggiornato nella settimana");
      } else {
        // Template mode
        const update: any = { nome, tipo, livello_richiesto: livello, costo_mensile: parseFloat(String(costo)) || 0, note };
        if (giorno && ora_inizio && ora_fine) {
          const cs = time_to_min(ora_inizio);
          const ce = time_to_min(ora_fine);
          const conflicts = posizionati.filter((c: any) => {
            if (c.id === corso.id || c.giorno !== giorno) return false;
            const istr_ids: string[] = c.istruttori_ids ?? [];
            if (!istr_ids.includes(istr_id)) return false;
            const s = time_to_min(c.ora_inizio); const e = time_to_min(c.ora_fine);
            return s < ce && e > cs;
          });
          if (conflicts.length > 0) {
            if (!window.confirm(`Conflitto con: ${conflicts.map((c: any) => c.nome).join(", ")}. Continuare?`)) {
              set_saving(false);
              return;
            }
          }
          update.giorno = giorno;
          update.ora_inizio = ora_inizio;
          update.ora_fine = ora_fine;
        }
        const { error } = await supabase.from("corsi").update(update).eq("id", corso.id);
        if (error) throw error;

        const old_istr = (corso.istruttori_ids ?? [])[0];
        if (istr_id !== old_istr) {
          if (old_istr) await supabase.from("corsi_istruttori").delete().eq("corso_id", corso.id);
          if (istr_id) await supabase.from("corsi_istruttori").insert({ corso_id: corso.id, istruttore_id: istr_id });
        }

        await queryClient.invalidateQueries({ queryKey: ["corsi"] });
        toast.success("Corso aggiornato");
      }
      on_close();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      set_saving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && on_close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica corso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => set_nome(e.target.value)} /></div>
          <div><Label className="text-xs">Tipo</Label><Input value={tipo} onChange={(e) => set_tipo(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Istruttore</Label>
            <Select value={istr_id} onValueChange={set_istr_id}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                {istruttori.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nome} {i.cognome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Livello</Label>
            <Select value={livello} onValueChange={set_livello}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti</SelectItem>
                {LIVELLI.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs">Giorno</Label>
              <Select value={giorno} onValueChange={set_giorno}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {GIORNI.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Inizio</Label>
              <Input type="time" value={ora_inizio} onChange={(e) => set_ora_inizio(e.target.value)} className="h-9" />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Fine</Label>
              <Input type="time" value={ora_fine} onChange={(e) => set_ora_fine(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1"><Label className="text-xs">Costo mensile (CHF)</Label><Input type="number" value={costo} onChange={(e) => set_costo(e.target.value)} onFocus={(e) => e.target.select()} /></div>
          </div>
          <div><Label className="text-xs">Note</Label><Input value={note} onChange={(e) => set_note(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={on_close}>Annulla</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PlanningPageWrapper;
