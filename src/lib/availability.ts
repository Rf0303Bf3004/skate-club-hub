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
/** Normalizza nome giorno: minuscolo + rimozione accenti, così "Martedì" === "Martedi" === "martedì". */
function norm_giorno(g: string | null | undefined): string {
  return (g ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Cerca le fasce di disponibilità per il giorno richiesto, tollerando accenti e case. */
function pick_fasce(
  map: disponibilita_per_giorno | null | undefined,
  giorno: string,
): fascia_disponibilita[] {
  if (!map) return [];
  const target = norm_giorno(giorno);
  // 1) match esatto (fast path)
  if (map[giorno] && map[giorno].length) return map[giorno];
  // 2) match normalizzato fra le chiavi della mappa
  for (const k of Object.keys(map)) {
    if (norm_giorno(k) === target) return map[k] || [];
  }
  return [];
}

export function istruttore_disponibile(
  params: istruttore_disponibile_params,
): istruttore_disponibile_result {
  const { disponibilita_per_giorno, giorno, ora_inizio, ora_fine } = params;
  const fasce: fascia_disponibilita[] = pick_fasce(disponibilita_per_giorno, giorno);

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
// Calcolo aggregato delle ore impegnate da un istruttore in un giorno.
// Somma i minuti occupati intersecati con le fasce di disponibilità
// dichiarate (così non si conta tempo fuori disponibilità e si evitano
// doppi conteggi su slot sovrapposti).
// ─────────────────────────────────────────────────────────────

export type slot_impegno = { ora_inizio: string; ora_fine: string };

export type calcola_ore_impegnate_params = {
  /** Fasce di disponibilità dell'istruttore per quel giorno (HH:MM o HH:MM:SS) */
  fasce_disponibilita: fascia_disponibilita[];
  /** Slot impegnati (corsi + private non annullati) per quel giorno */
  slot_impegnati: slot_impegno[];
};

export type calcola_ore_impegnate_result = {
  /** Minuti totali di disponibilità dichiarata */
  minuti_totali: number;
  /** Minuti effettivamente occupati (intersezione con disponibilità, no doppioni) */
  minuti_impegnati: number;
  /** Range string da mostrare in UI: "16:00-19:00" oppure "14:00-16:00, 18:00-20:00" */
  range_label: string;
};

function merge_intervals(intervals: { s: number; e: number }[]): { s: number; e: number }[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.s - b.s);
  const out: { s: number; e: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.s <= last.e) last.e = Math.max(last.e, cur.e);
    else out.push({ ...cur });
  }
  return out;
}

export function calcola_ore_impegnate_giorno(
  params: calcola_ore_impegnate_params,
): calcola_ore_impegnate_result {
  const fasce = (params.fasce_disponibilita ?? []).map((f) => ({
    s: time_to_min(f.ora_inizio),
    e: time_to_min(f.ora_fine),
  }));
  const merged_disp = merge_intervals(fasce);
  const minuti_totali = merged_disp.reduce((acc, f) => acc + Math.max(0, f.e - f.s), 0);

  // Intersezione slot impegnati con disponibilità + merge per evitare doppioni
  const interz: { s: number; e: number }[] = [];
  for (const slot of params.slot_impegnati ?? []) {
    const ss = time_to_min(slot.ora_inizio);
    const se = time_to_min(slot.ora_fine);
    if (se <= ss) continue;
    for (const f of merged_disp) {
      const s = Math.max(ss, f.s);
      const e = Math.min(se, f.e);
      if (e > s) interz.push({ s, e });
    }
  }
  const merged_busy = merge_intervals(interz);
  const minuti_impegnati = merged_busy.reduce((acc, f) => acc + (f.e - f.s), 0);

  const range_label = merged_disp
    .map((f) => `${fmt_hhmm(min_to_hhmm(f.s))}-${fmt_hhmm(min_to_hhmm(f.e))}`)
    .join(", ");

  return { minuti_totali, minuti_impegnati, range_label };
}

function min_to_hhmm(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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

