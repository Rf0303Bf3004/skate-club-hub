import React from "react";
import { normalize_codice } from "@/lib/portale-auth";

interface Props {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  id?: string;
}

// Maschera AT-XXXX-XXXX condivisa fra login portale e aggiunta profilo
export function maschera_codice(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 0) return "";
  if (clean.startsWith("AT")) {
    const rest = clean.slice(2);
    let out = "AT" + (rest.length > 0 ? "-" + rest.slice(0, 4) : "");
    if (rest.length > 4) out += "-" + rest.slice(4, 8);
    return out;
  }
  let out = "AT-" + clean.slice(0, 4);
  if (clean.length > 4) out += "-" + clean.slice(4, 8);
  return out;
}

const CodiceAtletaInput: React.FC<Props> = ({ value, onChange, autoFocus, id = "codice" }) => (
  <input
    id={id}
    value={value}
    onChange={(e) => onChange(maschera_codice(e.target.value))}
    onBlur={() => onChange(normalize_codice(value))}
    placeholder="AT-XXXX-XXXX"
    maxLength={12}
    className="w-full h-14 font-mono tracking-[0.25em] text-center text-xl uppercase rounded-2xl border-2 border-slate-200 bg-white focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 transition-all"
    autoComplete="off"
    autoFocus={autoFocus}
    inputMode="text"
  />
);

export default CodiceAtletaInput;
