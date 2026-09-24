import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AlertTriangle, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { segnala_errore } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import OnboardingPage from "@/pages/OnboardingPage";

/**
 * Finché il club non ha completato la configurazione iniziale
 * (`clubs.onboarding_completato = false`), presidenza e amministrazione
 * vedono soltanto il wizard: ogni altro indirizzo riporta a /onboarding.
 * Il superadmin e gli altri ruoli passano senza controllo.
 *
 * Tre stati: completato → app; non completato → wizard;
 * lettura fallita o non ancora arrivata → niente app (errore con riprova ed uscita).
 */
const RUOLI_SOGGETTI_A_ONBOARDING = ["presidente", "vicepresidente", "admin"];

export const chiave_onboarding_club = (club_id: string | undefined) => ["onboarding_completato", club_id] as const;

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("onboarding");
  const { session, logout } = useAuth();
  const soggetto = !!session && RUOLI_SOGGETTI_A_ONBOARDING.includes(session.ruolo);

  const stato = useQuery({
    queryKey: chiave_onboarding_club(session?.club_id),
    enabled: soggetto,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("clubs")
        .select("onboarding_completato")
        .eq("id", session!.club_id)
        .single();
      if (error) throw error;
      return data.onboarding_completato === true;
    },
  });

  useEffect(() => {
    if (stato.isError) {
      void segnala_errore("OnboardingGate", t("wizard.gate_error"), stato.error, undefined, "avviso");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stato.isError]);

  if (!soggetto) return <>{children}</>;
  if (stato.isSuccess && stato.data) return <>{children}</>;

  if (stato.isError) {
    return (
      <div className="min-h-mobile flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm">{t("wizard.gate_error")}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => void stato.refetch()}>{t("wizard.retry")}</Button>
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="h-4 w-4 mr-1" /> {t("wizard.logout")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!stato.isSuccess) {
    return (
      <div className="min-h-mobile flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
