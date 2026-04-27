import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, ChevronLeft, ChevronRight, Snowflake, Dumbbell, AlertTriangle, X, CheckCircle2, Clock, Ban } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { GrigliaFasceGhiaccio, NumInput, to_num } from "@/pages/CoursesPage";
import { toast } from "@/hooks/use-toast";
import { calcola_status_istruttori_per_slot } from "@/lib/availability";
import { SelectLivello } from "@/components/ui/select-livello";
import { use_livelli } from "@/hooks/use-supabase-data";

const GIORNI_DB = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const GIORNO_TO_WEEKDAY: Record<string, number> = {
  "Lunedì": 1,
  "Martedì": 2,
  "Mercoledì": 3,
  "Giovedì": 4,
  "Venerdì": 5,
  "Sabato": 6,
  "Domenica": 0,
};

const LIVELLI_CORSO = [
  "tutti", "pulcini", "stellina1", "stellina2", "stellina3", "stellina4",
  "Interbronzo", "Bronzo", "Interargento", "Argento", "Interoro", "Oro",
];
const LIVELLO_LABELS: Record<string, string> = {
  tutti: "Tutti i livelli", pulcini: "Pulcini",
  stellina1: "Stellina 1", stellina2: "Stellina 2", stellina3: "Stellina 3", stellina4: "Stellina 4",
  Interbronzo: "Interbronzo", Bronzo: "Bronzo", Interargento: "Interargento",
  Argento: "Argento", Interoro: "Interoro", Oro: "Oro",
};

const CATEGORIE_OFFICE_SUGGERIMENTI = [
  "Danza", "Stretching", "Pilates", "Preparazione atletica", "Yoga", "Fitness",
];

