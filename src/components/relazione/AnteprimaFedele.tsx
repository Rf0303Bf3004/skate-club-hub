import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Download, FileWarning, FileText } from "lucide-react";
import { generateRelazionePDF, buildRelazioneFilename } from "@/lib/pdfGenerator";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import type { Tono } from "@/lib/paragraphGenerator";
import { CompositoreItem } from "./types-compositore";
import PdfViewer from "./PdfViewer";

interface Props {
  items: CompositoreItem[];
  club: any;
  presidente: string;
  stagione_nome: string;
  club_id: string;
  stagione_id: string;
  tono: Tono;
  structural_signature: string;
}

export default function AnteprimaFedele({
  items, club, presidente, stagione_nome, club_id, stagione_id, tono, structural_signature,
}: Props) {
  const [loading, set_loading] = useState(false);
  const [blob, set_blob] = useState<Blob | null>(null);
  const [url, set_url] = useState<string | null>(null);
  const [generated_signature, set_generated_signature] = useState<string | null>(null);
  const generating_ref = useRef(false);

  // Cleanup on unmount or when url changes
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const generate = async () => {
    if (generating_ref.current) return;
    generating_ref.current = true;
    set_loading(true);
    try {
      const attivi = items.filter((i) => i.attivo);
      const result = await generateRelazionePDF({
        club, presidente, stagione_nome, club_id, stagione_id, tono,
        items: attivi.map((i) => ({
          id: i.id, kind: i.kind, sezione_id: i.sezione_id,
          titolo: i.titolo, payload: i.payload,
        })),
      });
      if (url) URL.revokeObjectURL(url);
      const new_url = URL.createObjectURL(result.blob);
      set_blob(result.blob);
      set_url(new_url);
      set_generated_signature(structural_signature);
    } catch (e: any) {
      if (e?.message !== "Generazione gia in corso. Attendi il completamento.") {
        console.error(e);
        toast.error("Errore nella generazione dell'anteprima.");
      }
    } finally {
      generating_ref.current = false;
      set_loading(false);
    }
  };

  const download = () => {
    if (!blob) return;
    const filename = buildRelazioneFilename(club?.nome ?? "Club", stagione_nome);
    saveAs(blob, filename);
  };

  const is_stale = url !== null && generated_signature !== null && generated_signature !== structural_signature;

  if (loading && !url) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-sm">Generazione anteprima in corso...</p>
        <p className="text-xs text-slate-400">Richiede 2-3 secondi</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-slate-500 gap-4 p-6 text-center">
        <FileText className="w-12 h-12 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">Anteprima fedele del PDF</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Genera il PDF reale (con grafici e paragrafi narrativi) per vedere esattamente come apparira' il documento finale.
          </p>
        </div>
        <Button onClick={generate} className="gap-2">
          <FileText className="w-4 h-4" />
          Genera anteprima fedele
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {is_stale && (
        <div className="m-3 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
          <FileWarning className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs text-amber-900">
            Hai modificato la struttura. Aggiorna l'anteprima per vedere le ultime modifiche.
          </div>
          <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="h-7 text-xs gap-1">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Aggiorna
          </Button>
        </div>
      )}
      <div className="flex-1 px-3 pb-2 min-h-0">
        <iframe
          src={url}
          title="Anteprima PDF"
          className="w-full h-full border border-slate-200 rounded bg-white"
          style={{ minHeight: 500 }}
        />
      </div>
      <div className="flex gap-2 p-3 border-t border-slate-200 bg-white">
        <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="gap-2 rounded-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Aggiorna anteprima
        </Button>
        <Button variant="outline" size="sm" onClick={download} disabled={!blob} className="gap-2 rounded-full">
          <Download className="w-4 h-4" />
          Scarica PDF
        </Button>
      </div>
    </div>
  );
}
