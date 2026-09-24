import React, { useEffect } from "react";
import { usePermessiSezioniMatrix } from "@/hooks/usePermessi";
import { toast } from "@/hooks/use-toast";
import GrigliaGhiaccioPage from "@/pages/GrigliaGhiaccioPage";
import PistaPage from "@/pages/PistaPage";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import MainLayout from "@/components/MainLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PresidentDashboard from "@/components/dashboard/PresidentDashboard";
import IstruttoreDashboard from "@/components/dashboard/IstruttoreDashboard";
import DTDashboard from "@/components/dashboard/DTDashboard";
import SegreteriaDashboard from "@/components/dashboard/SegreteriaDashboard";
import DiagnosticaPage from "@/pages/DiagnosticaPage";
import AthletesPage from "@/pages/AthletesPage";
import InstructorsPage from "@/pages/InstructorsPage";
import CoursesPage from "@/pages/CoursesPage";
import CompetitionsPage from "@/pages/CompetitionsPage";
import PrivateLessonsPage from "@/pages/PrivateLessonsPage";
import InvoicesPage from "@/pages/InvoicesPage";
import EsportaContabilitaPage from "@/pages/EsportaContabilitaPage";
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
import SuperAdminNewClubPage from "@/pages/SuperAdminNewClubPage";
import SuperAdminFatturaDetailPage from "@/pages/SuperAdminFatturaDetailPage";
import NotFound from "@/pages/NotFound";
import RuoliPermessiPage from "@/pages/RuoliPermessiPage";
import UtentiPage from "@/pages/UtentiPage";
import RichiesteIscrizionePage from "@/pages/RichiesteIscrizionePage";
import ProvaGratuitaPage from "@/pages/ProvaGratuitaPage";
import NuovaStagionePage from "@/pages/NuovaStagionePage";
import TestLivelloPage from "@/pages/TestLivelloPage";
import PortaleAtletaPage from "@/pages/PortaleAtletaPage";
import MedagliereePage from "@/pages/MedagliereePage";
import TestMobileAuthPage from "@/pages/TestMobileAuthPage";
import ImportAtletiPage from "@/pages/ImportAtletiPage";
import EventiPage from "@/pages/EventiPage";
import PresidentRelazione from "@/pages/PresidentRelazione";
import PacchettiSponsorPage from "@/pages/PacchettiSponsorPage";
import RegisterClubPage from "@/pages/RegisterClubPage";
import OnboardingPage from "@/pages/OnboardingPage";
import { OnboardingGate } from "@/components/OnboardingGate";
import LegalPlaceholderPage from "@/pages/LegalPlaceholderPage";
import TerminiPage from "@/pages/TerminiPage";
import PrivacyPage from "@/pages/PrivacyPage";
import RecoveryPage from "@/pages/RecoveryPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import SuperAdminUtentiPage from "@/pages/SuperAdminUtentiPage";
import SuperAdminConvenzioniPage from "@/pages/SuperAdminConvenzioniPage";
import SuperAdminAppMobilePage from "@/pages/SuperAdminAppMobilePage";
import SuperAdminTraduzioniPage from "@/pages/SuperAdminTraduzioniPage";
import ConvenzioniSociPage from "@/pages/ConvenzioniSociPage";
import AvvioClubPage from "@/pages/AvvioClubPage";
import { use_diagnosi_avvio, ha_bloccanti_aperti, invalida_diagnosi_avvio } from "@/lib/avvio-club";
import { RiprendiProceduraButton } from "@/components/avvio/ProceduraGuidataBar";
import EsportazioniPage from "@/pages/EsportazioniPage";
import AssenzeStaffPage from "@/pages/AssenzeStaffPage";

