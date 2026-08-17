// Helper condivisi per le finestre di pubblicazione e validità delle convenzioni.
// Tutte le date sono stringhe ISO "YYYY-MM-DD" (o null = nessun limite).

export interface FinestreConvenzione {
  validita_da?: string | null;
  validita_a?: string | null;
  pubblicazione_da?: string | null;
  pubblicazione_a?: string | null;
}

export function oggi_iso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${g}`;
}

/** true se la convenzione è dentro la finestra di pubblicazione (date vuote = sempre pubblicata). */
export function is_pubblicata(c: FinestreConvenzione, oggi = oggi_iso()): boolean {
  if (c.pubblicazione_da && oggi < c.pubblicazione_da) return false;
  if (c.pubblicazione_a && oggi > c.pubblicazione_a) return false;
  return true;
}

/** true se l'offerta è dentro il periodo di validità (date vuote = sempre valida). */
export function is_valida(c: FinestreConvenzione, oggi = oggi_iso()): boolean {
  if (c.validita_da && oggi < c.validita_da) return false;
  if (c.validita_a && oggi > c.validita_a) return false;
  return true;
}

export function format_gg_mm(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, g] = iso.split("-");
  if (!y || !m || !g) return iso;
  return `${g}/${m}`;
}

export type StatoValidita =
  | { tipo: "valida"; label: null }
  | { tipo: "in_arrivo"; label: string }
  | { tipo: "scaduta"; label: string };

/** Badge di stato per le viste soci/pubblica: "In arrivo dal gg/mm" o "Scaduta". */
export function stato_validita(c: FinestreConvenzione, oggi = oggi_iso()): StatoValidita {
  if (c.validita_da && oggi < c.validita_da) {
    return { tipo: "in_arrivo", label: `In arrivo dal ${format_gg_mm(c.validita_da)}` };
  }
  if (c.validita_a && oggi > c.validita_a) {
    return { tipo: "scaduta", label: "Scaduta" };
  }
  return { tipo: "valida", label: null };
}

export type StatoPubblicazione = "programmata" | "pubblicata" | "terminata";

/** Stato di pubblicazione per la lista superadmin. */
export function stato_pubblicazione(c: FinestreConvenzione, oggi = oggi_iso()): StatoPubblicazione {
  if (c.pubblicazione_da && oggi < c.pubblicazione_da) return "programmata";
  if (c.pubblicazione_a && oggi > c.pubblicazione_a) return "terminata";
  return "pubblicata";
}

export const label_pubblicazione: Record<StatoPubblicazione, string> = {
  programmata: "Programmata",
  pubblicata: "Pubblicata",
  terminata: "Non più pubblicata",
};

export const colore_pubblicazione: Record<StatoPubblicazione, string> = {
  programmata: "bg-amber-50 text-amber-700 border-amber-200",
  pubblicata: "bg-emerald-50 text-emerald-700 border-emerald-200",
  terminata: "bg-slate-100 text-slate-600 border-slate-200",
};
