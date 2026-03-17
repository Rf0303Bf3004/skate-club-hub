import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import CommunicationsPage from "@/pages/CommunicationsPage";
import SeasonsPage from "@/pages/SeasonsPage";
import TrainingCampsPage from "@/pages/TrainingCampsPage";
import ClubSetupPage from "@/pages/ClubSetupPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AuthenticatedApp = () => {
  const { is_authenticated } = useAuth();

  if (!is_authenticated) return <LoginPage />;

  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/atleti" element={<AthletesPage />} />
          <Route path="/istruttori" element={<InstructorsPage />} />
          <Route path="/corsi" element={<CoursesPage />} />
          <Route path="/gare" element={<CompetitionsPage />} />
          <Route path="/lezioni-private" element={<PrivateLessonsPage />} />
          <Route path="/fatture" element={<InvoicesPage />} />
          <Route path="/comunicazioni" element={<CommunicationsPage />} />
          <Route path="/stagioni" element={<SeasonsPage />} />
          <Route path="/campi" element={<TrainingCampsPage />} />
          <Route path="/setup-club" element={<ClubSetupPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthenticatedApp />
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
