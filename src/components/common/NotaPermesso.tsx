import { Info } from "lucide-react";

/** Riga discreta che spiega perché i comandi di scrittura non sono disponibili. */
export default function NotaPermesso({ testo }: { testo: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>{testo}</span>
    </div>
  );
}
