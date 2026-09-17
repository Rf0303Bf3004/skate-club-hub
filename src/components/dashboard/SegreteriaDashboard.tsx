import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList, Send, UserX } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { segnala_errore } from "@/lib/errori";
import { useAuth } from "@/lib/auth";

/**
 * Home della segreteria: «cosa devo spedire e completare oggi».
 * Pagina unica e identica per tutti gli utenti di segreteria:
 * non dipende dalla matrice dei riquadri.
 */

type RichiestaIscrizione = {
  id: string;
  created_at: string;
  note_richiesta: string | null;
  atleta_id: string;
  corso_id: string;
};

type Nominativo = { id: string; nome: string | null; cognome: string | null };
type CorsoNome = { id: string; nome: string | null };

type FatturaScaduta = {
  id: string;
  numero: string | null;
  importo: number | null;
  data_scadenza: string | null;
  intestatario_nome: string | null;
  intestatario_cognome: string | null;
};

type AnagraficaIncompleta = {
  id: string;
  nome: string;
  cognome: string;
  genitore1_email: string | null;
  genitore1_indirizzo: string | null;
  indirizzo: string | null;
};

const chiave_giorno = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const FORMATTER_CHF = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
});

const fmt_chf = (v: number | null) => FORMATTER_CHF.format(v ?? 0);

const nome_persona = (p: { nome: string | null; cognome: string | null } | null) =>
  p ? `${p.cognome ?? ""} ${p.nome ?? ""}`.trim() : "";

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

