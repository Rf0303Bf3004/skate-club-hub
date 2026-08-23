import React from "react";
import { Lock, LayoutGrid } from "lucide-react";

/** Legenda delle due fonti mostrate nelle viste unificate (Fase 6). */
const LegendaFonti: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
      <LayoutGrid className="h-3 w-3" /> Griglia (modificabile nella vista Giorno)
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm border border-border bg-muted" />
      <Lock className="h-3 w-3" /> Planning classico (sola lettura)
    </span>
  </div>
);

export default LegendaFonti;
