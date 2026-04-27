import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { use_livelli, type LivelloRow } from "@/hooks/use-supabase-data";

export type FaseLivello = "comune" | "carriera" | "qualsiasi";

export interface SelectLivelloProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  fase?: FaseLivello;
  allowNull?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Etichetta mostrata per l'opzione "nessun livello". Default contestuale alla fase. */
  nullLabel?: string;
}

const NULL_TOKEN = "__none__";

export const SelectLivello: React.FC<SelectLivelloProps> = ({
  value,
  onChange,
  fase = "qualsiasi",
  allowNull = true,
  placeholder = "Seleziona livello",
  disabled,
  className,
  nullLabel,
}) => {
  const { data: livelli = [], isLoading } = use_livelli();

  const opzioni = React.useMemo<LivelloRow[]>(() => {
    if (fase === "qualsiasi") return livelli;
    return livelli.filter((l) => l.fase === fase);
  }, [livelli, fase]);

  const default_null_label =
    fase === "qualsiasi"
      ? "— Aperto a tutti i livelli —"
      : "— Nessun livello —";

  const current = value ?? (allowNull ? NULL_TOKEN : "");

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === NULL_TOKEN ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? "Caricamento..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNull && (
          <SelectItem value={NULL_TOKEN}>{nullLabel ?? default_null_label}</SelectItem>
        )}
        {opzioni.map((l) => (
          <SelectItem key={l.id} value={l.nome}>
            {l.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
