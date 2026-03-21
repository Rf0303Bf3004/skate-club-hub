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
  use_lezioni_private,
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
  MessageSquare,
  XCircle,
  Clock,
  Wifi,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

// ─── Helpers ──────────────────────────────────────────────
// Converte today_key (es. "sabato") in formato DB (es. "Sabato")
function match_giorno(giorno_db: string, today_key: string): boolean {
  return giorno_db?.toLowerCase() === today_key?.toLowerCase();
}

function get_slots_giorno(disponibilita: Record<string, any[]>, today_key: string): any[] {
  const key = Object.keys(disponibilita).find((k) => k.toLowerCase() === today_key.toLowerCase());
  return key ? disponibilita[key] : [];
}

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

// ─── Appello atleti per corso ──────────────────────────────
const AppelloCorso: React.FC<{
  corso: any;
  atleti: any[];
  presenze: any[];
  on_segna: (atleta_id: string, riferimento_id: string) => void;
  loading: boolean;
}> = ({ corso, atleti, presenze, on_segna, loading }) => {
  const [expanded, set_expanded] = useState(false);
  const atleti_corso = atleti.filter((a: any) => corso.atleti_ids?.includes(a.id));
  const presenti = atleti_corso.filter((a: any) =>
    presenze.some((p: any) => p.persona_id === a.id && p.riferimento_id === corso.id && !p.ora_uscita),
  );

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div
        className="flex gap-4 items-center p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => set_expanded((e) => !e)}
      >
        <span className="text-xs font-medium tabular-nums text-muted-foreground w-12 flex-shrink-0">
          {corso.ora_inizio?.slice(0, 5)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{corso.nome}</p>
          <p className="text-xs text-muted-foreground">
            {corso.atleti_ids?.length || 0} iscritte · {presenti.length} presenti
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${
              presenti.length === atleti_corso.length && atleti_corso.length > 0
                ? "bg-success/10 text-success"
                : presenti.length > 0
                  ? "bg-orange-100 text-orange-600"
                  : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {presenti.length}/{atleti_corso.length}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/50 divide-y divide-border/30">
          {atleti_corso.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">Nessuna atleta iscritta a questo corso.</p>
          ) : (
            atleti_corso.map((a: any) => {
              const presenza = presenze.find(
                (p: any) => p.persona_id === a.id && p.riferimento_id === corso.id && !p.ora_uscita,
              );
              const is_present = !!presenza;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${is_present ? "bg-success/5" : "bg-background"}`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${is_present ? "bg-success" : "bg-border"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {a.nome} {a.cognome}
                    </p>
                    {a.ruolo_pista && a.ruolo_pista !== "atleta" && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        {a.ruolo_pista === "monitore" ? "Monitore" : "Aiuto monitore"}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={is_present ? "outline" : "default"}
                    onClick={() => on_segna(a.id, corso.id)}
                    disabled={loading}
                    className={`h-7 text-xs ${is_present ? "text-success border-success/40" : "bg-success hover:bg-success/90 text-white"}`}
                  >
                    {is_present ? "✓ Presente" : "Segna"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Appello atleti per lezione privata ───────────────────
const AppelloLezione: React.FC<{
  lezione: any;
  atleti: any[];
  presenze: any[];
  on_segna: (atleta_id: string, riferimento_id: string) => void;
  loading: boolean;
  istruttori: any[];
}> = ({ lezione, atleti, presenze, on_segna, loading, istruttori }) => {
  const [expanded, set_expanded] = useState(false);
  const atleti_lezione = atleti.filter((a: any) => lezione.atleti_ids?.includes(a.id));
  const istr = istruttori.find((i: any) => i.id === lezione.istruttore_id);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div
        className="flex gap-4 items-center p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => set_expanded((e) => !e)}
      >
        <span className="text-xs font-medium tabular-nums text-muted-foreground w-12 flex-shrink-0">
          {lezione.ora_inizio?.slice(0, 5)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Lezione privata {lezione.atleti_ids?.length > 1 ? "👥" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {istr ? `${istr.nome} ${istr.cognome}` : "—"} · {atleti_lezione.map((a: any) => a.nome).join(", ")}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      {expanded && (
        <div className="border-t border-border/50 divide-y divide-border/30">
          {atleti_lezione.map((a: any) => {
            const presenza = presenze.find(
              (p: any) => p.persona_id === a.id && p.riferimento_id === lezione.id && !p.ora_uscita,
            );
            const is_present = !!presenza;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${is_present ? "bg-success/5" : "bg-background"}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${is_present ? "bg-success" : "bg-border"}`} />
                <p className="text-sm font-medium text-foreground flex-1">
                  {a.nome} {a.cognome}
                </p>
                <Button
                  size="sm"
                  variant={is_present ? "outline" : "default"}
                  onClick={() => on_segna(a.id, lezione.id)}
                  disabled={loading}
                  className={`h-7 text-xs ${is_present ? "text-success border-success/40" : "bg-success hover:bg-success/90 text-white"}`}
                >
                  {is_present ? "✓ Presente" : "Segna"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Sezione presenze istruttori ──────────────────────────
const SezionePresenzeIstruttori: React.FC<{
  istruttori: any[];
  today_key: string;
  presenze: any[];
  on_segna: (id: string, tipo: "istruttore") => void;
  on_elimina: (id: string) => void;
  loading: boolean;
}> = ({ istruttori, today_key, presenze, on_segna, on_elimina, loading }) => {
  // FIX: confronto case-insensitive tra giorno DB (es. "Sabato") e today_key (es. "sabato")
  const today_istruttori = istruttori.filter((i: any) => {
    if (i.stato !== "attivo") return false;
    const slots = get_slots_giorno(i.disponibilita || {}, today_key);
    return slots.length > 0;
  });

  const get_presenza = (id: string) => presenze.find((p: any) => p.persona_id === id);

  return (
    <div className="space-y-2">
      {today_istruttori.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nessun istruttore previsto oggi</p>
      ) : (
        today_istruttori.map((i: any) => {
          const presenza = get_presenza(i.id);
          const is_present = !!presenza && !presenza.ora_uscita;
          const has_left = !!presenza?.ora_uscita;
          const slots = get_slots_giorno(i.disponibilita || {}, today_key);
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
                    slots.map((s: any) => `${s.ora_inizio}-${s.ora_fine}`).join(", ")
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!has_left ? (
                  <Button
                    size="sm"
                    variant={is_present ? "outline" : "default"}
                    onClick={() => on_segna(i.id, "istruttore")}
                    disabled={loading}
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
                    onClick={() => on_elimina(presenza.id)}
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
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: club } = use_club();

  const today = new Date().toISOString().split("T")[0];
  const { data: presenze = [] } = use_presenze(today);
  const segna = use_segna_presenza();
  const elimina_p = use_elimina_presenza();

  const [tab_presenze, set_tab_presenze] = useState<"appello" | "istruttori">("appello");

  const is_loading =
    loading_atleti || loading_corsi || loading_gare || loading_fatture || loading_istruttori || loading_com;

  const active_atleti = atleti.filter((a: any) => a.stato === "attivo").length;
  const active_corsi = corsi.filter((c: any) => c.stato === "attivo").length;
  const upcoming_gare = gare.filter((g: any) => days_until(g.data) > 0);
  const next_gara = upcoming_gare.sort((a: any, b: any) => days_until(a.data) - days_until(b.data))[0];
  const fatture_da_pagare = fatture.filter((f: any) => f.stato === "da_pagare");
  const totale_fatture = fatture_da_pagare.reduce((s: number, f: any) => s + f.importo, 0);

  // today_key in minuscolo (es. "sabato"), i giorni nel DB sono con maiuscola (es. "Sabato")
  const today_day_keys = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
  const today_key = today_day_keys[new Date().getDay()];

  // FIX: confronto case-insensitive
  const today_corsi = corsi.filter((c: any) => match_giorno(c.giorno, today_key) && c.stato === "attivo");
  const today_lezioni = lezioni.filter((l: any) => l.data === today && !l.annullata);

  const recent_atleti = [...atleti]
    .sort((a: any, b: any) => (b.data_aggiunta || "").localeCompare(a.data_aggiunta || ""))
    .slice(0, 5);
  const recent_comms = comunicazioni.slice(0, 3);

  const handle_segna_atleta = async (atleta_id: string, riferimento_id: string) => {
    try {
      const result = await segna.mutateAsync({
        persona_id: atleta_id,
        tipo_persona: "atleta",
        data: today,
        metodo: "manuale",
        riferimento_id,
        tipo_riferimento: "corso",
      } as any);
      toast({ title: result.tipo === "entrata" ? "✅ Presenza registrata" : "🚪 Uscita registrata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const handle_segna_istruttore = async (id: string, tipo: "istruttore") => {
    try {
      const result = await segna.mutateAsync({ persona_id: id, tipo_persona: tipo, data: today, metodo: "manuale" });
      toast({ title: result.tipo === "entrata" ? "✅ Entrata registrata" : "🚪 Uscita registrata" });
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

  const totale_presenti = presenze.filter((p: any) => !p.ora_uscita).length;

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
          <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {t("oggi_in_pista")}
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success/10 text-success">
                {totale_presenti} presenti oggi
              </span>
            </div>

            {/* Tab appello / istruttori */}
            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
              {(
                [
                  { key: "appello", label: "📋 Appello atlete" },
                  { key: "istruttori", label: "👨‍🏫 Istruttori" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => set_tab_presenze(tab.key)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all
                    ${tab_presenze === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Appello atlete */}
            {tab_presenze === "appello" && (
              <div className="space-y-3">
                {today_corsi.length === 0 && today_lezioni.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">Nessun corso o lezione oggi</p>
                  </div>
                ) : (
                  <>
                    {today_corsi.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Corsi</p>
                        {today_corsi.map((corso: any) => (
                          <AppelloCorso
                            key={corso.id}
                            corso={corso}
                            atleti={atleti}
                            presenze={presenze}
                            on_segna={handle_segna_atleta}
                            loading={segna.isPending}
                          />
                        ))}
                      </div>
                    )}
                    {today_lezioni.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          Lezioni private
                        </p>
                        {today_lezioni.map((lezione: any) => (
                          <AppelloLezione
                            key={lezione.id}
                            lezione={lezione}
                            atleti={atleti}
                            presenze={presenze}
                            on_segna={handle_segna_atleta}
                            loading={segna.isPending}
                            istruttori={istruttori}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Presenze istruttori */}
            {tab_presenze === "istruttori" && (
              <SezionePresenzeIstruttori
                istruttori={istruttori}
                today_key={today_key}
                presenze={presenze}
                on_segna={handle_segna_istruttore}
                on_elimina={handle_elimina}
                loading={segna.isPending}
              />
            )}

            {/* Prossimi eventi */}
            <div className="pt-2 border-t border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
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