import ConvenzionePubblicaPage from "@/pages/ConvenzionePubblicaPage";
import CampoOspitePubblicoPage from "@/pages/CampoOspitePubblicoPage";
import CalendarioPubblicoPage from "@/pages/CalendarioPubblicoPage";
import PortaleLoginPage from "@/pages/portale/PortaleLoginPage";
import PortaleLayout from "@/pages/portale/PortaleLayout";
import PortaleHomePage from "@/pages/portale/PortaleHomePage";
import PortaleCalendarioPage from "@/pages/portale/PortaleCalendarioPage";
import PortaleEventiPage from "@/pages/portale/PortaleEventiPage";
import PortaleNotiziePage from "@/pages/portale/PortaleNotiziePage";
import PortaleProfiloPage from "@/pages/portale/PortaleProfiloPage";
import AtletaTab from "@/pages/portale/profilo/AtletaTab";
import CorsiTab from "@/pages/portale/profilo/CorsiTab";
import FattureTab from "@/pages/portale/profilo/FattureTab";
import ConvenzioniTab from "@/pages/portale/profilo/ConvenzioniTab";
import FatturaDetailPage from "@/pages/portale/profilo/FatturaDetailPage";
import SegreteriaFatturaDetailPage from "@/pages/SegreteriaFatturaDetailPage";
import LandingPage from "@/pages/LandingPage";
import CaricaFotoPage from "@/pages/CaricaFotoPage";
import IscrizioneAtletaPage from "@/pages/IscrizioneAtletaPage";
import IscrivitiPage from "@/pages/IscrivitiPage";
import PistaLoginPage from "@/pages/PistaLoginPage";
import { usePistaSession } from "@/lib/pista-sessione";
import { accedi_pista_con_codice, cancella_codice_pista, chiudi_sessione_pista, leggi_codice_pista } from "@/lib/pista-codice";


/**
 * Le pagine pubbliche non appartengono a nessuna sessione — né al tablet
 * della pista né a quella amministrativa — quindi nessun gate di dispositivo
 * le deve intercettare. L'elenco sta qui in un posto solo: PublicRoutes lo
 * usa per scegliere le rotte e PistaGate per lasciarle passare, così i due
 * non possono divergere.
 */
interface GruppoPercorsoPubblico {
  corrisponde: (path: string) => boolean;
  rotte: React.ReactNode;
}

