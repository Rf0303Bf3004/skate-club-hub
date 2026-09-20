import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import TextareaCrescente from "./TextareaCrescente";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
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
  // "sporco": modifiche non ancora salvate. "in_volo": salvataggio in corso.
  // Un testo sporco o in volo non viene mai sostituito da quello che arriva
  // dal server: nel dubbio si tiene quello che ha scritto la persona.
  const [sporco, set_sporco] = useState(false);
  const in_volo = useRef(false);
  const testo_ref = useRef("");
  testo_ref.current = testo;

  useEffect(() => {
    if (sporco || in_volo.current) return;
    if (typeof data === "string") set_testo(data);
  }, [data, sporco]);

  const m_salva = useMutation({
    mutationFn: async (contenuto: string) => {
      in_volo.current = true;
      const { error: err } = await supabase
        .from("relazioni_paragrafi_auto" as any)
        .upsert(
          {
            club_id, stagione_id,
            ...CHIAVE_MESSAGGIO,
            contenuto,
            is_edited: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" },
        );
      if (err) throw err;
    },
    onError: (e, _contenuto) => {
      in_volo.current = false;
      // Il testo resta sporco e resta a schermo: un errore di rete non cancella.
      segnala_errore("Relazione", t("relazione.messaggio.salvataggio"), e);
    },
    onSuccess: (_data, contenuto) => {
      in_volo.current = false;
      // Pulito solo se nel frattempo non si è continuato a scrivere.
      if (testo_ref.current === contenuto) set_sporco(false);
      qc.invalidateQueries({ queryKey: ["relazione_messaggio", club_id, stagione_id] });
    },
  });

  // Il salvataggio sta in un ref: il ritardo di 700 ms non si riarma a ogni render.
  const salva_ref = useRef(m_salva.mutate);
  salva_ref.current = m_salva.mutate;
  const in_corso = m_salva.isPending;
  useEffect(() => {
    if (!sporco || isLoading || isError || in_corso) return;
    const timer = window.setTimeout(() => salva_ref.current(testo_ref.current), 700);
    return () => window.clearTimeout(timer);
  }, [testo, sporco, isLoading, isError, in_corso]);

  useEffect(() => {
    if (!sporco) return;
    const avvisa = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [sporco]);

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
      <TextareaCrescente
        value={testo}
        onChange={(e) => { set_testo(e.target.value); set_sporco(true); }}
        rows={12}
        disabled={isLoading}
        placeholder={t("relazione.messaggio.placeholder")}
        className="border-transparent bg-transparent px-0 font-serif text-base leading-relaxed shadow-none focus-visible:border-border focus-visible:px-3"
      />
      <span className="text-xs text-muted-foreground">
        {isLoading
          ? t("relazione.caricamento")
          : in_corso
            ? t("relazione.messaggio.salvataggio_in_corso")
            : sporco
              ? t("relazione.messaggio.da_salvare")
              : t("relazione.messaggio.salvato")}
      </span>
    </div>
  );
}
