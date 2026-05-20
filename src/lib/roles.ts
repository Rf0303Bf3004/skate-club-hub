// Enum dei ruoli applicativi. Allineato con CHECK constraint su utenti_club.ruolo.
// NOTA: ruoli granulari (dt, segreteria, istruttore, ...) verranno introdotti in F6.
export type RuoloUtente = "superadmin" | "admin" | "staff";

/** Ruoli che possono confermare manualmente le ore lavorate di un istruttore. */
export function can_override_ore_lavoro(ruolo?: string | null): boolean {
  return ruolo === "superadmin" || ruolo === "admin";
}
