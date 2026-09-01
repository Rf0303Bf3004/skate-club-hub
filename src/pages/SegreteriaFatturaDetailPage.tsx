import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { segnala_errore, verifica_scrittura } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, FileText, Send, CheckCircle, XCircle, Loader2, ChevronDown, RefreshCw, Undo2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { load_fattura_full, invia_fattura_email, type FatturaFull } from "@/lib/fattura-atleta-helpers";
import type { FatturaAtletaRiga } from "@/lib/fattura-atleta-pdf";
import AnteprimaFatturaAtletaDialog from "@/components/AnteprimaFatturaAtletaDialog";
import { use_annulla_fattura, use_sostituisci_fattura, use_storna_fattura } from "@/hooks/use-supabase-mutations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import ConfirmButton from "@/components/common/ConfirmButton";

type AzioneFattura = "annulla" | "sostituisci" | "storna";

const CAUSALI = ["Pacchetto multiplo", "Secondo figlio", "Sconto fedelta", "Promozionale", "Altro"];

const STATO_COLORS: Record<string, string> = {
  bozza: "bg-slate-100 text-slate-700",
  inviata: "bg-blue-100 text-blue-700",
  sollecitata: "bg-orange-100 text-orange-700",
  pagata: "bg-emerald-100 text-emerald-700",
  scaduta: "bg-red-100 text-red-700",
  annullata: "bg-gray-200 text-gray-500 line-through",
  stornata: "bg-gray-200 text-gray-500 line-through",
};

const SegreteriaFatturaDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const { puo_gestire_fatture } = usePermessiAzione();
  const navigate = useNavigate();
  const [loading, set_loading] = useState(true);
  const [saving, set_saving] = useState(false);
  const [f, set_f] = useState<FatturaFull | null>(null);
  const [preview_open, set_preview_open] = useState(false);
  const [atleta, set_atleta] = useState<any>(null);
  const [club, set_club] = useState<any>(null);
  const [righe, set_righe] = useState<FatturaAtletaRiga[]>([]);
  const [sconto_open, set_sconto_open] = useState(false);
  const [sconto_modo, set_sconto_modo] = useState<"importo" | "percentuale">("importo");
  const [inviando, set_inviando] = useState(false);
  const [azione, set_azione] = useState<AzioneFattura | null>(null);
  const [motivo_azione, set_motivo_azione] = useState("");
  const annulla_fattura = use_annulla_fattura();
  const sostituisci_fattura = use_sostituisci_fattura();
  const storna_fattura = use_storna_fattura();

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

  const editable = f?.stato === "bozza" && puo_gestire_fatture;
  const is_nota_credito = f?.tipo_documento === "nota_credito";

  const subtotale = useMemo(() => righe.reduce((s, r) => s + Number(r.importo || 0), 0), [righe]);
  const sconto_importo = useMemo(() => {
    if (!f) return 0;
    if (sconto_modo === "percentuale") return +(subtotale * Number(f.sconto_percentuale || 0) / 100).toFixed(2);
    return Number(f.sconto_importo_chf || 0);
  }, [f, subtotale, sconto_modo]);
  const totale = subtotale < 0 ? subtotale - sconto_importo : Math.max(0, subtotale - sconto_importo);

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
      const res = await supabase.from("fatture").update(patch).eq("id", f.id).select("id");
      // Verifica anche il caso "nessuna riga toccata": non è un errore, ma non ha fatto nulla.
      const ok = await verifica_scrittura("SegreteriaFatturaDetailPage", "Salvataggio bozza fattura", res, { fattura_id: f.id });
      if (!ok) return;
      toast({ title: "Bozza salvata" });
      reload();
    } catch (e: any) {
      await segnala_errore("SegreteriaFatturaDetailPage", "Salvataggio bozza fattura", e, { fattura_id: f?.id });
    } finally {
      set_saving(false);
    }
  }

  async function cambia_stato(nuovo: string) {
    if (!f) return;
    const patch: any = { stato: nuovo };
    if (nuovo === "pagata") patch.data_pagamento = new Date().toISOString().slice(0, 10);
    const res = await supabase.from("fatture").update(patch).eq("id", f.id).select("id");
    const ok = await verifica_scrittura("SegreteriaFatturaDetailPage", `Cambio stato fattura in ${nuovo}`, res, { fattura_id: f.id });
    if (!ok) return;
    toast({ title: `Stato aggiornato: ${nuovo}` });
    reload();
  }

  async function invia_email() {
    if (!f) return;
    if (!f.intestatario_email) { toast({ title: "Email intestatario mancante", variant: "destructive" }); return; }
    set_inviando(true);
    try {
      if (f.stato === "bozza") await salva_bozza();
      // Congela il PDF in archivio, invia l'email e porta la fattura in stato "inviata".
      await invia_fattura_email(f.id, f.intestatario_email);
      toast({ title: "Fattura inviata via email" });
      reload();
    } catch (e: any) {
      await segnala_errore("SegreteriaFatturaDetailPage", "Invio fattura via email", e, { fattura_id: f?.id });
    } finally {
      set_inviando(false);
    }
  }

  async function esegui_azione() {
    if (!f || !azione) return;
    const motivo = motivo_azione.trim();
    if (!motivo) { toast({ title: "Il motivo è obbligatorio", variant: "destructive" }); return; }
    set_saving(true);
    try {
      if (azione === "annulla") {
        await annulla_fattura.mutateAsync({ fattura_id: f.id, motivo });
        toast({ title: "Fattura annullata" });
        set_azione(null); set_motivo_azione(""); reload();
      } else if (azione === "sostituisci") {
        const nuovo_id = await sostituisci_fattura.mutateAsync({ fattura_id: f.id, motivo });
        toast({ title: "Nuova bozza creata" });
        set_azione(null); set_motivo_azione("");
        navigate(`/segreteria/fatture/${nuovo_id}`);
      } else {
        const nuovo_id = await storna_fattura.mutateAsync({ fattura_id: f.id, motivo });
        toast({ title: "Nota di credito emessa" });
        set_azione(null); set_motivo_azione("");
        navigate(`/segreteria/fatture/${nuovo_id}`);
      }
    } catch (e: any) {
      toast({ title: "Operazione non riuscita", description: e?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  }

  if (loading || !f) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/fatture"))}><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {is_nota_credito ? "Nota di credito" : "Fattura"} {f.numero || f.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-muted-foreground">{f.periodo || ""} · {f.data_emissione || ""}</p>
            {is_nota_credito && f.documento_origine_id && (
              <button
                type="button"
                className="text-sm text-sky-700 underline mt-1"
                onClick={() => navigate(`/segreteria/fatture/${f.documento_origine_id}`)}
              >
                Vai alla fattura stornata
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {is_nota_credito && <Badge className="bg-purple-100 text-purple-700">Nota di credito</Badge>}
            <Badge className={STATO_COLORS[f.stato] || "bg-muted"}>{f.stato}</Badge>
          </div>
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
        <div className="flex flex-wrap gap-2 justify-end items-center pt-2 border-t border-border">
          {f?.stato === "bozza" && !puo_gestire_fatture && (
            <NotaPermesso testo="Solo la segreteria e il presidente possono emettere fatture." />
          )}
          {editable && <Button onClick={salva_bozza} disabled={saving} variant="outline">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva bozza"}</Button>}
          <Button variant="outline" onClick={() => set_preview_open(true)}><FileText className="w-4 h-4 mr-1" /> Anteprima PDF</Button>
          {f.stato !== "pagata" && f.stato !== "annullata" && f.stato !== "stornata" && puo_gestire_fatture && (
            <Button onClick={invia_email} disabled={inviando} className="bg-sky-600 hover:bg-sky-700">
              {inviando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Invia
            </Button>
          )}
          {(f.stato === "inviata" || f.stato === "sollecitata" || f.stato === "scaduta") && puo_gestire_fatture && (
            <ConfirmButton
              titolo={`Marcare come pagata la fattura ${f.numero || f.id.slice(0, 8)}?`}
              descrizione="La fattura verrà registrata come pagata alla data odierna."
              conferma_label="Marca pagata"
              on_conferma={() => cambia_stato("pagata")}
            >
              <Button className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="w-4 h-4 mr-1" /> Marca pagata</Button>
            </ConfirmButton>
          )}
          {f.stato !== "annullata" && f.stato !== "stornata" && puo_gestire_fatture && (
            <>
              <Button variant="outline" className="text-red-600" onClick={() => { set_motivo_azione(""); set_azione("annulla"); }}>
                <XCircle className="w-4 h-4 mr-1" /> Annulla
              </Button>
              <Button variant="outline" onClick={() => { set_motivo_azione(""); set_azione("sostituisci"); }}>
                <RefreshCw className="w-4 h-4 mr-1" /> Sostituisci
              </Button>
              {f.stato === "pagata" && (
                <Button variant="outline" onClick={() => { set_motivo_azione(""); set_azione("storna"); }}>
                  <Undo2 className="w-4 h-4 mr-1" /> Storna
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <AnteprimaFatturaAtletaDialog fattura_id={f.id} open={preview_open} onOpenChange={set_preview_open} />

      <Dialog open={!!azione} onOpenChange={(o) => { if (!o) { set_azione(null); set_motivo_azione(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {azione === "annulla" ? "Annulla fattura" : azione === "sostituisci" ? "Sostituisci fattura" : "Storna fattura"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {azione === "annulla"
                ? "La fattura viene annullata e non sarà più valida."
                : azione === "sostituisci"
                  ? "La fattura viene annullata e ne viene aperta una copia in bozza da correggere."
                  : "Viene emessa una nota di credito a importo negativo collegata a questa fattura."}
            </p>
            <div>
              <Label>Motivo (obbligatorio)</Label>
              <Textarea value={motivo_azione} onChange={(e) => set_motivo_azione(e.target.value)} placeholder="Indica il motivo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { set_azione(null); set_motivo_azione(""); }}>Chiudi</Button>
            <Button onClick={esegui_azione} disabled={saving || !motivo_azione.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SegreteriaFatturaDetailPage;
