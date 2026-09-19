import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, LogOut, Maximize2, Minimize2, MoreVertical, Music, StickyNote, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import DateInput from "@/components/forms/DateInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import LettoreDisco from "@/components/musica/LettoreDisco";
import { type ProgrammaMusicale } from "@/hooks/use-programmi-musicali";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";
import { useAuth } from "@/lib/auth";
import { esci_dalla_pista } from "@/lib/pista-codice";

/**
 * Bordo pista: tablet condiviso a bordo ghiaccio.
 * Divisione principale per istruttore, più una linguetta "Tutto il ghiaccio".
 * Usa ESCLUSIVAMENTE le RPC pista_* (nessuna lettura diretta di tabelle).
 */

const TUTTO = "__tutto_il_ghiaccio";

const ora_breve = (valore: string | null) => (valore ? String(valore).slice(0, 5) : "");

/** Minuti dalla mezzanotte, oppure null se l'orario manca o non è leggibile. */
const minuti_da_ora = (valore: string | null | undefined): number | null => {
  if (!valore) return null;
  const [h, m] = String(valore).slice(0, 5).split(":");
  const hn = Number(h);
  const mn = Number(m);
  if (!Number.isFinite(hn) || !Number.isFinite(mn)) return null;
  return hn * 60 + mn;
};

const da_minuti = (minuti: number) =>
  `${String(Math.floor(Math.max(minuti, 0) / 60)).padStart(2, "0")}:${String(Math.max(minuti, 0) % 60).padStart(2, "0")}`;

/** Quanto prima dell'inizio della lezione si può registrare l'appello. */
const ANTICIPO_APPELLO_MIN = 15;

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

