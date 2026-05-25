import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalIcon, Clock, MapPin, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PortaleSession } from "@/lib/portale-auth";

interface Evento {
  id: string;
  tipo: string;
  data: string;
  ora_inizio: string;
  ora_fine: string | null;
  nome_evento: string | null;
  luogo: string | null;
  stato: string;
}

const TIPO_META: Record<string, { label: string; bg: string; border: string; text: string }> = {
  corso:            { label: "Corso",           bg: "bg-sky-500",     border: "border-sky-600",     text: "text-white" },
  lezione_privata:  { label: "Lezione privata", bg: "bg-violet-500",  border: "border-violet-600",  text: "text-white" },
  gara:             { label: "Gara",            bg: "bg-orange-500",  border: "border-orange-600",  text: "text-white" },
  campo:            { label: "Campo",           bg: "bg-emerald-500", border: "border-emerald-600", text: "text-white" },
  gala:             { label: "Galà",            bg: "bg-amber-500",   border: "border-amber-600",   text: "text-white" },
  pacchetto_pre:    { label: "Pre-evento",      bg: "bg-slate-500",   border: "border-slate-600",   text: "text-white" },
  pacchetto_post:   { label: "Post-evento",     bg: "bg-slate-500",   border: "border-slate-600",   text: "text-white" },
  evento_straordinario: { label: "Evento",      bg: "bg-rose-500",    border: "border-rose-600",    text: "text-white" },
};

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const ORA_START = 8;
const ORA_END = 22;
const HOUR_H = 56; // px per ora

