import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, User, X } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";

// ─── Types ─────────────────────────────────────────────────
type CalEvent = {
  date: string;
  time_start: string;
  time_end: string;
  title: string;
  type: "corso" | "corso_cancelled" | "gara" | "test" | "comunicazione";
  location?: string;
  instructor?: string;
  status: "confermato" | "annullato" | "previsto";
  raw?: any;
};

// ─── Colors ────────────────────────────────────────────────
const EVENT_COLORS: Record<string, { bg: string; dot: string; text: string; border: string }> = {
  corso:             { bg: "bg-[#185FA5]/10", dot: "bg-[#185FA5]", text: "text-[#185FA5]", border: "border-[#185FA5]/30" },
  corso_cancelled:   { bg: "bg-[#993C1D]/10", dot: "bg-[#993C1D]", text: "text-[#993C1D]", border: "border-[#993C1D]/30" },
  gara:              { bg: "bg-[#854F0B]/10", dot: "bg-[#854F0B]", text: "text-[#854F0B]", border: "border-[#854F0B]/30" },
  test:              { bg: "bg-[#534AB7]/10", dot: "bg-[#534AB7]", text: "text-[#534AB7]", border: "border-[#534AB7]/30" },
  comunicazione:     { bg: "bg-[#0F6E56]/10", dot: "bg-[#0F6E56]", text: "text-[#0F6E56]", border: "border-[#0F6E56]/30" },
};

const EVENT_LABELS: Record<string, string> = {
  corso: "Corso", corso_cancelled: "Corso annullato", gara: "Gara", test: "Test livello", comunicazione: "Comunicazione",
};

// ─── Helpers ───────────────────────────────────────────────
const GIORNO_MAP: Record<string, number> = {
  "Lunedì": 1, "Martedì": 2, "Mercoledì": 3, "Giovedì": 4,
  "Venerdì": 5, "Sabato": 6, "Domenica": 0,
};
const GIORNI_LABEL = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

function fmt_date(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function generate_recurring(giorno: string, from: string, to: string): string[] {
  const target = GIORNO_MAP[giorno];
  if (target === undefined) return [];
  const dates: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d.getDay() !== target && d <= end) d.setDate(d.getDate() + 1);
  while (d <= end) { dates.push(fmt_date(d)); d.setDate(d.getDate() + 7); }
  return dates;
}

function get_month_days(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: { date: string; day: number; current_month: boolean }[] = [];
  const start_pad = (first.getDay() + 6) % 7; // Monday-based
  for (let i = start_pad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: fmt_date(d), day: d.getDate(), current_month: false });
  }
  for (let i = 1; i <= last.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ date: fmt_date(d), day: i, current_month: true });
  }
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - last.getDate() - start_pad + 1);
    days.push({ date: fmt_date(d), day: d.getDate(), current_month: false });
  }
  return days;
}

function get_week_dates(base: Date): string[] {
  const monday = new Date(base);
  const dow = monday.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return fmt_date(d);
  });
}

