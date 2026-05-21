import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type SezionePitch = "intro" | "storia" | "audience" | "call_to_action" | "contatti";

const LABELS: Record<SezionePitch, string> = {
  intro: "Introduzione",
  storia: "La nostra storia",
  audience: "La nostra audience",
  call_to_action: "Call to action",
  contatti: "Contatti",
};

interface Props {
  open: boolean;
  on_open_change: (v: boolean) => void;
  initial: Record<SezionePitch, string>;
  on_save: (v: Record<SezionePitch, string>) => void;
  saving?: boolean;
}

export const PitchTextEditorDialog: React.FC<Props> = ({ open, on_open_change, initial, on_save, saving }) => {
  const [v, set_v] = React.useState<Record<SezionePitch, string>>(initial);
  React.useEffect(() => { set_v(initial); }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={on_open_change}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica testo Pitch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {(Object.keys(LABELS) as SezionePitch[]).map((k) => (
            <div key={k}>
              <Label>{LABELS[k]}</Label>
              <Textarea
                rows={4}
                value={v[k] ?? ""}
                onChange={(e) => set_v({ ...v, [k]: e.target.value })}
                placeholder="Lascia vuoto per usare il testo di default"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => on_open_change(false)}>Annulla</Button>
          <Button onClick={() => on_save(v)} disabled={saving}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
