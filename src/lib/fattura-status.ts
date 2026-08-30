// Stato derivato delle fatture lato applicativo.
// Stati ammessi in banca dati: bozza, inviata, sollecitata, pagata, scaduta, annullata, stornata.

export type FatturaStatoUI =
  | "bozza"
  | "inviata"
  | "sollecitata"
  | "pagata"
  | "scaduta"
  | "annullata"
  | "stornata"
  | "da_pagare";

/** Documenti che non concorrono agli incassi attesi. */
export function fattura_chiusa(f: any): boolean {
  return f?.stato === "annullata" || f?.stato === "stornata";
}

export function get_fattura_stato_ui(f: any, today_iso?: string): FatturaStatoUI {
  if (!f) return "da_pagare";
  if (f.stato === "annullata") return "annullata";
  if (f.stato === "stornata") return "stornata";
  if (f.pagata === true || f.stato === "pagata") return "pagata";
  if (f.stato === "bozza") return "bozza";
  const today = today_iso || new Date().toISOString().split("T")[0];
  const scad = f.data_scadenza || f.scadenza;
  if (scad && String(scad) < today) return "scaduta";
  if (f.stato === "sollecitata") return "sollecitata";
  if (f.stato === "inviata") return "inviata";
  return "da_pagare";
}

const LABELS: Record<string, string> = {
  bozza: "Bozza",
  inviata: "Inviata",
  sollecitata: "Sollecitata",
  pagata: "Pagata",
  scaduta: "Scaduta",
  annullata: "Annullata",
  stornata: "Stornata",
  da_pagare: "Da pagare",
};

export function get_fattura_stato_label(s: FatturaStatoUI | string): string {
  return LABELS[s] ?? String(s);
}

export function get_fattura_stato_classes(s: FatturaStatoUI): string {
  if (s === "pagata") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (s === "scaduta") return "bg-red-100 text-red-800 border border-red-200";
  if (s === "bozza") return "bg-slate-100 text-slate-700 border border-slate-200";
  if (s === "inviata") return "bg-blue-100 text-blue-800 border border-blue-200";
  if (s === "sollecitata") return "bg-orange-100 text-orange-800 border border-orange-200";
  if (s === "annullata" || s === "stornata") return "bg-gray-100 text-gray-500 border border-gray-200";
  return "bg-amber-100 text-amber-800 border border-amber-200";
}
