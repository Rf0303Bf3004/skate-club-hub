import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const tk = (key: string, opts?: any) => i18n.t(`compenso.${key}`, { ns: "istruttori", ...(opts ?? {}) }) as string;

type TipoContratto = "orario" | "fisso_mensile" | "fisso_corsi" | "misto";

const TIPI: { value: TipoContratto; label_key: string }[] = [
  { value: "orario", label_key: "tipo_orario" },
  { value: "fisso_mensile", label_key: "tipo_fisso_mensile" },
  { value: "fisso_corsi", label_key: "tipo_fisso_corsi" },
  { value: "misto", label_key: "tipo_misto" },
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
  const { t } = useTranslation("istruttori");
  const [tipo, set_tipo] = useState<TipoContratto>("orario");
  const [prezzo_min, set_prezzo_min] = useState("");
  const [costo_lezioni, set_costo_lezioni] = useState("");
  const [costo_corsi, set_costo_corsi] = useState("");
  const [fisso_mensile, set_fisso_mensile] = useState("");
  const [saving, set_saving] = useState(false);
  const [cancelling, set_cancelling] = useState(false);
  const [confirm_cancel, set_confirm_cancel] = useState(false);

  const livello_label = livello === "monitrice" ? t("compenso.livello_monitrice") : t("compenso.livello_aiuto_monitrice");
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
      toast({ title: t("compenso.toast_saved") });
      on_saved();
    } catch (err: any) {
      toast({ title: t("compenso.toast_error"), description: err?.message, variant: "destructive" });
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
            {tk("not_applicable")}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">
          {label} {required ? "*" : <span className="text-muted-foreground font-normal">{tk("optional")}</span>}
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
            {t("compenso.title", { nome: atleta.nome, cognome: atleta.cognome, livello: livello_label })}
          </DialogTitle>
          <DialogDescription>{t("compenso.description")}</DialogDescription>
        </DialogHeader>

        {confirm_cancel ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-foreground">
                {t("compenso.confirm_remove", { livello: livello_label, nome: atleta.nome, cognome: atleta.cognome })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("compenso.confirm_remove_note")}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => set_confirm_cancel(false)} disabled={cancelling}>
                {t("compenso.back")}
              </Button>
              <Button variant="destructive" onClick={handle_cancel_confirm} disabled={cancelling}>
                {cancelling ? "..." : t("compenso.confirm_remove_cta")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("compenso.mode_label")}</Label>
              <RadioGroup value={tipo} onValueChange={(v) => set_tipo(v as TipoContratto)}>
                {TIPI.map((item) => (
                  <div key={item.value} className="flex items-center gap-2">
                    <RadioGroupItem value={item.value} id={`tipo_${item.value}`} />
                    <Label htmlFor={`tipo_${item.value}`} className="cursor-pointer text-sm font-normal">
                      {t(`compenso.${item.label_key}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {renderField(show_prezzo_min, t("compenso.field_prezzo_min"), prezzo_min, set_prezzo_min, t("compenso.field_prezzo_min_ph"), "0.01", req.prezzo_min)}
              {renderField(req.fisso_mensile, t("compenso.field_fisso_mensile"), fisso_mensile, set_fisso_mensile, t("compenso.field_fisso_mensile_ph"), "1")}
              {renderField(req.costo_corsi, t("compenso.field_costo_corsi"), costo_corsi, set_costo_corsi, t("compenso.field_costo_corsi_ph"), "0.5")}
              {renderField(req.costo_lezioni, t("compenso.field_costo_lezioni"), costo_lezioni, set_costo_lezioni, t("compenso.field_costo_lezioni_ph"), "0.5")}
            </div>

            <p className="text-xs text-muted-foreground">
              {t("compenso.required_note")}
            </p>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => set_confirm_cancel(true)} disabled={saving}>
                {t("compenso.cancel")}
              </Button>
              <Button onClick={handle_save} disabled={!can_save || saving} className="bg-primary hover:bg-primary/90">
                {saving ? "..." : t("compenso.save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompensoStaffModal;
