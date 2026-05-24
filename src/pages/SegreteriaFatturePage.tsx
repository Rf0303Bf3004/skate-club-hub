import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { get_fattura_stato_ui, get_fattura_stato_label } from "@/lib/fattura-status";
import { use_segna_fattura_pagata, use_invia_email_fattura } from "@/hooks/use-supabase-mutations";

type FatturaRow = {
  id: string;
  numero: string | null;
  descrizione: string | null;
  importo: number | null;
  data_emissione: string | null;
  data_scadenza: string | null;
  data_pagamento: string | null;
  pagata: boolean | null;
  stato: string | null;
  atleta_id: string | null;
};

type AtletaRow = {
  id: string;
  nome: string;
  cognome: string;
  categoria: string | null;
};

type CellaMese = {
  fatture: FatturaRow[];
  totale: number;
  pagato: number;
  scaduto: number;
  da_pagare: number;
};

const FORMATTER_CHF = new Intl.NumberFormat("it-CH", {
  style: "currency",
  currency: "CHF",
  maximumFractionDigits: 0,
});

function fmt(v: number): string {
  return FORMATTER_CHF.format(v || 0);
}

const SegreteriaFatturePage: React.FC = () => {
  const { t } = useTranslation("segreteria");
  const navigate = useNavigate();
  const club_id = get_current_club_id();

  const oggi = new Date();
  const [anno, set_anno] = useState<number>(oggi.getFullYear());
  const [filtro_categoria, set_filtro_categoria] = useState<string>("__all__");
  const [solo_non_pagati, set_solo_non_pagati] = useState<boolean>(false);
  const [ricerca, set_ricerca] = useState<string>("");
  const [modal_cella, set_modal_cella] = useState<{ atleta: AtletaRow; mese: number; cella: CellaMese } | null>(null);

  const mesi_short = (t("tabellone.mesi_short", { returnObjects: true }) as string[]) ?? [];
  const segna_pagata = use_segna_fattura_pagata();
  const invia_email = use_invia_email_fattura();

  const { data, isLoading } = useQuery({
    queryKey: ["segreteria_tabellone_fatture", club_id, anno],
    enabled: !!club_id,
    queryFn: async () => {
      const anno_inizio = `${anno}-01-01`;
      const anno_dopo = `${anno + 1}-01-01`;

      const [atletiRes, fattureRes] = await Promise.all([
        supabase
          .from("atleti")
          .select("id, nome, cognome, categoria")
          .eq("club_id", club_id)
          .eq("attivo", true)
          .order("cognome")
          .order("nome"),
        supabase
          .from("fatture")
          .select("id, numero, descrizione, importo, data_emissione, data_scadenza, data_pagamento, pagata, stato, atleta_id")
          .eq("club_id", club_id)
          .gte("data_emissione", anno_inizio)
          .lt("data_emissione", anno_dopo),
      ]);

      if (atletiRes.error) throw atletiRes.error;
      if (fattureRes.error) throw fattureRes.error;

      return {
        atleti: (atletiRes.data ?? []) as AtletaRow[],
        fatture: (fattureRes.data ?? []) as FatturaRow[],
      };
    },
  });

  const atleti = data?.atleti ?? [];
  const fatture = data?.fatture ?? [];

  const today_iso = oggi.toISOString().split("T")[0];

  // Indice: atleta_id -> mese (0-11) -> CellaMese
  const grid = useMemo(() => {
    const map = new Map<string, Map<number, CellaMese>>();
    for (const f of fatture) {
      if (!f.atleta_id || !f.data_emissione) continue;
      const m = Number(f.data_emissione.substring(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      let per_atleta = map.get(f.atleta_id);
      if (!per_atleta) {
        per_atleta = new Map();
        map.set(f.atleta_id, per_atleta);
      }
      let cella = per_atleta.get(m);
      if (!cella) {
        cella = { fatture: [], totale: 0, pagato: 0, scaduto: 0, da_pagare: 0 };
        per_atleta.set(m, cella);
      }
      cella.fatture.push(f);
      const imp = Number(f.importo || 0);
      cella.totale += imp;
      const stato = get_fattura_stato_ui(f, today_iso);
      if (stato === "pagata") cella.pagato += imp;
      else if (stato === "scaduta") cella.scaduto += imp;
      else cella.da_pagare += imp;
    }
    return map;
  }, [fatture, today_iso]);

  const categorie_disponibili = useMemo(() => {
    const s = new Set<string>();
    for (const a of atleti) if (a.categoria) s.add(a.categoria);
    return Array.from(s).sort();
  }, [atleti]);

  const atleti_filtrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return atleti.filter((a) => {
      if (filtro_categoria !== "__all__" && (a.categoria ?? "") !== filtro_categoria) return false;
      if (q) {
        const full = `${a.cognome} ${a.nome}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      if (solo_non_pagati) {
        const per_atleta = grid.get(a.id);
        if (!per_atleta) return false;
        let ha_non_pagato = false;
        for (const cella of per_atleta.values()) {
          if (cella.scaduto > 0 || cella.da_pagare > 0) {
            ha_non_pagato = true;
            break;
          }
        }
        if (!ha_non_pagato) return false;
      }
      return true;
    });
  }, [atleti, filtro_categoria, ricerca, solo_non_pagati, grid]);

  const totali_per_atleta = useMemo(() => {
    const m = new Map<string, { fatturato: number; pagato: number; residuo: number }>();
    for (const a of atleti) {
      const per_atleta = grid.get(a.id);
      let fatturato = 0;
      let pagato = 0;
      if (per_atleta) {
        for (const cella of per_atleta.values()) {
          fatturato += cella.totale;
          pagato += cella.pagato;
        }
      }
      m.set(a.id, { fatturato, pagato, residuo: fatturato - pagato });
    }
    return m;
  }, [atleti, grid]);

  const totali_mese = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => ({ fatturato: 0, pagato: 0 }));
    for (const a of atleti_filtrati) {
      const per_atleta = grid.get(a.id);
      if (!per_atleta) continue;
      for (let m = 0; m < 12; m++) {
        const c = per_atleta.get(m);
        if (!c) continue;
        arr[m].fatturato += c.totale;
        arr[m].pagato += c.pagato;
      }
    }
    return arr;
  }, [atleti_filtrati, grid]);

  const totali_generali = useMemo(() => {
    let fatturato = 0;
    let pagato = 0;
    for (const a of atleti_filtrati) {
      const t = totali_per_atleta.get(a.id);
      if (!t) continue;
      fatturato += t.fatturato;
      pagato += t.pagato;
    }
    return { fatturato, pagato, residuo: fatturato - pagato };
  }, [atleti_filtrati, totali_per_atleta]);

  function cella_classes(c: CellaMese | undefined): string {
    if (!c || c.fatture.length === 0) return "bg-muted/30 text-muted-foreground";
    if (c.scaduto > 0) return "bg-red-100 text-red-800 hover:bg-red-200";
    if (c.da_pagare > 0) return "bg-amber-100 text-amber-800 hover:bg-amber-200";
    return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
  }

  function export_csv() {
    const headers = [
      "atleta",
      "categoria",
      ...mesi_short.map((m) => `${m}_pagato`),
      ...mesi_short.map((m) => `${m}_da_pagare`),
      "totale_fatturato",
      "totale_pagato",
      "residuo",
    ];
    const rows: string[] = [headers.join(",")];
    for (const a of atleti_filtrati) {
      const per_atleta = grid.get(a.id);
      const cells: (string | number)[] = [
        `"${a.cognome} ${a.nome}"`,
        a.categoria ?? "",
      ];
      for (let m = 0; m < 12; m++) {
        const c = per_atleta?.get(m);
        cells.push((c?.pagato ?? 0).toFixed(2));
      }
      for (let m = 0; m < 12; m++) {
        const c = per_atleta?.get(m);
        cells.push(((c?.scaduto ?? 0) + (c?.da_pagare ?? 0)).toFixed(2));
      }
      const tot = totali_per_atleta.get(a.id) ?? { fatturato: 0, pagato: 0, residuo: 0 };
      cells.push(tot.fatturato.toFixed(2), tot.pagato.toFixed(2), tot.residuo.toFixed(2));
      rows.push(cells.join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabellone-fatture-${anno}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const anni = useMemo(() => {
    const curr = oggi.getFullYear();
    return [curr - 2, curr - 1, curr, curr + 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("tabellone.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tabellone.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(anno)} onValueChange={(v) => set_anno(Number(v))}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anni.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtro_categoria} onValueChange={set_filtro_categoria}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder={t("tabellone.categoria") as string} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("tabellone.categoria_tutte")}</SelectItem>
              {categorie_disponibili.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm text-foreground select-none">
            <input
              type="checkbox"
              checked={solo_non_pagati}
              onChange={(e) => set_solo_non_pagati(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {t("tabellone.solo_non_pagati")}
          </label>

          <Input
            placeholder={t("tabellone.ricerca_placeholder") as string}
            value={ricerca}
            onChange={(e) => set_ricerca(e.target.value)}
            className="w-64 h-9"
          />

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={export_csv} className="gap-2">
              <Download className="w-4 h-4" />
              {t("tabellone.esporta_csv")}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-auto bg-card">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">…</div>
        ) : atleti_filtrati.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">{t("tabellone.nessun_atleta")}</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-muted/60 border-r border-border px-3 py-2 text-left font-semibold text-foreground min-w-[220px]">
                  {t("tabellone.atleta")}
                </th>
                {mesi_short.map((m, i) => (
                  <th key={i} className="px-2 py-2 text-center font-semibold text-foreground min-w-[90px]">{m}</th>
                ))}
                <th className="sticky right-0 z-20 bg-muted/60 border-l border-border px-3 py-2 text-right font-semibold text-foreground min-w-[260px]">
                  <div className="flex gap-3 justify-end">
                    <span>{t("tabellone.totale_fatturato")}</span>
                    <span>{t("tabellone.totale_pagato")}</span>
                    <span>{t("tabellone.residuo")}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {atleti_filtrati.map((a) => {
                const per_atleta = grid.get(a.id);
                const tot = totali_per_atleta.get(a.id) ?? { fatturato: 0, pagato: 0, residuo: 0 };
                return (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card border-r border-border px-3 py-2">
                      <div className="font-medium text-foreground">{a.cognome} {a.nome}</div>
                      {a.categoria && (
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.categoria}</div>
                      )}
                    </td>
                    {mesi_short.map((_, m) => {
                      const c = per_atleta?.get(m);
                      const has = !!c && c.fatture.length > 0;
                      return (
                        <td key={m} className="p-1 align-middle">
                          <button
                            type="button"
                            disabled={!has}
                            onClick={() => has && set_modal_cella({ atleta: a, mese: m, cella: c! })}
                            className={`relative w-full h-12 rounded-md text-xs font-medium px-2 transition-colors ${cella_classes(c)} ${has ? "cursor-pointer" : "cursor-default"}`}
                          >
                            {has ? fmt(c!.totale) : "—"}
                            {has && c!.fatture.length > 1 && (
                              <span className="absolute top-0.5 right-1 text-[9px] font-bold opacity-80">+{c!.fatture.length - 1}</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 bg-card border-l border-border px-3 py-2 text-right tabular-nums">
                      <div className="flex gap-3 justify-end">
                        <span className="font-medium text-foreground min-w-[70px]">{fmt(tot.fatturato)}</span>
                        <span className="text-emerald-700 min-w-[70px]">{fmt(tot.pagato)}</span>
                        <span className={`min-w-[70px] font-semibold ${tot.residuo > 0 ? "text-red-700" : "text-muted-foreground"}`}>{fmt(tot.residuo)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40 sticky bottom-0">
              <tr className="border-t-2 border-border">
                <td className="sticky left-0 bg-muted/60 border-r border-border px-3 py-2 font-bold text-foreground">
                  {t("tabellone.riga_totali")}
                </td>
                {totali_mese.map((tm, m) => {
                  const perc = tm.fatturato > 0 ? Math.round((tm.pagato / tm.fatturato) * 100) : 0;
                  return (
                    <td key={m} className="px-2 py-2 text-center text-[11px]">
                      <div className="font-semibold text-foreground tabular-nums">{fmt(tm.fatturato)}</div>
                      <div className="text-emerald-700 tabular-nums">{fmt(tm.pagato)}</div>
                      <div className="text-muted-foreground">{perc}%</div>
                    </td>
                  );
                })}
                <td className="sticky right-0 bg-muted/60 border-l border-border px-3 py-2 text-right">
                  <div className="flex gap-3 justify-end tabular-nums">
                    <span className="font-bold text-foreground min-w-[70px]">{fmt(totali_generali.fatturato)}</span>
                    <span className="font-bold text-emerald-700 min-w-[70px]">{fmt(totali_generali.pagato)}</span>
                    <span className={`min-w-[70px] font-bold ${totali_generali.residuo > 0 ? "text-red-700" : "text-muted-foreground"}`}>{fmt(totali_generali.residuo)}</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <Dialog open={!!modal_cella} onOpenChange={(o) => !o && set_modal_cella(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {modal_cella ? `${modal_cella.atleta.cognome} ${modal_cella.atleta.nome} — ${mesi_short[modal_cella.mese]} ${anno}` : ""}
            </DialogTitle>
          </DialogHeader>
          {modal_cella && (
            <div className="space-y-3">
              {modal_cella.cella.fatture.map((f) => {
                const stato = get_fattura_stato_ui(f, today_iso);
                const stato_cls =
                  stato === "pagata" ? "bg-emerald-100 text-emerald-800" :
                  stato === "scaduta" ? "bg-red-100 text-red-800" :
                  "bg-amber-100 text-amber-800";
                return (
                  <div key={f.id} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {f.numero || f.id.slice(0, 8)} — {fmt(Number(f.importo || 0))}
                        </div>
                        <div className="text-xs text-muted-foreground">{f.descrizione || ""}</div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {t("tabellone.modal.scadenza")}: {f.data_scadenza || "—"}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${stato_cls}`}>
                        {get_fattura_stato_label(stato)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stato !== "pagata" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await segna_pagata.mutateAsync(f.id);
                              toast({ title: t("tabellone.modal.marca_pagata") as string });
                              set_modal_cella(null);
                            } catch (e: any) {
                              toast({ title: "Errore", description: e?.message, variant: "destructive" });
                            }
                          }}
                        >
                          {t("tabellone.modal.marca_pagata")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await invia_email.mutateAsync({ fattura_id: f.id, email: "" });
                            toast({ title: t("tabellone.modal.invia_reminder") as string });
                          } catch (e: any) {
                            toast({ title: "Errore", description: e?.message, variant: "destructive" });
                          }
                        }}
                      >
                        {t("tabellone.modal.invia_reminder")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          set_modal_cella(null);
                          navigate("/fatture");
                        }}
                      >
                        {t("tabellone.modal.apri_fattura")}
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => set_modal_cella(null)}>
                  <X className="w-4 h-4 mr-1" /> {t("tabellone.modal.chiudi")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SegreteriaFatturePage;
