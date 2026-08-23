import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { can_forzare_disponibilita } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import type { ConflittoAtleta } from "@/hooks/use-griglia-ghiaccio";

interface Props {
  open: boolean;
  conflitti: ConflittoAtleta[];
  /** Quanti atleti resterebbero assegnabili escludendo quelli in conflitto. */
  assegnabili: number;
  on_close: () => void;
  /** Procede escludendo gli atleti in conflitto (solo se `assegnabili > 0`). */
  on_solo_liberi?: () => void;
  /** Procede includendo tutti, registrando il motivo della forzatura. */
  on_forza?: (motivo: string) => void;
}

/**
 * Blocco duro sui conflitti orari degli atleti (Fase 5, punti 1 e 3).
 * Stesso modello di override già in uso per disponibilità ghiaccio/istruttori:
 * solo Presidente/DT (o admin) possono forzare, indicando un motivo tracciato.
 */
const ConfermaConflittoAtleti: React.FC<Props> = ({
  open,
  conflitti,
  assegnabili,
  on_close,
  on_solo_liberi,
  on_forza,
}) => {
  const { session } = useAuth();
  const puo_forzare = can_forzare_disponibilita(session?.ruolo);
  const [motivo, set_motivo] = useState("");

  useEffect(() => {
    if (open) set_motivo("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && on_close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Sovrapposizione oraria
          </DialogTitle>
          <DialogDescription>
            {conflitti.length === 1
              ? "Un atleta è già assegnato a un'altra sessione nello stesso orario."
              : `${conflitti.length} atleti sono già assegnati a un'altra sessione nello stesso orario.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-56 overflow-auto rounded-md border divide-y">
          {conflitti.map((c) => (
            <div key={c.atleta_id} className="px-3 py-2 text-sm">
              <span className="font-medium">{c.nome_atleta}</span>
              <span className="text-muted-foreground">
                {" "}
                — {c.ora_inizio}–{c.ora_fine} · {c.etichetta}
              </span>
            </div>
          ))}
        </div>

        {puo_forzare && on_forza ? (
          <div className="space-y-2">
            <Label className="text-xs">Motivo della forzatura *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => set_motivo(e.target.value)}
              placeholder="Es. l'atleta fa metà sessione in un gruppo e metà nell'altro"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Il motivo viene registrato insieme al tuo nome e alla data.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Solo Presidente o Direttore Tecnico possono inserire un atleta in due sessioni sovrapposte.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={on_close}>
            Annulla
          </Button>
          {assegnabili > 0 && on_solo_liberi && (
            <Button variant="secondary" onClick={on_solo_liberi}>
              Aggiungi solo i non in conflitto ({assegnabili})
            </Button>
          )}
          {puo_forzare && on_forza && (
            <Button disabled={!motivo.trim()} onClick={() => on_forza(motivo.trim())}>
              Forza e assegna
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfermaConflittoAtleti;
