/**
 * Il codice d'errore di una edge function quando la risposta non è 2xx.
 *
 * `supabase.functions.invoke` su una risposta 4xx/5xx restituisce `data` nullo
 * e un `FunctionsHttpError` che tiene la Response vera in `context`: senza
 * leggerla, messaggi precisi come «abbiamo già ricevuto questa richiesta»
 * diventano un generico «invio non riuscito». Qui si legge il corpo e si tira
 * fuori il codice.
 */
export async function codice_errore_edge(data: unknown, error: unknown): Promise<string | null> {
  const dal_corpo = (data as any)?.error;
  if (typeof dal_corpo === "string" && dal_corpo) return dal_corpo;
  if (!error) return null;

  const contesto = (error as any)?.context;
  const risposta: Response | null =
    contesto && typeof contesto.json === "function" ? (contesto as Response) : null;
  if (risposta) {
    try {
      const corpo = await risposta.clone().json();
      const codice = (corpo as any)?.error;
      if (typeof codice === "string" && codice) return codice;
    } catch {
      // Corpo non leggibile: resta l'errore generico di chi chiama.
    }
  }
  return null;
}
