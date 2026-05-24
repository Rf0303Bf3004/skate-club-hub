import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type FatturaClubRow = {
  id: string; club_id: string; periodo: string; importo_chf: number;
  pagata: boolean; data_scadenza: string; data_pagamento: string | null;
  n_atleti: number; prezzo_per_atleta_chf: number;
};
type ClubRow = { id: string; nome: string; prezzo_per_atleta_chf: number };

const SuperAdminTabelloneFatturePage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [anno, set_anno] = useState<number>(new Date().getFullYear());
  const [solo_non_pagati, set_solo_np] = useState(false);
  const [search, set_search] = useState("");
  const [selected, set_selected] = useState<FatturaClubRow | null>(null);
  const mesi = t("tabellone.mesi_short", { returnObjects: true }) as string[];

  const { data: clubs = [] } = useQuery({
    queryKey: ["sa_clubs_tab"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("id, nome, prezzo_per_atleta_chf").order("nome");
      if (error) throw error;
      return (data ?? []) as ClubRow[];
    },
  });

  const { data: fatture = [] } = useQuery({
    queryKey: ["sa_fatture_clubs_anno", anno],
    queryFn: async () => {
      const { data, error } = await supabase.from("fatture_clubs" as any)
        .select("id, club_id, periodo, importo_chf, pagata, data_scadenza, data_pagamento, n_atleti, prezzo_per_atleta_chf")
        .gte("periodo", `${anno}-01`).lte("periodo", `${anno}-12`);
      if (error) throw error;
      return (data ?? []) as unknown as FatturaClubRow[];
    },
  });

  const grid = useMemo(() => {
    const m: Record<string, (FatturaClubRow | null)[]> = {};
    for (const c of clubs) m[c.id] = Array(12).fill(null);
    for (const f of fatture) {
      const mese = parseInt(f.periodo.slice(5, 7), 10) - 1;
      if (m[f.club_id]) m[f.club_id][mese] = f;
    }
    return m;
  }, [clubs, fatture]);

  const filtrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q)) return false;
      if (solo_non_pagati) {
        const row = grid[c.id] ?? [];
        if (!row.some((f) => f && !f.pagata)) return false;
      }
      return true;
    });
  }, [clubs, search, solo_non_pagati, grid]);

  const cell_classes = (f: FatturaClubRow | null) => {
    if (!f) return "bg-muted text-muted-foreground";
    if (f.pagata) return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
    if (f.data_scadenza < today) return "bg-red-100 text-red-800 hover:bg-red-200";
    return "bg-amber-100 text-amber-800 hover:bg-amber-200";
  };

  const toggle_pagata = useMutation({
    mutationFn: async (f: FatturaClubRow) => {
      const { error } = await supabase.from("fatture_clubs" as any)
        .update({ pagata: !f.pagata, data_pagamento: !f.pagata ? today : null })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "OK" });
      qc.invalidateQueries({ queryKey: ["sa_fatture_clubs_anno", anno] });
      qc.invalidateQueries({ queryKey: ["sa_fatture_clubs"] });
      set_selected(null);
    },
    onError: (e: any) => toast({ title: "Errore", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const export_csv = () => {
    const rows: string[] = ["Club;" + mesi.join(";") + ";Totale"];
    for (const c of filtrati) {
      const r = grid[c.id] ?? [];
      const cells = r.map((f) => f ? Number(f.importo_chf).toFixed(2) : "");
      const tot = r.reduce((a, f) => a + (f ? Number(f.importo_chf) : 0), 0);
      rows.push([c.nome, ...cells, tot.toFixed(2)].join(";"));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `tabellone_clubs_${anno}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("tabellone.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tabellone.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label>{t("tabellone.anno")}</Label>
              <Input type="number" className="w-24" value={anno} onChange={(e) => set_anno(parseInt(e.target.value, 10) || anno)} />
            </div>
            <Input value={search} onChange={(e) => set_search(e.target.value)} placeholder="Cerca club…" className="max-w-xs" />
            <div className="flex items-center gap-2">
              <Switch checked={solo_non_pagati} onCheckedChange={set_solo_np} id="np" />
              <Label htmlFor="np">{t("tabellone.solo_non_pagati")}</Label>
            </div>
            <div className="ml-auto">
              <Button variant="outline" onClick={export_csv}>{t("tabellone.esporta_csv")}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background border-b border-r px-3 py-2 text-left min-w-[220px]">{t("dashboard.col.nome")}</th>
                  {mesi.map((m) => <th key={m} className="border-b px-2 py-2 w-20 text-center">{m}</th>)}
                  <th className="border-b px-3 py-2 text-right">{t("tabellone.totale")}</th>
                </tr>
              </thead>
              <tbody>
                {filtrati.map((c) => {
                  const row = grid[c.id] ?? [];
                  const tot = row.reduce((a, f) => a + (f ? Number(f.importo_chf) : 0), 0);
                  return (
                    <tr key={c.id} className="border-b">
                      <td className="sticky left-0 z-10 bg-background border-r px-3 py-2 font-medium">{c.nome}</td>
                      {row.map((f, i) => (
                        <td key={i} className="px-1 py-1 text-center">
                          <button
                            className={`w-full h-9 rounded text-xs font-medium transition ${cell_classes(f)}`}
                            onClick={() => f && set_selected(f)}
                            disabled={!f}
                          >
                            {f ? Number(f.importo_chf).toFixed(0) : "—"}
                          </button>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">CHF {tot.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && set_selected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fattura {selected?.periodo}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div>Atleti: <b>{selected.n_atleti}</b> × CHF {Number(selected.prezzo_per_atleta_chf).toFixed(2)}</div>
              <div>Importo: <b>CHF {Number(selected.importo_chf).toFixed(2)}</b></div>
              <div>Scadenza: {selected.data_scadenza}</div>
              <div>Stato: {selected.pagata ? `Pagata il ${selected.data_pagamento}` : "Da pagare"}</div>
            </div>
          )}
          <DialogFooter>
            {selected && (
              <Button onClick={() => toggle_pagata.mutate(selected)} disabled={toggle_pagata.isPending}>
                {selected.pagata ? t("club_detail.annulla_pagamento") : t("club_detail.marca_pagata")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminTabelloneFatturePage;