const PERCORSI_PUBBLICI: GruppoPercorsoPubblico[] = [
  {
    corrisponde: (p) => p === "/portale-atleta" || p.startsWith("/portale-atleta/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/portale-atleta" element={<PortaleAtletaPage />} />
          <Route path="/portale-atleta/:token" element={<PortaleAtletaPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p.startsWith("/carica-foto/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/carica-foto/:codice_atleta" element={<CaricaFotoPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p.startsWith("/iscrizione/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/iscrizione/:codice_atleta" element={<IscrizioneAtletaPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p.startsWith("/iscriviti/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/iscriviti/:token" element={<IscrivitiPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p.startsWith("/prova/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/prova/:slug" element={<ProvaGratuitaPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p.startsWith("/campo-ospite/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/campo-ospite/:token" element={<CampoOspitePubblicoPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p === "/calendario" || p.startsWith("/calendario/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/calendario" element={<CalendarioPubblicoPage />} />
          <Route path="/calendario/:slug" element={<CalendarioPubblicoPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p === "/pista-login",
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/pista-login" element={<PistaLoginPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p.startsWith("/c/"),
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/c/:token" element={<ConvenzionePubblicaPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) =>
      p === "/mio-club" || p.startsWith("/mio-club/") ||
      p === "/portale" || p.startsWith("/portale/") ||
      p === "/portale-recovery" || p === "/reset-password",
    rotte: (
      <BrowserRouter>
        <Routes>
          {/* Redirect permanente da vecchio /portale → /mio-club */}
          <Route path="/portale" element={<Navigate to="/mio-club" replace />} />
          <Route path="/portale/home" element={<Navigate to="/mio-club/home" replace />} />
          <Route path="/portale/calendario" element={<Navigate to="/mio-club/calendario" replace />} />
          <Route path="/portale/eventi" element={<Navigate to="/mio-club/eventi" replace />} />
          <Route path="/portale/notizie" element={<Navigate to="/mio-club/notizie" replace />} />
          <Route path="/portale/profilo" element={<Navigate to="/mio-club/profilo" replace />} />
          <Route path="/portale/profilo/atleta" element={<Navigate to="/mio-club/profilo/atleta" replace />} />
          <Route path="/portale/profilo/corsi" element={<Navigate to="/mio-club/profilo/corsi" replace />} />
          <Route path="/portale/profilo/fatture" element={<Navigate to="/mio-club/profilo/fatture" replace />} />
          <Route path="/portale/profilo/convenzioni" element={<Navigate to="/mio-club/profilo/convenzioni" replace />} />

          <Route path="/mio-club" element={<PortaleLoginPage />} />
          <Route path="/portale-recovery" element={<RecoveryPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/mio-club" element={<PortaleLayout />}>
            <Route path="home" element={<PortaleHomePage />} />
            <Route path="calendario" element={<PortaleCalendarioPage />} />
            <Route path="eventi" element={<PortaleEventiPage />} />
            <Route path="notizie" element={<PortaleNotiziePage />} />
            <Route path="profilo" element={<PortaleProfiloPage />}>
              <Route path="atleta" element={<AtletaTab />} />
              <Route path="corsi" element={<CorsiTab />} />
              <Route path="fatture" element={<FattureTab />} />
              <Route path="fatture/:id" element={<FatturaDetailPage />} />
              <Route path="convenzioni" element={<ConvenzioniTab />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p === "/registrati",
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/registrati" element={<RegisterClubPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
  {
    corrisponde: (p) => p === "/termini" || p === "/privacy",
    rotte: (
      <BrowserRouter>
        <Routes>
          <Route path="/termini" element={<TerminiPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </BrowserRouter>
    ),
  },
];

/** Vero se l'indirizzo aperto è una pagina pubblica: nessun gate la intercetta. */
const e_percorso_pubblico = (path: string): boolean =>
  PERCORSI_PUBBLICI.some((g) => g.corrisponde(path));

// Ogni mutazione riuscita (useMutation, in qualsiasi file) fa rileggere la
// diagnosi di avvio: la procedura guidata avanza senza attendere un cambio pagina.
const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => { void invalida_diagnosi_avvio(queryClient); },
  }),
});

/**
 * Sessione «pista»: il tablet entra con il codice del club e resta sulla pista.
 * Non ha riga in utenti_club, quindi non esiste per l'amministrazione:
 * qualunque altra rotta riporta a /pista. Fanno eccezione le pagine
 * pubbliche (PERCORSI_PUBBLICI), che passano oltre senza essere intercettate.
 */
const PistaGate = ({ children }: { children: React.ReactNode }) => {
  const { is_pista, is_loading } = usePistaSession();
  // Riaccredito silenzioso: il tablet ha già il codice conservato, non deve
  // chiedere niente quando la sessione scade.
  const [riaccredito, set_riaccredito] = React.useState<"idle" | "in_corso" | "fallito">("idle");

  // Arrivare al tastierino significa: questo dispositivo sta per essere
  // configurato (o liberato). Il codice conservato si cancella SEMPRE, anche
  // se la sessione del tablet è già scaduta: altrimenti resta un tablet
  // dormiente che il riaccredito silenzioso su /pista rimette in piedi da solo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/pista-login") return;
    cancella_codice_pista();
  }, []);

  // Se oltre al codice c'è ancora una sessione tablet viva, va chiusa.
  // Si chiude solo quella: chi è entrato con le proprie credenziali e passa
  // di qui non deve essere buttato fuori.
  useEffect(() => {
    if (is_loading || !is_pista) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/pista-login") return;
    void chiudi_sessione_pista();
  }, [is_loading, is_pista]);

  useEffect(() => {
    if (is_loading || is_pista || riaccredito !== "idle") return;
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/pista") return;
    const codice = leggi_codice_pista();
    if (!codice) return;
    set_riaccredito("in_corso");
    void (async () => {
      // Se qualcuno del club è già entrato con le proprie credenziali su questo
      // dispositivo, non gli si toglie la sessione per rimetterci il tablet.
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session) {
        set_riaccredito("fallito");
        return;
      }
      const esito = await accedi_pista_con_codice(codice);
      if (esito.ok) return; // la sessione cambia: il gate si ridisegna da solo
      // Tipicamente il club ha rigenerato il codice: si dimentica e si chiede.
      cancella_codice_pista();
      set_riaccredito("fallito");
      window.location.replace("/pista-login?motivo=codice_cambiato");
    })();
  }, [is_loading, is_pista, riaccredito]);

  // Tempo massimo di attesa: se la lettura della sessione non risponde, lo
  // spinner non può restare a schermo per sempre. Scaduti 8 secondi si mostra
  // comunque qualcosa di toccabile (il contenuto normale, che per un tablet
  // senza sessione è il tastierino di accesso).
  const [attesa_scaduta, set_attesa_scaduta] = React.useState(false);
  useEffect(() => {
    if (!is_loading && riaccredito !== "in_corso") {
      set_attesa_scaduta(false);
      return;
    }
    const timer = window.setTimeout(() => set_attesa_scaduta(true), 8000);
    return () => window.clearTimeout(timer);
  }, [is_loading, riaccredito]);

  if ((is_loading || riaccredito === "in_corso") && !attesa_scaduta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  // Le pagine pubbliche non appartengono al tablet della pista: passano
  // oltre anche con la sessione pista attiva. Gli effetti su /pista-login
  // dichiarati sopra restano in ogni caso (cancellazione del codice e
  // chiusura della sessione del tablet).
  if (typeof window !== "undefined" && e_percorso_pubblico(window.location.pathname)) {
    return <>{children}</>;
  }

  if (!is_pista) return <>{children}</>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/pista" element={<PistaPage sessione_pista />} />
        {/* Due vie d'uscita lasciate aperte anche con sessione pista attiva:
            chi ha creduto il proprio dispositivo un tablet, o vuole uscire,
            deve poter arrivare a una pagina che chiede credenziali invece di
            restare chiuso dentro. Non danno accesso a nessun dato. */}
        <Route path="/pista-login" element={<PistaLoginPage />} />
        <Route
          path="/staff"
          element={
            <AuthProvider>
              <LoginPage />
            </AuthProvider>
          }
        />
        <Route path="*" element={<Navigate to="/pista" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

// Pagine pubbliche (no auth) gestite prima del gate di autenticazione.
// La scelta della rotta legge la stessa lista PERCORSI_PUBBLICI usata da
// PistaGate, così l'elenco esiste in un posto solo e i due non divergono.
const PublicRoutes = ({ children }: { children: React.ReactNode }) => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const gruppo = PERCORSI_PUBBLICI.find((g) => g.corrisponde(path));
  return gruppo ? <>{gruppo.rotte}</> : <>{children}</>;
};

/**
 * Home della presidenza. Tre stati (regola 2): solo una diagnosi letta con
 * successo e senza bloccanti aperti mostra la Dashboard; lettura fallita o non
 * ancora arrivata → pagina di avvio (che gestisce caricamento ed errore con «Riprova»).
 * Non è un blocco: il menu resta navigabile.
 */
const HomePresidenza = ({ club_id }: { club_id: string | undefined }) => {
  const diagnosi = use_diagnosi_avvio(club_id);
  if (diagnosi.isSuccess && !ha_bloccanti_aperti(diagnosi.data)) {
    return (
      <>
        <div className="flex justify-end mb-4"><RiprendiProceduraButton /></div>
        <PresidentDashboard />
      </>
    );
  }
  return <AvvioClubPage />;
};

const SmartHome = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  useEffect(() => {
    if (session?.ruolo === "superadmin") {
      navigate("/superadmin", { replace: true });
    }
  }, [session, navigate]);
  if (session?.ruolo === "superadmin") return null;
  // Presidenza e amministrazione: lista di avvio finché ci sono bloccanti, poi Dashboard.
  if (session?.ruolo === "presidente" || session?.ruolo === "vicepresidente" || session?.ruolo === "admin") {
    return <HomePresidenza club_id={session.club_id} />;
  }
  // Istruttori e aiuto monitori: home unica «cosa devo fare adesso».
  if (session?.ruolo === "istruttore" || session?.ruolo === "aiuto_monitore") {
    return <IstruttoreDashboard />;
  }
  // Direttore tecnico: home unica sul ghiaccio di oggi.
  if (session?.ruolo === "dt") {
    return <DTDashboard />;
  }
  // Segreteria: home unica su iscrizioni, fatture e anagrafiche da completare.
  if (session?.ruolo === "segreteria") {
    return <SegreteriaDashboard />;
  }
  return <DashboardPage />;
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

/** Protegge una rotta in base ai permessi di sezione (ruoli_permessi_sezioni). */
const SezioneGuard = ({
  codice_sezione,
  children,
}: {
  codice_sezione: string;
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const { visibile_set, is_admin_like, is_loading } = usePermessiSezioniMatrix();
  const allowed = is_admin_like || visibile_set.has(codice_sezione);

  useEffect(() => {
    if (!is_loading && !allowed) {
      toast({ title: "Non hai accesso a questa sezione", variant: "destructive" });
      navigate("/", { replace: true });
    }
  }, [is_loading, allowed, navigate]);

  if (is_loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  return allowed ? <>{children}</> : null;
};

/** Guard per pagine riservate alla presidenza (e superadmin), senza sezione dedicata. */
const SoloPresidenteGuard = ({ children, ruoli_extra = [] }: { children: React.ReactNode; ruoli_extra?: string[] }) => {
  const navigate = useNavigate();
  const { session, is_loading } = useAuth();
  // Specchio di user_is_presidenza() del database, esteso ad amministrazione e superadmin.
  const allowed = ["superadmin", "admin", "presidente", "vicepresidente", ...ruoli_extra].includes(session?.ruolo ?? "");

  useEffect(() => {
    if (!is_loading && !allowed) {
      toast({ title: "Non hai accesso a questa sezione", variant: "destructive" });
      navigate("/", { replace: true });
    }
  }, [is_loading, allowed, navigate]);

  if (is_loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  return allowed ? <>{children}</> : null;
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

  if (!is_authenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/staff" element={<LoginPage />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <OnboardingGate>
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<SmartHome />} />
          <Route path="/staff" element={<Navigate to="/" replace />} />
          <Route path="/atleti" element={<SezioneGuard codice_sezione="atleti"><AthletesPage /></SezioneGuard>} />
          <Route path="/atleti/:id" element={<SezioneGuard codice_sezione="atleti"><AthletesPage /></SezioneGuard>} />
          <Route path="/istruttori" element={<SezioneGuard codice_sezione="istruttori"><InstructorsPage /></SezioneGuard>} />
          <Route path="/corsi" element={<SezioneGuard codice_sezione="corsi"><CoursesPage /></SezioneGuard>} />
          <Route path="/gare" element={<SezioneGuard codice_sezione="gare"><CompetitionsPage /></SezioneGuard>} />
          <Route path="/gare/:id" element={<SezioneGuard codice_sezione="gare"><CompetitionsPage /></SezioneGuard>} />
          <Route path="/test" element={<SezioneGuard codice_sezione="test_livello"><TestLivelloPage /></SezioneGuard>} />
          <Route path="/test/:id" element={<SezioneGuard codice_sezione="test_livello"><TestLivelloPage /></SezioneGuard>} />
          <Route path="/lezioni-private" element={<SezioneGuard codice_sezione="lezioni_private"><PrivateLessonsPage /></SezioneGuard>} />
          <Route path="/eventi" element={<SezioneGuard codice_sezione="eventi"><EventiPage /></SezioneGuard>} />
          <Route path="/eventi/:id" element={<Navigate to="/eventi" replace />} />
          <Route path="/fatture" element={<SezioneGuard codice_sezione="fatture"><InvoicesPage /></SezioneGuard>} />
          <Route path="/fatture/esporta-contabilita" element={<SezioneGuard codice_sezione="fatture"><EsportaContabilitaPage /></SezioneGuard>} />
          <Route path="/segreteria/fatture" element={<SezioneGuard codice_sezione="fatture"><SegreteriaFatturePage /></SezioneGuard>} />
          <Route path="/segreteria/fatture/:id" element={<SezioneGuard codice_sezione="fatture"><SegreteriaFatturaDetailPage /></SezioneGuard>} />
          <Route path="/comunicazioni" element={<SezioneGuard codice_sezione="comunicazioni"><CommunicationsPage /></SezioneGuard>} />
          <Route path="/stagioni" element={<SezioneGuard codice_sezione="stagioni"><SeasonsPage /></SezioneGuard>} />
          <Route path="/campi-eventi" element={<Navigate to="/eventi" replace />} />
          <Route path="/medagliere" element={<SezioneGuard codice_sezione="gare"><MedagliereePage /></SezioneGuard>} />
          <Route path="/pre-season" element={<Navigate to="/eventi" replace />} />
          <Route path="/post-season" element={<Navigate to="/eventi" replace />} />
          {/* Alias rotte sidebar (varianti URL "lunghe") */}
          <Route path="/test-livello" element={<Navigate to="/test" replace />} />
          <Route path="/planning-ghiaccio" element={<Navigate to="/planning" replace />} />
          <Route path="/configurazione-club" element={<Navigate to="/setup-club" replace />} />
          <Route path="/gestione-ruoli" element={<Navigate to="/ruoli-permessi" replace />} />
          <Route path="/planning" element={<SezioneGuard codice_sezione="planning_ghiaccio"><PlanningPage /></SezioneGuard>} />
          <Route path="/pista" element={<SezioneGuard codice_sezione="pista"><PistaPage /></SezioneGuard>} />
          <Route path="/griglia-ghiaccio" element={<SezioneGuard codice_sezione="griglia_ghiaccio"><GrigliaGhiaccioPage /></SezioneGuard>} />
          <Route
            path="/setup-club"
            element={
              <SezioneGuard codice_sezione="setup_club">
                <ClubSetupPage />
              </SezioneGuard>
            }
          />
          <Route path="/gestione-avanzata" element={<SezioneGuard codice_sezione="gestione_avanzata"><AdvancedManagementPage /></SezioneGuard>} />
          <Route path="/richieste-iscrizione" element={<SezioneGuard codice_sezione="richieste_iscrizione"><RichiesteIscrizionePage /></SezioneGuard>} />
          <Route path="/ruoli-permessi" element={<SoloPresidenteGuard><SezioneGuard codice_sezione="ruoli_permessi"><RuoliPermessiPage /></SezioneGuard></SoloPresidenteGuard>} />
          <Route path="/utenti" element={<SoloPresidenteGuard><SezioneGuard codice_sezione="gestione_utenti"><UtentiPage /></SezioneGuard></SoloPresidenteGuard>} />
          <Route path="/nuova-stagione" element={<SezioneGuard codice_sezione="stagioni"><NuovaStagionePage /></SezioneGuard>} />
          <Route path="/test-mobile-auth" element={<ProtectedSuperAdmin><TestMobileAuthPage /></ProtectedSuperAdmin>} />
          <Route path="/import-atleti" element={<SezioneGuard codice_sezione="import_dati"><ImportAtletiPage /></SezioneGuard>} />
          <Route path="/pacchetti-sponsor" element={<SezioneGuard codice_sezione="pacchetti_sponsor"><PacchettiSponsorPage /></SezioneGuard>} />
          <Route path="/convenzioni" element={<SoloPresidenteGuard><ConvenzioniSociPage /></SoloPresidenteGuard>} />
          <Route path="/avvio" element={<SoloPresidenteGuard><AvvioClubPage /></SoloPresidenteGuard>} />
          <Route path="/esportazioni" element={<SoloPresidenteGuard><EsportazioniPage /></SoloPresidenteGuard>} />
          <Route path="/assenze-staff" element={<SoloPresidenteGuard ruoli_extra={["dt","segreteria"]}><AssenzeStaffPage /></SoloPresidenteGuard>} />

          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/presidente/relazione" element={<SoloPresidenteGuard ruoli_extra={["dt"]}><PresidentRelazione /></SoloPresidenteGuard>} />
          <Route path="/presidente/relazione/contenuti" element={<Navigate to="/presidente/relazione" replace />} />
          <Route path="/presidente/gestione-relazione" element={<Navigate to="/presidente/relazione" replace />} />
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
            path="/superadmin/clubs/nuovo"
            element={<ProtectedSuperAdmin><SuperAdminNewClubPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/clubs/:id"
            element={<ProtectedSuperAdmin><SuperAdminClubDetailPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/fatture/:id"
            element={<ProtectedSuperAdmin><SuperAdminFatturaDetailPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/utenti"
            element={<ProtectedSuperAdmin><SuperAdminUtentiPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/convenzioni"
            element={<ProtectedSuperAdmin><SuperAdminConvenzioniPage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/app-mobile"
            element={<ProtectedSuperAdmin><SuperAdminAppMobilePage /></ProtectedSuperAdmin>}
          />
          <Route
            path="/superadmin/traduzioni"
            element={<ProtectedSuperAdmin><SuperAdminTraduzioniPage /></ProtectedSuperAdmin>}
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
            path="/diagnostica"
            element={<ProtectedSuperAdmin><DiagnosticaPage /></ProtectedSuperAdmin>}
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
    </OnboardingGate>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PistaGate>
          <PublicRoutes>
            <AuthProvider>
              <AuthenticatedApp />
            </AuthProvider>
          </PublicRoutes>
        </PistaGate>
      </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
