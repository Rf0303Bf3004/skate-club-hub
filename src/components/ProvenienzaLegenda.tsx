import React from "react";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";

export const VERDE_ESTERNI = "#16A34A";
/** Tinta degli atleti ospiti di un campo (temporanei, di un altro club). */
export const AMBRA_OSPITI = "#D97706";
/** Sfondo riga tenue per un atleta ospite, leggibile anche in tema scuro. */
export const RIGA_OSPITE_CLS = "bg-amber-500/10 dark:bg-amber-400/10";

/**
 * Legenda colori provenienza atleti (ragioni sociali + esterni).
 * Non renderizza nulla se il club non usa la modalità multi ragione sociale.
 */
const ProvenienzaLegenda: React.FC<{ className?: string; con_ospiti?: boolean }> = ({ className, con_ospiti }) => {
  const { data: ragioni_sociali = [] } = use_ragioni_sociali();
  const { modalita } = useModalitaArea("fatturazione");

  const attive = (ragioni_sociali ?? []).filter((r) => r.attivo);
  const mostra_ragioni = modalita === "multi_ragione_sociale" && attive.length > 0;
  if (!mostra_ragioni && !con_ospiti) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      {mostra_ragioni && attive.map((r) => (
        <span key={r.id} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border border-border"
            style={{ backgroundColor: r.colore_primario || "hsl(var(--muted-foreground))" }}
          />
          {r.nome}
        </span>
      ))}
      {mostra_ragioni && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border border-border"
            style={{ backgroundColor: VERDE_ESTERNI }}
          />
          Esterni
        </span>
      )}
      {con_ospiti && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border border-border"
            style={{ backgroundColor: AMBRA_OSPITI }}
          />
          Ospiti di campo
        </span>
      )}
    </div>
  );
};

export default ProvenienzaLegenda;
