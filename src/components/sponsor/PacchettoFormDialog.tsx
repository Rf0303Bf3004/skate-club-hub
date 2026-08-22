import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

export interface PacchettoFormValues {
  id?: string;
  livello: string;
  nome_visualizzato: string;
  prezzo_annuo: number;
  ordine: number;
  colore_brand: string;
  benefits_text: string;
  max_sponsor_disponibili: number | null;
  attivo: boolean;
}

interface Props {
  open: boolean;
  on_open_change: (v: boolean) => void;
  initial?: Partial<PacchettoFormValues>;
  on_save: (v: PacchettoFormValues) => void;
  saving?: boolean;
}

const EMPTY: PacchettoFormValues = {
  livello: "",
  nome_visualizzato: "",
  prezzo_annuo: 0,
  ordine: 99,
  colore_brand: "#3B82F6",
  benefits_text: "",
  max_sponsor_disponibili: null,
  attivo: true,
};

export const PacchettoFormDialog: React.FC<Props> = ({ open, on_open_change, initial, on_save, saving }) => {
  const { t } = useTranslation("settings");
  const [v, set_v] = React.useState<PacchettoFormValues>({ ...EMPTY, ...initial });
  React.useEffect(() => { set_v({ ...EMPTY, ...initial }); }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={on_open_change}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? t("sponsor.pacchetto_form.title_edit") : t("sponsor.pacchetto_form.title_new")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("sponsor.pacchetto_form.livello")}</Label>
              <Input value={v.livello} onChange={(e) => set_v({ ...v, livello: e.target.value })} placeholder={t("sponsor.pacchetto_form.livello_placeholder")} />
            </div>
            <div>
              <Label>{t("sponsor.pacchetto_form.ordine")}</Label>
              <Input type="number" value={v.ordine} onChange={(e) => set_v({ ...v, ordine: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>{t("sponsor.pacchetto_form.nome_visualizzato")}</Label>
            <Input value={v.nome_visualizzato} onChange={(e) => set_v({ ...v, nome_visualizzato: e.target.value })} placeholder={t("sponsor.pacchetto_form.nome_placeholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("sponsor.pacchetto_form.prezzo_annuo")}</Label>
              <Input type="number" value={v.prezzo_annuo} onChange={(e) => set_v({ ...v, prezzo_annuo: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("sponsor.pacchetto_form.colore_brand")}</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={v.colore_brand}
                  onChange={(e) => set_v({ ...v, colore_brand: e.target.value })}
                  className="h-10 w-12 rounded border border-input cursor-pointer"
                />
                <Input value={v.colore_brand} onChange={(e) => set_v({ ...v, colore_brand: e.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <Label>{t("sponsor.pacchetto_form.benefits")}</Label>
            <Textarea
              rows={5}
              value={v.benefits_text}
              onChange={(e) => set_v({ ...v, benefits_text: e.target.value })}
              placeholder={t("sponsor.pacchetto_form.benefits_placeholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>{t("sponsor.pacchetto_form.max_sponsor")}</Label>
              <Input
                type="number"
                value={v.max_sponsor_disponibili ?? ""}
                onChange={(e) => set_v({ ...v, max_sponsor_disponibili: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-3 pb-2">
              <Switch checked={v.attivo} onCheckedChange={(c) => set_v({ ...v, attivo: c })} />
              <Label className="cursor-pointer">{t("sponsor.pacchetto_form.attivo")}</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => on_open_change(false)}>{t("sponsor.pacchetto_form.annulla")}</Button>
          <Button onClick={() => on_save(v)} disabled={saving || !v.livello.trim() || !v.nome_visualizzato.trim()}>
            {t("sponsor.pacchetto_form.salva")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
