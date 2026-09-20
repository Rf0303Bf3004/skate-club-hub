import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import type { VocePannello } from "@/hooks/use-composizione-relazione";
import type { ModuloRisultato, Stagione } from "@/lib/relazione/moduli";
import { sincronizzaParagrafi, type Tono } from "@/lib/paragraphGenerator";
import MessaggioPresidente from "./MessaggioPresidente";
import AllegatiTab from "./AllegatiTab";
import { Button } from "@/components/ui/button";
import TextareaCrescente from "./TextareaCrescente";
import { renderGraficoSVG } from "@/lib/relazione/grafici";

interface Props {
  club_nome: string;
  club_id: string;
  stagione: Stagione;
  tono: Tono;
  voci: VocePannello[];
  moduli: Record<string, ModuloRisultato>;
  colore_primario?: string | null;
  /** Aree il cui testo si può correggere; assente = tutte. */
  aree_modificabili?: string[];
}

/**
 * Riallinea i testi generati ai dati di oggi, una volta per club/stagione/tono.
 * I capitoli si leggono solo dopo: così non si mostra una frase vecchia.
 */
function useSincronizzazione(club_id: string, stagione: Stagione, tono: Tono) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const [stato, set_stato] = useState<"attesa" | "pronto" | "errore">("attesa");
  const sincronizza = useMutation({
    mutationFn: () => sincronizzaParagrafi(club_id, stagione, tono),
    onError: (e) => { set_stato("errore"); segnala_errore("Relazione", t("relazione.paragrafi.errore_sincronizzazione"), e); },
    onSuccess: (r) => {
      set_stato("pronto");
      if (r.aggiornati > 0 || r.rimossi > 0) qc.invalidateQueries({ queryKey: ["relazione_paragrafi"] });
    },
  });
  const chiave = `${club_id}|${stagione.id}|${tono}`;
  const eseguito = useRef<string | null>(null);
  const avvia = sincronizza.mutate;
  useEffect(() => {
    if (eseguito.current === chiave) return;
    eseguito.current = chiave;
    set_stato("attesa");
    avvia();
  }, [chiave, avvia]);
  return { stato, riprova: () => { set_stato("attesa"); avvia(); } };
}

function TestoCapitolo({ club_id, stagione, tono, area, modificabile = true, pronto }: { club_id: string; stagione: Stagione; tono: Tono; area: string; modificabile?: boolean; pronto: boolean }) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const chiave = ["relazione_paragrafi", club_id, stagione.id, tono, area];
  const [bozze, set_bozze] = useState<Record<number, string>>({});
  // "sporche": modifiche non ancora salvate. "in_volo": salvataggio in corso.
  // Una bozza sporca o in volo non viene mai sostituita da quello che arriva
  // dal server: nel dubbio si tiene quello che ha scritto la persona.
  const [sporche, set_sporche] = useState<Set<number>>(new Set());
  const in_volo = useRef<Set<number>>(new Set());
  const bozze_ref = useRef<Record<number, string>>({});
  bozze_ref.current = bozze;
  const q = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const { data, error } = await supabase.from("relazioni_paragrafi_auto" as any)
        .select("paragrafo_ordine,contenuto").eq("club_id", club_id).eq("stagione_id", stagione.id)
        .eq("tono", tono).eq("area_id", area).order("paragrafo_ordine");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    // Si legge solo dopo il riallineamento: mai un testo vecchio a schermo.
    enabled: pronto,
  });
  useEffect(() => {
    if (!q.isSuccess) return;
    set_bozze((correnti) => {
      const prossime = { ...correnti };
      for (const p of q.data) {
        const ordine = p.paragrafo_ordine as number;
        if (sporche.has(ordine) || in_volo.current.has(ordine)) continue;
        prossime[ordine] = p.contenuto ?? "";
      }
      return prossime;
    });
  }, [q.data, q.isSuccess, sporche]);
  const salva = useMutation({
    mutationFn: async ({ ordine, contenuto }: { ordine: number; contenuto: string }) => {
      in_volo.current.add(ordine);
      const { error } = await supabase.from("relazioni_paragrafi_auto" as any).upsert({
        club_id, stagione_id: stagione.id, area_id: area, paragrafo_ordine: ordine, tono,
        contenuto, is_edited: true, updated_at: new Date().toISOString(),
      }, { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" });
      if (error) throw error;
    },
    onError: (e, variabili) => {
      in_volo.current.delete(variabili.ordine);
      // Il testo resta sporco e resta a schermo: un errore di rete non cancella.
      segnala_errore("Relazione", t("relazione.paragrafi.salvataggio"), e);
    },
    onSuccess: (_data, variabili) => {
      in_volo.current.delete(variabili.ordine);
      // Pulita solo se nel frattempo non si è continuato a scrivere.
      if ((bozze_ref.current[variabili.ordine] ?? "") === variabili.contenuto) {
        set_sporche((correnti) => { const prossimi = new Set(correnti); prossimi.delete(variabili.ordine); return prossimi; });
      }
      qc.invalidateQueries({ queryKey: chiave });
    },
  });
  // Il salvataggio sta in un ref: il ritardo di 700 ms non si riarma a ogni render.
  const salva_ref = useRef(salva.mutate);
  salva_ref.current = salva.mutate;
  const in_corso = salva.isPending;
  useEffect(() => {
    if (sporche.size === 0 || in_corso) return;
    const timer = window.setTimeout(() => {
      const ordine = Array.from(sporche)[0];
      salva_ref.current({ ordine, contenuto: bozze_ref.current[ordine] ?? "" });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [bozze, sporche, in_corso]);
  useEffect(() => {
    if (sporche.size === 0) return;
    const avvisa = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [sporche]);
  if (q.isPending) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (q.isError) return <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{t("relazione.paragrafi.errore_lettura")}<Button size="sm" variant="outline" onClick={() => q.refetch()}>{t("relazione.riprova")}</Button></div>;
  // Chi non può correggere questo capitolo lo legge e basta.
  if (!modificabile) {
    return <div className="space-y-4">{q.data.map((p) => <p key={p.paragrafo_ordine} className="whitespace-pre-wrap break-words font-serif text-base leading-relaxed">{p.contenuto ?? ""}</p>)}</div>;
  }
  return <div className="space-y-4">{q.data.map((p) => <TextareaCrescente key={p.paragrafo_ordine} value={bozze[p.paragrafo_ordine] ?? ""} onChange={(e) => { const testo = e.target.value; set_bozze((v) => ({ ...v, [p.paragrafo_ordine]: testo })); set_sporche((v) => new Set(v).add(p.paragrafo_ordine)); }} className="min-h-24 border-transparent bg-transparent px-0 font-serif text-base leading-relaxed shadow-none focus-visible:border-border focus-visible:px-3" title={t("relazione.paragrafi.clicca_per_correggere")} />)}</div>;
}

function Modulo({ risultato, colore }: { risultato: ModuloRisultato; colore: string }) {
  const grafico = risultato.grafico;
  if (!grafico) return null;
  if (grafico.tipo === "resoconto") {
    return <section className="mt-6 border-t pt-5">
      <h3 className="font-serif text-xl font-semibold break-words">{grafico.titolo}</h3>
      {grafico.sottotitolo && <p className="mt-1 text-xs text-muted-foreground break-words">{grafico.sottotitolo}</p>}
      {grafico.gare.map((gara, ig) => <div key={ig} className="mt-8 break-before-page">
        <h4 className="font-serif text-lg font-semibold break-words">{gara.titolo}</h4>
        {gara.sottotitolo && <p className="text-xs text-muted-foreground break-words">{gara.sottotitolo}</p>}
        <div className="mt-2 h-px w-full" style={{ backgroundColor: colore }} />
        {gara.tabelle.map((tab, it) => <div key={it} className="mt-5">
          <p className="font-serif text-base font-semibold break-words">{tab.titolo}</p>
          <table className="mt-2 w-full table-auto border-collapse text-sm">
            <thead><tr>{tab.colonne.map((c, j) => <th key={j} className={`border-b p-2 align-top font-medium ${j === 0 ? "w-14 whitespace-nowrap" : "break-words"} ${(tab.allinea_destra ?? []).includes(j) ? "text-right" : "text-left"}`}>{c}</th>)}</tr></thead>
            <tbody>{tab.righe.map((r, i) => <tr key={i} className="border-b border-border/60">{r.celle.map((c, j) => <td key={j} className={`p-2 align-top whitespace-pre-wrap break-words ${j === 0 ? "whitespace-nowrap" : ""} ${(tab.allinea_destra ?? []).includes(j) ? "text-right" : ""} ${r.evidenzia ? "font-bold" : ""}`} style={r.evidenzia && j === tab.colonna_nome ? { color: colore } : undefined}>{r.evidenzia && j === 0 ? <span aria-hidden className="mr-1" style={{ color: colore }}>▲</span> : null}{c}</td>)}</tr>)}</tbody>
          </table>
          {tab.sintesi && <p className="mt-2 text-xs text-muted-foreground break-words">{tab.sintesi}</p>}
        </div>)}
        {gara.nota && <p className="mt-3 text-xs text-muted-foreground break-words">{gara.nota}</p>}
      </div>)}
      {grafico.didascalia && <p className="mt-3 text-xs text-muted-foreground break-words">{grafico.didascalia}</p>}
    </section>;
  }
  if (grafico.tipo === "tabella") {
    return <section className="mt-6 border-t pt-5">
      <h3 className="font-serif text-xl font-semibold break-words">{grafico.titolo}</h3>
      {grafico.sottotitolo && <p className="mt-1 text-xs text-muted-foreground break-words">{grafico.sottotitolo}</p>}
      <table className="mt-4 w-full table-fixed border-collapse text-sm">
        <thead><tr>{grafico.colonne.map((c) => <th key={c} className="border-b p-2 text-left align-top font-medium break-words">{c}</th>)}</tr></thead>
        <tbody>{grafico.righe.map((r, i) => <tr key={i} className="border-b border-border/60">{r.map((c, j) => <td key={j} className="p-2 align-top whitespace-pre-wrap break-words">{c}</td>)}</tr>)}</tbody>
      </table>
      {grafico.didascalia && <p className="mt-3 text-xs text-muted-foreground break-words">{grafico.didascalia}</p>}
    </section>;
  }
  // Stesso disegno del PDF: l'anteprima mostra il grafico, non un elenco di cifre.
  const { svg } = renderGraficoSVG(grafico, colore);
  return <section className="mt-6 border-t pt-5">
    <div className="w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
  </section>;
}

export default function DocumentoRelazione({ club_nome, club_id, stagione, tono, voci, moduli, colore_primario, aree_modificabili }: Props) {
  const { t } = useTranslation("dashboard");
  const attive = voci.filter((v) => v.attivo);
  const sincronia = useSincronizzazione(club_id, stagione, tono);
  return <div className="space-y-5">
    {sincronia.stato === "errore" && <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4 shrink-0" />{t("relazione.paragrafi.errore_sincronizzazione")}
      <Button size="sm" variant="outline" onClick={sincronia.riprova}>{t("relazione.riprova")}</Button>
    </div>}
    <section className="mx-auto min-h-[70vh] max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16">
      <p className="text-sm uppercase text-muted-foreground">{stagione.nome}</p>
      <h1 className="mt-8 font-serif text-4xl font-semibold">{t("relazione.title")}</h1>
      <p className="mt-3 text-xl text-muted-foreground">{club_nome}</p>
    </section>
    {attive.some((v) => v.tipo === "messaggio") && <section className="mx-auto min-h-[70vh] max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16"><h2 className="font-serif text-3xl font-semibold">{t("relazione.documento.messaggio_titolo")}</h2><div className="mt-8"><MessaggioPresidente club_id={club_id} stagione_id={stagione.id} /></div></section>}
    {attive.filter((v) => v.tipo === "sezione").map((sezione) => {
      const contenuti = attive.filter((v) => v.tipo === "modulo" && moduli[v.riferimento]?.area === sezione.riferimento);
      return <section key={sezione.id} className="mx-auto min-h-[70vh] max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16"><h2 className="font-serif text-3xl font-semibold">{sezione.titolo}</h2><div className="mt-6"><TestoCapitolo club_id={club_id} stagione={stagione} tono={tono} area={sezione.riferimento} modificabile={!aree_modificabili || aree_modificabili.includes(sezione.riferimento)} pronto={sincronia.stato !== "attesa"} /></div>{contenuti.map((v) => <Modulo key={v.id} risultato={moduli[v.riferimento]} colore={colore_primario ?? "#14b8a6"} />)}</section>;
    })}
    {attive.filter((v) => v.tipo === "blocco").map((v) => <section key={v.id} className="mx-auto max-w-4xl border bg-card px-8 py-14 shadow-sm md:px-16"><h2 className="font-serif text-3xl font-semibold">{v.titolo}</h2><p className="mt-6 whitespace-pre-wrap font-serif text-base leading-relaxed">{v.payload?.contenuto}</p></section>)}
    <section className="mx-auto max-w-4xl border bg-card px-6 py-8 shadow-sm"><AllegatiTab club_id={club_id} stagione_id={stagione.id} compatto /></section>
  </div>;
}