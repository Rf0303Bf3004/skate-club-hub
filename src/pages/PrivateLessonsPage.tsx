import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  use_lezioni_private,
  use_istruttori,
  use_atleti,
  use_corsi,
  get_atleta_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_crea_lezione_privata, use_annulla_lezione } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, X, Search, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const GIORNI_SETTIMANA = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function get_week_start(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function format_date(d: Date): string {
  return d.toISOString().split("T")[0];
}

function time_to_minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutes_to_time(m: number): string {
  return `${Math.floor(m / 60)
    .toString()
    .padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
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

// ─── Ricerca atleta con autocomplete ──────────────────────────────────────────
const AtletaSearch: React.FC<{
  atleti: any[];
  selected_ids: string[];
  on_change: (ids: string[]) => void;
}> = ({ atleti, selected_ids, on_change }) => {
  const [query, set_query] = useState("");
  const [open, set_open] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return atleti.slice(0, 8);
    const q = query.toLowerCase();
    return atleti.filter((a: any) => `${a.nome} ${a.cognome}`.toLowerCase().includes(q)).slice(0, 8);
  }, [atleti, query]);

  const toggle = (id: string) => {
    on_change(selected_ids.includes(id) ? selected_ids.filter((i) => i !== id) : [...selected_ids, id]);
  };

  const selected_names = selected_ids
    .map((id) => atleti.find((a: any) => a.id === id))
    .filter(Boolean)
    .map((a: any) => `${a.nome} ${a.cognome}`)
    .join(", ");

  return (
    <div className="relative">
      <div className="form-input flex items-center gap-2 cursor-text min-h-[38px]" onClick={() => set_open(true)}>
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        {selected_ids.length > 0 && !open ? (
          <span className="text-sm text-foreground truncate">{selected_names}</span>
        ) : (
          <input
            autoFocus={open}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            placeholder="Cerca atleta..."
            value={query}
            onChange={(e) => {
              set_query(e.target.value);
              set_open(true);
            }}
            onFocus={() => set_open(true)}
          />
        )}
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
                const is_selected = selected_ids.includes(a.id);
                return (
                  <div
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors
                      ${is_selected ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"}`}
                  >
                    <span>
                      {a.nome} {a.cognome}
                    </span>
                    {is_selected && <Check className="w-4 h-4" />}
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

// ─── Modal prenotazione slot ───────────────────────────────────────────────────
const SlotModal: React.FC<{
  data: Record<string, any>;
  atleti: any[];
  on_change: (k: string, v: any) => void;
  on_submit: () => void;
  on_close: () => void;
  loading: boolean;
}> = ({ data, atleti, on_change, on_submit, on_close, loading }) => {
  const date_label = data.data
    ? new Date(data.data + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Prenota {data.ora_inizio}–{data.ora_fine}
            </h2>
            <p className="text-xs text-muted-foreground capitalize">{date_label}</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Atleta */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atleta *</label>
            <AtletaSearch
              atleti={atleti}
              selected_ids={data.atleti_ids || []}
              on_change={(ids) => on_change("atleti_ids", ids)}
            />
          </div>

          {/* Costo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Costo totale (CHF)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                CHF
              </span>
              <input
                type="number"
                min="0"
                step="0.50"
                value={data.costo_totale || 0}
                onChange={(e) => on_change("costo_totale", parseFloat(e.target.value) || 0)}
                className="form-input pl-11"
              />
            </div>
          </div>

          {/* Ricorrente */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ricorrenza</label>
            <div
              onClick={() => on_change("ricorrente", !data.ricorrente)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${
                  data.ricorrente
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40"
                }`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                ${data.ricorrente ? "border-primary bg-primary" : "border-muted-foreground"}`}
              >
                {data.ricorrente && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <p className="text-sm font-medium">Lezione ricorrente</p>
                <p className="text-xs opacity-70">Ogni settimana alla stessa ora fino a fine stagione</p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</label>
            <textarea
              value={data.note || ""}
              onChange={(e) => on_change("note", e.target.value)}
              rows={2}
              placeholder="Note opzionali..."
              className="form-input resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={on_close} disabled={loading}>
            Annulla
          </Button>
          <Button
            onClick={on_submit}
            disabled={loading || !data.atleti_ids?.length}
            className="bg-primary hover:bg-primary/90 min-w-[100px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Salvo...
              </span>
            ) : data.ricorrente ? (
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
const PrivateLessonsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: lezioni = [], isLoading } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();
  const { data: corsi = [] } = use_corsi();
  const crea = use_crea_lezione_privata();
  const annulla = use_annulla_lezione();
  const [selected_istruttore, set_selected_istruttore] = useState<string>("");
  const [week_offset, set_week_offset] = useState(0);
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});

  const week_start = useMemo(() => {
    const d = get_week_start(new Date());
    d.setDate(d.getDate() + week_offset * 7);
    return d;
  }, [week_offset]);

  const week_dates = useMemo(() => {
    return GIORNI_SETTIMANA.map((_, i) => {
      const d = new Date(week_start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [week_start]);

  const istruttore = istruttori.find((i: any) => i.id === selected_istruttore);

  React.useEffect(() => {
    if (!selected_istruttore && istruttori.length > 0) {
      set_selected_istruttore(istruttori[0].id);
    }
  }, [istruttori, selected_istruttore]);

  const corso_busy_by_day = useMemo(() => {
    if (!selected_istruttore) return {};
    const result: Record<string, { start: number; end: number }[]> = {};
    for (const c of corsi) {
      if (!c.istruttori_ids?.includes(selected_istruttore)) continue;
      if (c.stato !== "attivo") continue;
      const giorno = c.giorno;
      if (!giorno) continue;
      if (!result[giorno]) result[giorno] = [];
      const start = time_to_minutes(c.ora_inizio || "00:00");
      const end = time_to_minutes(c.ora_fine || "00:00");
      if (end > start) result[giorno].push({ start, end });
    }
    return result;
  }, [corsi, selected_istruttore]);

  const day_slots = useMemo(() => {
    if (!istruttore) return {};
    const result: Record<
      number,
      { time: string; end_time: string; date: string; status: "libero" | "occupato"; lesson?: any }[]
    > = {};

    week_dates.forEach((date, dayIdx) => {
      const giorno = GIORNI_SETTIMANA[dayIdx];
      const disp_slots = istruttore.disponibilita?.[giorno] || [];
      const date_str = format_date(date);
      const slots: (typeof result)[0] = [];

      const avail_intervals = disp_slots.map((ds: any) => ({
        start: time_to_minutes(ds.ora_inizio),
        end: time_to_minutes(ds.ora_fine),
      }));

      const busy = corso_busy_by_day[giorno] || [];
      const free_intervals = subtract_intervals(avail_intervals, busy);

      const free_slot_times = new Set<number>();
      for (const interval of free_intervals) {
        for (let m = interval.start; m + 20 <= interval.end; m += 20) {
          free_slot_times.add(m);
        }
      }

      const day_lessons = lezioni.filter(
        (l: any) => l.istruttore_id === selected_istruttore && l.data === date_str && !l.annullata,
      );

      const all_slot_times = new Set(free_slot_times);
      for (const l of day_lessons) {
        const ls = time_to_minutes(l.ora_inizio);
        all_slot_times.add(ls);
      }

      const sorted = Array.from(all_slot_times).sort((a, b) => a - b);
      for (const m of sorted) {
        const time = minutes_to_time(m);
        const lesson = day_lessons.find((l: any) => time_to_minutes(l.ora_inizio) === m);
        slots.push({
          time,
          end_time: minutes_to_time(m + 20),
          date: date_str,
          status: lesson ? "occupato" : "libero",
          lesson,
        });
      }

      result[dayIdx] = slots;
    });
    return result;
  }, [istruttore, week_dates, lezioni, selected_istruttore, corso_busy_by_day]);

  const open_slot = (date: string, time: string) => {
    const end_min = time_to_minutes(time) + 20;
    // FIX: usa costo_minuto_lezione_privata (nome corretto del campo)
    const costo = (istruttore?.costo_minuto_lezione_privata || 0) * 20;
    set_form_data({
      istruttore_id: selected_istruttore,
      data: date,
      ora_inizio: time,
      ora_fine: minutes_to_time(end_min),
      durata_minuti: 20,
      atleti_ids: [],
      ricorrente: false,
      costo_totale: costo,
      note: "",
    });
    set_form_open(true);
  };

  const handle_submit = async () => {
    if (!form_data.atleti_ids?.length) {
      toast({ title: "Seleziona almeno un atleta", variant: "destructive" });
      return;
    }
    try {
      await crea.mutateAsync(form_data);
      set_form_open(false);
      toast({ title: form_data.ricorrente ? "📅 Lezioni ricorrenti create!" : "Lezione prenotata!" });
    } catch (error: any) {
      console.error("Errore salvataggio lezione privata", error);
      toast({
        title: "Errore durante il salvataggio",
        description: error?.message ?? "Controlla la console per i dettagli.",
        variant: "destructive",
      });
    }
  };

  const week_lessons = useMemo(() => {
    const start_str = format_date(week_start);
    const end = new Date(week_start);
    end.setDate(end.getDate() + 6);
    const end_str = format_date(end);
    return lezioni.filter(
      (l: any) => l.istruttore_id === selected_istruttore && l.data >= start_str && l.data <= end_str && !l.annullata,
    );
  }, [lezioni, selected_istruttore, week_start]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  const week_label = `${week_dates[0].toLocaleDateString("it-CH", { day: "numeric", month: "short" })} — ${week_dates[6].toLocaleDateString("it-CH", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      {form_open && (
        <SlotModal
          data={form_data}
          atleti={atleti}
          on_change={(k, v) => set_form_data((p) => ({ ...p, [k]: v }))}
          on_submit={handle_submit}
          on_close={() => set_form_open(false)}
          loading={crea.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t("lezioni_private")}</h1>

        {/* Controlli */}
        <div className="flex flex-wrap items-center gap-4">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => set_week_offset((w) => w - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-foreground min-w-[200px] text-center">{week_label}</span>
            <Button variant="outline" size="icon" onClick={() => set_week_offset((w) => w + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => set_week_offset(0)}>
              Oggi
            </Button>
          </div>
        </div>

        {/* Griglia settimanale */}
        {istruttore ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {GIORNI_SETTIMANA.map((giorno, dayIdx) => {
              const slots = day_slots[dayIdx] || [];
              const date = week_dates[dayIdx];
              const is_today = format_date(date) === format_date(new Date());
              return (
                <div
                  key={giorno}
                  className={`bg-card rounded-xl shadow-card overflow-hidden ${is_today ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="px-3 py-2 border-b border-border bg-muted/30">
                    <p className="text-xs font-bold text-muted-foreground uppercase">{giorno.slice(0, 3)}</p>
                    <p className="text-sm font-medium text-foreground">
                      {date.getDate()}/{date.getMonth() + 1}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {slots.length === 0 && (
                      <p className="text-[10px] text-muted-foreground p-2 text-center">Non disponibile</p>
                    )}
                    {slots.map((slot, i) => (
                      <div
                        key={i}
                        onClick={() => slot.status === "libero" && open_slot(slot.date, slot.time)}
                        className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                          slot.status === "libero"
                            ? "bg-success/10 hover:bg-success/20 cursor-pointer text-success"
                            : "bg-accent/10 text-accent cursor-default"
                        }`}
                      >
                        <span className="font-medium tabular-nums">{slot.time}</span>
                        {slot.status === "occupato" && slot.lesson && (
                          <span className="ml-1 font-medium truncate">
                            {slot.lesson.atleti_ids
                              ?.map((id: string) => get_atleta_name_from_list(atleti, id).split(" ")[0])
                              .join(", ") || "•"}
                          </span>
                        )}
                        {slot.status === "libero" && <span className="ml-1 opacity-60">+</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-xl shadow-card p-8 text-center text-muted-foreground">
            Seleziona un istruttore
          </div>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-success/20" /> Libero
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-accent/20" /> Occupato
          </div>
        </div>

        {/* Tabella lezioni settimana */}
        {week_lessons.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Lezioni della settimana
            </h2>
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Data
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Orario
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      Atleti
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      CHF
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {week_lessons.map((l: any) => (
                    <tr key={l.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(l.data + "T00:00:00").toLocaleDateString("it-CH")}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {l.ora_inizio?.slice(0, 5)}–{l.ora_fine?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {l.atleti_ids?.map((id: string) => get_atleta_name_from_list(atleti, id)).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                        CHF {l.costo_totale ?? l.costo ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => annulla.mutateAsync(l.id)}
                          title="Annulla lezione"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PrivateLessonsPage;
