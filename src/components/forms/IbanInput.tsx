import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

/** Toglie spazi, a capo e tutto ciò che non è lettera o cifra; maiuscole. */
export const compatta_iban = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Gruppi di quattro, come sulle carte PostFinance: solo per la lettura a video. */
export const formatta_iban = (v: string) => compatta_iban(v).replace(/(.{4})/g, "$1 ").trim();

type Props = {
  /** Valore compatto, senza spazi (come sta nel database). */
  value: string;
  /** Riceve sempre il valore compatto: chi usa il componente non vede mai gli spazi. */
  onChange: (compatto: string) => void;
  paese?: "CH" | "IT";
  placeholder?: string;
  id?: string;
};

/**
 * Casella IBAN: mostra a gruppi di quattro, emette compatto.
 * Il cursore resta al suo posto anche correggendo una cifra in mezzo:
 * si conta quanti caratteri utili stanno prima del cursore e lo si riposiziona
 * dopo la riformattazione.
 */
export function IbanInput({ value, onChange, paese = "CH", placeholder, id }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const max_compatto = paese === "CH" ? 21 : 27;
  // maxLength sul testo visibile: caratteri + uno spazio ogni quattro
  const max_visibile = max_compatto + Math.floor((max_compatto - 1) / 4);

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  return (
    <Input
      ref={ref}
      id={id}
      value={formatta_iban(value)}
      placeholder={placeholder}
      maxLength={max_visibile}
      autoComplete="off"
      onChange={(e) => {
        const el = e.target;
        const pos = el.selectionStart ?? el.value.length;
        // quanti caratteri utili (non spazi) stanno prima del cursore nel testo visibile
        const prima = compatta_iban(el.value.slice(0, pos)).length;
        const nuovo = compatta_iban(el.value).slice(0, max_compatto);
        // nel testo riformattato il cursore sta dopo `prima` caratteri utili più i loro spazi
        const spazi = prima === 0 ? 0 : Math.floor((prima - 1) / 4);
        caret.current = Math.min(prima + spazi, formatta_iban(nuovo).length);
        onChange(nuovo);
      }}
    />
  );
}
