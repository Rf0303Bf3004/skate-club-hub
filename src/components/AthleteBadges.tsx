import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";

/**
 * Mini-pillole testuali FED / AGO per atleti.
 * Stile: grigio scuro su sfondo chiaro, font 10-11px, padding 2x6px.
 * Si renderizzano INLINE accanto al nome (stessa riga) con piccolo gap.
 */
type Props = {
  agonista?: boolean | null;
  atleta_federazione?: boolean | null;
  atleta_esterno?: boolean | null;
  ragione_sociale_id?: string | null;
  className?: string;
};

const pill_cls =
  "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide text-muted-foreground/90 ring-1 ring-inset ring-border";

const AthleteBadges: React.FC<Props> = ({
  agonista,
  atleta_federazione,
  atleta_esterno,
  ragione_sociale_id,
  className,
}) => {
  const { data: ragioni_sociali = [] } = use_ragioni_sociali();
  const ragione_sociale = ragione_sociale_id
    ? (ragioni_sociali ?? []).find((r) => r.id === ragione_sociale_id)
    : undefined;

  if (!agonista && !atleta_federazione && !atleta_esterno && !ragione_sociale) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <span className={`inline-flex items-center gap-1 align-middle ${className ?? ""}`}>
        {atleta_federazione && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={pill_cls}>FED</span>
            </TooltipTrigger>
            <TooltipContent>Atleta di Federazione</TooltipContent>
          </Tooltip>
        )}
        {agonista && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={pill_cls}>AGO</span>
            </TooltipTrigger>
            <TooltipContent>Agonista</TooltipContent>
          </Tooltip>
        )}
        {ragione_sociale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={pill_cls}
                style={
                  ragione_sociale.colore_primario
                    ? {
                        borderLeft: `3px solid ${ragione_sociale.colore_primario}`,
                        backgroundColor: `${ragione_sociale.colore_primario}1A`,
                      }
                    : undefined
                }
              >
                {ragione_sociale.nome.toUpperCase()}
              </span>
            </TooltipTrigger>
            <TooltipContent>Ragione sociale: {ragione_sociale.nome}</TooltipContent>
          </Tooltip>
        )}
        {atleta_esterno && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={pill_cls}
                style={{ borderLeft: `3px solid ${VERDE_ESTERNI}`, backgroundColor: `${VERDE_ESTERNI}1A` }}
              >
                ESTERNO
              </span>
            </TooltipTrigger>
            <TooltipContent>Pattinatore esterno ospite</TooltipContent>
          </Tooltip>
        )}

      </span>
    </TooltipProvider>
  );
};

export default AthleteBadges;
