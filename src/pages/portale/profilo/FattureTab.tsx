import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, CreditCard, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

const STATO_COLORS: Record<string, string> = {
  bozza: "bg-slate-100 text-slate-700 border-slate-200",
  inviata: "bg-blue-100 text-blue-700 border-blue-200",
  pagata: "bg-emerald-100 text-emerald-700 border-emerald-200",
  scaduta: "bg-red-100 text-red-700 border-red-200",
  annullata: "bg-gray-100 text-gray-500 border-gray-200",
};

const FattureTab: React.FC = () => {
  const ctx = useOutletContext<{ session?: PortaleSession }>() as any;
  const session = ctx?.session as PortaleSession | undefined;
  const navigate = useNavigate();
  const { t } = useTranslation("portale");
  const [loading, set_loading] = useState(true);
  const [fatture, set_fatture] = useState<any[]>([]);
  const [filter, set_filter] = useState<"all" | "open" | "paid">("all");

  useEffect(() => {
    (async () => {
      if (!session) return;
      const f = await supabase
        .from("fatture")
        .select("*")
        .eq("atleta_id", session.atleta.id)
        .order("data_emissione", { ascending: false });
      set_fatture(f.data ?? []);
      set_loading(false);
    })();
  }, [session?.atleta.id]);

  const filtered = useMemo(() => {
    if (filter === "open") return fatture.filter((f) => f.stato !== "pagata" && f.stato !== "annullata");
    if (filter === "paid") return fatture.filter((f) => f.stato === "pagata");
    return fatture;
  }, [fatture, filter]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {([["all", t("fatture.filtro_tutte")], ["open", t("fatture.filtro_da_pagare")], ["paid", t("fatture.filtro_pagate")]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => set_filter(k as any)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${filter === k ? "bg-sky-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
          <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t("fatture.nessuna")}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(`/mio-club/profilo/fatture/${f.id}`)}
              className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-slate-400">{f.numero ?? f.id.slice(0, 8)}</p>
                  <Badge variant="outline" className={STATO_COLORS[f.stato] || "bg-muted"}>{f.stato}</Badge>
                </div>
                <p className="font-medium text-slate-800 truncate">{f.descrizione ?? f.periodo ?? "Fattura"}</p>
                <p className="text-xs text-slate-500">{f.data_emissione ? new Date(f.data_emissione + "T00:00:00").toLocaleDateString("it-CH") : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-bold tabular-nums text-slate-800 text-lg">CHF {Number(f.importo ?? 0).toFixed(2)}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FattureTab;
