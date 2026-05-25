import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, IdCard, Trophy, Users, Mail, Phone, Sparkles } from "lucide-react";
import type { PortaleSession } from "@/lib/portale-auth";

interface Ctx {
  session: PortaleSession;
  atleta?: any;
}

const Row: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <div className="flex justify-between items-baseline gap-4 border-b border-slate-100 py-3 last:border-0">
    <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</dt>
    <dd className={`text-sm font-semibold text-slate-800 text-right ${mono ? "font-mono" : ""}`}>{children}</dd>
  </div>
);

const SectionCard: React.FC<{
  icon: React.ElementType;
  title: string;
  gradient: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, gradient, children }) => (
  <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
      </div>
      {children}
    </div>
  </div>
);

const GenitoreCard: React.FC<{
  nome?: string; cognome?: string; email?: string; tel?: string;
  indirizzo?: string; cap?: string; citta?: string; cantone?: string;
  idx: number;
}> = ({ nome, cognome, email, tel, indirizzo, cap, citta, cantone, idx }) => {
  const display = [nome, cognome].filter(Boolean).join(" ") || email || "Genitore";
  const ini = `${nome?.[0] ?? ""}${cognome?.[0] ?? ""}`.toUpperCase() || (email?.[0] ?? "?").toUpperCase();
  const gradient = idx === 0 ? "from-sky-500 to-indigo-500" : "from-violet-500 to-purple-600";
  const addr = [indirizzo, [cap, citta].filter(Boolean).join(" "), cantone].filter(Boolean).join(", ");
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold shadow-sm shrink-0`}>
        {ini}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 truncate">{display}</p>
        <div className="flex flex-col gap-1 mt-1.5">
          {email && (
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{email}</span>
            </a>
          )}
          {tel && (
            <a href={`tel:${tel}`} className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700">
              <Phone className="w-3.5 h-3.5 shrink-0" /> {tel}
            </a>
          )}
          {addr && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{addr}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const AtletaTab: React.FC = () => {
  const ctx = useOutletContext<Ctx>();
  const [atleta, set_atleta] = useState<any | null>(ctx?.atleta ?? null);
  const [loading, set_loading] = useState(!ctx?.atleta);

  useEffect(() => {
    if (ctx?.atleta) {
      set_atleta(ctx.atleta);
      set_loading(false);
      return;
    }
    (async () => {
      const id = ctx?.session?.atleta?.id;
      if (!id) { set_loading(false); return; }
      const { data } = await supabase.from("atleti").select("*").eq("id", id).maybeSingle();
      set_atleta(data);
      set_loading(false);
    })();
  }, [ctx]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-sky-500" /></div>;
  }
  if (!atleta) return <p className="text-slate-500">Nessun dato disponibile.</p>;

  const data_nascita = atleta.data_nascita
    ? new Date(atleta.data_nascita + "T00:00:00").toLocaleDateString("it-CH", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const indirizzo_atleta = [
    atleta.indirizzo,
    [atleta.cap, atleta.citta].filter(Boolean).join(" "),
    atleta.cantone,
  ].filter(Boolean).join(", ") || "—";

  const has_g1 = atleta.genitore1_nome || atleta.genitore1_email || atleta.genitore1_telefono;
  const has_g2 = atleta.genitore2_nome || atleta.genitore2_email || atleta.genitore2_telefono;


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Anagrafica */}
      <SectionCard icon={IdCard} title="Anagrafica" gradient="from-sky-500 to-indigo-500">
        <dl>
          <Row label="Data di nascita">{data_nascita}</Row>
          <Row label="Sesso">{atleta.sesso === "F" ? "Femmina" : atleta.sesso === "M" ? "Maschio" : "—"}</Row>
          <Row label="Codice atleta" mono>{atleta.codice_atleta ?? "—"}</Row>
          <Row label="Categoria"><span className="capitalize">{atleta.categoria ?? "—"}</span></Row>
          <Row label="Indirizzo">{indirizzo_atleta}</Row>
          <Row label="Codice fiscale">{atleta.codice_fiscale || "—"}</Row>
          <Row label="Telefono">
            {atleta.telefono ? (
              <a href={`tel:${atleta.telefono}`} className="text-sky-600 hover:text-sky-700">{atleta.telefono}</a>
            ) : "—"}
          </Row>
        </dl>
      </SectionCard>

      {/* Stato tecnico */}
      <SectionCard icon={Trophy} title="Stato tecnico" gradient="from-violet-500 to-purple-600">
        <div className="space-y-4">
          {atleta.agonista && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm">
              <Sparkles className="w-3 h-3" /> Agonista
            </span>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Livello attuale</p>
            <p className="text-2xl font-extrabold text-slate-800">
              {atleta.livello_amatori || atleta.livello_artistica || atleta.livello_stile || atleta.livello_attuale || "—"}
            </p>
            {(atleta.livello_in_preparazione || atleta.livello_artistica_in_preparazione || atleta.livello_stile_in_preparazione) && (
              <p className="text-sm text-violet-600 font-semibold mt-1">
                In preparazione: {atleta.livello_in_preparazione || atleta.livello_artistica_in_preparazione || atleta.livello_stile_in_preparazione}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {atleta.livello_artistica && (
              <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
                Artistica · {atleta.livello_artistica}
              </span>
            )}
            {atleta.livello_stile && (
              <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                Stile · {atleta.livello_stile}
              </span>
            )}
            {atleta.livello_amatori && (
              <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold">
                Amatori · {atleta.livello_amatori}
              </span>
            )}
            {atleta.carriera_artistica && (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                Carriera artistica: {atleta.carriera_artistica}
              </span>
            )}
            {atleta.carriera_stile && (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                Carriera stile: {atleta.carriera_stile}
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Genitori */}
      <SectionCard icon={Users} title="Genitori" gradient="from-emerald-500 to-teal-600">
        {!has_g1 && !has_g2 ? (
          <p className="text-sm text-slate-500">Nessun genitore registrato.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {has_g1 && (
              <GenitoreCard
                nome={atleta.genitore1_nome}
                cognome={atleta.genitore1_cognome}
                email={atleta.genitore1_email}
                tel={atleta.genitore1_telefono}
                indirizzo={atleta.genitore1_indirizzo}
                cap={atleta.genitore1_cap}
                citta={atleta.genitore1_citta}
                cantone={atleta.genitore1_cantone}
                idx={0}
              />
            )}
            {has_g2 && (
              <GenitoreCard
                nome={atleta.genitore2_nome}
                cognome={atleta.genitore2_cognome}
                email={atleta.genitore2_email}
                tel={atleta.genitore2_telefono}
                indirizzo={atleta.genitore2_indirizzo}
                cap={atleta.genitore2_cap}
                citta={atleta.genitore2_citta}
                cantone={atleta.genitore2_cantone}
                idx={1}
              />
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default AtletaTab;
