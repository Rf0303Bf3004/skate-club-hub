// Enum dei ruoli applicativi. Allineato con CHECK constraint su utenti_club.ruolo.
export type RuoloUtente =
  | "superadmin"
  | "admin"
  | "presidente"
  | "dt"
  | "segreteria"
  | "istruttore"
  | "atleta"
  | "genitore";

/** Ruoli che possono confermare manualmente le ore lavorate di un istruttore. */
export function can_override_ore_lavoro(ruolo?: string | null): boolean {
  return ruolo === "superadmin" || ruolo === "admin" || ruolo === "dt" || ruolo === "presidente";
}
