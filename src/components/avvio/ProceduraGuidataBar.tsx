import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Compass, RefreshCw, X, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { segnala_errore } from "@/lib/errori";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import {
  RUOLI_AVVIO_CLUB,
  avanzamento_avvio,
  passo_corrente_avvio,
  rotta_riga,
  use_diagnosi_avvio,
  use_preferenze_procedura,
} from "@/lib/avvio-club";

/**
 * Procedura guidata di avvio: barra sottile sotto l'intestazione che accompagna
 * nelle pagine vere. I passi vengono solo da diagnosi_avvio_club (righe bloccanti).
 * Tre stati: riuscita senza bloccanti → «pronto» (una volta); riuscita con
 * bloccanti → passo corrente; fallita o non arrivata → nessun passo, mai «pronto».
 */
export default function ProceduraGuidataBar() {
  const { t } = useTranslation("onboarding");
  const { session } = useAuth();
  const location = useLocation();
  const club_id = session?.club_id;
  const soggetto = !!session && RUOLI_AVVIO_CLUB.includes(session.ruolo);
  const { nascosta, pronto_chiuso, esci, chiudi_pronto } = use_preferenze_procedura(club_id);
  const attiva = soggetto && !nascosta;
  const { modalita: modalita_ghiaccio } = useModalitaArea("ghiaccio");

  // Rilettura ogni 25 s solo mentre la barra è visibile.
  const diagnosi = use_diagnosi_avvio(club_id, attiva, attiva ? 25_000 : false);
  const { refetch } = diagnosi;

  // Avanza da sola: rilettura a ogni cambio di pagina (il ritorno in primo piano lo fa la query).
  useEffect(() => {
    if (attiva) void refetch();
  }, [location.pathname, attiva, refetch]);

  useEffect(() => {
    if (attiva && diagnosi.isError) {
      void segnala_errore("ProceduraGuidataBar", t("procedura.errore"), diagnosi.error, undefined, "avviso");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosi.isError, attiva]);

  const righe = useMemo(() => diagnosi.data ?? [], [diagnosi.data]);
  const conteggio = useMemo(() => avanzamento_avvio(righe), [righe]);
  const corrente = useMemo(() => passo_corrente_avvio(righe), [righe]);
  const righe_ordinate = useMemo(() => [...righe].sort((a, b) => a.passo - b.passo), [righe]);

  // null = segue il passo corrente; un numero = l'utente sta scorrendo e la vista resta ferma.
  const [passo_mostrato, set_passo_mostrato] = useState<number | null>(null);
  useEffect(() => {
    set_passo_mostrato(null);
  }, [club_id]);

  // «Fatto: …» quando il PASSO CORRENTE cambia e quello di prima risulta ora ✓.
  // Si cerca fra tutte le righe: una riga risolta perde `blocca`, quindi non è più fra i bloccanti.
  const passo_precedente = useRef<number | null>(null);
  const [fatto, set_fatto] = useState<string | null>(null);
  useEffect(() => {
    if (!diagnosi.isSuccess) return;
    const prima = passo_precedente.current;
    const ora = corrente?.passo ?? null;
    if (prima !== null && prima !== ora) {
      const superata = righe.find((r) => r.passo === prima && r.esito === "✓");
      if (superata) set_fatto(superata.controllo);
    }
    passo_precedente.current = ora;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosi.isSuccess, diagnosi.dataUpdatedAt]);
  useEffect(() => {
    if (!fatto) return;
    const timer = window.setTimeout(() => set_fatto(null), 4000);
    return () => window.clearTimeout(timer);
  }, [fatto]);
  useEffect(() => {
    passo_precedente.current = null;
    set_fatto(null);
  }, [club_id]);

  if (!attiva || !club_id) return null;

  const cornice = "sticky top-14 z-20 border-b text-sm px-4 lg:px-8 py-2";
  const sulla_pagina_avvio = location.pathname === "/avvio";
  const titolo_procedura = sulla_pagina_avvio ? (
    <span className="text-xs font-semibold text-primary">{t("procedura.titolo")}</span>
  ) : (
    <Link
      to="/avvio"
      title={t("procedura.vedi_passi")}
      className="text-xs font-semibold text-primary hover:underline underline-offset-2"
    >
      {t("procedura.titolo")}
    </Link>
  );

  // Fallita, o non ancora arrivata: nessun passo, nessun «pronto».
  if (!diagnosi.isSuccess) {
    return (
      <div className={`${cornice} bg-muted/80 backdrop-blur-md border-border flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground`}>
        {titolo_procedura}
        <span>{diagnosi.isError ? t("procedura.errore") : t("procedura.caricamento")}</span>
        {diagnosi.isError && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5" disabled={diagnosi.isFetching} onClick={() => void refetch()}>
            <RefreshCw className={`w-3.5 h-3.5 ${diagnosi.isFetching ? "animate-spin" : ""}`} /> {t("procedura.riprova")}
          </Button>
        )}
        <button type="button" onClick={esci} className="ml-auto text-xs underline underline-offset-2 hover:text-foreground">
          {t("procedura.esci")}
        </button>
      </div>
    );
  }

  // Chi sta scorrendo non viene interrotto dal «Fatto: …».
  if (fatto && passo_mostrato === null) {
    return (
      <div role="status" className={`${cornice} bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 flex items-center gap-3 animate-fade-in`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-medium text-foreground truncate">{t("procedura.fatto", { controllo: fatto })}</span>
      </div>
    );
  }

  const riga_scelta = passo_mostrato !== null ? righe_ordinate.find((r) => r.passo === passo_mostrato) : undefined;
  const mostrata = riga_scelta ?? corrente;

  if (!mostrata) {
    if (pronto_chiuso) return null;
    return (
      <div className={`${cornice} bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 flex items-center gap-3`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-medium text-foreground flex-1">{t("procedura.pronto")}</span>
        <button
          type="button"
          onClick={chiudi_pronto}
          title={t("procedura.chiudi")}
          aria-label={t("procedura.chiudi")}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/60"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const rotta = rotta_riga(mostrata, modalita_ghiaccio);
  const indice = righe_ordinate.findIndex((r) => r.passo === mostrata.passo);
  const e_corrente = !!corrente && corrente.passo === mostrata.passo;
  const vai_a_indice = (i: number) => {
    const r = righe_ordinate[i];
    if (r) set_passo_mostrato(r.passo);
  };
  const icona_esito =
    mostrata.esito === "✓" ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 inline" />
    ) : mostrata.esito === "⚠" ? (
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 inline" />
    ) : (
      <XCircle className="w-4 h-4 text-destructive shrink-0 inline" />
    );

  return (
    <div className={`${cornice} bg-primary/10 backdrop-blur-md border-primary/20 flex flex-wrap items-center gap-x-4 gap-y-1.5`}>
      <Compass className="w-4 h-4 text-primary shrink-0 hidden sm:block" />
      <div className="flex-1 min-w-[12rem]">
        <div className="flex flex-wrap items-center gap-x-2">
          {sulla_pagina_avvio ? (
            <p className="text-xs font-semibold text-primary">
              {t("procedura.titolo")} · {t("avvio.a_posto", { a_posto: conteggio.a_posto, totale: conteggio.totale })}
            </p>
          ) : (
            <Link
              to="/avvio"
              title={t("procedura.vedi_passi")}
              className="text-xs font-semibold text-primary hover:underline underline-offset-2"
            >
              {t("procedura.titolo")} · {t("avvio.a_posto", { a_posto: conteggio.a_posto, totale: conteggio.totale })}
            </Link>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <button
              type="button"
              disabled={indice <= 0}
              onClick={() => vai_a_indice(indice - 1)}
              title={t("procedura.passo_precedente")}
              aria-label={t("procedura.passo_precedente")}
              className="p-0.5 rounded hover:bg-background/60 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>{t("procedura.passo", { n: indice + 1, m: righe_ordinate.length })}</span>
            <button
              type="button"
              disabled={indice < 0 || indice >= righe_ordinate.length - 1}
              onClick={() => vai_a_indice(indice + 1)}
              title={t("procedura.passo_successivo")}
              aria-label={t("procedura.passo_successivo")}
              className="p-0.5 rounded hover:bg-background/60 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </span>
          {passo_mostrato !== null && !e_corrente && (
            <button
              type="button"
              onClick={() => set_passo_mostrato(null)}
              className="text-xs text-primary underline underline-offset-2 hover:text-foreground"
            >
              {t("procedura.torna_al_corrente")}
            </button>
          )}
        </div>
        <Progress value={conteggio.percentuale} className="h-1 my-1" />
        <p className="text-foreground truncate flex items-center gap-1.5">
          {e_corrente ? (
            <span className="text-muted-foreground">{t("procedura.prossimo")}</span>
          ) : (
            icona_esito
          )}
          <span className="font-medium">{mostrata.controllo}</span>
          {mostrata.dettaglio && <span className="text-muted-foreground truncate"> — {mostrata.dettaglio}</span>}
        </p>
        {rotta.aiuto && <p className="text-xs text-muted-foreground">{t(`avvio.aiuto.${rotta.aiuto}`)}</p>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5"
        disabled={diagnosi.isFetching}
        onClick={() => void refetch()}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${diagnosi.isFetching ? "animate-spin" : ""}`} />
        {diagnosi.isFetching ? t("procedura.ricontrollo_in_corso") : t("procedura.ricontrolla")}
      </Button>
      <Button asChild size="sm" className="h-8 gap-1.5">
        <Link to={rotta.to}>
          {t("procedura.vai_a", { destinazione: t(`avvio.destinazioni.${rotta.chiave}`) })} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Button>
      <button type="button" onClick={esci} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        {t("procedura.esci")}
      </button>
    </div>
  );
}

/** «Riprendi la procedura guidata»: compare solo se l'utente l'ha chiusa. */
export function RiprendiProceduraButton() {
  const { t } = useTranslation("onboarding");
  const { session } = useAuth();
  const { nascosta, pronto_chiuso, riprendi } = use_preferenze_procedura(session?.club_id);
  if (!session || !RUOLI_AVVIO_CLUB.includes(session.ruolo)) return null;
  if (!nascosta && !pronto_chiuso) return null;
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={riprendi}>
      <Compass className="w-4 h-4" /> {t("procedura.riprendi")}
    </Button>
  );
}
