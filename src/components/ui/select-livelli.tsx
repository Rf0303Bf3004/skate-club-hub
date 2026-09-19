import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check } from "lucide-react";
import { use_livelli } from "@/hooks/use-supabase-data";
import {
  LIVELLO_TUTTI,
  is_apertura_totale,
  parse_livelli_corso,
  serializza_livelli_corso,
  etichetta_livello,
} from "@/lib/livelli-corso";

export interface SelectLivelliProps {
  /** Valore così com'è in `corsi.livello_richiesto` (elenco separato da virgola oppure "tutti"). */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  /** Mostra il bordo rosso e il testo dell'errore (livello obbligatorio). */
  errore?: string | null;
}

/**
 * Scelta a più valori del livello di un corso.
 * "Tutti i livelli" è una voce distinta e separata: quando è spuntata esclude
 * le altre e salva la parola `tutti`. Il campo vuoto non è più ammesso per un
 * corso attivo: è il chiamante a bloccare il salvataggio.
 */
export const SelectLivelli: React.FC<SelectLivelliProps> = ({ value, onChange, disabled, errore }) => {
  const { t } = useTranslation("corsi");
  const { data: livelli = [], isLoading, isError, refetch } = use_livelli();

  const tutti = is_apertura_totale(value);
  const selezionati = tutti ? [] : parse_livelli_corso(value);
  const selezionato = (nome: string) =>
    selezionati.some((s) => s.trim().toLowerCase() === nome.trim().toLowerCase());

  const toggle_livello = (nome: string) => {
    const nuovi = selezionato(nome)
      ? selezionati.filter((s) => s.trim().toLowerCase() !== nome.trim().toLowerCase())
      : [...selezionati, nome];
    onChange(serializza_livelli_corso(nuovi, false));
  };

  // La lettura dei livelli non è arrivata (o è fallita): non si sceglie a vuoto.
  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {t("livelli.errore_caricamento")}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs font-semibold text-destructive underline"
        >
          {t("livelli.riprova")}
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("livelli.caricamento")}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        className={`rounded-lg border ${errore ? "border-destructive" : "border-border"} bg-background overflow-hidden`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(tutti ? null : LIVELLO_TUTTI)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
            tutti ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
          }`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              tutti ? "bg-primary border-primary text-primary-foreground" : "border-input"
            }`}
          >
            {tutti && <Check className="w-3 h-3" />}
          </span>
          {t("livelli.tutti")}
        </button>

        <div className="border-t border-border max-h-48 overflow-y-auto">
          {livelli.map((l: any) => {
            const on = selezionato(l.nome);
            return (
              <button
                key={l.id}
                type="button"
                disabled={disabled || tutti}
                onClick={() => toggle_livello(l.nome)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  tutti ? "opacity-40 cursor-not-allowed" : on ? "bg-primary/5 text-foreground" : "hover:bg-muted/50"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    on ? "bg-primary border-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {on && <Check className="w-3 h-3" />}
                </span>
                {etichetta_livello(l.nome)}
              </button>
            );
          })}
        </div>
      </div>

      {errore ? (
        <p className="text-xs text-destructive">{errore}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">{t("livelli.aiuto")}</p>
      )}
    </div>
  );
};
