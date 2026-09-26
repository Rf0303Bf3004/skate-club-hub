import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, RefreshCw } from "lucide-react";
import { avanzamento_avvio, rotta_riga, use_diagnosi_avvio, type RigaDiagnosi } from "@/lib/avvio-club";
import { RiprendiProceduraButton } from "@/components/avvio/ProceduraGuidataBar";
import { useAuth } from "@/lib/auth";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { segnala_errore, messaggio_leggibile } from "@/lib/errori";

/**
 * Pagina "Avvio del club": percorso completo di configurazione.
 * A differenza di OnboardingBanner (solo i buchi, chiudibile), qui si vedono
 * TUTTE le righe di diagnosi_avvio_club, anche quelle superate. Sola lettura.
 * Le colonne `area`, `controllo` e `dettaglio` arrivano dal database in italiano
 * e non vengono tradotte; i testi della pagina passano da i18n (onboarding.avvio.*).
 */

const icona_esito = (esito: string) => {
  if (esito === "✓") return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
  if (esito === "⚠") return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
  return <XCircle className="w-5 h-5 text-destructive shrink-0" />;
};

export default function AvvioClubPage() {
  const { t } = useTranslation("onboarding");
  const { session } = useAuth();
  const club_id = session?.club_id;
  const { modalita: modalita_ghiaccio } = useModalitaArea("ghiaccio");

  const { data: righe = [], isPending, isError, error, refetch, isRefetching } = use_diagnosi_avvio(club_id);

  useEffect(() => {
    if (isError) void segnala_errore("AvvioClubPage", t("avvio.errore_lettura"), error, undefined, "avviso");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError]);

  const gruppi = useMemo(() => {
    const mappa = new Map<string, RigaDiagnosi[]>();
    for (const r of righe) {
      const lista = mappa.get(r.area) ?? [];
      lista.push(r);
      mappa.set(r.area, lista);
    }
    return Array.from(mappa.entries());
  }, [righe]);

  const { a_posto, bloccanti_aperte, percentuale: avanzamento } = avanzamento_avvio(righe);

  const intestazione = (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("avvio.titolo")}</h1>
      <p className="mt-1 text-muted-foreground">{t("avvio.sottotitolo")}</p>
    </div>
  );

  if (!club_id) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {intestazione}
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          {t("avvio.nessun_club")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {intestazione}
        <RiprendiProceduraButton />
      </div>

      {isPending && !isError && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-1/3 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">{t("avvio.errore_titolo")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {messaggio_leggibile(error)} {t("avvio.errore_dettaglio")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isRefetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> {t("avvio.riprova")}
          </Button>
        </div>
      )}

      {!isPending && !isError && (
        <>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-lg font-semibold text-foreground">
                {t("avvio.a_posto", { a_posto, totale: righe.length })}
              </p>
              <span className="text-sm text-muted-foreground">{avanzamento}%</span>
            </div>
            <Progress value={avanzamento} />
            {bloccanti_aperte > 0 && (
              <p className="text-sm font-medium text-destructive">
                {t("avvio.bloccanti", { count: bloccanti_aperte })}
              </p>
            )}
          </div>

          {gruppi.map(([area, controlli]) => (
            <section key={area} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">{area}</h2>
              <ul className="space-y-2">
                {controlli.map((r) => {
                  const rotta = rotta_riga(r, modalita_ghiaccio);
                  const ok = r.esito === "✓";
                  return (
                    <li
                      key={r.passo}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-4 ${
                        !ok && r.blocca
                          ? "border-destructive/40 bg-destructive/5"
                          : !ok
                            ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/10"
                            : "border-border bg-card"
                      }`}
                    >
                      {icona_esito(r.esito)}
                      <div className="flex-1 min-w-[12rem]">
                        <span className={`font-medium ${!ok && r.blocca ? "text-destructive" : "text-foreground"}`}>
                          {r.controllo}
                        </span>
                        {r.dettaglio && (
                          <p className="text-xs text-muted-foreground mt-0.5">{r.dettaglio}</p>
                        )}
                        {!ok && rotta.aiuto && (
                          <p className="text-xs text-foreground mt-1">{t(`avvio.aiuto.${rotta.aiuto}`)}</p>
                        )}
                      </div>
                      <Button asChild size="sm" variant={ok ? "ghost" : "default"} className="gap-1.5">
                        <Link to={rotta.to}>
                          {t("procedura.vai_a", { destinazione: t(`avvio.destinazioni.${rotta.chiave}`) })} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
