import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { AnagraficaTerritoriale } from "@/components/AnagraficaTerritoriale";
import {
  isValidPartitaIVA,
  isValidIBAN,
  getPartitaIVAPlaceholder,
  getIBANPlaceholder,
  getTelefonoPlaceholder,
  type paese_iso,
} from "@/lib/territori";

const SuperAdminClubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("superadmin");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [prezzo, set_prezzo] = useState<number>(5);
  const [fee, set_fee] = useState<number>(50);
  const [mesi_fee, set_mesi_fee] = useState<number>(12);
  const [mesi_atleti, set_mesi_atleti] = useState<number>(12);
  const [mese_inizio, set_mese_inizio] = useState<number>(1);
  const [costo_setup, set_costo_setup] = useState<number>(0);
  const [setup_fatt, set_setup_fatt] = useState<boolean>(false);
  const [anag, set_anag] = useState<Record<string, string>>({});
  const set_a = (k: string, v: string) => set_anag((p) => ({ ...p, [k]: v }));

  const CANTONI_CH = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"];
  const iva_re = /^CHE-\d{3}\.\d{3}\.\d{3}( (MWST|IVA|TVA))?$/;
  const iva_valido = !anag.numero_iva_chf || iva_re.test((anag.numero_iva_chf || "").trim());
  const iban_clean = (anag.iban || "").replace(/\s/g, "");
  const iban_valido = !iban_clean || (iban_clean.startsWith("CH") && iban_clean.length === 21);

  const { data: club } = useQuery({
    queryKey: ["sa_club_detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs")
        .select("id, nome, sigla, citta, indirizzo, cap, cantone, paese, email, telefono, sito_web, numero_tessera_federale, prezzo_per_atleta_chf, fee_fissa_chf, partita_iva, numero_iva_chf, iban, intestatario_iban, twint_qr_url, mesi_fatturazione_fee, mesi_fatturazione_atleti, mese_inizio_fatturazione, costo_setup_chf, setup_fatturato")
        .eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { count: n_atleti = 0 } = useQuery({
    queryKey: ["sa_club_n_atleti", id],
    enabled: !!id,
    queryFn: async () => {
      const { count, error } = await supabase.from("atleti")
        .select("id", { count: "exact", head: true })
        .eq("club_id", id!).eq("attivo", true);
      if (error) throw error;
      return { count: count ?? 0 } as any;
    },
    select: (d: any) => d?.count ?? 0,
  }) as any;

  useEffect(() => {
    if (club) {
      set_prezzo(Number(club.prezzo_per_atleta_chf ?? 5));
      set_fee(Number(club.fee_fissa_chf ?? 50));
      set_mesi_fee(Number(club.mesi_fatturazione_fee ?? 12));
      set_mesi_atleti(Number(club.mesi_fatturazione_atleti ?? 12));
      set_mese_inizio(Number(club.mese_inizio_fatturazione ?? 1));
      set_costo_setup(Number(club.costo_setup_chf ?? 0));
      set_setup_fatt(!!club.setup_fatturato);
      set_anag({
        nome: club.nome ?? "",
        sigla: club.sigla ?? "",
        indirizzo: club.indirizzo ?? "",
        cap: club.cap ?? "",
        citta: club.citta ?? "",
        cantone: club.cantone ?? "",
        paese: club.paese ?? "CH",
        email: club.email ?? "",
        telefono: club.telefono ?? "",
        sito_web: club.sito_web ?? "",
        numero_tessera_federale: club.numero_tessera_federale ?? "",
        partita_iva: club.partita_iva ?? "",
        numero_iva_chf: club.numero_iva_chf ?? "",
        iban: club.iban ?? "",
        intestatario_iban: club.intestatario_iban ?? "",
        twint_qr_url: club.twint_qr_url ?? "",
      });
    }
  }, [club]);

  const salva_anagrafica = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clubs").update(anag as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Anagrafica club salvata" });
      qc.invalidateQueries({ queryKey: ["sa_club_detail", id] });
      qc.invalidateQueries({ queryKey: ["sa_clubs"] });
    },
    onError: (e: any) => toast({ title: "Errore salvataggio", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const { data: fatture = [] } = useQuery({
    queryKey: ["sa_club_fatture", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("fatture_clubs" as any)
        .select("*").eq("club_id", id!).order("periodo", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const salva_prezzi = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clubs")
        .update({
          prezzo_per_atleta_chf: prezzo,
          fee_fissa_chf: fee,
          mesi_fatturazione_fee: mesi_fee,
          mesi_fatturazione_atleti: mesi_atleti,
          mese_inizio_fatturazione: mese_inizio,
          costo_setup_chf: costo_setup,
          setup_fatturato: setup_fatt,
        } as any)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("listino.salvato") });
      qc.invalidateQueries({ queryKey: ["sa_club_detail", id] });
      qc.invalidateQueries({ queryKey: ["sa_clubs"] });
      qc.invalidateQueries({ queryKey: ["sa_listino"] });
    },
    onError: (e: any) => toast({ title: t("listino.errore"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const toggle_pagata = useMutation({
    mutationFn: async (f: any) => {
      const { error } = await supabase.from("fatture_clubs" as any)
        .update({ pagata: !f.pagata, data_pagamento: !f.pagata ? today : null })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sa_club_fatture", id] }),
  });

  if (!club) return <div className="p-6 text-muted-foreground">…</div>;

  const importo_previsto = fee + (Number(n_atleti) || 0) * prezzo;

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin")}>
        <ArrowLeft className="w-4 h-4 mr-2" />{t("club_detail.torna")}
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{club.nome}</h1>
        <p className="text-sm text-muted-foreground">{club.citta || "—"}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Anagrafica club</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Nome club</Label>
              <Input value={anag.nome ?? ""} onChange={(e) => set_a("nome", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sigla</Label>
              <Input value={anag.sigla ?? ""} onChange={(e) => set_a("sigla", e.target.value.toUpperCase())} maxLength={8} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Indirizzo (via e numero)</Label>
              <Input value={anag.indirizzo ?? ""} onChange={(e) => set_a("indirizzo", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CAP</Label>
              <Input value={anag.cap ?? ""} onChange={(e) => set_a("cap", e.target.value.replace(/[^0-9]/g, "").slice(0,5))} placeholder="6900" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Città</Label>
              <Input value={anag.citta ?? ""} onChange={(e) => set_a("citta", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cantone</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={anag.cantone ?? ""} onChange={(e) => set_a("cantone", e.target.value)}>
                <option value="">—</option>
                {CANTONI_CH.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={anag.email ?? ""} onChange={(e) => set_a("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefono</Label>
              <Input value={anag.telefono ?? ""} onChange={(e) => set_a("telefono", e.target.value)} placeholder="+41 ..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sito web</Label>
              <Input value={anag.sito_web ?? ""} onChange={(e) => set_a("sito_web", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">N. tessera federale</Label>
              <Input value={anag.numero_tessera_federale ?? ""} onChange={(e) => set_a("numero_tessera_federale", e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dati fiscali e bancari</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Partita IVA</Label>
                <Input value={anag.partita_iva ?? ""} onChange={(e) => set_a("partita_iva", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Numero IVA svizzero</Label>
                <Input value={anag.numero_iva_chf ?? ""} onChange={(e) => set_a("numero_iva_chf", e.target.value.toUpperCase())} placeholder="CHE-123.456.789 MWST" />
                {!iva_valido && (<p className="text-xs text-destructive">Formato: CHE-XXX.XXX.XXX (MWST/IVA/TVA opzionale)</p>)}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IBAN</Label>
                <Input value={anag.iban ?? ""} onChange={(e) => set_a("iban", e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, ""))} placeholder="CH56 0483 5012 3456 7800 9" maxLength={26} />
                {!iban_valido && (<p className="text-xs text-destructive">IBAN svizzero: inizia con CH, 21 caratteri</p>)}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Intestatario IBAN</Label>
                <Input value={anag.intestatario_iban ?? ""} onChange={(e) => set_a("intestatario_iban", e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">TWINT QR URL</Label>
                <Input value={anag.twint_qr_url ?? ""} onChange={(e) => set_a("twint_qr_url", e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">Atleti attivi: <b className="text-foreground">{n_atleti}</b></p>
            <Button onClick={() => salva_anagrafica.mutate()} disabled={salva_anagrafica.isPending || !iva_valido || !iban_valido}>
              {salva_anagrafica.isPending ? "..." : "Salva anagrafica"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("club_detail.tariffazione")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <RigaTariffa
            label="Canone base mensile"
            importo={fee} on_importo={set_fee}
            mesi={mesi_fee} on_mesi={set_mesi_fee}
          />
          <div className="-mt-2 pl-1">
            <Label className="text-xs">Mese di inizio fatturazione</Label>
            <select className="h-9 mt-1 w-48 rounded-md border border-input bg-background px-2 text-sm"
              value={mese_inizio} onChange={(e) => set_mese_inizio(parseInt(e.target.value, 10))}>
              {["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"].map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <RigaTariffa
            label="Prezzo per atleta / mese"
            importo={prezzo} on_importo={set_prezzo}
            mesi={mesi_atleti} on_mesi={set_mesi_atleti}
          />
          <div className="flex items-end gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Costo setup una tantum (CHF)</Label>
              <Input type="number" step="0.01" min={0} className="w-40" value={costo_setup}
                onChange={(e) => set_costo_setup(parseFloat(e.target.value) || 0)} />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
              <input type="checkbox" checked={setup_fatt} onChange={(e) => set_setup_fatt(e.target.checked)} />
              Già fatturato
            </label>
          </div>
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
            <p><b>Fattura mensile tipo:</b> canone {fee.toFixed(2)} CHF + {n_atleti} atleti × {prezzo.toFixed(2)} CHF = <b>CHF {importo_previsto.toFixed(2)}</b>/mese</p>
            <p><b>Setup una tantum:</b> CHF {costo_setup.toFixed(2)} {setup_fatt ? "(già fatturato)" : "(da fatturare alla prima emissione)"}</p>
            <p className="pt-1 border-t mt-2"><b>Totale annuale previsto:</b> CHF {(fee * mesi_fee + n_atleti * prezzo * mesi_atleti + (setup_fatt ? 0 : costo_setup)).toFixed(2)}</p>
          </div>
          <Button onClick={() => salva_prezzi.mutate()} disabled={salva_prezzi.isPending}>{t("listino.salva")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("club_detail.storico")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-3">Periodo</th>
                  <th className="py-2 px-3 text-right">Atleti</th>
                  <th className="py-2 px-3 text-right">Importo</th>
                  <th className="py-2 px-3">Scadenza</th>
                  <th className="py-2 px-3">Stato</th>
                </tr>
              </thead>
              <tbody>
                {fatture.map((f) => {
                  const stato_ui = f.stato ?? (f.pagata ? "pagata" : (f.data_scadenza < today ? "scaduta" : "bozza"));
                  const cls: Record<string, string> = {
                    bozza: "bg-slate-100 text-slate-800", inviata: "bg-blue-100 text-blue-800",
                    pagata: "bg-emerald-100 text-emerald-800", scaduta: "bg-red-100 text-red-800",
                    annullata: "bg-gray-200 text-gray-700",
                  };
                  return (
                    <tr key={f.id} className="border-b hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate(`/superadmin/fatture/${f.id}`)}>
                      <td className="py-2 px-3 font-medium">{f.periodo}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{f.n_atleti}</td>
                      <td className="py-2 px-3 text-right tabular-nums">CHF {Number(f.importo_chf).toFixed(2)}</td>
                      <td className="py-2 px-3">{f.data_scadenza}</td>
                      <td className="py-2 px-3">
                        <Badge className={cls[stato_ui] || cls.bozza}>{stato_ui.toUpperCase()}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {fatture.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{t("tabellone.nessuna")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RigaTariffa: React.FC<{
  label: string; importo: number; on_importo: (v: number) => void;
  mesi: number; on_mesi: (v: number) => void;
}> = ({ label, importo, on_importo, mesi, on_mesi }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <div className="flex items-center gap-2 mt-1">
      <Input type="number" step="0.01" min={0} className="w-40" value={importo}
        onChange={(e) => on_importo(parseFloat(e.target.value) || 0)} />
      <span className="text-sm text-muted-foreground">CHF ×</span>
      <select className="h-10 rounded-md border border-input bg-background px-2 text-sm"
        value={mesi} onChange={(e) => on_mesi(parseInt(e.target.value, 10))}>
        {Array.from({length: 13}, (_, i) => i).map((n) => (
          <option key={n} value={n}>{n} {n === 1 ? "mese" : "mesi"}/anno</option>
        ))}
      </select>
    </div>
  </div>
);

export default SuperAdminClubDetailPage;
