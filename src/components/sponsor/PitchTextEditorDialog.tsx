import React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type SezionePitch = "intro" | "storia" | "audience" | "call_to_action" | "contatti";

// Mappa sezioni → chiave di traduzione (non DB enum). Le label visibili passano per i18n.
const SECTION_KEYS: Record<SezionePitch, string> = {
  intro: "pitch.sections.intro",
  storia: "pitch.sections.storia",
  audience: "pitch.sections.audience",
  call_to_action: "pitch.sections.call_to_action",
  contatti: "pitch.sections.contatti",
};

interface Props {
  open: boolean;
  on_open_change: (v: boolean) => void;
  initial: Record<SezionePitch, string>;
  on_save: (v: Record<SezionePitch, string>) => void;
  saving?: boolean;
}

// Etichette inline localizzate (non ancora in JSON namespace dedicato: testi specifici area sponsor).
// Il refactor completo del namespace 'sponsor' è tracciato in I18N_TODO.md.
const FALLBACK_LABELS: Record<SezionePitch, string> = {
  intro: "Introduzione",
  storia: "La nostra storia",
  audience: "La nostra audience",
  call_to_action: "Call to action",
  contatti: "Contatti",
};

export const PitchTextEditorDialog: React.FC<Props> = ({ open, on_open_change, initial, on_save, saving }) => {
  const { t } = useTranslation('common');
  const [v, set_v] = React.useState<Record<SezionePitch, string>>(initial);
  React.useEffect(() => { set_v(initial); }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={on_open_change}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica testo Pitch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {(Object.keys(SECTION_KEYS) as SezionePitch[]).map((k) => (
            <div key={k}>
              <Label>{FALLBACK_LABELS[k]}</Label>
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
          <Button variant="outline" onClick={() => on_open_change(false)}>{t('actions.cancel')}</Button>
          <Button onClick={() => on_save(v)} disabled={saving}>{t('actions.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
