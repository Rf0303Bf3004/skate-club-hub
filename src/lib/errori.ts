import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * Punto unico di gestione degli errori del portale.
 *
 * Regola: nessun errore deve restare nascosto.
 * Ogni chiamata fa tre cose insieme:
 *  1. mostra un toast comprensibile all'utente (mai lo stack o il codice grezzo)
 *  2. scrive in console con il contesto completo (per lo sviluppo)
 *  3. registra la riga nel registro `errori_applicativi` via la RPC `registra_errore`
 */

export type Gravita = "errore" | "avviso" | "riuscito_a_vuoto";

const MESSAGGI_CODICI: Record<string, string> = {
  "23505": "Questo dato esiste già (valore duplicato).",
  "23503": "Riferimento mancante: un dato collegato non esiste (più).",
  "23514": "Il dato inserito non rispetta una regola di validità.",
  "42703": "Colonna inesistente: il programma sta chiedendo un campo che non c'è.",
  "42501": "Permesso negato: il tuo ruolo non può eseguire questa operazione.",
  "42P01": "Tabella inesistente: il programma sta leggendo qualcosa che non c'è.",
  PGRST116: "Nessun dato trovato per questa richiesta.",
  PGRST204: "Campo inesistente nella richiesta inviata al database.",
};

interface ErroreLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

function estrai(err: unknown): ErroreLike {
  if (!err) return {};
  if (typeof err === "string") return { message: err };
  const e = err as ErroreLike;
  return {
    code: e.code ?? null,
    message: e.message ?? null,
    details: e.details ?? null,
    hint: e.hint ?? null,
    status: e.status,
  };
}

/** Traduce un errore tecnico in una frase leggibile in italiano. */
export function messaggio_leggibile(err: unknown): string {
  const e = estrai(err);
  if (e.code && MESSAGGI_CODICI[e.code]) return MESSAGGI_CODICI[e.code];
  return e.message?.trim() || "Errore imprevisto.";
}

/**
 * Segnala un errore: toast + console + registro nel database.
 * Non lancia mai: può essere chiamata anche dentro un catch senza rischi.
 */
export async function segnala_errore(
  dove: string,
  operazione: string,
  err: unknown,
  dettaglio?: Record<string, unknown>,
  gravita: Gravita = "errore",
): Promise<void> {
  const e = estrai(err);
  const messaggio = messaggio_leggibile(err);

  // 1. utente
  if (gravita === "errore") {
    toast.error(operazione, { description: messaggio });
  } else {
    toast.warning(operazione, { description: messaggio });
  }

  // 2. sviluppo
  console.error(`[${dove}] ${operazione}:`, err, dettaglio ?? {});

  // 3. registro
  try {
    await supabase.rpc("registra_errore", {
      p_dove: dove,
      p_messaggio: messaggio,
      p_operazione: operazione,
      p_codice: e.code ?? (e.status ? String(e.status) : null),
      p_dettaglio: {
        ...(dettaglio ?? {}),
        raw_message: e.message ?? null,
        details: e.details ?? null,
        hint: e.hint ?? null,
        url: typeof window !== "undefined" ? window.location.pathname : null,
      } as any,
      p_gravita: gravita,
      p_club: null,
    } as any);
  } catch (reg_err) {
    console.error("[errori] impossibile registrare l'errore nel database", reg_err);
  }
}

/**
 * Segnala un'operazione "riuscita a vuoto": nessun errore, ma zero righe toccate
 * dove ne era attesa almeno una. È il caso più insidioso (il bottone che "funziona"
 * ma non fa niente).
 */
export async function segnala_a_vuoto(
  dove: string,
  operazione: string,
  dettaglio?: Record<string, unknown>,
): Promise<void> {
  toast.warning(operazione, {
    description: "L'operazione è andata a buon fine ma non ha modificato nulla.",
  });
  console.warn(`[${dove}] riuscito a vuoto: ${operazione}`, dettaglio ?? {});
  try {
    await supabase.rpc("registra_errore", {
      p_dove: dove,
      p_messaggio: "Operazione riuscita ma nessuna riga interessata",
      p_operazione: operazione,
      p_codice: null,
      p_dettaglio: (dettaglio ?? {}) as any,
      p_gravita: "riuscito_a_vuoto",
      p_club: null,
    } as any);
  } catch (reg_err) {
    console.error("[errori] impossibile registrare l'evento nel database", reg_err);
  }
}

/**
 * Registra senza disturbare l'utente (nessun toast): per errori di contorno
 * che non bloccano l'operazione principale ma non devono sparire.
 */
export async function registra_silenzioso(
  dove: string,
  operazione: string,
  err: unknown,
  dettaglio?: Record<string, unknown>,
): Promise<void> {
  const e = estrai(err);
  console.warn(`[${dove}] ${operazione}:`, err, dettaglio ?? {});
  try {
    await supabase.rpc("registra_errore", {
      p_dove: dove,
      p_messaggio: messaggio_leggibile(err),
      p_operazione: operazione,
      p_codice: e.code ?? null,
      p_dettaglio: (dettaglio ?? {}) as any,
      p_gravita: "avviso",
      p_club: null,
    } as any);
  } catch {
    /* il registro non deve mai rompere il flusso */
  }
}

/**
 * Verifica il risultato di una scrittura: se `error` è presente lo segnala,
 * se le righe toccate sono zero segnala "riuscito a vuoto".
 * Ritorna true se l'operazione ha davvero prodotto un effetto.
 */
export async function verifica_scrittura(
  dove: string,
  operazione: string,
  risultato: { data: unknown; error: unknown },
  dettaglio?: Record<string, unknown>,
): Promise<boolean> {
  if (risultato.error) {
    await segnala_errore(dove, operazione, risultato.error, dettaglio);
    return false;
  }
  const righe = Array.isArray(risultato.data) ? risultato.data.length : risultato.data ? 1 : 0;
  if (righe === 0) {
    await segnala_a_vuoto(dove, operazione, dettaglio);
    return false;
  }
  return true;
}
