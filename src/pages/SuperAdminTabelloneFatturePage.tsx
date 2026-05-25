import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { FatturaClubDocument, type FatturaClubData, type FatturaRiga } from "@/lib/fattura-club-pdf";

type FatturaClubRow = {
  id: string; club_id: string; periodo: string; importo_chf: number;
  pagata: boolean; data_scadenza: string; data_pagamento: string | null;
  n_atleti: number; prezzo_per_atleta_chf: number; fee_fissa_chf: number;
  importo_atleti_chf?: number; importo_setup_chf?: number;
  stato?: string; note?: string | null; righe_custom?: any;
};
type ClubRow = {
  id: string; nome: string; prezzo_per_atleta_chf: number;
  indirizzo?: string; cap?: string; citta?: string; cantone?: string; paese?: string;
  partita_iva?: string; numero_iva_chf?: string;
};

const SuperAdminTabelloneFatturePage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [anno, set_anno] = useState<number>(new Date().getFullYear());
  const [solo_non_pagati, set_solo_np] = useState(false);
  const [search, set_search] = useState("");
  const [open_bulk, set_open_bulk] = useState(false);
  const [bulk_progress, set_bulk_progress] = useState(0);
  const [bulk_total, set_bulk_total] = useState(0);
  const [bulk_done, set_bulk_done] = useState<{ ok: number; err: number }>({ ok: 0, err: 0 });
  const [bulk_running, set_bulk_running] = useState(false);
  const mesi = t("tabellone.mesi_short", { returnObjects: true }) as string[];

  const { data: clubs = [] } = useQuery({
    queryKey: ["sa_clubs_tab"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs")
        .select("id, nome, prezzo_per_atleta_chf, indirizzo, cap, citta, cantone, paese, partita_iva, numero_iva_chf")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClubRow[];
    },
  });

  const { data: fatture = [] } = useQuery({
    queryKey: ["sa_fatture_clubs_anno", anno],
    queryFn: async () => {
      const { data, error } = await supabase.from("fatture_clubs" as any)
        .select("id, club_id, periodo, importo_chf, pagata, data_scadenza, data_pagamento, n_atleti, prezzo_per_atleta_chf, fee_fissa_chf, importo_atleti_chf, importo_setup_chf, stato, note, righe_custom")
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
        if (!row.some((f) => f && f.stato !== "pagata" && !f.pagata)) return false;
      }
      return true;
    });
  }, [clubs, search, solo_non_pagati, grid]);

  const stato_of = (f: FatturaClubRow): string =>
    f.stato ?? (f.pagata ? "pagata" : (f.data_scadenza < today ? "scaduta" : "bozza"));

  const cell_classes = (f: FatturaClubRow | null) => {
    if (!f) return "bg-muted text-muted-foreground cursor-default";
    const s = stato_of(f);
    if (s === "pagata") return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
    if (s === "inviata") return "bg-blue-100 text-blue-800 hover:bg-blue-200";
    if (s === "scaduta") return "bg-red-100 text-red-800 hover:bg-red-200";
    if (s === "annullata") return "bg-gray-200 text-gray-700 hover:bg-gray-300";
    return "bg-slate-100 text-slate-800 hover:bg-slate-200";
  };

  const bozze_mese_corrente = useMemo(() => {
    const cur = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    return fatture.filter((f) => f.periodo === cur && stato_of(f) === "bozza");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fatture]);

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

  const build_pdf_data = (f: FatturaClubRow, c: ClubRow): FatturaClubData => {
    const righe: FatturaRiga[] = Array.isArray(f.righe_custom) && f.righe_custom.length > 0
      ? (f.righe_custom as FatturaRiga[])
      : [
          ...(Number(f.fee_fissa_chf ?? 0) > 0 ? [{ descrizione: "Canone base mensile", importo: Number(f.fee_fissa_chf) }] : []),
          ...(Number(f.n_atleti ?? 0) > 0 ? [{ descrizione: `${f.n_atleti} atleti × CHF ${Number(f.prezzo_per_atleta_chf).toFixed(2)}/mese`, importo: Number(f.importo_atleti_chf ?? (f.n_atleti * Number(f.prezzo_per_atleta_chf))) }] : []),
          ...(Number(f.importo_setup_chf ?? 0) > 0 ? [{ descrizione: "Costo setup iniziale", importo: Number(f.importo_setup_chf) }] : []),
        ];
    const totale = righe.reduce((a, r) => a + r.importo, 0);
    const [yy, mm] = f.periodo.split("-");
    const mesi_full = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
    return {
      numero: `${f.periodo}/${String(f.id).slice(0, 6).toUpperCase()}`,
      periodo: `${mesi_full[parseInt(mm,10)-1]} ${yy}`,
      data_emissione: today,
      data_scadenza: f.data_scadenza,
      righe, totale, note: f.note ?? undefined,
      club: { nome: c.nome, indirizzo: c.indirizzo, cap: c.cap, citta: c.citta, cantone: c.cantone, paese: c.paese, partita_iva: c.partita_iva, numero_iva_chf: c.numero_iva_chf },
    };
  };

  const run_bulk_send = async () => {
    set_bulk_running(true);
    set_bulk_total(bozze_mese_corrente.length);
    set_bulk_progress(0);
    set_bulk_done({ ok: 0, err: 0 });
    let ok = 0, err = 0;
    for (const f of bozze_mese_corrente) {
      try {
        const c = clubs.find((x) => x.id === f.club_id);
        if (!c) throw new Error("Club non trovato");
        const pdf_data = build_pdf_data(f, c);
        const blob = await pdf(<FatturaClubDocument data={pdf_data} />).toBlob();
        const path = `${f.club_id}/${f.id}.pdf`;
        const up = await supabase.storage.from("fatture-clubs").upload(path, blob, { upsert: true, contentType: "application/pdf" });
        if (up.error) throw up.error;
        const { error } = await supabase.functions.invoke("send-fattura-email", { body: { fattura_id: f.id, pdf_path: path } });
        if (error) throw error;
        ok++;
      } catch (e: any) {
        console.error("bulk send error", f.id, e);
        err++;
      }
      set_bulk_progress((p) => p + 1);
    }
    set_bulk_done({ ok, err });
    set_bulk_running(false);
    qc.invalidateQueries({ queryKey: ["sa_fatture_clubs_anno", anno] });
    toast({ title: `Invio completato: ${ok} ok, ${err} errori` });
  };

  const tot_bozze = bozze_mese_corrente.reduce((a, f) => a + Number(f.importo_chf), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("tabellone.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tabellone.subtitle")}</p>
        </div>
        <Button onClick={() => set_open_bulk(true)} disabled={bozze_mese_corrente.length === 0}>
          <Send className="w-4 h-4 mr-2" />
          Invia tutte le bozze del mese ({bozze_mese_corrente.length})
        </Button>
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
                            onClick={() => f && navigate(`/superadmin/fatture/${f.id}`)}
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

      <Dialog open={open_bulk} onOpenChange={(o) => !bulk_running && set_open_bulk(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invio massivo fatture</DialogTitle></DialogHeader>
          {!bulk_running && bulk_total === 0 && (
            <div className="space-y-3 text-sm">
              <p>Stai per inviare <b>{bozze_mese_corrente.length}</b> fatture in stato bozza per il mese corrente.</p>
              <p>Totale previsto: <b>CHF {tot_bozze.toFixed(2)}</b></p>
              <p className="text-muted-foreground text-xs">Verrà generato e caricato un PDF per ciascuna, poi inviato via email al presidente del club.</p>
            </div>
          )}
          {(bulk_running || bulk_total > 0) && (
            <div className="space-y-3">
              <Progress value={bulk_total ? (bulk_progress / bulk_total) * 100 : 0} />
              <p className="text-sm">{bulk_progress} / {bulk_total}</p>
              {!bulk_running && bulk_total > 0 && (
                <p className="text-sm">Completato: <b className="text-emerald-700">{bulk_done.ok} ok</b> · <b className="text-red-700">{bulk_done.err} errori</b></p>
              )}
            </div>
          )}
          <DialogFooter>
            {!bulk_running && bulk_total === 0 && (
              <Button onClick={run_bulk_send} disabled={bozze_mese_corrente.length === 0}>Conferma invio</Button>
            )}
            {!bulk_running && bulk_total > 0 && (
              <Button variant="outline" onClick={() => { set_open_bulk(false); set_bulk_total(0); set_bulk_progress(0); }}>Chiudi</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminTabelloneFatturePage;
