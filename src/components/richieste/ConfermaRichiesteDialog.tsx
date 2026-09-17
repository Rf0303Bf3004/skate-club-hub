import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { use_gestione_richieste, type RichiestaDaGestire } from "@/hooks/use-richieste-iscrizione";

/**
 * Finestra di conferma condivisa fra la pagina Richieste e la home della
 * segreteria: una sola versione della conferma e della nota di risposta.
 */
interface Props {
  richieste: RichiestaDaGestire[];
  azione: "approvata" | "rifiutata";
  /** Chiusura senza azione: Annulla, Esc o clic fuori. Non tocca la selezione. */
  on_close: () => void;
  /** Chiamato solo dopo un'azione riuscita: qui si svuota la selezione. */
  on_done: () => void;
}

const ConfermaRichiesteDialog: React.FC<Props> = ({ richieste, azione, on_close, on_done }) => {
  const { t } = useTranslation("atleti");
  const { esegui, is_pending } = use_gestione_richieste();
  const [note_risposta, set_note_risposta] = useState("");

  const conferma = async () => {
    await esegui(richieste, azione, note_risposta);
    on_done();
  };

  return (
    <Dialog open onOpenChange={() => !is_pending && on_close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {azione === "approvata"
              ? t("richieste_iscrizione.modal.approva_title")
              : t("richieste_iscrizione.modal.rifiuta_title")}
            {richieste.length > 1 ? ` (${richieste.length})` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {azione === "approvata"
              ? t(richieste.length > 1 ? "richieste_iscrizione.modal.approva_desc_plural" : "richieste_iscrizione.modal.approva_desc_singular")
              : t(richieste.length > 1 ? "richieste_iscrizione.modal.rifiuta_desc_plural" : "richieste_iscrizione.modal.rifiuta_desc_singular")}
          </p>
          <div>
            <Label className="text-xs">{t("richieste_iscrizione.modal.note_label")}</Label>
            <Input
              value={note_risposta}
              onChange={(e) => set_note_risposta(e.target.value)}
              placeholder={
                azione === "rifiutata"
                  ? t("richieste_iscrizione.modal.note_placeholder_rifiuto")
                  : t("richieste_iscrizione.modal.note_placeholder_generico")
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={on_close} disabled={is_pending} type="button">
            {t("richieste_iscrizione.modal.annulla")}
          </Button>
          <Button
            onClick={conferma}
            disabled={is_pending}
            className={azione === "approvata" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            variant={azione === "rifiutata" ? "destructive" : "default"}
          >
            {is_pending
              ? t("richieste_iscrizione.modal.elaborazione")
              : azione === "approvata"
                ? t("richieste_iscrizione.modal.approva")
                : t("richieste_iscrizione.modal.rifiuta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfermaRichiesteDialog;
