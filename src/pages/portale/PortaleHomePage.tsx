import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Calendar, Sparkles, CreditCard, Newspaper, ArrowRight, Clock, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PortaleSession } from "@/lib/portale-auth";

interface EventoProssimo {
  id: string;
  tipo: string;
  data: string;
  ora_inizio: string;
  ora_fine: string | null;
  nome_evento: string | null;
  luogo: string | null;
}

const TIPO_META: Record<string, { label: string; gradient: string; icon: typeof Calendar }> = {
  corso: { label: "Corso", gradient: "from-sky-500 to-indigo-500", icon: Calendar },
  lezione_privata: { label: "Lezione privata", gradient: "from-violet-500 to-purple-600", icon: Sparkles },
  gara: { label: "Gara", gradient: "from-orange-500 to-rose-500", icon: Sparkles },
  campo: { label: "Campo", gradient: "from-emerald-500 to-teal-500", icon: Sparkles },
  gala: { label: "Galà", gradient: "from-amber-500 to-orange-500", icon: Sparkles },
};

const PortaleHomePage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const [prossimi, set_prossimi] = useState<EventoProssimo[]>([]);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    (async () => {
      const oggi = new Date().toISOString().slice(0, 10);
      const fra14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("eventi_calendario" as any)
        .select("id, tipo, data, ora_inizio, ora_fine, nome_evento, luogo")
        .eq("atleta_id", session.atleta.id)
        .gte("data", oggi)
        .lte("data", fra14)
        .neq("stato", "annullato")
        .order("data", { ascending: true })
        .order("ora_inizio", { ascending: true })
        .limit(3);
      set_prossimi(((data as any) ?? []) as EventoProssimo[]);
      set_loading(false);
    })();
  }, [session.atleta.id]);

  const oggi = new Date();
  const giorno_sett = oggi.toLocaleDateString("it-CH", { weekday: "long" });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero saluto */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600 text-white p-8 lg:p-10 shadow-xl">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-80 h-80 rounded-full bg-purple-300/20 blur-3xl" />
        <div className="relative">
          <p className="text-sm uppercase tracking-widest opacity-80 mb-3 capitalize">{giorno_sett}</p>
          <h1 className="text-[40px] lg:text-[48px] leading-[1.05] font-extrabold tracking-tight">
            Ciao {session.atleta.nome},<br />ecco la tua settimana
          </h1>
          {session.club?.nome && (
            <p className="text-sm opacity-80 mt-4 font-medium">{session.club.nome}</p>
          )}
        </div>
      </section>

      {/* Prossimi impegni */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Prossimi impegni</h2>
          <Link to="/mio-club/calendario" className="text-sm font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1">
            Vedi calendario <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : prossimi.length === 0 ? (
          <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-sky-50 border border-slate-200 p-10 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-sky-400" />
            <p className="text-slate-700 font-semibold text-lg">Settimana libera</p>
            <p className="text-slate-500 text-sm mt-1">Tempo per riposarsi… o per riprendere il ghiaccio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prossimi.map((ev, idx) => {
              const meta = TIPO_META[ev.tipo] ?? { label: ev.tipo, gradient: "from-slate-500 to-slate-700", icon: Calendar };
              const Icon = meta.icon;
              const big = idx === 0;
              return (
                <Link
                  key={ev.id}
                  to="/mio-club/calendario"
                  className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all ${
                    big ? "md:col-span-2 md:row-span-1" : ""
                  }`}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${meta.gradient}`} />
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.gradient} text-white flex items-center justify-center shadow-sm shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{meta.label}</p>
                      <p className={`font-bold text-slate-800 truncate ${big ? "text-lg" : "text-base"}`}>
                        {ev.nome_evento ?? meta.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 capitalize">
                        {new Date(ev.data + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      {ev.ora_inizio?.slice(0, 5)}
                      {ev.ora_fine ? `–${ev.ora_fine.slice(0, 5)}` : ""}
                    </span>
                    {ev.luogo && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{ev.luogo}</span>
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Shortcut */}
      <section>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Scorciatoie</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { to: "/mio-club/profilo/atleta", icon: Sparkles, label: "Profilo", gradient: "from-violet-500 to-purple-600" },
            { to: "/mio-club/profilo/fatture", icon: CreditCard, label: "Fatture", gradient: "from-emerald-500 to-teal-600" },
            { to: "/mio-club/eventi", icon: Calendar, label: "Eventi", gradient: "from-orange-500 to-rose-500" },
            { to: "/mio-club/notizie", icon: Newspaper, label: "Notizie", gradient: "from-sky-500 to-blue-600" },
          ].map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="group relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tile.gradient} text-white flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform`}>
                <tile.icon className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-800">{tile.label}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PortaleHomePage;
