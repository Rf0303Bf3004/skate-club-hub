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

// ─── Modello multitest ────────────────────────────────────────────────────
//
// Un Test di livello è un evento (tipo='base' o 'in_gara'). Le convocazioni
// (test_livello_atleti) rappresentano la "catena" di passaggi che una
// singola atleta affronta in quell'evento, ordinati progressivamente.

export type Disciplina = "artistica" | "stile";

export type Passaggio = {
  accesso: string;
  target: string;
  /** True se serve scegliere una disciplina (artistica/stile) per il target. */
  richiede_disciplina: boolean;
};

/**
 * Sequenza ordinata dei passaggi "base" (Pulcini → Interbronzo).
 * L'ultimo passaggio Stellina 4 → Interbronzo richiede di scegliere una disciplina.
 */
export const TEST_BASE_PASSAGGI: Passaggio[] = [
  { accesso: "Pulcini",    target: "Stellina 1",  richiede_disciplina: false },
  { accesso: "Stellina 1", target: "Stellina 2",  richiede_disciplina: false },
  { accesso: "Stellina 2", target: "Stellina 3",  richiede_disciplina: false },
  { accesso: "Stellina 3", target: "Stellina 4",  richiede_disciplina: false },
  { accesso: "Stellina 4", target: "Interbronzo", richiede_disciplina: true  },
];

/**
 * Sequenza ordinata dei passaggi di carriera (Interbronzo → Oro).
 * Ogni passaggio richiede sempre la disciplina (artistica o stile).
 */
export const TEST_CARRIERA_PASSAGGI: Passaggio[] = [
  { accesso: "Interbronzo",  target: "Bronzo",       richiede_disciplina: true },
  { accesso: "Bronzo",       target: "Interargento", richiede_disciplina: true },
  { accesso: "Interargento", target: "Argento",      richiede_disciplina: true },
  { accesso: "Argento",      target: "Interoro",     richiede_disciplina: true },
  { accesso: "Interoro",     target: "Oro",          richiede_disciplina: true },
];

/**
 * Restituisce i passaggi consecutivi disponibili a un'atleta nel suo evento test,
 * partendo dal suo livello attuale. Sono ordinati e formano la massima catena
 * possibile a partire dal livello attuale dell'atleta.
 *
 * - Per un'atleta nei "pulcini" o "amatori" si usa la sequenza base.
 * - Per un'atleta in "artistica" si usa la sequenza carriera, partendo dal
 *   livello della disciplina richiesta (default: artistica).
 *
 * NB: la lista è una "proposta" del massimo possibile; l'utente nel form
 * sceglie quanti step inserire effettivamente.
 */
export function get_passaggi_validi_per_atleta(
  a: AtletaLivelloInput,
  disciplina: Disciplina = "artistica",
): Passaggio[] {
  const cat = (a?.categoria ?? null) as Categoria | null;
  if (cat === "pulcini") {
    return TEST_BASE_PASSAGGI.slice(0); // tutta la catena base
  }
  if (cat === "amatori") {
    const cur = a?.livello_amatori || a?.livello_attuale || "Stellina 1";
    const idx = TEST_BASE_PASSAGGI.findIndex((p) => p.accesso === cur);
    return idx >= 0 ? TEST_BASE_PASSAGGI.slice(idx) : TEST_BASE_PASSAGGI.slice(0);
  }
  if (cat === "artistica") {
    const cur =
      disciplina === "stile"
        ? a?.livello_stile || a?.livello_amatori || "Interbronzo"
        : a?.livello_artistica || a?.livello_amatori || "Interbronzo";
    // Se l'atleta è ancora a Stellina 4 (caso transizione), parte da Stellina 4 → Interbronzo
    const base_idx = TEST_BASE_PASSAGGI.findIndex((p) => p.accesso === cur);
    if (base_idx >= 0) {
      // include Stellina 4 → Interbronzo + tutta la carriera
      return [...TEST_BASE_PASSAGGI.slice(base_idx), ...TEST_CARRIERA_PASSAGGI];
    }
    const car_idx = TEST_CARRIERA_PASSAGGI.findIndex((p) => p.accesso === cur);
    return car_idx >= 0 ? TEST_CARRIERA_PASSAGGI.slice(car_idx) : TEST_CARRIERA_PASSAGGI.slice(0);
  }
  return [];
}

/**
 * Calcola il "prossimo passaggio" valido dato un livello di accesso noto.
 * Utile nel form Convoca atleta per pre-popolare lo step successivo della catena.
 */
export function get_passaggio_dopo(accesso: string): Passaggio | null {
  const all = [...TEST_BASE_PASSAGGI, ...TEST_CARRIERA_PASSAGGI];
  const idx = all.findIndex((p) => p.accesso === accesso);
  if (idx < 0) return null;
  return all[idx + 1] || null;
}

/**
 * Propaga gli esiti all'interno di una catena multitest per una singola atleta.
 *
 * Regole:
 *  - Quando uno step diventa 'non_superato', tutti gli step successivi (ordine maggiore)
 *    della stessa catena (stessa disciplina) diventano 'non_sostenuto'.
 *  - Quando uno step torna a 'superato' (es. correzione), gli step successivi che
 *    erano 'non_sostenuto' tornano a 'in_attesa'.
 *
 * La funzione applica l'aggiornamento via Supabase client (passato come parametro
 * per evitare dipendenza circolare nel modulo helper).
 */
export type TestAtletaRow = {
  id: string;
  test_id: string;
  atleta_id: string;
  ordine: number;
  livello_accesso: string;
  livello_target: string;
  disciplina: Disciplina | string | null;
  esito: "in_attesa" | "superato" | "non_superato" | "non_sostenuto" | string;
};

export async function apply_esito_propagation(
  client: { from: (t: string) => any },
  test_atleta_id: string,
  nuovo_esito: "in_attesa" | "superato" | "non_superato" | "non_sostenuto",
  catena_dell_atleta: TestAtletaRow[],
): Promise<void> {
  const corrente = catena_dell_atleta.find((r) => r.id === test_atleta_id);
  if (!corrente) return;
  const successivi_stessa_catena = catena_dell_atleta.filter(
    (r) =>
      r.atleta_id === corrente.atleta_id &&
      r.test_id === corrente.test_id &&
      (r.disciplina ?? null) === (corrente.disciplina ?? null) &&
      r.ordine > corrente.ordine,
  );
  if (successivi_stessa_catena.length === 0) return;

  if (nuovo_esito === "non_superato") {
    const ids = successivi_stessa_catena.map((r) => r.id);
    await client
      .from("test_livello_atleti")
      .update({ esito: "non_sostenuto" })
      .in("id", ids);
  } else if (nuovo_esito === "superato" || nuovo_esito === "in_attesa") {
    // Sblocca solo quelli che erano stati propagati a non_sostenuto
    const ids = successivi_stessa_catena
      .filter((r) => r.esito === "non_sostenuto")
      .map((r) => r.id);
    if (ids.length > 0) {
      await client
        .from("test_livello_atleti")
        .update({ esito: "in_attesa" })
        .in("id", ids);
    }
  }
}
