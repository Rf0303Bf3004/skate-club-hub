import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Mail, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";
import { useAuth } from "@/lib/auth";

/**
 * Home dell'istruttore (e dell'aiuto monitore): «cosa devo fare adesso».
 * Pagina unica e identica per tutti: non dipende dalla matrice dei riquadri.
 * Cambia solo il contenuto, mai la struttura.
 */

type SessioneOggi = {
  sessione_id: string;
  titolo: string | null;
  ora_inizio: string | null;
  ora_fine: string | null;
  specialita: string | null;
  altri_istruttori: string | null;
  n_atleti: number | null;
  in_corso: boolean | null;
};

type AtletaSessione = {
  atleta_id: string;
  nome: string | null;
  cognome: string | null;
  stato: string | null;
};

type MessaggioStaff = {
  id: string;
  stato: string | null;
  letto_at: string | null;
  rsvp_risposta: string | null;
  creato_at: string | null;
  comunicazioni: {
    titolo: string | null;
    richiede_rsvp: boolean | null;
    urgente: boolean | null;
    created_at: string | null;
  } | null;
};

const ora_breve = (v: string | null | undefined) => (v ? String(v).slice(0, 5) : "--:--");

const minuti_da_ora = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const [h, m] = String(v).slice(0, 5).split(":");
  const hn = Number(h);
  const mn = Number(m);
  if (!Number.isFinite(hn) || !Number.isFinite(mn)) return null;
  return hn * 60 + mn;
};