const SegreteriaDashboard: React.FC = () => {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { session } = useAuth();

  const [adesso, set_adesso] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => set_adesso(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const oggi = chiave_giorno(adesso);
  const club_id = session?.club_id ?? null;
  const senza_club = !!session && !club_id;

  const data_compatta = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  // 1. Iscrizioni da approvare. La tabella non ha chiavi esterne verso atleti e
  // corsi, quindi i nomi si risolvono con due letture di controllo: se
  // falliscono, la lettura intera fallisce — non si mostra una lista senza nomi.
  const richieste_query = useQuery({
    queryKey: ["segreteria_home_richieste", club_id],
    enabled: !!club_id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("richieste_iscrizione")
        .select("id, created_at, note_richiesta, atleta_id, corso_id")
        .eq("club_id", get_current_club_id())
        .eq("stato", "in_attesa")
        .order("created_at", { ascending: true })
        .limit(10);
      if (error) {
        segnala_errore("SegreteriaDashboard", "richieste_iscrizione", error);
        throw new Error(error.message);
      }
      const richieste = (data ?? []) as RichiestaIscrizione[];
      if (richieste.length === 0) return [] as (RichiestaIscrizione & { atleta: string; corso: string })[];

      const atleta_ids = Array.from(new Set(richieste.map((r) => r.atleta_id)));
      const corso_ids = Array.from(new Set(richieste.map((r) => r.corso_id)));

      const { data: atleti, error: err_atleti } = await supabase
        .from("atleti")
        .select("id, nome, cognome")
        .in("id", atleta_ids);
      if (err_atleti) {
        segnala_errore("SegreteriaDashboard", "atleti_richieste", err_atleti);
        throw new Error(err_atleti.message);
      }
      const { data: corsi, error: err_corsi } = await supabase
        .from("corsi")
        .select("id, nome")
        .in("id", corso_ids);
      if (err_corsi) {
        segnala_errore("SegreteriaDashboard", "corsi_richieste", err_corsi);
        throw new Error(err_corsi.message);
      }

      const nomi_atleti = new Map((atleti ?? []).map((a: Nominativo) => [a.id, nome_persona(a)]));
      const nomi_corsi = new Map((corsi ?? []).map((c: CorsoNome) => [c.id, c.nome ?? ""]));
      return richieste.map((r) => ({
        ...r,
        atleta: nomi_atleti.get(r.atleta_id) ?? "",
        corso: nomi_corsi.get(r.corso_id) ?? "",
      }));
    },
  });

  // 2. Fatture in bozza: solo il conteggio, con errore controllato — un count
  // non letto diventa zero e nasconde il lavoro in sospeso.
  const bozze_query = useQuery({
    queryKey: ["segreteria_home_bozze", club_id],
    enabled: !!club_id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("fatture")
        .select("id", { count: "exact", head: true })
        .eq("club_id", get_current_club_id())
        .eq("stato", "bozza");
      if (error) {
        segnala_errore("SegreteriaDashboard", "fatture_bozza", error);
        throw new Error(error.message);
      }
      return count ?? 0;
    },
  });

  // 3. Fatture scadute tra inviate e sollecitate.
  const scadute_query = useQuery({
    queryKey: ["segreteria_home_scadute", club_id, oggi],
    enabled: !!club_id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatture")
        .select("id, numero, importo, data_scadenza, intestatario_nome, intestatario_cognome")
        .eq("club_id", get_current_club_id())
        .in("stato", ["inviata", "sollecitata"])
        .lt("data_scadenza", oggi)
        .order("data_scadenza", { ascending: true })
        .limit(10);
      if (error) {
        segnala_errore("SegreteriaDashboard", "fatture_scadute", error);
        throw new Error(error.message);
      }
      return (data ?? []) as FatturaScaduta[];
    },
  });

  // 4. Anagrafiche incomplete. Solo email e indirizzo: nessun dato sanitario
  // o nota privata passa in questa schermata.
  const anagrafiche_query = useQuery({
    queryKey: ["segreteria_home_anagrafiche", club_id],
    enabled: !!club_id,
    refetchInterval: 15 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("id, nome, cognome, genitore1_email, genitore1_indirizzo, indirizzo")
        .eq("club_id", get_current_club_id())
        .eq("attivo", true);
      if (error) {
        segnala_errore("SegreteriaDashboard", "atleti_anagrafiche", error);
        throw new Error(error.message);
      }
      const righe = (data ?? []) as AnagraficaIncompleta[];
      const mancanti = righe
        .filter((a) => {
          const manca_email = !a.genitore1_email || a.genitore1_email.trim() === "";
          const manca_indirizzo =
            (!a.genitore1_indirizzo || a.genitore1_indirizzo.trim() === "") &&
            (!a.indirizzo || a.indirizzo.trim() === "");
          return manca_email || manca_indirizzo;
        })
        .map((a) => {
          const manca_email = !a.genitore1_email || a.genitore1_email.trim() === "";
          const manca_indirizzo =
            (!a.genitore1_indirizzo || a.genitore1_indirizzo.trim() === "") &&
            (!a.indirizzo || a.indirizzo.trim() === "");
          return {
            ...a,
            manca_email,
            manca_indirizzo,
          };
        });
      return mancanti;
    },
  });

  const giorni_ritardo = (scadenza: string | null) => {
    if (!scadenza) return null;
    const scad = new Date(`${scadenza.slice(0, 10)}T00:00:00`).getTime();
    const odierna = new Date(`${oggi}T00:00:00`).getTime();
    return Math.max(0, Math.round((odierna - scad) / 86_400_000));
  };

  const data_estesa = (d: Date) =>
    d.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" });

  if (senza_club) {
    return (
      <div className="p-4 md:p-6">
        <Card className="border-amber-400/60 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">{t("segreteria_home.senza_club_titolo", "Il tuo accesso non è collegato a un club")}</p>
              <p className="text-sm text-muted-foreground">
                {t(
                  "segreteria_home.senza_club_testo",
                  "Per questo non possiamo mostrarti iscrizioni e fatture. Scegli o collega un club per vedere la segreteria di oggi.",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const richieste = richieste_query.data ?? [];
  const scadute = scadute_query.data ?? [];
  const anagrafiche_mancanti = anagrafiche_query.data ?? [];
  const bozze = bozze_query.data ?? 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("segreteria_home.titolo", "La segreteria di oggi")}</h1>
        <p className="text-sm text-muted-foreground">{data_estesa(adesso)}</p>
      </div>

      {/* 1. Iscrizioni da approvare */}
      <Blocco titolo={t("segreteria_home.richieste", "Iscrizioni da approvare")} icona={ClipboardList}>
        {richieste_query.isLoading && <Caricamento />}
        {richieste_query.isError && (
          <Errore testo={t("segreteria_home.errore_richieste", "Non è stato possibile leggere le richieste di iscrizione. Riprova fra poco.")} />
        )}
        {richieste_query.isSuccess && richieste.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("segreteria_home.nessuna_richiesta", "Nessuna richiesta in attesa.")}
          </p>
        )}
        {richieste.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.atleta || t("segreteria_home.atleta", "Atleta")}</span>
              {r.corso && <Badge variant="secondary">{r.corso}</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("segreteria_home.richiesta_del", "richiesta il {{data}}", { data: data_compatta(r.created_at) })}
            </p>
          </div>
        ))}
        {richieste_query.isSuccess && richieste.length > 0 && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/richieste-iscrizione")}>
            {t("segreteria_home.vai_richieste", "Apri le richieste")}
          </Button>
        )}
      </Blocco>

      {/* 2. Fatture da inviare */}
      <Blocco titolo={t("segreteria_home.bozze", "Fatture da inviare")} icona={Send}>
        {bozze_query.isLoading && <Caricamento />}
        {bozze_query.isError && (
          <Errore testo={t("segreteria_home.errore_bozze", "Non è stato possibile leggere le fatture in bozza. Riprova fra poco.")} />
        )}
        {bozze_query.isSuccess && (
          <>
            {bozze > 0 ? (
              <div>
                <p className="text-3xl font-bold tabular-nums">{bozze}</p>
                <p className="text-sm text-muted-foreground">
                  {t("segreteria_home.bozze_sottotitolo", "fatture in bozza, non ancora spedite")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("segreteria_home.nessuna_bozza", "Nessuna fattura in attesa di invio.")}
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate("/segreteria/fatture")}>
              {t("segreteria_home.vai_fatture", "Apri le fatture")}
            </Button>
          </>
        )}
      </Blocco>

      {/* 3. Fatture scadute */}
      <Blocco titolo={t("segreteria_home.scadute", "Fatture scadute")} icona={AlertTriangle}>
        {scadute_query.isLoading && <Caricamento />}
        {scadute_query.isError && (
          <Errore testo={t("segreteria_home.errore_scadute", "Non è stato possibile leggere le fatture scadute. Riprova fra poco.")} />
        )}
        {scadute_query.isSuccess && scadute.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("segreteria_home.nessuna_scaduta", "Nessuna fattura scaduta.")}
          </p>
        )}
        {scadute.map((f) => {
          const ritardo = giorni_ritardo(f.data_scadenza);
          return (
            <div key={f.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium tabular-nums">{f.numero || f.id.slice(0, 8)}</span>
                <span className="text-sm text-muted-foreground">
                  {nome_persona({ nome: f.intestatario_nome, cognome: f.intestatario_cognome })}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{fmt_chf(f.importo)}</span>
                {ritardo != null && (
                  <Badge variant="destructive">
                    {t("segreteria_home.in_ritardo", "in ritardo di {{count}} giorni", { count: ritardo })}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
        {scadute_query.isSuccess && scadute.length > 0 && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/segreteria/fatture")}>
            {t("segreteria_home.vai_fatture", "Apri le fatture")}
          </Button>
        )}
      </Blocco>

      {/* 4. Anagrafiche da completare */}
      <Blocco titolo={t("segreteria_home.anagrafiche", "Anagrafiche da completare")} icona={UserX}>
        {anagrafiche_query.isLoading && <Caricamento />}
        {anagrafiche_query.isError && (
          <Errore testo={t("segreteria_home.errore_anagrafiche", "Non è stato possibile leggere gli atleti. Riprova fra poco.")} />
        )}
        {anagrafiche_query.isSuccess && anagrafiche_mancanti.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("segreteria_home.anagrafiche_ok", "Tutte le anagrafiche hanno email e indirizzo.")}
          </p>
        )}
        {anagrafiche_query.isSuccess && anagrafiche_mancanti.length > 0 && (
          <>
            {anagrafiche_mancanti.length > 10 && (
              <p className="text-sm text-muted-foreground">
                {t("segreteria_home.anagrafiche_totale", "{{totali}} in tutto, prime {{mostrate}} qui sotto.", {
                  totali: anagrafiche_mancanti.length,
                  mostrate: Math.min(10, anagrafiche_mancanti.length),
                })}
              </p>
            )}
            {anagrafiche_mancanti.slice(0, 10).map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {a.cognome} {a.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.manca_email && a.manca_indirizzo
                      ? t("segreteria_home.manca_email_indirizzo", "mancano email e indirizzo")
                      : a.manca_email
                        ? t("segreteria_home.manca_email", "manca l'email")
                        : t("segreteria_home.manca_indirizzo", "manca l'indirizzo")}
                  </span>
                </div>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              {t("segreteria_home.anagrafiche_contesto", "Senza questi dati la fattura non parte.")}
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/atleti")}>
              {t("segreteria_home.vai_atleti", "Apri gli atleti")}
            </Button>
          </>
        )}
      </Blocco>
    </div>
  );
};

export default SegreteriaDashboard;
