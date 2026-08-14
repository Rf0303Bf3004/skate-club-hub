import { useEffect, useState } from "react";

/**
 * Stato che sopravvive ai cambi di pagina (per sessione del browser).
 * Usato per i filtri delle liste: chi consulta la stessa vista più volte
 * al giorno non deve ricomporre ogni volta la stessa combinazione.
 */
export function use_persisted_state<T>(chiave: string, iniziale: T) {
  const storage_key = `ia_filtri:${chiave}`;

  const [valore, set_valore] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storage_key);
      return raw !== null ? (JSON.parse(raw) as T) : iniziale;
    } catch {
      return iniziale;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storage_key, JSON.stringify(valore));
    } catch {
      /* storage non disponibile: si continua in memoria */
    }
  }, [storage_key, valore]);

  return [valore, set_valore] as const;
}

export default use_persisted_state;
