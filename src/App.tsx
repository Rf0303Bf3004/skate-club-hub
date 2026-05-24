import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import MainLayout from "@/components/MainLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import AthletesPage from "@/pages/AthletesPage";
import InstructorsPage from "@/pages/InstructorsPage";
import CoursesPage from "@/pages/CoursesPage";
import CompetitionsPage from "@/pages/CompetitionsPage";
import PrivateLessonsPage from "@/pages/PrivateLessonsPage";
import InvoicesPage from "@/pages/InvoicesPage";
import SegreteriaFatturePage from "@/pages/SegreteriaFatturePage";
import CommunicationsPage from "@/pages/CommunicationsPage";
import SeasonsPage from "@/pages/SeasonsPage";

import PlanningPage from "@/pages/PlanningPage";
import ClubSetupPage from "@/pages/ClubSetupPage";
import AdvancedManagementPage from "@/pages/AdvancedManagementPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import SuperAdminClubPage from "@/pages/SuperAdminClubPage";
import SuperAdminManutenzione from "@/pages/SuperAdminManutenzione";
import SuperAdminManutenzioneStr from "@/pages/SuperAdminManutenzioneStr";
import SuperAdminBillingDashboardPage from "@/pages/SuperAdminBillingDashboardPage";
import SuperAdminTabelloneFatturePage from "@/pages/SuperAdminTabelloneFatturePage";
import SuperAdminListinoPage from "@/pages/SuperAdminListinoPage";
import SuperAdminClubDetailPage from "@/pages/SuperAdminClubDetailPage";
import NotFound from "@/pages/NotFound";
import RuoliPermessiPage from "@/pages/RuoliPermessiPage";
import UtentiPage from "@/pages/UtentiPage";
import RichiesteIscrizionePage from "@/pages/RichiesteIscrizionePage";
import NuovaStagionePage from "@/pages/NuovaStagionePage";
import TestLivelloPage from "@/pages/TestLivelloPage";
import PortaleAtletaPage from "@/pages/PortaleAtletaPage";
import CampiEventiPage from "@/pages/CampiEventiPage";
import MedagliereePage from "@/pages/MedagliereePage";
import TestMobileAuthPage from "@/pages/TestMobileAuthPage";
import ImportAtletiPage from "@/pages/ImportAtletiPage";
import EventiPage from "@/pages/EventiPage";
import PresidentRelazioneGestione from "@/pages/PresidentRelazioneGestione";
import PresidentRelazione from "@/pages/PresidentRelazione";
import PacchettiSponsorPage from "@/pages/PacchettiSponsorPage";
import RegisterClubPage from "@/pages/RegisterClubPage";
import OnboardingPage from "@/pages/OnboardingPage";
import LegalPlaceholderPage from "@/pages/LegalPlaceholderPage";

const queryClient = new QueryClient();

// Pagine pubbliche (no auth) gestite prima del gate di autenticazione.
const PublicRoutes = ({ children }: { children: React.ReactNode }) => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path === "/portale-atleta" || path.startsWith("/portale-atleta/")) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/portale-atleta" element={<PortaleAtletaPage />} />
          <Route path="/portale-atleta/:token" element={<PortaleAtletaPage />} />
        </Routes>
      </BrowserRouter>
    );
  }
  if (path === "/registrati") {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/registrati" element={<RegisterClubPage />} />
        </Routes>
      </BrowserRouter>
    );
  }
  if (path === "/termini" || path === "/privacy") {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/termini" element={<LegalPlaceholderPage titolo="Termini e Condizioni" />} />
          <Route path="/privacy" element={<LegalPlaceholderPage titolo="Informativa Privacy" />} />
        </Routes>
      </BrowserRouter>
    );
  }
  return <>{children}</>;
};

const SmartHome = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  useEffect(() => {
    if (session?.ruolo === "superadmin") {
      navigate("/superadmin", { replace: true });
    }
  }, [session, navigate]);
  return session?.ruolo === "superadmin" ? null : <DashboardPage />;
};

