import React, { useLayoutEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = React.ComponentProps<typeof Textarea>;

/**
 * Casella di testo che cresce con il contenuto: il testo del documento non
 * viene mai nascosto dietro una barra di scorrimento né tagliato in altezza.
 */
const TextareaCrescente = React.forwardRef<HTMLTextAreaElement, Props>(
  ({ className, value, ...resto }, ref_esterno) => {
    const rif = useRef<HTMLTextAreaElement | null>(null);
    useLayoutEffect(() => {
      const el = rif.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);
    return (
      <Textarea
        ref={(el) => {
          rif.current = el;
          if (typeof ref_esterno === "function") ref_esterno(el);
          else if (ref_esterno) (ref_esterno as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        }}
        value={value}
        className={["resize-none overflow-hidden whitespace-pre-wrap break-words", className].filter(Boolean).join(" ")}
        {...resto}
      />
    );
  },
);
TextareaCrescente.displayName = "TextareaCrescente";

export default TextareaCrescente;
