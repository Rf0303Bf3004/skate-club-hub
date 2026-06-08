import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useI18n, LOCALE_LABELS, Locale } from "@/lib/i18n";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { use_club } from "@/hooks/use-supabase-data";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, BookOpen, Trophy, CreditCard, MessageSquare, Settings, Calendar, UserCheck, Tent, GraduationCap, LogOut, Globe, Menu, X, ShieldAlert, ShieldCheck, Lock, ClipboardList, ClipboardCheck, Sparkles, ChevronDown, ChevronRight, FileText, Search, LayoutGrid, BadgePercent } from "lucide-react";
import GlobalSearchPalette from "@/components/common/GlobalSearchPalette";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { use_count_iscrizioni_non_lette } from "@/components/comunicazioni/IscrizioniAtletiNotifiche";
import { MENU_PRINCIPALE, MENU_SETUP } from "@/config/menuSections";


// Voci legacy (admin/superadmin vedono questo menu come prima)
const legacy_nav_items = [
  { key: "dashboard", sezione: "dashboard", path: "/", icon: LayoutDashboard },
  { key: "atleti", sezione: "atleti", path: "/atleti", icon: Users },
  { key: "istruttori", sezione: "istruttori", path: "/istruttori", icon: UserCheck },
  { key: "corsi", sezione: "corsi", path: "/corsi", icon: BookOpen },
  { key: "gare", sezione: "gare", path: "/gare", icon: Trophy },
  { key: "test_livello", sezione: "gare", path: "/test", icon: ClipboardCheck },
  { key: "eventi", sezione: "eventi", path: "/eventi", icon: Sparkles },
  { key: "campi_eventi", sezione: "campi", path: "/campi-eventi", icon: Tent },
  { key: "lezioni_private", sezione: "lezioni_private", path: "/lezioni-private", icon: GraduationCap },
  { key: "fatture", sezione: "fatture", path: "/fatture", icon: CreditCard },
  { key: "segreteria_fatture", sezione: "fatture", path: "/segreteria/fatture", icon: LayoutGrid },
  { key: "comunicazioni", sezione: "comunicazioni", path: "/comunicazioni", icon: MessageSquare },
  { key: "planning_ghiaccio", sezione: "planning_ghiaccio", path: "/planning", icon: Calendar },
  { key: "richieste_iscrizione", sezione: "richieste_iscrizione", path: "/richieste-iscrizione", icon: ClipboardList },
  { key: "setup_club", sezione: "setup_club", path: "/setup-club", icon: Settings },
];

function use_count_richieste_pendenti() {
  const { session } = useAuth();
  const { data = 0 } = useQuery({
    queryKey: ["richieste_iscrizione_pendenti_count", session?.club_id],
    enabled: !!session?.club_id,
    refetchInterval: 60000,
    queryFn: async () => {
      const { count } = await supabase
        .from("richieste_iscrizione")
        .select("id", { count: "exact", head: true })
        .eq("club_id", session!.club_id)
        .eq("stato", "in_attesa");
      return count ?? 0;
    },
  });
  return data;
}

const RUOLI_NUOVI = ["presidente", "segreteria", "dt", "istruttore", "aiuto_monitore"];

