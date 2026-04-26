/**
 * Helper centralizzati per la gestione del modello dati "livelli atleta".
 *
 * Modello:
 *  - categoria: stadio della carriera ('pulcini' → 'amatori' → 'artistica')
 *  - livello_amatori: solo per amatori (e per artistica finché non superato Interbronzo)
 *  - livello_artistica / livello_stile: discipline indipendenti in carriera artistica
 */

export type Categoria = "pulcini" | "amatori" | "artistica";

export type LivelloAmatori = "Stellina 1" | "Stellina 2" | "Stellina 3" | "Stellina 4";

export type LivelloCarriera =
  | "Interbronzo"
  | "Bronzo"
  | "Interargento"
  | "Argento"
  | "Interoro"
  | "Oro";

export const CATEGORIE: Categoria[] = ["pulcini", "amatori", "artistica"];

export const LIVELLI_AMATORI: LivelloAmatori[] = [
  "Stellina 1",
  "Stellina 2",
  "Stellina 3",
  "Stellina 4",
];

export const LIVELLI_CARRIERA: LivelloCarriera[] = [
  "Interbronzo",
  "Bronzo",
  "Interargento",
  "Argento",
  "Interoro",
  "Oro",
];

/** Forma minima dell'atleta per le funzioni di display. */
export type AtletaLivelloInput = {
  categoria?: Categoria | string | null;
  livello_amatori?: LivelloAmatori | string | null;
  livello_artistica?: LivelloCarriera | string | null;
  livello_stile?: LivelloCarriera | string | null;
  // legacy fallback
  livello_attuale?: string | null;
};

export function get_categoria_label(c: Categoria | string | null | undefined): string {
  switch (c) {
    case "pulcini":
      return "Pulcini";
    case "amatori":
      return "Amatori";
    case "artistica":
      return "Artistica";
    default:
      return "—";
  }
}

/**
 * Livello con cui l'atleta gareggia / accede ai test.
 * - pulcini → "Pulcini"
 * - amatori → livello_amatori
 * - artistica → livello_artistica se valorizzato, altrimenti livello_amatori (fase di transizione post Stellina 4)
 *
 * Fallback finale: livello_attuale (legacy).
 */
export function get_livello_gara(a: AtletaLivelloInput): string {
  const cat = (a?.categoria ?? null) as Categoria | null;
  if (cat === "pulcini") return "Pulcini";
  if (cat === "amatori") return a?.livello_amatori || a?.livello_attuale || "—";
  if (cat === "artistica") {
    return (
      a?.livello_artistica || a?.livello_amatori || a?.livello_attuale || "—"
    );
  }
  return a?.livello_attuale || "—";
}

/**
 * Etichetta human-readable principale per la lista atleti.
 * Coincide con get_livello_gara, esposta come funzione separata per chiarezza
 * semantica nelle UI.
 */
export function get_livello_display(a: AtletaLivelloInput): string {
  return get_livello_gara(a);
}

/**
 * Dato un test (con livello_accesso e tipo), calcola il "livello target"
 * ovvero il livello che l'atleta otterrà superando il test.
 *
 * Regole:
 *  - accesso 'Pulcini' (qualsiasi tipo)            → 'Stellina 1'
 *  - accesso 'Stellina N' (1..3)                   → 'Stellina N+1'
 *  - accesso 'Stellina 4' + tipo artistica/stile   → 'Interbronzo'
 *  - accesso livello carriera                      → livello successivo della carriera
 */
export function get_livello_target(test: {
  livello_accesso?: string | null;
  tipo?: string | null;
}): string | null {
  const acc = (test?.livello_accesso || "").trim();
  const tipo = (test?.tipo || "").trim();
  if (!acc) return null;
  if (acc === "Pulcini") return "Stellina 1";
  const m = acc.match(/^Stellina\s+(\d)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 3) return `Stellina ${n + 1}`;
    if (n === 4 && (tipo === "artistica" || tipo === "stile")) return "Interbronzo";
    return null;
  }
  const idx = LIVELLI_CARRIERA.indexOf(acc as LivelloCarriera);
  if (idx >= 0 && idx < LIVELLI_CARRIERA.length - 1) return LIVELLI_CARRIERA[idx + 1];
  return null;
}

/** Pillole secondarie da mostrare accanto al livello principale (max 2). */
export function get_pillole_discipline(a: AtletaLivelloInput): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (a?.categoria === "artistica") {
    if (a?.livello_artistica) out.push({ label: "ART", value: String(a.livello_artistica) });
    if (a?.livello_stile) out.push({ label: "STI", value: String(a.livello_stile) });
  }
  return out;
}
