// ─────────────────────────────────────────────────────────────
// Utility unica per il controllo "istruttore disponibile?"
// Usata sia da PlanningPage (allarme hard sulle barre)
// sia da PrivateLessonsPage (validazione prenotazione slot).
// Singolo posto da modificare in futuro: niente logiche divergenti.
// ─────────────────────────────────────────────────────────────

export type fascia_disponibilita = { ora_inizio: string; ora_fine: string };
export type disponibilita_per_giorno = Record<string, fascia_disponibilita[]>;

export function time_to_min(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmt_hhmm(t: string | null | undefined): string {
  return (t ?? "").slice(0, 5);
}

export type istruttore_disponibile_params = {
  /** Mappa per giorno (es. "Lunedì") → fasce; tipicamente istruttore.disponibilita */
  disponibilita_per_giorno: disponibilita_per_giorno | null | undefined;
  /** Nome italiano del giorno: Lunedì, Martedì, Mercoledì, ... */
  giorno: string;
  /** "HH:MM" o "HH:MM:SS" */
  ora_inizio: string;
  /** "HH:MM" o "HH:MM:SS" */
  ora_fine: string;
};

export type istruttore_disponibile_result = {
  /** true se lo slot è completamente contenuto in una fascia di disponibilità */
  disponibile: boolean;
  /** Stringa breve per UI (es. "Mercoledì 15:00-17:00, ..."), vuota se nessuna fascia */
  fasce_label: string;
  /** Spiegazione breve quando non disponibile (per tooltip). undefined se disponibile. */
  motivo?: string;
};

/**
 * Verifica se [ora_inizio, ora_fine] è completamente contenuto
 * in almeno una fascia di disponibilità dell'istruttore per quel giorno.
 *
 * Regola (decisione confermata): allarme se lo slot non è interamente
 * dentro una fascia. Disponibilità parziale = allarme.
 */
export function istruttore_disponibile(
  params: istruttore_disponibile_params,
): istruttore_disponibile_result {
  const { disponibilita_per_giorno, giorno, ora_inizio, ora_fine } = params;
  const fasce: fascia_disponibilita[] =
    (disponibilita_per_giorno && disponibilita_per_giorno[giorno]) || [];

  const fasce_label = fasce
    .map((f) => `${fmt_hhmm(f.ora_inizio)}-${fmt_hhmm(f.ora_fine)}`)
    .join(", ");

  if (fasce.length === 0) {
    return {
      disponibile: false,
      fasce_label: "",
      motivo: `Nessuna disponibilità dichiarata il ${giorno}`,
    };
  }

  const s = time_to_min(ora_inizio);
  const e = time_to_min(ora_fine);

  const dentro = fasce.some((f) => {
    const fs = time_to_min(f.ora_inizio);
    const fe = time_to_min(f.ora_fine);
    return s >= fs && e <= fe;
  });

  if (dentro) return { disponibile: true, fasce_label };

  return {
    disponibile: false,
    fasce_label,
    motivo: `Slot ${fmt_hhmm(ora_inizio)}-${fmt_hhmm(ora_fine)} fuori fascia (${giorno}: ${fasce_label})`,
  };
}
