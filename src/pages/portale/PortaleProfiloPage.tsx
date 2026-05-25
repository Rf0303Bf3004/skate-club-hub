import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { User, GraduationCap, CreditCard, Sparkles, Ribbon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PortaleSession } from "@/lib/portale-auth";

function calcola_eta(data_nascita: string | null): number | null {
  if (!data_nascita) return null;
  const d = new Date(data_nascita + "T00:00:00");
  const oggi = new Date();
  let eta = oggi.getFullYear() - d.getFullYear();
  const m = oggi.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && oggi.getDate() < d.getDate())) eta--;
  return eta;
}

function primo_livello(a: any): string | null {
  return a?.livello_amatori || a?.livello_artistica || a?.livello_stile || a?.livello_attuale || null;
}

const PortaleProfiloPage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const location = useLocation();
  const at_root = location.pathname === "/mio-club/profilo" || location.pathname === "/mio-club/profilo/";
  const [atleta, set_atleta] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("atleti").select("*").eq("id", session.atleta.id).maybeSingle();
      set_atleta(data);
    })();
  }, [session.atleta.id]);

  const subnav = [
    { to: "/mio-club/profilo/atleta", icon: User, label: "Atleta" },
    { to: "/mio-club/profilo/corsi", icon: GraduationCap, label: "Corsi" },
    { to: "/mio-club/profilo/fatture", icon: CreditCard, label: "Fatture" },
    { to: "/mio-club/profilo/convenzioni", icon: Sparkles, label: "Convenzioni" },
  ];

  const iniziali = `${session.atleta.nome?.[0] ?? ""}${session.atleta.cognome?.[0] ?? ""}`.toUpperCase();
  const eta = calcola_eta(atleta?.data_nascita ?? null);
  const livello = primo_livello(atleta);
  const foto_url = atleta?.foto_url as string | undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* HERO ATLETA */}
      <section className="relative overflow-hidden rounded-3xl shadow-xl">
        {/* Background sfumato */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600" />
        {foto_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-md scale-110"
            style={{ backgroundImage: `url(${foto_url})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="relative px-6 py-10 lg:py-12 flex flex-col items-center text-center text-white">
          {/* Foto profile */}
          <div className="w-32 h-32 lg:w-36 lg:h-36 rounded-full ring-4 ring-white/90 shadow-2xl overflow-hidden bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center mb-5">
            {foto_url ? (
              <img src={foto_url} alt={`${session.atleta.nome} ${session.atleta.cognome}`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-extrabold text-white">{iniziali || "?"}</span>
            )}
          </div>

          <h1 className="text-[40px] lg:text-[44px] leading-none font-extrabold tracking-tight">
            {session.atleta.nome} {session.atleta.cognome}
          </h1>

          {/* Badge livello */}
          {livello && (
            <span className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/95 text-violet-700 text-sm font-bold shadow-md">
              <Ribbon className="w-4 h-4" /> {livello}
            </span>
          )}

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {atleta?.agonista && (
              <span className="px-3 py-1 rounded-full bg-orange-500 text-white text-[11px] font-bold uppercase tracking-wider shadow">
                Agonista
              </span>
            )}
            {atleta?.categoria && (
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-semibold capitalize">
                {atleta.categoria}
              </span>
            )}
            {eta !== null && (
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-semibold">
                {eta} anni
              </span>
            )}
          </div>
        </div>
      </section>

      {/* SUBNAV */}
      <nav className="flex flex-wrap gap-2">
        {subnav.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:-translate-y-0.5 ${
                isActive
                  ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white border-transparent shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:shadow"
              }`
            }
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </NavLink>
        ))}
      </nav>

      {/* CONTENT */}
      <div>
        {at_root ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subnav.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                className="group relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center shadow-sm">
                  <s.icon className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-700 text-lg">{s.label}</span>
              </NavLink>
            ))}
          </div>
        ) : (
          <Outlet context={{ session, atleta }} />
        )}
      </div>
    </div>
  );
};

export default PortaleProfiloPage;
