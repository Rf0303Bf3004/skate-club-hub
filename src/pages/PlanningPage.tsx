import React, { useState, useMemo, useCallback, useRef, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_corsi, use_istruttori, use_stagioni, use_atleti } from "@/hooks/use-supabase-data";
import {
  X, Loader2, ChevronLeft, ChevronRight, Plus, Wrench, Eye, Check,
  ArrowLeft, LayoutGrid, Pencil, Undo2, Mail, Move, AlertTriangle,
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
const OFF_ICE_TYPES = ["danza", "off-ice", "stretching"];
const OFF_ICE_COLORS: Record<string, string> = { danza: "#B83280", "off-ice": "#718096", stretching: "#276749" };
const PPM_FOCUS = 7; // pixels per minute in focus day

type ViewMode = 1 | 2 | 3 | 7;

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

// Check if course has valid ice coverage
function has_valid_ice(corso: any, ghiaccio_slots: any[]): boolean {
  if (!corso.giorno || !corso.ora_inizio || !corso.ora_fine) return false;
  if (OFF_ICE_TYPES.includes((corso.tipo || "").toLowerCase())) return true;
  const cs = time_to_min(corso.ora_inizio);
  const ce = time_to_min(corso.ora_fine);
  return ghiaccio_slots.some((s: any) =>
    s.giorno === corso.giorno && (s.tipo ?? "ghiaccio") === "ghiaccio" &&
    time_to_min(s.ora_inizio) <= cs && time_to_min(s.ora_fine) >= ce
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
  const is_picked = pick_corso?.id === corso.id;
  return (
    <div
      className={`border rounded p-2 bg-card cursor-pointer hover:shadow-md transition-shadow space-y-1 ${is_picked ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
      onClick={() => set_pick_corso(is_picked ? null : corso)}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-foreground block truncate flex-1">{corso.nome}</span>
        {is_picked && (
          <button onClick={(e) => { e.stopPropagation(); set_pick_corso(null); }} className="text-muted-foreground hover:text-foreground ml-1">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {first_istr && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: first_istr.colore || "#6B7280" }} />
          {first_istr.nome} {first_istr.cognome}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground block">{corso.atleti_ids?.length ?? 0} atleti</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
function PlanningPageInner() {
  const queryClient = useQueryClient();
  const { data: config } = use_config_ghiaccio();
  const { data: ghiaccio_slots, isLoading: loadingGhiaccio } = use_disponibilita_ghiaccio();
  const { data: disp_istr_raw } = use_disponibilita_istruttori();
  const { data: corsi_raw, isLoading: loadingCorsi } = use_corsi();
  const { data: istruttori_raw, isLoading: loadingIstr } = use_istruttori();
  const { data: stagioni_raw } = use_stagioni();
  const { data: atleti_raw } = use_atleti();

  const [view_mode, set_view_mode] = useState<ViewMode>(7);
  const [day_offset, set_day_offset] = useState(0);
  const [build_mode, set_build_mode] = useState(false);
  const [focus_day, set_focus_day] = useState<string | null>(null);
  const [selected_corso_id, set_selected_corso_id] = useState<string | null>(null);
  const [pick_corso, set_pick_corso] = useState<any>(null); // course selected for two-click placement
  const [confirm_place, set_confirm_place] = useState<{ corso: any; giorno: string; ora_inizio: string; ora_fine: string } | null>(null);
  const [slot_manager_open, set_slot_manager_open] = useState(false);
  const [show_new_corso, set_show_new_corso] = useState(false);
  const [show_new_privata, set_show_new_privata] = useState(false);
  const [show_edit_corso, set_show_edit_corso] = useState<any>(null);
  const [saving, set_saving] = useState(false);

  const loading = loadingGhiaccio || loadingCorsi || loadingIstr;

  const corsi = useMemo(() => (corsi_raw ?? []).filter((c: any) => c.attivo !== false), [corsi_raw]);
  const istruttori: any[] = useMemo(() => istruttori_raw ?? [], [istruttori_raw]);
  const atleti: any[] = useMemo(() => atleti_raw ?? [], [atleti_raw]);
  const disp_istr = useMemo(() => disp_istr_raw ?? [], [disp_istr_raw]);
  const slots = useMemo(() => ghiaccio_slots ?? [], [ghiaccio_slots]);

  // Positioned vs unpositioned
  const { posizionati, da_posizionare } = useMemo(() => {
    const pos: any[] = [];
    const unpos: any[] = [];
    corsi.forEach((c: any) => {
      if (c.giorno && c.ora_inizio && c.ora_fine) pos.push(c);
      else unpos.push(c);
    });
    return { posizionati: pos, da_posizionare: unpos };
  }, [corsi, slots]);

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

  const set_view = (m: ViewMode) => {
    set_view_mode(m);
    set_day_offset((prev) => Math.min(prev, 7 - m));
  };
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

  // ── Instructor hours ──
  const intersect_min = (a_start: number, a_end: number, b_start: number, b_end: number): number => {
    const s = Math.max(a_start, b_start);
    const e = Math.min(a_end, b_end);
    return e > s ? e - s : 0;
  };

  const istr_hours = useMemo(() => {
    const result: Record<string, { assigned: number; available: number }> = {};
    const ice_by_day: Record<string, { s: number; e: number }[]> = {};
    slots.forEach((sl: any) => {
      if ((sl.tipo ?? "ghiaccio") !== "ghiaccio") return;
      if (!ice_by_day[sl.giorno]) ice_by_day[sl.giorno] = [];
      ice_by_day[sl.giorno].push({ s: time_to_min(sl.ora_inizio), e: time_to_min(sl.ora_fine) });
    });

    istruttori.forEach((ist: any) => {
      let avail = 0;
      const disp = ist.disponibilita || {};
      GIORNI.forEach((giorno) => {
        const day_disp: any[] = disp[giorno] ?? [];
        const day_ice = ice_by_day[giorno] ?? [];
        day_disp.forEach((d: any) => {
          const ds = time_to_min(d.ora_inizio);
          const de = time_to_min(d.ora_fine);
          day_ice.forEach((ice) => {
            avail += intersect_min(ds, de, ice.s, ice.e);
          });
        });
      });
      let assigned = 0;
      posizionati.forEach((c: any) => {
        if ((c.istruttori_ids ?? []).includes(ist.id)) {
          assigned += time_to_min(c.ora_fine) - time_to_min(c.ora_inizio);
        }
      });
      result[ist.id] = { assigned: assigned / 60, available: avail / 60 };
    });
    return result;
  }, [istruttori, posizionati, slots]);

  // Selected corso
  const selected_corso = useMemo(() => {
    if (!selected_corso_id) return null;
    return corsi.find((c: any) => c.id === selected_corso_id) || null;
  }, [selected_corso_id, corsi]);

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

  // ── Actions ──
  const place_corso = async (corso: any, giorno: string, ora_inizio: string, ora_fine: string) => {
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
      const { error } = await supabase.from("corsi").update({
        giorno: null as any, ora_inizio: null as any, ora_fine: null as any,
      }).eq("id", corso.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["corsi"] });
      toast.info(`${corso.nome} rimosso dal planning`);
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
            <h2 className="text-lg font-bold text-foreground flex-1">{focus_day}</h2>
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
              <div data-sidebar className="w-[280px] flex-shrink-0 border-r border-border overflow-y-auto p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground uppercase">Da posizionare ({da_posizionare.length})</span>
                </div>
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => set_show_new_corso(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Corso/Pacchetto
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => set_show_new_privata(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Lezione privata
                </Button>
                {da_posizionare.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    <Check className="h-5 w-5 mx-auto text-green-500 mb-1" />
                    Tutti posizionati
                  </div>
                ) : (
                  da_posizionare.map((c: any) => (
                    <SidebarCard key={c.id} corso={c} istr_map={istr_map} pick_corso={pick_corso} set_pick_corso={set_pick_corso} />
                  ))
                )}
              </div>
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
                            <span className="truncate px-1 leading-tight font-bold" style={{ fontSize: 12, color: is_private ? colore : "#fff" }}>
                              {c.nome}
                            </span>
                            {w_px > 70 && first_istr && (
                              <span className="truncate px-1 leading-tight" style={{ fontSize: 10, opacity: 0.85, color: is_private ? colore : "#fff" }}>
                                {first_istr.nome} {first_istr.cognome}
                              </span>
                            )}
                            {w_px > 90 && c.livello_richiesto && (
                              <span className="truncate px-1" style={{ fontSize: 9, opacity: 0.7, color: is_private ? colore : "#fff" }}>
                                {c.livello_richiesto}
                              </span>
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

                {/* Off-ice strip */}
                {day_corsi_off.length > 0 && (
                  <div className="absolute left-0 right-0" style={{ top: (course_rows.length || 1) * ROW_H + 4, height: 6 }}>
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
            {pick_corso && <Badge variant="outline" className="border-primary text-primary text-xs">Selezionato: {pick_corso.nome}</Badge>}
            <Button size="sm" variant={build_mode ? "default" : "outline"} onClick={() => { set_build_mode(!build_mode); set_pick_corso(null); }} className="gap-1.5">
              {build_mode ? <><Eye className="h-4 w-4" /> Visualizzazione</> : <><Wrench className="h-4 w-4" /> Costruzione</>}
            </Button>
          </div>
        </div>

        {/* View selector + nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {([1, 2, 3, 7] as ViewMode[]).map((m, idx) => (
              <button key={m} onClick={() => set_view(m)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${view_mode === m ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"} ${idx > 0 ? "border-l border-border" : ""}`}
              >
                {m === 1 ? "1g" : m === 2 ? "2g" : m === 3 ? "3g" : "7g"}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={go_prev} disabled={day_offset === 0}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium text-foreground min-w-[120px] text-center">{view_label}</span>
            <Button variant="outline" size="sm" onClick={go_next} disabled={day_offset + view_mode >= 7}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Instructor legend with hour bars */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Istruttori</p>
          <div className="flex flex-wrap gap-2">
            {istruttori.map((ist: any) => {
              const h = istr_hours[ist.id] || { assigned: 0, available: 0 };
              const pct = h.available > 0 ? (h.assigned / h.available) * 100 : 0;
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
                      <span className="text-[10px]">{h.assigned.toFixed(1)}h/{h.available.toFixed(1)}h</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Disponibile: {h.available.toFixed(1)}h</p>
                    <p>Assegnato: {h.assigned.toFixed(1)}h</p>
                    <p>Libero: {(h.available - h.assigned).toFixed(1)}h</p>
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
            <div data-sidebar className="w-[280px] flex-shrink-0 border border-border rounded-lg overflow-y-auto p-3 space-y-2 bg-muted/30 mr-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground uppercase">Da posizionare ({da_posizionare.length})</span>
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => set_show_new_corso(true)}>
                <Plus className="h-3 w-3 mr-1" /> Corso/Pacchetto
              </Button>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => set_show_new_privata(true)}>
                <Plus className="h-3 w-3 mr-1" /> Lezione privata
              </Button>
              {da_posizionare.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  <Check className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  Tutti i corsi posizionati
                </div>
              ) : (
                da_posizionare.map((c: any) => (
                  <SidebarCard key={c.id} corso={c} istr_map={istr_map} pick_corso={pick_corso} set_pick_corso={set_pick_corso} />
                ))
              )}
            </div>
          )}

        {/* Grid */}
        <div className="flex-1 border border-border rounded-lg overflow-x-auto bg-card" data-grid>
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
            const day_pick = pick_corso ? (pick_slots_by_day[giorno] ?? []) : [];

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
            const day_h = n_rows * (14 + 2) + 8 + (day_pick.length > 0 ? 10 : 0);

            // For weekly view green slots, show one merged bar per ice slot instead of every 5-min increment
            const day_ice_ranges = day_ghiaccio.map((g: any) => ({
              start: time_to_min(g.ora_inizio),
              end: time_to_min(g.ora_fine),
            }));

            return (
              <div key={giorno} className="border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/20"
                onClick={(e) => {
                  // If pick_corso and clicking on a green slot, don't navigate to focus day
                  if ((e.target as HTMLElement).closest('[data-green-slot]')) return;
                  set_focus_day(giorno);
                }}>
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center justify-center border-r border-border bg-muted px-2"
                    style={{ width: 100, minHeight: day_h }}>
                    <span className="text-xs font-bold text-foreground">{giorno}</span>
                  </div>

                  <div className="flex-1 relative" style={{ minWidth: total_min * 1.2, height: day_h }}>
                    {/* Default bg = grey */}
                    <div className="absolute inset-0" style={{ background: "#f5f4f0" }} />

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

                    {/* Green available zones (merged per ice slot) when a course is selected */}
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
                          // Open focus day for precise placement
                          set_focus_day(giorno);
                        }}
                      />
                    ))}

                    {/* Course blocks: ZERO TEXT, only colors, 14px tall */}
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
  const { data: iscrizioni } = useQuery({
    queryKey: ["iscrizioni_corsi", corso.id],
    queryFn: async () => {
      const { data } = await supabase.from("iscrizioni_corsi").select("*").eq("corso_id", corso.id).eq("attiva", true);
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
            <Undo2 className="h-3 w-3" /> Rimuovi dalla griglia
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
function NewCorsoModal({ open, on_close, istruttori, queryClient, tipo, atleti }: {
  open: boolean; on_close: () => void; istruttori: any[]; queryClient: any;
  tipo: "corso" | "privata"; atleti?: any[];
}) {
  const [nome, set_nome] = useState("");
  const [corso_tipo, set_corso_tipo] = useState(tipo === "privata" ? "privata" : "");
  const [istr_id, set_istr_id] = useState("");
  const [livello, set_livello] = useState("tutti");
  const [durata, set_durata] = useState(60);
  const [costo, set_costo] = useState(0);
  const [note, set_note] = useState("");
  const [atleta_id, set_atleta_id] = useState("");
  const [saving, set_saving] = useState(false);

  const save = async () => {
    const final_nome = tipo === "privata" && atleta_id && atleti
      ? `Privata · ${atleti.find((a: any) => a.id === atleta_id)?.nome || "?"}`
      : nome;
    if (!final_nome.trim()) { toast.error("Nome obbligatorio"); return; }
    set_saving(true);
    try {
      const { data: new_corso, error } = await supabase.from("corsi").insert({
        club_id: CLUB_ID, nome: final_nome, tipo: tipo === "privata" ? "privata" : corso_tipo,
        livello_richiesto: livello, costo_mensile: costo, note,
        giorno: null as any, ora_inizio: null as any, ora_fine: null as any,
      }).select().single();
      if (error) throw error;
      if (istr_id && new_corso) {
        await supabase.from("corsi_istruttori").insert({ corso_id: new_corso.id, istruttore_id: istr_id });
      }
      await queryClient.invalidateQueries({ queryKey: ["corsi"] });
      toast.success("Corso creato");
      on_close();
      set_nome(""); set_corso_tipo(""); set_istr_id(""); set_note("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      set_saving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && on_close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tipo === "privata" ? "Nuova lezione privata" : "Nuovo corso"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {tipo === "privata" && atleti ? (
            <div>
              <Label className="text-xs">Atleta</Label>
              <Select value={atleta_id} onValueChange={set_atleta_id}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona atleta" /></SelectTrigger>
                <SelectContent>
                  {atleti.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nome} {a.cognome}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Label className="text-xs">Durata (min)</Label>
              <Input type="number" value={durata} onChange={(e) => set_durata(+e.target.value)} min={15} step={5} />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Costo mensile</Label>
              <Input type="number" value={costo} onChange={(e) => set_costo(+e.target.value)} min={0} />
            </div>
          </div>
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
  const [costo, set_costo] = useState(corso.costo_mensile || 0);
  const [note, set_note] = useState(corso.note || "");
  const [saving, set_saving] = useState(false);

  const save = async () => {
    set_saving(true);
    try {
      const update: any = { nome, tipo, livello_richiesto: livello, costo_mensile: costo, note };
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
            <div className="flex-1"><Label className="text-xs">Costo mensile</Label><Input type="number" value={costo} onChange={(e) => set_costo(+e.target.value)} /></div>
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
