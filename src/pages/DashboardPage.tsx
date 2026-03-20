import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  use_atleti,
  use_corsi,
  use_gare,
  use_comunicazioni,
  use_fatture,
  use_istruttori,
  use_club,
  use_presenze,
  get_istruttore_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_segna_presenza, use_elimina_presenza } from "@/hooks/use-supabase-mutations";
import { calculate_age, days_until } from "@/lib/mock-data";
import {
  Users,
  BookOpen,
  Trophy,
  CreditCard,
  TrendingUp,
  UserCheck,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { DEMO_CLUB_ID } from "@/lib/supabase";

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

// ─── Sezione presenze ──────────────────────────────────────
const SezionePresenze: React.FC<{
  istruttori: any[];
  atleti: any[];
  today_key: string;
}> = ({ istruttori, atleti, today_key }) => {
  const today = new Date().toISOString().split("T")[0];
  const { data: presenze = [] } = use_presenze(today);
  const segna = use_segna_presenza();
  const elimina_p = use_elimina_presenza();
  const [tab, set_tab] = useState<"istruttori" | "atleti">("istruttori");

  const today_istruttori = istruttori.filter(
    (i: any) => i.stato === "attivo" && i.disponibilita[today_key]?.length > 0,
  );

  const get_presenza = (persona_id: string) => presenze.find((p: any) => p.persona_id === persona_id);

  const handle_segna = async (persona_id: string, tipo: "istruttore" | "atleta") => {
    try {
      const result = await segna.mutateAsync({
        persona_id,
        tipo_persona: tipo,
        data: today,
        metodo: "manuale",
      });
      toast({
        title: result.tipo === "entrata" ? "✅ Entrata registrata" : "🚪 Uscita registrata",
      });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const handle_elimina = async (id: string) => {
    try {
      await elimina_p.mutateAsync(id);
      toast({ title: "🗑️ Presenza rimossa" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const presenti_count = presenze.filter((p: any) =>
    tab === "istruttori" ? p.tipo_persona === "istruttore" : p.tipo_persona === "atleta",
  ).length;

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Presenze oggi</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success/10 text-success">
          {presenti_count} presenti
        </span>
      </div>

      {/* Tab istruttori/atleti */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
        {(["istruttori", "atleti"] as const).map((t) => (
          <button
            key={t}
            onClick={() => set_tab(t)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all
              ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "istruttori" ? "👨‍🏫 Istruttori" : "⛸️ Atleti"}
          </button>
        ))}
      </div>

      {/* Lista istruttori attesi oggi */}
      {tab === "istruttori" && (
        <div className="space-y-2">
          {today_istruttori.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nessun istruttore previsto oggi</p>
          ) : (
            today_istruttori.map((i: any) => {
              const presenza = get_presenza(i.id);
              const is_present = !!presenza && !presenza.ora_uscita;
              const has_left = !!presenza?.ora_uscita;
              return (
                <div
                  key={i.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                  ${is_present ? "bg-success/5 border-success/20" : has_left ? "bg-muted/20 border-border/50" : "bg-muted/10 border-border/30"}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0
                    ${is_present ? "bg-success" : has_left ? "bg-muted-foreground" : "bg-orange-400"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {i.nome} {i.cognome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {presenza ? (
                        <>
                          {presenza.metodo === "nfc" && <Wifi className="w-3 h-3 inline mr-1" />}
                          Entrata: {presenza.ora_entrata?.slice(0, 5)}
                          {presenza.ora_uscita && ` · Uscita: ${presenza.ora_uscita?.slice(0, 5)}`}
                        </>
                      ) : (
                        i.disponibilita[today_key]?.map((s: any) => `${s.ora_inizio}-${s.ora_fine}`).join(", ")
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!has_left ? (
                      <Button
                        size="sm"
                        variant={is_present ? "outline" : "default"}
                        onClick={() => handle_segna(i.id, "istruttore")}
                        disabled={segna.isPending}
                        className={`h-7 text-xs ${is_present ? "" : "bg-success hover:bg-success/90 text-white"}`}
                      >
                        {is_present ? "🚪 Uscita" : "✅ Entrata"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Uscito</span>
                    )}
                    {presenza && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handle_elimina(presenza.id)}
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Istruttori non attesi ma presenti */}
          {presenze
            .filter(
              (p: any) => p.tipo_persona === "istruttore" && !today_istruttori.find((i: any) => i.id === p.persona_id),
            )
            .map((p: any) => {
              const istr = istruttori.find((i: any) => i.id === p.persona_id);
              if (!istr) return null;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary/20 bg-primary/5"
                >
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {istr.nome} {istr.cognome}
                    </p>
                    <p className="text-xs text-primary">Presente (non in programma)</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handle_elimina(p.id)}
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
        </div>
      )}

      {/* Lista atleti */}
      {tab === "atleti" && (
        <div className="space-y-2">
          {atleti
            .filter((a: any) => a.stato === "attivo")
            .slice(0, 10)
            .map((a: any) => {
              const presenza = get_presenza(a.id);
              const is_present = !!presenza && !presenza.ora_uscita;
              const has_left = !!presenza?.ora_uscita;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                ${is_present ? "bg-success/5 border-success/20" : has_left ? "bg-muted/20 border-border/50" : "bg-muted/10 border-border/30"}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0
                  ${is_present ? "bg-success" : has_left ? "bg-muted-foreground" : "bg-border"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {a.nome} {a.cognome}
                    </p>
                    {presenza && (
                      <p className="text-xs text-muted-foreground">
                        {presenza.metodo === "nfc" && <Wifi className="w-3 h-3 inline mr-1" />}
                        Entrata: {presenza.ora_entrata?.slice(0, 5)}
                        {presenza.ora_uscita && ` · Uscita: ${presenza.ora_uscita?.slice(0, 5)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!has_left ? (
                      <Button
                        size="sm"
                        variant={is_present ? "outline" : "ghost"}
                        onClick={() => handle_segna(a.id, "atleta")}
                        disabled={segna.isPending}
                        className={`h-7 text-xs ${is_present ? "" : "text-muted-foreground"}`}
                      >
                        {is_present ? "🚪" : "✅"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Uscita</span>
                    )}
                    {presenza && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handle_elimina(presenza.id)}
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          <p className="text-xs text-muted-foreground text-center pt-1">
            Mostra i primi 10 atleti attivi. Il tag NFC registrerà automaticamente la presenza.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────
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
        <section className="lg:col-span-2 space-y-6">
          {/* Oggi in pista */}
          <div className="bg-card rounded-xl shadow-card p-6">
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
                      {corso.ora_inizio?.slice(0, 5)}
                    </span>
                    <div className="flex-1 p-3 rounded-lg bg-muted/50 group-hover:bg-accent/5 transition-colors">
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
                      {new Date(gara.data + "T00:00:00").toLocaleDateString("it-CH", {
                        day: "2-digit",
                        month: "short",
                      })}
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
          </div>

          {/* Sezione presenze */}
          <SezionePresenze istruttori={istruttori} atleti={atleti} today_key={today_key} />
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
              {t("ultime_comunicazioni")}
            </h3>
            <div className="space-y-3">
              {recent_comms.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("nessun_risultato")}</p>
              ) : (
                recent_comms.map((c: any) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium text-foreground truncate">{c.titolo}</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">{c.data}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;
