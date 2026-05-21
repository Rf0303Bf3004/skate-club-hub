import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import { PitchDocument, type PitchData } from "@/lib/pitchPDF";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Props {
  open: boolean;
  on_open_change: (v: boolean) => void;
  data: PitchData | null;
}

export const PitchPDFPreview: React.FC<Props> = ({ open, on_open_change, data }) => {
  const filename = data ? `Pitch_Sponsor_${data.club.nome.replace(/\s+/g, "_")}_${data.anno_stagione}.pdf` : "Pitch.pdf";
  return (
    <Dialog open={open} onOpenChange={on_open_change}>
      <DialogContent className="max-w-6xl h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Anteprima Pitch Sponsor</span>
            {data && (
              <PDFDownloadLink document={<PitchDocument data={data} />} fileName={filename}>
                {({ loading }) => (
                  <Button size="sm" disabled={loading}>
                    <Download className="w-4 h-4 mr-2" />
                    {loading ? "Preparazione..." : "Scarica PDF"}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {data ? (
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              <PitchDocument data={data} />
            </PDFViewer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">Caricamento...</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
