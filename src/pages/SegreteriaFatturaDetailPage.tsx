import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, FileText, Send, CheckCircle, XCircle, Loader2, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { load_fattura_full, build_pdf_data, genera_e_apri_pdf, type FatturaFull } from "@/lib/fattura-atleta-helpers";
import type { FatturaAtletaRiga } from "@/lib/fattura-atleta-pdf";

const CAUSALI = ["Pacchetto multiplo", "Secondo figlio", "Sconto fedelta", "Promozionale", "Altro"];

const STATO_COLORS: Record<string, string> = {
  bozza: "bg-slate-100 text-slate-700",
  inviata: "bg-blue-100 text-blue-700",
  pagata: "bg-emerald-100 text-emerald-700",
  scaduta: "bg-red-100 text-red-700",
  annullata: "bg-gray-200 text-gray-500 line-through",
};

const SegreteriaFatturaDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loading, set_loading] = useState(true);
  const [saving, set_saving] = useState(false);
  const [f, set_f] = useState<FatturaFull | null>(null);
  const [atleta, set_atleta] = useState<any>(null);
  const [club, set_club] = useState<any>(null);
  const [righe, set_righe] = useState<FatturaAtletaRiga[]>([]);
  const [sconto_open, set_sconto_open] = useState(false);
  const [sconto_modo, set_sconto_modo] = useState<"importo" | "percentuale">("importo");

  async function reload() {
    set_loading(true);
    try {
      const r = await load_fattura_full(id);
      set_f(r.fattura);
      set_atleta(r.atleta);
      set_club(r.club);
      const rr = Array.isArray(r.fattura.righe) && r.fattura.righe.length > 0
        ? r.fattura.righe
        : [{ descrizione: r.fattura.descrizione || "Voce", quantita: 1, prezzo_unitario: Number(r.fattura.importo || 0), importo: Number(r.fattura.importo || 0) }];
      set_righe(rr);
      set_sconto_modo(Number(r.fattura.sconto_percentuale || 0) > 0 ? "percentuale" : "importo");
      set_sconto_open(Number(r.fattura.sconto_importo_chf || 0) > 0 || Number(r.fattura.sconto_percentuale || 0) > 0);
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    } finally {
      set_loading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  const editable = f?.stato === "bozza";

  const subtotale = useMemo(() => righe.reduce((s, r) => s + Number(r.importo || 0), 0), [righe]);
  const sconto_importo = useMemo(() => {
    if (!f) return 0;
    if (sconto_modo === "percentuale") return +(subtotale * Number(f.sconto_percentuale || 0) / 100).toFixed(2);
    return Number(f.sconto_importo_chf || 0);
  }, [f, subtotale, sconto_modo]);
  const totale = Math.max(0, subtotale - sconto_importo);

  function update_riga(i: number, patch: Partial<FatturaAtletaRiga>) {
    set_righe((r) => r.map((x, idx) => {
      if (idx !== i) return x;
      const next = { ...x, ...patch };
      if (patch.quantita !== undefined || patch.prezzo_unitario !== undefined) {
        next.importo = +((Number(next.quantita ?? 1) * Number(next.prezzo_unitario ?? 0)).toFixed(2));
      }
      return next;
    }));
  }

  async function salva_bozza() {
    if (!f) return;
    set_saving(true);
    try {
      const patch: any = {
        righe,
        importo: totale,
        intestatario_nome: f.intestatario_nome,
        intestatario_cognome: f.intestatario_cognome,
        intestatario_indirizzo: f.intestatario_indirizzo,
        intestatario_cap: f.intestatario_cap,
        intestatario_citta: f.intestatario_citta,
        intestatario_cantone: f.intestatario_cantone,
        intestatario_email: f.intestatario_email,
        sconto_importo_chf: sconto_modo === "importo" ? Number(f.sconto_importo_chf || 0) : 0,
        sconto_percentuale: sconto_modo === "percentuale" ? Number(f.sconto_percentuale || 0) : 0,
        sconto_causale: f.sconto_causale,
        sconto_note: f.sconto_note,
        note: f.note,
      };
      const { error } = await supabase.from("fatture").update(patch).eq("id", f.id);
      if (error) throw error;
      toast({ title: "Bozza salvata" });
      reload();
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  }

  async function cambia_stato(nuovo: string) {
    if (!f) return;
    const patch: any = { stato: nuovo };
    if (nuovo === "pagata") patch.data_pagamento = new Date().toISOString().slice(0, 10);
    if (nuovo === "inviata") patch.data_invio = new Date().toISOString();
    const { error } = await supabase.from("fatture").update(patch).eq("id", f.id);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Stato aggiornato: ${nuovo}` });
    reload();
  }

  async function invia_email() {
    if (!f) return;
    if (!f.intestatario_email) { toast({ title: "Email intestatario mancante", variant: "destructive" }); return; }
    try {
      await salva_bozza();
      const { error } = await supabase.functions.invoke("send-fattura-email-atleta", {
        body: { fattura_id: f.id, destinatario: f.intestatario_email },
      });
      if (error) throw error;
      await cambia_stato("inviata");
      toast({ title: "Fattura inviata via email" });
    } catch (e: any) {
      toast({ title: "Errore invio", description: e?.message, variant: "destructive" });
    }
  }

  if (loading || !f) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Fattura {f.numero || f.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">{f.periodo || ""} · {f.data_emissione || ""}</p>
          </div>
          <Badge className={STATO_COLORS[f.stato] || "bg-muted"}>{f.stato}</Badge>
        </div>

        {/* Intestatario */}
        <div className="border border-border rounded-xl p-4 bg-muted/20">
          <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Intestatario</h3>
          {(!f.intestatario_nome || !f.intestatario_indirizzo || !f.intestatario_cap || !f.intestatario_citta) && (
            <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Intestazione fattura incompleta — completa l'anagrafica del genitore nella scheda atleta e rigenera.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input disabled={!editable} value={f.intestatario_nome ?? ""} onChange={(e) => set_f({ ...f, intestatario_nome: e.target.value })} /></div>
            <div><Label>Cognome</Label><Input disabled={!editable} value={f.intestatario_cognome ?? ""} onChange={(e) => set_f({ ...f, intestatario_cognome: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Indirizzo</Label><Input disabled={!editable} value={f.intestatario_indirizzo ?? ""} onChange={(e) => set_f({ ...f, intestatario_indirizzo: e.target.value })} /></div>
            <div><Label>CAP</Label><Input disabled={!editable} value={f.intestatario_cap ?? ""} onChange={(e) => set_f({ ...f, intestatario_cap: e.target.value })} /></div>
            <div><Label>Città</Label><Input disabled={!editable} value={f.intestatario_citta ?? ""} onChange={(e) => set_f({ ...f, intestatario_citta: e.target.value })} /></div>
            <div><Label>Cantone</Label><Input disabled={!editable} value={f.intestatario_cantone ?? ""} onChange={(e) => set_f({ ...f, intestatario_cantone: e.target.value })} /></div>
            <div><Label>Email</Label><Input disabled={!editable} type="email" value={f.intestatario_email ?? ""} onChange={(e) => set_f({ ...f, intestatario_email: e.target.value })} /></div>
          </div>
        </div>

        {/* Atleta */}
        {atleta && (
          <div className="border border-border rounded-xl p-4">
            <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Atleta</h3>
            <p className="font-medium">{atleta.nome} {atleta.cognome}</p>
            <p className="text-sm text-muted-foreground">
              {atleta.codice_atleta ? `Codice: ${atleta.codice_atleta}` : ""}
              {(atleta.livello_artistica || atleta.livello_stile || atleta.livello_attuale) ? ` · Livello: ${atleta.livello_artistica || atleta.livello_stile || atleta.livello_attuale}` : ""}
            </p>
          </div>
        )}

        {/* Righe */}
        <div className="border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Voci</h3>
            {editable && (
              <Button size="sm" variant="outline" onClick={() => set_righe([...righe, { descrizione: "", quantita: 1, prezzo_unitario: 0, importo: 0 }])}>
                <Plus className="w-3 h-3 mr-1" /> Aggiungi
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {righe.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6"><Label className="text-xs">Descrizione</Label><Input disabled={!editable} value={r.descrizione} onChange={(e) => update_riga(i, { descrizione: e.target.value })} /></div>
                <div className="col-span-1"><Label className="text-xs">Qta</Label><Input disabled={!editable} type="number" step="1" value={r.quantita ?? 1} onChange={(e) => update_riga(i, { quantita: Number(e.target.value) })} /></div>
                <div className="col-span-2"><Label className="text-xs">Prezzo</Label><Input disabled={!editable} type="number" step="0.01" value={r.prezzo_unitario ?? 0} onChange={(e) => update_riga(i, { prezzo_unitario: Number(e.target.value) })} /></div>
                <div className="col-span-2"><Label className="text-xs">Importo</Label><Input disabled value={r.importo.toFixed(2)} /></div>
                {editable && (
                  <div className="col-span-1"><Button size="icon" variant="ghost" onClick={() => set_righe(righe.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4 text-red-500" /></Button></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sconto */}
        <Collapsible open={sconto_open} onOpenChange={set_sconto_open}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-3 border border-border rounded-xl hover:bg-muted/30">
              <span className="font-semibold text-sm">Sconto {sconto_importo > 0 ? `(−CHF ${sconto_importo.toFixed(2)})` : ""}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${sconto_open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border border-t-0 border-border rounded-b-xl p-4 space-y-3">
            <RadioGroup value={sconto_modo} onValueChange={(v) => set_sconto_modo(v as any)} disabled={!editable} className="flex gap-4">
              <label className="flex items-center gap-2"><RadioGroupItem value="importo" /> <span className="text-sm">Importo CHF</span></label>
              <label className="flex items-center gap-2"><RadioGroupItem value="percentuale" /> <span className="text-sm">Percentuale %</span></label>
            </RadioGroup>
            {sconto_modo === "importo" ? (
              <Input disabled={!editable} type="number" step="0.01" value={f.sconto_importo_chf ?? 0} onChange={(e) => set_f({ ...f, sconto_importo_chf: Number(e.target.value) })} placeholder="0.00" />
            ) : (
              <Input disabled={!editable} type="number" step="0.1" max={100} value={f.sconto_percentuale ?? 0} onChange={(e) => set_f({ ...f, sconto_percentuale: Number(e.target.value) })} placeholder="0.0" />
            )}
            <div>
              <Label>Causale</Label>
              <Select disabled={!editable} value={f.sconto_causale ?? ""} onValueChange={(v) => set_f({ ...f, sconto_causale: v })}>
                <SelectTrigger><SelectValue placeholder="Scegli causale" /></SelectTrigger>
                <SelectContent>{CAUSALI.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {f.sconto_causale === "Altro" && (
              <div><Label>Note libere</Label><Textarea disabled={!editable} value={f.sconto_note ?? ""} onChange={(e) => set_f({ ...f, sconto_note: e.target.value })} /></div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Totali */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-1">
          <div className="flex justify-between text-sm"><span>Subtotale</span><span className="tabular-nums">CHF {subtotale.toFixed(2)}</span></div>
          {sconto_importo > 0 && (
            <div className="flex justify-between text-sm text-red-700"><span>Sconto {f.sconto_causale ? `(${f.sconto_causale})` : ""}</span><span className="tabular-nums">−CHF {sconto_importo.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between items-end pt-2 border-t border-border mt-2">
            <span className="font-bold">TOTALE</span>
            <span className="text-2xl font-extrabold tabular-nums text-sky-700">CHF {totale.toFixed(2)}</span>
          </div>
        </div>

        {/* Pagamento info */}
        <div className="border border-border rounded-xl p-4 text-sm">
          <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Riferimento pagamento</h3>
          <p>IBAN: <code className="font-mono">{club?.iban ?? "—"}</code></p>
          {club?.intestatario_iban && <p>Intestatario: {club.intestatario_iban}</p>}
          {club?.twint_qr_url && <p>Twint: disponibile</p>}
          {f.data_scadenza && <p>Scadenza: {f.data_scadenza}</p>}
        </div>

        {/* Azioni */}
        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
          {editable && <Button onClick={salva_bozza} disabled={saving} variant="outline">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva bozza"}</Button>}
          <Button variant="outline" onClick={() => genera_e_apri_pdf(f.id, "apri")}><FileText className="w-4 h-4 mr-1" /> Anteprima PDF</Button>
          {f.stato !== "pagata" && f.stato !== "annullata" && (
            <Button onClick={invia_email} className="bg-sky-600 hover:bg-sky-700"><Send className="w-4 h-4 mr-1" /> Invia</Button>
          )}
          {f.stato === "inviata" && (
            <Button onClick={() => cambia_stato("pagata")} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="w-4 h-4 mr-1" /> Marca pagata</Button>
          )}
          {editable && (
            <Button variant="outline" className="text-red-600" onClick={() => cambia_stato("annullata")}><XCircle className="w-4 h-4 mr-1" /> Annulla</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SegreteriaFatturaDetailPage;
