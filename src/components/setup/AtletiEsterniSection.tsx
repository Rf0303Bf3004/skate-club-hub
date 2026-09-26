import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { segnala_errore } from "@/lib/errori";
import { toast } from "sonner";

/**
 * Interruttore «Il club ospita atleti esterni» (moduli_gestione_club, area `atleti_esterni`,
 * riga assente = spento). Governa cosa si OFFRE (la casella nella scheda atleta), non cosa
 * si mostra: la griglia mostra «Esterni» anche a interruttore spento se ce n'è almeno uno.
 * Non si spegne con esterni presenti; se il conteggio non è arrivato o è fallito, non si spegne.
 */
const AREA = "atleti_esterni";

export const AtletiEsterniSection: React.FC = () => {
  const { t } = useTranslation("settings");
  const { session } = useAuth();
  const { solo_presidente: allowed } = usePermessiAzione();
  const qc = useQueryClient();
  const { modalita, is_loading } = useModalitaArea(AREA);
  const acceso = modalita === "attivo";
  const club_id = get_current_club_id();

  const conteggio = useQuery({
    queryKey: ["atleti_esterni_conteggio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("atleti")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club_id)
        .eq("atleta_esterno", true);
      if (error) throw error;
      if (count === null) throw new Error(t("club.esterni.errore_conteggio"));
      return count;
    },
  });

  React.useEffect(() => {
    if (conteggio.isError) {
      void segnala_errore("AtletiEsterniSection", t("club.esterni.errore_conteggio"), conteggio.error, undefined, "avviso");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteggio.isError]);

  const salva = useMutation({
    mutationFn: async (nuovo: boolean) => {
      if (!club_id) throw new Error(t("club.esterni.errore_club"));
      const { error } = await supabase.from("moduli_gestione_club" as any).upsert(
        {
          club_id,
          area: AREA,
          modalita: nuovo ? "attivo" : "spento",
          attivato_da: session?.user_id ?? null,
          attivato_at: new Date().toISOString(),
        } as any,
        { onConflict: "club_id,area" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moduli_gestione_club"] });
      toast.success(t("club.esterni.salvato"));
    },
    onError: (e) => void segnala_errore("AtletiEsterniSection", t("club.esterni.errore_salvataggio"), e),
  });

  const cambia = (nuovo: boolean) => {
    if (!nuovo) {
      // Spegnere solo con conteggio arrivato e pari a zero.
      if (!conteggio.isSuccess) {
        toast.error(t("club.esterni.blocco_conteggio"));
        return;
      }
      if (conteggio.data > 0) {
        toast.error(t("club.esterni.blocco_presenti", { count: conteggio.data }));
        return;
      }
    }
    salva.mutate(nuovo);
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="atleti_esterni_switch" className="text-sm font-medium text-foreground">
          {t("club.esterni.interruttore_label")}
        </Label>
        <Switch
          id="atleti_esterni_switch"
          checked={acceso}
          disabled={!allowed || is_loading || salva.isPending}
          onCheckedChange={cambia}
        />
      </div>
      {acceso && conteggio.isSuccess && conteggio.data > 0 && (
        <p className="text-xs text-muted-foreground">{t("club.esterni.presenti", { count: conteggio.data })}</p>
      )}
      {conteggio.isError && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("club.esterni.errore_conteggio")}{" "}
          <button type="button" className="underline" onClick={() => void conteggio.refetch()}>
            {t("club.esterni.riprova")}
          </button>
        </p>
      )}
      {!allowed && <p className="text-xs text-muted-foreground">{t("club.esterni.solo_presidente")}</p>}
      <p className="whitespace-pre-line text-xs text-muted-foreground">{t("club.esterni.spiegazione")}</p>
    </div>
  );
};

export default AtletiEsterniSection;
