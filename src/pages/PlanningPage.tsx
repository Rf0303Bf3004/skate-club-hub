import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_corsi, use_istruttori, use_stagioni } from "@/hooks/use-supabase-data";
import { X, Loader2, ChevronLeft, ChevronRight, Plus, Wrench, Eye, GripVertical, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Constants ──
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const OFF_ICE_TYPES = ["danza", "off-ice", "stretching"];
const OFF_ICE_COLORS: Record<string, string> = {
  danza: "#B83280",
  "off-ice": "#718096",
  stretching: "#276749",
};

type ViewMode = 1 | 2 | 3 | 7;

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}
function min_to_time(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ── Data hooks ──
function use_config_ghiaccio() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["configurazione_ghiaccio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("configurazione_ghiaccio")
        .select("*")
        .eq("club_id", club_id)
        .maybeSingle();
      return data;
    },
  });
}

function use_disponibilita_ghiaccio() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["disponibilita_ghiaccio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilita_ghiaccio")
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function use_disponibilita_istruttori() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["disponibilita_istruttori", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilita_istruttori")
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Helper: check if a course has valid ice coverage
function has_valid_ice(corso: any, ghiaccio_slots: any[]): boolean {
  if (!corso.giorno || !corso.ora_inizio || !corso.ora_fine) return false;
  // Off-ice types don't need ice
  if (OFF_ICE_TYPES.includes((corso.tipo || "").toLowerCase())) return true;
  const cs = time_to_min(corso.ora_inizio);
  const ce = time_to_min(corso.ora_fine);
  return ghiaccio_slots.some((s: any) =>
    s.giorno === corso.giorno && (s.tipo ?? "ghiaccio") === "ghiaccio" &&
    time_to_min(s.ora_inizio) <= cs && time_to_min(s.ora_fine) >= ce
  );
}

// ── Types ──
type DetailInfo = {
  type: "corso" | "private" | "pulizia" | "off-ice";
  nome?: string;
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
  tipo?: string;
  livello?: string;
  durata_min?: number;
  n_iscritti?: number;
  istruttori?: { nome: string; colore: string }[];
  alert_max?: boolean;
};

type DropConfirm = {
  corso: any;
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
};

// ── Draggable card in left panel ──
function DraggableCourseCard({ corso, istr_map, compatibility }: {
  corso: any;
  istr_map: Record<string, any>;
  compatibility: Record<string, "green" | "yellow" | "red">;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unpositioned-${corso.id}`,
    data: { corso, type: "unpositioned" },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  const istr_ids: string[] = corso.istruttori_ids ?? [];
  const durata = corso.ora_fine && corso.ora_inizio
    ? time_to_min(corso.ora_fine) - time_to_min(corso.ora_inizio)
    : 60;

  const tipo_key = (corso.tipo || "").toLowerCase();
  const tipo_colors: Record<string, string> = {
    ghiaccio: "#7F77DD",
    danza: "#B83280",
    "off-ice": "#718096",
    stretching: "#276749",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="border border-border rounded-lg p-3 bg-card cursor-grab active:cursor-grabbing space-y-2 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-bold text-sm text-foreground">{corso.nome}</span>
        </div>
        {corso.tipo && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
            style={{ backgroundColor: tipo_colors[tipo_key] || "#6B7280" }}
          >
            {corso.tipo}
          </span>
        )}
      </div>

      {istr_ids.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {istr_ids.map((id) => {
            const ist = istr_map[id];
            if (!ist) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 text-[10px] text-foreground">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ist.colore || "#6B7280" }} />
                {ist.nome} {ist.cognome}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{corso.atleti_ids?.length ?? 0} atleti</span>
        <span>{durata} min</span>
      </div>

      {/* Compatibility indicators */}
      <div className="flex gap-1">
        {GIORNI.map((g) => {
          const status = compatibility[g] || "red";
          const colors = { green: "#22C55E", yellow: "#EAB308", red: "#EF4444" };
          return (
            <div key={g} className="flex flex-col items-center gap-0.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[status] }} />
              <span className="text-[8px] text-muted-foreground">{g.slice(0, 2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ── Draggable course block on grid ──
function DraggableGridCourse({ corso, children, enabled }: {
  corso: any;
  children: React.ReactNode;
  enabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `positioned-${corso.id}`,
    data: { corso, type: "positioned" },
    disabled: !enabled,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
    opacity: isDragging ? 0.2 : 1,
    cursor: enabled ? "grab" : "pointer",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}


// ── Droppable slot on grid ──
function DroppableSlot({ id, giorno, start_min, end_min, range_start, total_min, row_h, is_valid, is_warning, is_build_mode }: {
  id: string;
  giorno: string;
  start_min: number;
  end_min: number;
  range_start: number;
  total_min: number;
  row_h: number;
  is_valid: boolean;
  is_warning: boolean;
  is_build_mode: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { giorno, start_min, end_min },
    disabled: !is_build_mode,
  });

  if (!is_build_mode) return null;

  const bg = isOver
    ? is_warning ? "rgba(251,146,60,0.3)" : is_valid ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.2)"
    : "transparent";

  return (
    <div
      ref={setNodeRef}
      className="absolute z-[0]"
      style={{
        left: `${((start_min - range_start) / total_min) * 100}%`,
        width: `${((end_min - start_min) / total_min) * 100}%`,
        top: 0,
        height: row_h,
        background: bg,
        border: isOver ? (is_valid ? "2px dashed #22C55E" : is_warning ? "2px dashed #FB923C" : "2px dashed #9CA3AF") : "none",
        borderRadius: 4,
        transition: "background 150ms, border 150ms",
      }}
    />
  );
}

// ── Main component ──
export default function PlanningPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: config, isLoading: loadingConfig } = use_config_ghiaccio();
  const { data: ghiaccio_slots, isLoading: loadingGhiaccio } = use_disponibilita_ghiaccio();
  const { data: disp_istr_raw } = use_disponibilita_istruttori();
  const { data: corsi_raw, isLoading: loadingCorsi } = use_corsi();
  const { data: istruttori_raw, isLoading: loadingIstr } = use_istruttori();
  const { data: stagioni_raw } = use_stagioni();
  
  const [detail, set_detail] = useState<DetailInfo | null>(null);
  const [view_mode, set_view_mode] = useState<ViewMode>(7);
  const [day_offset, set_day_offset] = useState(0);
  const [build_mode, set_build_mode] = useState(false);
  const [dragging_corso, set_dragging_corso] = useState<any>(null);
  const [dragging_type, set_dragging_type] = useState<"unpositioned" | "positioned" | null>(null);
  const [drop_confirm, set_drop_confirm] = useState<DropConfirm | null>(null);
  const [saving, set_saving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loading = loadingConfig || loadingGhiaccio || loadingCorsi || loadingIstr;

  const max_atleti = config?.max_atleti_contemporanei ?? 30;

  const corsi = useMemo(() => (corsi_raw ?? []).filter((c: any) => c.attivo !== false), [corsi_raw]);

  // Split courses into validly positioned vs to-position
  const { corsi_posizionati, corsi_da_posizionare } = useMemo(() => {
    const slots = ghiaccio_slots ?? [];
    const positioned: any[] = [];
    const to_position: any[] = [];
    corsi.forEach((c: any) => {
      if (has_valid_ice(c, slots)) {
        positioned.push(c);
      } else {
        to_position.push(c);
      }
    });
    return { corsi_posizionati: positioned, corsi_da_posizionare: to_position };
  }, [corsi, ghiaccio_slots]);
  const istruttori: any[] = istruttori_raw ?? [];
  const disp_istr = disp_istr_raw ?? [];

  // Active season
  const stagione_attiva = useMemo(() => {
    if (!stagioni_raw) return null;
    const today = new Date().toISOString().slice(0, 10);
    return stagioni_raw.find((s: any) => today >= s.data_inizio && today <= s.data_fine) || stagioni_raw[0] || null;
  }, [stagioni_raw]);

  // Visible days
  const visible_days = useMemo(() => {
    const start = day_offset;
    const count = view_mode;
    return GIORNI.slice(start, start + count).length > 0
      ? GIORNI.slice(start, Math.min(start + count, 7))
      : GIORNI.slice(0, count);
  }, [view_mode, day_offset]);

  const set_view = useCallback((m: ViewMode) => {
    set_view_mode(m);
    set_day_offset((prev) => Math.min(prev, 7 - m));
  }, []);

  const go_prev = () => set_day_offset((p) => Math.max(0, p - view_mode));
  const go_next = () => set_day_offset((p) => Math.min(6, Math.min(p + view_mode, 7 - view_mode)));

  // Instructor map
  const istr_map = useMemo(() => {
    const m: Record<string, { nome: string; cognome: string; colore: string; disponibilita: Record<string, { ora_inizio: string; ora_fine: string }[]> }> = {};
    istruttori.forEach((i: any) => {
      m[i.id] = {
        nome: i.nome,
        cognome: i.cognome,
        colore: i.colore || "#6B7280",
        disponibilita: i.disponibilita || {},
      };
    });
    return m;
  }, [istruttori]);

  // Compute time range from actual data
  const { range_start, range_end } = useMemo(() => {
    const all_slots = ghiaccio_slots ?? [];
    const all_corsi = corsi_posizionati;
    let mn = 24 * 60, mx = 0;
    all_slots.forEach((s: any) => {
      if (!visible_days.includes(s.giorno)) return;
      mn = Math.min(mn, time_to_min(s.ora_inizio));
      mx = Math.max(mx, time_to_min(s.ora_fine));
    });
    all_corsi.forEach((c: any) => {
      if (!visible_days.includes(c.giorno)) return;
      mn = Math.min(mn, time_to_min(c.ora_inizio));
      mx = Math.max(mx, time_to_min(c.ora_fine));
    });
    if (mn >= mx) { mn = 6 * 60; mx = 22 * 60; }
    mn = Math.floor(mn / 60) * 60;
    mx = Math.ceil(mx / 60) * 60;
    return { range_start: mn, range_end: mx };
  }, [ghiaccio_slots, corsi_posizionati, visible_days]);

  const total_min = range_end - range_start;

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let m = range_start; m <= range_end; m += 60) arr.push(m);
    return arr;
  }, [range_start, range_end]);

  // ── Metrics ──
  const metrics = useMemo(() => {
    const slots = ghiaccio_slots ?? [];
    let ore_ghiaccio = 0, ore_pulizia = 0, ore_corso = 0, ore_private = 0;

    visible_days.forEach((giorno) => {
      const day_ice = slots.filter((s: any) => s.giorno === giorno && (s.tipo ?? "ghiaccio") === "ghiaccio");
      const day_pulizia = slots.filter((s: any) => s.giorno === giorno && s.tipo === "pulizia");
      const day_corsi_ice = corsi_posizionati.filter((c: any) => c.giorno === giorno && !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));

      day_ice.forEach((s: any) => ore_ghiaccio += time_to_min(s.ora_fine) - time_to_min(s.ora_inizio));
      day_pulizia.forEach((s: any) => ore_pulizia += time_to_min(s.ora_fine) - time_to_min(s.ora_inizio));
      day_corsi_ice.forEach((c: any) => ore_corso += time_to_min(c.ora_fine) - time_to_min(c.ora_inizio));
    });

    ore_private = Math.max(0, ore_ghiaccio - ore_corso - ore_pulizia);

    return {
      ghiaccio: (ore_ghiaccio / 60).toFixed(1),
      corso: (ore_corso / 60).toFixed(1),
      private: (ore_private / 60).toFixed(1),
      pulizia: (ore_pulizia / 60).toFixed(1),
    };
  }, [ghiaccio_slots, corsi, visible_days]);

  const is_istr_available = (ist_id: string, giorno: string, cs: number, ce: number): boolean => {
    const slots = istr_map[ist_id]?.disponibilita[giorno] ?? [];
    return slots.some((s) => time_to_min(s.ora_inizio) <= cs && time_to_min(s.ora_fine) >= ce);
  };

  const get_day_instructors = useCallback((giorno: string) => {
    return istruttori.filter((ist: any) => {
      const slots = ist.disponibilita?.[giorno] ?? [];
      return slots.length > 0;
    });
  }, [istruttori]);

  const view_label = useMemo(() => {
    if (visible_days.length === 1) return visible_days[0];
    return `${visible_days[0]} — ${visible_days[visible_days.length - 1]}`;
  }, [visible_days]);

  const is_compact = view_mode >= 3;
  const LABEL_W = is_compact ? 80 : 130;
  const BASE_ROW_H = view_mode <= 2 ? 60 : view_mode === 3 ? 48 : 40;
  const EXTRA_PER_ROW = 30;
  const OFF_ICE_ROW_H = 18;

  // ── Compatibility for unpositioned courses ──
  const get_compatibility = useCallback((corso: any): Record<string, "green" | "yellow" | "red"> => {
    const result: Record<string, "green" | "yellow" | "red"> = {};
    const istr_ids: string[] = corso.istruttori_ids ?? [];
    const all_slots = ghiaccio_slots ?? [];

    GIORNI.forEach((giorno) => {
      const has_ice = all_slots.some((s: any) => s.giorno === giorno && (s.tipo ?? "ghiaccio") === "ghiaccio");
      const has_istr = istr_ids.length === 0 || istr_ids.some((id) => {
        const d = disp_istr.filter((x: any) => x.istruttore_id === id && x.giorno === giorno);
        return d.length > 0;
      });

      if (has_ice && has_istr) result[giorno] = "green";
      else if (has_ice || has_istr) result[giorno] = "yellow";
      else result[giorno] = "red";
    });
    return result;
  }, [ghiaccio_slots, disp_istr]);

  // ── Drop zone slots: for each day, create droppable zones at each ice slot ──
  const get_drop_slots = useCallback((giorno: string) => {
    const all_slots = ghiaccio_slots ?? [];
    const ice = all_slots.filter((s: any) => s.giorno === giorno && (s.tipo ?? "ghiaccio") === "ghiaccio");
    return ice.map((s: any) => ({
      id: `drop-${giorno}-${s.ora_inizio}-${s.ora_fine}`,
      giorno,
      start_min: time_to_min(s.ora_inizio),
      end_min: time_to_min(s.ora_fine),
    }));
  }, [ghiaccio_slots]);

  // Check if drop is valid for a given course
  const check_drop_validity = useCallback((corso: any, giorno: string, start_min: number): { valid: boolean; warning: boolean } => {
    const istr_ids: string[] = corso.istruttori_ids ?? [];
    const durata = corso.ora_fine && corso.ora_inizio
      ? time_to_min(corso.ora_fine) - time_to_min(corso.ora_inizio)
      : 60;
    const end_min = start_min + durata;

    // Check ice availability
    const all_slots = ghiaccio_slots ?? [];
    const has_ice = all_slots.some((s: any) =>
      s.giorno === giorno && (s.tipo ?? "ghiaccio") === "ghiaccio" &&
      time_to_min(s.ora_inizio) <= start_min && time_to_min(s.ora_fine) >= end_min
    );
    if (!has_ice) return { valid: false, warning: false };

    // Check instructor availability
    const istr_ok = istr_ids.length === 0 || istr_ids.some((id) =>
      is_istr_available(id, giorno, start_min, end_min)
    );
    if (!istr_ok) return { valid: false, warning: false };

    // Check capacity
    const day_corsi_ice = corsi.filter((c: any) => c.id !== corso.id && c.giorno === giorno && !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
    const concurrent = day_corsi_ice.filter((c: any) => {
      const s = time_to_min(c.ora_inizio);
      const e = time_to_min(c.ora_fine);
      return s < end_min && e > start_min;
    });
    const total_athletes = concurrent.reduce((sum: number, c: any) => sum + (c.atleti_ids?.length ?? 0), 0) + (corso.atleti_ids?.length ?? 0);
    if (total_athletes > max_atleti) return { valid: true, warning: true };

    return { valid: true, warning: false };
  }, [ghiaccio_slots, corsi, max_atleti, is_istr_available]);

  // ── DnD handlers ──
  const handle_drag_start = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.corso) {
      set_dragging_corso(data.corso);
      set_dragging_type(data.type as "unpositioned" | "positioned");
    }
  };

  const handle_drag_end = async (event: DragEndEvent) => {
    const was_type = dragging_type;
    const was_corso = dragging_corso;
    set_dragging_corso(null);
    set_dragging_type(null);
    const { active, over } = event;

    // If positioned course dropped outside grid or on invalid slot → unposition it
    if (was_type === "positioned" && was_corso) {
      const drop_data = over?.data?.current;
      const has_valid_drop = drop_data?.giorno;

      if (!has_valid_drop) {
        // Dropped outside → set giorno=NULL
        try {
          await supabase.from("corsi").update({ giorno: null, ora_inizio: null, ora_fine: null } as any).eq("id", was_corso.id);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["corsi"] }),
          ]);
          toast.info(`${was_corso.nome} rimosso dal planning`);
        } catch (e: any) {
          toast.error("Errore: " + e.message);
        }
        return;
      }

      // Check validity
      const durata = was_corso.ora_fine && was_corso.ora_inizio
        ? time_to_min(was_corso.ora_fine) - time_to_min(was_corso.ora_inizio)
        : 60;
      const start_min = drop_data.start_min as number;
      const { valid } = check_drop_validity(was_corso, drop_data.giorno, start_min);
      if (!valid) {
        // Invalid slot → unposition
        try {
          await supabase.from("corsi").update({ giorno: null, ora_inizio: null, ora_fine: null } as any).eq("id", was_corso.id);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["corsi"] }),
          ]);
          toast.info(`${was_corso.nome} rimosso dal planning (slot non valido)`);
        } catch (e: any) {
          toast.error("Errore: " + e.message);
        }
        return;
      }

      // Valid drop → show confirm
      const end_min = start_min + durata;
      set_drop_confirm({
        corso: was_corso,
        giorno: drop_data.giorno,
        ora_inizio: min_to_time(start_min),
        ora_fine: min_to_time(end_min),
      });
      return;
    }

    // Unpositioned course drag
    if (!over || !active.data.current?.corso) return;
    const corso = active.data.current.corso;
    const drop_data = over.data.current;
    if (!drop_data?.giorno) return;

    const durata = corso.ora_fine && corso.ora_inizio
      ? time_to_min(corso.ora_fine) - time_to_min(corso.ora_inizio)
      : 60;
    const start_min = drop_data.start_min as number;
    const end_min = start_min + durata;

    const { valid } = check_drop_validity(corso, drop_data.giorno, start_min);
    if (!valid) {
      toast.error("Slot non compatibile per questo corso");
      return;
    }

    set_drop_confirm({
      corso,
      giorno: drop_data.giorno,
      ora_inizio: min_to_time(start_min),
      ora_fine: min_to_time(end_min),
    });
  };

  const confirm_drop = async () => {
    if (!drop_confirm) return;
    set_saving(true);
    try {
      const { error } = await supabase.from("corsi").update({
        giorno: drop_confirm.giorno,
        ora_inizio: drop_confirm.ora_inizio,
        ora_fine: drop_confirm.ora_fine,
      }).eq("id", drop_confirm.corso.id);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["corsi"] });
      toast.success(`${drop_confirm.corso.nome} posizionato con successo`);
    } catch (e: any) {
      toast.error("Errore nel posizionamento: " + e.message);
    } finally {
      set_saving(false);
      set_drop_confirm(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ghiaccio_slots || ghiaccio_slots.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground space-y-3">
        <p className="text-lg font-medium">Nessuna disponibilità ghiaccio configurata.</p>
        <p className="text-sm">Vai in Configurazione Club → sezione Ghiaccio.</p>
      </div>
    );
  }

  const unpositioned = corsi_da_posizionare;
  const all_positioned = unpositioned.length === 0;

  // ── RENDER ──
  const render_grid = () => (
    <div className="border border-border rounded-lg overflow-x-auto bg-card">
      {/* Time header */}
      <div className="flex border-b border-border sticky top-0 bg-card z-10">
        <div className="flex-shrink-0 border-r border-border" style={{ width: LABEL_W }} />
        <div className="flex-1 relative" style={{ minWidth: total_min * 1.2 }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute text-[10px] text-muted-foreground top-0 -translate-x-1/2"
              style={{ left: `${((t - range_start) / total_min) * 100}%` }}
            >
              {min_to_time(t)}
            </span>
          ))}
          <div className="h-5" />
        </div>
      </div>

      {/* Day rows */}
      {visible_days.map((giorno) => {
        const all_slots = ghiaccio_slots ?? [];
        const day_ghiaccio = all_slots.filter((g: any) => g.giorno === giorno && (g.tipo ?? "ghiaccio") === "ghiaccio");
        const day_pulizia = all_slots.filter((g: any) => g.giorno === giorno && g.tipo === "pulizia");
        const day_corsi_ice = corsi_posizionati.filter((c: any) => c.giorno === giorno && !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
        const day_corsi_off = corsi_posizionati.filter((c: any) => c.giorno === giorno && OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
        const day_instructors = get_day_instructors(giorno);

        const compute_course_rows = (courses: any[]): any[][] => {
          if (courses.length === 0) return [[]];
          const sorted = [...courses].sort((a, b) => time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio));
          const rows: any[][] = [];
          sorted.forEach((c) => {
            const cs = time_to_min(c.ora_inizio);
            let placed = false;
            for (const row of rows) {
              const last = row[row.length - 1];
              if (time_to_min(last.ora_fine) <= cs) {
                row.push(c);
                placed = true;
                break;
              }
            }
            if (!placed) rows.push([c]);
          });
          return rows.length > 0 ? rows : [[]];
        };

        const course_rows = compute_course_rows(day_corsi_ice);
        const n_sub_rows = Math.max(course_rows.length, 1);
        const day_ice_min = day_ghiaccio.reduce((acc: number, s: any) => acc + time_to_min(s.ora_fine) - time_to_min(s.ora_inizio), 0);
        const day_ice_h = (day_ice_min / 60).toFixed(1);
        const n_instructors_avail = day_instructors.length;

        const check_capacity_alert = (corso: any): boolean => {
          const cs = time_to_min(corso.ora_inizio);
          const ce = time_to_min(corso.ora_fine);
          const concurrent = day_corsi_ice.filter((c: any) => {
            const s = time_to_min(c.ora_inizio);
            const e = time_to_min(c.ora_fine);
            return s < ce && e > cs;
          });
          const total = concurrent.reduce((sum: number, c: any) => sum + (c.atleti_ids?.length ?? 0), 0);
          return total > max_atleti;
        };

        const row_h = BASE_ROW_H + Math.max(0, n_sub_rows - 1) * EXTRA_PER_ROW;
        const sub_row_h = n_sub_rows > 1 ? row_h / n_sub_rows : row_h;

        const drop_slots = build_mode ? get_drop_slots(giorno) : [];

        return (
          <div key={giorno} className="border-b border-border last:border-b-0">
            <div className="flex">
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center border-r border-border bg-muted px-1"
                style={{ width: LABEL_W, minHeight: row_h }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }} className="text-foreground leading-tight">{giorno}</span>
                <span style={{ fontSize: 11 }} className="text-muted-foreground leading-tight">{day_ice_h}h ghiaccio</span>
              </div>

              <div className="flex-1 relative" style={{ minWidth: total_min * 1.2, height: row_h }}>
                {/* Drop zones (build mode only) */}
                {drop_slots.map((slot) => {
                  const validity = dragging_corso ? check_drop_validity(dragging_corso, giorno, slot.start_min) : { valid: false, warning: false };
                  return (
                    <DroppableSlot
                      key={slot.id}
                      id={slot.id}
                      giorno={giorno}
                      start_min={slot.start_min}
                      end_min={slot.end_min}
                      range_start={range_start}
                      total_min={total_min}
                      row_h={row_h}
                      is_valid={validity.valid}
                      is_warning={validity.warning}
                      is_build_mode={build_mode}
                    />
                  );
                })}

                {/* Ghiaccio background */}
                {day_ghiaccio.map((g: any, gi: number) => {
                  const gs = time_to_min(g.ora_inizio);
                  const ge = time_to_min(g.ora_fine);
                  return (
                    <div
                      key={`g-${gi}`}
                      className="absolute"
                      style={{
                        left: `${((gs - range_start) / total_min) * 100}%`,
                        width: `${((ge - gs) / total_min) * 100}%`,
                        top: 0,
                        bottom: 0,
                        background: "#EEEDFE",
                        border: "1px solid #AFA9EC",
                        borderRadius: 6,
                      }}
                    />
                  );
                })}

                {/* Pulizia */}
                {day_pulizia.map((p: any, pi: number) => {
                  const ps = time_to_min(p.ora_inizio);
                  const pe = time_to_min(p.ora_fine);
                  return (
                    <div
                      key={`p-${pi}`}
                      className="absolute cursor-pointer flex items-center justify-center overflow-hidden z-[2]"
                      style={{
                        left: `${((ps - range_start) / total_min) * 100}%`,
                        width: `${((pe - ps) / total_min) * 100}%`,
                        top: 4,
                        bottom: 4,
                        background: "#9CA3AF",
                        opacity: 0.75,
                        borderRadius: 4,
                        color: "#fff",
                      }}
                      onClick={() => set_detail({
                        type: "pulizia", giorno,
                        ora_inizio: p.ora_inizio, ora_fine: p.ora_fine,
                        durata_min: time_to_min(p.ora_fine) - time_to_min(p.ora_inizio),
                      })}
                    >
                      <span className="text-[9px] font-semibold truncate px-0.5">
                        {!is_compact ? `Pulizia ${p.ora_inizio?.slice(0, 5)}–${p.ora_fine?.slice(0, 5)}` : "Pul."}
                      </span>
                    </div>
                  );
                })}

                {/* Private slots */}
                {day_ghiaccio.map((g: any, gi: number) => {
                  const gs = time_to_min(g.ora_inizio);
                  const ge = time_to_min(g.ora_fine);
                  const occupied = [...day_corsi_ice, ...day_pulizia].map((c: any) => ({
                    s: Math.max(time_to_min(c.ora_inizio), gs),
                    e: Math.min(time_to_min(c.ora_fine ?? c.ora_fine), ge),
                  })).filter((x) => x.s < x.e).sort((a, b) => a.s - b.s);
                  const gaps: { s: number; e: number }[] = [];
                  let cursor = gs;
                  occupied.forEach((r) => {
                    if (r.s > cursor) gaps.push({ s: cursor, e: r.s });
                    cursor = Math.max(cursor, r.e);
                  });
                  if (cursor < ge) gaps.push({ s: cursor, e: ge });

                  return gaps.map((gap, gapi) => (
                    <div
                      key={`priv-${gi}-${gapi}`}
                      className="absolute cursor-pointer flex flex-col items-center justify-center overflow-hidden z-[1]"
                      style={{
                        left: `${((gap.s - range_start) / total_min) * 100}%`,
                        width: `${((gap.e - gap.s) / total_min) * 100}%`,
                        top: 4,
                        bottom: 4,
                        background: "#FB923C",
                        opacity: 0.85,
                        borderRadius: 4,
                        color: "#fff",
                      }}
                      onClick={() => set_detail({
                        type: "private", giorno,
                        ora_inizio: min_to_time(gap.s), ora_fine: min_to_time(gap.e),
                        durata_min: gap.e - gap.s,
                        istruttori: day_instructors.map((ist: any) => ({
                          nome: `${ist.nome} ${ist.cognome}`,
                          colore: ist.colore || "#6B7280",
                        })),
                      })}
                    >
                      <span style={{ fontSize: 10, fontWeight: 600 }} className="truncate px-0.5 leading-tight">
                        Private ({n_instructors_avail} istruttori)
                      </span>
                      {!is_compact && (
                        <span style={{ fontSize: 9, opacity: 0.75 }} className="truncate px-0.5 leading-tight">
                          {min_to_time(gap.s)}–{min_to_time(gap.e)}
                        </span>
                      )}
                    </div>
                  ));
                })}

                {/* Courses */}
                {course_rows.map((row_courses, row_idx) =>
                  row_courses.map((c: any, ci: number) => {
                    const cs = time_to_min(c.ora_inizio);
                    const ce = time_to_min(c.ora_fine);
                    const alert = check_capacity_alert(c);
                    const istr_ids: string[] = c.istruttori_ids ?? [];
                    const first_istr = istr_ids.length > 0 ? istr_map[istr_ids[0]] : null;
                    const colore = first_istr?.colore || "#3B82F6";
                    const istr_available = istr_ids.length > 0 ? istr_ids.every((id) => is_istr_available(id, giorno, cs, ce)) : true;

                    const bg = istr_available
                      ? colore
                      : `repeating-linear-gradient(45deg, ${colore} 0px, ${colore} 4px, transparent 4px, transparent 8px)`;

                    const corso_istruttori = istr_ids.map((id) => ({
                      nome: istr_map[id] ? `${istr_map[id].nome} ${istr_map[id].cognome}` : id,
                      colore: istr_map[id]?.colore || "#6B7280",
                    }));

                    const top_px = row_idx * sub_row_h + 2;
                    const h_px = sub_row_h - 4;
                    const is_being_dragged = dragging_type === "positioned" && dragging_corso?.id === c.id;

                    const inner = (
                      <div
                        className="absolute rounded flex flex-col justify-center overflow-hidden z-[3]"
                        style={{
                          left: `${((cs - range_start) / total_min) * 100}%`,
                          width: `${((ce - cs) / total_min) * 100}%`,
                          top: top_px,
                          height: h_px,
                          background: is_being_dragged ? "rgba(156,163,175,0.3)" : bg,
                          color: "#fff",
                          border: is_being_dragged ? "2px dashed #9CA3AF" : alert ? "2px solid #E24B4A" : "1px solid rgba(0,0,0,0.15)",
                          borderRadius: 4,
                          cursor: build_mode ? "grab" : "pointer",
                        }}
                        onClick={() => !build_mode && set_detail({
                          type: "corso", nome: c.nome, giorno, tipo: c.tipo,
                          ora_inizio: c.ora_inizio, ora_fine: c.ora_fine,
                          livello: c.livello_richiesto,
                          durata_min: ce - cs,
                          n_iscritti: c.atleti_ids?.length ?? 0,
                          istruttori: corso_istruttori,
                          alert_max: alert,
                        })}
                      >
                        {!is_being_dragged && (
                          <>
                            <span style={{ fontSize: is_compact ? 10 : 11, fontWeight: 700 }} className="truncate px-1 leading-tight text-white">
                              {c.nome || (c.tipo || "").toLowerCase()}
                            </span>
                            {!is_compact && (
                              <span style={{ fontSize: 10, opacity: 0.75 }} className="truncate px-1 leading-tight text-white">
                                {corso_istruttori.map((i) => i.nome).join(", ")} {c.ora_inizio?.slice(0, 5)}–{c.ora_fine?.slice(0, 5)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );

                    if (build_mode) {
                      return (
                        <DraggableGridCourse key={`c-${row_idx}-${ci}`} corso={c} enabled={build_mode}>
                          {inner}
                        </DraggableGridCourse>
                      );
                    }

                    return <React.Fragment key={`c-${row_idx}-${ci}`}>{inner}</React.Fragment>;
                  })
                )}
              </div>
            </div>

            {/* OFF-ICE ROW */}
            {day_corsi_off.length > 0 && (
              <div className="flex">
                <div
                  className="flex-shrink-0 flex items-center justify-center text-[9px] text-muted-foreground border-r border-border bg-muted/50 italic px-1"
                  style={{ width: LABEL_W, height: OFF_ICE_ROW_H }}
                >
                  fuori ghiaccio
                </div>
                <div className="flex-1 relative" style={{ height: OFF_ICE_ROW_H, minWidth: total_min * 1.2 }}>
                  {day_corsi_off.map((c: any, i: number) => {
                    const cs = time_to_min(c.ora_inizio);
                    const ce = time_to_min(c.ora_fine);
                    const tipo_key = (c.tipo || "").toLowerCase();
                    const bg_color = OFF_ICE_COLORS[tipo_key] || "#94A3B8";
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-full rounded-sm cursor-pointer flex items-center justify-center overflow-hidden"
                        style={{
                          left: `${((cs - range_start) / total_min) * 100}%`,
                          width: `${((ce - cs) / total_min) * 100}%`,
                          background: bg_color,
                          color: "#fff",
                        }}
                        onClick={() => set_detail({
                          type: "off-ice", nome: c.nome, giorno, tipo: c.tipo,
                          ora_inizio: c.ora_inizio, ora_fine: c.ora_fine,
                          durata_min: ce - cs,
                          livello: c.livello_richiesto,
                          n_iscritti: c.atleti_ids?.length ?? 0,
                          istruttori: (c.istruttori_ids ?? []).map((id: string) => ({
                            nome: istr_map[id] ? `${istr_map[id].nome} ${istr_map[id].cognome}` : id,
                            colore: istr_map[id]?.colore || "#6B7280",
                          })),
                        })}
                      >
                        <span className="text-[9px] font-medium truncate px-0.5">{c.nome || tipo_key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <DndContext sensors={sensors} onDragStart={handle_drag_start} onDragEnd={handle_drag_end}>
      <div className="p-4 space-y-4">
        {/* ── TOOLBAR ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-foreground">
            Planning Ghiaccio{stagione_attiva ? ` — ${stagione_attiva.nome}` : ""}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={build_mode ? "default" : "outline"}
              onClick={() => set_build_mode(!build_mode)}
              className="gap-1.5"
            >
              {build_mode ? <><Eye className="h-4 w-4" /> Modalità visualizzazione</> : <><Wrench className="h-4 w-4" /> Modalità costruzione</>}
            </Button>
            <Button size="sm" onClick={() => navigate("/corsi")} className="gap-1">
              <Plus className="h-4 w-4" /> Aggiungi corso
            </Button>
          </div>
        </div>

        {/* View mode + navigation */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {([1, 2, 3, 7] as ViewMode[]).map((m, idx) => (
              <button
                key={m}
                onClick={() => set_view(m)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view_mode === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-muted"
                } ${idx > 0 ? "border-l border-border" : ""}`}
              >
                {m === 1 ? "Giorno" : m === 2 ? "2 giorni" : m === 3 ? "3 giorni" : "Settimana"}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={go_prev} disabled={day_offset === 0}>
              <ChevronLeft className="h-4 w-4" /> Precedente
            </Button>
            <span className="text-sm font-medium text-foreground min-w-[140px] text-center">{view_label}</span>
            <Button variant="outline" size="sm" onClick={go_next} disabled={day_offset + view_mode >= 7}>
              Successivo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── METRICHE ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Ore ghiaccio", value: metrics.ghiaccio, color: "#7F77DD" },
            { label: "Ore corso", value: metrics.corso, color: "#3B82F6" },
            { label: "Ore private", value: metrics.private, color: "#FB923C" },
            { label: "Ore pulizia", value: metrics.pulizia, color: "#9CA3AF" },
          ].map((m) => (
            <Card key={m.label} className="p-3 flex items-center gap-3">
              <div className="w-3 h-10 rounded-full" style={{ backgroundColor: m.color }} />
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-bold text-foreground">{m.value}h</p>
              </div>
            </Card>
          ))}
        </div>

        {/* ── LEGENDA ISTRUTTORI ── */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Istruttori</p>
          <div className="flex flex-wrap gap-1.5">
            {istruttori.map((ist: any) => (
              <span
                key={ist.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
                style={{
                  borderColor: ist.colore || "#6B7280",
                  backgroundColor: `${ist.colore || "#6B7280"}20`,
                  color: ist.colore || "#6B7280",
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ist.colore || "#6B7280" }} />
                {ist.nome} {ist.cognome}
              </span>
            ))}
          </div>
        </div>

        {/* ── LEGENDA TIPI ── */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#EEEDFE", color: "#7F77DD", border: "1px solid #AFA9EC" }}>Ghiaccio disponibile</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#FB923C", color: "#fff" }}>Lezioni private</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#9CA3AF", color: "#fff" }}>Pulizia ghiaccio</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#B83280", color: "#fff" }}>Danza *</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#718096", color: "#fff" }}>Off-Ice *</span>
          <span className="px-2 py-0.5 rounded font-medium" style={{ background: "#276749", color: "#fff" }}>Stretching *</span>
          <span className="text-muted-foreground italic self-center">* senza ghiaccio</span>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className={build_mode ? "flex gap-4" : ""}>
          {/* LEFT PANEL — build mode only */}
          {build_mode && (
            <div className="flex-shrink-0 space-y-3" style={{ width: 280 }}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">
                  Corsi da posizionare ({unpositioned.length})
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : all_positioned && !dragging_corso ? (
                <div className="border border-border rounded-lg p-4 text-center space-y-1 bg-muted/30">
                  <Check className="h-6 w-6 text-green-500 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Tutti i corsi sono stati posizionati</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {/* Show dragged positioned course as "in movimento" */}
                  {dragging_type === "positioned" && dragging_corso && (
                    <div className="border-2 border-dashed border-primary rounded-lg p-3 bg-primary/5 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-bold text-sm text-foreground">{dragging_corso.nome}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-primary border-primary">
                        In movimento
                      </Badge>
                    </div>
                  )}
                  {unpositioned.map((corso: any) => (
                    <DraggableCourseCard
                      key={corso.id}
                      corso={corso}
                      istr_map={istr_map}
                      compatibility={get_compatibility(corso)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RIGHT — Grid */}
          <div className="flex-1 min-w-0 space-y-4">
            {render_grid()}

            {/* ── DETAIL PANEL ── */}
            {detail && (
              <div className="border border-border rounded-lg p-4 bg-card relative">
                <button
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                  onClick={() => set_detail(null)}
                >
                  <X className="h-5 w-5" />
                </button>

                {(detail.type === "corso" || detail.type === "off-ice") && (
                  <div className="space-y-1.5 text-sm">
                    <p className="font-bold text-foreground text-base">{detail.nome}</p>
                    <p className="text-muted-foreground">{detail.giorno} — {detail.ora_inizio?.slice(0, 5)} / {detail.ora_fine?.slice(0, 5)}</p>
                    <p>Tipo: <span className="font-medium">{detail.tipo}</span></p>
                    {detail.livello && <p>Livello: {detail.livello}</p>}
                    <p>Durata: {detail.durata_min} min</p>
                    <p>Iscritti: <span className="font-semibold">{detail.n_iscritti}</span></p>
                    {detail.istruttori && detail.istruttori.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {detail.istruttori.map((ist, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
                            style={{ borderColor: ist.colore, backgroundColor: `${ist.colore}20`, color: ist.colore }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ist.colore }} />
                            {ist.nome}
                          </span>
                        ))}
                      </div>
                    )}
                    {detail.alert_max && (
                      <p className="text-[#E24B4A] font-semibold mt-1">⚠ Superato limite max atleti contemporanei ({max_atleti})</p>
                    )}
                  </div>
                )}

                {detail.type === "private" && (
                  <div className="space-y-1.5 text-sm">
                    <p className="font-bold text-foreground text-base">Slot Lezione Privata</p>
                    <p className="text-muted-foreground">{detail.giorno} — {detail.ora_inizio?.slice(0, 5)} / {detail.ora_fine?.slice(0, 5)}</p>
                    <p>Durata: {detail.durata_min} min</p>
                    <p className="font-medium">Istruttori disponibili ({detail.istruttori?.length ?? 0}):</p>
                    {detail.istruttori && detail.istruttori.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {detail.istruttori.map((ist, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
                            style={{ borderColor: ist.colore, backgroundColor: `${ist.colore}20`, color: ist.colore }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ist.colore }} />
                            {ist.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detail.type === "pulizia" && (
                  <div className="space-y-1 text-sm">
                    <p className="font-bold text-foreground text-base">Pulizia Ghiaccio</p>
                    <p className="text-muted-foreground">{detail.giorno} — {detail.ora_inizio?.slice(0, 5)} / {detail.ora_fine?.slice(0, 5)}</p>
                    <p>Durata: {detail.durata_min} min</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {dragging_corso && (
          <div className="border border-primary rounded-lg p-3 bg-card shadow-lg opacity-90 w-[260px]">
            <span className="font-bold text-sm text-foreground">{dragging_corso.nome}</span>
            {dragging_corso.tipo && (
              <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "#7F77DD" }}>
                {dragging_corso.tipo}
              </span>
            )}
          </div>
        )}
      </DragOverlay>

      {/* Confirm dialog */}
      <Dialog open={!!drop_confirm} onOpenChange={(open) => !open && set_drop_confirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma posizionamento</DialogTitle>
            <DialogDescription>
              Posizionare <strong>{drop_confirm?.corso?.nome}</strong> il <strong>{drop_confirm?.giorno}</strong> dalle{" "}
              <strong>{drop_confirm?.ora_inizio?.slice(0, 5)}</strong> alle <strong>{drop_confirm?.ora_fine?.slice(0, 5)}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_drop_confirm(null)} disabled={saving}>Annulla</Button>
            <Button onClick={confirm_drop} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
