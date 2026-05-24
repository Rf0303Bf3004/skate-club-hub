import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Calendar as CalIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

interface Slot {
  data: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  titolo: string;
  tipo: string;
}

const PortaleCalendarioPage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const { t } = useTranslation("portale");
  const [slots, set_slots] = useState<Slot[]>([]);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    (async () => {
      const oggi = new Date().toISOString().slice(0, 10);
      const fine = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const out: Slot[] = [];

      // Iscrizioni corsi → planning settimana
      const { data: iscr } = await supabase
        .from("iscrizioni_corsi")
        .select("corso_id")
        .eq("atleta_id", session.atleta.id)
        .eq("attiva", true);
      const corsi_ids = (iscr ?? []).map((x: any) => x.corso_id);

      if (corsi_ids.length > 0) {
        const { data: pcs } = await supabase
          .from("planning_corsi_settimana")
          .select("data, ora_inizio, ora_fine, corso_id, corsi(nome)")
          .in("corso_id", corsi_ids)
          .gte("data", oggi)
          .lte("data", fine)
          .eq("annullato", false);
        for (const p of (pcs ?? []) as any[]) {
          out.push({
            data: p.data,
            ora_inizio: p.ora_inizio,
            ora_fine: p.ora_fine,
            titolo: p.corsi?.nome ?? "Corso",
            tipo: "Corso",
          });
        }
      }

      // Lezioni private
      const { data: lp_link } = await supabase
        .from("lezioni_private_atlete")
        .select("lezione_id, lezioni_private(*)")
        .eq("atleta_id", session.atleta.id);
      for (const r of (lp_link ?? []) as any[]) {
        const l = r.lezioni_private;
        if (l && !l.annullata && l.data >= oggi && l.data <= fine) {
          out.push({
            data: l.data,
            ora_inizio: l.ora_inizio,
            ora_fine: l.ora_fine,
            titolo: "Lezione privata",
            tipo: "Privata",
          });
        }
      }

      out.sort((a, b) => (a.data + (a.ora_inizio ?? "")).localeCompare(b.data + (b.ora_inizio ?? "")));
      set_slots(out);
      set_loading(false);
    })();
  }, [session.atleta.id]);

  // Raggruppa per giorno
  const groups = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.data] = acc[s.data] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t("calendario.titolo")}</h1>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
      ) : Object.keys(groups).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
          <CalIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t("calendario.nessun_impegno")}
        </div>
      ) : (
        Object.entries(groups).map(([data, items]) => (
          <div key={data} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <p className="text-sm font-semibold text-slate-700">
                {new Date(data + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((it, i) => (
                <li key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-12 text-center text-sm font-bold text-sky-600 tabular-nums">
                    {it.ora_inizio?.slice(0, 5) ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{it.titolo}</p>
                    <p className="text-xs text-slate-500">{it.tipo}{it.ora_fine ? ` · ${it.ora_inizio?.slice(0,5)}–${it.ora_fine.slice(0,5)}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
};

export default PortaleCalendarioPage;
