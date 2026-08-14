import React from "react";
import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";

interface Props {
  icon?: React.ElementType;
  titolo: string;
  descrizione?: string;
  azione_label?: string;
  on_azione?: () => void;
  compatto?: boolean;
}

/**
 * Stato vuoto uniforme: icona, una frase che spiega, un pulsante
 * che porta all'azione giusta. Niente aree bianche silenziose.
 */
const EmptyState: React.FC<Props> = ({
  icon: Icon = Inbox,
  titolo,
  descrizione,
  azione_label,
  on_azione,
  compatto = false,
}) => (
  <div className={`flex flex-col items-center justify-center text-center ${compatto ? "py-8" : "py-14"} px-6`}>
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
      <Icon className="h-6 w-6 text-muted-foreground" />
    </div>
    <p className="text-sm font-semibold text-foreground">{titolo}</p>
    {descrizione && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descrizione}</p>}
    {azione_label && on_azione && (
      <Button size="sm" variant="outline" className="mt-4" onClick={on_azione}>
        {azione_label}
      </Button>
    )}
  </div>
);

export default EmptyState;
