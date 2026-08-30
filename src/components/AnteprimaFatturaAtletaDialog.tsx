import React, { useEffect, useState } from "react";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { carica_dati_pdf, url_pdf_congelato } from "@/lib/fattura-atleta-helpers";
import { FatturaAtletaDocument, type FatturaAtletaData } from "@/lib/fattura-atleta-pdf";

interface Props {
  fattura_id: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AnteprimaFatturaAtletaDialog: React.FC<Props> = ({ fattura_id, open, onOpenChange }) => {
  const [data, set_data] = useState<FatturaAtletaData | null>(null);
  const [pdf_salvato, set_pdf_salvato] = useState<string | null>(null);
  const [loading, set_loading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      set_loading(true);
      set_data(null);
      set_pdf_salvato(null);
      try {
        // Le fatture non in bozza servono il PDF congelato all'invio.
        const congelato = await url_pdf_congelato(fattura_id);
        if (!alive) return;
        if (congelato) {
          set_pdf_salvato(congelato);
          return;
        }
        const d = await carica_dati_pdf(fattura_id);
        if (!alive) return;
        set_data(d);
      } finally {
        if (alive) set_loading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, fattura_id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border flex-row items-center justify-between space-y-0">
          <DialogTitle>Anteprima fattura {data?.numero ? `· ${data.numero}` : ""}</DialogTitle>
          {pdf_salvato ? (
            <Button size="sm" variant="outline" className="mr-8" asChild>
              <a href={pdf_salvato} target="_blank" rel="noreferrer" download>
                <Download className="w-4 h-4 mr-1" /> Scarica PDF
              </a>
            </Button>
          ) : data ? (
            <PDFDownloadLink
              document={<FatturaAtletaDocument data={data} />}
              fileName={`fattura-${data.numero}.pdf`}
            >
              {({ loading: l }) => (
                <Button size="sm" variant="outline" disabled={l} className="mr-8">
                  <Download className="w-4 h-4 mr-1" /> {l ? "..." : "Scarica PDF"}
                </Button>
              )}
            </PDFDownloadLink>
          ) : null}
        </DialogHeader>
        <div className="flex-1 bg-muted/30">
          {loading || (!data && !pdf_salvato) ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            </div>
          ) : pdf_salvato ? (
            <iframe src={pdf_salvato} title="Fattura" className="w-full h-full border-0" />
          ) : (
            <PDFViewer width="100%" height="100%" showToolbar style={{ border: 0 }}>
              <FatturaAtletaDocument data={data!} />
            </PDFViewer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnteprimaFatturaAtletaDialog;
