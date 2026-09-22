import React from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";
import { use_qr_data_url } from "@/hooks/use-qr-data-url";

interface Props {
  slug: string | null | undefined;
  attivo: boolean | null | undefined;
  /** Il club non è ancora stato letto: non è la stessa cosa di «senza indirizzo». */
  in_caricamento: boolean;
  errore: boolean;
}

/**
 * Indirizzo pubblico del calendario del club: si apre senza codice e senza
 * accesso. Mostra solo orari, attività e pista, mai nomi di persone.
 */
const CalendarioPubblicoSection: React.FC<Props> = ({ slug, attivo, in_caricamento, errore }) => {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [in_corso, set_in_corso] = React.useState(false);
  const [copiato, set_copiato] = React.useState(false);

  const indirizzo =
    slug && typeof window !== "undefined" ? `${window.location.origin}/calendario/${slug}` : "";
  const indirizzo_leggibile =
    slug && typeof window !== "undefined" ? `${window.location.host}/calendario/${slug}` : "";
  const qr = use_qr_data_url(attivo ? indirizzo : "", 320);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(indirizzo);
      set_copiato(true);
      window.setTimeout(() => set_copiato(false), 2000);
    } catch {
      toast({ title: t("club.calendario_pubblico.copia_fallita"), variant: "destructive" });
    }
  };

  const cambia = async (nuovo: boolean) => {
    const club_id = get_current_club_id();
    if (!club_id) {
      toast({ title: t("club.pista.senza_club"), variant: "destructive" });
      return;
    }
    set_in_corso(true);
    try {
      const { error } = await supabase
        .from("clubs")
        .update({ calendario_pubblico_attivo: nuovo })
        .eq("id", club_id);
      if (error) {
        await segnala_errore("ClubSetupPage", "calendario_pubblico_attivo", error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["club"] });
      toast({ title: nuovo ? t("club.calendario_pubblico.acceso") : t("club.calendario_pubblico.spento") });
    } finally {
      set_in_corso(false);
    }
  };

  if (errore) {
    return (
      <p className="rounded-lg border-2 border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        {t("club.calendario_pubblico.errore_lettura")}
      </p>
    );
  }

  if (in_caricamento) {
    return <p className="text-sm text-muted-foreground">{t("club.calendario_pubblico.caricamento")}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("club.calendario_pubblico.spiegazione")}</p>
      <p className="text-sm text-muted-foreground">{t("club.calendario_pubblico.cosa_si_vede")}</p>

      <div className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-4">
        <Switch
          id="calendario_pubblico_attivo"
          checked={!!attivo}
          disabled={in_corso}
          onCheckedChange={(v) => void cambia(v)}
        />
        <Label htmlFor="calendario_pubblico_attivo" className="text-sm font-medium">
          {t("club.calendario_pubblico.interruttore")}
        </Label>
      </div>

      {!slug ? (
        <p className="text-sm text-muted-foreground">{t("club.calendario_pubblico.senza_indirizzo")}</p>
      ) : !attivo ? (
        <p className="text-sm text-muted-foreground">{t("club.calendario_pubblico.spento_nota")}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="break-all rounded-xl border-2 border-border bg-muted px-4 py-3 font-mono text-base">
              {indirizzo_leggibile}
            </span>
            <Button variant="outline" onClick={() => void copia()}>
              {copiato ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copiato ? t("club.calendario_pubblico.copiato") : t("club.calendario_pubblico.copia")}
            </Button>
          </div>

          {qr && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-border bg-card p-4">
              <img
                src={qr}
                alt={t("club.calendario_pubblico.qr_alt")}
                width={240}
                height={240}
                className="h-60 w-60 rounded-lg bg-white p-2"
              />
              <div className="min-w-[16rem] flex-1 space-y-2">
                <p className="text-sm font-medium">{t("club.calendario_pubblico.qr_istruzione")}</p>
                <p className="text-sm text-muted-foreground">{t("club.calendario_pubblico.differenza_pista")}</p>
                <p className="break-all font-mono text-xs text-muted-foreground">{indirizzo}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarioPubblicoSection;
