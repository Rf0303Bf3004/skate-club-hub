import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { segnala_errore } from "@/lib/errori";
import { useTranslation } from "react-i18next";

// Il messaggio è un testo del presidente, indipendente dal tono: viene salvato
// su una sola riga (area "messaggio", ordine 0) della tabella dei paragrafi.
export const CHIAVE_MESSAGGIO = { area_id: "messaggio", paragrafo_ordine: 0, tono: "soci" };

interface Props {
  club_id: string;
  stagione_id: string;
}

export function useMessaggioPresidente(club_id: string | undefined, stagione_id: string | undefined) {
  return useQuery({
    queryKey: ["relazione_messaggio", club_id, stagione_id],
    enabled: !!club_id && !!stagione_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_paragrafi_auto" as any).select("contenuto")
        .eq("club_id", club_id!).eq("stagione_id", stagione_id!)
        .eq("area_id", CHIAVE_MESSAGGIO.area_id)
        .eq("paragrafo_ordine", CHIAVE_MESSAGGIO.paragrafo_ordine)
        .eq("tono", CHIAVE_MESSAGGIO.tono)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.contenuto ?? "") as string;
    },
  });
}

export default function MessaggioPresidente({ club_id, stagione_id }: Props) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useMessaggioPresidente(club_id, stagione_id);
  const [testo, set_testo] = useState("");
  const [toccato, set_toccato] = useState(false);

  useEffect(() => {
    if (!toccato && typeof data === "string") set_testo(data);
  }, [data, toccato]);

  const m_salva = useMutation({
    mutationFn: async () => {
      const { error: err } = await supabase
        .from("relazioni_paragrafi_auto" as any)
        .upsert(
          {
            club_id, stagione_id,
            ...CHIAVE_MESSAGGIO,
            contenuto: testo,
            is_edited: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" },
        );
      if (err) throw err;
    },
    onError: (e) => segnala_errore("Relazione", t("relazione.messaggio.salvataggio"), e),
    onSuccess: () => {
      set_toccato(false);
      toast.success(t("relazione.messaggio.salvato"));
      qc.invalidateQueries({ queryKey: ["relazione_messaggio", club_id, stagione_id] });
    },
  });

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="w-4 h-4" />
          {t("relazione.messaggio.errore_lettura")}
        </div>
        <p className="mt-1 text-muted-foreground">{(error as any)?.message}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
          {t("relazione.riprova")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("relazione.messaggio.spiegazione")}</p>
      <Textarea
        value={testo}
        onChange={(e) => { set_testo(e.target.value); set_toccato(true); }}
        rows={8}
        disabled={isLoading}
        placeholder={t("relazione.messaggio.placeholder")}
        className="font-serif text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isLoading ? t("relazione.caricamento") : t("relazione.messaggio.parole", { count: testo.trim().split(/\s+/).filter(Boolean).length })}
        </span>
        <Button size="sm" onClick={() => m_salva.mutate()} disabled={m_salva.isPending || !toccato} className="gap-2">
          {m_salva.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("relazione.messaggio.salva")}
        </Button>
      </div>
    </div>
  );
}
