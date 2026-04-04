import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Save, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

// ── Constants ──
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const TIPO_COLORI: Record<string, string> = {
  pulcini: "bg-green-500/80 border-green-600",
  amatori: "bg-blue-500/80 border-blue-600",
  artistica: "bg-violet-500/80 border-violet-600",
  stile: "bg-orange-500/80 border-orange-600",
  danza: "bg-pink-500/80 border-pink-600",
  "off-ice": "bg-gray-500/80 border-gray-600",
  adulti: "bg-teal-500/80 border-teal-600",
  stretching: "bg-yellow-500/80 border-yellow-600",
};
const ISTRUTTORE_COLORI = [
  "bg-rose-400", "bg-sky-400", "bg-emerald-400", "bg-amber-400",
  "bg-purple-400", "bg-cyan-400", "bg-lime-400", "bg-fuchsia-400",
  "bg-indigo-400", "bg-orange-400",
];

function time_to_min(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function min_to_time(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function generate_slots(start: string, end: string, dur: number): string[] {
  const s = time_to_min(start);
  const e = time_to_min(end);
  const slots: string[] = [];
  for (let t = s; t < e; t += dur) slots.push(min_to_time(t));
  return slots;
}

// ── Draggable Course Block ──
function DraggableCorso({ corso, istruttore_nome, span }: { corso: any; istruttore_nome: string; span: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `corso-${corso.id}`,
    data: { corso },
  });
  const tipo = (corso.tipo || "").toLowerCase();
  const colori = TIPO_COLORI[tipo] || "bg-muted border-border";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute left-0 right-0 z-20 rounded border text-[10px] leading-tight p-1 cursor-grab text-white font-medium overflow-hidden ${colori} ${isDragging ? "opacity-40" : ""}`}
      style={{ top: 0, height: `${span * 100}%` }}
    >
      <div className="truncate font-semibold">{corso.nome}</div>
      {istruttore_nome && <div className="truncate opacity-80">{istruttore_nome}</div>}
    </div>
  );
}

// ── Droppable Cell ──
function DroppableCell({
  id,
  has_ice,
  children,
}: {
  id: string;
  has_ice: boolean;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { has_ice } });
  return (
    <div
      ref={setNodeRef}
      className={`relative border-r border-b border-border min-h-[28px] ${
        has_ice ? "bg-sky-100/60 dark:bg-sky-900/20" : ""
      } ${isOver && has_ice ? "ring-2 ring-primary/50" : ""} ${isOver && !has_ice ? "ring-2 ring-destructive/50" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Main Page ──
export default function PlanningPage() {
  const { session } = useAuth();
  const club_id = session?.club_id || get_current_club_id();
  const qc = useQueryClient();

  // State
  const [show_istruttori, set_show_istruttori] = useState(true);
  const [filtro_istruttore, set_filtro_istruttore] = useState<string>("tutti");
  const [config_open, set_config_open] = useState(false);
  const [new_corso_open, set_new_corso_open] = useState(false);
  const [new_corso_giorno, set_new_corso_giorno] = useState("Lunedì");
  const [new_corso_ora, set_new_corso_ora] = useState("08:00");
  const [new_corso_nome, set_new_corso_nome] = useState("");
  const [new_corso_tipo, set_new_corso_tipo] = useState("");
  const [dragged_corso, set_dragged_corso] = useState<any>(null);
  const [conflict_dialog, set_conflict_dialog] = useState<{ corso: any; giorno: string; ora_inizio: string; ora_fine: string } | null>(null);

  // Config state
  const [cfg_ora_inizio, set_cfg_ora_inizio] = useState("06:00");
  const [cfg_ora_fine, set_cfg_ora_fine] = useState("22:30");
  const [cfg_durata, set_cfg_durata] = useState(20);

  // ── Queries ──
  const { data: config } = useQuery({
    queryKey: ["impostazioni_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("impostazioni_planning")
        .select("*")
        .eq("club_id", club_id)
        .maybeSingle();
      return data;
    },
    enabled: !!club_id,
  });

  const ora_inizio = config?.ora_inizio_giornata?.slice(0, 5) || "06:00";
  const ora_fine = config?.ora_fine_giornata?.slice(0, 5) || "22:30";
  const durata = config?.durata_slot_minuti || 20;

  const slots = useMemo(() => generate_slots(ora_inizio, ora_fine, durata), [ora_inizio, ora_fine, durata]);

  const { data: ghiaccio = [] } = useQuery({
    queryKey: ["disponibilita_ghiaccio", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("disponibilita_ghiaccio").select("*").eq("club_id", club_id);
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: corsi = [] } = useQuery({
    queryKey: ["corsi_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("corsi").select("*").eq("club_id", club_id).eq("attivo", true);
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: corsi_istruttori_raw = [] } = useQuery({
    queryKey: ["corsi_istruttori_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("corsi_istruttori").select("*");
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: istruttori_raw = [] } = useQuery({
    queryKey: ["istruttori_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("atleti").select("id, nome, cognome").eq("club_id", club_id).eq("ruolo_pista", "istruttore");
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: disp_istruttori = [] } = useQuery({
    queryKey: ["disponibilita_istruttori", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("disponibilita_istruttori").select("*").eq("club_id", club_id);
      return data || [];
    },
    enabled: !!club_id,
  });

  // ── Derived data ──
  const istruttori_map = useMemo(() => {
    const m: Record<string, { nome: string; cognome: string; colore: string }> = {};
    istruttori_raw.forEach((ist: any, i: number) => {
      m[ist.id] = { nome: ist.nome, cognome: ist.cognome, colore: ISTRUTTORE_COLORI[i % ISTRUTTORE_COLORI.length] };
    });
    return m;
  }, [istruttori_raw]);

  const corso_istruttore_map = useMemo(() => {
    const m: Record<string, string> = {};
    corsi_istruttori_raw.forEach((ci: any) => {
      m[ci.corso_id] = ci.istruttore_id;
    });
    return m;
  }, [corsi_istruttori_raw]);

  // Check if a cell has ice
  const has_ice = useCallback(
    (giorno: string, slot_time: string): boolean => {
      const slot_min = time_to_min(slot_time);
      return ghiaccio.some((g: any) => {
        if (g.giorno !== giorno) return false;
        const gi = time_to_min(g.ora_inizio);
        const gf = time_to_min(g.ora_fine);
        return slot_min >= gi && slot_min < gf;
      });
    },
    [ghiaccio]
  );

  // Check if instructor is available
  const is_istruttore_disponibile = useCallback(
    (istruttore_id: string, giorno: string, ora_inizio_slot: string, ora_fine_slot: string): boolean => {
      const si = time_to_min(ora_inizio_slot);
      const sf = time_to_min(ora_fine_slot);
      return disp_istruttori.some((d: any) => {
        if (d.istruttore_id !== istruttore_id || d.giorno !== giorno) return false;
        const di = time_to_min(d.ora_inizio);
        const df = time_to_min(d.ora_fine);
        return si >= di && sf <= df;
      });
    },
    [disp_istruttori]
  );

  // Get instructor badges for a cell
  const get_badges = useCallback(
    (giorno: string, slot_time: string) => {
      if (!show_istruttori) return [];
      const slot_min = time_to_min(slot_time);
      const badges: { id: string; initials: string; colore: string }[] = [];
      disp_istruttori.forEach((d: any) => {
        if (d.giorno !== giorno) return;
        if (filtro_istruttore !== "tutti" && d.istruttore_id !== filtro_istruttore) return;
        const di = time_to_min(d.ora_inizio);
        const df = time_to_min(d.ora_fine);
        if (slot_min >= di && slot_min < df) {
          const ist = istruttori_map[d.istruttore_id];
          if (ist) {
            badges.push({
              id: d.istruttore_id,
              initials: `${ist.nome?.[0] || ""}${ist.cognome?.[0] || ""}`,
              colore: ist.colore,
            });
          }
        }
      });
      return badges;
    },
    [show_istruttori, disp_istruttori, filtro_istruttore, istruttori_map]
  );

  // Get course for a cell
  const get_corso_at = useCallback(
    (giorno: string, slot_time: string) => {
      const slot_min = time_to_min(slot_time);
      return corsi.find((c: any) => {
        if (c.giorno !== giorno) return false;
        const ci = time_to_min(c.ora_inizio);
        return slot_min === ci;
      });
    },
    [corsi]
  );

  const get_corso_span = useCallback(
    (corso: any): number => {
      const ci = time_to_min(corso.ora_inizio);
      const cf = time_to_min(corso.ora_fine);
      return Math.max(1, Math.round((cf - ci) / durata));
    },
    [durata]
  );

  // Is cell occupied by a course (not start but within range)
  const is_occupied = useCallback(
    (giorno: string, slot_time: string) => {
      const slot_min = time_to_min(slot_time);
      return corsi.some((c: any) => {
        if (c.giorno !== giorno) return false;
        const ci = time_to_min(c.ora_inizio);
        const cf = time_to_min(c.ora_fine);
        return slot_min > ci && slot_min < cf;
      });
    },
    [corsi]
  );

  // ── Mutations ──
  const save_config = useMutation({
    mutationFn: async () => {
      if (config) {
        await supabase
          .from("impostazioni_planning")
          .update({ ora_inizio_giornata: cfg_ora_inizio, ora_fine_giornata: cfg_ora_fine, durata_slot_minuti: cfg_durata })
          .eq("id", config.id);
      } else {
        await supabase.from("impostazioni_planning").insert({
          club_id,
          ora_inizio_giornata: cfg_ora_inizio,
          ora_fine_giornata: cfg_ora_fine,
          durata_slot_minuti: cfg_durata,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impostazioni_planning"] });
      set_config_open(false);
      toast({ title: "Configurazione salvata" });
    },
  });

  const update_corso = useMutation({
    mutationFn: async ({ id, giorno, ora_inizio, ora_fine }: { id: string; giorno: string; ora_inizio: string; ora_fine: string }) => {
      const { error } = await supabase.from("corsi").update({ giorno, ora_inizio, ora_fine }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corsi_planning"] });
      toast({ title: "Corso spostato" });
    },
  });

  const create_corso = useMutation({
    mutationFn: async () => {
      const dur_min = durata;
      const fine = min_to_time(time_to_min(new_corso_ora) + dur_min);
      const { error } = await supabase.from("corsi").insert({
        club_id,
        nome: new_corso_nome,
        tipo: new_corso_tipo,
        giorno: new_corso_giorno,
        ora_inizio: new_corso_ora,
        ora_fine: fine,
        attivo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corsi_planning"] });
      set_new_corso_open(false);
      set_new_corso_nome("");
      set_new_corso_tipo("");
      toast({ title: "Corso creato" });
    },
  });

  // ── DnD ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handle_drag_start(e: DragStartEvent) {
    set_dragged_corso(e.active.data.current?.corso || null);
  }

  function handle_drag_end(e: DragEndEvent) {
    set_dragged_corso(null);
    const { active, over } = e;
    if (!over || !active.data.current?.corso) return;

    const corso = active.data.current.corso;
    const cell_id = over.id as string; // format: "cell-Lunedì-08:00"
    const parts = cell_id.split("-");
    const slot_time = parts[parts.length - 1];
    const giorno = parts.slice(1, -1).join("-");
    // Recalc with accented names
    const giorno_parsed = GIORNI.find((g) => cell_id === `cell-${g}-${slot_time}`) || giorno;

    if (!over.data.current?.has_ice) {
      toast({ title: "Fuori dalla disponibilità ghiaccio", variant: "destructive" });
      return;
    }

    const corso_dur = time_to_min(corso.ora_fine) - time_to_min(corso.ora_inizio);
    const new_ora_inizio = slot_time;
    const new_ora_fine = min_to_time(time_to_min(slot_time) + corso_dur);

    // Check instructor availability
    const istruttore_id = corso_istruttore_map[corso.id];
    if (istruttore_id && !is_istruttore_disponibile(istruttore_id, giorno_parsed, new_ora_inizio, new_ora_fine)) {
      set_conflict_dialog({ corso, giorno: giorno_parsed, ora_inizio: new_ora_inizio, ora_fine: new_ora_fine });
      return;
    }

    update_corso.mutate({ id: corso.id, giorno: giorno_parsed, ora_inizio: new_ora_inizio, ora_fine: new_ora_fine });
  }

  function confirm_conflict_move() {
    if (!conflict_dialog) return;
    const { corso, giorno, ora_inizio, ora_fine } = conflict_dialog;
    update_corso.mutate({ id: corso.id, giorno, ora_inizio, ora_fine });
    set_conflict_dialog(null);
  }

  // Open config dialog with current values
  function open_config() {
    set_cfg_ora_inizio(ora_inizio);
    set_cfg_ora_fine(ora_fine);
    set_cfg_durata(durata);
    set_config_open(true);
  }

  // Click on empty cell to create course
  function handle_cell_click(giorno: string, slot_time: string) {
    if (!has_ice(giorno, slot_time)) return;
    if (get_corso_at(giorno, slot_time) || is_occupied(giorno, slot_time)) return;
    set_new_corso_giorno(giorno);
    set_new_corso_ora(slot_time);
    set_new_corso_open(true);
  }

  const is_loading = !club_id;

  if (is_loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const has_corsi = corsi.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">Planning Ghiaccio</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap bg-muted/40 rounded-lg p-3 border border-border">
        <div className="flex items-center gap-2">
          <Switch checked={show_istruttori} onCheckedChange={set_show_istruttori} id="toggle-ist" />
          <Label htmlFor="toggle-ist" className="text-xs cursor-pointer flex items-center gap-1">
            {show_istruttori ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Istruttori
          </Label>
        </div>

        <Select value={filtro_istruttore} onValueChange={set_filtro_istruttore}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Filtra istruttore" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli istruttori</SelectItem>
            {istruttori_raw.map((ist: any) => (
              <SelectItem key={ist.id} value={ist.id}>
                {ist.nome} {ist.cognome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => set_new_corso_open(true)}>
          <Plus className="w-4 h-4 mr-1" /> Aggiungi corso
        </Button>
        <Button variant="outline" size="sm" onClick={open_config}>
          <Settings className="w-4 h-4 mr-1" /> Configura Planning
        </Button>
      </div>

      {/* Grid */}
      {!has_corsi && (
        <div className="text-center py-12 text-muted-foreground">
          Nessun corso pianificato. Clicca su uno slot azzurro per aggiungere un corso.
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handle_drag_start} onDragEnd={handle_drag_end}>
        <div className="overflow-auto border border-border rounded-lg">
          <div
            className="grid min-w-[800px]"
            style={{ gridTemplateColumns: `60px repeat(7, 1fr)`, gridTemplateRows: `auto repeat(${slots.length}, 28px)` }}
          >
            {/* Header row */}
            <div className="sticky top-0 z-10 bg-muted border-b border-r border-border" />
            {GIORNI.map((g) => (
              <div key={g} className="sticky top-0 z-10 bg-muted border-b border-r border-border text-xs font-semibold text-center py-1.5">
                {g}
              </div>
            ))}

            {/* Rows */}
            {slots.map((slot, row_idx) => (
              <React.Fragment key={slot}>
                {/* Time label */}
                <div className="border-b border-r border-border text-[10px] text-muted-foreground text-right pr-1 flex items-center justify-end bg-muted/30">
                  {slot}
                </div>
                {/* Day cells */}
                {GIORNI.map((giorno) => {
                  const cell_id = `cell-${giorno}-${slot}`;
                  const ice = has_ice(giorno, slot);
                  const corso = get_corso_at(giorno, slot);
                  const occupied = is_occupied(giorno, slot);
                  const badges = get_badges(giorno, slot);

                  return (
                    <DroppableCell key={cell_id} id={cell_id} has_ice={ice}>
                      {/* Instructor badges */}
                      {badges.length > 0 && (
                        <div className="absolute left-0 top-0 bottom-0 flex flex-col gap-px z-10 p-px">
                          {badges.map((b) => (
                            <span
                              key={b.id}
                              className={`${b.colore} text-white text-[7px] leading-none rounded-sm px-0.5 font-bold`}
                              title={`${istruttori_map[b.id]?.nome} ${istruttori_map[b.id]?.cognome}`}
                            >
                              {b.initials}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Course block */}
                      {corso && (
                        <DraggableCorso
                          corso={corso}
                          istruttore_nome={
                            corso_istruttore_map[corso.id]
                              ? `${istruttori_map[corso_istruttore_map[corso.id]]?.nome || ""} ${istruttori_map[corso_istruttore_map[corso.id]]?.cognome || ""}`
                              : ""
                          }
                          span={get_corso_span(corso)}
                        />
                      )}

                      {/* Clickable empty ice cell */}
                      {ice && !corso && !occupied && (
                        <div
                          className="absolute inset-0 cursor-pointer hover:bg-primary/10 z-0"
                          onClick={() => handle_cell_click(giorno, slot)}
                        />
                      )}
                    </DroppableCell>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <DragOverlay>
          {dragged_corso && (
            <div className={`rounded border p-1 text-[10px] text-white font-semibold ${TIPO_COLORI[(dragged_corso.tipo || "").toLowerCase()] || "bg-muted"}`}>
              {dragged_corso.nome}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Config Dialog ── */}
      <Dialog open={config_open} onOpenChange={set_config_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configura Planning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Ora inizio giornata</Label>
                <Input type="time" value={cfg_ora_inizio} onChange={(e) => set_cfg_ora_inizio(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Ora fine giornata</Label>
                <Input type="time" value={cfg_ora_fine} onChange={(e) => set_cfg_ora_fine(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Durata slot (minuti)</Label>
              <Select value={String(cfg_durata)} onValueChange={(v) => set_cfg_durata(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minuti</SelectItem>
                  <SelectItem value="20">20 minuti</SelectItem>
                  <SelectItem value="30">30 minuti</SelectItem>
                  <SelectItem value="60">60 minuti</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_config_open(false)}>Annulla</Button>
            <Button onClick={() => save_config.mutate()}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Course Dialog ── */}
      <Dialog open={new_corso_open} onOpenChange={set_new_corso_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Corso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome corso</Label>
              <Input value={new_corso_nome} onChange={(e) => set_new_corso_nome(e.target.value)} placeholder="Es. Pulcini Base" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={new_corso_tipo} onValueChange={set_new_corso_tipo}>
                <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(TIPO_COLORI).map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Giorno</Label>
                <Select value={new_corso_giorno} onValueChange={set_new_corso_giorno}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GIORNI.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ora inizio</Label>
                <Input type="time" value={new_corso_ora} onChange={(e) => set_new_corso_ora(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_new_corso_open(false)}>Annulla</Button>
            <Button onClick={() => create_corso.mutate()} disabled={!new_corso_nome}>Crea Corso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Instructor Conflict Dialog ── */}
      <Dialog open={!!conflict_dialog} onOpenChange={() => set_conflict_dialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Istruttore non disponibile
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            L'istruttore assegnato a questo corso non è disponibile nello slot di destinazione.
            Vuoi procedere comunque?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_conflict_dialog(null)}>Annulla</Button>
            <Button variant="destructive" onClick={confirm_conflict_move}>Procedi comunque</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 border border-sky-200" /> Ghiaccio disponibile</span>
        {Object.entries(TIPO_COLORI).map(([tipo, cls]) => (
          <span key={tipo} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${cls}`} />
            {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
