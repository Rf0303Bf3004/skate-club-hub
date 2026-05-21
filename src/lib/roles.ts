// Enum dei ruoli applicativi. Allineato con CHECK constraint utenti_club_ruolo_chk.
export type RuoloUtente =
  | "superadmin"
  | "admin"
  | "dt"
  | "segreteria"
  | "presidente"
  | "istruttore"
  | "aiuto_monitore";

export const RUOLI_GRANULARI: RuoloUtente[] = [
  "presidente",
  "segreteria",
  "dt",
  "istruttore",
  "aiuto_monitore",
];

export const RUOLI_ADMIN_LIKE: RuoloUtente[] = ["superadmin", "admin"];

export function is_admin_like(ruolo?: string | null): boolean {
  return ruolo === "superadmin" || ruolo === "admin";
}

/** Ruoli che possono confermare manualmente le ore lavorate di un istruttore. */
export function can_override_ore_lavoro(ruolo?: string | null): boolean {
  return ruolo === "superadmin" || ruolo === "admin" || ruolo === "dt" || ruolo === "presidente";
}
