import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Snowflake, UserX } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { segnala_errore } from "@/lib/errori";
import { useAuth } from "@/lib/auth";
import PromemoriaEsameGs from "@/components/istruttori/PromemoriaEsameGs";
import { use_istruttori } from "@/hooks/use-supabase-data";

/**
 * Home del direttore tecnico: «oggi fila tutto o c'è un buco?».
 * Pagina unica e identica per tutti i DT: non dipende dalla matrice dei riquadri.
 */

type SessioneOggi = {
  sessione_id: string;
  titolo: string | null;
  ora_inizio: string | null;
  ora_fine: string | null;
  specialita: string | null;
  istruttori: string | null;
  istruttori_ids: string[] | null;
  n_atleti: number | null;
  in_corso: boolean | null;
};

type AtletaSessione = { atleta_id: string; stato: string | null };

type RichiestaPrivata = {
  id: string;
  data_preferita: string | null;
  fascia_preferita: string | null;
  created_at: string | null;
  atleti: { nome: string | null; cognome: string | null } | null;
  istruttori: { nome: string | null; cognome: string | null } | null;
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

const DTDashboard: React.FC = () => {
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
  const club_id = session?.club_id ?? null;
  const senza_club = !!session && !club_id;

  const sessioni_query = useQuery({
    queryKey: ["dt_home_sessioni", club_id, oggi],
    enabled: !!club_id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_sessioni", { p_data: oggi });
      if (error) {
        segnala_errore("DTDashboard", "pista_sessioni", error);
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

  const buchi = React.useMemo(
    () => sessioni.filter((s) => (s.istruttori_ids ?? []).length === 0),
    [sessioni],
  );

  // Stato dell'appello: una lettura per sessione di oggi.
  const atleti_queries = useQueries({
    queries: sessioni.map((s) => ({
      queryKey: ["dt_home_atleti", s.sessione_id],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("pista_atleti", { p_sessione_id: s.sessione_id });
        if (error) {
          segnala_errore("DTDashboard", "pista_atleti", error);
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

  const indice_in_corso = React.useMemo(
    () =>
      sessioni.findIndex((s) => {
        const i = minuti_da_ora(s.ora_inizio);
        const f = minuti_da_ora(s.ora_fine);
        return i != null && f != null && minuti_ora >= i && minuti_ora < f;
      }),
    [sessioni, minuti_ora],
  );

  const richieste_query = useQuery({
    queryKey: ["dt_home_richieste", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("richieste_lezioni_private")
        .select(
          "id, data_preferita, fascia_preferita, created_at, atleti(nome, cognome), istruttori(nome, cognome)",
        )
        .eq("club_id", get_current_club_id())
        .eq("stato", "in_attesa")
        .order("created_at", { ascending: true })
        .limit(10);
      if (error) {
        segnala_errore("DTDashboard", "richieste_lezioni_private", error);
        throw new Error(error.message);
      }
      return (data ?? []) as unknown as RichiestaPrivata[];
    },
  });

  const data_estesa = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  const nome_persona = (p: { nome: string | null; cognome: string | null } | null) =>
    p ? `${p.cognome ?? ""} ${p.nome ?? ""}`.trim() : "";

  if (senza_club) {
    return (
      <div className="p-4 md:p-6">
        <Card className="border-amber-400/60 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">{t("dt_home.senza_club_titolo", "Il tuo accesso non è collegato a un club")}</p>
              <p className="text-sm text-muted-foreground">
                {t(
                  "dt_home.senza_club_testo",
                  "Per questo non possiamo mostrarti il ghiaccio di oggi. Scegli o collega un club per vedere le sessioni.",
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
        <h1 className="text-2xl font-bold tracking-tight">{t("dt_home.titolo", "Il ghiaccio di oggi")}</h1>
        <p className="text-sm text-muted-foreground">{data_estesa(oggi)}</p>
      </div>

      <PromemoriaEsameGs istruttori={istruttori_query.data ?? []} />



      {/* 1. Buchi di oggi */}
      <Blocco titolo={t("dt_home.buchi", "Buchi di oggi — sessioni senza istruttore")} icona={UserX}>
        {sessioni_query.isLoading && <Caricamento />}
        {sessioni_query.isError && (
          <Errore testo={t("dt_home.errore_sessioni", "Non è stato possibile leggere le sessioni di oggi. Riprova fra poco.")} />
        )}
        {sessioni_query.isSuccess && buchi.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("dt_home.nessun_buco", "Ogni sessione di oggi ha un istruttore assegnato.")}
          </p>
        )}
        {buchi.map((s) => (
          <div key={s.sessione_id} className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold tabular-nums">
                {ora_breve(s.ora_inizio)}–{ora_breve(s.ora_fine)}
              </span>
              <span className="font-medium">{s.titolo ?? t("dt_home.sessione", "Sessione")}</span>
              <Badge variant="outline">
                {t("dt_home.atlete", "{{count}} atlete", { count: s.n_atleti ?? 0 })}
              </Badge>
            </div>
          </div>
        ))}
      </Blocco>

      {/* 2. Il ghiaccio di oggi */}
      <Blocco titolo={t("dt_home.ghiaccio_oggi", "Il ghiaccio di oggi")} icona={Snowflake}>
        {sessioni_query.isLoading && <Caricamento />}
        {sessioni_query.isError && (
          <Errore testo={t("dt_home.errore_sessioni", "Non è stato possibile leggere le sessioni di oggi. Riprova fra poco.")} />
        )}
        {sessioni_query.isSuccess && sessioni.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("dt_home.nessuna_sessione", "Oggi non c'è nessuna sessione sul ghiaccio.")}
          </p>
        )}
        {sessioni.map((s, i) => {
          const appello = stato_appello(i);
          const in_corso = i === indice_in_corso;
          return (
            <div
              key={s.sessione_id}
              className={`rounded-lg border p-3 ${in_corso ? "border-primary bg-primary/5 shadow-sm" : "border-border"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold tabular-nums">
                  {ora_breve(s.ora_inizio)}–{ora_breve(s.ora_fine)}
                </span>
                <span className="font-medium">{s.titolo ?? t("dt_home.sessione", "Sessione")}</span>
                {s.specialita && <Badge variant="secondary">{s.specialita}</Badge>}
                <Badge variant="outline">
                  {t("dt_home.atlete", "{{count}} atlete", { count: s.n_atleti ?? 0 })}
                </Badge>
                {appello === "fatto" && (
                  <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("dt_home.appello_fatto", "Appello fatto")}
                  </Badge>
                )}
                {appello === "da_fare" && (
                  <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                    {t("dt_home.appello_da_fare", "Appello da fare")}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {s.istruttori && s.istruttori.trim().length > 0
                  ? s.istruttori
                  : t("dt_home.senza_istruttore", "Nessun istruttore assegnato")}
              </p>
            </div>
          );
        })}
        {atleti_queries.some((q) => q.isError) && (
          <Errore testo={t("dt_home.errore_appello", "Non è stato possibile leggere lo stato dell'appello di tutte le sessioni.")} />
        )}
        <Button variant="outline" className="w-full" onClick={() => navigate("/pista")}>
          <ClipboardCheck className="mr-2 h-4 w-4" />
          {t("dt_home.vai_pista", "Apri il bordo pista")}
        </Button>
      </Blocco>

      {/* 3. Richieste di lezione privata */}
      <Blocco titolo={t("dt_home.richieste", "Richieste di lezione privata da approvare")} icona={CalendarDays}>
        {richieste_query.isLoading && <Caricamento />}
        {richieste_query.isError && (
          <Errore testo={t("dt_home.errore_richieste", "Non è stato possibile leggere le richieste di lezione privata. Riprova fra poco.")} />
        )}
        {richieste_query.isSuccess && (richieste_query.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("dt_home.nessuna_richiesta", "Non ci sono richieste in attesa.")}
          </p>
        )}
        {(richieste_query.data ?? []).map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{nome_persona(r.atleti) || t("dt_home.atleta", "Atleta")}</span>
              {nome_persona(r.istruttori) && <Badge variant="secondary">{nome_persona(r.istruttori)}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.data_preferita ? data_estesa(r.data_preferita) : t("dt_home.senza_data", "Senza data preferita")}
              {r.fascia_preferita ? ` · ${r.fascia_preferita}` : ""}
            </p>
          </div>
        ))}
        {richieste_query.isSuccess && (richieste_query.data ?? []).length > 0 && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/lezioni-private?tab=richieste")}>
            {t("dt_home.vai_richieste", "Apri le richieste")}
          </Button>
        )}
      </Blocco>
    </div>
  );
};

export default DTDashboard;
