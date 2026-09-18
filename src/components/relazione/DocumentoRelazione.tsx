import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import type { VocePannello } from "@/hooks/use-composizione-relazione";
import type { ModuloRisultato, Stagione } from "@/lib/relazione/moduli";
import type { Tono } from "@/lib/paragraphGenerator";
import MessaggioPresidente from "./MessaggioPresidente";
import AllegatiTab from "./AllegatiTab";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  club_nome: string;
  club_id: string;
  stagione: Stagione;
  tono: Tono;
  voci: VocePannello[];
  moduli: Record<string, ModuloRisultato>;
}

function TestoCapitolo({ club_id, stagione, tono, area }: { club_id: string; stagione: Stagione; tono: Tono; area: string }) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const chiave = ["relazione_paragrafi", club_id, stagione.id, tono, area];
  const [bozze, set_bozze] = useState<Record<number, string>>({});
  const [modificati, set_modificati] = useState<Set<number>>(new Set());
  const q = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const { data, error } = await supabase.from("relazioni_paragrafi_auto" as any)
        .select("paragrafo_ordine,contenuto").eq("club_id", club_id).eq("stagione_id", stagione.id)
        .eq("tono", tono).eq("area_id", area).order("paragrafo_ordine");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  useEffect(() => {
    if (!q.isSuccess) return;
    set_bozze(Object.fromEntries(q.data.map((p) => [p.paragrafo_ordine, p.contenuto ?? ""])));
    set_modificati(new Set());
  }, [q.data, q.isSuccess]);
  const salva = useMutation({
    mutationFn: async ({ ordine, contenuto }: { ordine: number; contenuto: string }) => {
      const { error } = await supabase.from("relazioni_paragrafi_auto" as any).upsert({
        club_id, stagione_id: stagione.id, area_id: area, paragrafo_ordine: ordine, tono,
        contenuto, is_edited: true, updated_at: new Date().toISOString(),
      }, { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" });
      if (error) throw error;
    },
    onError: (e) => segnala_errore("Relazione", t("relazione.paragrafi.salvataggio"), e),
    onSuccess: (_data, variabili) => {
      set_modificati((correnti) => { const prossimi = new Set(correnti); prossimi.delete(variabili.ordine); return prossimi; });
      qc.invalidateQueries({ queryKey: chiave });
    },
  });
  useEffect(() => {
    if (!q.isSuccess || modificati.size === 0 || salva.isPending) return;
    const timer = window.setTimeout(() => {
      const ordine = Array.from(modificati)[0];
      salva.mutate({ ordine, contenuto: bozze[ordine] ?? "" });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [bozze, modificati, q.isSuccess, salva]);
  if (q.isPending) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (q.isError) return <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{t("relazione.paragrafi.errore_lettura")}<Button size="sm" variant="outline" onClick={() => q.refetch()}>{t("relazione.riprova")}</Button></div>;
  return <div className="space-y-4">{q.data.map((p) => <Textarea key={p.paragrafo_ordine} value={bozze[p.paragrafo_ordine] ?? ""} onChange={(e) => { set_bozze((v) => ({ ...v, [p.paragrafo_ordine]: e.target.value })); set_modificati((v) => new Set(v).add(p.paragrafo_ordine)); }} className="min-h-24 resize-none border-transparent bg-transparent px-0 font-serif text-base leading-relaxed shadow-none focus-visible:border-border focus-visible:px-3" title={t("relazione.paragrafi.clicca_per_correggere")} />)}</div>;
}

function Modulo({ risultato }: { risultato: ModuloRisultato }) {
  const grafico = risultato.grafico;
  if (!grafico) return null;
  return <section className="mt-6 border-t pt-5">
    <h3 className="font-serif text-xl font-semibold">{grafico.titolo}</h3>
    {grafico.sottotitolo && <p className="mt-1 text-xs text-muted-foreground">{grafico.sottotitolo}</p>}
    {grafico.tipo === "tabella" ? <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr>{grafico.colonne.map((c) => <th key={c} className="border-b p-2 text-left font-medium">{c}</th>)}</tr></thead><tbody>{grafico.righe.map((r, i) => <tr key={i} className="border-b border-border/60">{r.map((c, j) => <td key={j} className="p-2 align-top">{c}</td>)}</tr>)}</tbody></table></div> : <div className="mt-4 space-y-2">{grafico.dati.map((d) => <div key={d.etichetta} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border/60 py-2 text-sm"><span>{d.etichetta}</span><strong>{d.valore}{d.valore2 != null ? ` / ${d.valore2}` : ""}</strong></div>)}</div>}
  </section>;
}

export default function DocumentoRelazione({ club_nome, club_id, stagione, tono, voci, moduli }: Props) {
  const { t } = useTranslation("dashboard");
  const attive = voci.filter((v) => v.attivo);
  return <div className="space-y-5">
    <section className="mx-auto min-h-[70vh] max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16">
      <p className="text-sm uppercase text-muted-foreground">{stagione.nome}</p>
      <h1 className="mt-8 font-serif text-4xl font-semibold">{t("relazione.title")}</h1>
      <p className="mt-3 text-xl text-muted-foreground">{club_nome}</p>
    </section>
    {attive.some((v) => v.tipo === "messaggio") && <section className="mx-auto min-h-[70vh] max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16"><h2 className="font-serif text-3xl font-semibold">{t("relazione.documento.messaggio_titolo")}</h2><div className="mt-8"><MessaggioPresidente club_id={club_id} stagione_id={stagione.id} /></div></section>}
    {attive.filter((v) => v.tipo === "sezione").map((sezione) => {
      const contenuti = attive.filter((v) => v.tipo === "modulo" && moduli[v.riferimento]?.area === sezione.riferimento);
      return <section key={sezione.id} className="mx-auto min-h-[70vh] max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16"><h2 className="font-serif text-3xl font-semibold">{sezione.titolo}</h2><div className="mt-6"><TestoCapitolo club_id={club_id} stagione={stagione} tono={tono} area={sezione.riferimento} /></div>{contenuti.map((v) => <Modulo key={v.id} risultato={moduli[v.riferimento]} />)}</section>;
    })}
    {attive.filter((v) => v.tipo === "blocco").map((v) => <section key={v.id} className="mx-auto max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16"><h2 className="font-serif text-3xl font-semibold">{v.titolo}</h2><p className="mt-6 whitespace-pre-wrap font-serif text-base leading-relaxed">{v.payload?.contenuto}</p></section>)}
    <section className="mx-auto max-w-4xl border bg-card px-6 py-8 shadow-sm"><AllegatiTab club_id={club_id} stagione_id={stagione.id} compatto /></section>
  </div>;
}