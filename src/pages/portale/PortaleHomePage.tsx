import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Calendar, Sparkles, CreditCard, User, GraduationCap } from "lucide-react";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

const PortaleHomePage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const { t } = useTranslation("portale");

  const tiles = [
    { to: "/portale/calendario", icon: Calendar, label: t("menu.calendario"), color: "bg-indigo-500" },
    { to: "/portale/eventi", icon: Sparkles, label: t("menu.eventi"), color: "bg-orange-500" },
    { to: "/portale/profilo/corsi", icon: GraduationCap, label: t("menu.corsi"), color: "bg-emerald-500" },
    { to: "/portale/profilo/fatture", icon: CreditCard, label: t("menu.fatture"), color: "bg-sky-500" },
    { to: "/portale/profilo", icon: User, label: t("menu.profilo"), color: "bg-purple-500" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <section className="bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-3xl p-6 lg:p-8 shadow-lg">
        <p className="text-sm opacity-90">{t("home.benvenuto")}</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-1">{session.atleta.nome} {session.atleta.cognome}</h1>
        {session.club?.nome && <p className="text-sm opacity-90 mt-2">{session.club.nome}</p>}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-3">{t("home.rapido")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tiles.map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow flex flex-col items-center gap-2 text-center"
            >
              <div className={`w-10 h-10 rounded-xl ${tile.color} text-white flex items-center justify-center`}>
                <tile.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-slate-700">{tile.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PortaleHomePage;
