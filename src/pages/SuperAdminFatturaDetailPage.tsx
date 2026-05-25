import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { ArrowLeft, FileText, Send, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FatturaClubDocument, type FatturaClubData, type FatturaRiga } from "@/lib/fattura-club-pdf";

const SuperAdminFatturaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [open_preview, set_open_preview] = useState(false);
  const [edit_mode, set_edit_mode] = useState(false);
  const [edit_righe, set_edit_righe] = useState<FatturaRiga[]>([]);
  const [edit_note, set_edit_note] = useState("");
  const [open_pay, set_open_pay] = useState(false);
  const [pay_date, set_pay_date] = useState(today);

  const { data: f } = useQuery({
    queryKey: ["sa_fattura_detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("fatture_clubs" as any)
        .select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: club } = useQuery({
    queryKey: ["sa_fattura_club", f?.club_id],
    enabled: !!f?.club_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs")
        .select("id, nome, indirizzo, cap, citta, cantone, paese, partita_iva, numero_iva_chf, email")
        .eq("id", f.club_id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const stato = f?.stato ?? (f?.pagata ? "pagata" : "bozza");

  const righe_default = useMemo<FatturaRiga[]>(() => {
    if (!f) return [];
    if (Array.isArray(f.righe_custom) && f.righe_custom.length > 0) return f.righe_custom as FatturaRiga[];
    const out: FatturaRiga[] = [];
    if (Number(f.fee_fissa_chf ?? 0) > 0) out.push({ descrizione: "Canone base mensile", importo: Number(f.fee_fissa_chf) });
    if (Number(f.importo_atleti_chf ?? 0) > 0 || Number(f.n_atleti ?? 0) > 0) {
      out.push({
        descrizione: `${f.n_atleti} atleti × CHF ${Number(f.prezzo_per_atleta_chf).toFixed(2)}/mese`,
        importo: Number(f.importo_atleti_chf) > 0 ? Number(f.importo_atleti_chf) : Number(f.n_atleti) * Number(f.prezzo_per_atleta_chf),
      });
    }
    if (Number(f.importo_setup_chf ?? 0) > 0) out.push({ descrizione: "Costo setup iniziale", importo: Number(f.importo_setup_chf) });
    return out;
  }, [f]);

  const righe = edit_mode ? edit_righe : righe_default;
  const totale = righe.reduce((a, r) => a + Number(r.importo || 0), 0);

  const pdf_data: FatturaClubData | null = useMemo(() => {
    if (!f || !club) return null;
    return {
      numero: `${f.periodo}/${String(f.id).slice(0, 6).toUpperCase()}`,
      periodo: formatPeriodo(f.periodo),
      data_emissione: f.data_emissione,
      data_scadenza: f.data_scadenza,
      righe,
      totale,
      note: edit_mode ? edit_note : (f.note ?? ""),
      club: {
        nome: club.nome,
        indirizzo: club.indirizzo,
        cap: club.cap,
        citta: club.citta,
        cantone: club.cantone,
        paese: club.paese,
        partita_iva: club.partita_iva,
        numero_iva_chf: club.numero_iva_chf,
      },
    };
  }, [f, club, righe, totale, edit_mode, edit_note]);

  const start_edit = () => {
    set_edit_righe(righe_default.length ? righe_default : [{ descrizione: "", importo: 0 }]);
    set_edit_note(f?.note ?? "");
    set_edit_mode(true);
  };

  const save_edit = useMutation({
    mutationFn: async () => {
      const tot = edit_righe.reduce((a, r) => a + Number(r.importo || 0), 0);
      const { error } = await supabase.from("fatture_clubs" as any).update({
        righe_custom: edit_righe,
        importo_chf: tot,
        note: edit_note,
      } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Modifiche salvate" });
      set_edit_mode(false);
      qc.invalidateQueries({ queryKey: ["sa_fattura_detail", id] });
      qc.invalidateQueries({ queryKey: ["sa_fatture_clubs_anno"] });
    },
    onError: (e: any) => toast({ title: "Errore", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const upload_pdf = async (): Promise<string | null> => {
    if (!pdf_data) return null;
    const blob = await pdf(<FatturaClubDocument data={pdf_data} />).toBlob();
    const path = `${f.club_id}/${f.id}.pdf`;
    const { error } = await supabase.storage.from("fatture-clubs").upload(path, blob, {
      upsert: true, contentType: "application/pdf",
    });
    if (error) throw error;
    return path;
  };

  const invia = useMutation({
    mutationFn: async () => {
      const path = await upload_pdf();
      const { data, error } = await supabase.functions.invoke("send-fattura-email", {
        body: { fattura_id: f.id, pdf_path: path },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const msg = data?.email_sent ? "Fattura inviata via email" : "Fattura marcata come inviata (email non configurata)";
      toast({ title: msg });
      qc.invalidateQueries({ queryKey: ["sa_fattura_detail", id] });
    },
    onError: (e: any) => toast({ title: "Errore invio", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const marca_pagata = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fatture_clubs" as any).update({
        pagata: true, stato: "pagata", data_pagamento: pay_date,
      } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Fattura segnata come pagata" });
      set_open_pay(false);
      qc.invalidateQueries({ queryKey: ["sa_fattura_detail", id] });
      qc.invalidateQueries({ queryKey: ["sa_fatture_clubs_anno"] });
    },
  });

  if (!f || !club) return <div className="p-6 text-muted-foreground">Caricamento…</div>;

  const stato_classes: Record<string, string> = {
    bozza: "bg-slate-100 text-slate-800",
    inviata: "bg-blue-100 text-blue-800",
    pagata: "bg-emerald-100 text-emerald-800",
    scaduta: "bg-red-100 text-red-800",
    annullata: "bg-gray-200 text-gray-700",
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />Indietro
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fattura {f.periodo}</h1>
          <p className="text-sm text-muted-foreground">{club.nome}</p>
        </div>
        <Badge className={stato_classes[stato]}>{stato.toUpperCase()}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => set_open_preview(true)}>
          <FileText className="w-4 h-4 mr-2" />Anteprima PDF
        </Button>
        {!edit_mode ? (
          <Button variant="outline" onClick={start_edit} disabled={stato !== "bozza"}>
            <Pencil className="w-4 h-4 mr-2" />Modifica
          </Button>
        ) : (
          <>
            <Button onClick={() => save_edit.mutate()} disabled={save_edit.isPending}>Salva modifiche</Button>
            <Button variant="ghost" onClick={() => set_edit_mode(false)}>Annulla</Button>
          </>
        )}
        <Button onClick={() => invia.mutate()} disabled={stato !== "bozza" || invia.isPending}>
          <Send className="w-4 h-4 mr-2" />{invia.isPending ? "Invio…" : "Invia"}
        </Button>
        <Button variant="outline" onClick={() => set_open_pay(true)} disabled={stato === "pagata"}>
          <CheckCircle2 className="w-4 h-4 mr-2" />Marca pagata
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Mittente</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-0.5">
            <p className="font-semibold">Ice Arena Manager Sagl</p>
            <p>Via Cantonale 1</p>
            <p>6500 Bellinzona (TI)</p>
            <p className="text-muted-foreground">P.IVA / IVA: CHE-XXX.XXX.XXX MWST</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Intestatario</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-0.5">
            <p className="font-semibold">{club.nome}</p>
            {club.indirizzo && <p>{club.indirizzo}</p>}
            <p>{[club.cap, club.citta].filter(Boolean).join(" ")}</p>
            <p>{[club.cantone, club.paese || "CH"].filter(Boolean).join(" – ")}</p>
            {club.partita_iva && <p className="text-muted-foreground">P.IVA: {club.partita_iva}</p>}
            {club.numero_iva_chf && <p className="text-muted-foreground">IVA: {club.numero_iva_chf}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex justify-between">
            <span>Righe fattura</span>
            <span className="text-xs text-muted-foreground font-normal">
              Periodo: {formatPeriodo(f.periodo)} · Scadenza: {f.data_scadenza}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!edit_mode ? (
            <table className="w-full text-sm">
              <tbody>
                {righe.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{r.descrizione}</td>
                    <td className="py-2 text-right tabular-nums">CHF {Number(r.importo).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-3">TOTALE</td>
                  <td className="py-3 text-right tabular-nums text-lg">CHF {totale.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="space-y-2">
              {edit_righe.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={r.descrizione} placeholder="Descrizione"
                    onChange={(e) => set_edit_righe((p) => p.map((x, j) => j === i ? { ...x, descrizione: e.target.value } : x))} />
                  <Input type="number" step="0.01" value={r.importo} className="w-32"
                    onChange={(e) => set_edit_righe((p) => p.map((x, j) => j === i ? { ...x, importo: parseFloat(e.target.value) || 0 } : x))} />
                  <Button size="icon" variant="ghost" onClick={() => set_edit_righe((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => set_edit_righe((p) => [...p, { descrizione: "", importo: 0 }])}>
                <Plus className="w-4 h-4 mr-1" />Riga
              </Button>
              <div className="pt-2">
                <Label className="text-xs">Note</Label>
                <Textarea value={edit_note} onChange={(e) => set_edit_note(e.target.value)} rows={2} />
              </div>
              <div className="text-right font-bold text-lg pt-2 border-t">
                Totale: CHF {edit_righe.reduce((a, r) => a + Number(r.importo || 0), 0).toFixed(2)}
              </div>
            </div>
          )}
          {!edit_mode && f.note && (
            <div className="mt-4 text-sm bg-muted/40 p-3 rounded">
              <p className="text-xs uppercase text-muted-foreground mb-1">Note</p>
              <p>{f.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open_preview} onOpenChange={set_open_preview}>
        <DialogContent className="max-w-6xl h-[92vh] flex flex-col">
          <DialogHeader><DialogTitle>Anteprima PDF</DialogTitle></DialogHeader>
          <div className="flex-1 min-h-0">
            {pdf_data && (
              <PDFViewer width="100%" height="100%" showToolbar={false}>
                <FatturaClubDocument data={pdf_data} />
              </PDFViewer>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open_pay} onOpenChange={set_open_pay}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marca come pagata</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Data pagamento</Label>
            <Input type="date" value={pay_date} onChange={(e) => set_pay_date(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => marca_pagata.mutate()} disabled={marca_pagata.isPending}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function formatPeriodo(p: string): string {
  if (!p) return "";
  const [y, m] = p.split("-");
  const mesi = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  const mi = Math.max(1, Math.min(12, parseInt(m, 10))) - 1;
  return `${mesi[mi]} ${y}`;
}

export default SuperAdminFatturaDetailPage;
