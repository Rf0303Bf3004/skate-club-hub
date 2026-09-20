// Suggerimenti di specializzazione per l'anagrafica istruttori.
// Il campo `specialita` resta testo libero: questi sono solo scorciatoie,
// non un elenco chiuso. Le etichette passano da i18n (namespace `istruttori`).

export const SPECIALIZZAZIONI_SUGGERITE = [
  "coreografia",
  "preparazione_atletica",
  "danza_ghiaccio",
  "sincronizzato",
  "salti",
  "trottole",
  "abilita_base",
] as const;

export type SpecializzazioneSuggerita = (typeof SPECIALIZZAZIONI_SUGGERITE)[number];

/** Chiave di traduzione dell'etichetta di un suggerimento. */
export function chiave_specializzazione(valore: SpecializzazioneSuggerita): string {
  return `specialita.opzioni.${valore}`;
}
