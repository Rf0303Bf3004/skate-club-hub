import React, { useEffect, useMemo, useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_club, use_setup_club } from "@/hooks/use-supabase-data";
import { FatturaAtletaDocument, type FatturaAtletaData } from "@/lib/fattura-atleta-pdf";
import { FileText, Loader2 } from "lucide-react";

const DEFAULT_ACCENTO = "#1e3a8a";

const FatturaLayoutSection: React.FC = () => {
  const { data: club } = use_club();
  const { data: setup } = use_setup_club();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mostra_logo, set_mostra_logo] = useState(false);
  const [colore_accento, set_colore_accento] = useState<string | null>(null);
  const [mostra_iban, set_mostra_iban] = useState(true);
  const [note_legali, set_note_legali] = useState("");
  const [prefisso, set_prefisso] = useState("");
  const [footer_testo, set_footer_testo] = useState("");
  const [saving, set_saving] = useState(false);

  useEffect(() => {
    if (!setup) return;
    const s = setup as any;
    set_mostra_logo(!!s.fattura_mostra_logo);
    set_colore_accento(s.fattura_colore_accento ?? null);
    set_mostra_iban(s.fattura_mostra_iban !== false);
    set_note_legali(s.fattura_note_legali ?? "");
    set_prefisso(s.fattura_prefisso_numero ?? "");
    set_footer_testo(s.fattura_footer_testo ?? "");
  }, [setup]);

  const has_logo = !!(club as any)?.logo_url;

  const salva = async () => {
    const club_id = get_current_club_id();
    if (!club_id) return;
    set_saving(true);
    try {
      const payload = {
        fattura_mostra_logo: mostra_logo,
        fattura_colore_accento: colore_accento || null,
        fattura_mostra_iban: mostra_iban,
        fattura_note_legali: note_legali.trim() || null,
        fattura_footer_testo: footer_testo.trim() || null,
        fattura_prefisso_numero: prefisso.trim() || "F-",
      };
      if ((setup as any)?.id) {
        const { error } = await supabase.from("setup_club").update(payload).eq("id", (setup as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("setup_club").insert({ club_id, ...payload });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["setup_club", club_id] });
      toast({ title: "Layout fattura salvato" });
    } catch (e: any) {
      toast({ title: "Errore nel salvataggio", description: e?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const anteprima: FatturaAtletaData = useMemo(() => {
    const c = (club as any) || {};
    const s = (setup as any) || {};
    return {
      numero: `${(prefisso.trim() || "F-")}0001`,
      periodo: "Esempio",
      data_emissione: new Date().toISOString().slice(0, 10),
      data_scadenza: null,
      righe: [{ descrizione: "Corso di prova", quantita: 1, prezzo_unitario: 80, importo: 80 }],
      subtotale: 80,
      sconto_importo: 0,
      sconto_causale: null,
      sconto_note: null,
      totale: 80,
      note: null,
      intestatario: {
        nome: "Mario",
        cognome: "Rossi",
        indirizzo: "Via Esempio 1",
        cap: "6900",
        citta: "Lugano",
        cantone: "TI",
        email: "mario.rossi@example.com",
      },
      atleta: { nome: "Mario", cognome: "Rossi", codice: "ROSSI0001", livello: null },
      club: {
        nome: c.nome ?? "Club",
        logo_url: c.logo_url ?? null,
        indirizzo: c.indirizzo ?? null,
        cap: c.cap ?? null,
        citta: c.citta ?? null,
        cantone: c.cantone ?? null,
        email: c.email ?? null,
        telefono: c.telefono ?? null,
        partita_iva: c.partita_iva ?? null,
        numero_iva_chf: c.numero_iva_chf ?? null,
        iban: s.iban ?? null,
        intestatario_iban: s.intestatario_conto ?? null,
        twint_qr_url: s.twint_paylink ?? null,
        fattura_mostra_logo: mostra_logo,
        fattura_colore_accento: colore_accento,
        fattura_mostra_iban: mostra_iban,
        fattura_note_legali: note_legali.trim() || null,
        fattura_footer_testo: footer_testo.trim() || null,
      },
    };
  }, [club, setup, mostra_logo, colore_accento, mostra_iban, note_legali, footer_testo, prefisso]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4" />
          Layout fattura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Mostra logo in fattura</Label>
            {!has_logo && (
              <p className="text-xs text-muted-foreground mt-1">
                Nessun logo caricato — impostalo in Configurazione → Logo Club.
              </p>
            )}
          </div>
          <Switch checked={mostra_logo} onCheckedChange={set_mostra_logo} disabled={!has_logo} />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Colore accento fattura</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colore_accento || DEFAULT_ACCENTO}
              onChange={(e) => set_colore_accento(e.target.value)}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{colore_accento || `${DEFAULT_ACCENTO} (default)`}</span>
            {colore_accento && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set_colore_accento(null)}>
                Ripristina default
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <Label>Mostra IBAN in fattura</Label>
          <Switch checked={mostra_iban} onCheckedChange={set_mostra_iban} />
        </div>

        <div className="space-y-2">
          <Label>Note legali (facoltativo)</Label>
          <Textarea rows={3} value={note_legali} onChange={(e) => set_note_legali(e.target.value)} />
          {note_legali.trim() && (
            <p className="text-xs text-muted-foreground">Verrà stampata una sezione "Note legali" in fondo alla fattura.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Prefisso numerazione fatture</Label>
          <Input placeholder="F-" value={prefisso} onChange={(e) => set_prefisso(e.target.value)} className="max-w-[180px]" />
        </div>

        <div className="space-y-2">
          <Label>Testo footer personalizzato (facoltativo)</Label>
          <Textarea rows={2} value={footer_testo} onChange={(e) => set_footer_testo(e.target.value)} />
          <p className="text-xs text-muted-foreground">Se vuoto, resta il footer attuale (nome club · P.IVA · email).</p>
        </div>

        <Button onClick={salva} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salva layout fattura
        </Button>

        <div className="space-y-2">
          <Label>Anteprima live</Label>
          <div className="border border-border rounded-lg overflow-hidden" style={{ height: 500 }}>
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              <FatturaAtletaDocument data={anteprima} />
            </PDFViewer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FatturaLayoutSection;
