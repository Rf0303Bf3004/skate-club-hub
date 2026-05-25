import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Calendar, Sparkles, MessageSquare, User, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { portale_logout, portale_restore_session, type PortaleSession } from "@/lib/portale-auth";

const PortaleLayout: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("portale");
  const [session, set_session] = useState<PortaleSession | null>(null);
  const [loading, set_loading] = useState(true);
  const [open, set_open] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await portale_restore_session();
      if (!s) {
        navigate("/mio-club", { replace: true });
      } else {
        set_session(s);
      }
      set_loading(false);
    })();
  }, [navigate]);

  const handle_logout = async () => {
    await portale_logout();
    navigate("/mio-club", { replace: true });
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  const items = [
    { to: "/mio-club/home", icon: Home, label: t("menu.home") },
    { to: "/mio-club/calendario", icon: Calendar, label: t("menu.calendario") },
    { to: "/mio-club/eventi", icon: Sparkles, label: t("menu.eventi") },
    { to: "/mio-club/notizie", icon: MessageSquare, label: t("menu.notizie") },
    { to: "/mio-club/profilo", icon: User, label: t("menu.profilo") },
  ];

  const iniziali = `${session.atleta.nome?.[0] ?? ""}${session.atleta.cognome?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => set_open(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center gap-3 border-b border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold">
            {iniziali || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{session.atleta.nome} {session.atleta.cognome}</p>
            <p className="text-xs text-slate-500 truncate">{session.club?.nome ?? ""}</p>
          </div>
          <button className="lg:hidden" onClick={() => set_open(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={() => set_open(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <Button variant="ghost" className="w-full justify-start text-slate-600" onClick={handle_logout}>
            <LogOut className="w-4 h-4 mr-2" /> {t("login.logout")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => set_open(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-slate-800">{session.club?.nome ?? "Portale Atleta"}</h2>
          <code className="ml-auto hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
            {session.atleta.codice_atleta}
          </code>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet context={{ session }} />
        </main>
      </div>
    </div>
  );
};

export default PortaleLayout;
