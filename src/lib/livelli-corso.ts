// ─────────────────────────────────────────────────────────────────────────────
// Livello dichiarato di un corso — UNICA fonte di verità lato browser.
//
// REGOLA (vincolo `corsi_livello_dichiarato_chk` nel database):
// un corso ATTIVO deve avere `livello_richiesto` NON vuoto. Può dichiarare
// l'apertura a tutti, ma deve dichiararla: la parola `tutti`.
//
// `livello_richiesto` è un ELENCO di livelli separati da virgola
// (es. "Stellina 1,Stellina 2"), oppure la parola `tutti`.
// La funzione SQL `valuta_iscrizione` legge lo stesso formato: se cambi qui
// il modo di leggerlo, va cambiato anche lì. Chi deve decidere se un'atleta
// può iscriversi usa `valuta_iscrizione`, non questi helper: qui si filtra
// solo l'elenco mostrato a chi compila.
// ─────────────────────────────────────────────────────────────────────────────

export const LIVELLO_TUTTI = "tutti";

/** Parole che il database riconosce come apertura dichiarata a tutti. */
const ALIAS_TUTTI = ["tutti", "tutti i livelli"];

/** Etichette leggibili dei livelli storici salvati in forma compatta. */
export const ETICHETTE_LIVELLO: Record<string, string> = {
  pulcini: "Pulcini",
  stellina1: "Stellina 1",
  stellina2: "Stellina 2",
  stellina3: "Stellina 3",
  stellina4: "Stellina 4",
  interbronzo: "Interbronzo",
  bronzo: "Bronzo",
  interargento: "Interargento",
  argento: "Argento",
  interoro: "Interoro",
  oro: "Oro",
};

/** Spezza il valore salvato nei singoli livelli dichiarati. */
export function parse_livelli_corso(valore?: string | null): string[] {
  return (valore ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Il corso dichiara di essere aperto a tutti i livelli. */
export function is_apertura_totale(valore?: string | null): boolean {
  return parse_livelli_corso(valore).some((l) => ALIAS_TUTTI.includes(l.toLowerCase()));
}

/** Il livello è stato dichiarato (elenco di livelli oppure "tutti"). */
export function livello_dichiarato(valore?: string | null): boolean {
  return parse_livelli_corso(valore).length > 0;
}

/** Corso spento rimasto senza livello: non blocca, ma va sistemato prima di pubblicarlo. */
export function livello_da_sistemare(corso: { attivo?: boolean | null; livello_richiesto?: string | null }): boolean {
  return corso?.attivo !== true && !livello_dichiarato(corso?.livello_richiesto);
}

/**
 * Livelli dichiarati dal corso che NON esistono nel catalogo del club.
 * Il confronto esatto di `corsi_per_atleta` li rende invisibili alle famiglie:
 * meglio dirlo in faccia che lasciare il corso nascosto in silenzio.
 */
export function livelli_fuori_catalogo(
  valore: string | null | undefined,
  nomi_catalogo: string[],
): string[] {
  if (is_apertura_totale(valore)) return [];
  const noti = new Set(nomi_catalogo.map((n) => chiave_livello(n)));
  return parse_livelli_corso(valore).filter((l) => !noti.has(chiave_livello(l)));
}

/** Valore da salvare in `corsi.livello_richiesto`. */
export function serializza_livelli_corso(livelli: string[], tutti: boolean): string | null {
  if (tutti) return LIVELLO_TUTTI;
  const puliti = Array.from(new Set(livelli.map((l) => l.trim()).filter(Boolean)));
  return puliti.length > 0 ? puliti.join(",") : null;
}

/** Etichetta leggibile di un singolo livello. */
export function etichetta_livello(nome: string): string {
  return ETICHETTE_LIVELLO[nome.trim().toLowerCase()] ?? nome.trim();
}

/**
 * Testo da mostrare all'utente per `livello_richiesto`.
 * `t` è la funzione i18n del namespace "corsi".
 */
export function formatta_livelli_corso(
  valore: string | null | undefined,
  t: (chiave: string) => string,
): string {
  if (is_apertura_totale(valore)) return t("livelli.tutti");
  const livelli = parse_livelli_corso(valore);
  if (livelli.length === 0) return t("livelli.non_dichiarato");
  return livelli.map(etichetta_livello).join(", ");
}

/** Confronto "morbido" fra livelli scritti in forme diverse (Stellina 1 / stellina1). */
function chiave_livello(l: string): string {
  return l.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Serve SOLO a filtrare l'elenco proposto a chi compila.
 * La decisione vera sull'iscrizione resta della funzione SQL `valuta_iscrizione`.
 */
export function livello_atleta_compatibile(
  livello_atleta: string,
  livello_richiesto?: string | null,
): boolean {
  if (is_apertura_totale(livello_richiesto)) return true;
  const richiesti = parse_livelli_corso(livello_richiesto);
  if (richiesti.length === 0) return true;
  const atleta = chiave_livello(livello_atleta || "");
  return richiesti.some((r) => chiave_livello(r) === atleta);
}

/** Messaggio del database tradotto in una frase comprensibile, oppure null. */
export function messaggio_livello_obbligatorio(
  errore: unknown,
  t: (chiave: string) => string,
): string | null {
  const msg = `${(errore as any)?.message ?? ""} ${(errore as any)?.details ?? ""}`;
  if (msg.includes("corsi_livello_dichiarato_chk")) return t("livelli.obbligatorio");
  return null;
}
