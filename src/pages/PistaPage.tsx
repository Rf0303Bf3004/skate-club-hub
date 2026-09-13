import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2, Music, StickyNote } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LettoreDisco from "@/components/musica/LettoreDisco";
import { use_programmi_atleti, type ProgrammaMusicale } from "@/hooks/use-programmi-musicali";
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
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";
import { useAuth } from "@/lib/auth";

/**
 * Bordo pista: tablet condiviso a bordo ghiaccio.
 * Divisione principale per istruttore, più una linguetta "Tutto il ghiaccio".
 * Usa ESCLUSIVAMENTE le RPC pista_* (nessuna lettura diretta di tabelle).
 */

const TUTTO = "__tutto_il_ghiaccio";

const ora_breve = (valore: string | null) => (valore ? String(valore).slice(0, 5) : "");

const chiave_bozza = (sessione_id: string) => `appello_${sessione_id}`;

const leggi_bozza = (sessione_id: string): string[] | null => {
  try {
    const grezzo = window.localStorage.getItem(chiave_bozza(sessione_id));
    if (!grezzo) return null;
    const valore = JSON.parse(grezzo);
    return Array.isArray(valore) ? (valore as string[]) : null;
  } catch {
    return null;
  }
};

const scrivi_bozza = (sessione_id: string, elenco: string[]) => {
  try {
    window.localStorage.setItem(chiave_bozza(sessione_id), JSON.stringify(elenco));
  } catch {
    /* localStorage non disponibile: la pagina continua a funzionare */
  }
};

const cancella_bozza = (sessione_id: string) => {
  try {
    window.localStorage.removeItem(chiave_bozza(sessione_id));
  } catch {
    /* localStorage non disponibile */
  }
};

