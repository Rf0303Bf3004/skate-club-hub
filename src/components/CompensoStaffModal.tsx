import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

type TipoContratto = "orario" | "fisso_mensile" | "fisso_corsi" | "misto";

const TIPI: { value: TipoContratto; label: string }[] = [
  { value: "orario", label: "A ore" },
  { value: "fisso_mensile", label: "Fisso mensile" },
  { value: "fisso_corsi", label: "Fisso corsi + variabile lezioni private" },
  { value: "misto", label: "Fisso mensile + variabile lezioni private" },
];

// Mappa obbligatorietà campi per modalità
const REQUIRED: Record<TipoContratto, {
  prezzo_min: boolean;
  costo_corsi: boolean;
  costo_lezioni: boolean;
  fisso_mensile: boolean;
}> = {
  orario:        { prezzo_min: true,  costo_corsi: true,  costo_lezioni: false, fisso_mensile: false },
  fisso_mensile: { prezzo_min: false, costo_corsi: false, costo_lezioni: false, fisso_mensile: true  },
  fisso_corsi:   { prezzo_min: true,  costo_corsi: true,  costo_lezioni: true,  fisso_mensile: false },
  misto:         { prezzo_min: true,  costo_corsi: false, costo_lezioni: true,  fisso_mensile: true  },
};

function to_num(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

interface Props {
  open: boolean;
  atleta: { id: string; nome: string; cognome: string };
  livello: "monitrice" | "aiuto_monitrice";
  on_saved: () => void;
  on_cancel: () => Promise<void> | void;
}

export const CompensoStaffModal: React.FC<Props> = ({ open, atleta, livello, on_saved, on_cancel }) => {
  const [tipo, set_tipo] = useState<TipoContratto>("orario");
  const [prezzo_min, set_prezzo_min] = useState("");
  const [costo_lezioni, set_costo_lezioni] = useState("");
  const [costo_corsi, set_costo_corsi] = useState("");
  const [fisso_mensile, set_fisso_mensile] = useState("");
  const [saving, set_saving] = useState(false);
  const [cancelling, set_cancelling] = useState(false);
  const [confirm_cancel, set_confirm_cancel] = useState(false);

  const livello_label = livello === "monitrice" ? "Monitrice" : "Aiuto monitrice";
  const base_req = REQUIRED[tipo];
  // Le aiuto-monitrici di solito affiancano in lezioni collettive senza prezzo di vendita al minuto:
  // rendiamo prezzo_min sempre opzionale per loro (resta visibile, ma non blocca il salvataggio).
  const req = {
    ...base_req,
    prezzo_min: livello === "aiuto_monitrice" ? false : base_req.prezzo_min,
  };
  const show_prezzo_min = base_req.prezzo_min; // visibilità invariata in base alla modalità

  const can_save = useMemo(() => {
    if (req.prezzo_min && !(to_num(prezzo_min) ?? 0) ) return false;
    if (req.costo_corsi && !(to_num(costo_corsi) ?? 0)) return false;
    if (req.costo_lezioni && !(to_num(costo_lezioni) ?? 0)) return false;
    if (req.fisso_mensile && !(to_num(fisso_mensile) ?? 0)) return false;
    return true;
  }, [req, prezzo_min, costo_corsi, costo_lezioni, fisso_mensile]);

  const handle_save = async () => {
    set_saving(true);
    try {
      // Salva NULL per campi non applicabili alla modalità scelta
      const payload: Record<string, unknown> = {
        tipo_contratto: tipo,
        costo_minuto_lezione_privata: show_prezzo_min ? to_num(prezzo_min) : null,
        costo_orario_corsi: req.costo_corsi ? to_num(costo_corsi) : null,
        costo_orario_lezioni: req.costo_lezioni ? to_num(costo_lezioni) : null,
        compenso_fisso_mensile: req.fisso_mensile ? to_num(fisso_mensile) : null,
        compenso_fisso_corsi: null,
      };
      const { error } = await supabase
        .from("istruttori")
        .update(payload as any)
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

  const renderField = (
    show: boolean,
    label: string,
    value: string,
    setter: (v: string) => void,
    placeholder?: string,
    step = "0.01",
    required = true,
  ) => {
    if (!show) {
      return (
        <div className="space-y-1.5 opacity-50">
          <Label className="text-xs">{label}</Label>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground italic">
            non applicabile per questa modalità
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">
          {label} {required ? "*" : <span className="text-muted-foreground font-normal">(opzionale)</span>}
        </Label>
        <input
          type="number"
          step={step}
          min="0"
          value={value}
          onChange={(e) => setter(e.target.value)}
          className={input_cls}
          placeholder={placeholder}
        />
      </div>
    );
  };

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
              <RadioGroup value={tipo} onValueChange={(v) => set_tipo(v as TipoContratto)}>
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
              {renderField(show_prezzo_min, "Prezzo vendita (CHF/min)", prezzo_min, set_prezzo_min, "es. 0.50", "0.01", req.prezzo_min)}
              {renderField(req.fisso_mensile, "Compenso fisso mensile (CHF)", fisso_mensile, set_fisso_mensile, "es. 800", "1")}
              {renderField(req.costo_corsi, "Costo interno corsi (CHF/h)", costo_corsi, set_costo_corsi, "es. 18", "0.5")}
              {renderField(req.costo_lezioni, "Costo interno lezioni private (CHF/h)", costo_lezioni, set_costo_lezioni, "es. 20", "0.5")}
            </div>

            <p className="text-xs text-muted-foreground">
              Solo i campi contrassegnati con * per la modalità scelta sono obbligatori. Gli altri vengono salvati come NULL.
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
