import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
  const [v, set_v] = React.useState<PacchettoFormValues>({ ...EMPTY, ...initial });
  React.useEffect(() => { set_v({ ...EMPTY, ...initial }); }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={on_open_change}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifica pacchetto" : "Nuovo pacchetto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Livello (codice)</Label>
              <Input value={v.livello} onChange={(e) => set_v({ ...v, livello: e.target.value })} placeholder="gold" />
            </div>
            <div>
              <Label>Ordine</Label>
              <Input type="number" value={v.ordine} onChange={(e) => set_v({ ...v, ordine: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Nome visualizzato</Label>
            <Input value={v.nome_visualizzato} onChange={(e) => set_v({ ...v, nome_visualizzato: e.target.value })} placeholder="Sponsor Gold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prezzo annuo (CHF)</Label>
              <Input type="number" value={v.prezzo_annuo} onChange={(e) => set_v({ ...v, prezzo_annuo: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Colore brand</Label>
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
            <Label>Benefit (uno per riga)</Label>
            <Textarea
              rows={5}
              value={v.benefits_text}
              onChange={(e) => set_v({ ...v, benefits_text: e.target.value })}
              placeholder={"Logo su maglie gara\nBanner pista"}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>Max sponsor disponibili (vuoto = illimitato)</Label>
              <Input
                type="number"
                value={v.max_sponsor_disponibili ?? ""}
                onChange={(e) => set_v({ ...v, max_sponsor_disponibili: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-3 pb-2">
              <Switch checked={v.attivo} onCheckedChange={(c) => set_v({ ...v, attivo: c })} />
              <Label className="cursor-pointer">Attivo</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => on_open_change(false)}>Annulla</Button>
          <Button onClick={() => on_save(v)} disabled={saving || !v.livello.trim() || !v.nome_visualizzato.trim()}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
