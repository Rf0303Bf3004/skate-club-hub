import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { use_setup_club, use_atleti } from "@/hooks/use-supabase-data";
import {
  use_anteprima_fatture_mese,
  use_genera_fatture_mensili,
} from "@/hooks/use-supabase-mutations";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Calendar, Mail, Eye, FileText, Loader2 } from "lucide-react";

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const FatturazioneTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: setup } = use_setup_club();
  const { data: atleti = [] } = use_atleti();
  const anteprima = use_anteprima_fatture_mese();
  const genera = use_genera_fatture_mensili();

  const oggi = new Date();
  const [giorno, set_giorno] = useState<number>(
    Number((setup as any)?.fatturazione_giorno_mese ?? 1),
  );
  const [email_auto, set_email_auto] = useState<boolean>(
    Boolean((setup as any)?.fatturazione_invio_email_auto ?? false),
  );
  const [costo_test, set_costo_test] = useState<string>(
    String((setup as any)?.fatturazione_costo_test ?? 0),
  );
  const [saving, set_saving] = useState(false);

  const [anno, set_anno] = useState<number>(oggi.getFullYear());
  const [mese, set_mese] = useState<number>(oggi.getMonth() + 1);
  const [preview_rows, set_preview_rows] = useState<any[] | null>(null);

  // Sync quando arriva il setup
  React.useEffect(() => {
    if (setup) {
      set_giorno(Number((setup as any).fatturazione_giorno_mese ?? 1));
      set_email_auto(Boolean((setup as any).fatturazione_invio_email_auto ?? false));
      set_costo_test(String((setup as any).fatturazione_costo_test ?? 0));
    }
  }, [setup]);

  const handle_save = async () => {
    set_saving(true);
    try {
      const club_id = get_current_club_id();
      const giorno_clamped = Math.max(1, Math.min(28, Number(giorno) || 1));
      const payload: any = {
        fatturazione_giorno_mese: giorno_clamped,
        fatturazione_invio_email_auto: email_auto,
        fatturazione_costo_test: Number(costo_test) || 0,
      };
      if ((setup as any)?.id) {
        const { error } = await supabase.from("setup_club").update(payload).eq("id", (setup as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("setup_club").insert({ club_id, ...payload });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["setup_club", club_id] });
      toast({ title: "✅ Impostazioni fatturazione salvate" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const handle_anteprima = async () => {
    try {
      const rows = await anteprima.mutateAsync({ anno, mese });
      set_preview_rows(rows);
      if (rows.length === 0) {
        toast({ title: "Nessuna fattura da generare per questo mese" });
      }
    } catch (err: any) {
      toast({ title: "Errore anteprima", description: err?.message, variant: "destructive" });
    }
  };

  const handle_genera = async () => {
    try {
      const count = await genera.mutateAsync({ anno, mese });
      toast({ title: `✅ ${count} fatture generate per ${MESI[mese - 1]} ${anno}` });
      set_preview_rows(null);
    } catch (err: any) {
      toast({ title: "Errore generazione", description: err?.message, variant: "destructive" });
    }
  };

  const get_atleta_nome = (id: string) => {
    const a = atleti.find((x: any) => x.id === id);
    return a ? `${a.cognome} ${a.nome}` : id.slice(0, 8);
  };

  const totale_anteprima = (preview_rows ?? []).reduce(
    (s, r) => s + Number(r.importo || 0),
    0,
  );

  const anni_options = [oggi.getFullYear() - 1, oggi.getFullYear(), oggi.getFullYear() + 1];

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-3xl">
      {/* Generazione automatica */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Generazione automatica</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Le fatture mensili vengono generate automaticamente nel giorno scelto del mese.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="giorno">Giorno del mese (1-28)</Label>
            <Input
              id="giorno"
              type="number"
              min={1}
              max={28}
              value={giorno}
              onChange={(e) => set_giorno(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="costo_test">Costo per test di livello (CHF)</Label>
            <Input
              id="costo_test"
              type="number"
              min={0}
              step="0.01"
              value={costo_test}
              onChange={(e) => set_costo_test(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <Label htmlFor="email_auto" className="text-sm font-medium">
                Invio email automatico ai genitori
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Quando attivo, ogni fattura generata viene inviata via email al genitore.
            </p>
          </div>
          <Switch id="email_auto" checked={email_auto} onCheckedChange={set_email_auto} />
        </div>

        <Button onClick={handle_save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Salva impostazioni
        </Button>
      </section>

      <Separator />

      {/* Generazione manuale con anteprima */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Generazione manuale con anteprima</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Visualizza in anticipo le fatture che verrebbero generate per un mese specifico, poi conferma.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Mese</Label>
            <Select value={String(mese)} onValueChange={(v) => { set_mese(Number(v)); set_preview_rows(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESI.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Anno</Label>
            <Select value={String(anno)} onValueChange={(v) => { set_anno(Number(v)); set_preview_rows(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {anni_options.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex items-end">
            <Button
              variant="outline"
              onClick={handle_anteprima}
              disabled={anteprima.isPending}
              className="w-full"
            >
              {anteprima.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Anteprima
            </Button>
          </div>
        </div>

        {preview_rows !== null && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Atleta</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Tipo</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Descrizione</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview_rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-sm">
                        Nessuna fattura da generare per {MESI[mese - 1]} {anno}.
                      </td>
                    </tr>
                  ) : (
                    preview_rows.map((r: any, i: number) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-3 py-2 text-foreground">{get_atleta_nome(r.atleta_id)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.tipo}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{r.descrizione}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                          CHF {Number(r.importo).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {preview_rows.length > 0 && (
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-bold text-foreground">Totale</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">
                        CHF {totale_anteprima.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {preview_rows.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handle_genera}
                  disabled={genera.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {genera.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Conferma e genera {preview_rows.length} fatture
                </Button>
                <Button variant="outline" onClick={() => set_preview_rows(null)}>
                  Annulla anteprima
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ℹ️ Il sistema evita duplicati: non vengono ricreate fatture già esistenti per lo stesso atleta, tipo e periodo.
        </p>
      </section>
    </div>
  );
};

export default FatturazioneTab;
