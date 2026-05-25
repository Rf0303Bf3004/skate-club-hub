import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

const FattureTab: React.FC = () => {
  const ctx = useOutletContext<{ session?: PortaleSession }>() as any;
  const session = ctx?.session as PortaleSession | undefined;
  const { t } = useTranslation("portale");
  const [loading, set_loading] = useState(true);
  const [fatture, set_fatture] = useState<any[]>([]);
  const [filter, set_filter] = useState<"all" | "open" | "paid">("all");
  const [sel, set_sel] = useState<any | null>(null);
  const [setup, set_setup] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const [f, s] = await Promise.all([
        supabase.from("fatture").select("*").eq("atleta_id", session.atleta.id).order("data_emissione", { ascending: false }),
        supabase.from("setup_club").select("iban, banca_nome, banca_intestatario, twint_telefono").eq("club_id", session.atleta.club_id).maybeSingle(),
      ]);
      set_fatture(f.data ?? []);
      set_setup(s.data ?? null);
      set_loading(false);
    })();
  }, [session?.atleta.id]);

  const filtered = useMemo(() => {
    if (filter === "open") return fatture.filter((f) => !f.pagata);
    if (filter === "paid") return fatture.filter((f) => f.pagata);
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
        <div className="space-y-2">
          {filtered.map((f) => (
            <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">{f.numero ?? "Fattura"}</p>
                <p className="font-medium text-slate-800 truncate">{f.descrizione ?? f.tipo ?? "—"}</p>
                <p className="text-xs text-slate-500">{f.data_emissione ? new Date(f.data_emissione + "T00:00:00").toLocaleDateString("it-CH") : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-bold tabular-nums text-slate-800">CHF {Number(f.importo ?? 0).toFixed(2)}</p>
                <Badge variant="outline" className={f.pagata ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                  {f.pagata ? "Pagata" : "Da pagare"}
                </Badge>
              </div>
              {!f.pagata && (
                <Button size="sm" className="bg-sky-500 hover:bg-sky-600" onClick={() => set_sel(f)}>{t("fatture.paga_ora")}</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!sel} onOpenChange={(o) => !o && set_sel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sel?.numero ?? "Pagamento"}</DialogTitle></DialogHeader>
          {sel && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-slate-800">{t("fatture.iban")}</p>
                <p><span className="text-slate-500">IBAN:</span> <code className="font-mono">{setup?.iban ?? "—"}</code></p>
                <p><span className="text-slate-500">Banca:</span> {setup?.banca_nome ?? "—"}</p>
                <p><span className="text-slate-500">Intestatario:</span> {setup?.banca_intestatario ?? "—"}</p>
                <p><span className="text-slate-500">Importo:</span> <strong>CHF {Number(sel.importo ?? 0).toFixed(2)}</strong></p>
                <p><span className="text-slate-500">Causale:</span> {sel.numero ?? sel.id}</p>
              </div>
              {setup?.twint_telefono && (
                <div className="bg-emerald-50 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-emerald-800 mb-1">{t("fatture.twint")}</p>
                  <p>Numero: <code className="font-mono">{setup.twint_telefono}</code></p>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => set_sel(null)}>{t("fatture.chiudi")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FattureTab;
