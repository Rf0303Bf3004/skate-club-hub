import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
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
 * Usa ESCLUSIVAMENTE le RPC pista_sessioni / pista_atleti / pista_appello.
 */

const ora_breve = (valore: string | null) => (valore ? String(valore).slice(0, 5) : "");

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

const PistaPage: React.FC = () => {
  const { t, i18n } = useTranslation("common");
  const { session } = useAuth();
  const [adesso, set_adesso] = React.useState(() => new Date());
  const [sessione_id, set_sessione_id] = React.useState<string | null>(null);
  const [scelta_manuale, set_scelta_manuale] = React.useState(false);
  const [assenti, set_assenti] = React.useState<Set<string>>(new Set());
  const [modificato, set_modificato] = React.useState(false);
  const [salvataggio, set_salvataggio] = React.useState(false);
  const [registrato_alle, set_registrato_alle] = React.useState<string | null>(null);
  const [sessione_in_attesa, set_sessione_in_attesa] = React.useState<string | null>(null);
  const [schermo_intero, set_schermo_intero] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setInterval(() => set_adesso(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const giorno = chiave_giorno(adesso);

  const sessioni_query = useQuery({
    queryKey: ["pista_sessioni", giorno],
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

  const sessioni = React.useMemo(() => sessioni_query.data ?? [], [sessioni_query.data]);

  // Selezione automatica: si aggiorna a ogni scatto dell'orologio, ma mai
  // se ci sono modifiche non registrate o se l'utente ha scelto a mano.
  React.useEffect(() => {
    if (sessioni.length === 0) return;
    if (modificato) return;
    if (scelta_manuale && sessione_id) return;
    const ora_corrente = `${String(adesso.getHours()).padStart(2, "0")}:${String(adesso.getMinutes()).padStart(2, "0")}`;
    const in_corso = sessioni.find((s) => s.in_corso);
    const prossima = sessioni.find((s) => ora_breve(s.ora_inizio) >= ora_corrente);
    const scelta = (in_corso ?? prossima ?? sessioni[sessioni.length - 1]).sessione_id;
    if (scelta !== sessione_id) set_sessione_id(scelta);
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
    set_assenti(
      new Set(
        atleti_query.data
          .filter((a) => a.stato === "assente" || a.stato === "avvisato")
          .map((a) => a.atleta_id),
      ),
    );
    set_modificato(false);
    set_registrato_alle(null);
  }, [sessione_id, atleti_query.data]);

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

  const applica_sessione = (id: string) => {
    sessione_inizializzata.current = null;
    set_sessione_id(id);
    set_scelta_manuale(true);
    set_assenti(new Set());
    set_modificato(false);
    set_registrato_alle(null);
  };

  const cambia_sessione = (id: string) => {
    if (id === sessione_id) return;
    if (modificato) {
      set_sessione_in_attesa(id);
      return;
    }
    applica_sessione(id);
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

  const contenuto = () => {
    if (sessioni_query.isLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      );
    }
    if (sessioni_query.error) {
      return <MessaggioCentrale variante="errore" testo={(sessioni_query.error as Error).message} />;
    }
    if (sessioni.length === 0) {
      return <MessaggioCentrale testo={session?.club_id ? t("pista.nessuna_sessione") : t("pista.serve_club")} />;
    }

    return (
      <>
        {/* Striscia sessioni di oggi */}
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
            {sessione_selezionata.specialita && (
              <span className="font-semibold">{sessione_selezionata.specialita}</span>
            )}
            {sessione_selezionata.specialita && sessione_selezionata.istruttori && <span className="mx-2">·</span>}
            {sessione_selezionata.istruttori && (
              <span className="text-muted-foreground">{sessione_selezionata.istruttori}</span>
            )}
          </div>
        )}

        {/* Contatore sempre visibile */}
        <div className="sticky top-0 z-40 -mx-4 mt-4 border-y border-border bg-background px-4 py-3 text-xl font-bold">
          {t("pista.contatore", { presenti: n_presenti, assenti: n_assenti })}
        </div>

        {atleti_query.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : atleti_query.error ? (
          <MessaggioCentrale variante="errore" testo={(atleti_query.error as Error).message} />
        ) : atleti.length === 0 ? (
          <MessaggioCentrale testo={t("pista.nessuna_atleta")} />
        ) : (
          <div className="mt-4 space-y-6 pb-32">
            {gruppi.map((gruppo) => (
              <div key={gruppo.chiave}>
                {gruppo.titolo && (
                  <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-muted-foreground">
                    {gruppo.titolo}
                  </h2>
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
        )}
      </>
    );
  };

  return (
    <div
      className={
        schermo_intero
          ? "fixed inset-0 z-50 overflow-y-auto bg-background px-4"
          : "relative min-h-[70vh] px-4"
      }
    >
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

      {contenuto()}

      {sessioni.length > 0 && (
        <div
          className={`${
            schermo_intero ? "absolute" : "sticky"
          } inset-x-0 bottom-0 z-20 border-t border-border bg-background p-3`}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-1">
            <Button
              size="lg"
              className="h-16 w-full text-lg font-bold"
              disabled={salvataggio || !sessione_id || !lista_pronta}
              onClick={registra}
            >
              {salvataggio ? t("pista.registrazione_in_corso") : t("pista.registra_appello")}
            </Button>
            {registrato_alle && (
              <p className="text-center text-sm text-muted-foreground">
                {t("pista.registrato_alle", { ora: registrato_alle })}
              </p>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!sessione_in_attesa} onOpenChange={(aperto) => !aperto && set_sessione_in_attesa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pista.conferma_cambio_titolo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("pista.conferma_cambio_testo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("annulla", { defaultValue: "Annulla" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sessione_in_attesa) applica_sessione(sessione_in_attesa);
                set_sessione_in_attesa(null);
              }}
            >
              {t("pista.conferma_cambio_azione")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PistaPage;
