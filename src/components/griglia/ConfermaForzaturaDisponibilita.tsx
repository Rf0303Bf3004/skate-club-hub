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

interface Props {
  open: boolean;
  /** Motivo tecnico del blocco (dalla verifica disponibilità) */
  motivo: string | null;
  /** Orario in valutazione, es. "17:00–18:00" (solo informativo) */
  orario_label?: string;
  on_close: () => void;
  /** Chiamato solo se l'utente autorizzato conferma la forzatura */
  on_forza: (motivo_forzatura: string) => void;
}

const ConfermaForzaturaDisponibilita: React.FC<Props> = ({
  open,
  motivo,
  orario_label,
  on_close,
  on_forza,
}) => {
  const { session } = useAuth();
  const puo_forzare = can_forzare_disponibilita(session?.ruolo);
  const [testo, set_testo] = useState("");

  useEffect(() => {
    if (open) set_testo("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && on_close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Orario fuori disponibilità
          </DialogTitle>
          <DialogDescription>
            {orario_label ? `${orario_label} — ` : ""}
            {motivo ?? "L'orario non rientra nella disponibilità dichiarata."}
          </DialogDescription>
        </DialogHeader>

        {puo_forzare ? (
          <div className="space-y-2">
            <Label className="text-xs">Motivo della forzatura *</Label>
            <Textarea
              value={testo}
              onChange={(e) => set_testo(e.target.value)}
              placeholder="Es. accordo straordinario con la gestione della pista"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Il motivo viene registrato insieme al tuo nome e alla data.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Solo Presidente o Direttore Tecnico possono inserire un orario fuori dalla disponibilità
            dichiarata. Modifica l'orario oppure chiedi a loro di procedere.
          </p>
        )}

        <DialogFooter>
          {puo_forzare ? (
            <>
              <Button variant="outline" onClick={on_close}>
                Annulla
              </Button>
              <Button disabled={!testo.trim()} onClick={() => on_forza(testo.trim())}>
                Forza e salva
              </Button>
            </>
          ) : (
            <Button onClick={on_close}>Ho capito</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfermaForzaturaDisponibilita;
