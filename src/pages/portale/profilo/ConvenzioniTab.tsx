import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles } from "lucide-react";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

const ConvenzioniTab: React.FC = () => {
  const ctx = useOutletContext<{ session?: PortaleSession }>() as any;
  const session = ctx?.session as PortaleSession | undefined;
  const { t } = useTranslation("portale");
  const [loading, set_loading] = useState(true);
  const [items, set_items] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await supabase
        .from("sponsor")
        .select("*")
        .eq("club_id", session.atleta.club_id)
        .order("nome");
      set_items(data ?? []);
      set_loading(false);
    })();
  }, [session?.atleta.club_id]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
          <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t("convenzioni.nessuna")}
        </div>
      ) : items.map((s) => (
        <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
          {s.logo_url ? (
            <img src={s.logo_url} alt={s.nome} className="w-14 h-14 object-contain rounded-lg bg-slate-50" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              {s.nome?.[0] ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800">{s.nome}</p>
            {s.descrizione && <p className="text-sm text-slate-600 mt-1">{s.descrizione}</p>}
            {s.sito_web && <a href={s.sito_web} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline mt-1 inline-block">Sito web</a>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConvenzioniTab;
