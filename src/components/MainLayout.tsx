import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useI18n, LOCALE_LABELS, Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { use_club } from "@/hooks/use-supabase-data";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, BookOpen, Trophy, CreditCard, MessageSquare, Settings, Calendar, UserCheck, Tent, GraduationCap, LogOut, Globe, Menu, X, ShieldAlert, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const all_nav_items = [
  { key: "dashboard", sezione: "dashboard", path: "/", icon: LayoutDashboard },
  { key: "atleti", sezione: "atleti", path: "/atleti", icon: Users },
  { key: "istruttori", sezione: "istruttori", path: "/istruttori", icon: UserCheck },
  { key: "corsi", sezione: "corsi", path: "/corsi", icon: BookOpen },
  { key: "gare", sezione: "gare", path: "/gare", icon: Trophy },
  { key: "lezioni_private", sezione: "lezioni_private", path: "/lezioni-private", icon: GraduationCap },
  { key: "fatture", sezione: "fatture", path: "/fatture", icon: CreditCard },
  { key: "comunicazioni", sezione: "comunicazioni", path: "/comunicazioni", icon: MessageSquare },
  { key: "stagioni", sezione: "stagioni", path: "/stagioni", icon: Calendar },
  { key: "campi", sezione: "campi", path: "/campi", icon: Tent },
  { key: "setup_club", sezione: "setup_club", path: "/setup-club", icon: Settings },
];

interface MainLayoutProps { children: React.ReactNode; }

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t, locale, set_locale } = useI18n();
  const { session, logout } = useAuth();
  const { data: club } = use_club();
  const location = useLocation();
  const [sidebar_open, set_sidebar_open] = React.useState(false);
  const is_superadmin = session?.ruolo === "superadmin";
  const is_admin = session?.ruolo === "admin";

  const { data: permessi = [] } = useQuery({
    queryKey: ["ruoli_permessi", session?.club_id, session?.ruolo],
    queryFn: async () => {
      if (!session?.club_id || !session?.ruolo || is_admin || is_superadmin) return [];
      const { data, error } = await supabase
        .from("ruoli_permessi")
        .select("sezione, abilitato")
        .eq("club_id", session.club_id)
        .eq("ruolo", session.ruolo);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!session && !is_admin && !is_superadmin,
  });

  const can_see = (sezione: string): boolean => {
    if (is_superadmin || is_admin) return true;
    if (sezione === "dashboard") return true;
    const p = permessi.find((x: any) => x.sezione === sezione);
    return p ? p.abilitato : false;
  };

  const nav_items = all_nav_items.filter((item) => can_see(item.sezione));

  return (
    <div className="flex min-h-screen bg-background">
      {sidebar_open && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => set_sidebar_open(false)} />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-muted/40 flex flex-col shadow-[1px_0_0_0_hsl(var(--border))] transform transition-transform duration-200 ease-out ${sidebar_open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-lg">C</span>
          </div>
          <span className="font-bold tracking-tight text-primary text-lg">CPA Manager</span>
          <button className="ml-auto lg:hidden" onClick={() => set_sidebar_open(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {!is_superadmin && nav_items.map((item) => {
            const is_active = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <NavLink key={item.key} to={item.path} onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${is_active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{t(item.key)}</span>
              </NavLink>
            );
          })}
          {is_admin && (
            <>
              <div className="pt-3 pb-1"><div className="border-t border-border" /></div>
              <NavLink to="/gestione-avanzata" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/gestione-avanzata" ? "bg-destructive text-destructive-foreground shadow-sm" : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"}`}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Gestione Avanzata</span>
              </NavLink>
            </>
          )}
          {is_superadmin && (
            <>
              <div className="pt-2 pb-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">SuperAdmin</p>
              </div>
              <NavLink to="/superadmin" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <ShieldCheck className="w-4 h-4 shrink-0" /><span>Dashboard</span>
              </NavLink>
              <NavLink to="/superadmin/club" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/club" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <Users className="w-4 h-4 shrink-0" /><span>Gestione Club</span>
              </NavLink>
              <NavLink to="/superadmin/manutenzione" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/manutenzione" ? "bg-purple-600 text-white shadow-sm" : "text-purple-500 hover:bg-purple-100 hover:text-purple-700"}`}>
                <Settings className="w-4 h-4 shrink-0" /><span>Manutenzione Ordinaria</span>
              </NavLink>
              <NavLink to="/superadmin/manutenzione-straordinaria" onClick={() => set_sidebar_open(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${location.pathname === "/superadmin/manutenzione-straordinaria" ? "bg-red-600 text-white shadow-sm" : "text-red-400 hover:bg-red-50 hover:text-red-600"}`}>
                <ShieldAlert className="w-4 h-4 shrink-0" /><span>Manutenzione Straordinaria</span>
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
            <h2 className="font-semibold text-foreground text-sm lg:text-base">{club?.nome || session?.club_nome || "CPA Manager"}</h2>
            <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase tracking-wider font-bold text-muted-foreground hidden sm:inline-block">{session?.ruolo || ""}</span>
          </div>
          <div className="flex items-center gap-3">
            <Select value={locale} onValueChange={(v) => set_locale(v as Locale)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <Globe className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
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
    </div>
  );
};

export default MainLayout;
