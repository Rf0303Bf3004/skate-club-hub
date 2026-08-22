import i18n from "@/i18n";

const tk = (key: string) => i18n.t(`relazione.categorie.${key}`, { ns: "dashboard" }) as string;

// ATTENZIONE: i `value` sono i valori salvati nel DB (colonna `categoria`): NON rinominarli.
export const CATEGORIE_BLOCCO = [
  { value: "staff", label_key: "blocco.staff", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "eventi_futuri", label_key: "blocco.eventi_futuri", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "trattative", label_key: "blocco.trattative", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "progetti", label_key: "blocco.progetti", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { value: "altro", label_key: "blocco.altro", color: "bg-gray-100 text-gray-800 border-gray-200" },
] as const;

// Categorie storiche mantenute per visualizzare blocchi pre-esistenti senza romperne il render.
const CATEGORIE_LEGACY = [
  { value: "apertura", label_key: "blocco.apertura_legacy", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "conclusioni", label_key: "blocco.conclusioni_legacy", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
] as const;

export const CATEGORIE_ALLEGATO = [
  { value: "bilancio", label_key: "allegato.bilancio", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "federazione", label_key: "allegato.federazione", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "certificazione", label_key: "allegato.certificazione", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "contratto_sponsor", label_key: "allegato.contratto_sponsor", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "verbale", label_key: "allegato.verbale", color: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "altro", label_key: "allegato.altro", color: "bg-gray-100 text-gray-800 border-gray-200" },
] as const;

const TUTTE_CATEGORIE_BLOCCO = [...CATEGORIE_BLOCCO, ...CATEGORIE_LEGACY];

export function cat_blocco(v: string) {
  return TUTTE_CATEGORIE_BLOCCO.find((c) => c.value === v) ?? CATEGORIE_BLOCCO[CATEGORIE_BLOCCO.length - 1];
}
export function cat_allegato(v: string) {
  return CATEGORIE_ALLEGATO.find((c) => c.value === v) ?? CATEGORIE_ALLEGATO[CATEGORIE_ALLEGATO.length - 1];
}

/** Label tradotta a runtime (il valore DB resta invariato). */
export function label_blocco(v: string) {
  return tk(cat_blocco(v).label_key);
}
export function label_allegato(v: string) {
  return tk(cat_allegato(v).label_key);
}

export function format_bytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
