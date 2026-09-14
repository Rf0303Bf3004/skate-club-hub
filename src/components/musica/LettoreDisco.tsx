import React from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronFirst,
  Pencil,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmButton from "@/components/common/ConfirmButton";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import {
  CAMPI_PUNTO,
  COLORE_PUNTO_FALLBACK,
  firma_disco,
  use_punti_programma,
  type ProgrammaMusicale,
  type PuntoProgramma,
} from "@/hooks/use-programmi-musicali";

/**
 * Lettore del disco dell'atleta: pannello in fondo alla pagina, non copre l'elenco.
 * Il collegamento al file è sempre firmato (bucket privato) e viene rinnovato
 * prima della scadenza e in caso di errore di riproduzione.
 *
 * Pensato per l'uso a bordo pista, in piedi e con i guanti: comandi grandi,
 * barra trascinabile, dissolvenze per non tagliare l'audio dell'impianto.
 */

const VELOCITA = [0.5, 0.75, 0.9, 1] as const;
const CHIAVE_VOLUME = "lettore_disco_volume";
const MS_DISSOLVENZA = 250;

const mmss = (secondi: number) => {
  if (!Number.isFinite(secondi) || secondi < 0) return "0:00";
  const m = Math.floor(secondi / 60);
  const s = Math.floor(secondi % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Volume ricordato fra una sessione e l'altra: mai far saltare il lettore. */
const leggi_volume = (): number => {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_VOLUME);
    const v = grezzo == null ? NaN : Number(grezzo);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
};

const scrivi_volume = (v: number) => {
  try {
    window.localStorage.setItem(CHIAVE_VOLUME, String(v));
  } catch {
    /* la memoria del browser non deve mai rompere il lettore */
  }
};

interface Props {
  programma: ProgrammaMusicale;
  titolo_atleta: string;
  onClose: () => void;
}

const LettoreDisco: React.FC<Props> = ({ programma, titolo_atleta, onClose }) => {
  const { t } = useTranslation("common");
  const query_client = useQueryClient();
  const audio_ref = React.useRef<HTMLAudioElement | null>(null);
  const wake_ref = React.useRef<any>(null);
  const barra_ref = React.useRef<HTMLDivElement | null>(null);

  const [url, set_url] = React.useState<string | null>(null);
  const [errore_audio, set_errore_audio] = React.useState<string | null>(null);
  const [in_riproduzione, set_in_riproduzione] = React.useState(false);
  const [posizione, set_posizione] = React.useState(0);
  const [durata, set_durata] = React.useState(programma.durata_sec ?? 0);
  const [velocita, set_velocita] = React.useState<number>(1);
  const [volume, set_volume] = React.useState<number>(() => leggi_volume());
  const [silenziato, set_silenziato] = React.useState(false);
  const [trascina, set_trascina] = React.useState<number | null>(null);
  const [loop_punto, set_loop_punto] = React.useState<PuntoProgramma | null>(null);
  const [dialogo_punto, set_dialogo_punto] = React.useState(false);
  const [nome_punto, set_nome_punto] = React.useState("");
  const [salvataggio_punto, set_salvataggio_punto] = React.useState(false);
  const [punto_modifica, set_punto_modifica] = React.useState<PuntoProgramma | null>(null);
  const [nome_modifica, set_nome_modifica] = React.useState("");
  // Punto appena segnato di cui si può ancora indicare la fine (ripetizione).
  const [punto_aperto, set_punto_aperto] = React.useState<PuntoProgramma | null>(null);
  // Il rinnovo del collegamento non deve entrare in ciclo: due tentativi e basta.
  const tentativi_firma = React.useRef(0);

  const punti_query = use_punti_programma(programma.id);
  const punti = punti_query.data ?? [];
  const punti_ordinati = React.useMemo(
    () => [...punti].sort((a, b) => a.secondi - b.secondi),
    [punti],
  );

  /**
   * Passaggi pronti da disegnare: numero d'ordine per tempo crescente, colore
   * del database (grigio se manca) e la fila su cui mettere il pallino.
   * Le file servono a non far accavallare due numeri vicini: se l'inizio del
   * passaggio successivo dista meno di SOGLIA_VICINI, il pallino sale di una fila.
   */
  const punti_disegnati = React.useMemo(() => {
    const SOGLIA_VICINI = 4; // percentuale della durata
    const ultima_per_fila: number[] = [];
    return punti_ordinati.map((p, indice) => {
      const sinistra = durata > 0 ? Math.min(100, Math.max(0, (p.secondi / durata) * 100)) : 0;
      let fila = 0;
      while (
        ultima_per_fila[fila] != null &&
        sinistra - (ultima_per_fila[fila] as number) < SOGLIA_VICINI
      ) {
        fila += 1;
      }
      ultima_per_fila[fila] = sinistra;
      const larghezza =
        p.secondi_fine != null && durata > 0
          ? Math.max(0.8, Math.min(100 - sinistra, ((p.secondi_fine - p.secondi) / durata) * 100))
          : null;
      return {
        punto: p,
        numero: indice + 1,
        colore: p.colore || COLORE_PUNTO_FALLBACK,
        sinistra,
        larghezza,
        fila,
      };
    });
  }, [punti_ordinati, durata]);

  const file_numeri = React.useMemo(
    () => punti_disegnati.reduce((max, d) => Math.max(max, d.fila + 1), 1),
    [punti_disegnati],
  );


  // Velocità e volume devono sopravvivere al rinnovo del collegamento, che
  // ricarica l'elemento audio: si rileggono sempre da questi riferimenti.
  const velocita_ref = React.useRef(velocita);
  const volume_ref = React.useRef(volume);
  const silenziato_ref = React.useRef(silenziato);
  const loop_ref = React.useRef<PuntoProgramma | null>(null);
  const dissolvenza_ref = React.useRef<number | null>(null);
  velocita_ref.current = velocita;
  volume_ref.current = volume;
  silenziato_ref.current = silenziato;
  loop_ref.current = loop_punto;

  const volume_effettivo = React.useCallback(
    () => (silenziato_ref.current ? 0 : volume_ref.current),
    [],
  );

  const applica_impostazioni = React.useCallback(
    (a: HTMLAudioElement) => {
      a.playbackRate = velocita_ref.current;
      (a as any).preservesPitch = true;
      (a as any).mozPreservesPitch = true;
      (a as any).webkitPreservesPitch = true;
      a.volume = volume_effettivo();
    },
    [volume_effettivo],
  );

  // ---- collegamento firmato (5 minuti): si rinnova prima della scadenza ----
  const rinnova = React.useCallback(
    async (riparti_da?: number) => {
      if (!programma.file_path) return;
      try {
        const nuovo = await firma_disco(programma.file_path);
        const audio = audio_ref.current;
        const era_in_riproduzione = audio ? !audio.paused : false;
        const punto = riparti_da ?? audio?.currentTime ?? 0;
        set_errore_audio(null);
        set_url(nuovo);
        if (audio) {
          const riprendi = () => {
            audio.currentTime = punto;
            // L'elemento è stato ricaricato: velocità e volume vanno rimessi.
            applica_impostazioni(audio);
            if (era_in_riproduzione) void audio.play().catch(() => undefined);
            audio.removeEventListener("loadedmetadata", riprendi);
          };
          audio.addEventListener("loadedmetadata", riprendi);
        }
      } catch (err) {
        set_errore_audio(t("musica.errore_collegamento"));
        void segnala_errore("LettoreDisco", t("musica.errore_collegamento"), err);
      }
    },
    [programma.file_path, t, applica_impostazioni],
  );

  /** Rinnovo manuale: azzera il contatore dei tentativi. */
  const riprova_a_mano = React.useCallback(() => {
    tentativi_firma.current = 0;
    void rinnova();
  }, [rinnova]);

  React.useEffect(() => {
    set_url(null);
    set_posizione(0);
    set_loop_punto(null);
    set_punto_aperto(null);
    set_in_riproduzione(false);
    tentativi_firma.current = 0;
    void rinnova(0);
    const timer = window.setInterval(() => {
      tentativi_firma.current = 0;
      void rinnova();
    }, 4 * 60_000);
    return () => window.clearInterval(timer);
  }, [programma.id, rinnova]);

  // ---- schermo sempre acceso mentre la musica va (non disponibile ovunque) ----
  React.useEffect(() => {
    let annullato = false;
    const richiedi = async () => {
      try {
        const nav: any = navigator;
        if (!nav?.wakeLock?.request) return;
        const sentinella = await nav.wakeLock.request("screen");
        if (annullato) {
          void sentinella.release?.();
          return;
        }
        wake_ref.current = sentinella;
      } catch {
        /* la Wake Lock API non deve mai rompere il lettore */
      }
    };
    const rilascia = () => {
      try {
        wake_ref.current?.release?.();
      } catch {
        /* ignorato */
      }
      wake_ref.current = null;
    };
    if (in_riproduzione) void richiedi();
    else rilascia();
    return () => {
      annullato = true;
      rilascia();
    };
  }, [in_riproduzione]);

  const audio = () => audio_ref.current;

  // ---- dissolvenze: lo stop netto sopra un impianto si sente in tutta la pista ----
  const ferma_dissolvenza = () => {
    if (dissolvenza_ref.current != null) {
      window.clearInterval(dissolvenza_ref.current);
      dissolvenza_ref.current = null;
    }
  };

  const dissolvi = React.useCallback((a: HTMLAudioElement, da: number, a_valore: number) =>
    new Promise<void>((risolvi) => {
      ferma_dissolvenza();
      const inizio = performance.now();
      a.volume = Math.min(1, Math.max(0, da));
      const id = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - inizio) / MS_DISSOLVENZA);
        a.volume = Math.min(1, Math.max(0, da + (a_valore - da) * k));
        if (k >= 1) {
          ferma_dissolvenza();
          risolvi();
        }
      }, 20);
      dissolvenza_ref.current = id;
    }), []);

  const avvia = React.useCallback(async () => {
    const a = audio();
    if (!a) return;
    applica_impostazioni(a);
    a.volume = 0;
    try {
      await a.play();
    } catch {
      set_errore_audio(t("musica.errore_riproduzione"));
      a.volume = volume_effettivo();
      return;
    }
    await dissolvi(a, 0, volume_effettivo());
  }, [applica_impostazioni, dissolvi, t, volume_effettivo]);

  const metti_in_pausa = React.useCallback(async () => {
    const a = audio();
    if (!a) return;
    const obiettivo = volume_effettivo();
    await dissolvi(a, a.volume, 0);
    a.pause();
    a.volume = obiettivo;
  }, [dissolvi, volume_effettivo]);

  const alterna_play = React.useCallback(() => {
    const a = audio();
    if (!a) return;
    if (a.paused) void avvia();
    else void metti_in_pausa();
  }, [avvia, metti_in_pausa]);

  const da_capo = React.useCallback(async () => {
    const a = audio();
    if (!a) return;
    const stava_andando = !a.paused;
    if (stava_andando) await metti_in_pausa();
    a.currentTime = 0;
    set_posizione(0);
    if (stava_andando) await avvia();
  }, [avvia, metti_in_pausa]);

  const sposta_di = React.useCallback((delta: number) => {
    const a = audio();
    if (!a) return;
    const massimo = Number.isFinite(a.duration) ? a.duration : durata;
    a.currentTime = Math.min(Math.max(0, a.currentTime + delta), Math.max(0, massimo));
    set_posizione(a.currentTime);
  }, [durata]);

  const cambia_velocita = (v: number) => {
    set_velocita(v);
    velocita_ref.current = v;
    const a = audio();
    if (a) applica_impostazioni(a);
  };

  const cambia_volume = (v: number) => {
    set_volume(v);
    volume_ref.current = v;
    if (v > 0 && silenziato) {
      set_silenziato(false);
      silenziato_ref.current = false;
    }
    scrivi_volume(v);
    const a = audio();
    if (a && dissolvenza_ref.current == null) a.volume = volume_effettivo();
  };

  const alterna_silenzio = () => {
    const nuovo = !silenziato;
    set_silenziato(nuovo);
    silenziato_ref.current = nuovo;
    const a = audio();
    if (a && dissolvenza_ref.current == null) a.volume = volume_effettivo();
  };

  const vai_a = React.useCallback((secondi: number) => {
    const a = audio();
    if (!a) return;
    a.currentTime = Math.max(0, secondi);
    set_posizione(a.currentTime);
  }, []);

  const usa_punto = (p: PuntoProgramma) => {
    if (p.secondi_fine != null) set_loop_punto(p);
    else set_loop_punto(null);
    vai_a(p.secondi);
    const a = audio();
    if (a?.paused) void avvia();
  };

  const punto_vicino = React.useCallback(
    (direzione: 1 | -1) => {
      const a = audio();
      const ora = a?.currentTime ?? posizione;
      if (direzione === -1) {
        const precedenti = punti_ordinati.filter((p) => p.secondi < ora - 1.5);
        const p = precedenti[precedenti.length - 1];
        vai_a(p ? p.secondi : 0);
      } else {
        const p = punti_ordinati.find((x) => x.secondi > ora + 0.3);
        if (p) vai_a(p.secondi);
      }
    },
    [punti_ordinati, posizione, vai_a],
  );

  // ---- ripetizione: onTimeUpdate scatta 4 volte al secondo, troppo poco ----
  React.useEffect(() => {
    if (!loop_punto?.secondi_fine) return;
    const id = window.setInterval(() => {
      const a = audio_ref.current;
      const l = loop_ref.current;
      if (!a || a.paused || !l?.secondi_fine) return;
      if (a.currentTime >= l.secondi_fine) a.currentTime = l.secondi;
    }, 30);
    return () => window.clearInterval(id);
  }, [loop_punto?.id, loop_punto?.secondi_fine]);

  // ---- scorciatoie da tastiera (portatile) ----
  React.useEffect(() => {
    const gestisci = (e: KeyboardEvent) => {
      const bersaglio = e.target as HTMLElement | null;
      const tag = bersaglio?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || bersaglio?.isContentEditable) return;
      if (dialogo_punto || punto_modifica) return;
      if (document.querySelector("[role='dialog'],[role='alertdialog']")) return;
      if (e.code === "Space") {
        e.preventDefault();
        alterna_play();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        sposta_di(-5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        sposta_di(5);
      }
    };
    window.addEventListener("keydown", gestisci);
    return () => window.removeEventListener("keydown", gestisci);
  }, [alterna_play, sposta_di, dialogo_punto, punto_modifica]);

  React.useEffect(() => () => ferma_dissolvenza(), []);

  // ---- barra trascinabile ----
  const secondi_da_evento = (clientX: number) => {
    const riquadro = barra_ref.current?.getBoundingClientRect();
    if (!riquadro || durata <= 0) return 0;
    const k = (clientX - riquadro.left) / riquadro.width;
    return Math.min(durata, Math.max(0, k * durata));
  };

  const giu_barra = (e: React.PointerEvent<HTMLDivElement>) => {
    if (durata <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    set_trascina(secondi_da_evento(e.clientX));
  };

  const muovi_barra = (e: React.PointerEvent<HTMLDivElement>) => {
    if (trascina == null) return;
    set_trascina(secondi_da_evento(e.clientX));
  };

  const su_barra = (e: React.PointerEvent<HTMLDivElement>) => {
    if (trascina == null) return;
    const secondi = secondi_da_evento(e.clientX);
    set_trascina(null);
    vai_a(secondi);
  };

  /** Passo 1: segna l'inizio. Il nome si chiede una volta sola, qui. */
  const salva_punto = async () => {
    const nome = nome_punto.trim();
    if (!nome) return;
    set_salvataggio_punto(true);
    try {
      const secondi = Math.floor(audio()?.currentTime ?? posizione);
      const { data, error } = await supabase
        .from("punti_programma")
        .insert({
          programma_id: programma.id,
          nome,
          secondi,
          ordine: punti.length,
        } as any)
        .select("id, programma_id, nome, secondi, secondi_fine, ordine")
        .single();
      if (error) throw error;
      await query_client.invalidateQueries({ queryKey: ["punti_programma", programma.id] });
      set_punto_aperto((data ?? null) as PuntoProgramma | null);
      set_dialogo_punto(false);
      set_nome_punto("");
    } catch (err) {
      void segnala_errore("LettoreDisco", t("musica.segna_punto"), err);
    } finally {
      set_salvataggio_punto(false);
    }
  };

  /** Passo 2: segna la fine sullo stesso punto, che diventa una ripetizione. */
  const segna_fine = async () => {
    const aperto = punto_aperto;
    if (!aperto) return;
    const fine = Math.floor(audio()?.currentTime ?? posizione);
    if (fine <= aperto.secondi) {
      set_errore_audio(t("musica.fine_prima_inizio"));
      return;
    }
    set_salvataggio_punto(true);
    try {
      const { error } = await supabase
        .from("punti_programma")
        .update({ secondi_fine: fine } as any)
        .eq("id", aperto.id)
        .eq("programma_id", programma.id);
      if (error) throw error;
      await query_client.invalidateQueries({ queryKey: ["punti_programma", programma.id] });
      set_loop_punto({ ...aperto, secondi_fine: fine });
      set_punto_aperto(null);
    } catch (err) {
      void segnala_errore("LettoreDisco", t("musica.segna_fine_qui"), err);
    } finally {
      set_salvataggio_punto(false);
    }
  };

  /** Rinomina di un punto già segnato. */
  const rinomina_punto = async () => {
    const p = punto_modifica;
    const nome = nome_modifica.trim();
    if (!p || !nome) return;
    set_salvataggio_punto(true);
    try {
      const { error } = await supabase
        .from("punti_programma")
        .update({ nome } as any)
        .eq("id", p.id)
        .eq("programma_id", programma.id);
      if (error) throw error;
      await query_client.invalidateQueries({ queryKey: ["punti_programma", programma.id] });
      if (loop_punto?.id === p.id) set_loop_punto({ ...loop_punto, nome });
      if (punto_aperto?.id === p.id) set_punto_aperto({ ...punto_aperto, nome });
      set_punto_modifica(null);
      set_nome_modifica("");
    } catch (err) {
      void segnala_errore("LettoreDisco", t("musica.errore_rinomina_punto"), err);
    } finally {
      set_salvataggio_punto(false);
    }
  };

  const elimina_punto = async (p: PuntoProgramma) => {
    try {
      const { error } = await supabase
        .from("punti_programma")
        .delete()
        .eq("id", p.id)
        .eq("programma_id", programma.id);
      if (error) throw error;
      await query_client.invalidateQueries({ queryKey: ["punti_programma", programma.id] });
      if (loop_punto?.id === p.id) set_loop_punto(null);
      if (punto_aperto?.id === p.id) set_punto_aperto(null);
    } catch (err) {
      void segnala_errore("LettoreDisco", t("musica.errore_elimina_punto"), err);
    }
  };

  const posizione_mostrata = trascina ?? posizione;
  const percentuale = durata > 0 ? Math.min(100, (posizione_mostrata / durata) * 100) : 0;
  const restante = Math.max(0, durata - posizione_mostrata);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-primary bg-card p-4 shadow-2xl">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{titolo_atleta}</p>
            <p className="truncate text-base text-muted-foreground">
              {programma.titolo_brano || t("musica.senza_titolo")} ·{" "}
              {t(`musica.tipo_${programma.tipo}`, { defaultValue: programma.tipo })}
            </p>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose} aria-label={t("musica.chiudi_lettore")}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        {errore_audio && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive bg-destructive/10 px-3 py-2">
            <span className="text-base text-destructive">{errore_audio}</span>
            <Button variant="outline" onClick={riprova_a_mano}>
              {t("musica.riprova")}
            </Button>
          </div>
        )}

        {/* barra di avanzamento trascinabile, con i punti e le ripetizioni sopra */}
        <div className="pt-6">
          <div
            ref={barra_ref}
            className="relative h-11 w-full touch-none select-none rounded-full bg-muted"
            role="slider"
            aria-label={t("musica.barra_avanzamento")}
            aria-valuemin={0}
            aria-valuemax={Math.round(durata)}
            aria-valuenow={Math.round(posizione_mostrata)}
            tabIndex={-1}
            onPointerDown={giu_barra}
            onPointerMove={muovi_barra}
            onPointerUp={su_barra}
            onPointerCancel={su_barra}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/40"
              style={{ width: `${percentuale}%` }}
            />
            {durata > 0 &&
              punti_ordinati.map((p) => {
                const sinistra = Math.min(100, (p.secondi / durata) * 100);
                const attivo = loop_punto?.id === p.id;
                const larghezza =
                  p.secondi_fine != null
                    ? Math.max(1, Math.min(100 - sinistra, ((p.secondi_fine - p.secondi) / durata) * 100))
                    : null;
                return (
                  <React.Fragment key={p.id}>
                    {larghezza != null ? (
                      <span
                        className={`absolute inset-y-0 rounded ${
                          attivo ? "bg-primary/70 ring-2 ring-primary" : "bg-secondary/60"
                        }`}
                        style={{ left: `${sinistra}%`, width: `${larghezza}%` }}
                      />
                    ) : (
                      <span
                        className="absolute inset-y-0 w-1 rounded bg-foreground"
                        style={{ left: `${sinistra}%` }}
                      />
                    )}
                    <span
                      className="pointer-events-none absolute -top-6 max-w-[9rem] truncate text-xs font-medium text-muted-foreground"
                      style={{ left: `${sinistra}%` }}
                    >
                      {p.nome}
                    </span>
                  </React.Fragment>
                );
              })}
            {/* manopola: bersaglio grande anche con i guanti */}
            <span
              className="pointer-events-none absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow"
              style={{ left: `${percentuale}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-2xl font-bold tabular-nums">
          <span>{mmss(posizione_mostrata)}</span>
          <span className="text-muted-foreground">−{mmss(restante)}</span>
        </div>

        {/* prima fila: i comandi nell'ordine in cui si usano */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <Button size="lg" variant="outline" className="h-16 flex-1 px-2" onClick={() => void da_capo()}>
            <ChevronFirst className="mr-1 h-6 w-6" />
            {t("musica.da_capo")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 flex-1 px-2"
            onClick={() => punto_vicino(-1)}
            aria-label={t("musica.punto_precedente")}
          >
            <SkipBack className="h-6 w-6" />
          </Button>
          <Button size="lg" variant="outline" className="h-16 flex-1 px-2" onClick={() => sposta_di(-10)}>
            <RotateCcw className="mr-1 h-6 w-6" />
            {t("musica.indietro_10")}
          </Button>
          <Button size="lg" className="h-20 flex-[2] text-lg" onClick={alterna_play} disabled={!url}>
            {in_riproduzione ? <Pause className="mr-2 h-8 w-8" /> : <Play className="mr-2 h-8 w-8" />}
            {in_riproduzione ? t("musica.pausa") : t("musica.play")}
          </Button>
          <Button size="lg" variant="outline" className="h-16 flex-1 px-2" onClick={() => sposta_di(10)}>
            <RotateCw className="mr-1 h-6 w-6" />
            {t("musica.avanti_10")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 flex-1 px-2"
            onClick={() => punto_vicino(1)}
            aria-label={t("musica.punto_successivo")}
          >
            <SkipForward className="h-6 w-6" />
          </Button>
        </div>

        {/* seconda fila: velocità, volume, punti */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {VELOCITA.map((v) => (
              <Button
                key={v}
                size="lg"
                variant={velocita === v ? "default" : "outline"}
                className="h-14 px-4 tabular-nums"
                onClick={() => cambia_velocita(v)}
              >
                {v}×
              </Button>
            ))}
          </div>
          <div className="flex min-w-[14rem] flex-1 items-center gap-3">
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-14 p-0"
              onClick={alterna_silenzio}
              aria-label={silenziato ? t("musica.riattiva_audio") : t("musica.silenzia")}
              title={silenziato ? t("musica.riattiva_audio") : t("musica.silenzia")}
            >
              {silenziato ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={silenziato ? 0 : volume}
              onChange={(e) => cambia_volume(Number(e.target.value))}
              aria-label={t("musica.volume")}
              className="h-10 w-full cursor-pointer accent-primary"
            />
          </div>
          <Button size="lg" variant="outline" className="h-14" onClick={() => set_dialogo_punto(true)}>
            <Plus className="mr-2 h-5 w-5" />
            {t("musica.segna_inizio")}
          </Button>
          {punto_aperto && (
            <Button
              size="lg"
              variant="secondary"
              className="h-14"
              disabled={salvataggio_punto}
              onClick={() => void segna_fine()}
            >
              <Repeat className="mr-2 h-5 w-5" />
              {t("musica.segna_fine_qui", { nome: punto_aperto.nome })}
            </Button>
          )}
          {loop_punto && (
            <Button size="lg" variant="secondary" className="h-14" onClick={() => set_loop_punto(null)}>
              <Repeat className="mr-2 h-5 w-5" />
              {t("musica.ferma_ripetizione")}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t("musica.scorciatoie")}</p>

        {/* punti salvati */}
        {punti_query.isError ? (
          <p className="text-base text-destructive">{t("musica.errore_punti")}</p>
        ) : punti_query.isLoading ? (
          <p className="text-base text-muted-foreground">{t("musica.caricamento_punti")}</p>
        ) : punti.length === 0 ? (
          <p className="text-base text-muted-foreground">{t("musica.nessun_punto")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("musica.spiegazione_punti")}</p>
            <div className="flex flex-wrap gap-2">
              {punti_ordinati.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 rounded-lg border p-1 ${
                    loop_punto?.id === p.id ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <Button variant="ghost" className="h-12" onClick={() => usa_punto(p)}>
                    {p.secondi_fine != null && <Repeat className="mr-2 h-4 w-4" />}
                    {p.nome} · {mmss(p.secondi)}
                    {p.secondi_fine != null ? ` – ${mmss(p.secondi_fine)}` : ""}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-12 w-12 p-0"
                    aria-label={t("musica.rinomina_punto")}
                    title={t("musica.rinomina_punto")}
                    onClick={() => {
                      set_punto_modifica(p);
                      set_nome_modifica(p.nome);
                    }}
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                  <ConfirmButton
                    titolo={t("musica.elimina_punto")}
                    descrizione={t("musica.elimina_punto_conferma", { nome: p.nome })}
                    conferma_label={t("musica.elimina_punto")}
                    on_conferma={() => void elimina_punto(p)}
                    variante="pericolo"
                  >
                    <Button
                      variant="ghost"
                      className="h-12 w-12 p-0 text-destructive"
                      aria-label={t("musica.elimina_punto")}
                      title={t("musica.elimina_punto")}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </ConfirmButton>
                </div>
              ))}
            </div>
          </>
        )}

        <audio
          ref={audio_ref}
          src={url ?? undefined}
          preload="auto"
          onLoadedMetadata={(e) => {
            const a = e.currentTarget;
            if (Number.isFinite(a.duration)) set_durata(a.duration);
            applica_impostazioni(a);
            // Il file si è aperto: i tentativi di rinnovo ripartono da zero.
            tentativi_firma.current = 0;
          }}
          onPlay={() => set_in_riproduzione(true)}
          onPause={() => set_in_riproduzione(false)}
          onTimeUpdate={(e) => {
            if (trascina != null) return;
            set_posizione(e.currentTarget.currentTime);
          }}
          onError={() => {
            // Il collegamento firmato dura 5 minuti: se scade si richiede e si riprende.
            // Dopo due tentativi falliti ci si ferma: un file mancante non deve
            // mandare il tablet in ciclo firma-errore per ore.
            if (tentativi_firma.current >= 2) {
              set_errore_audio(t("musica.brano_non_disponibile"));
              return;
            }
            tentativi_firma.current += 1;
            void rinnova();
          }}
        />
      </div>

      <Dialog open={dialogo_punto} onOpenChange={set_dialogo_punto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("musica.segna_inizio")}</DialogTitle>
          </DialogHeader>
          <Input
            value={nome_punto}
            onChange={(e) => set_nome_punto(e.target.value)}
            placeholder={t("musica.nome_punto")}
          />
          <p className="text-sm text-muted-foreground">{t("musica.ripetizione_spiegazione")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_dialogo_punto(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={() => void salva_punto()} disabled={!nome_punto.trim() || salvataggio_punto}>
              {t("musica.segna_inizio")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!punto_modifica}
        onOpenChange={(aperto) => {
          if (!aperto) set_punto_modifica(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("musica.rinomina_punto")}</DialogTitle>
          </DialogHeader>
          <Input
            value={nome_modifica}
            onChange={(e) => set_nome_modifica(e.target.value)}
            placeholder={t("musica.nome_punto")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => set_punto_modifica(null)}>
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={() => void rinomina_punto()}
              disabled={!nome_modifica.trim() || salvataggio_punto}
            >
              {t("musica.salva_nome_punto")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LettoreDisco;
