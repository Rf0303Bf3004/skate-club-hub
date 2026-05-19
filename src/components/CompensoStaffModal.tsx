import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

const TIPI = [
  { value: "orario", label: "A ore (costo al minuto)" },
  { value: "fisso_mensile", label: "Fisso mensile" },
  { value: "fisso_corsi", label: "Fisso corsi + variabile lezioni private" },
  { value: "misto", label: "Fisso mensile + variabile lezioni private" },
];

function to_num(v: string): number {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

interface Props {
  open: boolean;
  atleta: { id: string; nome: string; cognome: string };
  livello: "monitrice" | "aiuto_monitrice";
  on_saved: () => void;
  on_cancel: () => Promise<void> | void;
}

export const CompensoStaffModal: React.FC<Props> = ({ open, atleta, livello, on_saved, on_cancel }) => {
  const [tipo, set_tipo] = useState("orario");
  const [prezzo_min, set_prezzo_min] = useState("");
  const [costo_lezioni, set_costo_lezioni] = useState("");
  const [costo_corsi, set_costo_corsi] = useState("");
  const [fisso_mensile, set_fisso_mensile] = useState("");
  const [fisso_corsi, set_fisso_corsi] = useState("");
  const [saving, set_saving] = useState(false);
  const [cancelling, set_cancelling] = useState(false);
  const [confirm_cancel, set_confirm_cancel] = useState(false);

  const livello_label = livello === "monitrice" ? "Monitrice" : "Aiuto monitrice";

  // Validazione: campi minimi obbligatori per modalità
  const needs_prezzo_min = tipo === "orario" || tipo === "fisso_corsi" || tipo === "misto";
  const needs_fisso_mensile = tipo === "fisso_mensile" || tipo === "misto";
  const needs_fisso_corsi = tipo === "fisso_corsi";

  const can_save =
    (!needs_prezzo_min || to_num(prezzo_min) > 0) &&
    (!needs_fisso_mensile || to_num(fisso_mensile) > 0) &&
    (!needs_fisso_corsi || to_num(fisso_corsi) > 0) &&
    (to_num(costo_lezioni) > 0 || to_num(costo_corsi) > 0);

  const handle_save = async () => {
    set_saving(true);
    try {
      const { error } = await supabase
        .from("istruttori")
        .update({
          tipo_contratto: tipo,
          costo_minuto_lezione_privata: to_num(prezzo_min),
          costo_orario_lezioni: to_num(costo_lezioni),
          costo_orario_corsi: to_num(costo_corsi),
          compenso_fisso_mensile: to_num(fisso_mensile),
          compenso_fisso_corsi: to_num(fisso_corsi),
        } as any)
        .eq("linked_atleta_id", atleta.id);
      if (error) throw error;
      toast({ title: "✅ Compenso salvato" });
      on_saved();
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const handle_cancel_confirm = async () => {
    set_cancelling(true);
    try {
      await on_cancel();
    } finally {
      set_cancelling(false);
    }
  };

  const input_cls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            Imposta compenso per {atleta.nome} {atleta.cognome} ({livello_label})
          </DialogTitle>
          <DialogDescription>I dati di compenso sono obbligatori prima di chiudere</DialogDescription>
        </DialogHeader>

        {confirm_cancel ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-foreground">
                Annullando, il ruolo "{livello_label}" verrà rimosso da {atleta.nome} {atleta.cognome}.
              </p>
              <p className="text-xs text-muted-foreground mt-1">L'atleta resterà nel club, ma non sarà più staff.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => set_confirm_cancel(false)} disabled={cancelling}>
                Indietro
              </Button>
              <Button variant="destructive" onClick={handle_cancel_confirm} disabled={cancelling}>
                {cancelling ? "..." : "Sì, rimuovi ruolo"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Modalità compenso</Label>
              <RadioGroup value={tipo} onValueChange={set_tipo}>
                {TIPI.map((t) => (
                  <div key={t.value} className="flex items-center gap-2">
                    <RadioGroupItem value={t.value} id={`tipo_${t.value}`} />
                    <Label htmlFor={`tipo_${t.value}`} className="cursor-pointer text-sm font-normal">
                      {t.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {needs_prezzo_min && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Prezzo vendita (CHF/min) *</Label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prezzo_min}
                    onChange={(e) => set_prezzo_min(e.target.value)}
                    className={input_cls}
                    placeholder="es. 0.50"
                  />
                </div>
              )}
              {needs_fisso_mensile && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Compenso fisso mensile (CHF) *</Label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={fisso_mensile}
                    onChange={(e) => set_fisso_mensile(e.target.value)}
                    className={input_cls}
                  />
                </div>
              )}
              {needs_fisso_corsi && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Compenso fisso corsi (CHF) *</Label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={fisso_corsi}
                    onChange={(e) => set_fisso_corsi(e.target.value)}
                    className={input_cls}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Costo interno lezioni private (CHF/h)</Label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={costo_lezioni}
                  onChange={(e) => set_costo_lezioni(e.target.value)}
                  className={input_cls}
                  placeholder="es. 20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Costo interno corsi e altro (CHF/h)</Label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={costo_corsi}
                  onChange={(e) => set_costo_corsi(e.target.value)}
                  className={input_cls}
                  placeholder="es. 18"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              * Almeno un costo orario interno (lezioni o corsi) deve essere &gt; 0
            </p>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => set_confirm_cancel(true)} disabled={saving}>
                Annulla
              </Button>
              <Button onClick={handle_save} disabled={!can_save || saving} className="bg-primary hover:bg-primary/90">
                {saving ? "..." : "💾 Salva compenso"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompensoStaffModal;