function format_iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function lunedi_di(d: Date) {
  const x = new Date(d);
  const g = x.getDay();
  const diff = g === 0 ? -6 : 1 - g;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function add_days(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function ora_to_min(s: string | null): number { if (!s) return 0; const [h, m] = s.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); }

const PortaleCalendarioPage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const [oggi_ref] = useState(() => new Date());
  const [week_start, set_week_start] = useState<Date>(() => lunedi_di(new Date()));
  const [eventi, set_eventi] = useState<Evento[]>([]);
  const [loading, set_loading] = useState(true);
  const [selected, set_selected] = useState<Evento | null>(null);

  const week_end = useMemo(() => add_days(week_start, 6), [week_start]);

  useEffect(() => {
    let active = true;
    set_loading(true);
    (async () => {
      const { data } = await supabase
        .from("eventi_calendario" as any)
        .select("id, tipo, data, ora_inizio, ora_fine, nome_evento, luogo, stato")
        .eq("atleta_id", session.atleta.id)
        .gte("data", format_iso(week_start))
        .lte("data", format_iso(week_end))
        .neq("stato", "annullato")
        .order("data", { ascending: true })
        .order("ora_inizio", { ascending: true });
      if (!active) return;
      set_eventi(((data as any) ?? []) as Evento[]);
      set_loading(false);
    })();
    return () => { active = false; };
  }, [session.atleta.id, week_start, week_end]);

  const giorni = useMemo(() => Array.from({ length: 7 }, (_, i) => add_days(week_start, i)), [week_start]);
  const today_iso = format_iso(oggi_ref);

  // group by day
  const per_giorno = useMemo(() => {
    const m = new Map<string, Evento[]>();
    eventi.forEach((e) => {
      const arr = m.get(e.data) ?? [];
      arr.push(e);
      m.set(e.data, arr);
    });
    return m;
  }, [eventi]);

  const ore = useMemo(() => Array.from({ length: ORA_END - ORA_START }, (_, i) => ORA_START + i), []);

  const month_label = `${week_start.toLocaleDateString("it-CH", { day: "2-digit", month: "short" })} – ${week_end.toLocaleDateString("it-CH", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight">Calendario</h1>
          <p className="text-sm text-slate-500 capitalize mt-1">{month_label}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => set_week_start(add_days(week_start, -7))}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:shadow flex items-center justify-center transition-all"
            aria-label="Settimana precedente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => set_week_start(lunedi_di(new Date()))}
            className="px-4 h-10 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-semibold shadow hover:shadow-md transition-all"
          >
            Oggi
          </button>
          <button
            onClick={() => set_week_start(add_days(week_start, 7))}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:shadow flex items-center justify-center transition-all"
            aria-label="Settimana successiva"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-sky-500" /></div>
      ) : eventi.length === 0 ? (
        <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-sky-50 border border-slate-200 p-12 text-center">
          <CalIcon className="w-12 h-12 mx-auto mb-3 text-sky-400" />
          <p className="text-slate-700 font-bold text-xl">Settimana libera</p>
          <p className="text-slate-500 text-sm mt-2">Tempo per riposarsi sul ghiaccio.</p>
        </div>
      ) : (
        <>
          {/* DESKTOP: grid weekly */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Header giorni */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
              <div />
              {giorni.map((d) => {
                const iso = format_iso(d);
                const is_today = iso === today_iso;
                return (
                  <div key={iso} className={`px-2 py-3 text-center border-l border-slate-200 ${is_today ? "bg-sky-50" : ""}`}>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{GIORNI[d.getDay() === 0 ? 6 : d.getDay() - 1]}</p>
                    <p className={`text-lg font-bold ${is_today ? "text-sky-600" : "text-slate-800"}`}>{d.getDate()}</p>
                  </div>
                );
              })}
            </div>

            {/* Body griglia */}
            <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
              {/* Colonna ore */}
              <div>
                {ore.map((h) => (
                  <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100 text-[11px] text-slate-400 px-2 pt-1 text-right font-mono">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Colonne giorni */}
              {giorni.map((d) => {
                const iso = format_iso(d);
                const day_events = per_giorno.get(iso) ?? [];
                const is_today = iso === today_iso;
                return (
                  <div key={iso} className={`relative border-l border-slate-200 ${is_today ? "bg-sky-50/30" : ""}`}>
                    {/* righe ore */}
                    {ore.map((h) => (
                      <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100" />
                    ))}
                    {/* eventi */}
                    {day_events.map((ev) => {
                      const start_min = ora_to_min(ev.ora_inizio) - ORA_START * 60;
                      const end_min = ev.ora_fine ? ora_to_min(ev.ora_fine) - ORA_START * 60 : start_min + 60;
                      const top = Math.max(0, (start_min / 60) * HOUR_H);
                      const height = Math.max(28, ((end_min - start_min) / 60) * HOUR_H - 2);
                      const meta = TIPO_META[ev.tipo] ?? TIPO_META.corso;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => set_selected(ev)}
                          style={{ top, height }}
                          className={`absolute left-1 right-1 ${meta.bg} ${meta.text} rounded-lg px-2 py-1 text-left text-[11px] shadow-sm hover:shadow-md hover:scale-[1.02] transition-all overflow-hidden`}
                        >
                          <p className="font-bold truncate">{ev.nome_evento ?? meta.label}</p>
                          <p className="text-[10px] opacity-90 truncate">
                            {ev.ora_inizio?.slice(0, 5)}{ev.ora_fine ? `–${ev.ora_fine.slice(0, 5)}` : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOBILE: lista accordion-style per giorno */}
          <div className="md:hidden space-y-3">
            {giorni.map((d) => {
              const iso = format_iso(d);
              const day_events = per_giorno.get(iso) ?? [];
              if (day_events.length === 0) return null;
              const is_today = iso === today_iso;
              return (
                <div key={iso} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className={`px-4 py-2.5 border-b border-slate-100 ${is_today ? "bg-sky-50" : "bg-slate-50"}`}>
                    <p className={`text-sm font-bold capitalize ${is_today ? "text-sky-700" : "text-slate-700"}`}>
                      {d.toLocaleDateString("it-CH", { weekday: "long", day: "2-digit", month: "long" })}
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {day_events.map((ev) => {
                      const meta = TIPO_META[ev.tipo] ?? TIPO_META.corso;
                      return (
                        <li key={ev.id}>
                          <button onClick={() => set_selected(ev)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                            <span className={`w-1 self-stretch rounded-full ${meta.bg}`} />
                            <div className="w-14 text-center">
                              <p className="text-sm font-bold text-slate-800 tabular-nums">{ev.ora_inizio?.slice(0, 5)}</p>
                              {ev.ora_fine && <p className="text-[10px] text-slate-400 tabular-nums">{ev.ora_fine.slice(0, 5)}</p>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{ev.nome_evento ?? meta.label}</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.bg} mr-1 align-middle`} />
                                {meta.label}{ev.luogo ? ` · ${ev.luogo}` : ""}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        {Object.entries(TIPO_META).slice(0, 5).map(([k, m]) => (
          <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200">
            <span className={`w-2 h-2 rounded-full ${m.bg}`} />
            {m.label}
          </span>
        ))}
      </div>

      {/* Modal dettaglio */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => set_selected(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className={`h-2 ${(TIPO_META[selected.tipo] ?? TIPO_META.corso).bg}`} />
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    {(TIPO_META[selected.tipo] ?? TIPO_META.corso).label}
                  </p>
                  <h3 className="text-xl font-extrabold text-slate-800 mt-1">{selected.nome_evento ?? (TIPO_META[selected.tipo] ?? TIPO_META.corso).label}</h3>
                </div>
                <button onClick={() => set_selected(null)} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <CalIcon className="w-4 h-4 text-sky-500" />
                  <span className="capitalize">
                    {new Date(selected.data + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Clock className="w-4 h-4 text-violet-500" />
                  <span className="font-semibold">
                    {selected.ora_inizio?.slice(0, 5)}{selected.ora_fine ? ` – ${selected.ora_fine.slice(0, 5)}` : ""}
                  </span>
                </div>
                {selected.luogo && (
                  <div className="flex items-center gap-3 text-slate-700">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    <span>{selected.luogo}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortaleCalendarioPage;
