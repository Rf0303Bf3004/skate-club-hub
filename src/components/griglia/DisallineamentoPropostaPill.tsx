import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, RefreshCw, UserPlus, UserMinus } from "lucide-react";
import type { DisallineamentoProposta } from "@/hooks/use-griglia-ghiaccio";

interface Props {
  disallineamento: DisallineamentoProposta;
  in_corso?: boolean;
  /** Risincronizzazione ESPLICITA: mai automatica. */
  on_risincronizza: () => void;
}

/**
 * Indicatore di divergenza tra lo snapshot "per proposta" della sessione e le
 * iscrizioni correnti al corso collegato (Fase 5, punto 2).
 */
const DisallineamentoPropostaPill: React.FC<Props> = ({ disallineamento, in_corso, on_risincronizza }) => {
  const { nuovi, rimossi } = disallineamento;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          title="Le iscrizioni al corso collegato sono cambiate dopo la creazione della sessione"
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="font-medium">Proposta disallineata</span>
          {nuovi.length > 0 && <Badge variant="secondary" className="text-[10px]">+{nuovi.length}</Badge>}
          {rimossi.length > 0 && <Badge variant="secondary" className="text-[10px]">−{rimossi.length}</Badge>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="text-xs text-muted-foreground">
          Le iscrizioni al corso collegato sono cambiate dopo la creazione della sessione. Nessuna modifica
          viene applicata finché non la confermi.
        </p>

        {nuovi.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1">
              <UserPlus className="w-3 h-3" /> {nuovi.length} nuovi iscritti non presenti
            </p>
            <ul className="text-xs text-muted-foreground max-h-24 overflow-auto pl-4 list-disc">
              {nuovi.map((n) => (
                <li key={n.atleta_id}>{n.nome}</li>
              ))}
            </ul>
          </div>
        )}

        {rimossi.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1">
              <UserMinus className="w-3 h-3" /> {rimossi.length} iscritti rimossi dal corso
            </p>
            <ul className="text-xs text-muted-foreground max-h-24 overflow-auto pl-4 list-disc">
              {rimossi.map((r) => (
                <li key={r.riga_id}>{r.nome}</li>
              ))}
            </ul>
          </div>
        )}

        <Button size="sm" className="w-full" disabled={in_corso} onClick={on_risincronizza}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${in_corso ? "animate-spin" : ""}`} />
          Risincronizza sessione
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default DisallineamentoPropostaPill;
