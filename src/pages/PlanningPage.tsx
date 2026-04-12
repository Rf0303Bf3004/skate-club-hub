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
const CLUB_ID = "d33e590e-73ef-4ead-ad0e-5e321854ef50";
const STAGIONE_ID = "841a5837-3382-472f-a582-557f8b5d69e9";
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const GIORNI_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const OFF_ICE_TYPES = ["danza", "off-ice", "stretching"];
const OFF_ICE_COLORS: Record<string, string> = { danza: "#B83280", "off-ice": "#718096", stretching: "#276749" };
const PPM_FOCUS = 7;
const MESI_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

type ViewMode = 1 | 2 | 3 | 7;

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
    queryKey: ["configurazione_ghiaccio", CLUB_ID],
    queryFn: async () => {
      const { data } = await supabase.from("configurazione_ghiaccio").select("*").eq("club_id", CLUB_ID).maybeSingle();
      return data;
    },
  });
}

function use_disponibilita_ghiaccio() {
  return useQuery({
    queryKey: ["disponibilita_ghiaccio", CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase.from("disponibilita_ghiaccio").select("*").eq("club_id", CLUB_ID);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function use_disponibilita_istruttori() {
  return useQuery({
    queryKey: ["disponibilita_istruttori", CLUB_ID],
    queryFn: async () => {
      const { data, error } = await supabase.from("disponibilita_istruttori").select("*").eq("club_id", CLUB_ID);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Planning settimane hooks ──
function use_planning_settimana(data_lunedi: string) {
  return useQuery({
    queryKey: ["planning_settimana", CLUB_ID, data_lunedi],
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planning_settimane")
        .select("*")
        .eq("club_id", CLUB_ID)
        .eq("data_lunedi", data_lunedi)
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

  const config = configQuery.data ?? null;
  const ghiaccio_slots = ghiaccioQuery.data ?? [];
  const disp_istr_raw = dispIstrQuery.data ?? [];
  const corsi_raw = corsiQuery.data ?? [];
  const istruttori_raw = istruttoriQuery.data ?? [];
  const stagioni_raw = stagioniQuery.data ?? [];
  const atleti_raw = atletiQuery.data ?? [];
  const loadingGhiaccio = ghiaccioQuery.isLoading;
  const loadingCorsi = corsiQuery.isLoading;
  const loadingIstr = istruttoriQuery.isLoading;

  // ── Week navigation state ──
  const [dataLunedi, setDataLunedi] = useState<Date>(() => getMondayOfWeek(new Date()));
  const dataLunediISO = formatDateISO(dataLunedi);

  // ── Planning settimana data ──
  const settimanaQuery = use_planning_settimana(dataLunediISO);
  const settimana = settimanaQuery.data ?? null;
  const settimana_id = settimana?.id ?? null;
  const planCorsiQuery = use_planning_corsi(settimana_id);
  const planPrivateQuery = use_planning_private(settimana_id);
  const plan_corsi = planCorsiQuery.data ?? [];
  const plan_private = planPrivateQuery.data ?? [];
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
  const [saving, set_saving] = useState(false);
  const [generating, set_generating] = useState(false);

  const loading = loadingGhiaccio || loadingCorsi || loadingIstr;

  const corsi_template = useMemo(() => (corsi_raw ?? []).filter((c: any) => c.attivo !== false), [corsi_raw]);
  const istruttori: any[] = useMemo(() => istruttori_raw ?? [], [istruttori_raw]);
  const atleti: any[] = useMemo(() => atleti_raw ?? [], [atleti_raw]);
  const disp_istr = useMemo(() => disp_istr_raw ?? [], [disp_istr_raw]);
  const slots = useMemo(() => ghiaccio_slots ?? [], [ghiaccio_slots]);

  // ── Build unified course list for the grid ──
  // When generated: use planning_corsi_settimana rows mapped to display format
  // When template: use corsi_template
  const posizionati = useMemo(() => {
    if (is_generated) {
      // Map planning rows to display format with giorno name
      return plan_corsi.map((pc: any) => {
        const template = corsi_template.find((c: any) => c.id === pc.corso_id);
        const dateObj = new Date(pc.data + "T00:00:00");
        const dayIdx = dayIndexFromDate(dateObj);
        return {
          id: pc.id, // use planning row id for operations
          corso_id: pc.corso_id,
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
          _is_plan_row: true,
        };
      }).filter((c: any) => !c.annullato);
    }
    // Template mode: show positioned courses
    return corsi_template.filter((c: any) => c.giorno && c.ora_inizio && c.ora_fine);
  }, [is_generated, plan_corsi, corsi_template]);

  // Annullati for display (greyed out)
  const annullati = useMemo(() => {
    if (!is_generated) return [];
    return plan_corsi.filter((pc: any) => pc.annullato).map((pc: any) => {
      const template = corsi_template.find((c: any) => c.id === pc.corso_id);
      const dateObj = new Date(pc.data + "T00:00:00");
      const dayIdx = dayIndexFromDate(dateObj);
      return {
        id: pc.id,
        corso_id: pc.corso_id,
        nome: template?.nome || "?",
        tipo: template?.tipo || "",
        giorno: GIORNI[dayIdx],
        ora_inizio: pc.ora_inizio,
        ora_fine: pc.ora_fine,
        istruttori_ids: pc.istruttore_id ? [pc.istruttore_id] : [],
        annullato: true,
        _is_plan_row: true,
      };
    });
  }, [is_generated, plan_corsi, corsi_template]);

  const corsiDaPosizionare = useMemo(() => {
    if (is_generated) return []; // In generated mode, all courses come from plan
    return corsi_template.filter((c: any) => !c.giorno || !c.ora_inizio);
  }, [is_generated, corsi_template]);

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

  // ── Refetch helpers ──
  const refetchSettimana = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["planning_settimana", CLUB_ID, dataLunediISO] });
    queryClient.invalidateQueries({ queryKey: ["planning_corsi_settimana"] });
    queryClient.invalidateQueries({ queryKey: ["planning_private_settimana"] });
  }, [queryClient, dataLunediISO]);

  // ── Genera settimana ──
  const generaSettimana = async () => {
    set_generating(true);
    try {
      // Step 1: Create week row
      const { data: newSett, error: e1 } = await supabase.from("planning_settimane").insert({
        club_id: CLUB_ID,
        stagione_id: STAGIONE_ID,
        data_lunedi: dataLunediISO,
        stato: "bozza",
      }).select().single();
      if (e1) throw e1;

      // Step 2: Find previous week
      const { data: ultimaSett } = await supabase.from("planning_settimane")
        .select("*")
        .eq("club_id", CLUB_ID)
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

        if (corsiUltima?.length) {
          const nuoviCorsi = corsiUltima.map((c: any) => {
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
        const corsiTemplate = corsi_template.filter((c: any) => c.giorno && c.ora_inizio && c.ora_fine);
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

      // Step 4: Add recurring private lessons
      const { data: privateRicorrenti } = await supabase.from("lezioni_private")
        .select("*")
        .eq("club_id", CLUB_ID)
        .eq("ricorrente", true)
        .or(`data_revoca.is.null,data_revoca.gt.${dataLunediISO}`);

      if (privateRicorrenti?.length) {
        const nuovePrivate = privateRicorrenti
          .filter((p: any) => p.data && p.ora_inizio && p.ora_fine)
          .map((p: any) => {
            const dateObj = new Date(p.data + "T00:00:00");
            const giornoOrig = dayIndexFromDate(dateObj);
            const nuovaData = addDays(dataLunedi, giornoOrig);
            return {
              settimana_id: newSett.id,
              lezione_privata_id: p.id,
              data: formatDateISO(nuovaData),
              ora_inizio: p.ora_inizio,
              ora_fine: p.ora_fine,
              istruttore_id: p.istruttore_id,
            };
          });
        if (nuovePrivate.length) {
          await supabase.from("planning_private_settimana").insert(nuovePrivate);
        }
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
        // In generated mode: mark as annullato
        const { error } = await supabase.from("planning_corsi_settimana").update({ annullato: true }).eq("id", corso.id);
        if (error) throw error;
        refetchSettimana();
        toast.info(`${corso.nome} annullato`);
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
    const day_corsi_ice = posizionati.filter((c: any) => c.giorno === focus_day && !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
    const day_corsi_off = posizionati.filter((c: any) => c.giorno === focus_day && OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
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
                    background: "repeating-linear-gradient(-45deg, #c8c4b8 0px, #c8c4b8 3px, #f0ede6 3px, #f0ede6 10px)",
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

                    return (
                      <Tooltip key={c.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute z-[3] rounded flex flex-col justify-center overflow-hidden cursor-pointer ${is_selected ? "ring-2 ring-primary" : ""}`}
                            style={{
                              left: (cs - f_start) * PPM_FOCUS,
                              width: w_px,
                              top: ri * ROW_H + 8,
                              height: ROW_H - 12,
                              background: is_private
                                ? `repeating-linear-gradient(-45deg, ${colore} 0px, ${colore} 3px, transparent 3px, transparent 8px)`
                                : colore,
                              border: is_private ? `2px dashed ${colore}` : `1px solid rgba(0,0,0,0.15)`,
                              borderRadius: 4,
                              color: "#fff",
                            }}
                            onClick={() => set_selected_corso_id(c.id)}
                          >
                            {is_private ? (
                              <div className="flex flex-col gap-0.5 px-1 py-0.5 overflow-hidden">
                                <span className="truncate" style={{ background: "rgba(0,0,0,0.55)", color: "white", padding: "1px 4px", borderRadius: 3, fontSize: 11, fontWeight: 600, display: "inline-block" }}>
                                  {c.nome}
                                </span>
                                {w_px > 70 && first_istr && (
                                  <span className="truncate" style={{ background: "rgba(0,0,0,0.55)", color: "white", padding: "1px 4px", borderRadius: 3, fontSize: 10, fontWeight: 600, display: "inline-block" }}>
                                    {first_istr.nome} {first_istr.cognome}
                                  </span>
                                )}
                                {w_px > 90 && c.livello_richiesto && (
                                  <span className="truncate" style={{ background: "rgba(0,0,0,0.55)", color: "white", padding: "1px 4px", borderRadius: 3, fontSize: 9, fontWeight: 600, display: "inline-block" }}>
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
                        </div>
                      </TooltipTrigger>
                      <TooltipContent><p className="line-through">{c.nome} (annullato)</p></TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Off-ice strip */}
                {day_corsi_off.length > 0 && (
                  <div className="absolute left-0 right-0" style={{ top: (course_rows.length || 1) * ROW_H + (day_annullati.length > 0 ? 34 : 4), height: 6 }}>
                    {day_corsi_off.map((c: any) => {
                      const cs = time_to_min(c.ora_inizio);
                      const ce = time_to_min(c.ora_fine);
                      const istr_ids: string[] = c.istruttori_ids ?? [];
                      const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                      const colore = first_istr?.colore || OFF_ICE_COLORS[(c.tipo || "").toLowerCase()] || "#94A3B8";
                      return (
                        <Tooltip key={c.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-0 h-full rounded-sm cursor-pointer"
                              style={{
                                left: (cs - f_start) * PPM_FOCUS,
                                width: (ce - cs) * PPM_FOCUS,
                                background: colore,
                              }}
                              onClick={() => set_selected_corso_id(c.id)}
                            />
                          </TooltipTrigger>
                          <TooltipContent><p>{c.nome}</p></TooltipContent>
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
          <NewCorsoModal open={show_new_corso} on_close={() => set_show_new_corso(false)} istruttori={istruttori} queryClient={queryClient} tipo="corso" />
        )}
        {show_new_privata && (
          <NewCorsoModal open={show_new_privata} on_close={() => set_show_new_privata(false)} istruttori={istruttori} queryClient={queryClient} tipo="privata" atleti={atleti} />
        )}
        {show_edit_corso && (
          <EditCorsoModal corso={show_edit_corso} on_close={() => set_show_edit_corso(null)} istruttori={istruttori} queryClient={queryClient} posizionati={posizionati} />
        )}

        {/* Confirmation dialog */}
        <ConfirmPlaceDialog confirm={confirm_place} saving={saving} on_confirm={handle_confirm_place} on_cancel={() => set_confirm_place(null)} />
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
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#EEEDFE", color: "#7F77DD", border: "1px solid #AFA9EC" }}>Ghiaccio</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "repeating-linear-gradient(-45deg, #c8c4b8 0px, #c8c4b8 3px, #f0ede6 3px, #f0ede6 10px)", border: "1px solid #b0ada4" }}>Pulizia</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#f5f4f0", border: "1px solid #ddd" }}>Off-ice</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "transparent", border: "2px dashed #6B7280" }}>Privata</span>
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
            const day_corsi_ice = posizionati.filter((c: any) => c.giorno === giorno && !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
            const day_corsi_off = posizionati.filter((c: any) => c.giorno === giorno && OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
            const day_annullati_list = annullati.filter((c: any) => c.giorno === giorno);
            const day_pick = pick_corso ? (pick_slots_by_day[giorno] ?? []) : [];
            const giorno_idx = GIORNI.indexOf(giorno as any);
            const giorno_date = date_for_giorno[giorno];
            const giorno_date_obj = addDays(dataLunedi, giorno_idx);
            const giorno_day_num = giorno_date_obj.getDate();

            // Sub-rows
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
            const course_rows = compute_rows(day_corsi_ice);
            const n_rows = Math.max(course_rows.length, 1);
            const ROW_H = 40;
            const day_h = n_rows * (14 + 2) + 8 + (day_pick.length > 0 ? 10 : 0) + (day_annullati_list.length > 0 ? 18 : 0);

            const day_ice_ranges = day_ghiaccio.map((g: any) => ({
              start: time_to_min(g.ora_inizio),
              end: time_to_min(g.ora_fine),
            }));

            return (
              <div key={giorno} className="border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/20"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-green-slot]')) return;
                  set_focus_day(giorno);
                }}>
                <div className="flex">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center border-r border-border bg-muted px-2"
                    style={{ width: 100, minHeight: day_h }}>
                    <span className="text-xs font-bold text-foreground">{GIORNI_SHORT[giorno_idx]}</span>
                    <span className="text-[10px] text-muted-foreground">{giorno_day_num}</span>
                  </div>

                  <div className="flex-1 relative" style={{ minWidth: total_min * 1.2, height: day_h }}>
                    {/* Default bg = grey */}
                    <div className="absolute inset-0" style={{ background: is_generated ? "transparent" : "#f5f4f0" }} />

                    {/* Ghiaccio bg */}
                    {day_ghiaccio.map((g: any, gi: number) => {
                      const gs = time_to_min(g.ora_inizio); const ge = time_to_min(g.ora_fine);
                      return <div key={`g${gi}`} className="absolute" style={{
                        left: `${((gs - range_start) / total_min) * 100}%`, width: `${((ge - gs) / total_min) * 100}%`,
                        top: 0, bottom: 0, background: "#EEEDFE",
                      }} />;
                    })}

                    {/* Pulizia bg */}
                    {day_pulizia.map((p: any, pi: number) => {
                      const ps_start = time_to_min(p.ora_inizio); const pe = time_to_min(p.ora_fine);
                      return <div key={`p${pi}`} className="absolute" style={{
                        left: `${((ps_start - range_start) / total_min) * 100}%`, width: `${((pe - ps_start) / total_min) * 100}%`,
                        top: 0, bottom: 0,
                        background: "repeating-linear-gradient(-45deg, #c8c4b8 0px, #c8c4b8 3px, #f0ede6 3px, #f0ede6 10px)",
                      }} />;
                    })}

                    {/* Green available zones when a course is selected */}
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

                    {/* Course blocks */}
                    {course_rows.map((row, ri) =>
                      row.map((c: any) => {
                        const cs = time_to_min(c.ora_inizio); const ce = time_to_min(c.ora_fine);
                        const istr_ids: string[] = c.istruttori_ids ?? [];
                        const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                        const colore = first_istr?.colore || "#3B82F6";
                        const is_private = (c.tipo || "").toLowerCase() === "privata";
                        return (
                          <Tooltip key={c.id}>
                            <TooltipTrigger asChild>
                              <div className="absolute z-[3] rounded-sm" style={{
                                left: `${((cs - range_start) / total_min) * 100}%`,
                                width: `${((ce - cs) / total_min) * 100}%`,
                                top: 4 + ri * 16,
                                height: 14,
                                background: is_private
                                  ? `repeating-linear-gradient(-45deg, ${colore} 0px, ${colore} 3px, transparent 3px, transparent 8px)`
                                  : colore,
                                border: is_private ? `1px dashed ${colore}` : "none",
                              }} />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="font-bold">{c.nome}</p>
                              {first_istr && <p className="text-xs">{first_istr.nome} {first_istr.cognome}</p>}
                              <p className="text-xs">{c.ora_inizio?.slice(0, 5)} – {c.ora_fine?.slice(0, 5)}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })
                    )}

                    {/* Annullati (greyed minibar) */}
                    {day_annullati_list.map((c: any, ai: number) => {
                      const cs = time_to_min(c.ora_inizio); const ce = time_to_min(c.ora_fine);
                      return (
                        <Tooltip key={`ann-${c.id}`}>
                          <TooltipTrigger asChild>
                            <div className="absolute z-[2] rounded-sm" style={{
                              left: `${((cs - range_start) / total_min) * 100}%`,
                              width: `${((ce - cs) / total_min) * 100}%`,
                              top: 4 + n_rows * 16 + ai * 16,
                              height: 12,
                              background: "#e0e0e0",
                              border: "1px solid #bbb",
                              opacity: 0.6,
                            }} />
                          </TooltipTrigger>
                          <TooltipContent><p className="line-through">{c.nome} (annullato)</p></TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {/* Off-ice strip 6px */}
                    {day_corsi_off.length > 0 && day_corsi_off.map((c: any) => {
                      const cs = time_to_min(c.ora_inizio); const ce = time_to_min(c.ora_fine);
                      const istr_ids: string[] = c.istruttori_ids ?? [];
                      const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                      const colore = first_istr?.colore || OFF_ICE_COLORS[(c.tipo || "").toLowerCase()] || "#94A3B8";
                      return (
                        <Tooltip key={c.id}>
                          <TooltipTrigger asChild>
                            <div className="absolute z-[2] rounded-sm" style={{
                              left: `${((cs - range_start) / total_min) * 100}%`,
                              width: `${((ce - cs) / total_min) * 100}%`,
                              top: 0, height: 6, background: colore,
                            }} />
                          </TooltipTrigger>
                          <TooltipContent><p>{c.nome}</p></TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Modals */}
        {show_new_corso && (
          <NewCorsoModal open={show_new_corso} on_close={() => set_show_new_corso(false)} istruttori={istruttori} queryClient={queryClient} tipo="corso" />
        )}
        {show_new_privata && (
          <NewCorsoModal open={show_new_privata} on_close={() => set_show_new_privata(false)} istruttori={istruttori} queryClient={queryClient} tipo="privata" atleti={atleti} />
        )}
        {show_edit_corso && (
          <EditCorsoModal corso={show_edit_corso} on_close={() => set_show_edit_corso(null)} istruttori={istruttori} queryClient={queryClient} posizionati={posizionati} />
        )}

        {/* Confirmation dialog */}
        <ConfirmPlaceDialog confirm={confirm_place} saving={saving} on_confirm={handle_confirm_place} on_cancel={() => set_confirm_place(null)} />
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
function DetailPanel({ corso, istr_map, atleti, build_mode, on_close, on_remove, on_edit }: {
  corso: any; istr_map: Record<string, any>; atleti: any[]; build_mode: boolean;
  on_close: () => void; on_remove: () => void; on_edit: () => void;
}) {
  const corso_id_for_query = corso.corso_id || corso.id;
  const { data: iscrizioni } = useQuery({
    queryKey: ["iscrizioni_corsi", corso_id_for_query],
    queryFn: async () => {
      const { data } = await supabase.from("iscrizioni_corsi").select("*").eq("corso_id", corso_id_for_query).eq("attiva", true);
      return data ?? [];
    },
  });

  const istr_ids: string[] = corso.istruttori_ids ?? [];
  const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;

  const enrolled = useMemo(() => {
    if (!iscrizioni) return [];
    return iscrizioni.map((i: any) => {
      const a = atleti.find((at: any) => at.id === i.atleta_id);
      return a ? { id: a.id, nome: `${a.nome} ${a.cognome}` } : { id: i.atleta_id, nome: "?" };
    });
  }, [iscrizioni, atleti]);

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
        <p className="text-xs font-bold text-foreground mb-1">Iscritti ({enrolled.length})</p>
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {enrolled.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5 text-xs text-foreground">
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">{a.nome.charAt(0)}</div>
              {a.nome}
            </div>
          ))}
        </div>
      </div>

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
        club_id: CLUB_ID, giorno, tipo: new_tipo, ora_inizio: new_start, ora_fine: new_end,
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

function NewCorsoModal({ open, on_close, istruttori, queryClient, tipo, atleti }: {
  open: boolean; on_close: () => void; istruttori: any[]; queryClient: any;
  tipo: "corso" | "privata"; atleti?: any[];
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
          club_id: CLUB_ID,
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
        club_id: CLUB_ID, nome: final_nome, tipo: tipo === "privata" ? "privata" : corso_tipo,
        livello_richiesto: livello,
        costo_mensile: tipo === "privata" ? costo_totale : (parseFloat(String(costo)) || 0),
        note,
        giorno: null as any, ora_inizio: null as any, ora_fine: null as any,
      }).select().single();
      if (error) throw error;

      if (istr_id && new_corso) {
        await supabase.from("corsi_istruttori").insert({ corso_id: new_corso.id, istruttore_id: istr_id });
      }

      await queryClient.invalidateQueries({ queryKey: ["corsi"] });
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