// ─── Data Fetching Hook ────────────────────────────────────
function use_calendar_events(atleta_id: string) {
  return useQuery({
    queryKey: ["calendario-interattivo", atleta_id],
    queryFn: async () => {
      const events: CalEvent[] = [];

      // ── Corsi ──
      const { data: iscrizioni } = await supabase
        .from("iscrizioni_corsi").select("corso_id").eq("atleta_id", atleta_id).eq("attiva", true);
      if (iscrizioni?.length) {
        const corso_ids = iscrizioni.map((i: any) => i.corso_id);
        const { data: corsi_info } = await supabase
          .from("corsi").select("id, nome, giorno, ora_inizio, ora_fine, stagione_id").in("id", corso_ids);

        if (corsi_info?.length) {
          const stagione_ids = [...new Set(corsi_info.map((c: any) => c.stagione_id).filter(Boolean))];
          const stagione_map: Record<string, string> = {};
          if (stagione_ids.length) {
            const { data: stagioni } = await supabase.from("stagioni").select("id, data_fine").in("id", stagione_ids);
            (stagioni ?? []).forEach((s: any) => { stagione_map[s.id] = s.data_fine; });
          }

          // Istruttori assignments
          const { data: ci_raw } = await supabase.from("corsi_istruttori").select("corso_id, istruttore_id").in("corso_id", corso_ids);
          const istr_ids = [...new Set((ci_raw ?? []).map((r: any) => r.istruttore_id))];
          const istr_map: Record<string, string> = {};
          if (istr_ids.length) {
            const { data: istr } = await supabase.from("istruttori").select("id, nome, cognome").in("id", istr_ids);
            (istr ?? []).forEach((i: any) => { istr_map[i.id] = `${i.nome} ${i.cognome}`; });
          }
          const corso_istr: Record<string, string[]> = {};
          (ci_raw ?? []).forEach((r: any) => {
            if (!corso_istr[r.corso_id]) corso_istr[r.corso_id] = [];
            if (istr_map[r.istruttore_id]) corso_istr[r.corso_id].push(istr_map[r.istruttore_id]);
          });

          const { data: slots } = await supabase
            .from("planning_corsi_settimana").select("data, ora_inizio, ora_fine, corso_id, annullato, istruttore_id")
            .in("corso_id", corso_ids);
          const slot_map: Record<string, any> = {};
          (slots ?? []).forEach((s: any) => { slot_map[`${s.corso_id}|${s.data}`] = s; });

          const today_str = fmt_date(new Date());
          for (const c of corsi_info) {
            const end = stagione_map[c.stagione_id] || `${new Date().getFullYear()}-12-31`;
            // Generate from 3 months ago to season end for browsing history
            const three_months_ago = new Date();
            three_months_ago.setMonth(three_months_ago.getMonth() - 3);
            const start = fmt_date(three_months_ago) < today_str ? fmt_date(three_months_ago) : today_str;
            const dates = generate_recurring(c.giorno, start, end);
            const time_s = (c.ora_inizio || "").slice(0, 5);
            const time_e = (c.ora_fine || "").slice(0, 5);
            const instructor = (corso_istr[c.id] ?? []).join(", ");

            for (const dt of dates) {
              const key = `${c.id}|${dt}`;
              const slot = slot_map[key];
              if (slot?.annullato) {
                events.push({ date: dt, time_start: time_s, time_end: time_e, title: c.nome, type: "corso_cancelled", status: "annullato", instructor, raw: slot });
              } else if (slot) {
                const si = (slot.ora_inizio || "").slice(0, 5);
                const se = (slot.ora_fine || "").slice(0, 5);
                const slot_istr = slot.istruttore_id && istr_map[slot.istruttore_id] ? istr_map[slot.istruttore_id] : instructor;
                events.push({ date: dt, time_start: si, time_end: se, title: c.nome, type: "corso", status: "confermato", instructor: slot_istr, raw: slot });
              } else {
                events.push({ date: dt, time_start: time_s, time_end: time_e, title: c.nome, type: "corso", status: "previsto", instructor });
              }
            }
          }
        }
      }

      // ── Gare ──
      const { data: isc_gare } = await supabase.from("iscrizioni_gare").select("gara_id").eq("atleta_id", atleta_id);
      if (isc_gare?.length) {
        const ids = isc_gare.map((i: any) => i.gara_id);
        const { data: gare } = await supabase.from("gare_calendario").select("*").in("id", ids);
        (gare ?? []).forEach((g: any) => {
          if (g.data) events.push({ date: g.data, time_start: "", time_end: "", title: g.nome, type: "gara", status: "confermato", location: g.luogo || "" });
        });
      }

      // ── Test livello ──
      const { data: ta } = await supabase.from("test_livello_atleti").select("test_id").eq("atleta_id", atleta_id);
      if (ta?.length) {
        const ids = ta.map((t: any) => t.test_id);
        const { data: tests } = await supabase.from("test_livello").select("*").in("id", ids);
        (tests ?? []).forEach((t: any) => {
          if (t.data) events.push({ date: t.data, time_start: (t.ora || "").slice(0, 5), time_end: "", title: t.nome, type: "test", status: "confermato", location: t.luogo || "" });
        });
      }

      // ── Comunicazioni con data ──
      // Note: the comunicazioni table doesn't have programmata_per column currently, 
      // so we skip this unless the column exists. We try and catch.
      try {
        const { data: comms, error } = await supabase
          .from("comunicazioni")
          .select("id, titolo, testo")
          .eq("club_id", get_current_club_id());
        // Since programmata_per doesn't exist in schema, skip for now
      } catch { /* skip */ }

      return events.sort((a, b) => a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start));
    },
  });
}

