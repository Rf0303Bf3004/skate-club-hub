import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { use_corsi, use_istruttori, use_stagioni } from "@/hooks/use-supabase-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ── Constants ──
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const GIORNI_ABBR: Record<string, string> = {
  "Lunedì": "Lun", "Martedì": "Mar", "Mercoledì": "Mer",
  "Giovedì": "Gio", "Venerdì": "Ven", "Sabato": "Sab", "Domenica": "Dom",
};
const OFF_ICE_TYPES = ["danza", "off-ice", "stretching"];

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  pulcini: { bg: "#C0DD97", text: "#27500A" },
  amatori: { bg: "#B5D4F4", text: "#0C447C" },
  artistica: { bg: "#CECBF6", text: "#3C3489" },
  stile: { bg: "#FAC775", text: "#633806" },
  adulti: { bg: "#9FE1CB", text: "#085041" },
  danza: { bg: "#F4C0D1", text: "#72243E" },
  "off-ice": { bg: "#D3D1C7", text: "#444441" },
  stretching: { bg: "#EAF3DE", text: "#27500A" },
};
const PRIVATE_COLOR = { bg: "#F5C4B3", text: "#712B13" };
const ICE_COLOR = { bg: "#EEEDFE", border: "#AFA9EC" };
const PULIZIA_COLOR = "#D3D1C7";

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}
function min_to_time(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ── Data hooks ──
function use_configurazione_ghiaccio() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["configurazione_ghiaccio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configurazione_ghiaccio")
        .select("*")
        .eq("club_id", club_id)
        .maybeSingle();
      if (error) throw error;
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
    queryKey: ["disponibilita_istruttori_planning", club_id],
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

function use_corsi_istruttori() {
  return useQuery({
    queryKey: ["corsi_istruttori_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("corsi_istruttori").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function use_iscrizioni_corsi() {
  return useQuery({
    queryKey: ["iscrizioni_corsi_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("iscrizioni_corsi").select("*").eq("attiva", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Ice config panel ──
function PannelloGhiaccio({
  club_id, ghiaccio, on_saved,
}: { club_id: string; ghiaccio: any[]; on_saved: () => void }) {
  const [open, set_open] = useState(false);
  const [local, set_local] = useState<Record<string, { ora_inizio: string; ora_fine: string; note: string; id?: string }[]>>({});
  const [saving, set_saving] = useState(false);

  const init = useCallback(() => {
    const grouped: Record<string, any[]> = {};
    GIORNI.forEach((g) => (grouped[g] = []));
    ghiaccio.forEach((g: any) => {
      if (!grouped[g.giorno]) grouped[g.giorno] = [];
      grouped[g.giorno].push({
        ora_inizio: (g.ora_inizio || "").slice(0, 5),
        ora_fine: (g.ora_fine || "").slice(0, 5),
        note: g.note || "",
        id: g.id,
      });
    });
    Object.keys(grouped).forEach((g) =>
      grouped[g].sort((a, b) => time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio))
    );
    set_local(grouped);
  }, [ghiaccio]);

  const toggle = () => { if (!open) init(); set_open(!open); };
  const add_slot = (giorno: string) => {
    set_local((p) => ({ ...p, [giorno]: [...(p[giorno] || []), { ora_inizio: "08:00", ora_fine: "09:00", note: "" }] }));
  };
  const update_slot = (giorno: string, idx: number, field: string, value: string) => {
    set_local((p) => { const s = [...(p[giorno] || [])]; s[idx] = { ...s[idx], [field]: value }; return { ...p, [giorno]: s }; });
  };
  const remove_slot = (giorno: string, idx: number) => {
    set_local((p) => { const s = [...(p[giorno] || [])]; s.splice(idx, 1); return { ...p, [giorno]: s }; });
  };
  const save = async () => {
    set_saving(true);
    try {
      await supabase.from("disponibilita_ghiaccio").delete().eq("club_id", club_id);
      const rows: any[] = [];
      Object.entries(local).forEach(([giorno, slots]) => {
        slots.forEach((s) => {
          if (s.ora_inizio && s.ora_fine) rows.push({ club_id, giorno, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine, note: s.note || "" });
        });
      });
      if (rows.length > 0) { const { error } = await supabase.from("disponibilita_ghiaccio").insert(rows); if (error) throw error; }
      on_saved();
      toast({ title: "Disponibilità ghiaccio salvata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally { set_saving(false); }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm">
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors rounded-xl">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded" style={{ background: ICE_COLOR.bg, border: `1px solid ${ICE_COLOR.border}` }} />
          Configura disponibilità ghiaccio
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Salvataggio..." : "💾 Salva"}</Button>
          </div>
          <div className="space-y-3">
            {GIORNI.map((giorno) => (
              <div key={giorno} className="border border-border/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{giorno}</span>
                  <Button variant="ghost" size="sm" onClick={() => add_slot(giorno)} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Slot</Button>
                </div>
                {(local[giorno] || []).length === 0 && <p className="text-xs text-muted-foreground">Nessuno slot</p>}
                {(local[giorno] || []).map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <Input type="time" value={s.ora_inizio} onChange={(e) => update_slot(giorno, idx, "ora_inizio", e.target.value)} className="w-28 h-8 text-xs" />
                    <span className="text-muted-foreground text-xs">—</span>
                    <Input type="time" value={s.ora_fine} onChange={(e) => update_slot(giorno, idx, "ora_fine", e.target.value)} className="w-28 h-8 text-xs" />
                    <Input value={s.note} onChange={(e) => update_slot(giorno, idx, "note", e.target.value)} placeholder="Note..." className="flex-1 h-8 text-xs" />
                    <Button variant="ghost" size="sm" onClick={() => remove_slot(giorno, idx)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ──
function PannelloDettaglio({ detail, istruttori, iscrizioni, onClose }: {
  detail: any; istruttori: any[]; iscrizioni: any[]; onClose: () => void;
}) {
  if (!detail) return null;

  if (detail.type === "corso") {
    const c = detail.corso;
    const tipo = (c.tipo || "").toLowerCase();
    const colors = TIPO_COLORS[tipo] || { bg: "#e5e5e5", text: "#333" };
    const ist_names = (detail.istruttori_nomi || []).join(", ") || "Nessuno";
    const n_iscritti = iscrizioni.filter((i: any) => i.corso_id === c.id).length;
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ background: colors.bg }} />
            <h3 className="font-bold text-foreground">{c.nome}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0"><X className="w-4 h-4" /></Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div><span className="text-muted-foreground">Giorno:</span> {c.giorno}</div>
          <div><span className="text-muted-foreground">Orario:</span> {(c.ora_inizio || "").slice(0, 5)} - {(c.ora_fine || "").slice(0, 5)}</div>
          <div><span className="text-muted-foreground">Livello:</span> {c.livello_richiesto || "Tutti"}</div>
          <div><span className="text-muted-foreground">Istruttore:</span> {ist_names}</div>
          <div><span className="text-muted-foreground">Iscritti:</span> {n_iscritti}</div>
          <div><span className="text-muted-foreground">Tipo:</span> {c.tipo || "—"}</div>
        </div>
        {detail.alerts && detail.alerts.length > 0 && (
          <div className="space-y-1">
            {detail.alerts.map((a: string, i: number) => (
              <div key={i} className="text-xs font-medium text-destructive bg-destructive/10 rounded px-2 py-1">{a}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (detail.type === "privati") {
    const available = detail.istruttori_disponibili || [];
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">Lezioni Private — {detail.giorno} {detail.ora}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0"><X className="w-4 h-4" /></Button>
        </div>
        <p className="text-sm text-muted-foreground">{available.length} istruttori disponibili:</p>
        <div className="flex flex-wrap gap-2">
          {available.map((ist: any, i: number) => (
            <Badge key={i} variant="secondary">{ist.nome} {ist.cognome}</Badge>
          ))}
          {available.length === 0 && <p className="text-sm text-muted-foreground">Nessun istruttore disponibile</p>}
        </div>
      </div>
    );
  }

  return null;
}

// ── Add Course Dialog ──
function AggiungiCorsoDialog({ open, onClose, club_id, onSaved }: {
  open: boolean; onClose: () => void; club_id: string; onSaved: () => void;
}) {
  const [nome, set_nome] = useState("");
  const [tipo, set_tipo] = useState("");
  const [giorno, set_giorno] = useState("Lunedì");
  const [ora_inizio, set_ora_inizio] = useState("08:00");
  const [ora_fine, set_ora_fine] = useState("09:00");
  const [saving, set_saving] = useState(false);

  const save = async () => {
    if (!nome.trim()) { toast({ title: "Inserisci il nome del corso", variant: "destructive" }); return; }
    set_saving(true);
    try {
      const { error } = await supabase.from("corsi").insert({
        club_id, nome: nome.trim(), tipo, giorno, ora_inizio, ora_fine, attivo: true,
      });
      if (error) throw error;
      toast({ title: "Corso creato" });
      onSaved();
      onClose();
      set_nome(""); set_tipo(""); set_giorno("Lunedì"); set_ora_inizio("08:00"); set_ora_fine("09:00");
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally { set_saving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Aggiungi corso</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => set_nome(e.target.value)} /></div>
          <div><Label>Tipo</Label>
            <Select value={tipo} onValueChange={set_tipo}>
              <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
              <SelectContent>
                {Object.keys(TIPO_COLORS).map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Giorno</Label>
            <Select value={giorno} onValueChange={set_giorno}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GIORNI.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Inizio</Label><Input type="time" value={ora_inizio} onChange={(e) => set_ora_inizio(e.target.value)} /></div>
            <div><Label>Fine</Label><Input type="time" value={ora_fine} onChange={(e) => set_ora_fine(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Salvataggio..." : "Crea corso"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──
export default function PlanningPage() {
  const { session } = useAuth();
  const club_id = session?.club_id || get_current_club_id();
  const qc = useQueryClient();

  const { data: config, isLoading: config_loading } = use_configurazione_ghiaccio();
  const { data: ghiaccio = [], isLoading: ghiaccio_loading, refetch: refetch_ghiaccio } = use_disponibilita_ghiaccio();
  const { data: corsi_raw = [], isLoading: corsi_loading } = use_corsi();
  const { data: istruttori_raw = [] } = use_istruttori();
  const { data: disp_istruttori = [] } = use_disponibilita_istruttori();
  const { data: corsi_istruttori_raw = [] } = use_corsi_istruttori();
  const { data: iscrizioni = [] } = use_iscrizioni_corsi();
  const { data: stagioni = [] } = use_stagioni();

  const [detail, set_detail] = useState<any>(null);
  const [show_add_corso, set_show_add_corso] = useState(false);

  const stagione_attiva = useMemo(() => stagioni.find((s: any) => s.attiva), [stagioni]);

  const ora_apertura = config?.ora_apertura_default?.toString().slice(0, 5) || "06:00";
  const ora_chiusura = config?.ora_chiusura_default?.toString().slice(0, 5) || "22:30";
  const durata_pulizia = config?.durata_pulizia_minuti || 10;
  const max_atleti = config?.max_atleti_contemporanei || 30;
  const max_per_ist = config?.max_atleti_per_istruttore || 8;

  // Build 30-min time headers
  const time_headers = useMemo(() => {
    const headers: string[] = [];
    const s = time_to_min(ora_apertura);
    const e = time_to_min(ora_chiusura);
    for (let t = s; t < e; t += 30) headers.push(min_to_time(t));
    return headers;
  }, [ora_apertura, ora_chiusura]);

  // Total minutes & pixel scale: 1 min = 2px
  const PX_PER_MIN = 2;
  const total_min = time_to_min(ora_chiusura) - time_to_min(ora_apertura);
  const grid_width = total_min * PX_PER_MIN;
  const base_min = time_to_min(ora_apertura);

  // Maps
  const ist_map = useMemo(() => {
    const m: Record<string, any> = {};
    istruttori_raw.forEach((i: any) => (m[i.id] = i));
    return m;
  }, [istruttori_raw]);

  const corso_ist_map = useMemo(() => {
    const m: Record<string, string[]> = {};
    corsi_istruttori_raw.forEach((ci: any) => {
      if (!m[ci.corso_id]) m[ci.corso_id] = [];
      m[ci.corso_id].push(ci.istruttore_id);
    });
    return m;
  }, [corsi_istruttori_raw]);

  // Split corsi
  const corsi = useMemo(() => corsi_raw.filter((c: any) => c.club_id === club_id), [corsi_raw, club_id]);
  const ice_corsi = useMemo(() => corsi.filter((c: any) => !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase())), [corsi]);
  const off_ice_corsi = useMemo(() => corsi.filter((c: any) => OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase())), [corsi]);

  // Compute ice hours
  const ore_ghiaccio = useMemo(() => {
    let total = 0;
    ghiaccio.forEach((g: any) => { total += time_to_min(g.ora_fine) - time_to_min(g.ora_inizio); });
    return Math.round(total / 60 * 10) / 10;
  }, [ghiaccio]);

  // Build ice+pulizia segments per day
  const ice_segments = useMemo(() => {
    const m: Record<string, { start: number; end: number; type: "ice" | "pulizia" }[]> = {};
    GIORNI.forEach((g) => (m[g] = []));
    ghiaccio.forEach((g: any) => {
      const s = time_to_min(g.ora_inizio);
      const e = time_to_min(g.ora_fine);
      m[g.giorno]?.push({ start: s, end: e, type: "ice" });
      // pulizia after ice
      const pe = Math.min(e + durata_pulizia, time_to_min(ora_chiusura));
      if (pe > e) m[g.giorno]?.push({ start: e, end: pe, type: "pulizia" });
    });
    // Sort by start
    Object.keys(m).forEach((g) => m[g].sort((a, b) => a.start - b.start));
    return m;
  }, [ghiaccio, durata_pulizia, ora_chiusura]);

  // Check if a time range overlaps ice
  const is_on_ice = useCallback((giorno: string, start: number, end: number) => {
    return (ice_segments[giorno] || []).some((seg) => seg.type === "ice" && start < seg.end && end > seg.start);
  }, [ice_segments]);

  // Get corsi on ice for a day
  const get_ice_corsi_for_day = useCallback((giorno: string) => {
    return ice_corsi.filter((c: any) => c.giorno === giorno);
  }, [ice_corsi]);

  // Get private slots (ice segments not covered by courses)
  const get_private_slots = useCallback((giorno: string) => {
    const segments = (ice_segments[giorno] || []).filter((s) => s.type === "ice");
    const courses = get_ice_corsi_for_day(giorno);
    const privates: { start: number; end: number; n_istruttori: number; istruttori: any[] }[] = [];

    segments.forEach((seg) => {
      // Find uncovered portions
      let cursor = seg.start;
      const sorted_courses = courses
        .map((c: any) => ({ start: time_to_min(c.ora_inizio), end: time_to_min(c.ora_fine) }))
        .filter((c) => c.start < seg.end && c.end > seg.start)
        .sort((a, b) => a.start - b.start);

      sorted_courses.forEach((c) => {
        if (cursor < c.start) {
          // Gap before this course
          const gap_start = Math.max(cursor, seg.start);
          const gap_end = Math.min(c.start, seg.end);
          if (gap_end > gap_start) {
            const avail = get_available_instructors(giorno, gap_start, gap_end);
            privates.push({ start: gap_start, end: gap_end, n_istruttori: avail.length, istruttori: avail });
          }
        }
        cursor = Math.max(cursor, c.end);
      });
      // Gap after last course
      if (cursor < seg.end) {
        const avail = get_available_instructors(giorno, cursor, seg.end);
        privates.push({ start: cursor, end: seg.end, n_istruttori: avail.length, istruttori: avail });
      }
    });
    return privates;
  }, [ice_segments, get_ice_corsi_for_day]);

  const get_available_instructors = useCallback((giorno: string, start: number, end: number) => {
    // Instructors busy with courses
    const busy = new Set<string>();
    ice_corsi.forEach((c: any) => {
      if (c.giorno !== giorno) return;
      const cs = time_to_min(c.ora_inizio);
      const ce = time_to_min(c.ora_fine);
      if (start < ce && end > cs) {
        (corso_ist_map[c.id] || []).forEach((id) => busy.add(id));
      }
    });
    // Filter available
    return disp_istruttori
      .filter((d: any) => {
        if (d.giorno !== giorno) return false;
        if (busy.has(d.istruttore_id)) return false;
        const ds = time_to_min(d.ora_inizio);
        const de = time_to_min(d.ora_fine);
        return start >= ds && end <= de;
      })
      .map((d: any) => ist_map[d.istruttore_id])
      .filter(Boolean);
  }, [disp_istruttori, ice_corsi, corso_ist_map, ist_map]);

  // Alert checks
  const get_corso_alerts = useCallback((corso: any) => {
    const alerts: string[] = [];
    const n_iscritti = iscrizioni.filter((i: any) => i.corso_id === corso.id).length;
    if (n_iscritti > max_atleti) alerts.push(`⚠ ${n_iscritti} atleti superano il massimo consentito (${max_atleti})`);
    const n_ist = (corso_ist_map[corso.id] || []).length || 1;
    if (n_iscritti / n_ist > max_per_ist) alerts.push(`⚠ Rapporto atleti/istruttore (${Math.round(n_iscritti / n_ist)}) supera il massimo (${max_per_ist})`);
    return alerts;
  }, [iscrizioni, max_atleti, max_per_ist, corso_ist_map]);

  const get_corso_border = useCallback((corso: any) => {
    const n_iscritti = iscrizioni.filter((i: any) => i.corso_id === corso.id).length;
    if (n_iscritti > max_atleti) return "2px solid #E24B4A";
    const n_ist = (corso_ist_map[corso.id] || []).length || 1;
    if (n_iscritti / n_ist > max_per_ist) return "2px solid #EF9F27";
    return "none";
  }, [iscrizioni, max_atleti, max_per_ist, corso_ist_map]);

  const handle_corso_click = (corso: any) => {
    const ids = corso_ist_map[corso.id] || [];
    const nomi = ids.map((id: string) => ist_map[id]).filter(Boolean).map((i: any) => `${i.nome} ${i.cognome}`);
    set_detail({ type: "corso", corso, istruttori_nomi: nomi, alerts: get_corso_alerts(corso) });
  };

  const handle_private_click = (giorno: string, slot: any) => {
    set_detail({ type: "privati", giorno, ora: `${min_to_time(slot.start)} - ${min_to_time(slot.end)}`, istruttori_disponibili: slot.istruttori });
  };

  const is_loading = config_loading || ghiaccio_loading || corsi_loading;

  if (is_loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const no_ghiaccio = ghiaccio.length === 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Planning Ghiaccio {stagione_attiva ? `— ${stagione_attiva.nome}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{ore_ghiaccio} ore ghiaccio disponibili questa settimana</p>
        </div>
        <Button size="sm" onClick={() => set_show_add_corso(true)}>
          <Plus className="w-4 h-4 mr-1" /> Aggiungi corso
        </Button>
      </div>

      {/* Ice config panel */}
      <PannelloGhiaccio club_id={club_id} ghiaccio={ghiaccio} on_saved={() => { refetch_ghiaccio(); qc.invalidateQueries({ queryKey: ["disponibilita_ghiaccio"] }); }} />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs items-center">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: ICE_COLOR.bg, border: `1px solid ${ICE_COLOR.border}` }} /> Ghiaccio</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: PULIZIA_COLOR }} /> Pulizia</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: PRIVATE_COLOR.bg }} /> Private</span>
        {Object.entries(TIPO_COLORS).map(([tipo, c]) => (
          <span key={tipo} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: c.bg }} /> {tipo.charAt(0).toUpperCase() + tipo.slice(1)}</span>
        ))}
      </div>

      {/* Grid */}
      {no_ghiaccio ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Nessuna disponibilità ghiaccio configurata. Apri il pannello sopra per inserirla.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <div style={{ width: grid_width + 60, minWidth: "100%" }}>
            {/* Time header */}
            <div className="flex" style={{ marginLeft: 60 }}>
              {time_headers.map((t) => (
                <div
                  key={t}
                  className="text-[10px] text-muted-foreground font-medium border-l border-border/30"
                  style={{ width: 30 * PX_PER_MIN, flexShrink: 0 }}
                >
                  {t}
                </div>
              ))}
            </div>

            {/* Day rows */}
            {GIORNI.map((giorno) => {
              const day_ice_corsi = get_ice_corsi_for_day(giorno);
              const day_off_ice = off_ice_corsi.filter((c: any) => c.giorno === giorno);
              const day_privates = get_private_slots(giorno);
              const segments = ice_segments[giorno] || [];

              return (
                <div key={giorno}>
                  {/* Main ice row */}
                  <div className="flex items-stretch border-t border-border/30" style={{ height: 32 }}>
                    <div className="w-[60px] flex-shrink-0 flex items-center px-2 text-xs font-semibold text-foreground bg-muted/50 border-r border-border/30">
                      {GIORNI_ABBR[giorno]}
                    </div>
                    <div className="relative flex-1" style={{ width: grid_width }}>
                      {/* Layer 1: Ice + pulizia segments */}
                      {segments.map((seg, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0"
                          style={{
                            left: (seg.start - base_min) * PX_PER_MIN,
                            width: (seg.end - seg.start) * PX_PER_MIN,
                            background: seg.type === "ice" ? ICE_COLOR.bg : PULIZIA_COLOR,
                            borderTop: seg.type === "ice" ? `1px solid ${ICE_COLOR.border}` : undefined,
                            borderBottom: seg.type === "ice" ? `1px solid ${ICE_COLOR.border}` : undefined,
                          }}
                        />
                      ))}

                      {/* Layer 2: Courses on ice */}
                      {day_ice_corsi.map((c: any) => {
                        const cs = time_to_min(c.ora_inizio);
                        const ce = time_to_min(c.ora_fine);
                        const tipo = (c.tipo || "").toLowerCase();
                        const colors = TIPO_COLORS[tipo] || { bg: "#e5e5e5", text: "#333" };
                        const border = get_corso_border(c);
                        return (
                          <div
                            key={c.id}
                            className="absolute top-0 bottom-0 flex items-center px-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden rounded-sm"
                            style={{
                              left: (cs - base_min) * PX_PER_MIN,
                              width: (ce - cs) * PX_PER_MIN,
                              background: colors.bg,
                              color: colors.text,
                              border,
                              zIndex: 2,
                            }}
                            onClick={() => handle_corso_click(c)}
                            title={c.nome}
                          >
                            <span className="text-[10px] font-bold truncate leading-tight">{c.nome}</span>
                          </div>
                        );
                      })}

                      {/* Layer 3: Private slots */}
                      {day_privates.map((p, i) => (
                        <div
                          key={`priv-${i}`}
                          className="absolute top-0 bottom-0 flex items-center justify-center cursor-pointer hover:brightness-95 transition-all"
                          style={{
                            left: (p.start - base_min) * PX_PER_MIN,
                            width: (p.end - p.start) * PX_PER_MIN,
                            background: PRIVATE_COLOR.bg,
                            color: PRIVATE_COLOR.text,
                            zIndex: 1,
                          }}
                          onClick={() => handle_private_click(giorno, p)}
                        >
                          <span className="text-[10px] font-bold">Priv.({p.n_istruttori})</span>
                        </div>
                      ))}

                      {/* 30-min grid lines */}
                      {time_headers.map((t) => (
                        <div
                          key={t}
                          className="absolute top-0 bottom-0 border-l border-border/10"
                          style={{ left: (time_to_min(t) - base_min) * PX_PER_MIN, zIndex: 0 }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Layer 4: Off-ice row */}
                  {day_off_ice.length > 0 && (
                    <div className="flex items-stretch border-t border-border/10" style={{ height: 16 }}>
                      <div className="w-[60px] flex-shrink-0 bg-muted/30 border-r border-border/30" />
                      <div className="relative flex-1" style={{ width: grid_width }}>
                        {day_off_ice.map((c: any) => {
                          const cs = time_to_min(c.ora_inizio);
                          const ce = time_to_min(c.ora_fine);
                          const tipo = (c.tipo || "").toLowerCase();
                          const colors = TIPO_COLORS[tipo] || { bg: "#e5e5e5", text: "#333" };
                          return (
                            <div
                              key={c.id}
                              className="absolute top-0 bottom-0 flex items-center px-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden rounded-sm"
                              style={{
                                left: (cs - base_min) * PX_PER_MIN,
                                width: (ce - cs) * PX_PER_MIN,
                                background: colors.bg,
                                color: colors.text,
                              }}
                              onClick={() => handle_corso_click(c)}
                              title={c.nome}
                            >
                              <span className="text-[9px] font-semibold truncate">{c.nome}</span>
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
        </div>
      )}

      {/* Detail Panel */}
      <PannelloDettaglio detail={detail} istruttori={istruttori_raw} iscrizioni={iscrizioni} onClose={() => set_detail(null)} />

      {/* Add Course Dialog */}
      <AggiungiCorsoDialog
        open={show_add_corso}
        onClose={() => set_show_add_corso(false)}
        club_id={club_id}
        onSaved={() => qc.invalidateQueries({ queryKey: ["corsi"] })}
      />
    </div>
  );
}