const ProtectedSuperAdmin = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const { session } = useAuth();
  useEffect(() => {
    if (session && session.ruolo !== "superadmin") {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);
  return session?.ruolo === "superadmin" ? <>{children}</> : null;
};

const AuthenticatedApp = () => {
  const { is_authenticated, is_loading } = useAuth();

  if (is_loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!is_authenticated) return <LoginPage />;

  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<SmartHome />} />
          <Route path="/atleti" element={<AthletesPage />} />
          <Route path="/atleti/:id" element={<AthletesPage />} />
          <Route path="/istruttori" element={<InstructorsPage />} />
          <Route path="/corsi" element={<CoursesPage />} />
          <Route path="/gare" element={<CompetitionsPage />} />
          <Route path="/gare/:id" element={<CompetitionsPage />} />
          <Route path="/test" element={<TestLivelloPage />} />
          <Route path="/test/:id" element={<TestLivelloPage />} />
          <Route path="/lezioni-private" element={<PrivateLessonsPage />} />
          <Route path="/eventi" element={<EventiPage />} />
          <Route path="/eventi/:id" element={<EventiPage />} />
          <Route path="/fatture" element={<InvoicesPage />} />
          <Route path="/segreteria/fatture" element={<SegreteriaFatturePage />} />
          <Route path="/comunicazioni" element={<CommunicationsPage />} />
          <Route path="/stagioni" element={<SeasonsPage />} />
          <Route path="/campi-eventi" element={<CampiEventiPage />} />
          <Route path="/medagliere" element={<MedagliereePage />} />
          <Route path="/pre-season" element={<Navigate to="/campi-eventi" replace />} />
          <Route path="/post-season" element={<Navigate to="/campi-eventi" replace />} />
          {/* Alias rotte sidebar (varianti URL "lunghe") */}
          <Route path="/test-livello" element={<Navigate to="/test" replace />} />
          <Route path="/planning-ghiaccio" element={<Navigate to="/planning" replace />} />
          <Route path="/configurazione-club" element={<Navigate to="/setup-club" replace />} />
          <Route path="/gestione-ruoli" element={<Navigate to="/ruoli-permessi" replace />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/setup-club" element={<ClubSetupPage />} />
          <Route path="/gestione-avanzata" element={<AdvancedManagementPage />} />
          <Route path="/richieste-iscrizione" element={<RichiesteIscrizionePage />} />
          <Route path="/ruoli-permessi" element={<RuoliPermessiPage />} />
          <Route path="/utenti" element={<UtentiPage />} />
          <Route path="/nuova-stagione" element={<NuovaStagionePage />} />
          <Route path="/test-mobile-auth" element={<TestMobileAuthPage />} />
          <Route path="/import-atleti" element={<ImportAtletiPage />} />
          <Route path="/pacchetti-sponsor" element={<PacchettiSponsorPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/presidente/relazione" element={<PresidentRelazione />} />
          <Route path="/presidente/relazione/contenuti" element={<PresidentRelazione />} />
          <Route path="/presidente/gestione-relazione" element={<Navigate to="/presidente/relazione/contenuti" replace />} />
          <Route
            path="/superadmin"
            element={
              <ProtectedSuperAdmin>
                <SuperAdminBillingDashboardPage />
              </ProtectedSuperAdmin>
            }
          />
          <Route
            path="/superadmin/tabellone"
            element={<ProtectedSuperAdmin><SuperAdminTabelloneFatturePage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/listino"
            element={<ProtectedSuperAdmin><SuperAdminListinoPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/clubs/:id"
            element={<ProtectedSuperAdmin><SuperAdminClubDetailPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/operazioni"
            element={<ProtectedSuperAdmin><SuperAdminPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/club"
            element={
              <ProtectedSuperAdmin>
                <SuperAdminClubPage />
              </ProtectedSuperAdmin>
            }
          />
          <Route
            path="/superadmin/manutenzione"
            element={
              <ProtectedSuperAdmin>
                <SuperAdminManutenzione />
              </ProtectedSuperAdmin>
            }
          />
          <Route
            path="/superadmin/manutenzione-straordinaria"
            element={
              <ProtectedSuperAdmin>
                <SuperAdminManutenzioneStr />
              </ProtectedSuperAdmin>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PublicRoutes>
          <AuthProvider>
            <AuthenticatedApp />
          </AuthProvider>
        </PublicRoutes>
      </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
