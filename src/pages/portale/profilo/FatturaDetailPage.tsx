import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Download, Mail, CreditCard, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { load_fattura_full, build_pdf_data } from "@/lib/fattura-atleta-helpers";
import AnteprimaFatturaAtletaDialog from "@/components/AnteprimaFatturaAtletaDialog";

const STATO_COLORS: Record<string, string> = {
  bozza: "bg-slate-100 text-slate-700",
  inviata: "bg-blue-100 text-blue-700",
  pagata: "bg-emerald-100 text-emerald-700",
  scaduta: "bg-red-100 text-red-700",
  annullata: "bg-gray-200 text-gray-500",
};

const FatturaDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loading, set_loading] = useState(true);
  const [pdf_data, set_pdf_data] = useState<any>(null);
  const [club, set_club] = useState<any>(null);
  const [email_open, set_email_open] = useState(false);
  const [email_to, set_email_to] = useState("");
  const [sending, set_sending] = useState(false);
  const [pay_open, set_pay_open] = useState(false);
  const [preview_open, set_preview_open] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await load_fattura_full(id);
        const d = build_pdf_data(r.fattura, r.atleta, r.club);
        set_pdf_data({ ...d, _id: r.fattura.id, _stato: r.fattura.stato });
        set_club(r.club);
        set_email_to(r.fattura.intestatario_email ?? "");
      } catch (e: any) {
        toast({ title: "Errore", description: e?.message, variant: "destructive" });
      } finally {
        set_loading(false);
      }
    })();
  }, [id]);

  async function invia_email() {
    if (!pdf_data || !email_to) return;
    set_sending(true);
    try {
      const { error } = await supabase.functions.invoke("send-fattura-email-atleta", {
        body: { fattura_id: pdf_data._id, destinatario: email_to },
      });
      if (error) throw error;
      toast({ title: "Email inviata" });
      set_email_open(false);
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    } finally {
      set_sending(false);
    }
  }

  if (loading || !pdf_data) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;

  const d = pdf_data;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Fattura {d.numero}</h1>
            <p className="text-sm text-slate-500">{d.periodo || ""} · Emissione {d.data_emissione}</p>
          </div>
          <Badge className={STATO_COLORS[d._stato] || "bg-muted"}>{d._stato}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Intestatario</p>
            <p className="font-semibold">{[d.intestatario.nome, d.intestatario.cognome].filter(Boolean).join(" ") || "—"}</p>
            {d.intestatario.indirizzo && <p>{d.intestatario.indirizzo}</p>}
            {(d.intestatario.cap || d.intestatario.citta) && <p>{[d.intestatario.cap, d.intestatario.citta].filter(Boolean).join(" ")}</p>}
            {d.intestatario.email && <p className="text-slate-500">{d.intestatario.email}</p>}
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Atleta</p>
            <p className="font-semibold">{d.atleta.nome} {d.atleta.cognome}</p>
            {d.atleta.codice && <p className="text-slate-500">Codice {d.atleta.codice}</p>}
            {d.atleta.livello && <p className="text-slate-500">Livello {d.atleta.livello}</p>}
          </div>
        </div>

        <div>
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr><th className="text-left p-2">Descrizione</th><th className="text-right p-2">Qta</th><th className="text-right p-2">Prezzo</th><th className="text-right p-2">Importo</th></tr>
            </thead>
            <tbody>
              {d.righe.map((r: any, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-2">{r.descrizione}</td>
                  <td className="p-2 text-right">{r.quantita ?? 1}</td>
                  <td className="p-2 text-right tabular-nums">{(r.prezzo_unitario ?? r.importo).toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums">{r.importo.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-1">
          <div className="flex justify-between text-sm"><span>Subtotale</span><span className="tabular-nums">CHF {d.subtotale.toFixed(2)}</span></div>
          {d.sconto_importo > 0 && (
            <div className="flex justify-between text-sm text-red-700"><span>Sconto {d.sconto_causale ? `(${d.sconto_causale})` : ""}</span><span className="tabular-nums">−CHF {d.sconto_importo.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
            <span className="font-bold">TOTALE</span>
            <span className="text-2xl font-extrabold tabular-nums text-sky-700">CHF {d.totale.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
          <p className="font-semibold">Riferimento pagamento</p>
          <p>IBAN: <code className="font-mono">{d.club.iban ?? "—"}</code></p>
          {d.club.intestatario_iban && <p>Intestatario: {d.club.intestatario_iban}</p>}
          {d.data_scadenza && <p>Scadenza: {d.data_scadenza}</p>}
        </div>

        {/* 4 BOTTONI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={() => genera_e_apri_pdf(d._id, "stampa")}><Printer className="w-4 h-4 mr-1" /> Stampa</Button>
          <Button variant="outline" onClick={() => genera_e_apri_pdf(d._id, "scarica")}><Download className="w-4 h-4 mr-1" /> Scarica</Button>
          <Button variant="outline" onClick={() => set_email_open(true)}><Mail className="w-4 h-4 mr-1" /> Email</Button>
          {d._stato !== "pagata" && (
            <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => set_pay_open(true)}><CreditCard className="w-4 h-4 mr-1" /> Paga</Button>
          )}
        </div>
      </div>

      <Dialog open={email_open} onOpenChange={set_email_open}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invia fattura per email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="email" value={email_to} onChange={(e) => set_email_to(e.target.value)} placeholder="email@destinatario.ch" />
            <Button className="w-full bg-sky-600 hover:bg-sky-700" onClick={invia_email} disabled={sending || !email_to}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invia"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pay_open} onOpenChange={set_pay_open}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            {club?.twint_qr_url ? (
              <a href={club.twint_qr_url} target="_blank" rel="noreferrer" className="block">
                <img src={club.twint_qr_url} alt="Twint QR" className="w-full max-w-xs mx-auto rounded-xl" />
                <p className="text-center mt-2 text-sky-700 font-semibold">Apri Twint</p>
              </a>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                <p><span className="text-slate-500">IBAN:</span> <code className="font-mono">{d.club.iban ?? "—"}</code></p>
                {d.club.intestatario_iban && <p><span className="text-slate-500">Intestatario:</span> {d.club.intestatario_iban}</p>}
                <p><span className="text-slate-500">Importo:</span> <strong>CHF {d.totale.toFixed(2)}</strong></p>
                <p><span className="text-slate-500">Causale:</span> {d.numero}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FatturaDetailPage;
