import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, ClipboardList, Send, UserX, X } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { segnala_errore } from "@/lib/errori";
import { useAuth } from "@/lib/auth";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { use_club } from "@/hooks/use-supabase-data";
import ConfermaRichiesteDialog from "@/components/richieste/ConfermaRichiesteDialog";
import type { RichiestaDaGestire } from "@/hooks/use-richieste-iscrizione";

import { format_data } from "@/lib/format-data";
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

type BozzaFattura = {
  id: string;
  importo: number | null;
  ragione_sociale_id: string | null;
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
  const { puo_gestire_sportivo } = usePermessiAzione();
  const { data: club } = use_club();
  const { data: ragioni_sociali = [] } = use_ragioni_sociali();
  const { modalita: modalita_fatturazione } = useModalitaArea("fatturazione");

  const [modal, set_modal] = React.useState<
    { richieste: RichiestaDaGestire[]; azione: "approvata" | "rifiutata" } | null
  >(null);

  const [adesso, set_adesso] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => set_adesso(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const oggi = chiave_giorno(adesso);
  const club_id = session?.club_id ?? null;
  const senza_club = !!session && !club_id;

  const data_compatta = (iso: string) =>
    format_data(new Date(`${iso.slice(0, 10)}T00:00:00`), {
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
      if (richieste.length === 0)
        return [] as (RichiestaIscrizione & {
          atleta: string;
          atleta_nome_naturale: string;
          corso: string;
        })[];

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
      // Nome e cognome nell'ordine naturale: è quello che finisce nella
      // comunicazione e nella notifica alla famiglia, identico alla pagina Richieste.
      const nomi_atleti_naturali = new Map(
        (atleti ?? []).map((a: Nominativo) => [a.id, `${a.nome ?? ""} ${a.cognome ?? ""}`.trim()]),
      );
      const nomi_corsi = new Map((corsi ?? []).map((c: CorsoNome) => [c.id, c.nome ?? ""]));
      return richieste.map((r) => ({
        ...r,
        atleta: nomi_atleti.get(r.atleta_id) ?? "",
        atleta_nome_naturale: nomi_atleti_naturali.get(r.atleta_id) ?? "",
        corso: nomi_corsi.get(r.corso_id) ?? "",
      }));
    },
  });

  // 2. Fatture in bozza, con ente emittente e importo: servono per dire
  // quante partono da ciascun ente e per quale totale.
  const bozze_query = useQuery({
    queryKey: ["segreteria_home_bozze", club_id],
    enabled: !!club_id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatture")
        .select("id, importo, ragione_sociale_id")
        .eq("club_id", get_current_club_id())
        .eq("stato", "bozza");
      if (error) {
        segnala_errore("SegreteriaDashboard", "fatture_bozza", error);
        throw new Error(error.message);
      }
      return (data ?? []) as BozzaFattura[];
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
      return righe
        .map((a) => {
          const manca_email = !a.genitore1_email || a.genitore1_email.trim() === "";
          const manca_indirizzo =
            (!a.genitore1_indirizzo || a.genitore1_indirizzo.trim() === "") &&
            (!a.indirizzo || a.indirizzo.trim() === "");
          return { ...a, manca_email, manca_indirizzo };
        })
        .filter((a) => a.manca_email || a.manca_indirizzo);
    },
  });

  const giorni_ritardo = (scadenza: string | null) => {
    if (!scadenza) return null;
    const scad = new Date(`${scadenza.slice(0, 10)}T00:00:00`).getTime();
    const odierna = new Date(`${oggi}T00:00:00`).getTime();
    return Math.max(0, Math.round((odierna - scad) / 86_400_000));
  };

  const giorni_attesa = (creata: string) => {
    const d = new Date(creata).getTime();
    return Math.max(0, Math.floor((adesso.getTime() - d) / 86_400_000));
  };

  const data_estesa = (d: Date) =>
    format_data(d, { weekday: "long", day: "numeric", month: "long" });

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
  const bozze = bozze_query.data ?? [];

  // Bozze raggruppate per ente emittente: null = il club.
  const ragioni_attive = ragioni_sociali
    .filter((r) => r.attivo)
    .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
  const multi_enti = modalita_fatturazione === "multi_ragione_sociale" && ragioni_attive.length > 0;
  const nome_club = club?.nome || t("segreteria_home.club_fallback", "Il club");

  const gruppi_bozze = (() => {
    const per_ente = new Map<string, { nome: string; numero: number; totale: number }>();
    for (const f of bozze) {
      const chiave = f.ragione_sociale_id ?? "club";
      const nome = f.ragione_sociale_id
        ? ragioni_sociali.find((r) => r.id === f.ragione_sociale_id)?.nome ?? f.ragione_sociale_id.slice(0, 8)
        : nome_club;
      const corrente = per_ente.get(chiave) ?? { nome, numero: 0, totale: 0 };
      corrente.numero += 1;
      corrente.totale += Number(f.importo ?? 0);
      per_ente.set(chiave, corrente);
    }
    if (!multi_enti) {
      // Senza enti multipli si mostra una riga sola col club.
      const numero = bozze.length;
      const totale = bozze.reduce((s, f) => s + Number(f.importo ?? 0), 0);
      return numero > 0
        ? [{ chiave: "club", nome: nome_club, numero, totale, link: "/fatture?stato=bozza" }]
        : [];
    }
    return Array.from(per_ente.entries()).map(([chiave, v]) => ({
      chiave,
      ...v,
      link: `/fatture?ente=${chiave}&stato=bozza`,
    }));
  })();

  // Un riquadro vuoto sparisce solo se la lettura è davvero riuscita:
  // durante il caricamento e in caso di errore resta visibile.
  const mostra = (q: { isLoading: boolean; isError: boolean }, pieno: boolean) =>
    q.isLoading || q.isError || pieno;

  const mostra_scadute = mostra(scadute_query, scadute.length > 0);
  const mostra_richieste = mostra(richieste_query, richieste.length > 0);
  const mostra_bozze = mostra(bozze_query, gruppi_bozze.length > 0);
  const mostra_anagrafiche = mostra(anagrafiche_query, anagrafiche_mancanti.length > 0);

  const a_posto: string[] = [];
  if (scadute_query.isSuccess && scadute.length === 0) a_posto.push(t("segreteria_home.ok_scadute", "Nessuna fattura scaduta"));
  if (richieste_query.isSuccess && richieste.length === 0) a_posto.push(t("segreteria_home.ok_richieste", "Nessuna iscrizione in attesa"));
  if (bozze_query.isSuccess && gruppi_bozze.length === 0) a_posto.push(t("segreteria_home.ok_bozze", "Nessuna fattura da inviare"));
  if (anagrafiche_query.isSuccess && anagrafiche_mancanti.length === 0) a_posto.push(t("segreteria_home.ok_anagrafiche", "Anagrafiche complete"));

  const niente_da_fare = !mostra_scadute && !mostra_richieste && !mostra_bozze && !mostra_anagrafiche;

  const apri_modal = (r: (typeof richieste)[number], azione: "approvata" | "rifiutata") => {
    set_modal({
      richieste: [
        {
          id: r.id,
          atleta_id: r.atleta_id,
          // «Nome Cognome», come in RichiesteIscrizionePage: questo nome finisce
          // nella comunicazione e nella notifica alla famiglia.
          atleta_nome: r.atleta_nome_naturale || "",
          corso_id: r.corso_id,
          corso_nome: r.corso,
        },
      ],
      azione,
    });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("segreteria_home.titolo", "La segreteria di oggi")}</h1>
        <p className="text-sm text-muted-foreground">{data_estesa(adesso)}</p>
      </div>

      {niente_da_fare && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("segreteria_home.niente_da_fare", "Niente da fare oggi.")}
          </CardContent>
        </Card>
      )}

      {/* 1. Fatture scadute: la cosa più urgente */}
      {mostra_scadute && (
        <Blocco titolo={t("segreteria_home.scadute", "Fatture scadute")} icona={AlertTriangle}>
          {scadute_query.isLoading && <Caricamento />}
          {scadute_query.isError && (
            <Errore testo={t("segreteria_home.errore_scadute", "Non è stato possibile leggere le fatture scadute. Riprova fra poco.")} />
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
          {scadute.length > 0 && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/segreteria/fatture")}>
              {t("segreteria_home.vai_fatture", "Apri le fatture")}
            </Button>
          )}
        </Blocco>
      )}

      {/* 2. Iscrizioni da approvare */}
      {mostra_richieste && (
        <Blocco titolo={t("segreteria_home.richieste", "Iscrizioni da approvare")} icona={ClipboardList}>
          {richieste_query.isLoading && <Caricamento />}
          {richieste_query.isError && (
            <Errore testo={t("segreteria_home.errore_richieste", "Non è stato possibile leggere le richieste di iscrizione. Riprova fra poco.")} />
          )}
          {richieste.map((r) => {
            const giorni = giorni_attesa(r.created_at);
            return (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.atleta || t("segreteria_home.atleta", "Atleta")}</span>
                  {r.corso && <Badge variant="secondary">{r.corso}</Badge>}
                  {puo_gestire_sportivo && (
                    <div className="ml-auto flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => apri_modal(r, "approvata")}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        {t("segreteria_home.approva", "Approva")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/20 text-destructive hover:bg-destructive/5"
                        onClick={() => apri_modal(r, "rifiutata")}
                      >
                        <X className="mr-1 h-4 w-4" />
                        {t("segreteria_home.rifiuta", "Rifiuta")}
                      </Button>
                    </div>
                  )}
                </div>
                <p className={`mt-1 text-xs ${giorni > 7 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {t("segreteria_home.in_attesa_da", "in attesa da {{count}} giorni", { count: giorni })}
                  {" · "}
                  {t("segreteria_home.richiesta_del", "richiesta il {{data}}", { data: data_compatta(r.created_at) })}
                </p>
              </div>
            );
          })}
          {richieste.length > 0 && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/richieste-iscrizione")}>
              {t("segreteria_home.vai_richieste", "Apri le richieste")}
            </Button>
          )}
        </Blocco>
      )}

      {/* 3. Fatture da inviare, per ente che le emette */}
      {mostra_bozze && (
        <Blocco titolo={t("segreteria_home.bozze", "Fatture da inviare")} icona={Send}>
          {bozze_query.isLoading && <Caricamento />}
          {bozze_query.isError && (
            <Errore testo={t("segreteria_home.errore_bozze", "Non è stato possibile leggere le fatture in bozza. Riprova fra poco.")} />
          )}
          {gruppi_bozze.map((g) => (
            <div key={g.chiave} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">{g.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {t("segreteria_home.bozze_conteggio", "{{count}} fatture", { count: g.numero })}
                  {" · "}
                  <span className="tabular-nums">{fmt_chf(g.totale)}</span>
                </p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate(g.link)}>
                {t("segreteria_home.rivedi_invia", "Rivedi e invia")}
              </Button>
            </div>
          ))}
        </Blocco>
      )}

      {/* 4. Anagrafiche da completare */}
      {mostra_anagrafiche && (
        <Blocco titolo={t("segreteria_home.anagrafiche", "Anagrafiche da completare")} icona={UserX}>
          {anagrafiche_query.isLoading && <Caricamento />}
          {anagrafiche_query.isError && (
            <Errore testo={t("segreteria_home.errore_anagrafiche", "Non è stato possibile leggere gli atleti. Riprova fra poco.")} />
          )}
          {anagrafiche_mancanti.length > 0 && (
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
      )}

      {/* Riga discreta di ciò che è a posto */}
      {!niente_da_fare && a_posto.length > 0 && (
        <p className="text-xs text-muted-foreground">{a_posto.join(" · ")}</p>
      )}

      {modal && (
        <ConfermaRichiesteDialog
          richieste={modal.richieste}
          azione={modal.azione}
          on_close={() => set_modal(null)}
          on_done={() => set_modal(null)}
        />
      )}
    </div>
  );
};

export default SegreteriaDashboard;
