import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/**
 * Lista di avvio del club, alimentata dalla funzione DB diagnosi_avvio_club(club_id).
 * Mostra i controlli non superati con il relativo dettaglio e un collegamento
 * alla schermata dove risolverli. Si nasconde con la X (persistito su clubs).
 */

interface RigaDiagnosi {
  passo: number;
  area: string;
  controllo: string;
  esito: string;
  dettaglio: string | null;
  blocca: boolean;
}

const ROTTA_PER_AREA: Record<string, { to: string; label: string }> = {
  Anagrafica: { to: "/club-setup", label: "Setup del club" },
  Accesso: { to: "/utenti", label: "Utenti e permessi" },
  Stagione: { to: "/club-setup", label: "Date stagione" },
  Ghiaccio: { to: "/club-setup", label: "Risorse e disponibilità" },
  Offerta: { to: "/corsi", label: "Corsi e istruttori" },
  Atleti: { to: "/atleti", label: "Atleti" },
  Fatturazione: { to: "/club-setup", label: "Fatturazione" },
  Comunicazioni: { to: "/comunicazioni", label: "Comunicazioni" },
  "App famiglie": { to: "/atleti", label: "Atleti" },
};

const rotta_area = (area: string) => ROTTA_PER_AREA[area] ?? { to: "/club-setup", label: "Setup del club" };

export default function OnboardingBanner() {
  const { session } = useAuth();
  const club_id = session?.club_id;
  const [chiuso_localmente, set_chiuso_localmente] = useState(false);

  const { data: banner_chiuso } = useQuery({
    queryKey: ["clubs", "banner_onboarding_chiuso", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clubs")
        .select("banner_onboarding_chiuso")
        .eq("id", club_id)
        .maybeSingle();
      return !!data?.banner_onboarding_chiuso;
    },
  });

  const { data: righe = [], isLoading } = useQuery({
    queryKey: ["diagnosi_avvio_club", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("diagnosi_avvio_club" as any, { p_club: club_id });
      if (error) throw error;
      return (data ?? []) as RigaDiagnosi[];
    },
  });

  const mancanti = useMemo(
    () => (righe ?? []).filter((r) => r.esito !== "✓").sort((a, b) => Number(b.blocca) - Number(a.blocca) || a.passo - b.passo),
    [righe]
  );
  const bloccanti = mancanti.filter((r) => r.blocca).length;
  const tutto_ok = !isLoading && (righe?.length ?? 0) > 0 && mancanti.length === 0;

  const handle_close = async () => {
    if (!club_id) return;
    set_chiuso_localmente(true);
    const { error } = await supabase
      .from("clubs")
      .update({ banner_onboarding_chiuso: true })
      .eq("id", club_id);
    if (error) {
      set_chiuso_localmente(false);
      toast.error("Non è stato possibile chiudere il messaggio");
      return;
    }
    toast.success("Messaggio nascosto");
  };

  if (!club_id || banner_chiuso || chiuso_localmente) return null;
  if (isLoading || (righe?.length ?? 0) === 0) return null;

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-5 md:p-6 shadow-sm animate-fade-in">
      <button
        type="button"
        onClick={handle_close}
        aria-label="Chiudi"
        className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="hidden sm:flex w-12 h-12 rounded-xl bg-primary/15 items-center justify-center text-primary shrink-0">
          {tutto_ok ? <CheckCircle2 className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
            {tutto_ok ? "Configurazione completata" : "Avvio del club: cosa manca"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            {tutto_ok
              ? `Tutti i ${righe.length} controlli di avvio sono superati. Il club è operativo.`
              : `${mancanti.length} controlli su ${righe.length} non sono ancora a posto${
                  bloccanti > 0 ? `, di cui ${bloccanti} bloccanti` : ""
                }.`}
          </p>

          {!tutto_ok && (
            <ul className="mt-4 space-y-2">
              {mancanti.map((r) => {
                const rotta = rotta_area(r.area);
                return (
                  <li
                    key={r.passo}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm ${
                      r.blocca
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-background/60"
                    }`}
                  >
                    {r.blocca ? (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-[12rem]">
                      <span className={`font-medium ${r.blocca ? "text-destructive" : "text-foreground"}`}>
                        {r.controllo}
                      </span>
                      <span className="text-muted-foreground"> — {r.area}</span>
                      {r.dettaglio && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.dettaglio}</p>
                      )}
                    </div>
                    <Button asChild size="sm" variant={r.blocca ? "default" : "outline"} className="gap-1.5">
                      <Link to={rotta.to}>
                        {rotta.label} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
