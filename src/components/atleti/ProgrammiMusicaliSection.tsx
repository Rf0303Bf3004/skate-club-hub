import React from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Music, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ConfirmButton from "@/components/common/ConfirmButton";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { segnala_errore } from "@/lib/errori";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import {
  BUCKET_DISCHI,
  TIPI_PROGRAMMA,
  firma_disco,
  percorso_disco,
  use_programmi_atleta,
  type ProgrammaMusicale,
  type TipoProgramma,
} from "@/hooks/use-programmi-musicali";

/**
 * Dischi (programmi musicali) dell'atleta.
 * I file stanno nel bucket privato `dischi-musicali`, percorso
 * `{club_id}/{atleta_id}/{nomefile}.{est}`, e si ascoltano solo con
 * collegamenti firmati a scadenza: mai indirizzi pubblici.
 */

const nome_pulito = (nome: string) =>
  nome
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .slice(-80);

/** Durata del brano letta dal file prima del salvataggio (0 se non leggibile). */
const leggi_durata = (file: File): Promise<number> =>
  new Promise((risolvi) => {
    const indirizzo = URL.createObjectURL(file);
    const elemento = document.createElement("audio");
    const chiudi = (valore: number) => {
      URL.revokeObjectURL(indirizzo);
      risolvi(valore);
    };
    elemento.preload = "metadata";
    elemento.onloadedmetadata = () =>
      chiudi(Number.isFinite(elemento.duration) ? Math.round(elemento.duration) : 0);
    elemento.onerror = () => chiudi(0);
    window.setTimeout(() => chiudi(0), 10_000);
    elemento.src = indirizzo;
  });

interface Props {
  atleta_id: string;
}

const ProgrammiMusicaliSection: React.FC<Props> = ({ atleta_id }) => {
  const { t } = useTranslation("common");
  const { session } = useAuth();
  const query_client = useQueryClient();
  const { puo_gestire_musica } = usePermessiAzione();

  const programmi_query = use_programmi_atleta(atleta_id);
  const programmi = programmi_query.data ?? [];

  const [tipo, set_tipo] = React.useState<TipoProgramma>("corto");
  const [titolo, set_titolo] = React.useState("");
  const [caricamento, set_caricamento] = React.useState(false);
  const [in_ascolto, set_in_ascolto] = React.useState<{ id: string; url: string } | null>(null);

  // Bordo pista legge una chiave diversa: vanno invalidate entrambe.
  const ricarica = async () => {
    await Promise.all([
      query_client.invalidateQueries({ queryKey: ["programmi_musicali_atleta"] }),
      query_client.invalidateQueries({ queryKey: ["programmi_musicali_gruppo"] }),
    ]);
  };

  const carica = async (file: File) => {
    const club_id = get_current_club_id();
    if (!club_id) return;
    set_caricamento(true);
    try {
      const durata_sec = await leggi_durata(file);
      const path = percorso_disco(club_id, atleta_id, `${Date.now()}_${nome_pulito(file.name)}`);
      const { error: errore_file } = await supabase.storage
        .from(BUCKET_DISCHI)
        .upload(path, file, { upsert: true });
      if (errore_file) throw errore_file;

      const { error } = await supabase.from("programmi_musicali").insert({
        atleta_id,
        club_id,
        tipo,
        titolo_brano: titolo.trim() || null,
        file_path: path,
        durata_sec: durata_sec > 0 ? durata_sec : null,
        attivo: true,
        caricato_da: session?.user_id ?? null,
      } as any);
      if (error) throw error;

      set_titolo("");
      await ricarica();
      toast({ title: t("musica.disco_caricato") });
    } catch (err) {
      void segnala_errore("Programmi musicali", t("musica.carica_disco"), err);
    } finally {
      set_caricamento(false);
    }
  };

  const cambia_attivo = async (programma: ProgrammaMusicale, attivo: boolean) => {
    try {
      const { error } = await supabase
        .from("programmi_musicali")
        .update({ attivo } as any)
        .eq("id", programma.id)
        .eq("club_id", programma.club_id);
      if (error) throw error;
      await ricarica();
    } catch (err) {
      void segnala_errore("Programmi musicali", t("musica.attivo"), err);
    }
  };

  const cambia_in_preparazione = async (programma: ProgrammaMusicale, in_preparazione: boolean) => {
    try {
      const { error } = await supabase
        .from("programmi_musicali")
        .update({ in_preparazione } as any)
        .eq("id", programma.id)
        .eq("club_id", programma.club_id);
      if (error) throw error;
      await ricarica();
    } catch (err) {
      void segnala_errore("Programmi musicali", t("musica.in_preparazione"), err);
    }
  };

  const elimina = async (programma: ProgrammaMusicale) => {
    try {
      const { error } = await supabase
        .from("programmi_musicali")
        .delete()
        .eq("id", programma.id)
        .eq("club_id", programma.club_id);
      if (error) throw error;
      if (in_ascolto?.id === programma.id) set_in_ascolto(null);
      await ricarica();
    } catch (err) {
      void segnala_errore("Programmi musicali", t("actions.delete"), err);
    }
  };

  const ascolta = async (programma: ProgrammaMusicale) => {
    if (!programma.file_path) return;
    try {
      const url = await firma_disco(programma.file_path);
      set_in_ascolto({ id: programma.id, url });
    } catch (err) {
      void segnala_errore("Programmi musicali", t("musica.errore_collegamento"), err);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm text-muted-foreground">{t("musica.dischi")}</Label>

      {programmi_query.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive bg-destructive/10 px-3 py-2">
          <span className="text-sm text-destructive">{t("musica.errore_programmi")}</span>
          <Button variant="outline" size="sm" onClick={() => void programmi_query.refetch()}>
            {t("musica.riprova")}
          </Button>
        </div>
      ) : programmi_query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("actions.loading")}</p>
      ) : programmi.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("musica.nessun_disco")}</p>
      ) : (
        <div className="space-y-2">
          {programmi.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Music className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="text-sm font-medium">
                  {t(`musica.tipo_${p.tipo}`, { defaultValue: p.tipo })}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {p.titolo_brano || t("musica.senza_titolo")}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void ascolta(p)} disabled={!p.file_path}>
                    {t("musica.ascolta")}
                  </Button>
                  {puo_gestire_musica && (
                    <>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={p.attivo}
                          onCheckedChange={(v) => void cambia_attivo(p, v)}
                          aria-label={t("musica.attivo")}
                        />
                        <span className="text-xs text-muted-foreground">{t("musica.attivo")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={p.in_preparazione}
                          onCheckedChange={(v) => void cambia_in_preparazione(p, v)}
                          aria-label={t("musica.in_preparazione")}
                        />
                        <span className="text-xs text-muted-foreground">{t("musica.in_preparazione")}</span>
                      </div>
                      <ConfirmButton
                        variante="pericolo"
                        titolo={t("musica.elimina_disco")}
                        descrizione={t("musica.elimina_disco_conferma")}
                        conferma_label={t("actions.delete")}
                        on_conferma={() => void elimina(p)}
                      >
                        <Button variant="ghost" size="sm" aria-label={t("musica.elimina_disco")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ConfirmButton>
                    </>
                  )}
                </div>
              </div>
              {in_ascolto?.id === p.id && (
                <audio controls autoPlay src={in_ascolto.url} className="mt-2 h-8 w-full" />
              )}
            </div>
          ))}
        </div>
      )}

      {puo_gestire_musica && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("musica.tipo")}</Label>
            <Select value={tipo} onValueChange={(v) => set_tipo(v as TipoProgramma)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPI_PROGRAMMA.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`musica.tipo_${v}`, { defaultValue: v })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("musica.titolo_brano")}</Label>
            <Input
              value={titolo}
              onChange={(e) => set_titolo(e.target.value)}
              className="h-9 w-56"
              placeholder={t("musica.titolo_brano")}
            />
          </div>
          <label
            className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 ${
              caricamento ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Upload className="h-4 w-4" />
            {caricamento ? t("musica.caricamento_disco") : t("musica.carica_disco")}
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void carica(e.target.files[0])}
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default ProgrammiMusicaliSection;
