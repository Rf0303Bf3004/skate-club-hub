import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { segnala_errore, messaggio_leggibile } from "@/lib/errori";

/**
 * Pagina "Avvio del club": percorso completo di configurazione.
 * A differenza di OnboardingBanner (solo i buchi, chiudibile), qui si vedono
 * TUTTE le righe di diagnosi_avvio_club, anche quelle superate. Sola lettura.
 * Testi in italiano scritti qui: pagina nata per una demo, senza i18n.
 */

interface RigaDiagnosi {
  passo: number;
  area: string;
  controllo: string;
  esito: string;
  dettaglio: string | null;
  blocca: boolean;
}

// Stessa mappa di OnboardingBanner.
const ROTTA_PER_AREA: Record<string, { to: string; label: string }> = {
  Anagrafica: { to: "/setup-club", label: "Setup del club" },
  Accesso: { to: "/utenti", label: "Utenti e permessi" },
  Stagione: { to: "/setup-club", label: "Date stagione" },
  Ghiaccio: { to: "/setup-club", label: "Risorse e disponibilità" },
  Offerta: { to: "/corsi", label: "Corsi e istruttori" },
  Atleti: { to: "/atleti", label: "Atleti" },
  Fatturazione: { to: "/setup-club", label: "Fatturazione" },
  Comunicazioni: { to: "/comunicazioni", label: "Comunicazioni" },
  "App famiglie": { to: "/atleti", label: "Atleti" },
};

const rotta_area = (area: string) => ROTTA_PER_AREA[area] ?? { to: "/setup-club", label: "Setup del club" };

const icona_esito = (esito: string) => {
  if (esito === "✓") return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
  if (esito === "⚠") return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
  return <XCircle className="w-5 h-5 text-destructive shrink-0" />;
};

export default function AvvioClubPage() {
  const { session } = useAuth();
  const club_id = session?.club_id;

  const { data: righe = [], isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["diagnosi_avvio_club", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("diagnosi_avvio_club" as any, { p_club: club_id });
      if (error) throw error;
      return (data ?? []) as RigaDiagnosi[];
    },
  });

  const gruppi = useMemo(() => {
    const mappa = new Map<string, RigaDiagnosi[]>();
    for (const r of righe) {
      const lista = mappa.get(r.area) ?? [];
      lista.push(r);
      mappa.set(r.area, lista);
    }
    return Array.from(mappa.entries());
  }, [righe]);

  const a_posto = righe.filter((r) => r.esito === "✓").length;
  const bloccanti_aperte = righe.filter((r) => r.blocca && r.esito !== "✓").length;
  const avanzamento = righe.length > 0 ? Math.round((a_posto / righe.length) * 100) : 0;

  if (!club_id) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">Avvio del club</h1>
        <p className="mt-1 text-muted-foreground">Quello che serve perché il club possa lavorare</p>
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          Nessun club è collegato a questa sessione. Esci e rientra, poi riprova.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Avvio del club</h1>
        <p className="mt-1 text-muted-foreground">Quello che serve perché il club possa lavorare</p>
      </div>

      {isPending && (
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
              <p className="font-medium text-destructive">L'elenco dei controlli non è disponibile</p>
              <p className="text-sm text-muted-foreground mt-1">
                {messaggio_leggibile(error)} Non significa che non ci sia lavoro in sospeso: semplicemente non sono riuscito a leggerlo.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isRefetching}
            onClick={() => {
              refetch().catch((e) => segnala_errore("AvvioClubPage", "Lettura controlli di avvio", e, undefined, "avviso"));
            }}
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> Riprova
          </Button>
        </div>
      )}

      {!isPending && !isError && (
        <>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-lg font-semibold text-foreground">
                {a_posto} di {righe.length} a posto
              </p>
              <span className="text-sm text-muted-foreground">{avanzamento}%</span>
            </div>
            <Progress value={avanzamento} />
            {bloccanti_aperte > 0 && (
              <p className="text-sm font-medium text-destructive">
                {bloccanti_aperte === 1
                  ? "C'è 1 controllo bloccante da risolvere: il club non è pronto a lavorare finché non è a posto."
                  : `Ci sono ${bloccanti_aperte} controlli bloccanti da risolvere: il club non è pronto a lavorare finché non sono a posto.`}
              </p>
            )}
          </div>

          {gruppi.map(([area, controlli]) => (
            <section key={area} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">{area}</h2>
              <ul className="space-y-2">
                {controlli.map((r) => {
                  const rotta = rotta_area(r.area);
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
                      </div>
                      <Button asChild size="sm" variant={ok ? "ghost" : "default"} className="gap-1.5">
                        <Link to={rotta.to}>
                          {rotta.label} <ArrowRight className="w-3.5 h-3.5" />
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
