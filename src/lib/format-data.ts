// Helper centralizzato per la formattazione delle date in formato svizzero standard (gg.mm.aaaa).
// Il valore salvato in DB resta sempre ISO YYYY-MM-DD: queste funzioni cambiano solo il rendering UI.

const LOCALE = "de-CH";

type DateInput = Date | string | number | null | undefined;

function to_date(d: DateInput): Date | null {
  if (d === null || d === undefined || d === "") return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  if (typeof d === "number") {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  // string: se è una data ISO solo (YYYY-MM-DD) aggiungiamo T00:00:00 per evitare drift di fuso
  let s = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = s + "T00:00:00";
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/** gg.mm.aa (es. 07.04.26) */
export function format_data_breve(d: DateInput, fallback: string = "—"): string {
  const dt = to_date(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** gg.mm.aaaa (es. 07.04.2026) — formato svizzero standard */
export function format_data_completa(d: DateInput, fallback: string = "—"): string {
  const dt = to_date(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Variante con weekday e mese in lettere (es. "ven 7 apr 2026"). */
export function format_data_lunga(
  d: DateInput,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  fallback: string = "—"
): string {
  const dt = to_date(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString(LOCALE, opts);
}

/** Formato gg.mm (senza anno) — utile per liste compatte. */
export function format_data_gm(d: DateInput, fallback: string = "—"): string {
  const dt = to_date(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit" });
}

/** Compat: formattazione personalizzata con sempre locale svizzero. */
export function format_data(d: DateInput, opts: Intl.DateTimeFormatOptions, fallback: string = "—"): string {
  const dt = to_date(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString(LOCALE, opts);
}

// ── i18n helpers ────────────────────────────────────────────────
import type { Locale } from "./i18n";

export const LOCALE_BCP47: Record<Locale, string> = {
  it: "it-IT",
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
  rm: "rm-CH",
};

export function locale_to_bcp47(locale: Locale | undefined | null): string {
  if (!locale) return "it-IT";
  return LOCALE_BCP47[locale] ?? "it-IT";
}

/** Formato lungo localizzato (es. "martedì 28 aprile 2026") usando la lingua UI corrente. */
export function fmt_date_long(d: DateInput, locale_code: string, fallback: string = "—"): string {
  const dt = to_date(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString(locale_code, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
