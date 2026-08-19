import React from "react";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";

export const VERDE_ESTERNI = "#16A34A";

/**
 * Legenda colori provenienza atleti (ragioni sociali + esterni).
 * Non renderizza nulla se il club non usa la modalità multi ragione sociale.
 */
const ProvenienzaLegenda: React.FC<{ className?: string }> = ({ className }) => {
  const { data: ragioni_sociali = [] } = use_ragioni_sociali();
  const { modalita } = useModalitaArea("fatturazione");

  const attive = (ragioni_sociali ?? []).filter((r) => r.attivo);
  if (modalita !== "multi_ragione_sociale" || attive.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      {attive.map((r) => (
        <span key={r.id} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border border-border"
            style={{ backgroundColor: r.colore_primario || "hsl(var(--muted-foreground))" }}
          />
          {r.nome}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full border border-border"
          style={{ backgroundColor: VERDE_ESTERNI }}
        />
        Esterni
      </span>
    </div>
  );
};

export default ProvenienzaLegenda;
