import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_stagioni, use_corsi } from "@/hooks/use-supabase-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

const fmt_date = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("it-CH");
};

const PreSeasonPage = () => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const { data: stagioni = [] } = use_stagioni();
  const { data: corsi = [] } = use_corsi();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nome: "", data_inizio: "", data_fine: "", tipo: "Regolare", stagione_origine: "" });
  const [corsi_selezionati, setCorsiSelezionati] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const corsi_origine = (corsi as any[]).filter((c) => c.stagione_id === form.stagione_origine);

  useEffect(() => {
    setCorsiSelezionati(new Set(corsi_origine.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stagione_origine]);

  const esegui = async () => {
    if (!form.nome || !form.data_inizio || !form.data_fine) {
      toast.error("Compila tutti i campi della stagione");
      return;
    }
    setCreating(true);
    try {
      const { data: nuovaStag, error: e1 } = await supabase.from("stagioni").insert({
        club_id, nome: form.nome, data_inizio: form.data_inizio, data_fine: form.data_fine, tipo: form.tipo, attiva: false,
      } as any).select().single();
      if (e1) throw e1;

      if (corsi_selezionati.size > 0) {
        const da_copiare = corsi_origine.filter((c) => corsi_selezionati.has(c.id));
        const nuovi = da_copiare.map((c) => ({
          club_id,
          stagione_id: nuovaStag.id,
          nome: c.nome,
          tipo: c.tipo,
          categoria: c.categoria,
          giorno: c.giorno,
          ora_inizio: c.ora_inizio,
          ora_fine: c.ora_fine,
          costo_mensile: c.costo_mensile,
          costo_annuale: c.costo_annuale,
          livello_richiesto: c.livello_richiesto,
          usa_ghiaccio: c.usa_ghiaccio,
          attivo: true,
          note: c.note,
        }));
        const { error: e2 } = await supabase.from("corsi").insert(nuovi as any);
        if (e2) throw e2;
      }

      qc.invalidateQueries({ queryKey: ["stagioni"] });
      qc.invalidateQueries({ queryKey: ["corsi"] });
      toast.success(`Pre-stagione creata: ${form.nome} con ${corsi_selezionati.size} corsi copiati`);
      setStep(1);
      setForm({ nome: "", data_inizio: "", data_fine: "", tipo: "Regolare", stagione_origine: "" });
      setCorsiSelezionati(new Set());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Sparkles className="w-8 h-8" /> Pre Season
        </h1>
        <p className="text-muted-foreground mt-1">
          Wizard per la creazione della prossima stagione con copia opzionale della struttura corsi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wizard Nuova Stagione</CardTitle>
          <CardDescription>Configura la prossima stagione copiando la struttura dei corsi dalla stagione precedente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={step >= 1 ? "default" : "outline"}>1. Stagione</Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={step >= 2 ? "default" : "outline"}>2. Copia Corsi</Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={step >= 3 ? "default" : "outline"}>3. Conferma</Badge>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div><Label>Nome stagione</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Es: Stagione 2026/2027" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data inizio</Label><Input type="date" value={form.data_inizio} onChange={(e) => setForm({ ...form, data_inizio: e.target.value })} /></div>
                <div><Label>Data fine</Label><Input type="date" value={form.data_fine} onChange={(e) => setForm({ ...form, data_fine: e.target.value })} /></div>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Regolare">Regolare</SelectItem>
                    <SelectItem value="Estiva">Estiva</SelectItem>
                    <SelectItem value="Invernale">Invernale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setStep(2)} disabled={!form.nome || !form.data_inizio || !form.data_fine}>Avanti →</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <Label>Stagione origine (da cui copiare i corsi)</Label>
                <Select value={form.stagione_origine} onValueChange={(v) => setForm({ ...form, stagione_origine: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona stagione" /></SelectTrigger>
                  <SelectContent>
                    {(stagioni as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.stagione_origine && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{corsi_origine.length} corsi disponibili — seleziona quelli da copiare:</p>
                  <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
                    {corsi_origine.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={corsi_selezionati.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(corsi_selezionati);
                            if (e.target.checked) next.add(c.id); else next.delete(c.id);
                            setCorsiSelezionati(next);
                          }}
                        />
                        <span className="text-sm">{c.nome} {c.giorno && `• ${c.giorno}`} {c.ora_inizio && `• ${c.ora_inizio.slice(0, 5)}`}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>← Indietro</Button>
                <Button onClick={() => setStep(3)}>Avanti →</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-muted/50 p-4 rounded-md space-y-1 text-sm">
                <p><strong>Nome:</strong> {form.nome}</p>
                <p><strong>Periodo:</strong> {fmt_date(form.data_inizio)} → {fmt_date(form.data_fine)}</p>
                <p><strong>Tipo:</strong> {form.tipo}</p>
                <p><strong>Corsi da copiare:</strong> {corsi_selezionati.size}</p>
              </div>
              <p className="text-xs text-muted-foreground">La stagione sarà creata in stato non attivo. Potrai attivarla dalla pagina Stagioni.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>← Indietro</Button>
                <Button onClick={esegui} disabled={creating}><Copy className="w-4 h-4 mr-2" /> {creating ? "Creazione..." : "Crea pre-stagione"}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PreSeasonPage;
