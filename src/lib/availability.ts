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

// ─────────────────────────────────────────────────────────────
// Eccezioni di settimana: diff fra occorrenza (planning_corsi_settimana)
// e corso master (tabella corsi). Serve per mostrare in UI quali campi
// sono stati modificati per la singola settimana SENZA toccare il master.
// ─────────────────────────────────────────────────────────────

export type exception_diff_field =
  | "orario"
  | "giorno"
  | "istruttore"
  | "titolo";

export type exception_diff_entry = {
  campo: exception_diff_field;
  /** Etichetta breve del campo, già localizzata */
  label: string;
  /** Valore originale dal master */
  da: string;
  /** Valore corrente nell'occorrenza */
  a: string;
};

export type compute_exception_diff_params = {
  /** Riga di planning (display format usato in PlanningPage.posizionati) */
  occorrenza: {
    giorno?: string | null;
    data?: string | null;
    ora_inizio?: string | null;
    ora_fine?: string | null;
    istruttori_ids?: string[] | null;
    titolo_override?: string | null;
    sostituisce_id?: string | null;
  };
  /** Corso master (riga della tabella `corsi`) */
  master: {
    giorno?: string | null;
    ora_inizio?: string | null;
    ora_fine?: string | null;
    nome?: string | null;
    istruttori_ids?: string[] | null;
  } | null | undefined;
  /** Map id → istruttore (per risolvere i nomi nel diff) */
  istr_map?: Record<string, { nome?: string; cognome?: string } | undefined>;
};

function nome_istr(
  id: string | null | undefined,
  istr_map?: Record<string, { nome?: string; cognome?: string } | undefined>,
): string {
  if (!id) return "—";
  const i = istr_map?.[id];
  if (!i) return id.slice(0, 8);
  return `${i.nome ?? ""} ${i.cognome ?? ""}`.trim() || id.slice(0, 8);
}

/**
 * Confronta una occorrenza settimanale con il corso master.
 * Ritorna l'array (eventualmente vuoto) di differenze rilevate.
 *
 * Regole (decisione confermata):
 * - orario diverso → diff "orario"
 * - giorno effettivo diverso da giorno master oppure spostamento (sostituisce_id) → diff "giorno"
 * - primo istruttore diverso → diff "istruttore"
 * - titolo_override valorizzato → diff "titolo"
 */
export function compute_exception_diff(
  params: compute_exception_diff_params,
): exception_diff_entry[] {
  const { occorrenza, master, istr_map } = params;
  const out: exception_diff_entry[] = [];
  if (!master) return out;

  // ── Orario ──
  const occ_in = fmt_hhmm(occorrenza.ora_inizio);
  const occ_out = fmt_hhmm(occorrenza.ora_fine);
  const m_in = fmt_hhmm(master.ora_inizio);
  const m_out = fmt_hhmm(master.ora_fine);
  if ((occ_in || occ_out) && (occ_in !== m_in || occ_out !== m_out)) {
    out.push({
      campo: "orario",
      label: "Orario",
      da: `${m_in}-${m_out}`,
      a: `${occ_in}-${occ_out}`,
    });
  }

  // ── Giorno ──
  // Se l'occorrenza è uno spostamento (sostituisce_id) o il giorno effettivo
  // non corrisponde a quello del master, è una diff di giorno.
  if (occorrenza.giorno && master.giorno && occorrenza.giorno !== master.giorno) {
    out.push({
      campo: "giorno",
      label: "Giorno",
      da: master.giorno,
      a: occorrenza.giorno,
    });
  } else if (occorrenza.sostituisce_id) {
    out.push({
      campo: "giorno",
      label: "Giorno",
      da: master.giorno ?? "—",
      a: occorrenza.giorno ?? "—",
    });
  }

  // ── Istruttore (primo) ──
  const occ_istr = (occorrenza.istruttori_ids ?? [])[0] ?? null;
  const m_istr = (master.istruttori_ids ?? [])[0] ?? null;
  if ((occ_istr || m_istr) && occ_istr !== m_istr) {
    out.push({
      campo: "istruttore",
      label: "Istruttore",
      da: nome_istr(m_istr, istr_map),
      a: nome_istr(occ_istr, istr_map),
    });
  }

  // ── Titolo override ──
  if (occorrenza.titolo_override && occorrenza.titolo_override !== master.nome) {
    out.push({
      campo: "titolo",
      label: "Titolo",
      da: master.nome ?? "—",
      a: occorrenza.titolo_override,
    });
  }

  return out;
}