const chiave_giorno = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const Blocco: React.FC<{ titolo: string; icona: React.ElementType; children: React.ReactNode }> = ({
  titolo,
  icona: Icona,
  children,
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icona className="h-5 w-5 text-primary" />
        {titolo}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">{children}</CardContent>
  </Card>
);

const Errore: React.FC<{ testo: string }> = ({ testo }) => (
  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{testo}</span>
  </div>
);

const Caricamento: React.FC = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

const IstruttoreDashboard: React.FC = () => {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { session } = useAuth();

  const [adesso, set_adesso] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => set_adesso(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const oggi = chiave_giorno(adesso);
  const minuti_ora = adesso.getHours() * 60 + adesso.getMinutes();

  // 1) Collegamento account → scheda istruttore. Se manca, la pagina lo dice.
  const istruttore_query = useQuery({
    queryKey: ["istruttore_corrente", session?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("istruttore_corrente");
      if (error) {
        segnala_errore("IstruttoreDashboard", "istruttore_corrente", error);
        throw new Error(error.message);
      }
      return (data as string | null) ?? null;
    },
  });

  const istruttore_id = istruttore_query.data ?? null;
  const collegato = istruttore_query.isSuccess && !!istruttore_id;

  const sessioni_query = useQuery({
    queryKey: ["istruttore_home_sessioni", istruttore_id, oggi],
    enabled: collegato,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_sessioni_istruttore", {
        p_istruttore_id: istruttore_id as string,
        p_data: oggi,
      });
      if (error) {
        segnala_errore("IstruttoreDashboard", "pista_sessioni_istruttore", error);
        throw new Error(error.message);
      }
      return (data ?? []) as SessioneOggi[];
    },
  });

  const sessioni: SessioneOggi[] = React.useMemo(() => {
    const elenco = [...(sessioni_query.data ?? [])];
    elenco.sort((a, b) => (minuti_da_ora(a.ora_inizio) ?? 0) - (minuti_da_ora(b.ora_inizio) ?? 0));
    return elenco;
  }, [sessioni_query.data]);


  // Atlete e stato dell'appello, una lettura per sessione di oggi.
  const atleti_queries = useQueries({
    queries: sessioni.map((s) => ({
      queryKey: ["istruttore_home_atleti", s.sessione_id],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("pista_atleti", { p_sessione_id: s.sessione_id });
        if (error) {
          segnala_errore("IstruttoreDashboard", "pista_atleti", error);
          throw new Error(error.message);
        }
        return (data ?? []) as AtletaSessione[];
      },
    })),
  });

  const stato_appello = React.useCallback(
    (indice: number): "fatto" | "da_fare" | "sconosciuto" => {
      const q = atleti_queries[indice];
      if (!q || !q.isSuccess) return "sconosciuto";
      const righe = q.data ?? [];
      if (righe.length === 0) return "sconosciuto";
      return righe.every((a) => a.stato !== "non_registrato") ? "fatto" : "da_fare";
    },
    [atleti_queries],
  );

  const atleti_in_errore = atleti_queries.some((q) => q.isError);

  const mie_atlete = React.useMemo(() => {
    const mappa = new Map<string, string>();
    atleti_queries.forEach((q) => {
      (q.data ?? []).forEach((a) => {
        if (!mappa.has(a.atleta_id)) {
          mappa.set(a.atleta_id, `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() || a.atleta_id.slice(0, 8));
        }
      });
    });
    return [...mappa.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, i18n.language));
  }, [atleti_queries, i18n.language]);

  // Sessione da evidenziare: quella in corso, altrimenti la prossima di oggi.
  const indice_evidenziato = React.useMemo(() => {
    const in_corso = sessioni.findIndex((s) => {
      const i = minuti_da_ora(s.ora_inizio);
      const f = minuti_da_ora(s.ora_fine);
      return i != null && f != null && minuti_ora >= i && minuti_ora < f;
    });
    if (in_corso >= 0) return in_corso;
    return sessioni.findIndex((s) => (minuti_da_ora(s.ora_inizio) ?? 0) >= minuti_ora);
  }, [sessioni, minuti_ora]);

  // 2) Prossimo turno, solo se oggi non ce ne sono.
  const nessun_turno_oggi = sessioni_query.isSuccess && sessioni.length === 0;

  const prossimo_query = useQuery({
    queryKey: ["istruttore_home_prossimo", istruttore_id, oggi],
    enabled: collegato && nessun_turno_oggi,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("griglia_sessioni")
        .select(
          "id, ora_inizio, ora_fine, griglia_sessioni_istruttori!inner(istruttore_id), griglia_blocchi!inner(data, titolo)",
        )
        .eq("griglia_sessioni_istruttori.istruttore_id", istruttore_id as string)
        .gt("griglia_blocchi.data", oggi)
        .limit(80);
      if (error) {
        segnala_errore("IstruttoreDashboard", "prossimo_turno", error);
        throw new Error(error.message);
      }
      const righe = (data ?? []) as unknown as {
        id: string;
        ora_inizio: string | null;
        ora_fine: string | null;
        griglia_blocchi: { data: string; titolo: string | null } | null;
      }[];
      righe.sort((a, b) => {
        const da = a.griglia_blocchi?.data ?? "";
        const db = b.griglia_blocchi?.data ?? "";
        if (da !== db) return da < db ? -1 : 1;
        return (minuti_da_ora(a.ora_inizio) ?? 0) - (minuti_da_ora(b.ora_inizio) ?? 0);
      });
      return righe[0] ?? null;
    },
  });

  // 3) Messaggi consegnati a me.
  const messaggi_query = useQuery({
    queryKey: ["istruttore_home_messaggi", session?.user_id],
    enabled: !!session?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicazioni_destinatari_staff")
        .select(
          "id, stato, letto_at, rsvp_risposta, creato_at, comunicazioni(titolo, richiede_rsvp, urgente, created_at)",
        )
        .eq("user_id", session?.user_id as string)
        .is("archiviato_at", null)
        .order("creato_at", { ascending: false })
        .limit(20);
      if (error) {
        segnala_errore("IstruttoreDashboard", "comunicazioni_destinatari_staff", error);
        throw new Error(error.message);
      }
      return (data ?? []) as unknown as MessaggioStaff[];
    },
  });

  const messaggi = React.useMemo(() => {
    const righe = [...(messaggi_query.data ?? [])];
    const peso = (m: MessaggioStaff) => {
      const attende_rsvp = !!m.comunicazioni?.richiede_rsvp && !m.rsvp_risposta;
      if (attende_rsvp) return 0;
      if (!m.letto_at) return 1;
      return 2;
    };
    righe.sort((a, b) => peso(a) - peso(b));
    return righe;
  }, [messaggi_query.data]);

  const data_estesa = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  // Account senza scheda istruttore: spiegazione esplicita, mai una pagina vuota.
  if (istruttore_query.isLoading) return <Caricamento />;

  if (istruttore_query.isError) {
    return (
      <div className="p-4 md:p-6">
        <Errore testo={t("istruttore_home.errore_collegamento", "Non è stato possibile leggere la tua scheda istruttore. Riprova fra poco.")} />
      </div>
    );
  }

  if (!istruttore_id) {
    return (
      <div className="p-4 md:p-6">
        <Card className="border-amber-400/60 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">{t("istruttore_home.non_collegato_titolo", "Il tuo accesso non è collegato a una scheda istruttore")}</p>
              <p className="text-sm text-muted-foreground">
                {t(
                  "istruttore_home.non_collegato_testo",
                  "Per questo non possiamo mostrarti i tuoi turni e le tue atlete. Chiedi al club di collegare il tuo accesso alla tua scheda istruttore.",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("istruttore_home.titolo", "La mia giornata")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {adesso.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* 1. Oggi — i miei turni */}
      <Blocco titolo={t("istruttore_home.turni_oggi", "Oggi — i miei turni")} icona={CalendarDays}>
        {sessioni_query.isLoading && <Caricamento />}
        {sessioni_query.isError && (
          <Errore testo={t("istruttore_home.errore_turni", "Non è stato possibile leggere i tuoi turni di oggi. Riprova fra poco.")} />
        )}
        {sessioni_query.isSuccess && sessioni.length > 0 &&
          sessioni.map((s, i) => {
            const evidenziata = i === indice_evidenziato;
            const appello = stato_appello(i);
            return (
              <div
                key={s.sessione_id}
                className={`rounded-lg border p-4 ${evidenziata ? "border-primary bg-primary/5 shadow-sm" : "border-border"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold tabular-nums">
                    {ora_breve(s.ora_inizio)}–{ora_breve(s.ora_fine)}
                  </span>
                  <span className="font-medium">{s.titolo ?? t("istruttore_home.sessione", "Sessione")}</span>
                  {s.specialita && <Badge variant="secondary">{s.specialita}</Badge>}
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {s.n_atleti ?? 0}
                  </Badge>
                  {appello === "fatto" && (
                    <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("istruttore_home.appello_fatto", "Appello fatto")}
                    </Badge>
                  )}
                  {appello === "da_fare" && (
                    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                      {t("istruttore_home.appello_da_fare", "Appello da fare")}
                    </Badge>
                  )}
                </div>
                {evidenziata && (
                  <Button size="lg" className="mt-3 h-14 w-full text-base" onClick={() => navigate("/pista")}>
                    <ClipboardCheck className="mr-2 h-5 w-5" />
                    {t("istruttore_home.fai_appello", "Fai l'appello")}
                  </Button>
                )}
              </div>
            );
          })}

        {nessun_turno_oggi && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("istruttore_home.niente_oggi", "Oggi non hai turni sul ghiaccio.")}
            </p>
            {prossimo_query.isLoading && <Caricamento />}
            {prossimo_query.isError && (
              <Errore testo={t("istruttore_home.errore_prossimo", "Non è stato possibile leggere il tuo prossimo turno.")} />
            )}
            {prossimo_query.isSuccess && prossimo_query.data && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("istruttore_home.prossimo_turno", "Il tuo prossimo turno")}
                </p>
                <p className="mt-1 font-medium">
                  {data_estesa(prossimo_query.data.griglia_blocchi?.data ?? oggi)} ·{" "}
                  {ora_breve(prossimo_query.data.ora_inizio)}–{ora_breve(prossimo_query.data.ora_fine)}
                </p>
                {prossimo_query.data.griglia_blocchi?.titolo && (
                  <p className="text-sm text-muted-foreground">{prossimo_query.data.griglia_blocchi.titolo}</p>
                )}
              </div>
            )}
            {prossimo_query.isSuccess && !prossimo_query.data && (
              <p className="text-sm text-muted-foreground">
                {t("istruttore_home.nessun_prossimo", "Non hai ancora turni programmati nei prossimi giorni.")}
              </p>
            )}
          </div>
        )}
      </Blocco>

      {/* 2. Le mie atlete */}
      <Blocco titolo={t("istruttore_home.mie_atlete", "Le mie atlete")} icona={Users}>
        {atleti_in_errore && (
          <Errore testo={t("istruttore_home.errore_atlete", "Non è stato possibile leggere l'elenco completo delle atlete.")} />
        )}
        {atleti_queries.some((q) => q.isLoading) && <Caricamento />}
        {mie_atlete.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2">
              {mie_atlete.slice(0, 24).map((a) => (
                <Badge key={a.id} variant="secondary" className="px-3 py-1 text-sm">
                  {a.nome}
                </Badge>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate("/atleti")}>
              {t("istruttore_home.vai_atleti", "Apri le atlete")}
            </Button>
          </>
        ) : (
          !atleti_queries.some((q) => q.isLoading) &&
          !atleti_in_errore && (
            <p className="text-sm text-muted-foreground">
              {t("istruttore_home.nessuna_atleta", "Oggi non ci sono atlete nelle tue sessioni.")}
            </p>
          )
        )}
      </Blocco>

      {/* 3. I miei messaggi */}
      <Blocco titolo={t("istruttore_home.miei_messaggi", "I miei messaggi")} icona={Mail}>
        {messaggi_query.isLoading && <Caricamento />}
        {messaggi_query.isError && (
          <Errore testo={t("istruttore_home.errore_messaggi", "Non è stato possibile leggere i tuoi messaggi. Riprova fra poco.")} />
        )}
        {messaggi_query.isSuccess && messaggi.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("istruttore_home.nessun_messaggio", "Non hai messaggi da leggere.")}
          </p>
        )}
        {messaggi.slice(0, 6).map((m) => {
          const attende_rsvp = !!m.comunicazioni?.richiede_rsvp && !m.rsvp_risposta;
          const non_letto = !m.letto_at;
          return (
            <div
              key={m.id}
              className={`rounded-lg border p-3 ${attende_rsvp ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={non_letto ? "font-semibold" : ""}>
                  {m.comunicazioni?.titolo ?? t("istruttore_home.messaggio", "Messaggio")}
                </span>
                {attende_rsvp && (
                  <Badge className="bg-primary text-primary-foreground">
                    {t("istruttore_home.attende_risposta", "Aspetta la tua risposta")}
                  </Badge>
                )}
                {!attende_rsvp && non_letto && (
                  <Badge variant="outline">{t("istruttore_home.non_letto", "Non letto")}</Badge>
                )}
              </div>
            </div>
          );
        })}
        {messaggi_query.isSuccess && messaggi.length > 0 && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/comunicazioni")}>
            {t("istruttore_home.vai_comunicazioni", "Apri le comunicazioni")}
          </Button>
        )}
      </Blocco>
    </div>
  );
};

export default IstruttoreDashboard;
