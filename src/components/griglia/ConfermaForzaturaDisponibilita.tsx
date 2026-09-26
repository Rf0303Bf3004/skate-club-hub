import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

/**
 * Un limite avvisa, non vieta: chi può forzare viene invitato a decidere;
 * chi non può viene indirizzato a chi può.
 */
const ConfermaForzaturaDisponibilita: React.FC<Props> = ({
  open,
  motivo,
  orario_label,
  on_close,
  on_forza,
}) => {
  const { t } = useTranslation("planning");
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
            {t("griglia_guida.forza_titolo")}
          </DialogTitle>
          <DialogDescription>
            {orario_label ? `${orario_label} — ` : ""}
            {motivo ?? t("griglia_guida.disp_generico")}
          </DialogDescription>
        </DialogHeader>

        {puo_forzare ? (
          <div className="space-y-2">
            <p className="text-sm">{t("griglia_guida.forza_puoi")}</p>
            <Label className="text-xs">{t("griglia_guida.forza_motivo_label")}</Label>
            <Textarea
              value={testo}
              onChange={(e) => set_testo(e.target.value)}
              placeholder={t("griglia_guida.forza_motivo_esempio")}
              rows={3}
            />
          </div>
        ) : (
          <p className="text-sm">{t("griglia_guida.forza_non_puoi")}</p>
        )}

        <DialogFooter>
          {puo_forzare ? (
            <>
              <Button variant="outline" onClick={on_close}>
                {t("griglia_guida.forza_annulla")}
              </Button>
              <Button disabled={!testo.trim()} onClick={() => on_forza(testo.trim())}>
                {t("griglia_guida.forza_procedi")}
              </Button>
            </>
          ) : (
            <Button onClick={on_close}>{t("griglia_guida.forza_ho_capito")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfermaForzaturaDisponibilita;
