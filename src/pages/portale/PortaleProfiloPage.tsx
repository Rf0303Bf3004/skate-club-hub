import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { User, GraduationCap, CreditCard, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

const PortaleProfiloPage: React.FC = () => {
  const { t } = useTranslation("portale");
  const location = useLocation();
  const at_root = location.pathname === "/portale/profilo" || location.pathname === "/portale/profilo/";

  const subnav = [
    { to: "/portale/profilo/atleta", icon: User, label: t("profilo.tab_atleta") },
    { to: "/portale/profilo/corsi", icon: GraduationCap, label: t("profilo.tab_corsi") },
    { to: "/portale/profilo/fatture", icon: CreditCard, label: t("profilo.tab_fatture") },
    { to: "/portale/profilo/convenzioni", icon: Sparkles, label: t("profilo.tab_convenzioni") },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t("profilo.titolo")}</h1>
      <div className="flex flex-wrap gap-2">
        {subnav.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                isActive ? "bg-sky-500 text-white border-sky-500" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`
            }
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </NavLink>
        ))}
      </div>
      <div className="pt-2">
        {at_root ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subnav.map((s) => (
              <NavLink key={s.to} to={s.to} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow flex items-center gap-3">
                <s.icon className="w-6 h-6 text-sky-500" />
                <span className="font-semibold text-slate-700">{s.label}</span>
              </NavLink>
            ))}
          </div>
        ) : <Outlet />}
      </div>
    </div>
  );
};

export default PortaleProfiloPage;