// ─── Day Detail Bottom Sheet ───────────────────────────────
const DayBottomSheet: React.FC<{
  date: string | null;
  events: CalEvent[];
  on_close: () => void;
  on_event: (e: CalEvent) => void;
}> = ({ date, events, on_close, on_event }) => {
  if (!date) return null;
  const day_events = events.filter(e => e.date === date).sort((a, b) => a.time_start.localeCompare(b.time_start));
  const label = new Date(date + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={on_close} />
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-card rounded-t-2xl shadow-xl max-h-[70vh] overflow-auto">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground capitalize">{label}</h3>
              <button onClick={on_close} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            {day_events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nessun impegno in questa giornata</p>
            ) : (
              <div className="divide-y divide-border">
                {day_events.map((ev, i) => {
                  const colors = EVENT_COLORS[ev.type] ?? EVENT_COLORS.corso;
                  const is_cancelled = ev.type === "corso_cancelled";
                  return (
                    <button
                      key={i}
                      onClick={() => { on_close(); on_event(ev); }}
                      className={`w-full flex items-center gap-3 py-3 hover:bg-muted/30 transition-colors text-left ${is_cancelled ? "opacity-50" : ""}`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${colors.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${is_cancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>{ev.title}</p>
                        {ev.time_start && (
                          <p className="text-xs text-muted-foreground">{ev.time_start}{ev.time_end ? ` — ${ev.time_end}` : ""}</p>
                        )}
                        {ev.instructor && <p className="text-xs text-muted-foreground">{ev.instructor}</p>}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${colors.bg} ${colors.text}`}>
                        {EVENT_LABELS[ev.type]}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="h-6" />
        </div>
      </div>
    </>
  );
};

// ─── Event Detail Bottom Sheet ─────────────────────────────
const EventBottomSheet: React.FC<{ event: CalEvent | null; on_close: () => void }> = ({ event, on_close }) => {
  if (!event) return null;
  const colors = EVENT_COLORS[event.type] ?? EVENT_COLORS.corso;
  const status_label = event.status === "annullato" ? "Annullato" : event.status === "confermato" ? "Confermato" : "Previsto";

  return (
    <>
      <div className="fixed inset-0 z-[51] bg-black/40 backdrop-blur-sm" onClick={on_close} />
      <div className="fixed inset-x-0 bottom-0 z-[51] animate-in slide-in-from-bottom duration-300">
        <div className="bg-card rounded-t-2xl shadow-xl max-h-[70vh] overflow-auto">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
          <div className="px-5 pt-4 pb-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block w-3 h-3 rounded-full ${colors.dot}`} />
                  <span className={`text-xs font-medium ${colors.text}`}>{EVENT_LABELS[event.type]}</span>
                </div>
                <h3 className="text-lg font-bold text-foreground leading-tight">{event.title}</h3>
              </div>
              <button onClick={on_close} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">
                  {new Date(event.date + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              {(event.time_start || event.time_end) && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">
                    {event.time_start}{event.time_end ? ` — ${event.time_end}` : ""}
                  </span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{event.location}</span>
                </div>
              )}
              {event.instructor && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{event.instructor}</span>
                </div>
              )}
            </div>

            {/* Status badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              {status_label}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Monthly View ──────────────────────────────────────────
const MonthView: React.FC<{ year: number; month: number; events: CalEvent[]; on_day_click: (date: string) => void }> = ({ year, month, events, on_day_click }) => {
  const days = get_month_days(year, month);
  const today = fmt_date(new Date());

  const events_by_date = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    events.forEach(e => { (map[e.date] ??= []).push(e); });
    return map;
  }, [events]);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
        ))}
      </div>
      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {days.map((d, i) => {
          const day_events = events_by_date[d.date] ?? [];
          const is_today = d.date === today;
          const has_events = day_events.length > 0;
          return (
            <button
              key={i}
              onClick={() => on_day_click(d.date)}
              className={`min-h-[72px] p-1 text-left transition-colors ${d.current_month ? "bg-card hover:bg-muted/40" : "bg-muted/30 hover:bg-muted/50"} ${is_today ? "ring-2 ring-inset ring-[#185FA5]/40" : ""} ${has_events ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`text-xs font-medium mb-0.5 text-center ${is_today ? "bg-[#185FA5] text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto" : d.current_month ? "text-foreground" : "text-muted-foreground/50"}`}>
                {d.day}
              </div>
              {has_events && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                  {day_events.slice(0, 3).map((ev, j) => {
                    const c = EVENT_COLORS[ev.type] ?? EVENT_COLORS.corso;
                    return (
                      <span key={j} className={`w-2 h-2 rounded-full ${c.dot}`} />
                    );
                  })}
                  {day_events.length > 3 && (
                    <span className="text-[9px] font-bold text-muted-foreground leading-none">+{day_events.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Weekly View ───────────────────────────────────────────
const HOUR_START = 6;
const HOUR_END = 22;
const HOUR_HEIGHT = 48; // px per hour

const WeekView: React.FC<{ base_date: Date; events: CalEvent[]; on_event: (e: CalEvent) => void }> = ({ base_date, events, on_event }) => {
  const week_dates = get_week_dates(base_date);
  const today = fmt_date(new Date());

  const events_by_date = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    events.forEach(e => { (map[e.date] ??= []).push(e); });
    return map;
  }, [events]);

  const parse_time = (t: string): number => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border">
          <div />
          {week_dates.map((d, i) => {
            const dt = new Date(d + "T00:00:00");
            const is_today = d === today;
            return (
              <div key={d} className={`text-center py-2 ${is_today ? "bg-[#185FA5]/5" : ""}`}>
                <div className="text-[10px] uppercase font-medium text-muted-foreground">{GIORNI_LABEL[dt.getDay()]}</div>
                <div className={`text-sm font-bold ${is_today ? "bg-[#185FA5] text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto" : "text-foreground"}`}>
                  {dt.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative grid grid-cols-[50px_repeat(7,1fr)]" style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}>
          {/* Hour labels and lines */}
          {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
            <React.Fragment key={i}>
              <div className="absolute left-0 w-[50px] text-[10px] text-muted-foreground text-right pr-2" style={{ top: i * HOUR_HEIGHT - 6 }}>
                {String(HOUR_START + i).padStart(2, "0")}:00
              </div>
              <div className="absolute left-[50px] right-0 border-t border-border/50" style={{ top: i * HOUR_HEIGHT }} />
            </React.Fragment>
          ))}

          {/* Events per day column */}
          {week_dates.map((d, col_idx) => {
            const day_events = (events_by_date[d] ?? []).filter(e => e.time_start);
            return (
              <div key={d} className="absolute" style={{ left: `calc(50px + ${col_idx} * ((100% - 50px) / 7))`, width: `calc((100% - 50px) / 7)`, top: 0, bottom: 0 }}>
                {day_events.map((ev, j) => {
                  const start_h = parse_time(ev.time_start);
                  const end_h = ev.time_end ? parse_time(ev.time_end) : start_h + 0.5;
                  const top = (start_h - HOUR_START) * HOUR_HEIGHT;
                  const height = Math.max((end_h - start_h) * HOUR_HEIGHT, 20);
                  const colors = EVENT_COLORS[ev.type] ?? EVENT_COLORS.corso;

                  return (
                    <button
                      key={j}
                      onClick={() => on_event(ev)}
                      className={`absolute left-0.5 right-0.5 rounded-md px-1 py-0.5 text-left overflow-hidden border ${colors.bg} ${colors.border} ${colors.text} hover:shadow-md transition-shadow`}
                      style={{ top, height }}
                      title={ev.title}
                    >
                      <div className="text-[10px] font-semibold truncate leading-tight">{ev.title}</div>
                      {height > 28 && <div className="text-[9px] opacity-70">{ev.time_start}</div>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Agenda List ───────────────────────────────────────────
const AgendaList: React.FC<{ events: CalEvent[]; on_event: (e: CalEvent) => void }> = ({ events, on_event }) => {
  if (!events.length) return (
    <div className="text-center text-muted-foreground py-6 text-sm">Nessun evento in questo periodo</div>
  );

  let last_date = "";
  return (
    <div className="divide-y divide-border">
      {events.map((ev, i) => {
        const show_header = ev.date !== last_date;
        last_date = ev.date;
        const colors = EVENT_COLORS[ev.type] ?? EVENT_COLORS.corso;
        const is_cancelled = ev.type === "corso_cancelled";

        return (
          <React.Fragment key={i}>
            {show_header && (
              <div className="px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0">
                {new Date(ev.date + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            )}
            <button
              onClick={() => on_event(ev)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left ${is_cancelled ? "opacity-50" : ""}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${is_cancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>{ev.title}</p>
                {ev.time_start && <p className="text-xs text-muted-foreground">{ev.time_start}{ev.time_end ? ` — ${ev.time_end}` : ""}</p>}
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                {EVENT_LABELS[ev.type]}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────
const CalendarioAtletaInterattivo: React.FC<{ atleta_id: string }> = ({ atleta_id }) => {
  const [view, set_view] = useState<"month" | "week">("month");
  const [current_date, set_current_date] = useState(new Date());
  const [selected_event, set_selected_event] = useState<CalEvent | null>(null);

  const { data: all_events = [], isLoading } = use_calendar_events(atleta_id);

  const year = current_date.getFullYear();
  const month = current_date.getMonth();

  // Filter events for current view period
  const visible_events = useMemo(() => {
    if (view === "month") {
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const end_d = new Date(year, month + 1, 0);
      const end = fmt_date(end_d);
      return all_events.filter(e => e.date >= start && e.date <= end);
    } else {
      const week = get_week_dates(current_date);
      return all_events.filter(e => week.includes(e.date));
    }
  }, [all_events, view, year, month, current_date]);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(current_date);
    if (view === "month") {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + dir * 7);
    }
    set_current_date(d);
  };

  const go_today = () => set_current_date(new Date());

  const title = view === "month"
    ? `${MESI[month]} ${year}`
    : (() => {
        const week = get_week_dates(current_date);
        const s = new Date(week[0] + "T00:00:00");
        const e = new Date(week[6] + "T00:00:00");
        return `${s.getDate()} ${MESI[s.getMonth()].slice(0,3)} — ${e.getDate()} ${MESI[e.getMonth()].slice(0,3)} ${e.getFullYear()}`;
      })();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-card p-8 text-center text-muted-foreground">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm">Caricamento calendario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card rounded-xl shadow-card p-3">
        <div className="flex items-center justify-between gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => set_view("month")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === "month" ? "bg-[#185FA5] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              Mese
            </button>
            <button
              onClick={() => set_view("week")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === "week" ? "bg-[#185FA5] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              Settimana
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={go_today} className="px-2 py-1 text-xs font-medium text-[#185FA5] hover:bg-[#185FA5]/10 rounded-lg">
              Oggi
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h3 className="text-center text-sm font-bold text-foreground mt-2">{title}</h3>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {(["corso", "corso_cancelled", "gara", "test"] as const).map(type => {
          const c = EVENT_COLORS[type];
          return (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
              <span className="text-[10px] text-muted-foreground font-medium">{EVENT_LABELS[type]}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar view */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        {view === "month" ? (
          <div className="p-3">
            <MonthView year={year} month={month} events={visible_events} on_event={set_selected_event} />
          </div>
        ) : (
          <div className="p-3">
            <WeekView base_date={current_date} events={visible_events} on_event={set_selected_event} />
          </div>
        )}
      </div>

      {/* Agenda */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-sm font-bold text-foreground">
            Agenda {view === "month" ? MESI[month] : "settimana"}
          </h4>
        </div>
        <AgendaList events={visible_events} on_event={set_selected_event} />
      </div>

      {/* Bottom Sheet */}
      <EventBottomSheet event={selected_event} on_close={() => set_selected_event(null)} />
    </div>
  );
};

export default CalendarioAtletaInterattivo;
