import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Maximize2, FileDown, AlertTriangle } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { segnala_errore } from "@/lib/errori";
import { useTranslation } from "react-i18next";
import { use_persisted_state } from "@/hooks/use-persisted-state";
import SavingIndicator from "@/components/relazione/SavingIndicator";
import MessaggioPresidente, { useMessaggioPresidente } from "@/components/relazione/MessaggioPresidente";
import PannelloModuli from "@/components/relazione/PannelloModuli";
import AnteprimaFedele from "@/components/relazione/AnteprimaFedele";
import BlocchiTestoTab from "@/components/relazione/BlocchiTestoTab";
import AllegatiTab from "@/components/relazione/AllegatiTab";
import { useComposizioneRelazione } from "@/hooks/use-composizione-relazione";
import { fetchStagioniOrdinate, stagioneDaProporre, fetchModuli, type Stagione } from "@/lib/relazione/moduli";
import { generateRelazionePDF, buildRelazioneFilename, type VoceComposizione } from "@/lib/pdfGenerator";
import type { Tono } from "@/lib/paragraphGenerator";

function Passo({ numero, titolo, children }: { numero: number; titolo: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{numero}</span>
        <h2 className="text-sm font-semibold">{titolo}</h2>
      </div>
      {children}
    </Card>
  );
}

