import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Download, FileWarning, FileText } from "lucide-react";
import { generateRelazionePDF, buildRelazioneFilename, type VoceComposizione } from "@/lib/pdfGenerator";
import { saveAs } from "file-saver";
import { segnala_errore } from "@/lib/errori";
import type { Tono } from "@/lib/paragraphGenerator";
import type { ModuloRisultato, Stagione } from "@/lib/relazione/moduli";
import PdfViewer from "./PdfViewer";
import { useTranslation } from "react-i18next";

interface Props {
  club: any;
  club_id: string;
  presidente: string;
  stagione: Stagione;
  tono: Tono;
  messaggio: string | null;
  voci: VoceComposizione[];
  moduli: Record<string, ModuloRisultato>;
  structural_signature: string;
}

export default function AnteprimaFedele({
  club, club_id, presidente, stagione, tono, messaggio, voci, moduli, structural_signature,
}: Props) {
  const { t } = useTranslation("dashboard");
  const [loading, set_loading] = useState(false);
  const [blob, set_blob] = useState<Blob | null>(null);
  const [url, set_url] = useState<string | null>(null);
  const [generated_signature, set_generated_signature] = useState<string | null>(null);
  const generating_ref = useRef(false);

  useEffect(() => {
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [url]);

  const generate = async () => {
    if (generating_ref.current) return;
    generating_ref.current = true;
    set_loading(true);
    try {
      const result = await generateRelazionePDF({
        club, club_id, presidente, stagione, tono, messaggio, voci, moduli,
      });
      if (url) URL.revokeObjectURL(url);
      const new_url = URL.createObjectURL(result.blob);
      set_blob(result.blob);
      set_url(new_url);
      set_generated_signature(structural_signature);
    } catch (e) {
      await segnala_errore("Relazione", t("relazione.anteprima_fedele.toast_errore"), e);
    } finally {
      generating_ref.current = false;
      set_loading(false);
    }
  };

  const download = () => {
    if (!blob) return;
    saveAs(blob, buildRelazioneFilename(club?.nome ?? "Club", stagione.nome));
  };

  const is_stale = url !== null && generated_signature !== null && generated_signature !== structural_signature;

  if (loading && !url) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">{t("relazione.anteprima_fedele.generazione")}</p>
        <p className="text-xs">{t("relazione.anteprima_fedele.durata")}</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-muted-foreground gap-4 p-6 text-center">
        <FileText className="w-12 h-12 opacity-40" />
        <div>
          <p className="text-sm font-medium text-foreground">{t("relazione.anteprima_fedele.empty_titolo")}</p>
          <p className="text-xs mt-1 max-w-sm">{t("relazione.anteprima_fedele.empty_testo")}</p>
        </div>
        <Button onClick={generate} className="gap-2">
          <FileText className="w-4 h-4" />
          {t("relazione.anteprima_fedele.genera")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {is_stale && (
        <div className="m-3 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
          <FileWarning className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs text-amber-900">{t("relazione.anteprima_fedele.stale")}</div>
          <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="h-7 text-xs gap-1">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {t("relazione.anteprima_fedele.aggiorna")}
          </Button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {blob && <PdfViewer blob={blob} on_download={download} />}
      </div>
      <div className="flex gap-2 p-3 border-t bg-card">
        <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="gap-2 rounded-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {t("relazione.anteprima_fedele.aggiorna_anteprima")}
        </Button>
        <Button variant="outline" size="sm" onClick={download} disabled={!blob} className="gap-2 rounded-full">
          <Download className="w-4 h-4" />
          {t("relazione.anteprima_fedele.scarica")}
        </Button>
      </div>
    </div>
  );
}