function time_to_min(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function min_to_time(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function add_minutes(time: string, minutes: number): string {
  return min_to_time(time_to_min(time) + minutes);
}
function diff_minutes(a: string, b: string): number {
  return time_to_min(b) - time_to_min(a);
}

const OffIceTimeline: React.FC<{
  giorno: string;
  corso_id?: string;
  ora_inizio: string;
  ora_fine: string;
  corsi: any[];
}> = ({ giorno, corso_id, ora_inizio, ora_fine, corsi }) => {
  const corsi_giorno = useMemo(
    () => (corsi || []).filter(
      (c) => c.id !== corso_id && c.giorno === giorno && (c.tipo || "").toLowerCase() === "off-ice" && c.ora_inizio && c.ora_fine,
    ),
    [corsi, giorno, corso_id],
  );

  const VIEW_START = 6 * 60;
  const VIEW_END = 22 * 60;
  const TOTAL = VIEW_END - VIEW_START;

  const x_pct = (t: string) => Math.max(0, Math.min(100, ((time_to_min(t) - VIEW_START) / TOTAL) * 100));
  const w_pct = (start: string, end: string) =>
    Math.max(0, Math.min(100, ((time_to_min(end) - time_to_min(start)) / TOTAL) * 100));

  const has_live = !!ora_inizio && !!ora_fine && time_to_min(ora_fine) > time_to_min(ora_inizio);

  const ticks = [];
  for (let h = 6; h <= 22; h += 2) {
    ticks.push(h);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">Timeline Off-Ice — {giorno}</span>
        <span>06:00 – 22:00 · nessun vincolo orario</span>
      </div>
      <div className="relative h-16 bg-muted/30 rounded-lg border border-border overflow-hidden">
        {ticks.map((h) => {
          const px = ((h * 60 - VIEW_START) / TOTAL) * 100;
          return (
            <div key={h} className="absolute top-0 bottom-0 border-l border-border/50" style={{ left: `${px}%` }}>
              <span className="absolute -top-0.5 left-1 text-[10px] text-muted-foreground">{h}:00</span>
            </div>
          );
        })}
        {corsi_giorno.map((c) => (
          <div
            key={c.id}
            className="absolute top-5 h-7 rounded bg-slate-300/70 border border-slate-400 px-1 text-[10px] text-slate-700 overflow-hidden whitespace-nowrap"
            style={{ left: `${x_pct(c.ora_inizio.slice(0, 5))}%`, width: `${w_pct(c.ora_inizio.slice(0, 5), c.ora_fine.slice(0, 5))}%` }}
            title={`${c.nome} ${c.ora_inizio.slice(0, 5)}–${c.ora_fine.slice(0, 5)}`}
          >
            {c.nome}
          </div>
        ))}
        {has_live && (
          <div
            className="absolute top-3 h-10 rounded border-2 border-dashed border-primary bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary"
            style={{ left: `${x_pct(ora_inizio)}%`, width: `${w_pct(ora_inizio, ora_fine)}%` }}
          >
            {ora_inizio}–{ora_fine}
          </div>
        )}
      </div>
    </div>
  );
};

const StepDots: React.FC<{ step: number; total: number; labels: string[] }> = ({ step, total, labels }) => (
  <div className="flex items-center gap-2 px-1">
    {Array.from({ length: total }).map((_, i) => {
      const idx = i + 1;
      const active = idx === step;
      const done = idx < step;
      return (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                done
                  ? "bg-primary border-primary text-primary-foreground"
                  : active
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-muted border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : idx}
            </div>
            <span className={`text-[10px] font-medium truncate max-w-[80px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && <div className={`flex-1 h-0.5 -mt-4 ${done ? "bg-primary" : "bg-border"}`} />}
        </React.Fragment>
      );
    })}
  </div>
);

export interface CorsoWizardProps {
  corso?: any;
  istruttori: any[];
  corsi: any[];
  on_close: () => void;
  on_save: (data: any) => Promise<void>;
  on_delete?: () => Promise<void>;
  saving: boolean;
  deleting?: boolean;
}

export const CorsoWizard: React.FC<CorsoWizardProps> = ({ corso, istruttori, corsi, on_close, on_save, on_delete, saving, deleting }) => {
  const is_edit = !!corso?.id;
  const has_planning_init = !!(corso?.giorno && corso?.ora_inizio && corso?.ora_fine);

  const [step, set_step] = useState(1);
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [posiziona_planning, set_posiziona_planning] = useState(is_edit ? has_planning_init : true);

  // Carica stagioni del club per pre-valorizzare quella attiva (fix bug stagione_id NULL)
  const { data: stagioni_list = [] } = useQuery({
    queryKey: ["stagioni_wizard", get_current_club_id()],
    queryFn: async () => {
      const cid = get_current_club_id();
      if (!cid) return [];
      const { data, error } = await supabase
        .from("stagioni")
        .select("id,nome,attiva,data_inizio,data_fine")
        .eq("club_id", cid)
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!get_current_club_id(),
  });

  const stagione_default_id = useMemo(() => {
    if (corso?.stagione_id) return corso.stagione_id;
    const attiva = stagioni_list.find((s: any) => s.attiva);
    return attiva?.id || stagioni_list[0]?.id || null;
  }, [stagioni_list, corso?.stagione_id]);

  const [form, set_form] = useState({
    nome: corso?.nome || "",
    tipo: corso?.tipo || "",
    categoria: corso?.categoria || "",
    livello_richiesto: corso?.livello_richiesto || null,
    percorso: (corso?.percorso as null | "artistica" | "stile") ?? null,
    giorno: corso?.giorno || "Lunedì",
    ora_inizio: corso?.ora_inizio?.slice(0, 5) || "",
    ora_fine: corso?.ora_fine?.slice(0, 5) || "",
    durata: corso?.ora_inizio && corso?.ora_fine
      ? Math.max(5, diff_minutes(corso.ora_inizio.slice(0, 5), corso.ora_fine.slice(0, 5)))
      : 60,
    costo_mensile_str: (() => {
      const n = to_num(corso?.costo_mensile ?? 0);
      return n === 0 ? "" : n.toFixed(2);
    })(),
    costo_annuale_str: (() => {
      const n = to_num(corso?.costo_annuale ?? 0);
      return n === 0 ? "" : n.toFixed(2);
    })(),
    istruttori_ids: corso?.istruttori_ids || [],
    attivo: corso?.stato === "attivo" || corso?.attivo !== false,
    note: corso?.note || "",
    stagione_id: corso?.stagione_id || null,
  });

  const has_slot = posiziona_planning && !!form.giorno && !!form.ora_inizio && !!form.ora_fine;

  // Quando le stagioni arrivano, pre-valorizza con quella attiva (fix bug stagione_id NULL)
  useEffect(() => {
    if (!form.stagione_id && stagione_default_id) {
      set_form((p) => ({ ...p, stagione_id: stagione_default_id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagione_default_id]);

  const set_val = (k: keyof typeof form, v: any) => set_form((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (form.ora_inizio && form.durata > 0) {
      const new_end = add_minutes(form.ora_inizio, form.durata);
      if (new_end !== form.ora_fine) set_form((p) => ({ ...p, ora_fine: new_end }));
    }
  }, [form.ora_inizio, form.durata]);

  const { data: planning_settimana_corrente = [] } = useQuery({
    queryKey: ["wizard_planning_settimana", get_current_club_id(), form.giorno],
    enabled: !!get_current_club_id() && has_slot,
    queryFn: async () => {
      const club_id = get_current_club_id();
      if (!club_id) return [];

      const { data: settimane, error: settimane_error } = await supabase
        .from("planning_settimane")
        .select("id")
        .eq("club_id", club_id)
        .eq("archiviato", false)
        .order("data_lunedi", { ascending: false })
        .limit(1);

      if (settimane_error) throw settimane_error;
      if (!settimane?.length) return [];

      const { data: planning, error: planning_error } = await supabase
        .from("planning_corsi_settimana")
        .select("corso_id, ora_inizio, ora_fine, istruttore_id, data")
        .eq("settimana_id", settimane[0].id)
        .eq("annullato", false);

      if (planning_error) throw planning_error;

      const weekday = GIORNO_TO_WEEKDAY[form.giorno];
      return (planning ?? []).filter(
        (p: any) => new Date(`${p.data}T00:00:00`).getDay() === weekday,
      );
    },
  });

  const on_ora_fine_change = (v: string) => {
    if (form.ora_inizio && v && time_to_min(v) > time_to_min(form.ora_inizio)) {
      set_form((p) => ({ ...p, ora_fine: v, durata: diff_minutes(form.ora_inizio, v) }));
    } else {
      set_val("ora_fine", v);
    }
  };

  const errors_step1: string[] = [];
  if (!form.nome.trim()) errors_step1.push("Nome corso");
  if (form.tipo !== "Ghiaccio" && form.tipo !== "Off-Ice") errors_step1.push("Tipo (Ghiaccio o Off-Ice)");

  const errors_step2: string[] = [];
  if (posiziona_planning) {
    if (!form.giorno) errors_step2.push("Giorno");
    if (!form.ora_inizio) errors_step2.push("Ora inizio");
    if (!form.ora_fine) errors_step2.push("Ora fine");
    if (form.ora_inizio && form.ora_fine && time_to_min(form.ora_fine) <= time_to_min(form.ora_inizio)) {
      errors_step2.push("Ora fine deve essere dopo Ora inizio");
    }
  }

  const can_next_1 = errors_step1.length === 0;
  const can_next_2 = errors_step2.length === 0;

  const toggle_istruttore = (id: string) => {
    set_form((p) => ({
      ...p,
      istruttori_ids: p.istruttori_ids.includes(id)
        ? p.istruttori_ids.filter((x: string) => x !== id)
        : [...p.istruttori_ids, id],
    }));
  };

  const istruttori_attivi = istruttori.filter((i: any) => i.attivo);

  // ── Singola fonte di verità condivisa con GrigliaFasceGhiaccio (Step 2) ──
  type Bucket = "ok" | "busy" | "ko";

  // Slot di conflitto derivati dai CORSI MASTER dello stesso giorno (anche
  // se non ancora pianificati nella settimana). Evita doppia assegnazione
  // istruttore già a livello di creazione/modifica corso.
  const conflitti_corsi_master = useMemo(() => {
    if (!has_slot) return [] as any[];
    const out: any[] = [];
    for (const c of (corsi || [])) {
      if (!c || c.id === corso?.id) continue;
      if (c.giorno !== form.giorno) continue;
      if (!c.ora_inizio || !c.ora_fine) continue;
      const ids: string[] = c.istruttori_ids || [];
      for (const iid of ids) {
        out.push({
          corso_id: c.id,
          istruttore_id: iid,
          ora_inizio: c.ora_inizio,
          ora_fine: c.ora_fine,
        });
      }
    }
    return out;
  }, [has_slot, corsi, corso?.id, form.giorno]);

  const status_istruttori = useMemo(() => {
    if (!has_slot) return [];
    return calcola_status_istruttori_per_slot({
      istruttori: istruttori_attivi,
      giorno: form.giorno,
      ora_inizio: form.ora_inizio,
      ora_fine: form.ora_fine,
      planning_slots: [...(planning_settimana_corrente as any[]), ...conflitti_corsi_master],
      corso_id_corrente: corso?.id ?? null,
    });
  }, [has_slot, form.giorno, form.ora_inizio, form.ora_fine, istruttori_attivi, planning_settimana_corrente, conflitti_corsi_master, corso?.id]);

  const istruttori_selezionabili = useMemo(
    () => (has_slot ? status_istruttori.filter((s) => s.disponibile).map((s) => s.istruttore as any) : istruttori_attivi),
    [has_slot, status_istruttori, istruttori_attivi],
  );

  const classify_istruttore = (i: any): { bucket: Bucket; label: string; tooltip: string } => {
    if (!has_slot) return { bucket: "ok", label: "", tooltip: "" };
    const s = status_istruttori.find((x) => x.istruttore.id === i.id);
    if (!s) return { bucket: "ko", label: "non disponibile", tooltip: "Non disponibile" };
    if (s.disponibile) return { bucket: "ok", label: "", tooltip: "Disponibile" };
    if (s.motivo_ko === "conflitto_planning") {
      const c = (corsi || []).find((cc: any) => cc.id === s.conflitto_corso_id);
      return { bucket: "busy", label: c?.nome || "altro corso", tooltip: `Già impegnato: ${c?.nome || "altro corso"}` };
    }
    return { bucket: "ko", label: s.motivo_ko || "non disponibile", tooltip: s.motivo_ko || "Non disponibile" };
  };

  // Auto-cleanup: se cambia lo slot, rimuovi dalla selezione gli istruttori non più disponibili
  // e mostra banner arancio con i nomi rimossi.
  const [rimossi_slot_change, set_rimossi_slot_change] = useState<string[]>([]);
  const slot_key = `${form.giorno}|${form.ora_inizio}|${form.ora_fine}`;
  const prev_slot_key = React.useRef(slot_key);
  useEffect(() => {
    if (!has_slot) return;
    if (prev_slot_key.current === slot_key) return;
    prev_slot_key.current = slot_key;
    const validi = new Set(istruttori_selezionabili.map((i: any) => i.id));
    const rimossi: string[] = [];
    const nuovi_ids = form.istruttori_ids.filter((id: string) => {
      if (validi.has(id)) return true;
      const i = istruttori.find((x: any) => x.id === id);
      if (i) rimossi.push(`${i.nome} ${i.cognome}`);
      return false;
    });
    if (rimossi.length > 0) {
      set_form((p) => ({ ...p, istruttori_ids: nuovi_ids }));
      set_rimossi_slot_change(rimossi);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot_key, has_slot, istruttori_selezionabili]);

  // Debug dettagliato: usa lo stesso status condiviso con Step 2 (no logiche duplicate).
  useEffect(() => {
    if (step !== 3) return;
    // eslint-disable-next-line no-console
    console.debug("[CorsoWizard] step istruttori render", {
      has_slot,
      giorno_effettivo: form.giorno,
      ora_inizio: form.ora_inizio,
      ora_fine: form.ora_fine,
      totali_club: istruttori_attivi.length,
      disponibili: istruttori_selezionabili.length,
      dettaglio: status_istruttori.map((s) => ({
        id: (s.istruttore.id || "").slice(0, 8),
        nome: `${(s.istruttore as any).nome} ${(s.istruttore as any).cognome}`,
        disponibile: s.disponibile,
        motivo: s.motivo_ko,
      })),
    });
  }, [step, has_slot, form.giorno, form.ora_inizio, form.ora_fine, istruttori_attivi.length, istruttori_selezionabili.length, status_istruttori]);

  // Mantenuto per compat con resto del file (Riepilogo non blocca più: la lista è già filtrata)
  const istruttori_ko_selezionati: any[] = useMemo(() => {
    if (!has_slot) return [];
    const validi = new Set(istruttori_selezionabili.map((i: any) => i.id));
    return form.istruttori_ids
      .map((id: string) => (validi.has(id) ? null : istruttori.find((x: any) => x.id === id)))
      .filter(Boolean);
  }, [form.istruttori_ids, has_slot, istruttori_selezionabili, istruttori]);

  const [error_db, set_error_db] = useState<string | null>(null);
  const handle_submit = async () => {
    set_error_db(null);
    if (istruttori_ko_selezionati.length > 0) {
      set_error_db(
        `Istruttori non disponibili selezionati: ${istruttori_ko_selezionati
          .map((i: any) => `${i.nome} ${i.cognome}`)
          .join(", ")}. Rimuovili prima di salvare.`,
      );
      return;
    }
    if (!get_current_club_id()) {
      const msg = "Nessun club selezionato. Effettua nuovamente il login e riprova.";
      set_error_db(msg);
      toast({ title: msg, variant: "destructive" });
      return;
    }
    try {
      await on_save({
        ...form,
        id: corso?.id,
        giorno: posiziona_planning ? form.giorno : null,
        ora_inizio: posiziona_planning ? form.ora_inizio : null,
        ora_fine: posiziona_planning ? form.ora_fine : null,
        costo_mensile: to_num(form.costo_mensile_str),
        costo_annuale: to_num(form.costo_annuale_str),
      });
    } catch (e: any) {
      const msg = e?.message || String(e) || "Errore sconosciuto";
      set_error_db(msg);
    }
  };

  const STEP_LABELS = ["Anagrafica", "Collocamento", "Istruttori", "Riepilogo"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">{is_edit ? "Ridefinisci corso" : "Nuovo corso"}</h2>
            <p className="text-xs text-muted-foreground">Step {step} di 4 · {STEP_LABELS[step - 1]}</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground" aria-label="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <StepDots step={step} total={4} labels={STEP_LABELS} />
        </div>

        {error_db && (
          <div className="mx-6 mt-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-destructive">Errore</p>
              <p className="text-xs text-destructive/90 break-words">{error_db}</p>
            </div>
            <button onClick={() => set_error_db(null)} className="text-destructive/70 hover:text-destructive flex-shrink-0" aria-label="Chiudi errore">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => set_val("nome", e.target.value)}
                  placeholder="es. Bronzo Giovedì"
                  className="mt-1.5"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo *</Label>
                <RadioGroup
                  value={form.tipo}
                  onValueChange={(v) => set_val("tipo", v)}
                  className="grid grid-cols-2 gap-3"
                >
                  <label
                    htmlFor="tipo-ghiaccio"
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                      form.tipo === "Ghiaccio" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem value="Ghiaccio" id="tipo-ghiaccio" />
                    <Snowflake className={`w-5 h-5 ${form.tipo === "Ghiaccio" ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Ghiaccio</span>
                      <span className="text-[11px] text-muted-foreground">Sulla pista, vincoli ghiaccio</span>
                    </div>
                  </label>
                  <label
                    htmlFor="tipo-office"
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                      form.tipo === "Off-Ice" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem value="Off-Ice" id="tipo-office" />
                    <Dumbbell className={`w-5 h-5 ${form.tipo === "Off-Ice" ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Off-Ice</span>
                      <span className="text-[11px] text-muted-foreground">Fuori pista, nessun vincolo orario</span>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {form.tipo === "Off-Ice" && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Categoria (facoltativa)
                  </Label>
                  <Input
                    value={form.categoria}
                    onChange={(e) => set_val("categoria", e.target.value)}
                    list="categorie-office-suggerimenti"
                    placeholder="es. Danza, Pilates, Stretching..."
                    className="mt-1.5"
                  />
                  <datalist id="categorie-office-suggerimenti">
                    {CATEGORIE_OFFICE_SUGGERIMENTI.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-muted-foreground mt-1">Testo libero. Suggerimenti: Danza, Stretching, Pilates, Yoga, Fitness, Preparazione atletica.</p>
                </div>
              )}

              {form.tipo === "Ghiaccio" && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Livello richiesto</Label>
                  <select
                    value={form.livello_richiesto}
                    onChange={(e) => set_val("livello_richiesto", e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {LIVELLI_CORSO.map((l) => (
                      <option key={l} value={l}>{LIVELLO_LABELS[l] || l}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Costo mensile (CHF)</Label>
                  <div className="mt-1.5">
                    <NumInput
                      value={form.costo_mensile_str}
                      onChange={(v) => set_val("costo_mensile_str", v)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Costo annuale (CHF)</Label>
                  <div className="mt-1.5">
                    <NumInput
                      value={form.costo_annuale_str}
                      onChange={(v) => set_val("costo_annuale_str", v)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => set_val("note", e.target.value)}
                  rows={2}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg">
                <input
                  type="checkbox"
                  id="attivo_corso_w"
                  checked={form.attivo}
                  onChange={(e) => set_val("attivo", e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="attivo_corso_w" className="text-sm font-medium text-foreground cursor-pointer">
                  Corso attivo
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold cursor-pointer">Posiziona subito nel planning</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {posiziona_planning ? "Giorno e ora obbligatori" : "Il corso resterà nel backlog 'Da posizionare'"}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={posiziona_planning}
                  onChange={(e) => set_posiziona_planning(e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              {posiziona_planning && (
                <>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giorno *</Label>
                    <select
                      value={form.giorno}
                      onChange={(e) => set_val("giorno", e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {GIORNI_DB.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inizio *</Label>
                      <Input
                        type="time"
                        step={60}
                        value={form.ora_inizio}
                        onChange={(e) => set_val("ora_inizio", e.target.value)}
                        placeholder="HH:MM"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Durata (min) *</Label>
                      <Input
                        type="number"
                        min={5}
                        max={300}
                        step={1}
                        value={form.durata}
                        onChange={(e) => set_val("durata", parseInt(e.target.value) || 0)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fine</Label>
                      <Input
                        type="time"
                        step={60}
                        value={form.ora_fine}
                        onChange={(e) => on_ora_fine_change(e.target.value)}
                        placeholder="HH:MM"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-3">
                    Digita liberamente l'ora (step 1 minuto). Cambiando inizio o durata, fine si aggiorna automaticamente.
                  </p>

                  {form.tipo === "Ghiaccio" ? (
                    <div className="border border-border rounded-xl p-3 bg-background">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Fascia ghiaccio — {form.giorno}
                      </p>
                      <GrigliaFasceGhiaccio
                        giorno={form.giorno}
                        corso_id={corso?.id}
                        istruttori={istruttori}
                        corsi={corsi}
                        ora_inizio_sel={form.ora_inizio}
                        ora_fine_sel={form.ora_fine}
                        on_select_fascia={(oi, of_) => {
                          set_form((p) => {
                            const has_fine = !!of_;
                            const computed = has_fine ? diff_minutes(oi, of_) : 0;
                            const next_durata = has_fine && computed > 0 ? computed : 60;
                            return {
                              ...p,
                              ora_inizio: oi,
                              ora_fine: of_,
                              durata: next_durata,
                            };
                          });
                        }}
                        on_select_istruttore={toggle_istruttore}
                        istruttori_ids_sel={form.istruttori_ids}
                      />
                    </div>
                  ) : form.tipo === "Off-Ice" ? (
                    <div className="border border-border rounded-xl p-3 bg-background">
                      <OffIceTimeline
                        giorno={form.giorno}
                        corso_id={corso?.id}
                        ora_inizio={form.ora_inizio}
                        ora_fine={form.ora_fine}
                        corsi={corsi}
                      />
                      <p className="text-[11px] text-muted-foreground mt-2">
                        I corsi Off-Ice non hanno vincoli di fascia ghiaccio. Digita liberamente.
                      </p>
                    </div>
                  ) : null}

                  {errors_step2.length > 0 && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200">
                      <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-700">
                        Compila: <strong>{errors_step2.join(", ")}</strong>
                      </p>
                    </div>
                  )}
                </>
              )}

              {!posiziona_planning && (
                <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                  Il corso verrà salvato senza giorno e orario. Lo potrai posizionare dopo dal backlog del Planning.
                </div>
              )}
            </div>
          )}

          {step === 3 && (() => {
            const render_chip = (i: any, opts: { removable_only?: boolean } = {}) => {
              const selected = form.istruttori_ids.includes(i.id);
              const colore = i.colore || "#6B7280";
              const removable = opts.removable_only;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggle_istruttore(i.id)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all border-2 cursor-pointer hover:opacity-90"
                  style={{
                    borderColor: removable ? "#dc2626" : selected ? colore : "hsl(var(--border))",
                    backgroundColor: removable ? "#fef2f2" : selected ? `${colore}20` : "transparent",
                    color: removable ? "#b91c1c" : selected ? colore : "hsl(var(--foreground))",
                  }}
                  title={removable ? "Clicca per rimuovere" : selected ? "Selezionato — clicca per togliere" : "Clicca per aggiungere"}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colore }} />
                  {i.nome} {i.cognome}
                  {selected && !removable && <span className="text-[10px] font-bold">✓</span>}
                  {removable && <X className="w-3.5 h-3.5" />}
                </button>
              );
            };

            return (
              <div className="space-y-4" onClick={() => rimossi_slot_change.length > 0 && set_rimossi_slot_change([])}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Istruttori assegnati ({form.istruttori_ids.length})
                  </Label>
                  {has_slot && (
                    <span className="text-[11px] text-muted-foreground">
                      Slot: {form.giorno} {form.ora_inizio}–{form.ora_fine}
                    </span>
                  )}
                </div>

                {rimossi_slot_change.length > 0 && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-300">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-orange-800">
                      <p className="font-semibold">Lo slot è cambiato.</p>
                      <p className="mt-0.5">
                        {rimossi_slot_change.length} istruttore/i {rimossi_slot_change.length === 1 ? "è stato rimosso" : "sono stati rimossi"} dalla selezione perché non più disponibili: <strong>{rimossi_slot_change.join(", ")}</strong>.
                      </p>
                      <p className="mt-0.5">Seleziona nuovamente da chi compare qui sotto.</p>
                    </div>
                  </div>
                )}

                {istruttori_attivi.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun istruttore attivo configurato.</p>
                ) : !has_slot ? (
                  <>
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      Senza giorno e orario non posso verificare la disponibilità. Tutti gli istruttori sono selezionabili.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {istruttori_attivi.map((i: any) => render_chip(i))}
                    </div>
                  </>
                ) : istruttori_selezionabili.length === 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center space-y-2">
                      <Ban className="w-6 h-6 text-rose-600 mx-auto" />
                      <p className="text-sm font-semibold text-rose-800">
                        Nessun istruttore è disponibile il {form.giorno} dalle {form.ora_inizio} alle {form.ora_fine}
                      </p>
                      <p className="text-xs text-rose-700">
                        Torna allo step Collocamento e scegli un altro slot, oppure apri la pagina Istruttori per aggiungere disponibilità dichiarate.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => set_step(2)}
                        className="mt-2"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Torna a Collocamento
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Disponibili per {form.giorno} {form.ora_inizio}–{form.ora_fine} ({istruttori_selezionabili.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {istruttori_selezionabili.map((i: any) => render_chip(i))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Sono mostrati solo gli istruttori con disponibilità dichiarata che copre questo slot e senza conflitti su altri corsi sovrapposti.
                    </p>
                  </>
                )}
              </div>
            );
          })()}

          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Nome</span>
                  <span className="text-sm font-semibold">{form.nome || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Tipo</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    {form.tipo === "Ghiaccio" ? <Snowflake className="w-3.5 h-3.5 text-primary" /> : form.tipo === "Off-Ice" ? <Dumbbell className="w-3.5 h-3.5 text-primary" /> : null}
                    {form.tipo || "—"}
                    {form.tipo === "Off-Ice" && form.categoria && <span className="text-muted-foreground">· {form.categoria}</span>}
                  </span>
                </div>
                {form.tipo === "Ghiaccio" && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Livello</span>
                    <span className="text-sm">{LIVELLO_LABELS[form.livello_richiesto] || form.livello_richiesto}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Collocamento</span>
                  <span className="text-sm">
                    {posiziona_planning && form.giorno && form.ora_inizio && form.ora_fine
                      ? `${form.giorno} ${form.ora_inizio}–${form.ora_fine} (${form.durata} min)`
                      : "Da posizionare in seguito"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase pt-1">Istruttori</span>
                  <div className="flex flex-wrap gap-1.5 justify-end max-w-[70%]">
                    {form.istruttori_ids.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nessuno</span>
                    ) : (
                      form.istruttori_ids.map((id: string) => {
                        const i = istruttori.find((x: any) => x.id === id);
                        if (!i) return null;
                        const cls = has_slot ? classify_istruttore(i) : { bucket: "ok" as Bucket, tooltip: "" };
                        const is_ko = cls.bucket === "ko";
                        const colore = i.colore || "#6B7280";
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggle_istruttore(id)}
                            title={is_ko ? `${cls.tooltip} — clicca per rimuovere` : "Clicca per rimuovere"}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border-2 cursor-pointer transition-all hover:opacity-80 ${
                              is_ko ? "ring-1 ring-rose-300" : ""
                            }`}
                            style={{
                              borderColor: is_ko ? "#dc2626" : colore,
                              backgroundColor: is_ko ? "#fef2f2" : `${colore}20`,
                              color: is_ko ? "#b91c1c" : colore,
                            }}
                          >
                            {i.nome} {i.cognome}
                            <X className="w-3 h-3" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                {istruttori_ko_selezionati.length > 0 && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-300 mt-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-800">
                      <strong>Salvataggio bloccato:</strong> rimuovi gli istruttori non disponibili (chip rosse con ✕) prima di salvare.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Costi</span>
                  <span className="text-sm">
                    {form.costo_mensile_str ? `CHF ${form.costo_mensile_str}/mese` : "—"}
                    {form.costo_annuale_str ? ` · CHF ${form.costo_annuale_str}/anno` : ""}
                  </span>
                </div>
              </div>

              {error_db && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <details className="text-xs text-destructive/80">
                    <summary className="cursor-pointer font-medium">Dettaglio tecnico errore</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words bg-destructive/10 p-2 rounded">{error_db}</pre>
                  </details>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Verifica e premi <strong>Salva corso</strong>. I dati verranno scritti nel database.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={on_close} disabled={saving || !!deleting}>
              Annulla
            </Button>
            {is_edit && on_delete && (
              confirm_delete ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => set_confirm_delete(false)} disabled={!!deleting}>
                    No
                  </Button>
                  <Button variant="destructive" size="sm" onClick={async () => { await on_delete(); }} disabled={!!deleting}>
                    {deleting ? "..." : "Elimina definitivamente"}
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => set_confirm_delete(true)} disabled={saving}>
                  🗑️ Elimina corso
                </Button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => set_step((s) => s - 1)} disabled={saving}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Indietro
              </Button>
            )}
            {step < 4 && (
              <Button
                onClick={() => set_step((s) => s + 1)}
                disabled={(step === 1 && !can_next_1) || (step === 2 && !can_next_2)}
                title={
                  step === 1 && errors_step1.length > 0
                    ? `Compila: ${errors_step1.join(", ")}`
                    : step === 2 && errors_step2.length > 0
                    ? `Compila: ${errors_step2.join(", ")}`
                    : ""
                }
              >
                Avanti <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button
                onClick={handle_submit}
                disabled={saving || istruttori_ko_selezionati.length > 0}
                className="bg-primary hover:bg-primary/90"
                title={
                  istruttori_ko_selezionati.length > 0
                    ? `Rimuovi prima gli istruttori non disponibili: ${istruttori_ko_selezionati.map((i: any) => `${i.nome} ${i.cognome}`).join(", ")}`
                    : ""
                }
              >
                {saving ? "Salvataggio..." : "💾 Salva corso"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorsoWizard;
