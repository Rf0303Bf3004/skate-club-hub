import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, FileText, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  use_anteprima_fatture_periodo,
  use_genera_fatture_periodo,
  type AnteprimaFattura,
  type EsitoGenerazione,
} from "@/hooks/use-supabase-mutations";

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const chf = (v: number) =>
  new Intl.NumberFormat("it-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AnteprimaFatturePeriodoDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const oggi = new Date();
  const [anno, set_anno] = useState<number>(oggi.getFullYear());
  const [mese, set_mese] = useState<number>(oggi.getMonth() + 1);
  const [righe, set_righe] = useState<AnteprimaFattura[] | null>(null);
  const [espanse, set_espanse] = useState<Set<string>>(new Set());
  const [esiti, set_esiti] = useState<EsitoGenerazione[] | null>(null);

  const anteprima = use_anteprima_fatture_periodo();
  const genera = use_genera_fatture_periodo();

  const anni = [oggi.getFullYear() - 1, oggi.getFullYear(), oggi.getFullYear() + 1];

  const generabili = useMemo(
    () => (righe ?? []).filter((r) => !r.avviso && !r.gia_fatturata),
    [righe],
  );
  const totale_generabile = generabili.reduce((s, r) => s + Number(r.totale || 0), 0);
  const totale_complessivo = (righe ?? []).reduce((s, r) => s + Number(r.totale || 0), 0);

  function reset_risultati() {
    set_righe(null);
    set_esiti(null);
    set_espanse(new Set());
  }

  async function carica() {
    set_esiti(null);
    try {
      const rows = await anteprima.mutateAsync({ anno, mese });
      set_righe(rows);
      if (rows.length === 0) toast({ title: `Nessuna fattura da generare per ${MESI[mese - 1]} ${anno}` });
    } catch (e: any) {
      toast({ title: "Errore anteprima", description: e?.message, variant: "destructive" });
    }
  }

  async function esegui_genera() {
    try {
      const res = await genera.mutateAsync({ anno, mese });
      set_esiti(res);
      set_righe(null);
      const create = res.filter((r) => r.creata).length;
      toast({ title: `${create} fatture create per ${MESI[mese - 1]} ${anno}` });
    } catch (e: any) {
      toast({ title: "Errore generazione", description: e?.message, variant: "destructive" });
    }
  }

  function toggle(id: string) {
    set_espanse((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset_risultati(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Genera fatture del periodo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Mese</Label>
            <Select value={String(mese)} onValueChange={(v) => { set_mese(Number(v)); reset_risultati(); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESI.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Anno</Label>
            <Select value={String(anno)} onValueChange={(v) => { set_anno(Number(v)); reset_risultati(); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anni.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={carica} disabled={anteprima.isPending}>
            {anteprima.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
            Anteprima
          </Button>
        </div>

        {righe !== null && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="w-8" />
                    <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Atleta</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Ragione sociale</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Voci</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nessuna fattura da generare per {MESI[mese - 1]} {anno}.</td></tr>
                  ) : (
                    righe.map((r) => {
                      const key = `${r.atleta_id}-${r.ragione_sociale_id ?? "x"}`;
                      const aperta = espanse.has(key);
                      const cls = r.avviso
                        ? "bg-orange-50 hover:bg-orange-100"
                        : r.gia_fatturata
                          ? "bg-muted/40 text-muted-foreground"
                          : "hover:bg-muted/20";
                      return (
                        <React.Fragment key={key}>
                          <tr className={`border-t border-border/50 cursor-pointer ${cls}`} onClick={() => toggle(key)}>
                            <td className="px-2 py-2">
                              <ChevronRight className={`w-4 h-4 transition-transform ${aperta ? "rotate-90" : ""}`} />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-foreground">{r.atleta}</div>
                              {r.avviso && (
                                <div className="text-xs text-orange-700 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="w-3 h-3" /> {r.avviso} — questa fattura non verrà creata
                                </div>
                              )}
                              {r.gia_fatturata && <div className="text-xs mt-0.5">Già fatturata per questo periodo</div>}
                            </td>
                            <td className="px-3 py-2">{r.ragione_sociale ?? "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.n_righe}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">CHF {chf(r.totale)}</td>
                          </tr>
                          {aperta && (
                            <tr className="bg-muted/20 border-t border-border/40">
                              <td />
                              <td colSpan={4} className="px-3 py-2">
                                <table className="w-full text-xs">
                                  <thead className="text-muted-foreground">
                                    <tr>
                                      <th className="text-left py-1">Descrizione</th>
                                      <th className="text-left py-1">Tipo / Voce</th>
                                      <th className="text-left py-1">Periodo</th>
                                      <th className="text-right py-1">Giorni</th>
                                      <th className="text-right py-1">Qta</th>
                                      <th className="text-right py-1">Prezzo</th>
                                      <th className="text-right py-1">Importo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.righe.map((v, i) => (
                                      <tr key={i} className="border-t border-border/30">
                                        <td className="py-1 pr-2">{v.descrizione}</td>
                                        <td className="py-1 pr-2 text-muted-foreground">{[v.tipo, v.voce].filter(Boolean).join(" · ") || "—"}</td>
                                        <td className="py-1 pr-2 text-muted-foreground">{v.periodo_da || v.periodo_a ? `${v.periodo_da ?? "…"} → ${v.periodo_a ?? "…"}` : "—"}</td>
                                        <td className="py-1 text-right tabular-nums text-muted-foreground">{v.giorni != null ? `${v.giorni}/${v.giorni_mese ?? "—"}` : "—"}</td>
                                        <td className="py-1 text-right tabular-nums">{v.quantita ?? 1}</td>
                                        <td className="py-1 text-right tabular-nums">{Number(v.prezzo_unitario ?? v.importo).toFixed(2)}</td>
                                        <td className="py-1 text-right tabular-nums font-medium">{Number(v.importo).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                {righe.length > 0 && (
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-bold">Totale complessivo</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">CHF {chf(totale_complessivo)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {generabili.length > 0 && (
              <Button onClick={esegui_genera} disabled={genera.isPending} className="bg-primary hover:bg-primary/90">
                {genera.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Genera {generabili.length} fatture per CHF {chf(totale_generabile)}
              </Button>
            )}
          </div>
        )}

        {esiti !== null && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Riepilogo generazione</h3>
            <div className="rounded-lg border border-border divide-y divide-border">
              {esiti.map((e, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
                  {e.creata
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                    : <XCircle className="w-4 h-4 text-orange-500 mt-0.5" />}
                  <div className="flex-1">
                    <span className="font-medium">{e.atleta ?? "—"}</span>
                    {e.numero && <span className="text-muted-foreground"> · {e.numero}</span>}
                    {!e.creata && e.motivo && <div className="text-xs text-orange-700">Saltata: {e.motivo}</div>}
                  </div>
                  {e.totale != null && <span className="tabular-nums">CHF {chf(Number(e.totale))}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AnteprimaFatturePeriodoDialog;
