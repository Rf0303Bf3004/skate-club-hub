import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tent, Sparkles, Trophy, Users, Building2, ArrowLeft } from "lucide-react";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";

export type SceltaNuovoEvento = "campo" | "campo_interclub" | "gala" | "gara";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  on_scelta: (scelta: SceltaNuovoEvento) => void;
}

const Scelta: React.FC<{
  icona: React.ReactNode;
  titolo: string;
  descrizione: string;
  onClick: () => void;
}> = ({ icona, titolo, descrizione, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left rounded-lg border bg-card p-4 flex items-start gap-4 hover:border-primary hover:bg-accent/40 transition-colors"
  >
    <span className="mt-0.5 rounded-md bg-primary/10 text-primary p-2 shrink-0">{icona}</span>
    <span className="min-w-0">
      <span className="block font-semibold">{titolo}</span>
      <span className="block text-sm text-muted-foreground">{descrizione}</span>
    </span>
  </button>
);

/** Dialogo guidato: "Che cosa organizzate?" con eventuale domanda sui club invitati. */
const NuovoEventoDialog: React.FC<Props> = ({ open, onOpenChange, on_scelta }) => {
  const { puo_gestire_sportivo } = usePermessiAzione();
  const [passo, set_passo] = useState<1 | 2>(1);

  const chiudi = (v: boolean) => {
    onOpenChange(v);
    if (!v) set_passo(1);
  };

  const scegli = (s: SceltaNuovoEvento) => {
    chiudi(false);
    on_scelta(s);
  };

  return (
    <Dialog open={open} onOpenChange={chiudi}>
      <DialogContent className="max-w-lg">
        {!puo_gestire_sportivo ? (
          <>
            <DialogHeader>
              <DialogTitle>Che cosa organizzate?</DialogTitle>
              <DialogDescription>Non hai i permessi per creare un nuovo evento.</DialogDescription>
            </DialogHeader>
            <NotaPermesso testo="Solo superadmin, admin, presidente, vicepresidente, direttore tecnico o segreteria possono creare eventi." />
          </>
        ) : passo === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Che cosa organizzate?</DialogTitle>
              <DialogDescription>Scegliete il tipo di evento: pensiamo noi al resto.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Scelta
                icona={<Tent className="w-5 h-5" />}
                titolo="Un campo o uno stage"
                descrizione="Più giorni di allenamento, con iscrizioni e pacchetti"
                onClick={() => set_passo(2)}
              />
              <Scelta
                icona={<Sparkles className="w-5 h-5" />}
                titolo="Un galà o uno spettacolo"
                descrizione="Un evento con pubblico, prove e comunicazioni"
                onClick={() => scegli("gala")}
              />
              <Scelta
                icona={<Trophy className="w-5 h-5" />}
                titolo="Una gara"
                descrizione="Una competizione da inserire nel calendario gare"
                onClick={() => scegli("gara")}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Partecipano anche altri club?</DialogTitle>
              <DialogDescription>Potete cambiare idea anche più avanti.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Scelta
                icona={<Building2 className="w-5 h-5" />}
                titolo="No, solo il nostro club"
                descrizione="Un campo riservato ai vostri atleti"
                onClick={() => scegli("campo")}
              />
              <Scelta
                icona={<Users className="w-5 h-5" />}
                titolo="Sì, invitiamo altri club"
                descrizione="Dopo il salvataggio si apre la schermata per invitare i club ospiti"
                onClick={() => scegli("campo_interclub")}
              />
            </div>
            <div>
              <Button variant="ghost" size="sm" onClick={() => set_passo(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NuovoEventoDialog;
