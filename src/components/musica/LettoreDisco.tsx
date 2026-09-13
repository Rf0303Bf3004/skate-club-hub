import React from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, RotateCcw, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import {
  firma_disco,
  use_punti_programma,
  type ProgrammaMusicale,
  type PuntoProgramma,
} from "@/hooks/use-programmi-musicali";

/**
 * Lettore del disco dell'atleta: pannello in fondo alla pagina, non copre l'elenco.
 * Il collegamento al file è sempre firmato (bucket privato) e viene rinnovato
 * prima della scadenza e in caso di errore di riproduzione.
 */

const VELOCITA = [0.75, 0.9, 1] as const;

const mmss = (secondi: number) => {
  if (!Number.isFinite(secondi) || secondi < 0) return "0:00";
  const m = Math.floor(secondi / 60);
  const s = Math.floor(secondi % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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

  const [url, set_url] = React.useState<string | null>(null);
  const [errore_audio, set_errore_audio] = React.useState<string | null>(null);
  const [in_riproduzione, set_in_riproduzione] = React.useState(false);
  const [posizione, set_posizione] = React.useState(0);
  const [durata, set_durata] = React.useState(programma.durata_sec ?? 0);
  const [velocita, set_velocita] = React.useState<number>(1);
  const [loop_punto, set_loop_punto] = React.useState<PuntoProgramma | null>(null);
  const [dialogo_punto, set_dialogo_punto] = React.useState(false);
  const [nome_punto, set_nome_punto] = React.useState("");
  const [salvataggio_punto, set_salvataggio_punto] = React.useState(false);

  const punti_query = use_punti_programma(programma.id);
  const punti = punti_query.data ?? [];

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
    [programma.file_path, t],
  );

  React.useEffect(() => {
    set_url(null);
    set_posizione(0);
    set_loop_punto(null);
    set_in_riproduzione(false);
    void rinnova(0);
    const timer = window.setInterval(() => void rinnova(), 4 * 60_000);
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

  const alterna_play = () => {
    const a = audio();
    if (!a) return;
    if (a.paused) void a.play().catch(() => set_errore_audio(t("musica.errore_riproduzione")));
    else a.pause();
  };

  const indietro_10 = () => {
    const a = audio();
    if (!a) return;
    a.currentTime = Math.max(0, a.currentTime - 10);
  };

  const cambia_velocita = (v: number) => {
    set_velocita(v);
    const a = audio();
    if (a) {
      a.playbackRate = v;
      (a as any).preservesPitch = true;
      (a as any).mozPreservesPitch = true;
      (a as any).webkitPreservesPitch = true;
    }
  };

  const vai_a = (secondi: number) => {
    const a = audio();
    if (!a) return;
    a.currentTime = secondi;
    if (a.paused) void a.play().catch(() => undefined);
  };

  const usa_punto = (p: PuntoProgramma) => {
    if (p.secondi_fine != null) set_loop_punto(p);
    else set_loop_punto(null);
    vai_a(p.secondi);
  };

  const salva_punto = async () => {
    const nome = nome_punto.trim();
    if (!nome) return;
    set_salvataggio_punto(true);
    try {
      const secondi = Math.floor(audio()?.currentTime ?? posizione);
      const { error } = await supabase.from("punti_programma").insert({
        programma_id: programma.id,
        nome,
        secondi,
        ordine: punti.length,
      } as any);
      if (error) throw error;
      await query_client.invalidateQueries({ queryKey: ["punti_programma", programma.id] });
      set_dialogo_punto(false);
      set_nome_punto("");
    } catch (err) {
      void segnala_errore("LettoreDisco", t("musica.segna_punto"), err);
    } finally {
      set_salvataggio_punto(false);
    }
  };

  const percentuale = durata > 0 ? Math.min(100, (posizione / durata) * 100) : 0;

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
            <Button variant="outline" onClick={() => void rinnova()}>
              {t("musica.riprova")}
            </Button>
          </div>
        )}

        {/* barra di avanzamento con i punti segnati sopra */}
        <div
          className="relative h-6 w-full cursor-pointer rounded-full bg-muted"
          onClick={(e) => {
            if (durata <= 0) return;
            const riquadro = e.currentTarget.getBoundingClientRect();
            vai_a(((e.clientX - riquadro.left) / riquadro.width) * durata);
          }}
        >
          <div className="h-6 rounded-full bg-primary/40" style={{ width: `${percentuale}%` }} />
          {durata > 0 &&
            punti.map((p) => (
              <span
                key={p.id}
                className="absolute top-0 h-6 w-1 rounded bg-foreground"
                style={{ left: `${Math.min(100, (p.secondi / durata) * 100)}%` }}
              />
            ))}
        </div>
        <div className="flex justify-between text-sm tabular-nums text-muted-foreground">
          <span>{mmss(posizione)}</span>
          <span>{mmss(durata)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant="outline" className="h-14 px-5" onClick={indietro_10}>
            <RotateCcw className="mr-2 h-5 w-5" />
            {t("musica.indietro_10")}
          </Button>
          <Button size="lg" className="h-14 w-32" onClick={alterna_play} disabled={!url}>
            {in_riproduzione ? <Pause className="mr-2 h-6 w-6" /> : <Play className="mr-2 h-6 w-6" />}
            {in_riproduzione ? t("musica.pausa") : t("musica.play")}
          </Button>
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
          <Button size="lg" variant="outline" className="h-14" onClick={() => set_dialogo_punto(true)}>
            <Plus className="mr-2 h-5 w-5" />
            {t("musica.segna_punto")}
          </Button>
          {loop_punto && (
            <Button size="lg" variant="secondary" className="h-14" onClick={() => set_loop_punto(null)}>
              <Repeat className="mr-2 h-5 w-5" />
              {t("musica.ferma_ripetizione")}
            </Button>
          )}
        </div>

        {/* punti salvati */}
        {punti_query.isError ? (
          <p className="text-base text-destructive">{t("musica.errore_punti")}</p>
        ) : punti_query.isLoading ? (
          <p className="text-base text-muted-foreground">{t("musica.caricamento_punti")}</p>
        ) : punti.length === 0 ? (
          <p className="text-base text-muted-foreground">{t("musica.nessun_punto")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {punti.map((p) => (
              <Button
                key={p.id}
                variant={loop_punto?.id === p.id ? "default" : "outline"}
                className="h-12"
                onClick={() => usa_punto(p)}
              >
                {p.secondi_fine != null && <Repeat className="mr-2 h-4 w-4" />}
                {p.nome} · {mmss(p.secondi)}
              </Button>
            ))}
          </div>
        )}

        <audio
          ref={audio_ref}
          src={url ?? undefined}
          preload="auto"
          onLoadedMetadata={(e) => {
            const a = e.currentTarget;
            if (Number.isFinite(a.duration)) set_durata(a.duration);
            a.playbackRate = velocita;
            (a as any).preservesPitch = true;
            (a as any).mozPreservesPitch = true;
            (a as any).webkitPreservesPitch = true;
          }}
          onPlay={() => set_in_riproduzione(true)}
          onPause={() => set_in_riproduzione(false)}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            set_posizione(a.currentTime);
            if (loop_punto?.secondi_fine != null && a.currentTime >= loop_punto.secondi_fine) {
              a.currentTime = loop_punto.secondi;
            }
          }}
          onError={() => {
            // Il collegamento firmato dura 5 minuti: se scade si richiede e si riprende.
            void rinnova();
          }}
        />
      </div>

      <Dialog open={dialogo_punto} onOpenChange={set_dialogo_punto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("musica.segna_punto")}</DialogTitle>
          </DialogHeader>
          <Input
            value={nome_punto}
            onChange={(e) => set_nome_punto(e.target.value)}
            placeholder={t("musica.nome_punto")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => set_dialogo_punto(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={() => void salva_punto()} disabled={!nome_punto.trim() || salvataggio_punto}>
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LettoreDisco;
