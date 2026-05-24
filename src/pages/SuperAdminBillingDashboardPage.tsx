import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Building2, Users, TrendingUp, Wallet, RefreshCw } from "lucide-react";

function periodo_corrente_str(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ClubRow = {
  id: string;
  nome: string;
  citta: string | null;
  prezzo_per_atleta_chf: number;
  fee_fissa_chf: number;
  attivo: boolean;
};
type FatturaClubRow = {
  id: string;
  club_id: string;
  periodo: string;
  importo_chf: number;
  pagata: boolean;
  data_scadenza: string;
  data_pagamento: string | null;
};

const SuperAdminBillingDashboardPage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, set_search] = useState("");
  const periodo = periodo_corrente_str();
  const today = new Date().toISOString().slice(0, 10);

  const { data: clubs = [] } = useQuery({
    queryKey: ["sa_clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, nome, citta, prezzo_per_atleta_chf, fee_fissa_chf, attivo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClubRow[];
    },
  });

  const { data: atleti_counts = {} } = useQuery({
    queryKey: ["sa_atleti_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("club_id")
        .eq("attivo", true);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.club_id] = (map[r.club_id] ?? 0) + 1;
      return map;
    },
  });

  const { data: fatture = [] } = useQuery({
    queryKey: ["sa_fatture_clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatture_clubs" as any)
        .select("id, club_id, periodo, importo_chf, pagata, data_scadenza, data_pagamento")
        .order("periodo", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FatturaClubRow[];
    },
  });

  const fatture_per_club = useMemo(() => {
    const m: Record<string, FatturaClubRow[]> = {};
    for (const f of fatture) (m[f.club_id] ||= []).push(f);
    return m;
  }, [fatture]);

  const kpi = useMemo(() => {
    const club_attivi = clubs.filter((c) => c.attivo).length;
    const atleti_totali = Object.values(atleti_counts).reduce((a, b) => a + b, 0);
    const mese = fatture.filter((f) => f.periodo === periodo);
    const mrr_incassato = mese.filter((f) => f.pagata).reduce((a, f) => a + Number(f.importo_chf), 0);
    // MRR previsto = somma calcolata su fee_fissa + n_atleti * prezzo per ogni club attivo
    const mrr_previsto = clubs.filter((c) => c.attivo).reduce((a, c) => {
      const n = atleti_counts[c.id] ?? 0;
      return a + Number(c.fee_fissa_chf ?? 50) + n * Number(c.prezzo_per_atleta_chf ?? 5);
    }, 0);
    return { club_attivi, atleti_totali, mrr_previsto, mrr_incassato };
  }, [clubs, atleti_counts, fatture, periodo]);

  const genera_mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("fattura-clubs-mensile", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: t("dashboard.azioni.generazione_ok") });
      qc.invalidateQueries({ queryKey: ["sa_fatture_clubs"] });
    },
    onError: (e: any) => toast({ title: t("dashboard.azioni.generazione_err"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const stato_ultima = (cid: string): { label: string; cls: string; data?: string | null } => {
    const lista = fatture_per_club[cid] ?? [];
    if (lista.length === 0) return { label: t("dashboard.stato.nessuna"), cls: "bg-muted text-muted-foreground" };
    const ult = lista[0];
    const pagata_ult = lista.find((f) => f.pagata);
    if (ult.pagata) return { label: t("dashboard.stato.pagata"), cls: "bg-emerald-100 text-emerald-800", data: ult.data_pagamento };
    if (ult.data_scadenza < today) return { label: t("dashboard.stato.scaduta"), cls: "bg-red-100 text-red-800", data: pagata_ult?.data_pagamento };
    return { label: t("dashboard.stato.da_pagare"), cls: "bg-amber-100 text-amber-800", data: pagata_ult?.data_pagamento };
  };

  const filtrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter((c) => !q || c.nome.toLowerCase().includes(q));
  }, [clubs, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Button onClick={() => genera_mut.mutate()} disabled={genera_mut.isPending}>
          <RefreshCw className={`w-4 h-4 mr-2 ${genera_mut.isPending ? "animate-spin" : ""}`} />
          {t("dashboard.azioni.genera_ora")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: t("dashboard.kpi.club_attivi"), value: kpi.club_attivi },
          { icon: Users, label: t("dashboard.kpi.atleti_totali"), value: kpi.atleti_totali },
          { icon: TrendingUp, label: t("dashboard.kpi.mrr_previsto"), value: `CHF ${kpi.mrr_previsto.toFixed(2)}` },
          { icon: Wallet, label: t("dashboard.kpi.mrr_incassato"), value: `CHF ${kpi.mrr_incassato.toFixed(2)}` },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <k.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>{t("dashboard.lista_club")}</CardTitle>
            <Input value={search} onChange={(e) => set_search(e.target.value)} placeholder={t("dashboard.cerca")} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-3">{t("dashboard.col.nome")}</th>
                  <th className="py-2 px-3 text-right">{t("dashboard.col.atleti")}</th>
                  <th className="py-2 px-3 text-right">{t("dashboard.col.canone_base")}</th>
                  <th className="py-2 px-3 text-right">{t("dashboard.col.prezzo")}</th>
                  <th className="py-2 px-3 text-right">{t("dashboard.col.importo")}</th>
                  <th className="py-2 px-3">{t("dashboard.col.stato")}</th>
                  <th className="py-2 px-3">{t("dashboard.col.ultima_pagata")}</th>
                </tr>
              </thead>
              <tbody>
                {filtrati.map((c) => {
                  const n = atleti_counts[c.id] ?? 0;
                  const prezzo = Number(c.prezzo_per_atleta_chf ?? 5);
                  const fee = Number(c.fee_fissa_chf ?? 50);
                  const importo = fee + n * prezzo;
                  const st = stato_ultima(c.id);
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/40 cursor-pointer"
                      onClick={() => navigate(`/superadmin/clubs/${c.id}`)}>
                      <td className="py-2 px-3">
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-xs text-muted-foreground">{c.citta || "—"}</div>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{n}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fee.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{prezzo.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">CHF {importo.toFixed(2)}</td>
                      <td className="py-2 px-3"><Badge className={st.cls}>{st.label}</Badge></td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{st.data ?? "—"}</td>
                    </tr>
                  );
                })}
                {filtrati.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">—</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminBillingDashboardPage;