interface MainLayoutProps { children: React.ReactNode; }

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t, locale, set_locale } = useI18n();
  const { t: tc } = useTranslation("common");
  const menu_label = (codice: string, fallback: string) => tc(`menu.${codice}`, { defaultValue: fallback });
  const { session, logout } = useAuth();

  const { data: club } = use_club();
  const location = useLocation();
  const [sidebar_open, set_sidebar_open] = React.useState(false);
  const is_superadmin = session?.ruolo === "superadmin";
  const is_admin = session?.ruolo === "admin";
  const is_presidente = (session?.ruolo as string) === "presidente";
  const can_manage_users = is_superadmin || is_admin || is_presidente;
  const non_lette_iscrizioni = use_count_iscrizioni_non_lette();
  const richieste_pendenti = use_count_richieste_pendenti();
  const [search_open, set_search_open] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set_search_open((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const is_legacy = is_admin || is_superadmin;
  const is_nuovo_ruolo = !is_legacy && RUOLI_NUOVI.includes(session?.ruolo as string);

  const { data: permessi_sezioni = [] } = useQuery({
    queryKey: ["ruoli_permessi_sezioni", session?.club_id, session?.ruolo],
    queryFn: async () => {
      if (!session?.club_id || !session?.ruolo) return [];
      const { data, error } = await supabase
        .from("ruoli_permessi_sezioni" as any)
        .select("codice_sezione, visibile")
        .eq("club_id", session.club_id)
        .eq("ruolo", session.ruolo);
      if (error) return [];
      return data ?? [];
    },
    enabled: is_nuovo_ruolo,
  });

  const visibile_set = React.useMemo(() => {
    const s = new Set<string>();
    for (const p of permessi_sezioni as any[]) if (p.visibile) s.add(p.codice_sezione);
    return s;
  }, [permessi_sezioni]);

  const nuovo_principale = MENU_PRINCIPALE.filter((s) => visibile_set.has(s.codice));
  const nuovo_setup = MENU_SETUP.filter((s) => visibile_set.has(s.codice));

  const nav_items = legacy_nav_items;
  const [setup_open, set_setup_open] = React.useState(true);

  const render_nav_item = (path: string, Icon: any, label: string, key: string, disabled?: boolean) => {
    const is_active = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
    const show_badge = key === "comunicazioni" && non_lette_iscrizioni > 0;
    const show_pending = key === "atleti" && richieste_pendenti > 0;
    if (disabled) {
      return (
        <div key={key} title={tc("coming_soon")}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground/40 cursor-not-allowed select-none">
          <Icon className="w-4 h-4 shrink-0" />
          <span>{label}</span>
          <span className="ml-auto text-[9px] uppercase tracking-wider opacity-70">{tc("soon")}</span>
        </div>
      );
    }
    return (
      <NavLink key={key} to={path} onClick={() => set_sidebar_open(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${is_active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
        {show_badge && (
          <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
            {non_lette_iscrizioni}
          </span>
        )}
        {show_pending && (
          <span title={tc("pending_requests_tooltip", { count: richieste_pendenti })}
            className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
            {richieste_pendenti}
          </span>
        )}
      </NavLink>
    );
  };


  return (
    <div className="flex min-h-screen bg-background">
      {sidebar_open && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => set_sidebar_open(false)} />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-muted/40 flex flex-col shadow-[1px_0_0_0_hsl(var(--border))] transform transition-transform duration-200 ease-out ${sidebar_open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: club?.colore_primario || "hsl(var(--primary))" }}
          >
            <span className="text-white font-bold text-lg">
              {(club?.nome || session?.club_nome || "C").trim().charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-bold tracking-tight text-primary text-lg">Ice Arena Manager</span>
          <button className="ml-auto lg:hidden" onClick={() => set_sidebar_open(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {/* Admin (non superadmin): menu legacy invariato */}
          {is_admin && !is_superadmin && nav_items.map((item) =>
            render_nav_item(item.path, item.icon, t(item.key), item.key)
          )}
          {/* Nuovi ruoli: voci principali + gruppo Setup espandibile */}
          {is_nuovo_ruolo && (
            <>
              {nuovo_principale.map((s) => render_nav_item(s.path, s.icon, menu_label(s.codice, s.label), s.codice, s.non_implementato))}
              {visibile_set.has("fatture") && render_nav_item("/segreteria/fatture", LayoutGrid, tc("menu.segreteria_fatture", { defaultValue: "Tabellone Fatture" }), "segreteria_fatture")}
              {is_presidente && (
                <NavLink to="/presidente/relazione" onClick={() => set_sidebar_open(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname.startsWith("/presidente/relazione") ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>{tc("relazione")}</span>
                  <span className="ml-auto inline-flex items-center justify-center px-1.5 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold tracking-wider">NEW</span>
                </NavLink>
              )}
              {nuovo_setup.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => set_setup_open((o) => !o)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>{tc("setup")}</span>
                    {setup_open ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                  {setup_open && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                      {nuovo_setup.map((s) => render_nav_item(s.path, s.icon, menu_label(s.codice, s.label), s.codice, s.non_implementato))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {is_admin && (
            <>
              <div className="pt-3 pb-1"><div className="border-t border-border" /></div>
              <NavLink to="/gestione-avanzata" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/gestione-avanzata" ? "bg-destructive text-destructive-foreground shadow-sm" : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"}`}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{tc("menu.gestione_avanzata")}</span>
              </NavLink>
              <NavLink to="/ruoli-permessi" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/ruoli-permessi" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <Lock className="w-4 h-4 shrink-0" />
                <span>{tc("menu.gestione_ruoli")}</span>
              </NavLink>
            </>
          )}
          {can_manage_users && !is_superadmin && (
            <NavLink to="/utenti" onClick={() => set_sidebar_open(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/utenti" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <Users className="w-4 h-4 shrink-0" />
              <span>{tc("menu.utenti")}</span>
            </NavLink>
          )}
          {is_superadmin && (
            <>
              <div className="pt-2 pb-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">{tc("menu.superadmin_section")}</p>
              </div>
              <NavLink to="/superadmin" end onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <ShieldCheck className="w-4 h-4 shrink-0" /><span>{tc("menu.superadmin_dashboard")}</span>
              </NavLink>
              <NavLink to="/superadmin/club" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/club" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <Users className="w-4 h-4 shrink-0" /><span>{tc("menu.superadmin_club")}</span>
              </NavLink>
              <NavLink to="/superadmin/tabellone" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/tabellone" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <Settings className="w-4 h-4 shrink-0" /><span>Tabellone Fatture</span>
              </NavLink>
              <NavLink to="/superadmin/listino" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/listino" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <Settings className="w-4 h-4 shrink-0" /><span>Listino Prezzi</span>
              </NavLink>
              <NavLink to="/superadmin/utenti" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/utenti" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <Users className="w-4 h-4 shrink-0" /><span>{tc("superadmin.menu.utenti", { defaultValue: "Utenti" })}</span>
              </NavLink>
              <NavLink to="/superadmin/convenzioni" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/convenzioni" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <BadgePercent className="w-4 h-4 shrink-0" /><span>Convenzioni</span>
              </NavLink>
              <NavLink to="/superadmin/manutenzione" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/manutenzione" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <Settings className="w-4 h-4 shrink-0" /><span>{tc("menu.superadmin_manutenzione")}</span>
              </NavLink>
              <NavLink to="/superadmin/manutenzione-straordinaria" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/manutenzione-straordinaria" ? "bg-red-600 text-white shadow-sm" : "text-red-400 hover:bg-red-50 hover:text-red-600"}`}>
                <ShieldAlert className="w-4 h-4 shrink-0" /><span>{tc("menu.superadmin_manutenzione_str")}</span>
              </NavLink>
            </>
          )}

        </nav>
        <div className="p-3 border-t border-border space-y-1">
          {session && (
            <div className="px-3 py-2 rounded-md bg-muted/50">
              <p className="text-xs font-medium text-foreground truncate">{session.nome} {session.cognome}</p>
              <p className="text-[10px] text-muted-foreground truncate">{session.email}</p>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wide mt-0.5">{session.ruolo}</p>
            </div>
          )}
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors">
            <LogOut className="w-4 h-4" /><span>{t("logout")}</span>
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shadow-header flex items-center justify-between px-4 lg:px-8 bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => set_sidebar_open(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold text-foreground text-sm lg:text-base">{club?.nome || session?.club_nome || "Ice Arena Manager"}</h2>
            <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase tracking-wider font-bold text-muted-foreground hidden sm:inline-block">{session?.ruolo || ""}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_search_open(true)}
              className="h-8 gap-2 text-muted-foreground hover:text-foreground"
              aria-label={tc("search_aria")}
            >
              <Search className="w-4 h-4" />
              <span className="hidden md:inline text-xs">{tc("search")}</span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">⌘K</kbd>
            </Button>

            <Select value={locale} onValueChange={(v) => set_locale(v as Locale)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <Globe className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['it', 'fr', 'de', 'en'] as Locale[]).map((l) => (
                  <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              {session?.nome?.[0]}{session?.cognome?.[0]}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
      <GlobalSearchPalette open={search_open} on_open_change={set_search_open} />
    </div>
  );
};

export default MainLayout;