const chiave_giorno = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MessaggioCentrale: React.FC<{ testo: string; variante?: "normale" | "errore" }> = ({
  testo,
  variante = "normale",
}) => (
  <div className="flex items-center justify-center py-24 px-6">
    <p
      className={`text-xl md:text-2xl font-medium text-center max-w-2xl ${
        variante === "errore" ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {testo}
    </p>
  </div>
);

const Caricamento: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

const PistaPage: React.FC = () => {
  const { t, i18n } = useTranslation("common");
  const { session } = useAuth();
  const [adesso, set_adesso] = React.useState(() => new Date());
  const [tab, set_tab] = React.useState<string | null>(null);
  const [scelta_manuale_istruttore, set_scelta_manuale_istruttore] = React.useState(false);
  const [sessione_id, set_sessione_id] = React.useState<string | null>(null);
  const [scelta_manuale, set_scelta_manuale] = React.useState(false);
  const [assenti, set_assenti] = React.useState<Set<string>>(new Set());
  const [modificato, set_modificato] = React.useState(false);
  const [salvataggio, set_salvataggio] = React.useState(false);
  const [registrato_alle, set_registrato_alle] = React.useState<string | null>(null);
  const [in_attesa, set_in_attesa] = React.useState<{ tipo: "sessione" | "istruttore"; id: string } | null>(null);
  const [schermo_intero, set_schermo_intero] = React.useState(false);
  const [ripreso, set_ripreso] = React.useState(false);
  const [momento, set_momento] = React.useState<"appello" | "in_pista">("appello");
  const [programma_attivo, set_programma_attivo] = React.useState<{
    programma: ProgrammaMusicale;
    titolo: string;
  } | null>(null);
  const [scelta_disco, set_scelta_disco] = React.useState<{
    titolo: string;
    programmi: ProgrammaMusicale[];
  } | null>(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => set_adesso(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const giorno = chiave_giorno(adesso);

  const compleanni_query = useQuery({
    queryKey: ["pista_compleanni", giorno],
    refetchInterval: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_compleanni", { p_data: null });
      if (error) {
        segnala_errore("PistaPage", "pista_compleanni", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

  const istruttori_query = useQuery({
    queryKey: ["pista_istruttori", giorno],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_istruttori", { p_data: null });
      if (error) {
        segnala_errore("PistaPage", "pista_istruttori", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

  const istruttori = React.useMemo(() => istruttori_query.data ?? [], [istruttori_query.data]);

  // Selezione automatica istruttore: solo finché l'utente non sceglie a mano
  // e finché non ci sono modifiche non registrate. La scelta manuale resta valida
  // solo se la linguetta è ancora presente nella lista corrente.
  React.useEffect(() => {
    if (istruttori.length === 0) return;
    if (modificato) return;
    if (scelta_manuale_istruttore && tab && (tab === TUTTO || istruttori.some((i) => i.istruttore_id === tab))) return;
    const scelta = (istruttori.find((i) => i.ha_sessione_in_corso) ?? istruttori[0]).istruttore_id;
    if (scelta !== tab) {
      // Anche il cambio automatico azzera l'appello e la sessione, come quello manuale.
      azzera_appello();
      set_tab(scelta);
      set_sessione_id(null);
      set_scelta_manuale(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [istruttori, tab, adesso, modificato, scelta_manuale_istruttore]);

  const in_tutto = tab === TUTTO;
  const istruttore_id = in_tutto ? null : tab;

  const sessioni_tutte_query = useQuery({
    queryKey: ["pista_sessioni", giorno],
    enabled: in_tutto,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_sessioni", { p_data: null });
      if (error) {
        segnala_errore("PistaPage", "pista_sessioni", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

  const sessioni_istruttore_query = useQuery({
    queryKey: ["pista_sessioni_istruttore", istruttore_id, giorno],
    enabled: !!istruttore_id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_sessioni_istruttore", {
        p_istruttore_id: istruttore_id as string,
        p_data: null,
      });
      if (error) {
        segnala_errore("PistaPage", "pista_sessioni_istruttore", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

  type Sessione = {
    sessione_id: string;
    titolo: string | null;
    ora_inizio: string | null;
    ora_fine: string | null;
    specialita: string | null;
    n_atleti: number | null;
    in_corso: boolean | null;
    altri_istruttori?: string | null;
    istruttori?: string | null;
  };

  const sessioni_query = in_tutto ? sessioni_tutte_query : sessioni_istruttore_query;
  const sessioni: Sessione[] = React.useMemo(
    () => (sessioni_query.data ?? []) as Sessione[],
    [sessioni_query.data],
  );

  // Selezione automatica sessione: si aggiorna a ogni scatto dell'orologio, ma mai
  // se ci sono modifiche non registrate o se l'utente ha scelto a mano.
  React.useEffect(() => {
    if (sessioni.length === 0) return;
    if (modificato) return;
    if (scelta_manuale && sessione_id && sessioni.some((s) => s.sessione_id === sessione_id)) return;
    const ora_corrente = `${String(adesso.getHours()).padStart(2, "0")}:${String(adesso.getMinutes()).padStart(2, "0")}`;
    const in_corso = sessioni.find((s) => s.in_corso);
    const prossima = sessioni.find((s) => ora_breve(s.ora_inizio) >= ora_corrente);
    const scelta = (in_corso ?? prossima ?? sessioni[sessioni.length - 1]).sessione_id;
    if (scelta !== sessione_id) {
      // Cambio automatico di sessione: si riparte dall'appello della nuova
      // sessione, mai restando nell'elenco della precedente.
      if (sessione_id) azzera_appello();
      set_sessione_id(scelta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessioni, sessione_id, adesso, modificato, scelta_manuale]);

  const atleti_query = useQuery({
    queryKey: ["pista_atleti", sessione_id],
    enabled: !!sessione_id,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_atleti", { p_sessione_id: sessione_id as string });
      if (error) {
        segnala_errore("PistaPage", "pista_atleti", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

  const atleti = React.useMemo(() => atleti_query.data ?? [], [atleti_query.data]);

  // L'appello si inizializza solo quando cambia la sessione, mai su refetch.
  const sessione_inizializzata = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!sessione_id || !atleti_query.data) return;
    if (sessione_inizializzata.current === sessione_id) return;
    sessione_inizializzata.current = sessione_id;
    const salvato = leggi_bozza(sessione_id);
    if (salvato) {
      set_assenti(new Set(salvato));
      set_modificato(true);
      set_ripreso(true);
      set_momento("appello");
    } else {
      set_assenti(
        new Set(
          atleti_query.data
            .filter((a) => a.stato === "assente" || a.stato === "avvisato")
            .map((a) => a.atleta_id),
        ),
      );
      set_modificato(false);
      set_ripreso(false);
      // Se l'appello di questa sessione è già stato fatto (nessuna atleta è
      // rimasta "non_registrato"), il tablet riparte direttamente da "in pista".
      const gia_registrato =
        atleti_query.data.length > 0 && atleti_query.data.every((a) => a.stato !== "non_registrato");
      set_momento(gia_registrato ? "in_pista" : "appello");
    }
    set_registrato_alle(null);
  }, [sessione_id, atleti_query.data]);

  // L'appello in corso sopravvive a un ricaricamento del tablet.
  React.useEffect(() => {
    if (!sessione_id || !modificato) return;
    if (sessione_inizializzata.current !== sessione_id) return;
    scrivi_bozza(sessione_id, Array.from(assenti));
  }, [assenti, modificato, sessione_id]);

  const sessione_selezionata = sessioni.find((s) => s.sessione_id === sessione_id) ?? null;

  const gruppi = React.useMemo(() => {
    const con_gruppo = atleti.filter((a) => a.gruppo_sessione_id);
    const senza_gruppo = atleti.filter((a) => !a.gruppo_sessione_id);
    const ordine: string[] = [];
    const mappa = new Map<string, typeof atleti>();
    for (const atleta of con_gruppo) {
      const chiave = atleta.gruppo_sessione_id as string;
      if (!mappa.has(chiave)) {
        mappa.set(chiave, []);
        ordine.push(chiave);
      }
      mappa.get(chiave)!.push(atleta);
    }
    const blocchi = ordine.map((chiave, indice) => ({
      chiave,
      titolo: mappa.get(chiave)![0].etichetta || t("pista.gruppo_numero", { numero: indice + 1 }),
      atleti: mappa.get(chiave)!,
    }));
    if (senza_gruppo.length > 0) blocchi.push({ chiave: "__senza_gruppo", titolo: "", atleti: senza_gruppo });
    return blocchi;
  }, [atleti, t]);

  const n_assenti = atleti.filter((a) => assenti.has(a.atleta_id)).length;
  const n_presenti = atleti.length - n_assenti;

  const lista_pronta = !atleti_query.isLoading && !atleti_query.isFetching && !atleti_query.error && atleti.length > 0;

  // Momento "in pista": solo le presenti, con il disco. L'appello resta correggibile.
  const presenti = React.useMemo(
    () => atleti.filter((a) => !assenti.has(a.atleta_id)),
    [atleti, assenti],
  );
  const ids_presenti = React.useMemo(() => presenti.map((a) => a.atleta_id), [presenti]);
  const programmi_query = use_programmi_atleti(momento === "in_pista" ? ids_presenti : []);
  const programmi_per_atleta = React.useMemo(() => {
    const mappa = new Map<string, ProgrammaMusicale[]>();
    for (const p of programmi_query.data ?? []) {
      if (!p.file_path) continue;
      if (!mappa.has(p.atleta_id)) mappa.set(p.atleta_id, []);
      mappa.get(p.atleta_id)!.push(p);
    }
    return mappa;
  }, [programmi_query.data]);

  const apri_lettore = (programma: ProgrammaMusicale, titolo: string) =>
    set_programma_attivo({ programma, titolo });

  const alterna = (atleta_id: string) => {
    set_assenti((precedenti) => {
      const prossimi = new Set(precedenti);
      if (prossimi.has(atleta_id)) prossimi.delete(atleta_id);
      else prossimi.add(atleta_id);
      return prossimi;
    });
    set_modificato(true);
    set_registrato_alle(null);
  };

  const azzera_appello = () => {
    sessione_inizializzata.current = null;
    set_assenti(new Set());
    set_modificato(false);
    set_registrato_alle(null);
    set_ripreso(false);
    set_momento("appello");
    set_programma_attivo(null);
    set_scelta_disco(null);
  };

  const applica_sessione = (id: string) => {
    azzera_appello();
    set_sessione_id(id);
    set_scelta_manuale(true);
  };

  const applica_istruttore = (id: string) => {
    azzera_appello();
    set_tab(id);
    set_scelta_manuale_istruttore(true);
    set_sessione_id(null);
    set_scelta_manuale(false);
  };

  const cambia_sessione = (id: string) => {
    if (id === sessione_id) return;
    if (modificato) {
      set_in_attesa({ tipo: "sessione", id });
      return;
    }
    applica_sessione(id);
  };

  const cambia_istruttore = (id: string) => {
    if (id === tab) return;
    if (modificato) {
      set_in_attesa({ tipo: "istruttore", id });
      return;
    }
    applica_istruttore(id);
  };

  const registra = async () => {
    if (!sessione_id || !lista_pronta) return;
    set_salvataggio(true);
    try {
      const elenco = atleti.filter((a) => assenti.has(a.atleta_id)).map((a) => a.atleta_id);
      const { error } = await supabase.rpc("pista_appello", { p_sessione_id: sessione_id, p_assenti: elenco });
      if (error) throw new Error(error.message);
      const ora = new Date();
      set_registrato_alle(`${String(ora.getHours()).padStart(2, "0")}:${String(ora.getMinutes()).padStart(2, "0")}`);
      set_modificato(false);
      set_ripreso(false);
      cancella_bozza(sessione_id);
      // Dopo l'appello la schermata passa alle sole presenti (momento "in pista").
      set_momento("in_pista");
      void atleti_query.refetch();
      toast({ title: t("pista.salvato_titolo") });
    } catch (errore) {
      segnala_errore("PistaPage", t("pista.registra_appello"), errore);
    } finally {
      set_salvataggio(false);
    }
  };

  const lingua = i18n.language || "it";
  const data_estesa = adesso.toLocaleDateString(lingua, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const ora_corrente = adesso.toLocaleTimeString(lingua, { hour: "2-digit", minute: "2-digit" });

  const compleanni = compleanni_query.data ?? [];

  const lista_appello = () => (
    <div className="mt-4 space-y-6 pb-32">
      <p className="rounded-xl border-2 border-warning-border bg-warning px-4 py-3 text-xl font-bold text-warning-foreground sm:text-2xl">
        {t("pista.istruzione_appello")}
      </p>
      {gruppi.map((gruppo) => (
        <div key={gruppo.chiave}>
          {gruppo.titolo && (
            <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-muted-foreground">{gruppo.titolo}</h2>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gruppo.atleti.map((atleta) => {
              const assente = assenti.has(atleta.atleta_id);
              return (
                <button
                  key={atleta.atleta_id}
                  onClick={() => alterna(atleta.atleta_id)}
                  className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-colors ${
                    assente
                      ? "border-destructive bg-destructive/15 text-muted-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <span className={`text-lg font-semibold ${assente ? "line-through" : ""}`}>
                    {atleta.cognome} {atleta.nome}
                  </span>
                  {atleta.stato === "avvisato" && (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("pista.avvisato")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const lista_in_pista = () => {
    if (presenti.length === 0) return <MessaggioCentrale testo={t("pista.nessuna_presente")} />;
    return (
      <div className="mt-4 space-y-3 pb-56">
        {programmi_query.isError && (
          <p className="rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-base text-destructive">
            {t("musica.errore_programmi")}
          </p>
        )}
        {presenti.map((atleta) => {
          const titolo = `${atleta.cognome} ${atleta.nome}`;
          const suoi = programmi_per_atleta.get(atleta.atleta_id) ?? [];
          return (
            <div
              key={atleta.atleta_id}
              className="flex min-h-[72px] items-center justify-between gap-4 rounded-xl border-2 border-border bg-card px-4 py-3"
            >
              <span className="truncate text-xl font-semibold">{titolo}</span>
              <div className="flex shrink-0 items-center gap-2">
                {/* Nota rapida: non c'è ancora dove salvarla */}
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12"
                  disabled
                  title={t("pista.prossimamente")}
                >
                  <StickyNote className="mr-2 h-5 w-5" />
                  {t("pista.nota_rapida")}
                </Button>
                {suoi.length > 0 ? (
                  <Button
                    size="lg"
                    className="h-12 min-w-[120px]"
                    onClick={() => {
                      if (suoi.length === 1) apri_lettore(suoi[0], titolo);
                      else set_scelta_disco({ titolo, programmi: suoi });
                    }}
                  >
                    <Music className="mr-2 h-5 w-5" />
                    {t("musica.disco")}
                  </Button>
                ) : (
                  // Chi non ha programmi caricati mostra il posto vuoto, non un errore.
                  <span className="inline-block h-12 min-w-[120px]" aria-hidden="true" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const lista_atlete = () => {
    if (atleti_query.isLoading) return <Caricamento />;
    if (atleti_query.error) return <MessaggioCentrale variante="errore" testo={(atleti_query.error as Error).message} />;
    if (atleti.length === 0) return <MessaggioCentrale testo={t("pista.nessuna_atleta")} />;
    return momento === "appello" ? lista_appello() : lista_in_pista();
  };

  const contatore = (
    <>
      <div className="sticky top-0 z-40 -mx-4 mt-4 border-y border-border bg-background px-4 py-3 text-xl font-bold">
        {t("pista.contatore", { presenti: n_presenti, assenti: n_assenti })}
      </div>
      {ripreso && (
        <p className="mt-2 rounded-lg border border-border bg-muted/50 px-4 py-2 text-base">{t("pista.ripresa_bozza")}</p>
      )}
    </>
  );

  const vista_tutto = () => {
    if (sessioni_tutte_query.isLoading) return <Caricamento />;
    if (sessioni_tutte_query.error)
      return <MessaggioCentrale variante="errore" testo={(sessioni_tutte_query.error as Error).message} />;
    if (sessioni.length === 0)
      return <MessaggioCentrale testo={session?.club_id ? t("pista.nessuna_sessione") : t("pista.serve_club")} />;
    return (
      <>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {sessioni.map((s) => {
            const attiva = s.sessione_id === sessione_id;
            return (
              <button
                key={s.sessione_id}
                onClick={() => cambia_sessione(s.sessione_id)}
                className={`min-w-[190px] min-h-[96px] shrink-0 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  attiva
                    ? "border-primary bg-primary text-primary-foreground"
                    : s.in_corso
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <div className="text-2xl font-bold tabular-nums">{ora_breve(s.ora_inizio)}</div>
                <div className="text-base font-medium truncate">{s.titolo ?? ""}</div>
                <div className="text-sm opacity-80">{t("pista.n_atlete", { count: s.n_atleti ?? 0 })}</div>
              </button>
            );
          })}
        </div>

        {sessione_selezionata && (
          <div className="mt-4 text-lg">
            {sessione_selezionata.specialita && <span className="font-semibold">{sessione_selezionata.specialita}</span>}
            {sessione_selezionata.specialita && sessione_selezionata.istruttori && <span className="mx-2">·</span>}
            {sessione_selezionata.istruttori && (
              <span className="text-muted-foreground">{sessione_selezionata.istruttori}</span>
            )}
          </div>
        )}

        {contatore}
        {lista_atlete()}
      </>
    );
  };

  const vista_istruttore = () => {
    // Finché la linguetta non è stata scelta la query è disabilitata: è ancora caricamento.
    if (tab === null || sessioni_istruttore_query.isLoading) return <Caricamento />;
    if (sessioni_istruttore_query.error)
      return <MessaggioCentrale variante="errore" testo={(sessioni_istruttore_query.error as Error).message} />;
    if (sessioni.length === 0) return <MessaggioCentrale testo={t("pista.istruttore_senza_sessioni")} />;

    return (
      <>
        {sessioni.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {sessioni.map((s) => {
              const attiva = s.sessione_id === sessione_id;
              return (
                <button
                  key={s.sessione_id}
                  onClick={() => cambia_sessione(s.sessione_id)}
                  className={`min-w-[160px] min-h-[72px] shrink-0 rounded-xl border-2 px-4 py-2 text-left transition-colors ${
                    attiva
                      ? "border-primary bg-primary text-primary-foreground"
                      : s.in_corso
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="text-xl font-bold tabular-nums">{ora_breve(s.ora_inizio)}</div>
                  <div className="text-sm font-medium truncate">{s.titolo ?? ""}</div>
                </button>
              );
            })}
          </div>
        )}

        {sessione_selezionata && (
          <div className="mt-3">
            <div className="text-2xl font-bold tabular-nums">
              {ora_breve(sessione_selezionata.ora_inizio)}
              {sessione_selezionata.ora_fine ? `–${ora_breve(sessione_selezionata.ora_fine)}` : ""}
              {sessione_selezionata.titolo ? <span className="ml-3 font-semibold">{sessione_selezionata.titolo}</span> : null}
            </div>
            <div className="text-lg">
              {sessione_selezionata.specialita && (
                <span className="font-semibold">{sessione_selezionata.specialita}</span>
              )}
              {sessione_selezionata.specialita && sessione_selezionata.altri_istruttori && <span className="mx-2">·</span>}
              {sessione_selezionata.altri_istruttori && (
                <span className="text-muted-foreground">
                  {t("pista.con_istruttori", { nomi: sessione_selezionata.altri_istruttori })}
                </span>
              )}
            </div>
          </div>
        )}

        {contatore}
        {lista_atlete()}
      </>
    );
  };

  const contenuto = () => {
    if (istruttori_query.isLoading) return <Caricamento />;
    if (istruttori_query.error)
      return <MessaggioCentrale variante="errore" testo={(istruttori_query.error as Error).message} />;
    if (istruttori.length === 0 && !in_tutto)
      return <MessaggioCentrale testo={session?.club_id ? t("pista.nessuna_sessione") : t("pista.serve_club")} />;
    return in_tutto ? vista_tutto() : vista_istruttore();
  };

  const mostra_barra = in_tutto ? sessioni.length > 0 : !!sessione_id;

  return (
    <div className={schermo_intero ? "fixed inset-0 z-50 overflow-y-auto bg-background px-4" : "relative min-h-[70vh] px-4"}>
      <header className="flex items-start justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold capitalize">{data_estesa}</h1>
          <p className="text-4xl font-bold tabular-nums">{ora_corrente}</p>
        </div>
        <Button
          variant={schermo_intero ? "default" : "outline"}
          size="lg"
          onClick={() => set_schermo_intero((v) => !v)}
        >
          {schermo_intero ? <Minimize2 className="mr-2 h-5 w-5" /> : <Maximize2 className="mr-2 h-5 w-5" />}
          {schermo_intero ? t("pista.esci_schermo_intero") : t("pista.schermo_intero")}
        </Button>
      </header>

      {compleanni.length > 0 && (
        <div className="mb-3 rounded-lg border border-border bg-muted/50 px-4 py-2 text-base">
          <span className="font-semibold">{t("pista.compleanni_oggi")}</span>{" "}
          {compleanni
            .map((c) =>
              c.anni == null
                ? t("pista.compleanno_persona_senza_anni", { nome: c.nome, cognome: c.cognome })
                : t("pista.compleanno_persona", { nome: c.nome, cognome: c.cognome, count: c.anni }),
            )
            .join(", ")}
        </div>
      )}

      {/* Linguette istruttori + Tutto il ghiaccio */}
      <div className="flex gap-3 overflow-x-auto border-b border-border pb-2">
        {istruttori.map((i) => {
          const attiva = i.istruttore_id === tab;
          return (
            <button
              key={i.istruttore_id}
              onClick={() => cambia_istruttore(i.istruttore_id)}
              className={`min-w-[170px] min-h-[72px] shrink-0 rounded-xl border-2 px-4 py-2 text-left transition-colors ${
                attiva
                  ? "border-primary bg-primary text-primary-foreground"
                  : i.ha_sessione_in_corso
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                {i.ha_sessione_in_corso && (
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${attiva ? "bg-primary-foreground" : "bg-primary"}`} />
                )}
                <span className="truncate text-lg font-bold">
                  {i.nome} {i.cognome}
                </span>
              </div>
              <div className="text-sm tabular-nums opacity-80">{ora_breve(i.prima_ora)}</div>
            </button>
          );
        })}
        <button
          onClick={() => cambia_istruttore(TUTTO)}
          className={`min-w-[170px] min-h-[72px] shrink-0 rounded-xl border-2 px-4 py-2 text-left transition-colors ${
            in_tutto
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted"
          }`}
        >
          <span className="text-lg font-bold">{t("pista.tutto_il_ghiaccio")}</span>
        </button>
      </div>

      {contenuto()}

      {mostra_barra && (
        <div
          className={`${schermo_intero ? "absolute" : "sticky"} inset-x-0 bottom-0 z-20 border-t border-border bg-background p-3`}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-1">
            {momento === "appello" ? (
              <Button
                size="lg"
                className="h-16 w-full text-lg font-bold"
                disabled={salvataggio || !sessione_id || !lista_pronta}
                onClick={registra}
              >
                {salvataggio ? t("pista.registrazione_in_corso") : t("pista.registra_appello")}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="h-16 w-full text-lg font-bold"
                onClick={() => set_momento("appello")}
              >
                {t("pista.correggi_appello")}
              </Button>
            )}
            {registrato_alle && (
              <p className="text-center text-sm text-muted-foreground">
                {t("pista.registrato_alle", { ora: registrato_alle })}
              </p>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!in_attesa} onOpenChange={(aperto) => !aperto && set_in_attesa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pista.conferma_cambio_titolo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {in_attesa?.tipo === "istruttore" ? t("pista.conferma_cambio_istruttore_testo") : t("pista.conferma_cambio_testo")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("annulla", { defaultValue: "Annulla" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (in_attesa) {
                  if (in_attesa.tipo === "istruttore") applica_istruttore(in_attesa.id);
                  else applica_sessione(in_attesa.id);
                }
                set_in_attesa(null);
              }}
            >
              {in_attesa?.tipo === "istruttore"
                ? t("pista.conferma_cambio_istruttore_azione")
                : t("pista.conferma_cambio_azione")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scelta del programma quando l'atleta ne ha più di uno */}
      <Dialog open={!!scelta_disco} onOpenChange={(aperto) => !aperto && set_scelta_disco(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{scelta_disco?.titolo ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {(scelta_disco?.programmi ?? []).map((p) => (
              <Button
                key={p.id}
                size="lg"
                variant="outline"
                className="h-14 justify-start"
                onClick={() => {
                  apri_lettore(p, scelta_disco!.titolo);
                  set_scelta_disco(null);
                }}
              >
                <Music className="mr-2 h-5 w-5" />
                {t(`musica.tipo_${p.tipo}`, { defaultValue: p.tipo })}
                {p.titolo_brano ? ` · ${p.titolo_brano}` : ""}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {programma_attivo && (
        <LettoreDisco
          key={programma_attivo.programma.id}
          programma={programma_attivo.programma}
          titolo_atleta={programma_attivo.titolo}
          onClose={() => set_programma_attivo(null)}
        />
      )}
    </div>
  );
};

export default PistaPage;
