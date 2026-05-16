import React from "react";
import { CheckCircle2, Loader2, AlertCircle, Info } from "lucide-react";
import { useSavingState, saving_store } from "@/stores/savingState";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

function format_time(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export default function SavingIndicator() {
  const s = useSavingState();

  let icon: React.ReactNode;
  let text: string;
  let color = "text-teal-600";

  if (s.error) {
    icon = <AlertCircle className="w-4 h-4" />;
    text = "Errore di salvataggio";
    color = "text-red-600";
  } else if (s.pending > 0) {
    icon = <Loader2 className="w-4 h-4 animate-spin" />;
    text = "Salvataggio in corso...";
    color = "text-muted-foreground";
  } else if (s.just_saved) {
    icon = <CheckCircle2 className="w-4 h-4" />;
    text = "Salvato";
  } else {
    icon = <CheckCircle2 className="w-4 h-4" />;
    text = s.last_saved_at ? `Tutto salvato alle ${format_time(s.last_saved_at)}` : "Tutto salvato";
  }

  return (
    <div className="flex items-center gap-2 text-[13px]">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span>{text}</span>
        {s.error && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[12px] text-red-600 hover:text-red-700"
            onClick={() => saving_store.clear_error()}
          >
            Riprova
          </Button>
        )}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Info">
              <Info className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Le tue modifiche vengono salvate automaticamente. Puoi chiudere questa pagina e tornarci in qualsiasi momento.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
