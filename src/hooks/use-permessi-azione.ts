import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import type { RuoloUtente } from "@/lib/roles";

/**
 * Specchio esatto delle funzioni di sicurezza del database:
 * puo_gestire_sportivo(), puo_comunicare(), puo_configurare_club(),
 * puo_pianificare(), puo_gestire_fatture(club), ruolo_in(array[...]).
 *
 * Unico punto da aggiornare quando cambiano le regole lato database.
 */

export const RUOLI_GESTIONE_SPORTIVA: RuoloUtente[] = [
  "superadmin",
  "admin",
  "presidente",
  "vicepresidente",
  "dt",
  "segreteria",
];

export const RUOLI_COMUNICAZIONE: RuoloUtente[] = [
  "superadmin",
  "admin",
  "presidente",
  "vicepresidente",
  "dt",
  "segreteria",
];

export const RUOLI_CONFIGURAZIONE_CLUB: RuoloUtente[] = ["superadmin", "admin", "presidente"];

export const RUOLI_PIANIFICAZIONE: RuoloUtente[] = [
  "superadmin",
  "admin",
  "presidente",
  "vicepresidente",
  "dt",
];

export const RUOLI_FATTURE: RuoloUtente[] = ["superadmin", "admin", "presidente", "segreteria"];

export const RUOLI_SOLO_PRESIDENTE: RuoloUtente[] = ["superadmin", "presidente"];

/** Chi può creare accessi al portale: stessi ruoli accettati dalla funzione `manage-user`. */
export const RUOLI_CREAZIONE_ACCESSI: RuoloUtente[] = ["superadmin", "admin", "presidente"];

function has(ruoli: RuoloUtente[], ruolo?: string | null): boolean {
  return !!ruolo && (ruoli as string[]).includes(ruolo);
}

export function puo_gestire_sportivo(ruolo?: string | null) {
  return has(RUOLI_GESTIONE_SPORTIVA, ruolo);
}
export function puo_comunicare(ruolo?: string | null) {
  return has(RUOLI_COMUNICAZIONE, ruolo);
}
export function puo_configurare_club(ruolo?: string | null) {
  return has(RUOLI_CONFIGURAZIONE_CLUB, ruolo);
}
export function puo_pianificare(ruolo?: string | null) {
  return has(RUOLI_PIANIFICAZIONE, ruolo);
}
export function puo_gestire_fatture(ruolo?: string | null) {
  return has(RUOLI_FATTURE, ruolo);
}
export function solo_presidente(ruolo?: string | null) {
  return has(RUOLI_SOLO_PRESIDENTE, ruolo);
}
export function puo_creare_accessi(ruolo?: string | null) {
  return has(RUOLI_CREAZIONE_ACCESSI, ruolo);
}
/** Equivalente di ruolo_in(array[...]) del database. */
export function ruolo_in(ruoli: RuoloUtente[], ruolo?: string | null) {
  return has(ruoli, ruolo);
}

export interface PermessiAzione {
  ruolo: RuoloUtente | null;
  puo_gestire_sportivo: boolean;
  puo_comunicare: boolean;
  puo_configurare_club: boolean;
  puo_pianificare: boolean;
  puo_gestire_fatture: boolean;
  solo_presidente: boolean;
  ruolo_in: (ruoli: RuoloUtente[]) => boolean;
}

/** Hook centralizzato: chi può fare cosa, allineato al database. */
export function usePermessiAzione(): PermessiAzione {
  const { session } = useAuth();
  const ruolo = session?.ruolo ?? null;

  return useMemo(
    () => ({
      ruolo,
      puo_gestire_sportivo: puo_gestire_sportivo(ruolo),
      puo_comunicare: puo_comunicare(ruolo),
      puo_configurare_club: puo_configurare_club(ruolo),
      puo_pianificare: puo_pianificare(ruolo),
      puo_gestire_fatture: puo_gestire_fatture(ruolo),
      solo_presidente: solo_presidente(ruolo),
      ruolo_in: (ruoli: RuoloUtente[]) => ruolo_in(ruoli, ruolo),
    }),
    [ruolo],
  );
}
