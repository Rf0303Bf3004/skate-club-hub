import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Building2, Users, TrendingUp, Wallet, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function periodo_corrente_str(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ClubRow = {
  id: string;
  nome: string;
  citta: string | null;
  indirizzo: string | null;
  cap: string | null;
  cantone: string | null;
  email: string | null;
  partita_iva: string | null;
  iban: string | null;
  prezzo_per_atleta_chf: number;
  fee_fissa_chf: number;
  mesi_fatturazione_fee: number;
  mesi_fatturazione_atleti: number;
  mese_inizio_fatturazione: number;
  costo_setup_chf: number;
  setup_fatturato: boolean;
  attivo: boolean;
};
type FatturaClubRow = {
  id: string;
  club_id: string;
  periodo: string;
  importo_chf: number;
  stato: string | null;
  pagata: boolean;
  data_scadenza: string;
  data_pagamento: string | null;
};

// Calcola se un mese (1..12) rientra in N mesi consecutivi a partire da mese_inizio
function mese_attivo(mese_corrente: number, mese_inizio: number, n_mesi: number): boolean {
  if (n_mesi <= 0) return false;
  if (n_mesi >= 12) return true;
  for (let i = 0; i < n_mesi; i++) {
    const m = ((mese_inizio - 1 + i) % 12) + 1;
    if (m === mese_corrente) return true;
  }
  return false;
}

function anagrafica_completa(c: ClubRow): boolean {
  return !!(c.nome && c.indirizzo && c.cap && c.citta && c.cantone && c.email && c.iban);
}

function calcola_righe(c: ClubRow, n_atleti: number, mese: number, esiste_gia_fattura: boolean) {
  const fee_attivo = mese_attivo(mese, c.mese_inizio_fatturazione, c.mesi_fatturazione_fee);
  const atl_attivo = mese_attivo(mese, c.mese_inizio_fatturazione, c.mesi_fatturazione_atleti);
  const fee = fee_attivo ? Number(c.fee_fissa_chf ?? 0) : 0;
  const prezzo = Number(c.prezzo_per_atleta_chf ?? 0);
  const importo_atleti = atl_attivo ? n_atleti * prezzo : 0;
  const importo_setup = !c.setup_fatturato && !esiste_gia_fattura ? Number(c.costo_setup_chf ?? 0) : 0;
  return {
    fee,
    fee_attivo,
    atl_attivo,
    prezzo,
    importo_atleti,
    importo_setup,
    totale: Number((fee + importo_atleti + importo_setup).toFixed(2)),
  };
}

const SuperAdminBillingDashboardPage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, set_search] = useState("");
  const [preview_open, set_preview_open] = useState(false);
  const [confirming, set_confirming] = useState(false);
  const periodo = periodo_corrente_str();
  const mese_corrente = new Date().getMonth() + 1;
  const today = new Date().toISOString().slice(0, 10);

  const { data: clubs = [] } = useQuery({
    queryKey: ["sa_clubs_v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, nome, citta, indirizzo, cap, cantone, email, partita_iva, iban, prezzo_per_atleta_chf, fee_fissa_chf, attivo, mesi_fatturazione_fee, mesi_fatturazione_atleti, mese_inizio_fatturazione, costo_setup_chf, setup_fatturato")
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
    queryKey: ["sa_fatture_clubs_v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatture_clubs" as any)
        .select("id, club_id, periodo, importo_chf, stato, pagata, data_scadenza, data_pagamento")
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

  const fattura_esistente = (cid: string) =>
    fatture.some((f) => f.club_id === cid && f.periodo === periodo);

  const anteprima_righe = useMemo(() => {
    return clubs.filter((c) => c.attivo).map((c) => {
      const n = atleti_counts[c.id] ?? 0;
      const esiste = fattura_esistente(c.id);
      const r = calcola_righe(c, n, mese_corrente, esiste);
      return { club: c, n_atleti: n, esiste, ...r };
    });
  }, [clubs, atleti_counts, fatture, mese_corrente, periodo]);

  const totale_aggregato = anteprima_righe.reduce(
    (a, r) => a + (r.esiste ? 0 : r.totale),
    0,
  );

  const kpi = useMemo(() => {
    const club_attivi = clubs.filter((c) => c.attivo).length;
    const atleti_totali = Object.values(atleti_counts).reduce((a, b) => a + b, 0);
    const mese_arr = fatture.filter((f) => f.periodo === periodo);
    const mrr_incassato = mese_arr
      .filter((f) => (f.stato === "pagata") || f.pagata)
      .reduce((a, f) => a + Number(f.importo_chf), 0);
    const mrr_previsto = anteprima_righe.reduce((a, r) => a + r.totale, 0);
    return { club_attivi, atleti_totali, mrr_previsto, mrr_incassato };
  }, [clubs, atleti_counts, fatture, periodo, anteprima_righe]);

  const conferma_genera = async () => {
    set_confirming(true);
    try {
      const scadenza = new Date();
      scadenza.setDate(scadenza.getDate() + 30);
      const data_scadenza = scadenza.toISOString().slice(0, 10);

      const da_inserire = anteprima_righe
        .filter((r) => !r.esiste && r.totale > 0)
        .map((r) => ({
          club_id: r.club.id,
          periodo,
          n_atleti: r.n_atleti,
          prezzo_per_atleta_chf: r.prezzo,
          fee_fissa_chf: r.fee,
          importo_atleti_chf: r.importo_atleti,
          importo_setup_chf: r.importo_setup,
          importo_chf: r.totale,
          stato: "bozza",
          data_emissione: today,
          data_scadenza,
        }));

      if (da_inserire.length === 0) {
        toast({ title: "Nessuna fattura da generare per questo periodo" });
        set_preview_open(false);
        set_confirming(false);
        return;
      }

      const { error } = await supabase
        .from("fatture_clubs" as any)
        .upsert(da_inserire as any, { onConflict: "club_id,periodo", ignoreDuplicates: true });
      if (error) throw error;

      toast({ title: `${da_inserire.length} bozza/e create per ${periodo}` });
      set_preview_open(false);
      qc.invalidateQueries({ queryKey: ["sa_fatture_clubs_v2"] });
      navigate("/superadmin/tabellone");
    } catch (e: any) {
      toast({ title: "Errore", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      set_confirming(false);
    }
  };

  const stato_ultima = (cid: string): { label: string; cls: string } => {
    const lista = fatture_per_club[cid] ?? [];
    if (lista.length === 0) return { label: "Nessuna", cls: "bg-muted text-muted-foreground" };
    const ult = lista[0];
    const stato = ult.stato ?? (ult.pagata ? "pagata" : "bozza");
    if (stato === "pagata") return { label: "Pagata", cls: "bg-emerald-100 text-emerald-800" };
    if (stato === "bozza") return { label: "Bozza", cls: "bg-slate-200 text-slate-800" };
    if (stato === "inviata") {
      if (ult.data_scadenza < today) return { label: "Scaduta", cls: "bg-red-100 text-red-800" };
      return { label: "Inviata", cls: "bg-amber-100 text-amber-800" };
    }
    if (stato === "scaduta") return { label: "Scaduta", cls: "bg-red-100 text-red-800" };
    return { label: stato, cls: "bg-muted text-muted-foreground" };
  };

  const filtrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter((c) => !q || c.nome.toLowerCase().includes(q));
  }, [clubs, search]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard SuperAdmin</h1>
          <p className="text-sm text-muted-foreground">Vista di sistema · Periodo corrente {periodo}</p>
        </div>
        <Button onClick={() => navigate("/superadmin/clubs/nuovo")}>
          <Building2 className="w-4 h-4 mr-2" /> Nuovo club
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: "Club attivi", value: kpi.club_attivi },
          { icon: Users, label: "Atleti totali", value: kpi.atleti_totali },
          { icon: TrendingUp, label: "MRR previsto questo mese", value: `CHF ${kpi.mrr_previsto.toFixed(2)}` },
          { icon: Wallet, label: "MRR incassato questo mese", value: `CHF ${kpi.mrr_incassato.toFixed(2)}` },
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

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Genera fatture del mese ({periodo})</p>
              <p className="text-xs text-muted-foreground">Anteprima e conferma · crea le bozze nel Tabellone</p>
            </div>
          </div>
          <Button size="lg" onClick={() => set_preview_open(true)}>
            <FileText className="w-4 h-4 mr-2" /> Genera fatture del mese
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Club</CardTitle>
            <Input value={search} onChange={(e) => set_search(e.target.value)} placeholder="Cerca club…" className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtrati.map((c) => {
              const n = atleti_counts[c.id] ?? 0;
              const esiste = fattura_esistente(c.id);
              const r = calcola_righe(c, n, mese_corrente, esiste);
              const st = stato_ultima(c.id);
              const completa = anagrafica_completa(c);
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/superadmin/clubs/${c.id}`)}
                  className="text-left border rounded-xl p-4 hover:bg-muted/40 hover:border-primary/40 transition bg-card"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">{c.citta || "—"}</div>
                    </div>
                    <Badge className={st.cls}>{st.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    {completa ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>Anagrafica completa</span></>
                    ) : (
                      <><AlertCircle className="w-3.5 h-3.5 text-amber-600" /><span>Anagrafica mancante</span></>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Atleti</p>
                      <p className="font-semibold">{n}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prezzo/atleta</p>
                      <p className="font-semibold tabular-nums">CHF {Number(c.prezzo_per_atleta_chf ?? 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fee mensile</p>
                      <p className="font-semibold tabular-nums">CHF {Number(c.fee_fissa_chf ?? 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Previsto mese</p>
                      <p className="font-semibold tabular-nums">CHF {r.totale.toFixed(2)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {filtrati.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">Nessun club</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={preview_open} onOpenChange={set_preview_open}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Anteprima fatture · {periodo}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-xs uppercase">
                  <th className="py-2 px-3">Club</th>
                  <th className="py-2 px-3 text-right">Atleti</th>
                  <th className="py-2 px-3 text-right">Canone</th>
                  <th className="py-2 px-3 text-right">Atleti × Prezzo</th>
                  <th className="py-2 px-3 text-right">Setup</th>
                  <th className="py-2 px-3 text-right">Totale</th>
                  <th className="py-2 px-3">Stato</th>
                </tr>
              </thead>
              <tbody>
                {anteprima_righe.map((r) => (
                  <tr key={r.club.id} className="border-b">
                    <td className="py-2 px-3 font-medium">{r.club.nome}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{r.n_atleti}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {r.fee_attivo ? `CHF ${r.fee.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {r.atl_attivo ? `${r.n_atleti} × ${r.prezzo.toFixed(2)} = ${r.importo_atleti.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {r.importo_setup > 0 ? `CHF ${r.importo_setup.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold">CHF {r.totale.toFixed(2)}</td>
                    <td className="py-2 px-3">
                      {r.esiste
                        ? <Badge className="bg-slate-200 text-slate-700">Già esistente</Badge>
                        : r.totale > 0
                          ? <Badge className="bg-emerald-100 text-emerald-800">Da creare</Badge>
                          : <Badge className="bg-muted text-muted-foreground">Nessun importo</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td colSpan={5} className="py-2 px-3 text-right">Totale da creare</td>
                  <td className="py-2 px-3 text-right tabular-nums">CHF {totale_aggregato.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_preview_open(false)} disabled={confirming}>Annulla</Button>
            <Button onClick={conferma_genera} disabled={confirming}>
              {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Conferma e crea bozze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminBillingDashboardPage;
