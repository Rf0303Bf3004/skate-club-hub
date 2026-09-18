import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Loader2, AlertTriangle, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { segnala_errore } from "@/lib/errori";
import { useTranslation } from "react-i18next";
import { regeneraParagrafo, ORDINE_LABELS, type Tono } from "@/lib/paragraphGenerator";
import type { AreaId, Stagione } from "@/lib/relazione/moduli";
import type { VocePannello } from "@/hooks/use-composizione-relazione";

interface Props {
  club_id: string;
  stagione: Stagione;
  tono: Tono;
  voci: VocePannello[];
  toggle: (voce: VocePannello, attivo: boolean) => void;
  sposta: (voce: VocePannello, direzione: -1 | 1) => void;
  moduli_in_caricamento: boolean;
}

/** Paragrafi di un capitolo: cliccabili e correggibili sul posto. */
function TestoSezione({
  club_id, stagione, tono, area,
}: { club_id: string; stagione: Stagione; tono: Tono; area: AreaId }) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const chiave = ["relazione_paragrafi", club_id, stagione.id, tono, area];
  const [in_modifica, set_in_modifica] = useState<number | null>(null);
  const [bozza, set_bozza] = useState("");

  const q = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_paragrafi_auto" as any)
        .select("paragrafo_ordine,contenuto,is_edited")
        .eq("club_id", club_id).eq("stagione_id", stagione.id).eq("tono", tono).eq("area_id", area)
        .order("paragrafo_ordine");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const m_salva = useMutation({
    mutationFn: async ({ ordine, testo }: { ordine: number; testo: string }) => {
      const { error } = await supabase
        .from("relazioni_paragrafi_auto" as any)
        .upsert(
          {
            club_id, stagione_id: stagione.id, area_id: area, paragrafo_ordine: ordine,
            tono, contenuto: testo, is_edited: true, updated_at: new Date().toISOString(),
          },
          { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" },
        );
      if (error) throw error;
    },
    onError: (e) => segnala_errore("Relazione", t("relazione.paragrafi.salvataggio"), e),
    onSuccess: () => { set_in_modifica(null); qc.invalidateQueries({ queryKey: chiave }); },
  });

  const m_rigenera = useMutation({
    mutationFn: (ordine: number) => regeneraParagrafo(club_id, stagione, tono, area, ordine),
    onError: (e) => segnala_errore("Relazione", t("relazione.paragrafi.rigenerazione"), e),
    onSuccess: () => { qc.invalidateQueries({ queryKey: chiave }); toast.success(t("relazione.paragrafi.rigenerato")); },
  });

  if (q.isLoading) {
    return <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />{t("relazione.caricamento")}</p>;
  }
  if (q.isError) {
    return (
      <div className="text-xs text-destructive flex items-center gap-2">
        <AlertTriangle className="w-3 h-3" />
        {t("relazione.paragrafi.errore_lettura")}
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => q.refetch()}>{t("relazione.riprova")}</Button>
      </div>
    );
  }
  if ((q.data ?? []).length === 0) {
    return <p className="text-xs text-muted-foreground">{t("relazione.paragrafi.vuoto")}</p>;
  }

  return (
    <div className="space-y-3">
      {(q.data ?? []).map((p: any) => (
        <div key={p.paragrafo_ordine} className="group">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {ORDINE_LABELS[p.paragrafo_ordine] ?? `#${p.paragrafo_ordine}`}
            </span>
            {p.is_edited && <Badge variant="outline" className="h-4 text-[10px]">{t("relazione.paragrafi.modificato")}</Badge>}
            <Button
              size="sm" variant="ghost" className="h-6 px-2 text-xs ml-auto gap-1"
              onClick={() => m_rigenera.mutate(p.paragrafo_ordine)}
              disabled={m_rigenera.isPending}
            >
              <RefreshCw className="w-3 h-3" />{t("relazione.paragrafi.rigenera")}
            </Button>
          </div>
          {in_modifica === p.paragrafo_ordine ? (
            <div className="space-y-2">
              <Textarea value={bozza} onChange={(e) => set_bozza(e.target.value)} rows={6} className="text-sm font-serif" />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 gap-1" disabled={m_salva.isPending}
                  onClick={() => m_salva.mutate({ ordine: p.paragrafo_ordine, testo: bozza })}>
                  {m_salva.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {t("relazione.paragrafi.salva")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => set_in_modifica(null)}>
                  <X className="w-3 h-3" />{t("relazione.paragrafi.annulla")}
                </Button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm font-serif leading-relaxed text-foreground/90 cursor-text rounded px-1 -mx-1 hover:bg-muted/60"
              title={t("relazione.paragrafi.clicca_per_correggere")}
              onClick={() => { set_bozza(p.contenuto ?? ""); set_in_modifica(p.paragrafo_ordine); }}
            >
              {p.contenuto}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PannelloModuli({
  club_id, stagione, tono, voci, toggle, sposta, moduli_in_caricamento,
}: Props) {
  const { t } = useTranslation("dashboard");
  const mobili = voci.filter((v) => !v.bloccato);

  return (
    <div className="space-y-2">
      {voci.map((v) => {
        const idx = mobili.findIndex((m) => m.id === v.id);
        const spento_per_dati = v.tipo === "modulo" && v.stato_modulo && v.stato_modulo !== "ok";
        return (
          <div
            key={v.id}
            className={`rounded-lg border p-3 ${v.attivo ? "bg-card" : "bg-muted/40"} ${spento_per_dati ? "border-dashed" : ""}`}
          >
            <div className="flex items-start gap-3">
              <Switch
                checked={v.attivo}
                disabled={v.bloccato || !!spento_per_dati}
                onCheckedChange={(c) => toggle(v, c)}
                aria-label={v.titolo}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{v.titolo}</span>
                  {v.bloccato && <Badge variant="secondary" className="h-4 text-[10px]">{t("relazione.moduli.sempre")}</Badge>}
                </div>
                {v.sottotitolo && <p className="text-xs text-muted-foreground">{v.sottotitolo}</p>}

                {v.tipo === "modulo" && moduli_in_caricamento && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" />{t("relazione.caricamento")}
                  </p>
                )}
                {spento_per_dati && !moduli_in_caricamento && (
                  <p className={`text-xs mt-1 flex items-start gap-1 ${v.stato_modulo === "errore" ? "text-destructive" : "text-amber-700"}`}>
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    {v.stato_modulo === "errore"
                      ? t("relazione.moduli.errore", { motivo: v.motivo ?? "" })
                      : t("relazione.moduli.senza_dati", { motivo: v.motivo ?? "" })}
                  </p>
                )}

                {v.tipo === "sezione" && v.attivo && (
                  <div className="mt-3 border-t pt-3">
                    <TestoSezione club_id={club_id} stagione={stagione} tono={tono} area={v.riferimento as AreaId} />
                  </div>
                )}
                {v.tipo === "blocco" && v.payload?.contenuto && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{v.payload.contenuto}</p>
                )}
              </div>
              {!v.bloccato && (
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx <= 0}
                    title={t("relazione.moduli.su")} onClick={() => sposta(v, -1)}>
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx < 0 || idx >= mobili.length - 1}
                    title={t("relazione.moduli.giu")} onClick={() => sposta(v, 1)}>
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
