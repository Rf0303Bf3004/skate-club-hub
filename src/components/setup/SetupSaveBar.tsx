import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  modifiche: number;
  saving: boolean;
  on_save: () => void;
  on_reset: () => void;
}

/**
 * Barra di salvataggio appiccicata in fondo allo schermo:
 * compare solo quando ci sono modifiche non salvate.
 */
export const SetupSaveBar: React.FC<Props> = ({ modifiche, saving, on_save, on_reset }) => {
  if (modifiche <= 0) return null;
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          {modifiche === 1 ? "1 modifica non salvata" : `${modifiche} modifiche non salvate`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={on_reset} disabled={saving}>
            Annulla le modifiche
          </Button>
          <Button size="sm" onClick={on_save} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupSaveBar;
