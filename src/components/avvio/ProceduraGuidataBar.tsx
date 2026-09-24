import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2, Compass, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { segnala_errore } from "@/lib/errori";
import {
  RUOLI_AVVIO_CLUB,
  riga_bloccante_aperta,
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

  const bloccanti = useMemo(
    () => (diagnosi.data ?? []).filter((r) => r.blocca).sort((a, b) => a.passo - b.passo),
    [diagnosi.data],
  );
  const corrente = bloccanti.find(riga_bloccante_aperta);

  // «Fatto: …» quando il passo corrente di prima risulta ora superato.
  const passo_precedente = useRef<number | null>(null);
  const [fatto, set_fatto] = useState<string | null>(null);
  useEffect(() => {
    if (!diagnosi.isSuccess) return;
    const prima = passo_precedente.current;
    const ora = corrente?.passo ?? null;
    if (prima !== null && prima !== ora) {
      const superata = bloccanti.find((r) => r.passo === prima && r.esito === "✓");
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

  // Fallita, o non ancora arrivata: nessun passo, nessun «pronto».
  if (!diagnosi.isSuccess) {
    return (
      <div className={`${cornice} bg-muted/80 backdrop-blur-md border-border flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground`}>
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

  if (fatto) {
    return (
      <div role="status" className={`${cornice} bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 flex items-center gap-3 animate-fade-in`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-medium text-foreground truncate">{t("procedura.fatto", { controllo: fatto })}</span>
      </div>
    );
  }

  if (!corrente) {
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

  const n = bloccanti.indexOf(corrente) + 1;
  const rotta = rotta_riga(corrente);

  return (
    <div className={`${cornice} bg-primary/10 backdrop-blur-md border-primary/20 flex flex-wrap items-center gap-x-4 gap-y-1.5`}>
      <Compass className="w-4 h-4 text-primary shrink-0 hidden sm:block" />
      <div className="flex-1 min-w-[12rem]">
        <p className="text-xs font-semibold text-primary">
          {t("procedura.titolo")} · {t("procedura.passo", { n, m: bloccanti.length })}
        </p>
        <p className="text-foreground truncate">
          <span className="font-medium">{corrente.controllo}</span>
          {corrente.dettaglio && <span className="text-muted-foreground"> — {corrente.dettaglio}</span>}
        </p>
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
          {t("procedura.vai")} <ArrowRight className="w-3.5 h-3.5" />
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
