import React, { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  value: string; // formato AAAA-MM-GG (o vuoto)
  onChange: (value: string) => void;
  className?: string;
  min_year?: number;
  max_year?: number;
}

type ErroreData = null | "inesistente" | "anno_fuori_range";

/** Vera solo se il giorno/mese/anno esistono davvero nel calendario (bisestili inclusi). */
function data_esiste(gn: number, mn: number, yn: number): boolean {
  const d = new Date(yn, mn - 1, gn);
  return d.getFullYear() === yn && d.getMonth() === mn - 1 && d.getDate() === gn;
}

const DateInput: React.FC<Props> = ({ value, onChange, className, min_year = 1900, max_year = 2100 }) => {
  const { t } = useTranslation("common");
  const [gg, set_gg] = useState("");
  const [mm, set_mm] = useState("");
  const [aaaa, set_aaaa] = useState("");
  const [errore, set_errore] = useState<ErroreData>(null);

  const ref_mm = useRef<HTMLInputElement>(null);
  const ref_aaaa = useRef<HTMLInputElement>(null);

  // Sync da value esterno
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m, d] = value.split("T")[0].split("-");
      set_aaaa(y);
      set_mm(m);
      set_gg(d);
      set_errore(null);
    } else if (!value) {
      set_gg("");
      set_mm("");
      set_aaaa("");
      set_errore(null);
    }
  }, [value]);

  const emit = (g: string, m: string, y: string) => {
    if (g.length === 2 && m.length === 2 && y.length === 4) {
      const gn = parseInt(g, 10);
      const mn = parseInt(m, 10);
      const yn = parseInt(y, 10);
      if (yn < min_year || yn > max_year) {
        set_errore("anno_fuori_range");
        return;
      }
      if (!data_esiste(gn, mn, yn)) {
        set_errore("inesistente");
        return;
      }
      set_errore(null);
      onChange(`${y}-${m}-${g}`);
      return;
    }
    set_errore(null);
    if (!g && !m && !y) onChange("");
  };

  const only_digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

  const base_cls =
    "h-10 rounded-md border bg-background px-2 py-2 text-base text-center focus-visible:outline-none focus-visible:ring-2 md:text-sm " +
    (errore
      ? "border-destructive text-destructive focus-visible:ring-destructive"
      : "border-input focus-visible:ring-ring");

  return (
    <div className={className ?? ""}>
      <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        placeholder={t("date_input.dd")}
        value={gg}
        maxLength={2}
        onChange={(e) => {
          const v = only_digits(e.target.value, 2);
          set_gg(v);
          emit(v, mm, aaaa);
          if (v.length === 2) ref_mm.current?.focus();
        }}
        className={`${base_cls} w-14`}
      />
      <span className="text-muted-foreground">.</span>
      <input
        ref={ref_mm}
        type="text"
        inputMode="numeric"
        placeholder={t("date_input.mm")}
        value={mm}
        maxLength={2}
        onChange={(e) => {
          const v = only_digits(e.target.value, 2);
          set_mm(v);
          emit(gg, v, aaaa);
          if (v.length === 2) ref_aaaa.current?.focus();
        }}
        className={`${base_cls} w-14`}
      />
      <span className="text-muted-foreground">.</span>
      <input
        ref={ref_aaaa}
        type="text"
        inputMode="numeric"
        placeholder={t("date_input.yyyy")}
        value={aaaa}
        maxLength={4}
        onChange={(e) => {
          const v = only_digits(e.target.value, 4);
          set_aaaa(v);
          emit(gg, mm, v);
        }}
        className={`${base_cls} w-20`}
      />
      </div>
      {errore && (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {errore === "inesistente"
            ? t("date_input.errore_inesistente")
            : t("date_input.errore_anno_range", { min: min_year, max: max_year })}
        </p>
      )}
    </div>
  );
};

export default DateInput;