export default function PresidentRelazione() {
  const { t } = useTranslation("dashboard");
  const { session } = useAuth();
  const club_id = session?.club_id ?? undefined;
  const [fullscreen, set_fullscreen] = useState(false);
  const [tono, set_tono] = use_persisted_state<Tono>("relazione_tono", "soci");
  const [stagione_id, set_stagione_id] = useState<string | undefined>(undefined);
  const [scaricando, set_scaricando] = useState(false);

  const q_stagioni = useQuery({
    queryKey: ["relazione_stagioni", club_id],
    enabled: !!club_id,
    queryFn: () => fetchStagioniOrdinate(club_id!),
  });
  const stagioni = q_stagioni.data ?? [];
  const proposta = useMemo(() => stagioneDaProporre(stagioni), [stagioni]);
  const stagione: Stagione | null =
    stagioni.find((s) => s.id === stagione_id) ?? proposta ?? null;

  const q_club = useQuery({
    queryKey: ["club_for_relazione", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("*").eq("id", club_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const q_moduli = useQuery({
    queryKey: ["relazione_moduli", club_id, stagione?.id],
    enabled: !!club_id && !!stagione?.id && stagioni.length > 0,
    queryFn: () => fetchModuli({ club_id: club_id!, stagione: stagione!, stagioni }),
  });

  const q_blocchi = useQuery({
    queryKey: ["relazione_blocchi_lista", club_id, stagione?.id],
    enabled: !!club_id && !!stagione?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_blocchi_testo" as any).select("*")
        .eq("club_id", club_id!).eq("stagione_id", stagione!.id).order("ordine");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const q_allegati = useQuery({
    queryKey: ["relazione_allegati_lista", club_id, stagione?.id],
    enabled: !!club_id && !!stagione?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_allegati" as any).select("*")
        .eq("club_id", club_id!).eq("stagione_id", stagione!.id).order("ordine");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const comp = useComposizioneRelazione(
    club_id, stagione, q_moduli.data, q_blocchi.data ?? [], q_allegati.data ?? [],
  );
  const q_messaggio = useMessaggioPresidente(club_id, stagione?.id);

  const voci_attive: VoceComposizione[] = comp.voci
    .filter((v) => v.attivo)
    .map((v) => ({ id: v.id, tipo: v.tipo, riferimento: v.riferimento, titolo: v.titolo, payload: v.payload }));

  const firma = JSON.stringify([tono, stagione?.id, voci_attive.map((v) => v.id), q_messaggio.data ?? ""]);

  // Specchio di user_is_presidenza() del database, esteso ad amministrazione e superadmin.
  if (session && !["superadmin", "admin", "presidente", "vicepresidente"].includes(session.ruolo as string)) {
    return <Navigate to="/" replace />;
  }

  // Le scritture si fermano se una lettura non è arrivata o è fallita.
  const dati_pronti =
    q_stagioni.isSuccess && q_moduli.isSuccess && comp.voci.length > 0 &&
    q_blocchi.isSuccess && q_allegati.isSuccess && q_messaggio.isSuccess && !!stagione;

  const scarica = async () => {
    if (!dati_pronti || !stagione) {
      toast.warning(t("relazione.attendi_dati"));
      return;
    }
    set_scaricando(true);
    try {
      const res = await generateRelazionePDF({
        club: q_club.data, club_id: club_id!, presidente:
          `${session?.nome ?? ""} ${session?.cognome ?? ""}`.trim() || session?.email || t("relazione.presidente_fallback"),
        stagione, tono, messaggio: q_messaggio.data ?? null,
        voci: voci_attive, moduli: q_moduli.data ?? {},
      });
      saveAs(res.blob, buildRelazioneFilename(q_club.data?.nome ?? "Club", stagione.nome));
    } catch (e) {
      await segnala_errore("Relazione", t("relazione.scarica_errore"), e);
    } finally {
      set_scaricando(false);
    }
  };

  if (!club_id) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5" />
        {t("relazione.senza_club")}
      </div>
    );
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background p-6 overflow-auto" : "space-y-4"}>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-serif tracking-tight text-foreground">{t("relazione.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("relazione.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SavingIndicator />
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => set_fullscreen((f) => !f)}>
            <Maximize2 className="w-4 h-4" />{fullscreen ? t("relazione.exit_fullscreen") : t("relazione.fullscreen")}
          </Button>
          <Button size="sm" className="gap-2 h-9" onClick={scarica} disabled={!dati_pronti || scaricando}>
            {scaricando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {t("relazione.scarica_relazione")}
          </Button>
        </div>
      </header>

      {q_stagioni.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t("relazione.errore_stagioni")}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => q_stagioni.refetch()}>{t("relazione.riprova")}</Button>
        </div>
      )}
      {q_stagioni.isSuccess && stagioni.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("relazione.nessuna_stagione")}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Passo numero={1} titolo={t("relazione.passo1")}>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={stagione?.id} onValueChange={set_stagione_id} disabled={stagioni.length === 0}>
                <SelectTrigger className="w-52 h-9 text-sm"><SelectValue placeholder={t("relazione.season")} /></SelectTrigger>
                <SelectContent>
                  {stagioni.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Tabs value={tono} onValueChange={(v) => set_tono(v as Tono)}>
                <TabsList className="h-9">
                  <TabsTrigger value="soci">{t("relazione.tono_soci")}</TabsTrigger>
                  <TabsTrigger value="formale">{t("relazione.tono_formale")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <p className="text-xs text-muted-foreground">{t("relazione.tono_nota")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-muted-foreground self-center">{t("relazione.preset_titolo")}</span>
              {(["completa", "assemblea", "comitato"] as const).map((p) => (
                <Button key={p} size="sm" variant="outline" className="h-7 text-xs"
                  disabled={!dati_pronti || comp.in_salvataggio}
                  onClick={() => comp.applica_preset(p)}>
                  {t(`relazione.preset_${p}`)}
                </Button>
              ))}
            </div>
          </Passo>

          {stagione && (
            <>
              <Passo numero={2} titolo={t("relazione.passo2")}>
                <MessaggioPresidente club_id={club_id} stagione_id={stagione.id} />
              </Passo>

              <Passo numero={3} titolo={t("relazione.passo3")}>
                {comp.is_error ? (
                  <div className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />{t("relazione.errore_composizione")}
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => comp.ricarica()}>{t("relazione.riprova")}</Button>
                  </div>
                ) : comp.is_loading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />{t("relazione.caricamento")}
                  </p>
                ) : (
                  <PannelloModuli
                    club_id={club_id}
                    stagione={stagione}
                    tono={tono}
                    voci={comp.voci}
                    toggle={comp.toggle}
                    sposta={comp.sposta}
                    moduli_in_caricamento={q_moduli.isLoading}
                  />
                )}
                {q_moduli.isError && (
                  <div className="text-sm text-destructive flex items-center gap-2 mt-2">
                    <AlertTriangle className="w-4 h-4" />{t("relazione.errore_moduli")}
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => q_moduli.refetch()}>{t("relazione.riprova")}</Button>
                  </div>
                )}
              </Passo>

              <Passo numero={4} titolo={t("relazione.passo4")}>
                <div className="space-y-6">
                  <BlocchiTestoTab club_id={club_id} stagione_id={stagione.id} />
                  <AllegatiTab club_id={club_id} stagione_id={stagione.id} />
                  <Button onClick={scarica} disabled={!dati_pronti || scaricando} className="gap-2">
                    {scaricando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    {t("relazione.scarica_relazione")}
                  </Button>
                </div>
              </Passo>
            </>
          )}
        </div>

        <div className="xl:sticky xl:top-4 border rounded-lg bg-card overflow-hidden">
          {stagione && dati_pronti ? (
            <AnteprimaFedele
              club={q_club.data}
              club_id={club_id}
              presidente={`${session?.nome ?? ""} ${session?.cognome ?? ""}`.trim() || session?.email || t("relazione.presidente_fallback")}
              stagione={stagione}
              tono={tono}
              messaggio={q_messaggio.data ?? null}
              voci={voci_attive}
              moduli={q_moduli.data ?? {}}
              structural_signature={firma}
            />
          ) : (
            <div className="flex items-center justify-center min-h-[400px] text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />{t("relazione.caricamento")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
