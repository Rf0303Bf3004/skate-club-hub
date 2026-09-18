import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileDown, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { segnala_errore } from "@/lib/errori";
import { useTranslation } from "react-i18next";
import { use_persisted_state } from "@/hooks/use-persisted-state";
import { useMessaggioPresidente } from "@/components/relazione/MessaggioPresidente";
import PannelloModuli from "@/components/relazione/PannelloModuli";
import DocumentoRelazione from "@/components/relazione/DocumentoRelazione";
import { useComposizioneRelazione } from "@/hooks/use-composizione-relazione";
import { fetchStagioniOrdinate, stagioneDaProporre, fetchModuli, type Stagione } from "@/lib/relazione/moduli";
import { generateRelazionePDF, buildRelazioneFilename, type VoceComposizione } from "@/lib/pdfGenerator";
import type { Tono } from "@/lib/paragraphGenerator";

export default function PresidentRelazione() {
  const { t } = useTranslation("dashboard");
  const { session } = useAuth();
  const club_id = session?.club_id ?? undefined;
  const [pannello_aperto, set_pannello_aperto] = useState(false);
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
    <div className="space-y-4">
      <header className="sticky top-0 z-30 flex flex-col gap-3 border-b bg-background/95 py-3 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl text-foreground">{t("relazione.title")}</h1>
          <Select value={stagione?.id} onValueChange={set_stagione_id} disabled={stagioni.length === 0}>
            <SelectTrigger className="h-9 w-52 text-sm"><SelectValue placeholder={t("relazione.season")} /></SelectTrigger>
            <SelectContent>{stagioni.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button className="h-11 gap-2" onClick={scarica} disabled={!dati_pronti || scaricando}>
            {scaricando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {t("relazione.scarica_relazione")}
        </Button>
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

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 bg-muted/30 p-3 md:p-6">
          {stagione && dati_pronti ? <DocumentoRelazione club_nome={q_club.data?.nome ?? t("relazione.club_fallback")} club_id={club_id} stagione={stagione} tono={tono} voci={comp.voci} moduli={q_moduli.data ?? {}} /> : <div className="flex min-h-[400px] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("relazione.caricamento")}</div>}
        </main>
        <aside className="space-y-4 border bg-card p-4 xl:sticky xl:top-20">
          <h2 className="font-semibold">{t("relazione.pannello.titolo")}</h2>
          <div className="flex flex-wrap gap-2">{(["completa", "assemblea", "comitato"] as const).map((p) => <Button key={p} size="sm" variant="outline" disabled={!dati_pronti || comp.in_salvataggio} onClick={() => comp.applica_preset(p)}>{t(`relazione.preset_${p}`)}</Button>)}</div>
          <Button variant="ghost" className="w-full justify-between px-0" onClick={() => set_pannello_aperto((v) => !v)}>{t("relazione.pannello.scegli_moduli")}{pannello_aperto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
          {pannello_aperto && <div className="space-y-5 border-t pt-4"><div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t("relazione.pannello.tono")}</p><Tabs value={tono} onValueChange={(v) => set_tono(v as Tono)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="soci">{t("relazione.tono_soci")}</TabsTrigger><TabsTrigger value="formale">{t("relazione.tono_formale")}</TabsTrigger></TabsList></Tabs></div>{comp.is_error ? <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{t("relazione.errore_composizione")}<Button size="sm" variant="outline" onClick={() => comp.ricarica()}>{t("relazione.riprova")}</Button></div> : comp.is_loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PannelloModuli club_id={club_id} stagione={stagione!} tono={tono} voci={comp.voci} toggle={comp.toggle} sposta={comp.sposta} moduli_in_caricamento={q_moduli.isPending} />}</div>}
        </aside>
      </div>
    </div>
  );
}
