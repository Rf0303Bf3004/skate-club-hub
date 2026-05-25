import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Calendar as CalIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

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

const TIPO_LABEL: Record<string, string> = {
  corso: "Corso",
  lezione_privata: "Lezione privata",
  gara: "Gara",
  campo: "Campo",
  gala: "Galà",
  pacchetto_pre: "Pre-evento",
  pacchetto_post: "Post-evento",
  evento_straordinario: "Evento",
};

const PortaleCalendarioPage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const { t } = useTranslation("portale");
  const [eventi, set_eventi] = useState<Evento[]>([]);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    (async () => {
      const oggi = new Date().toISOString().slice(0, 10);
      const fine = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const { data } = await supabase
        .from("eventi_calendario" as any)
        .select("id, tipo, data, ora_inizio, ora_fine, nome_evento, luogo, stato")
        .eq("atleta_id", session.atleta.id)
        .gte("data", oggi)
        .lte("data", fine)
        .neq("stato", "annullato")
        .order("data", { ascending: true })
        .order("ora_inizio", { ascending: true });

      set_eventi(((data as any) ?? []) as Evento[]);
      set_loading(false);
    })();
  }, [session.atleta.id]);

  const groups = eventi.reduce<Record<string, Evento[]>>((acc, s) => {
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
              {items.map((it) => (
                <li key={it.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-12 text-center text-sm font-bold text-sky-600 tabular-nums">
                    {it.ora_inizio?.slice(0, 5) ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {it.nome_evento ?? TIPO_LABEL[it.tipo] ?? it.tipo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {TIPO_LABEL[it.tipo] ?? it.tipo}
                      {it.ora_fine ? ` · ${it.ora_inizio?.slice(0,5)}–${it.ora_fine.slice(0,5)}` : ""}
                      {it.luogo ? ` · ${it.luogo}` : ""}
                    </p>
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
