import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Calendar, Sparkles, CreditCard, Newspaper, ArrowRight, Clock, MapPin } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { PortaleSession } from "@/lib/portale-auth";
import { segnala_errore } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import { format_data } from "@/lib/format-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EventoProssimo {
  id: string;
  tipo: string;
  data: string;
  ora_inizio: string;
  ora_fine: string | null;
  nome_evento: string | null;
  luogo: string | null;
}

interface RinnovoDaConfermare {
  stagione_id: string;
  stagione_nome: string;
  scadenza: string | null;
  status: string;
}

const TIPO_META: Record<string, { label: string; gradient: string; icon: typeof Calendar }> = {
  corso: { label: "Corso", gradient: "from-sky-500 to-indigo-500", icon: Calendar },
  lezione_privata: { label: "Lezione privata", gradient: "from-violet-500 to-purple-600", icon: Sparkles },
  gara: { label: "Gara", gradient: "from-orange-500 to-rose-500", icon: Sparkles },
  campo: { label: "Campo", gradient: "from-emerald-500 to-teal-500", icon: Sparkles },
  gala: { label: "Galà", gradient: "from-amber-500 to-orange-500", icon: Sparkles },
};

const PortaleHomePage: React.FC = () => {
  const { t, i18n } = useTranslation("portale");
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const [prossimi, set_prossimi] = useState<EventoProssimo[]>([]);
  const [loading, set_loading] = useState(true);
  const [errore_prossimi, set_errore_prossimi] = useState(false);
  const [scelta, set_scelta] = useState<"conferma" | "rifiuta" | null>(null);
  const [esito_rinnovo, set_esito_rinnovo] = useState<"attivo" | "non_rinnovato" | null>(null);

  const rinnovo = useQuery({
    queryKey: ["portale_rinnovo_da_confermare", session.atleta.id],
    staleTime: 0,
    queryFn: async (): Promise<RinnovoDaConfermare | null> => {
      const { data, error } = await supabase.rpc("rinnovo_da_confermare" as any);
      if (error) throw error;
      const riga = (Array.isArray(data) ? data[0] : data) as RinnovoDaConfermare | undefined;
      return riga ?? null;
    },
  });

  const salva_rinnovo = useMutation({
    mutationFn: async (azione: "conferma" | "rifiuta") => {
      if (!rinnovo.isSuccess || !rinnovo.data) throw new Error(t("rinnovo.dati_non_pronti"));
      const parametri = {
        p_atleta: session.atleta.id,
        p_stagione: rinnovo.data.stagione_id,
        p_da: "famiglia",
      };
      if (azione === "conferma") {
        const { error } = await supabase.rpc("conferma_rinnovo" as any, parametri);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("rifiuta_rinnovo" as any, {
          ...parametri,
          p_motivo: t("rinnovo.motivo_portale"),
        });
        if (error) throw error;
      }
      return azione;
    },
    onSuccess: async (azione) => {
      set_esito_rinnovo(azione === "conferma" ? "attivo" : "non_rinnovato");
      set_scelta(null);
      toast.success(t(azione === "conferma" ? "rinnovo.confermato" : "rinnovo.rifiutato"));
      await rinnovo.refetch();
    },
    onError: (error) => {
      segnala_errore("PortaleHomePage", "salva_rinnovo", error, {}, "avviso");
      toast.error(t("rinnovo.errore_salvataggio"));
    },
  });

  useEffect(() => {
    if (rinnovo.isError) {
      void segnala_errore("PortaleHomePage", "lettura rinnovo", rinnovo.error, {}, "avviso");
    }
  }, [rinnovo.isError, rinnovo.error]);

  useEffect(() => {
    set_esito_rinnovo(null);
    set_scelta(null);
  }, [session.atleta.id]);

  useEffect(() => {
    (async () => {
      try {
        set_loading(true);
        set_errore_prossimi(false);
        const oggi = new Date().toISOString().slice(0, 10);
        const fra14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from("eventi_calendario" as any)
          .select("id, tipo, data, ora_inizio, ora_fine, nome_evento, luogo")
          .eq("atleta_id", session.atleta.id)
          .gte("data", oggi)
          .lte("data", fra14)
          .neq("stato", "annullato")
          .order("data", { ascending: true })
          .order("ora_inizio", { ascending: true })
          .limit(3);
        if (error) throw error;
        set_prossimi(((data as any) ?? []) as EventoProssimo[]);
      } catch (error) {
        set_errore_prossimi(true);
        void segnala_errore("PortaleHomePage", "lettura prossimi impegni", error, {}, "avviso");
      } finally {
        set_loading(false);
      }
    })();
  }, [session.atleta.id]);

  const oggi = new Date();
  const giorno_sett = format_data(oggi, { weekday: "long" });
  const campagna = rinnovo.isSuccess && rinnovo.data && !["attivo", "non_rinnovato"].includes(rinnovo.data.status)
    ? rinnovo.data
    : null;
  const esito_registrato = esito_rinnovo
    ?? (rinnovo.isSuccess && rinnovo.data && ["attivo", "non_rinnovato"].includes(rinnovo.data.status)
      ? rinnovo.data.status as "attivo" | "non_rinnovato"
      : null);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {rinnovo.isPending && (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-label={t("rinnovo.caricamento")} />
      )}
      {rinnovo.isError && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <p className="font-semibold">{t("rinnovo.errore_lettura")}</p>
          <Button variant="outline" className="mt-3" onClick={() => rinnovo.refetch()}>
            {t("rinnovo.riprova")}
          </Button>
        </section>
      )}
      {campagna && !esito_registrato && (
        <section className="rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            {t("rinnovo.titolo", { stagione: campagna.stagione_nome })}
          </h2>
          {campagna.scadenza && (
            <p className="mt-2 text-sm font-medium text-slate-600">
              {t("rinnovo.scadenza", {
                data: new Date(`${campagna.scadenza}T00:00:00`).toLocaleDateString(i18n.language),
              })}
            </p>
          )}
          <p className="mt-3 text-slate-700">{t("rinnovo.domanda")}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button className="h-12 flex-1" onClick={() => set_scelta("conferma")}>
              {t("rinnovo.si")}
            </Button>
            <Button variant="outline" className="h-12 flex-1" onClick={() => set_scelta("rifiuta")}>
              {t("rinnovo.no")}
            </Button>
          </div>
        </section>
      )}
      {esito_registrato && (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700">
          {t(esito_registrato === "attivo" ? "rinnovo.esito_confermato" : "rinnovo.esito_rifiutato")}
        </p>
      )}

      {/* Hero saluto */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600 text-white p-8 lg:p-10 shadow-xl">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-80 h-80 rounded-full bg-purple-300/20 blur-3xl" />
        <div className="relative">
          <p className="text-sm uppercase tracking-widest opacity-80 mb-3 capitalize">{giorno_sett}</p>
          <h1 className="text-[40px] lg:text-[48px] leading-[1.05] font-extrabold tracking-tight">
            Ciao {session.atleta.nome},<br />ecco la tua settimana
          </h1>
          {session.club?.nome && (
            <p className="text-sm opacity-80 mt-4 font-medium">{session.club.nome}</p>
          )}
        </div>
      </section>

      {/* Prossimi impegni */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Prossimi impegni</h2>
          <Link to="/mio-club/calendario" className="text-sm font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1">
            Vedi calendario <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : errore_prossimi ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <p className="font-semibold">{t("home.errore_prossimi")}</p>
          </div>
        ) : prossimi.length === 0 ? (
          <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-sky-50 border border-slate-200 p-10 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-sky-400" />
            <p className="text-slate-700 font-semibold text-lg">Settimana libera</p>
            <p className="text-slate-500 text-sm mt-1">Tempo per riposarsi… o per riprendere il ghiaccio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prossimi.map((ev, idx) => {
              const meta = TIPO_META[ev.tipo] ?? { label: ev.tipo, gradient: "from-slate-500 to-slate-700", icon: Calendar };
              const Icon = meta.icon;
              const big = idx === 0;
              return (
                <Link
                  key={ev.id}
                  to="/mio-club/calendario"
                  className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all ${
                    big ? "md:col-span-2 md:row-span-1" : ""
                  }`}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${meta.gradient}`} />
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.gradient} text-white flex items-center justify-center shadow-sm shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{meta.label}</p>
                      <p className={`font-bold text-slate-800 truncate ${big ? "text-lg" : "text-base"}`}>
                        {ev.nome_evento ?? meta.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 capitalize">
                        {format_data(new Date(ev.data + "T00:00:00"), { weekday: "long", day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      {ev.ora_inizio?.slice(0, 5)}
                      {ev.ora_fine ? `–${ev.ora_fine.slice(0, 5)}` : ""}
                    </span>
                    {ev.luogo && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{ev.luogo}</span>
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Shortcut */}
      <section>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Scorciatoie</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { to: "/mio-club/profilo/atleta", icon: Sparkles, label: "Profilo", gradient: "from-violet-500 to-purple-600" },
            { to: "/mio-club/profilo/fatture", icon: CreditCard, label: "Fatture", gradient: "from-emerald-500 to-teal-600" },
            { to: "/mio-club/eventi", icon: Calendar, label: "Eventi", gradient: "from-orange-500 to-rose-500" },
            { to: "/mio-club/notizie", icon: Newspaper, label: "Notizie", gradient: "from-sky-500 to-blue-600" },
          ].map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="group relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tile.gradient} text-white flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform`}>
                <tile.icon className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-800">{tile.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <AlertDialog open={scelta !== null} onOpenChange={(aperto) => !aperto && set_scelta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(scelta === "rifiuta" ? "rinnovo.conferma_no_titolo" : "rinnovo.conferma_si_titolo")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(scelta === "rifiuta" ? "rinnovo.conferma_no_testo" : "rinnovo.conferma_si_testo")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salva_rinnovo.isPending}>{t("rinnovo.annulla")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={salva_rinnovo.isPending || !rinnovo.isSuccess}
              className={scelta === "rifiuta" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={(evento) => {
                evento.preventDefault();
                if (scelta) salva_rinnovo.mutate(scelta);
              }}
            >
              {t(scelta === "rifiuta" ? "rinnovo.no" : "rinnovo.si")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortaleHomePage;