const PistaPage: React.FC<{ sessione_pista?: boolean }> = ({ sessione_pista = false }) => {
  const { t, i18n } = useTranslation("common");
  const { session } = useAuth();
  const [adesso, set_adesso] = React.useState(() => new Date());
  // Istante di riferimento: di norma adesso; presidenza, dt e superadmin possono sceglierne un altro.
  const [istante_scelto, set_istante_scelto] = React.useState<Date | null>(null);
  const [pannello_momento, set_pannello_momento] = React.useState(false);
  const [bozza_data, set_bozza_data] = React.useState("");
  const [bozza_ora, set_bozza_ora] = React.useState("");
  const [tab, set_tab] = React.useState<string>(TUTTO);
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
  const [nota_target, set_nota_target] = React.useState<{ atleta_id: string; titolo: string } | null>(null);
  const [nota_testo, set_nota_testo] = React.useState("");
  const [nota_salvataggio, set_nota_salvataggio] = React.useState(false);
  const [note_aperte, set_note_aperte] = React.useState<{ atleta_id: string; titolo: string } | null>(null);
  const [nota_in_eliminazione, set_nota_in_eliminazione] = React.useState<string | null>(null);
  const [scollega_aperto, set_scollega_aperto] = React.useState(false);



  React.useEffect(() => {
    const timer = window.setInterval(() => set_adesso(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const riferimento = istante_scelto ?? adesso;
  const giorno = chiave_giorno(riferimento);
  const minuti_riferimento = riferimento.getHours() * 60 + riferimento.getMinutes();
  const momento_simulato = istante_scelto !== null;
  const puo_scegliere_momento =
    !sessione_pista &&
    (session?.ruolo === "presidente" || session?.ruolo === "dt" || session?.ruolo === "superadmin");
  // La sessione pista non ha riga in utenti_club: il club arriva dal suo gettone.
  const senza_club = !sessione_pista && !session?.club_id;

  const compleanni_query = useQuery({
    queryKey: ["pista_compleanni", giorno],
    refetchInterval: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_compleanni", { p_data: giorno });
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
      const { data, error } = await supabase.rpc("pista_istruttori", { p_data: giorno });
      if (error) {
        segnala_errore("PistaPage", "pista_istruttori", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

  const istruttori = React.useMemo(() => istruttori_query.data ?? [], [istruttori_query.data]);

  // «Tutti» è la linguetta predefinita: si cambia solo toccandone un'altra.
  const in_tutto = tab === TUTTO;
  const istruttore_id = in_tutto ? null : tab;

  // Sempre attiva: serve anche a costruire le linguette degli istruttori del giorno.
  const sessioni_tutte_query = useQuery({
    queryKey: ["pista_sessioni", giorno],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_sessioni", { p_data: giorno });
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
        p_data: giorno,
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
    istruttori_ids?: string[] | null;
    altri_istruttori?: string | null;
    istruttori?: string | null;
  };

  const sessioni_query = in_tutto ? sessioni_tutte_query : sessioni_istruttore_query;
  const sessioni: Sessione[] = React.useMemo(
    () => (sessioni_query.data ?? []) as Sessione[],
    [sessioni_query.data],
  );


  // "In corso" si calcola sull'istante di riferimento: quello del server è su now().
  const e_in_corso = React.useCallback(
    (s: Sessione) => {
      const inizio = minuti_da_ora(s.ora_inizio);
      const fine = minuti_da_ora(s.ora_fine);
      if (inizio == null || fine == null) return false;
      return minuti_riferimento >= inizio && minuti_riferimento < fine;
    },
    [minuti_riferimento],
  );

  // Linguette: istruttori davvero sul ghiaccio quel giorno, ricavati dagli id delle sessioni.
  const ids_istruttori_oggi = React.useMemo(() => {
    const insieme = new Set<string>();
    for (const s of (sessioni_tutte_query.data ?? []) as Sessione[]) {
      for (const id of s.istruttori_ids ?? []) insieme.add(id);
    }
    return insieme;
  }, [sessioni_tutte_query.data]);

  const istruttori_presenti = React.useMemo(
    () => istruttori.filter((i) => ids_istruttori_oggi.has(i.istruttore_id)),
    [istruttori, ids_istruttori_oggi],
  );

  // Se la linguetta scelta non esiste più (cambio di giorno) si torna a «Tutti»,
  // ma solo quando la lettura è davvero riuscita: mai su una lista non ancora arrivata.
  React.useEffect(() => {
    if (in_tutto) return;
    if (!sessioni_tutte_query.isSuccess) return;
    if (ids_istruttori_oggi.has(tab)) return;
    set_tab(TUTTO);
  }, [in_tutto, ids_istruttori_oggi, tab, sessioni_tutte_query.isSuccess]);

  // Selezione automatica sessione: si aggiorna a ogni scatto dell'orologio, ma mai
  // se ci sono modifiche non registrate o se l'utente ha scelto a mano.
  React.useEffect(() => {
    if (sessioni.length === 0) return;
    if (modificato) return;
    if (scelta_manuale && sessione_id && sessioni.some((s) => s.sessione_id === sessione_id)) return;
    // Prima la sessione in corso. Se non ce n'è nessuna, l'ultima già cominciata
    // oggi (non la prossima, che è ancora bloccata); in mancanza, la prima del giorno.
    const in_corso = sessioni.find((s) => e_in_corso(s));
    const gia_cominciate = sessioni.filter((s) => (minuti_da_ora(s.ora_inizio) ?? -1) <= minuti_riferimento);
    const ultima_cominciata = gia_cominciate[gia_cominciate.length - 1];
    const scelta = (in_corso ?? ultima_cominciata ?? sessioni[0]).sessione_id;
    if (scelta !== sessione_id) {
      // Cambio automatico di sessione: si riparte dall'appello della nuova
      // sessione, mai restando nell'elenco della precedente.
      if (sessione_id) azzera_appello();
      set_sessione_id(scelta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessioni, sessione_id, minuti_riferimento, modificato, scelta_manuale]);

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
  // Musica: come tutto il resto della pagina passa da una RPC `pista_*`.
  // Il tablet non ha una riga in utenti_club, quindi get_current_club_id() è vuoto
  // e una lettura diretta della tabella non partirebbe mai (difetto invisibile).
  // I dischi sono disponibili già in fase di appello: mettere un brano non dipende
  // dall'aver registrato le presenze né dall'orario.
  const programmi_query = useQuery({
    queryKey: ["pista_programmi", sessione_id],
    enabled: !!sessione_id,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ProgrammaMusicale[]> => {
      const { data, error } = await supabase.rpc("pista_programmi", {
        p_sessione_id: sessione_id as string,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        atleta_id: p.atleta_id,
        // La RPC pista_programmi non restituisce il club: non inventarlo.
        club_id: null,
        tipo: p.tipo,
        titolo_brano: p.titolo_brano ?? null,
        file_path: p.file_path ?? null,
        durata_sec: p.durata_sec ?? null,
        in_preparazione: !!p.in_preparazione,
        attivo: true,
      }));
    },
  });

  React.useEffect(() => {
    if (programmi_query.isError) {
      segnala_errore("PistaPage", "lettura programmi musicali", programmi_query.error);
    }
  }, [programmi_query.isError, programmi_query.error]);

  const programmi_per_atleta = React.useMemo(() => {
    const mappa = new Map<string, ProgrammaMusicale[]>();
    for (const p of programmi_query.data ?? []) {
      if (!p.file_path) continue;
      if (!mappa.has(p.atleta_id)) mappa.set(p.atleta_id, []);
      mappa.get(p.atleta_id)!.push(p);
    }
    return mappa;
  }, [programmi_query.data]);

  /** Bottone del disco di un'atleta: lo stesso in appello e in pista. */
  const bottone_disco = (atleta_id: string, titolo: string) => {
    const suoi = programmi_per_atleta.get(atleta_id) ?? [];
    if (suoi.length === 0) return null;
    return (
      <Button
        size="lg"
        className="h-12 min-w-[120px]"
        onClick={(e) => {
          e.stopPropagation();
          if (suoi.length === 1) apri_lettore(suoi[0], titolo);
          else set_scelta_disco({ titolo, programmi: suoi });
        }}
      >
        <Music className="mr-2 h-5 w-5" />
        {t("musica.disco")}
      </Button>
    );
  };

  // ---- Note rapide: sole RPC pista_note / pista_nota_salva / pista_nota_elimina ----
  type NotaPista = {
    id: string;
    atleta_id: string;
    testo: string;
    autore_nome: string | null;
    creata_il: string;
  };

  const note_query = useQuery({
    queryKey: ["pista_note", sessione_id],
    enabled: !!sessione_id,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pista_note", { p_sessione_id: sessione_id as string });
      if (error) throw new Error(error.message);
      return (data ?? []) as NotaPista[];
    },
  });

  // segnala_errore fuori dalla queryFn: con i tentativi automatici la funzione
  // gira più volte e produrrebbe avvisi doppi.
  React.useEffect(() => {
    if (note_query.isError) segnala_errore("PistaPage", "pista_note", note_query.error);
  }, [note_query.isError, note_query.error]);

  const note_per_atleta = React.useMemo(() => {
    const mappa = new Map<string, NotaPista[]>();
    for (const n of note_query.data ?? []) {
      if (!mappa.has(n.atleta_id)) mappa.set(n.atleta_id, []);
      mappa.get(n.atleta_id)!.push(n);
    }
    return mappa;
  }, [note_query.data]);

  const salva_nota = async () => {
    if (!nota_target || !sessione_id) return;
    const testo = nota_testo.trim();
    if (!testo) return;
    set_nota_salvataggio(true);
    try {
      const { error } = await supabase.rpc("pista_nota_salva", {
        p_sessione_id: sessione_id,
        p_atleta_id: nota_target.atleta_id,
        p_testo: testo,
      });
      if (error) throw new Error(error.message);
      await note_query.refetch();
      // Si chiude solo dopo una scrittura davvero riuscita.
      set_nota_target(null);
      set_nota_testo("");
      toast({ title: t("pista.nota_salvata") });
    } catch (errore) {
      // La finestrella resta aperta e il testo scritto non si perde.
      segnala_errore("PistaPage", t("pista.nota_rapida"), errore);
    } finally {
      set_nota_salvataggio(false);
    }
  };

  const elimina_nota = async (nota_id: string) => {
    set_nota_in_eliminazione(nota_id);
    try {
      const { error } = await supabase.rpc("pista_nota_elimina", { p_nota_id: nota_id });
      // Messaggio del database, mai uno inventato.
      if (error) throw new Error(error.message);
      await note_query.refetch();
    } catch (errore) {
      segnala_errore("PistaPage", t("pista.note_titolo"), errore);
    } finally {
      set_nota_in_eliminazione(null);
    }
  };

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
    set_nota_target(null);
    set_nota_testo("");
    set_note_aperte(null);
    set_nota_in_eliminazione(null);
  };

  const applica_sessione = (id: string) => {
    azzera_appello();
    set_sessione_id(id);
    set_scelta_manuale(true);
  };

  const applica_istruttore = (id: string) => {
    azzera_appello();
    set_tab(id);
    
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

  /** Applica l'istante scelto: la pagina si ricalcola tutta su quel momento. */
  const applica_momento = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bozza_data) || !/^\d{2}:\d{2}$/.test(bozza_ora)) return;
    if (modificato) {
      // Un appello non ancora registrato non si butta via cambiando momento.
      toast({ title: t("pista.momento_appello_aperto") });
      return;
    }
    const [y, m, d] = bozza_data.split("-").map(Number);
    const [hh, mi] = bozza_ora.split(":").map(Number);
    azzera_appello();
    set_istante_scelto(new Date(y, m - 1, d, hh, mi, 0, 0));
    set_sessione_id(null);
    set_scelta_manuale(false);
    set_pannello_momento(false);
  };

  const registra = async () => {
    if (!sessione_id || !lista_pronta) return;
    if (!appello_sbloccato) return;
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

  // Corrimano orario: si registra da 15 minuti prima dell'inizio in poi. Dopo la
  // fine della lezione resta aperto: l'istruttore registra quando scende dal ghiaccio.
  const inizio_sessione_min = minuti_da_ora(sessione_selezionata?.ora_inizio ?? null);
  const minuti_sblocco = inizio_sessione_min == null ? null : inizio_sessione_min - ANTICIPO_APPELLO_MIN;
  const appello_sbloccato = minuti_sblocco == null ? true : minuti_riferimento >= minuti_sblocco;
  const ora_sblocco = minuti_sblocco == null ? "" : da_minuti(minuti_sblocco);

  const lingua = i18n.language || "it";
  const data_estesa = riferimento.toLocaleDateString(lingua, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const ora_corrente = riferimento.toLocaleTimeString(lingua, { hour: "2-digit", minute: "2-digit" });

  const compleanni = compleanni_query.data ?? [];

  const lista_appello = () => (
    <div className="mt-4 space-y-6 pb-32">
      <p className="rounded-xl border-2 border-warning-border bg-warning px-4 py-3 text-xl font-bold text-warning-foreground sm:text-2xl">
        {t("pista.istruzione_appello")}
      </p>
      {programmi_query.isError && (
        <p className="rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-base text-destructive">
          {t("musica.errore_programmi")}
        </p>
      )}
      {gruppi.map((gruppo) => (
        <div key={gruppo.chiave}>
          {gruppo.titolo && (
            <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-muted-foreground">{gruppo.titolo}</h2>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gruppo.atleti.map((atleta) => {
              const assente = assenti.has(atleta.atleta_id);
              const titolo_atleta = `${atleta.cognome} ${atleta.nome}`;
              return (
                <div
                  key={atleta.atleta_id}
                  className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-colors ${
                    assente
                      ? "border-destructive bg-destructive/15 text-muted-foreground"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => alterna(atleta.atleta_id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {!assente && <Check className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      <span className="min-w-0">
                        <span className={`block text-lg font-semibold ${assente ? "line-through" : ""}`}>
                          {titolo_atleta}
                        </span>
                        {assente && (
                          <span className="block text-xs font-medium text-muted-foreground">
                            {t("pista.tocca_per_annullare")}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {assente && (
                        <span className="rounded-md bg-destructive px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-destructive-foreground">
                          {t("pista.assente_etichetta")}
                        </span>
                      )}
                      {atleta.stato === "avvisato" && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {t("pista.avvisato")}
                        </span>
                      )}
                    </span>
                  </button>
                  {bottone_disco(atleta.atleta_id, titolo_atleta)}
                </div>
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
        {note_query.isError && (
          <p className="rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-base text-destructive">
            {t("pista.note_errore")}
          </p>
        )}
        {presenti.map((atleta) => {
          const titolo = `${atleta.cognome} ${atleta.nome}`;
          const disco = bottone_disco(atleta.atleta_id, titolo);
          const sue_note = note_per_atleta.get(atleta.atleta_id) ?? [];
          return (
            <div
              key={atleta.atleta_id}
              className="flex min-h-[72px] items-center justify-between gap-4 rounded-xl border-2 border-border bg-card px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-xl font-semibold">{titolo}</span>
                {/* Conteggio note: mostrato solo se ce n'è almeno una. */}
                {sue_note.length > 0 && (
                  <button
                    type="button"
                    onClick={() => set_note_aperte({ atleta_id: atleta.atleta_id, titolo })}
                    className="mt-0.5 text-sm font-medium text-muted-foreground underline underline-offset-2"
                  >
                    {t("pista.note_conteggio", { count: sue_note.length })}
                  </button>
                )}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                    set_nota_testo("");
                    set_nota_target({ atleta_id: atleta.atleta_id, titolo });
                  }}
                >
                  <StickyNote className="mr-2 h-5 w-5" />
                  {t("pista.nota_rapida")}
                </Button>

                {disco ?? (
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
    if (sessioni.length === 0) return <MessaggioCentrale testo={t("pista.nessuna_sessione")} />;
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
                    : e_in_corso(s)
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
            {sessione_selezionata.istruttori && sessione_selezionata.specialita && (
              <span className="mx-2">·</span>
            )}

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
    if (sessioni_istruttore_query.isLoading) return <Caricamento />;
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
                      : e_in_corso(s)
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
              {sessione_selezionata.altri_istruttori && sessione_selezionata.specialita && (
                <span className="mx-2">·</span>
              )}

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
    // Un account senza club (per esempio un superadmin) non ha nessun ghiaccio da mostrare:
    // va detto com'è, non confuso con "nessuna sessione pubblicata".
    if (senza_club) return <MessaggioCentrale testo={t("pista.senza_club")} />;
    if (istruttori_query.isLoading) return <Caricamento />;
    if (istruttori_query.error)
      return <MessaggioCentrale variante="errore" testo={(istruttori_query.error as Error).message} />;
    return in_tutto ? vista_tutto() : vista_istruttore();
  };

  const mostra_barra = in_tutto ? sessioni.length > 0 : !!sessione_id;

  return (
    <div className={schermo_intero ? "fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-background px-4" : "relative min-h-[70vh] overflow-x-hidden px-4"}>
      {/* Intestazione fissa: a schermo intero non deve scorrere via con
          l'elenco, altrimenti l'uscita del tablet diventa introvabile.
          Va a capo invece di debordare: il titolo si restringe e i bottoni
          passano alla riga sotto quando la larghezza non basta. */}
      <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 bg-background py-4">
        <div className="min-w-0 flex-1">
          <h1 className="min-w-0 break-words text-2xl md:text-3xl font-bold capitalize">{data_estesa}</h1>
          <p className="text-4xl font-bold tabular-nums">{ora_corrente}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">

          {/* Selettore del momento: solo presidenza, direzione tecnica e superadmin. */}
          {puo_scegliere_momento && (
            <Button
              variant={momento_simulato ? "default" : "ghost"}
              size="lg"
              aria-label={momento_simulato ? t("pista.momento_attivo") : t("pista.momento_scegli")}
              onClick={() => {
                set_bozza_data(giorno);
                set_bozza_ora(da_minuti(minuti_riferimento));
                set_pannello_momento((v) => !v);
              }}
            >
              <Clock className="mr-2 h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">
                {momento_simulato ? t("pista.momento_attivo") : t("pista.momento_scegli")}
              </span>
            </Button>
          )}
          <Button
            variant={schermo_intero ? "default" : "outline"}
            size="lg"
            aria-label={schermo_intero ? t("pista.esci_schermo_intero") : t("pista.schermo_intero")}
            onClick={() => set_schermo_intero((v) => !v)}
          >
            {schermo_intero ? <Minimize2 className="mr-2 h-5 w-5 shrink-0" /> : <Maximize2 className="mr-2 h-5 w-5 shrink-0" />}
            <span className="hidden sm:inline">
              {schermo_intero ? t("pista.esci_schermo_intero") : t("pista.schermo_intero")}
            </span>
          </Button>

          {/* Uscita definitiva del tablet, dietro un menu discreto: dimentica il codice
              conservato ed è rara, non deve stare accanto a bottoni toccati di continuo. */}
          {sessione_pista && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" aria-label={t("pista.scollega")}>
                  <MoreVertical className="mr-2 h-5 w-5" />
                  {t("pista.scollega")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => set_scollega_aperto(true)}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("pista.scollega")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {puo_scegliere_momento && pannello_momento && (
        <div className="mb-3 rounded-xl border-2 border-border bg-card px-4 py-3">
          <p className="mb-2 text-base font-semibold">{t("pista.momento_titolo")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <DateInput value={bozza_data} onChange={set_bozza_data} />
            <input
              type="time"
              value={bozza_ora}
              onChange={(e) => set_bozza_ora(e.target.value)}
              className="h-12 rounded-lg border-2 border-border bg-background px-3 text-lg tabular-nums"
            />
            <Button size="lg" className="h-12" onClick={applica_momento}>
              {t("pista.momento_applica")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12"
              onClick={() => {
                if (modificato) {
                  toast({ title: t("pista.momento_appello_aperto") });
                  return;
                }
                azzera_appello();
                set_istante_scelto(null);
                set_sessione_id(null);
                set_scelta_manuale(false);
                set_pannello_momento(false);
              }}
            >
              {t("pista.momento_adesso")}
            </Button>
          </div>
        </div>
      )}

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

      {/* Linguette: «Tutti» (predefinita) più gli istruttori sul ghiaccio quel giorno */}
      {!senza_club && (
        <div className="flex gap-3 overflow-x-auto border-b border-border pb-2">
          <button
            onClick={() => cambia_istruttore(TUTTO)}
            className={`min-w-[170px] min-h-[72px] shrink-0 rounded-xl border-2 px-4 py-2 text-left transition-colors ${
              in_tutto
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            <span className="text-lg font-bold">{t("pista.tutti")}</span>
          </button>
          {istruttori_presenti.map((i) => {
            const attiva = i.istruttore_id === tab;
            return (
              <button
                key={i.istruttore_id}
                onClick={() => cambia_istruttore(i.istruttore_id)}
                className={`min-w-[170px] min-h-[72px] shrink-0 rounded-xl border-2 px-4 py-2 text-left transition-colors ${
                  attiva
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <span className="truncate text-lg font-bold">
                  {i.nome} {i.cognome}
                </span>
                <div className="text-sm tabular-nums opacity-80">{ora_breve(i.prima_ora)}</div>
              </button>
            );
          })}
        </div>
      )}

      {contenuto()}

      {/* La barra in fondo resta per l'appello, anche a schermo intero:
          non contiene più l'uscita del tablet, che sta nel menu dell'intestazione. */}
      {mostra_barra && !senza_club && (
        <div
          className={`${schermo_intero ? "absolute" : "sticky"} inset-x-0 bottom-0 z-20 border-t border-border bg-background p-3`}
        >
          <div className="mx-auto flex max-w-5xl items-start gap-2">
            <div className="flex flex-1 flex-col gap-1">
              {momento === "appello" ? (
                <>
                  <Button
                    size="lg"
                    className="h-16 w-full text-lg font-bold"
                    disabled={salvataggio || !sessione_id || !lista_pronta || !appello_sbloccato}
                    onClick={registra}
                  >
                    {salvataggio ? t("pista.registrazione_in_corso") : t("pista.registra_appello")}
                  </Button>
                  {/* Prima dell'inizio si spiega il perché e da che ora si sblocca. */}
                  {!appello_sbloccato && (
                    <p className="text-center text-base font-medium text-muted-foreground">
                      {t("pista.appello_non_ancora", { ora: ora_sblocco })}
                    </p>
                  )}
                </>
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

      {/* Uscita definitiva del tablet: la conferma dice chiaramente che per
          rientrare servirà il codice del club o il suo QR. */}
      <AlertDialog open={scollega_aperto} onOpenChange={(aperto) => !aperto && set_scollega_aperto(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pista.esci_titolo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("pista.esci_testo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("annulla", { defaultValue: "Annulla" })}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                set_scollega_aperto(false);
                // Il cambio pagina sta dentro esci_dalla_pista: anche a rete
                // morta l'uscita si completa, senza dipendere da una promessa.
                void esci_dalla_pista();
              }}
            >
              {t("pista.scollega")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nota rapida: scrittura */}
      <Dialog
        open={!!nota_target}
        onOpenChange={(aperto) => {
          if (!aperto && !nota_salvataggio) {
            set_nota_target(null);
            set_nota_testo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">{nota_target?.titolo ?? ""}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={nota_testo}
            onChange={(e) => set_nota_testo(e.target.value)}
            rows={6}
            placeholder={t("pista.nota_placeholder")}
            className="min-h-[160px] text-lg"
          />
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="h-14 flex-1 text-lg"
              disabled={nota_salvataggio}
              onClick={() => {
                set_nota_target(null);
                set_nota_testo("");
              }}
            >
              {t("annulla", { defaultValue: "Annulla" })}
            </Button>
            <Button
              size="lg"
              className="h-14 flex-1 text-lg font-bold"
              disabled={nota_salvataggio || nota_testo.trim().length === 0}
              onClick={salva_nota}
            >
              {nota_salvataggio ? t("pista.nota_salvataggio_in_corso") : t("salva", { defaultValue: "Salva" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nota rapida: note già scritte */}
      <Dialog open={!!note_aperte} onOpenChange={(aperto) => !aperto && set_note_aperte(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">{note_aperte?.titolo ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {note_query.isError ? (
              <p className="text-base text-destructive">{t("pista.note_errore")}</p>
            ) : (
              (note_per_atleta.get(note_aperte?.atleta_id ?? "") ?? []).map((n) => (
                <div key={n.id} className="rounded-xl border border-border p-3">
                  <p className="whitespace-pre-wrap text-lg">{n.testo}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {t("pista.nota_firma", {
                        autore: n.autore_nome ?? "—",
                        ora: new Date(n.creata_il).toLocaleTimeString(lingua, { hour: "2-digit", minute: "2-digit" }),
                      })}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={nota_in_eliminazione === n.id}
                      onClick={() => elimina_nota(n.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("elimina", { defaultValue: "Elimina" })}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                {` · ${p.titolo_brano || t("musica.senza_titolo")}`}
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
