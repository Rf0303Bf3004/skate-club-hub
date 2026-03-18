import React, { useState, useMemo } from "react";
import { use_lezioni_private, use_istruttori, use_atleti, use_corsi } from "@/hooks/use-supabase-data";
import { use_crea_lezione_privata, use_annulla_lezione } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, X, Search, Check, Clock, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function time_to_min(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function min_to_time(m: number): string {
  return (
    Math.floor(m / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (m % 60).toString().padStart(2, "0")
  );
}

function subtract_intervals(
  avail: { start: number; end: number }[],
  busy: { start: number; end: number }[],
): { start: number; end: number }[] {
  let result = [...avail];
  for (const b of busy) {
    const next: { start: number; end: number }[] = [];
    for (const a of result) {
      if (b.end <= a.start || b.start >= a.end) {
        next.push(a);
      } else {
        if (a.start < b.start) next.push({ start: a.start, end: b.start });
        if (a.end > b.end) next.push({ start: b.end, end: a.end });
      }
    }
    result = next;
  }
  return result;
}

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const GIORNI_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

// ─── Autocomplete atleta ───────────────────────────────────────────────────────
const AtletaSearch: React.FC<{
  atleti: any[];
  selected_ids: string[];
  on_change: (ids: string[]) => void;
}> = ({ atleti, selected_ids, on_change }) => {
  const [query, set_query] = useState("");
  const [open, set_open] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return atleti.slice(0, 8);
    return atleti.filter((a: any) => `${a.nome} ${a.cognome}`.toLowerCase().includes(q)).slice(0, 8);
  }, [atleti, query]);

  const toggle = (id: string) => {
    on_change(selected_ids.includes(id) ? selected_ids.filter((i) => i !== id) : [...selected_ids, id]);
  };

  return (
    <div className="relative">
      <div
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm flex items-center gap-2 cursor-text min-h-[38px]"
        onClick={() => set_open(true)}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          placeholder="Cerca atleta per nome..."
          value={query}
          onChange={(e) => {
            set_query(e.target.value);
            set_open(true);
          }}
          onFocus={() => set_open(true)}
        />
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              set_open(false);
              set_query("");
            }}
          />
          <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2">Nessun atleta trovato</p>
            ) : (
              filtered.map((a: any) => {
                const sel = selected_ids.includes(a.id);
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      toggle(a.id);
                      set_query("");
                    }}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors
                      ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"}`}
                  >
                    <span>
                      {a.nome} {a.cognome}
                    </span>
                    {sel && <Check className="w-4 h-4" />}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {selected_ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected_ids.map((id) => {
            const a = atleti.find((x: any) => x.id === id);
            if (!a) return null;
            return (
              <span
                key={id}
                className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
              >
                {a.nome} {a.cognome}
                <button onClick={() => toggle(id)} className="hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Modal prenotazione ────────────────────────────────────────────────────────
const SlotModal: React.FC<{
  form: Record<string, any>;
  atleti: any[];
  on_change: (k: string, v: any) => void;
  on_submit: () => void;
  on_close: () => void;
  loading: boolean;
}> = ({ form, atleti, on_change, on_submit, on_close, loading }) => {
  const date_obj = new Date(form.data + "T00:00:00");
  const date_label = date_obj.toLocaleDateString("it-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Prenota {form.ora_inizio}–{form.ora_fine}
            </h2>
            <p className="text-xs text-muted-foreground capitalize">{date_label}</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atleta *</label>
            <AtletaSearch
              atleti={atleti}
              selected_ids={form.atleti_ids || []}
              on_change={(ids) => on_change("atleti_ids", ids)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Costo totale</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                CHF
              </span>
              <input
                type="number"
                min="0"
                step="0.50"
                value={form.costo_totale || 0}
                onChange={(e) => on_change("costo_totale", parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background pl-11 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div
            onClick={() => on_change("ricorrente", !form.ricorrente)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
              ${
                form.ricorrente
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40"
              }`}
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
              ${form.ricorrente ? "border-primary bg-primary" : "border-muted-foreground"}`}
            >
              {form.ricorrente && <Check className="w-3 h-3 text-white" />}
            </div>
            <div>
              <p className="text-sm font-medium">Lezione ricorrente</p>
              <p className="text-xs opacity-70">Ogni settimana alla stessa ora fino a fine stagione</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</label>
            <textarea
              value={form.note || ""}
              onChange={(e) => on_change("note", e.target.value)}
              rows={2}
              placeholder="Note opzionali..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={on_close} disabled={loading}>
            Annulla
          </Button>
          <Button
            onClick={on_submit}
            disabled={loading || !form.atleti_ids?.length}
            className="bg-primary hover:bg-primary/90 min-w-[110px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Salvo...
              </span>
            ) : form.ricorrente ? (
              "📅 Crea ricorrente"
            ) : (
              "Prenota"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal dettaglio slot occupato ────────────────────────────────────────────
const SlotDetailModal: React.FC<{
  slot: any;
  atleti: any[];
  on_close: () => void;
  on_annulla: () => void;
  on_modifica: () => void;
  loading: boolean;
}> = ({ slot, atleti, on_close, on_annulla, on_modifica, loading }) => {
  const nomi_atleti = (slot.lesson?.atleti_ids || [])
    .map((id: string) => {
      const a = atleti.find((x: any) => x.id === id);
      return a ? `${a.nome} ${a.cognome}` : null;
    })
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Dettaglio lezione</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Orario */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {slot.time} – {slot.end_time}
            </span>
          </div>

          {/* Atleti */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atleta/i</p>
            {nomi_atleti.length > 0 ? (
              nomi_atleti.map((nome: string, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg">
                  <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{nome}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">Nessun atleta registrato</p>
            )}
          </div>

          {/* Note */}
          {slot.lesson?.note && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</p>
              <p className="text-sm text-foreground bg-muted/30 px-3 py-2 rounded-lg">{slot.lesson.note}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-border">
          <Button variant="destructive" onClick={on_annulla} disabled={loading} className="flex-1">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Annullo...
              </span>
            ) : (
              "× Annulla lezione"
            )}
          </Button>
          <Button variant="outline" onClick={on_modifica} disabled={loading} className="flex-1">
            ✏️ Modifica
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const LezioniPrivatePage: React.FC = () => {
  const { data: lezioni = [], isLoading } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();
  const { data: corsi = [] } = use_corsi();
  const crea_lezione = use_crea_lezione_privata();
  const annulla_lezione = use_annulla_lezione();

  const [selected_istruttore, set_selected_istruttore] = useState<string>("");
  const [cal_year, set_cal_year] = useState(new Date().getFullYear());
  const [cal_month, set_cal_month] = useState(new Date().getMonth());
  const [selected_date, set_selected_date] = useState<string>(fmt(new Date()));
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});
  const [saving, set_saving] = useState(false);
  // Nuovo stato per il modal dettaglio
  const [detail_slot, set_detail_slot] = useState<any>(null);

  React.useEffect(() => {
    if (!selected_istruttore && istruttori.length > 0) {
      set_selected_istruttore(istruttori[0].id);
    }
  }, [istruttori, selected_istruttore]);

  const istruttore = istruttori.find((i: any) => i.id === selected_istruttore);

  const dispSlots = useMemo(() => {
    if (!istruttore?.disponibilita) return [];
    const slots: { giorno: string; ora_inizio: string; ora_fine: string }[] = [];
    for (const [giorno, times] of Object.entries(
      istruttore.disponibilita as Record<string, { ora_inizio: string; ora_fine: string }[]>,
    )) {
      for (const t of times) {
        slots.push({ giorno, ora_inizio: t.ora_inizio, ora_fine: t.ora_fine });
      }
    }
    return slots;
  }, [istruttore]);

  const corso_busy_by_day = useMemo(() => {
    if (!selected_istruttore) return {};
    const result: Record<string, { start: number; end: number }[]> = {};
    for (const c of corsi) {
      if (!c.istruttori_ids?.includes(selected_istruttore)) continue;
      if (!c.attivo) continue;
      if (!c.giorno) continue;
      if (!result[c.giorno]) result[c.giorno] = [];
      const s = time_to_min(c.ora_inizio || "00:00");
      const e = time_to_min(c.ora_fine || "00:00");
      if (e > s) result[c.giorno].push({ start: s, end: e });
    }
    return result;
  }, [corsi, selected_istruttore]);

  const get_slots_for_date = (date_str: string) => {
    if (!istruttore) return [];
    const date = new Date(date_str + "T00:00:00");
    const day_of_week = date.getDay();
    const giorno = GIORNI[day_of_week === 0 ? 6 : day_of_week - 1];

    const dayDispSlots = dispSlots.filter((ds: any) => ds.giorno === giorno);
    const avail = dayDispSlots.map((ds) => ({
      start: time_to_min(ds.ora_inizio),
      end: time_to_min(ds.ora_fine),
    }));

    const busy_corsi = corso_busy_by_day[giorno] || [];
    const free = subtract_intervals(avail, busy_corsi);

    const free_times = new Set<number>();
    for (const interval of free) {
      for (let m = interval.start; m + 20 <= interval.end; m += 20) {
        free_times.add(m);
      }
    }

    const day_lessons = lezioni.filter((l: any) => l.istruttore_id === selected_istruttore && l.data === date_str);

    const all_times = new Set(free_times);
    for (const l of day_lessons) {
      all_times.add(time_to_min(l.ora_inizio));
    }

    return Array.from(all_times)
      .sort((a, b) => a - b)
      .map((m) => {
        const time = min_to_time(m);
        const lesson = day_lessons.find((l: any) => time_to_min(l.ora_inizio) === m);
        return {
          time,
          end_time: min_to_time(m + 20),
          status: lesson ? "occupato" : "libero",
          lesson,
        };
      });
  };

  const month_info = useMemo(() => {
    if (!istruttore) return {};
    const result: Record<string, { liberi: number; occupati: number }> = {};
    const days_in_month = new Date(cal_year, cal_month + 1, 0).getDate();
    for (let d = 1; d <= days_in_month; d++) {
      const date_str = fmt(new Date(cal_year, cal_month, d));
      const slots = get_slots_for_date(date_str);
      result[date_str] = {
        liberi: slots.filter((s) => s.status === "libero").length,
        occupati: slots.filter((s) => s.status === "occupato").length,
      };
    }
    return result;
  }, [istruttore, cal_year, cal_month, lezioni, corso_busy_by_day, dispSlots]);

  const cal_days = useMemo(() => {
    const first = new Date(cal_year, cal_month, 1);
    const first_dow = first.getDay();
    const offset = first_dow === 0 ? 6 : first_dow - 1;
    const days_in_month = new Date(cal_year, cal_month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= days_in_month; d++) cells.push(d);
    return cells;
  }, [cal_year, cal_month]);

  const prev_month = () => {
    if (cal_month === 0) {
      set_cal_year((y) => y - 1);
      set_cal_month(11);
    } else set_cal_month((m) => m - 1);
  };
  const next_month = () => {
    if (cal_month === 11) {
      set_cal_year((y) => y + 1);
      set_cal_month(0);
    } else set_cal_month((m) => m + 1);
  };

  const open_slot = (time: string, end_time: string) => {
    const costo = (istruttore?.costo_minuto_lezione_privata || 0) * 20;
    set_form_data({
      istruttore_id: selected_istruttore,
      data: selected_date,
      ora_inizio: time,
      ora_fine: end_time,
      durata_minuti: 20,
      atleti_ids: [],
      ricorrente: false,
      costo_totale: costo,
      note: "",
    });
    set_form_open(true);
  };

  // Apre il modal dettaglio per uno slot occupato
  const open_detail = (slot: any) => {
    set_detail_slot(slot);
  };

  const handle_annulla = async () => {
    if (!detail_slot?.lesson) return;
    if (!window.confirm("Annullare questa lezione e liberare lo slot?")) return;
    try {
      await annulla_lezione.mutateAsync(detail_slot.lesson.id);
      set_detail_slot(null);
      toast({ title: "Lezione annullata — slot liberato" });
    } catch (err: any) {
      toast({ title: "Errore annullamento", description: err?.message, variant: "destructive" });
    }
  };

  const handle_modifica = () => {
    if (!detail_slot?.lesson) return;
    const lesson = detail_slot.lesson;
    set_form_data({
      istruttore_id: selected_istruttore,
      data: selected_date,
      ora_inizio: lesson.ora_inizio,
      ora_fine: lesson.ora_fine,
      durata_minuti: lesson.durata_minuti || 20,
      atleti_ids: lesson.atleti_ids || [],
      ricorrente: false,
      costo_totale: lesson.costo || 0,
      note: lesson.note || "",
    });
    set_detail_slot(null);
    set_form_open(true);
  };

  const handle_submit = async () => {
    if (!form_data.atleti_ids?.length) {
      toast({ title: "Seleziona almeno un atleta", variant: "destructive" });
      return;
    }
    set_saving(true);
    try {
      await crea_lezione.mutateAsync({
        istruttore_id: form_data.istruttore_id,
        data: form_data.data,
        ora_inizio: form_data.ora_inizio,
        ora_fine: form_data.ora_fine,
        durata_minuti: form_data.durata_minuti,
        atleti_ids: form_data.atleti_ids,
        ricorrente: form_data.ricorrente,
        costo_totale: form_data.costo_totale || 0,
        note: form_data.note || "",
      });
      set_form_open(false);
      toast({
        title: form_data.ricorrente ? "📅 Lezioni ricorrenti create fino a fine stagione!" : "✅ Lezione prenotata!",
      });
    } catch (err: any) {
      toast({
        title: "Errore durante il salvataggio",
        description: err?.message ?? "Controlla la console per dettagli.",
        variant: "destructive",
      });
    } finally {
      set_saving(false);
    }
  };

  // Risolve atleti_ids in nomi per la visualizzazione sullo slot
  const get_atleti_names = (atleti_ids: string[]): string => {
    return atleti_ids
      .map((id) => {
        const a = atleti.find((x: any) => x.id === id);
        return a ? `${a.nome} ${a.cognome}` : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  const today = fmt(new Date());
  const selected_slots = get_slots_for_date(selected_date);
  const selected_date_obj = new Date(selected_date + "T00:00:00");
  const selected_label = selected_date_obj.toLocaleDateString("it-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <>
      {form_open && (
        <SlotModal
          form={form_data}
          atleti={atleti}
          on_change={(k, v) => set_form_data((p) => ({ ...p, [k]: v }))}
          on_submit={handle_submit}
          on_close={() => set_form_open(false)}
          loading={saving}
        />
      )}

      {detail_slot && (
        <SlotDetailModal
          slot={detail_slot}
          atleti={atleti}
          on_close={() => set_detail_slot(null)}
          on_annulla={handle_annulla}
          on_modifica={handle_modifica}
          loading={annulla_lezione.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Lezioni Private</h1>

        <div className="w-64">
          <Select value={selected_istruttore} onValueChange={set_selected_istruttore}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona istruttore" />
            </SelectTrigger>
            <SelectContent>
              {istruttori
                .filter((i: any) => i.attivo)
                .map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} {i.cognome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {istruttore ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Calendario ── */}
            <div className="bg-card rounded-2xl shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prev_month} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <h2 className="text-sm font-bold text-foreground">
                  {MESI[cal_month]} {cal_year}
                </h2>
                <button onClick={next_month} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {GIORNI_SHORT.map((g) => (
                  <div key={g} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">
                    {g}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cal_days.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const date_str = fmt(new Date(cal_year, cal_month, day));
                  const info = month_info[date_str] || { liberi: 0, occupati: 0 };
                  const is_selected = date_str === selected_date;
                  const is_today = date_str === today;
                  const has_slots = info.liberi > 0 || info.occupati > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => set_selected_date(date_str)}
                      className={`relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-medium transition-all
                        ${
                          is_selected
                            ? "bg-primary text-primary-foreground shadow-md"
                            : is_today
                              ? "ring-2 ring-primary text-primary"
                              : has_slots
                                ? "hover:bg-muted/50 text-foreground"
                                : "text-muted-foreground/40 cursor-default"
                        }`}
                    >
                      {day}
                      {has_slots && (
                        <div className="flex gap-0.5 mt-0.5">
                          {info.occupati > 0 && (
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${is_selected ? "bg-white/70" : "bg-destructive/70"}`}
                            />
                          )}
                          {info.liberi > 0 && (
                            <div className={`w-1.5 h-1.5 rounded-full ${is_selected ? "bg-white" : "bg-success"}`} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-success" /> Libero
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive/70" /> Prenotato
                </div>
              </div>
            </div>

            {/* ── Slot giorno ── */}
            <div className="bg-card rounded-2xl shadow-card p-5">
              <h3 className="text-sm font-bold text-foreground capitalize mb-4">{selected_label}</h3>
              {selected_slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Nessuno slot disponibile</p>
                  <p className="text-xs mt-1 opacity-70">L'istruttore non è disponibile in questo giorno</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {selected_slots.map((slot, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        if (slot.status === "libero") {
                          open_slot(slot.time, slot.end_time);
                        } else {
                          open_detail(slot);
                        }
                      }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all
                        ${
                          slot.status === "libero"
                            ? "bg-success/10 hover:bg-success/20 border border-success/20"
                            : "bg-destructive/10 hover:bg-destructive/15 border border-destructive/20"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${slot.status === "libero" ? "bg-success" : "bg-destructive"}`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-foreground tabular-nums">
                            {slot.time} – {slot.end_time}
                          </p>
                          {slot.status === "occupato" && slot.lesson && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {/* Mostra nomi atleti invece di "Occupato" */}
                              {slot.lesson.atleti_ids?.length
                                ? get_atleti_names(slot.lesson.atleti_ids)
                                : slot.lesson.note || "Occupato"}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full
                        ${slot.status === "libero" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
                      >
                        {slot.status === "libero" ? "+ Prenota" : "Dettagli"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-card p-8 text-center text-muted-foreground">
            Seleziona un istruttore per vedere le disponibilità
          </div>
        )}
      </div>
    </>
  );
};
