import React from "react";
import { useI18n } from "@/lib/i18n";
import {
  use_atleti,
  use_corsi,
  use_gare,
  use_comunicazioni,
  use_fatture,
  use_istruttori,
  use_club,
  get_istruttore_name_from_list,
} from "@/hooks/use-supabase-data";
import { calculate_age, days_until } from "@/lib/mock-data";
import { Users, BookOpen, Trophy, CreditCard, TrendingUp, UserCheck, MessageSquare } from "lucide-react";

const KPICard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  highlight?: boolean;
  subtitle?: string;
}> = ({ title, value, icon, trend, highlight, subtitle }) => (
  <div
    className={`rounded-xl shadow-card p-5 bg-card transition-shadow hover:shadow-card-hover ${highlight ? "ring-1 ring-accent/30" : ""}`}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">{icon}</div>
    </div>
    {trend && (
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-success">
        <TrendingUp className="w-3 h-3" />
        {trend}
      </div>
    )}
  </div>
);

const DashboardPage: React.FC = () => {
  const { t } = useI18n();
  const { data: atleti = [], isLoading: loading_atleti } = use_atleti();
  const { data: corsi = [], isLoading: loading_corsi } = use_corsi();
  const { data: gare = [], isLoading: loading_gare } = use_gare();
  const { data: fatture = [], isLoading: loading_fatture } = use_fatture();
  const { data: istruttori = [], isLoading: loading_istruttori } = use_istruttori();
  const { data: comunicazioni = [], isLoading: loading_com } = use_comunicazioni();
  const { data: club } = use_club();

  const is_loading =
    loading_atleti || loading_corsi || loading_gare || loading_fatture || loading_istruttori || loading_com;

  const active_atleti = atleti.filter((a: any) => a.stato === "attivo").length;
  const active_corsi = corsi.filter((c: any) => c.stato === "attivo").length;
  const upcoming_gare = gare.filter((g: any) => days_until(g.data) > 0);
  const next_gara = upcoming_gare.sort((a: any, b: any) => days_until(a.data) - days_until(b.data))[0];
  const fatture_da_pagare = fatture.filter((f: any) => f.stato === "da_pagare");
  const totale_fatture = fatture_da_pagare.reduce((s: number, f: any) => s + f.importo, 0);

  const today_day_keys = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
  const today_key = today_day_keys[new Date().getDay()];
  const today_corsi = corsi.filter((c: any) => c.giorno === today_key && c.stato === "attivo");
  const today_istruttori = istruttori.filter(
    (i: any) => i.stato === "attivo" && i.disponibilita[today_key]?.length > 0,
  );

  const recent_atleti = [...atleti]
    .sort((a: any, b: any) => (b.data_aggiunta || "").localeCompare(a.data_aggiunta || ""))
    .slice(0, 5);
  const recent_comms = comunicazioni.slice(0, 3);

  if (is_loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header con logo club */}
      <div className="flex items-center gap-4">
        {club?.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.nome}
            className="w-14 h-14 rounded-2xl object-contain border border-border bg-white p-1 shadow-sm"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shadow-sm">
            {club?.nome?.[0] || "C"}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">{club?.nome || "Dashboard"}</h1>
          {club?.citta && (
            <p className="text-sm text-muted-foreground">
              {club.citta}
              {club.paese ? `, ${club.paese}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <KPICard title={t("atleti_attivi")} value={String(active_atleti)} icon={<Users className="w-5 h-5" />} />
        <KPICard title={t("corsi_settimana")} value={String(active_corsi)} icon={<BookOpen className="w-5 h-5" />} />
        <KPICard
          title={t("prossime_gare")}
          value={String(upcoming_gare.length)}
          icon={<Trophy className="w-5 h-5" />}
          subtitle={next_gara ? t("countdown_giorni", String(days_until(next_gara.data))) : undefined}
        />
        <KPICard
          title={t("fatture_scadenza")}
          value={`CHF ${totale_fatture.toLocaleString()}`}
          icon={<CreditCard className="w-5 h-5" />}
          highlight
        />
      </div>

      {/* Contenuto principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <section className="lg:col-span-2 bg-card rounded-xl shadow-card p-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-5">
            {t("oggi_in_pista")}
          </h3>
          {today_corsi.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("nessun_risultato")}</p>
          ) : (
            <div className="space-y-3">
              {today_corsi.map((corso: any) => (
                <div key={corso.id} className="flex gap-4 items-start group">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground pt-1.5 w-12">
                    {corso.ora_inizio}
                  </span>
                  <div className="flex-1 p-3 rounded-lg bg-muted/50 group-hover:bg-accent/5 transition-colors cursor-pointer">
                    <p className="text-sm font-semibold text-foreground">{corso.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {corso.istruttori_ids
                        .map((id: string) => get_istruttore_name_from_list(istruttori, id))
                        .join(", ")}{" "}
                      • {corso.atleti_ids.length} {t("atleti")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-8 mb-5">
            {t("prossimi_eventi")}
          </h3>
          <div className="space-y-3">
            {upcoming_gare.slice(0, 3).map((gara: any) => (
              <div key={gara.id} className="flex gap-4 items-start">
                <div className="w-12 text-center">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {new Date(gara.data + "T00:00:00").toLocaleDateString("it-CH", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-semibold text-foreground">{gara.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {gara.localita} • {gara.atleti_iscritti.length} {t("atleti")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="bg-card rounded-xl shadow-card p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {t("ultimi_atleti")}
            </h3>
            <div className="space-y-3">
              {recent_atleti.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                    {a.nome[0]}
                    {a.cognome[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {a.nome} {a.cognome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(a.livello_amatori)} • {calculate_age(a.data_nascita)} {t("eta")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {t("istruttori_disponibili")}
            </h3>
            <div className="space-y-3">
              {today_istruttori.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("nessun_risultato")}</p>
              ) : (
                today_istruttori.map((i: any) => (
                  <div key={i.id} className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-success shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {i.nome} {i.cognome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {i.disponibilita[today_key]?.map((s: any) => `${s.ora_inizio}-${s.ora_fine}`).join(", ")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {t("ultime_comunicazioni")}
            </h3>
            <div className="space-y-3">
              {recent_comms.map((c: any) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium text-foreground truncate">{c.titolo}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">{c.data}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;
