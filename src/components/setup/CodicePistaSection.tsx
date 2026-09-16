import React from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmButton from "@/components/common/ConfirmButton";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";

interface Props {
  codice: string | null | undefined;
  /** Il club non è ancora stato letto: non è la stessa cosa di «codice assente». */
  in_caricamento: boolean;
  errore: boolean;
}

/**
 * Codice del tablet di bordo pista. Non è l'accesso di una persona:
 * apre solo la pista del club. Se un tablet si perde, il club lo rigenera
 * e il vecchio codice smette di funzionare all'istante.
 */
const CodicePistaSection: React.FC<Props> = ({ codice, in_caricamento, errore }) => {
  const { t } = useTranslation("settings");
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [in_corso, set_in_corso] = React.useState(false);

  const puo_rigenerare =
    session?.ruolo === "presidente" || session?.ruolo === "admin" || session?.ruolo === "superadmin";

  const rigenera = async () => {
    const club_id = get_current_club_id();
    if (!club_id) {
      toast({ title: t("club.pista.senza_club"), variant: "destructive" });
      return;
    }
    set_in_corso(true);
    try {
      const { data, error } = await supabase.rpc("rigenera_codice_pista", { p_club_id: club_id });
      if (error) {
        await segnala_errore("ClubSetupPage", "rigenera_codice_pista", error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["club"] });
      toast({ title: t("club.pista.rigenerato"), description: String(data ?? "") });
    } finally {
      set_in_corso(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("club.pista.spiegazione")}</p>

      {errore ? (
        <p className="rounded-lg border-2 border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {t("club.pista.errore_lettura")}
        </p>
      ) : in_caricamento ? (
        <p className="text-sm text-muted-foreground">{t("club.pista.caricamento")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-muted px-4 py-3 font-mono text-2xl tracking-widest">
            <Tablet className="h-5 w-5 text-muted-foreground" />
            {codice || t("club.pista.assente")}
          </span>
          {puo_rigenerare && (
            <ConfirmButton
              titolo={t("club.pista.conferma_titolo")}
              descrizione={t("club.pista.conferma_testo")}
              conferma_label={t("club.pista.rigenera")}
              on_conferma={() => void rigenera()}
            >
              <Button variant="outline" disabled={in_corso}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("club.pista.rigenera")}
              </Button>
            </ConfirmButton>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("club.pista.avviso")}</p>
    </div>
  );
};

export default CodicePistaSection;
