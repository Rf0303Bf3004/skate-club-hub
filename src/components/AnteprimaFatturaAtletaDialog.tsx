import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import { prepara_pdf_fattura } from "@/lib/fattura-atleta-helpers";
import PdfViewer from "@/components/relazione/PdfViewer";

interface Props {
  fattura_id: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AnteprimaFatturaAtletaDialog: React.FC<Props> = ({ fattura_id, open, onOpenChange }) => {
  const [url, set_url] = useState<string | null>(null);
  const [blob, set_blob] = useState<Blob | null>(null);
  const [nome_file, set_nome_file] = useState("fattura.pdf");
  const [loading, set_loading] = useState(false);
  const [errore, set_errore] = useState<string | null>(null);
  const da_revocare = useRef<string | null>(null);
  const iframe_stampa_ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    set_loading(true);
    set_errore(null);
    set_url(null);
    set_blob(null);
    (async () => {
      try {
        const r = await prepara_pdf_fattura(fattura_id);
        if (!alive) {
          URL.revokeObjectURL(r.url);
          return;
        }
        da_revocare.current = r.url;
        set_url(r.url);
        set_blob(r.blob);
        set_nome_file(r.nome_file);
      } catch (e: any) {
        if (alive) set_errore(e?.message ?? "Errore nella generazione del PDF");
      } finally {
        if (alive) set_loading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, fattura_id]);

  // Libera il blob quando il dialogo si chiude o il componente viene smontato.
  useEffect(() => {
    if (open) return;
    if (da_revocare.current) {
      URL.revokeObjectURL(da_revocare.current);
      da_revocare.current = null;
    }
    set_url(null);
    set_blob(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (da_revocare.current) {
        URL.revokeObjectURL(da_revocare.current);
        da_revocare.current = null;
      }
      iframe_stampa_ref.current?.remove();
      iframe_stampa_ref.current = null;
    };
  }, []);

  const stampa = () => {
    if (!url) return;
    iframe_stampa_ref.current?.remove();
    const frame = document.createElement("iframe");
    frame.title = "Stampa fattura";
    frame.setAttribute("aria-hidden", "true");
    frame.className = "fixed w-0 h-0 border-0 opacity-0 pointer-events-none";
    frame.onload = () => {
      const finestra = frame.contentWindow;
      if (!finestra) return;
      const pulisci = () => {
        frame.remove();
        if (iframe_stampa_ref.current === frame) iframe_stampa_ref.current = null;
      };
      finestra.addEventListener("afterprint", pulisci, { once: true });
      finestra.focus();
      finestra.print();
    };
    iframe_stampa_ref.current = frame;
    document.body.appendChild(frame);
    frame.src = url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border flex-row items-center justify-between space-y-0">
          <DialogTitle>Anteprima fattura</DialogTitle>
          <div className="flex items-center gap-2 mr-8">
            <Button size="sm" variant="outline" asChild disabled={!url}>
              <a href={url ?? "#"} download={nome_file}>
                <Download className="w-4 h-4 mr-1" /> Scarica
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={stampa} disabled={!url}>
              <Printer className="w-4 h-4 mr-1" /> Stampa
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden bg-muted/30">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            </div>
          ) : errore ? (
            <div className="h-full flex items-center justify-center text-sm text-destructive px-6 text-center">
              {errore}
            </div>
          ) : blob ? (
            <PdfViewer blob={blob} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnteprimaFatturaAtletaDialog;
