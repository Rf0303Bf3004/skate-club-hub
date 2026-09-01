import React from "react";
import { ChevronDown } from "lucide-react";
import { get_current_club_id } from "@/lib/supabase";

/**
 * Sezione richiudibile del Setup Club.
 * Lo stato aperto/chiuso è ricordato per club in localStorage.
 * Tutte le sezioni sono aperte al primo accesso.
 */

function storage_key() {
  return `ia_setup_sezioni:${get_current_club_id() || "anon"}`;
}

function leggi_stato(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(storage_key());
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function use_sezione_aperta(id: string) {
  const [aperta, set_aperta] = React.useState<boolean>(() => leggi_stato()[id] ?? true);

  const toggle = React.useCallback(() => {
    set_aperta((prev) => {
      const next = !prev;
      try {
        const stato = leggi_stato();
        stato[id] = next;
        localStorage.setItem(storage_key(), JSON.stringify(stato));
      } catch {
        /* storage non disponibile: si continua in memoria */
      }
      return next;
    });
  }, [id]);

  return [aperta, toggle] as const;
}

interface Props {
  id: string;
  titolo: string;
  /** Numero di campi ancora da compilare in questa sezione (0 = completa) */
  mancanti?: number;
  descrizione?: React.ReactNode;
  children: React.ReactNode;
}

export const SetupSection: React.FC<Props> = ({ id, titolo, mancanti = 0, descrizione, children }) => {
  const [aperta, toggle] = use_sezione_aperta(id);

  return (
    <section
      id={`sez-${id}`}
      data-setup-section={id}
      className="scroll-mt-40 rounded-xl border border-border bg-card shadow-card"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={aperta}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40 rounded-xl"
      >
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${aperta ? "" : "-rotate-90"}`}
        />
        <h2 className="flex-1 text-sm font-bold uppercase tracking-widest text-muted-foreground">{titolo}</h2>
        {mancanti > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {mancanti === 1 ? "1 campo da compilare" : `${mancanti} campi da compilare`}
          </span>
        )}
      </button>
      {aperta && (
        <div className="space-y-4 border-t border-border/60 px-5 py-5">
          {descrizione && <p className="text-xs text-muted-foreground">{descrizione}</p>}
          {children}
        </div>
      )}
    </section>
  );
};

export default SetupSection;
