/**
 * Regole di iscrivibilità a una gara per il portale genitori.
 *
 * - gara già passata → non iscrivibile
 * - scadenza_iscrizioni superata → non iscrivibile
 * - livello dell'atleta inferiore a gare_calendario.livello_minimo → non iscrivibile
 *
 * L'ordine dei livelli replica LIVELLO_ORDER di src/hooks/use-supabase-data.ts
 * (tollerando sia "Stellina N" sia "Stelline N").
 */

/** Dal più basso al più alto. */
export const LIVELLI_SCALA: string[] = [
  "Pulcini",
  "Stellina 1",
  "Stellina 2",
  "Stellina 3",
  "Stellina 4",
  "Interbronzo",
  "Bronzo",
  "Interargento",
  "Argento",
  "Interoro",
  "Oro",
];

export function normalizza_livello(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  return s.replace(/^Stelline\s+/i, "Stellina ").replace(/^stellina\s+/i, "Stellina ");
}

export function rank_livello(v: string | null | undefined): number {
  const n = normalizza_livello(v);
  const idx = LIVELLI_SCALA.findIndex((l) => l.toLowerCase() === n.toLowerCase());
  return idx; // -1 se sconosciuto
}

export type AtletaLivelloGara = {
  carriera_artistica?: string | null;
  carriera_stile?: string | null;
  livello_attuale?: string | null;
  percorso_amatori?: string | null;
};

/** Stessa logica di get_livello() in use-supabase-data.ts */
export function get_livello_atleta(a: AtletaLivelloGara | null | undefined): string {
  return normalizza_livello(
    a?.carriera_artistica || a?.carriera_stile || a?.livello_attuale || a?.percorso_amatori || "Pulcini",
  );
}

export function oggi_iso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type GaraIscrivibilita = {
  data?: string | null;
  scadenza_iscrizioni?: string | null;
  livello_minimo?: string | null;
  archiviata?: boolean | null;
};

/**
 * Restituisce il motivo (in chiaro) per cui la gara non è iscrivibile,
 * oppure null se l'iscrizione è consentita.
 */
export function motivo_non_iscrivibile(
  gara: GaraIscrivibilita,
  atleta: AtletaLivelloGara | null | undefined,
): string | null {
  const oggi = oggi_iso();
  if (gara?.archiviata) return "Gara archiviata";
  if (gara?.data && gara.data < oggi) return "Gara già svolta";
  if (gara?.scadenza_iscrizioni && gara.scadenza_iscrizioni < oggi) {
    const d = new Date(gara.scadenza_iscrizioni + "T00:00:00").toLocaleDateString("it-CH");
    return `Iscrizioni chiuse il ${d}`;
  }
  const minimo = normalizza_livello(gara?.livello_minimo);
  if (minimo) {
    const r_min = rank_livello(minimo);
    const r_atl = rank_livello(get_livello_atleta(atleta));
    if (r_min >= 0 && r_atl >= 0 && r_atl < r_min) {
      return `Richiede almeno ${minimo}`;
    }
  }
  return null;
}
