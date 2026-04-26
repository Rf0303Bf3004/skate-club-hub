// Stato derivato delle fatture lato applicativo.
// La colonna `stato` del DB è generated (pagata|da_pagare) e non distingue le scadute.

export type FatturaStatoUI = "pagata" | "scaduta" | "da_pagare";

export function get_fattura_stato_ui(f: any, today_iso?: string): FatturaStatoUI {
  if (!f) return "da_pagare";
  if (f.pagata === true || f.stato === "pagata") return "pagata";
  const today = today_iso || new Date().toISOString().split("T")[0];
  const scad = f.data_scadenza || f.scadenza;
  if (scad && String(scad) < today) return "scaduta";
  return "da_pagare";
}

export function get_fattura_stato_label(s: FatturaStatoUI): string {
  if (s === "pagata") return "Pagata";
  if (s === "scaduta") return "Scaduta";
  return "Da pagare";
}

export function get_fattura_stato_classes(s: FatturaStatoUI): string {
  if (s === "pagata") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (s === "scaduta") return "bg-red-100 text-red-800 border border-red-200";
  return "bg-amber-100 text-amber-800 border border-amber-200";
}
