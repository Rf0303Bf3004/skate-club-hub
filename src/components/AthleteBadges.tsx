import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

/**
 * Mini-pillole testuali FED / AGO per atleti.
 * Stile: grigio scuro su sfondo chiaro, font 10-11px, padding 2x6px.
 * Si renderizzano INLINE accanto al nome (stessa riga) con piccolo gap.
 */
type Props = {
  agonista?: boolean | null;
  atleta_federazione?: boolean | null;
  className?: string;
};

const pill_cls =
  "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide text-muted-foreground/90 ring-1 ring-inset ring-border";

const AthleteBadges: React.FC<Props> = ({ agonista, atleta_federazione, className }) => {
  if (!agonista && !atleta_federazione) return null;
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
      </span>
    </TooltipProvider>
  );
};

export default AthleteBadges;
