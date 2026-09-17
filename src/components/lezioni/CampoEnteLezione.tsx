import React from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { use_enti_lezione } from "@/hooks/use-ente-lezione";

/** Valore speciale del menu: la lezione la fattura il club (colonna NULL). */
export const ENTE_CLUB = "__club__";

/**
 * Campo "Fatturata da". Non si mostra affatto se il club non è in modalità
 * multi ragione sociale o non ha enti attivi.
 */
const CampoEnteLezione: React.FC<{
  value: string | null;
  on_change: (v: string | null) => void;
  disabled?: boolean;
}> = ({ value, on_change, disabled }) => {
  const { visibile, enti, is_error } = use_enti_lezione();
  const { t } = useTranslation("corsi");

  if (!visibile) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("lezioni_private.ente.label")}
      </label>
      <Select
        value={value ?? ENTE_CLUB}
        onValueChange={(v) => on_change(v === ENTE_CLUB ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ENTE_CLUB}>{t("lezioni_private.ente.club")}</SelectItem>
          {enti.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {is_error && <p className="text-xs text-destructive">{t("lezioni_private.ente.errore_elenco")}</p>}
    </div>
  );
};

export default CampoEnteLezione;
