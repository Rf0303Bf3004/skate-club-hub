import React from "react";
import { Lock } from "lucide-react";
import type { EventoUnificato } from "@/hooks/use-planning-unificato";

/** Box compatto di un evento unificato (Griglia o Planning classico), sola lettura. */
const EventoUnificatoBox: React.FC<{
  evento: EventoUnificato;
  onClick?: () => void;
  compatto?: boolean;
  style?: React.CSSProperties;
  className?: string;
}> = ({ evento, onClick, compatto, style, className }) => {
  const is_griglia = evento.fonte === "griglia";
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      title={`${evento.ora_inizio}–${evento.ora_fine} · ${evento.titolo}${
        evento.istruttori.length ? ` · ${evento.istruttori.join(", ")}` : ""
      } · ${is_griglia ? "Griglia" : "Planning classico"}`}
      className={[
        "overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors",
        is_griglia
          ? "border-primary/40 bg-primary/10 hover:bg-primary/20"
          : "border-dashed border-border bg-muted hover:bg-muted/70",
        evento.annullato ? "opacity-50 line-through" : "",
        className ?? "",
      ].join(" ")}
    >
      <span className="flex items-center gap-1 font-semibold">
        {!is_griglia && <Lock className="h-2.5 w-2.5 shrink-0" />}
        {evento.ora_inizio}
        {!compatto && `–${evento.ora_fine}`}
      </span>
      <span className="block truncate">{evento.titolo}</span>
      {!compatto && evento.istruttori.length > 0 && (
        <span className="block truncate text-muted-foreground">{evento.istruttori.join(", ")}</span>
      )}
    </button>
  );
};

export default EventoUnificatoBox;
