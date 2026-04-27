import React, { useRef, useEffect, useState } from "react";

interface Props {
  value: string; // formato AAAA-MM-GG (o vuoto)
  onChange: (value: string) => void;
  className?: string;
  min_year?: number;
  max_year?: number;
}

const DateInput: React.FC<Props> = ({ value, onChange, className, min_year = 1900, max_year = 2020 }) => {
  const [gg, set_gg] = useState("");
  const [mm, set_mm] = useState("");
  const [aaaa, set_aaaa] = useState("");

  const ref_mm = useRef<HTMLInputElement>(null);
  const ref_aaaa = useRef<HTMLInputElement>(null);

  // Sync da value esterno
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m, d] = value.split("T")[0].split("-");
      set_aaaa(y);
      set_mm(m);
      set_gg(d);
    } else if (!value) {
      set_gg("");
      set_mm("");
      set_aaaa("");
    }
  }, [value]);

  const emit = (g: string, m: string, y: string) => {
    if (g.length === 2 && m.length === 2 && y.length === 4) {
      const gn = parseInt(g, 10);
      const mn = parseInt(m, 10);
      const yn = parseInt(y, 10);
      if (gn >= 1 && gn <= 31 && mn >= 1 && mn <= 12 && yn >= min_year && yn <= max_year) {
        onChange(`${y}-${m}-${g}`);
        return;
      }
    }
    if (!g && !m && !y) onChange("");
  };

  const only_digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

  const base_cls =
    "h-10 rounded-md border border-input bg-background px-2 py-2 text-base text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="GG"
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
        placeholder="MM"
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
        placeholder="AAAA"
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
  );
};

export default DateInput;
