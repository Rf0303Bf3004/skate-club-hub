import { supabase } from "@/lib/supabase";

/**
 * Codice del tablet di bordo pista conservato sul dispositivo.
 * Su un tablet in navigazione privata o con i dati bloccati localStorage
 * può fallire: ogni lettura e scrittura è protetta e in caso di guasto
 * si ricade semplicemente sul campo da digitare.
 */
const CHIAVE = "pista_codice_club";

export function leggi_codice_pista(): string | null {
  try {
    const v = window.localStorage.getItem(CHIAVE);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function salva_codice_pista(codice: string): void {
  try {
    window.localStorage.setItem(CHIAVE, codice);
  } catch {
    /* dispositivo che non consente di conservare: si continua senza */
  }
}

export function cancella_codice_pista(): void {
  try {
    window.localStorage.removeItem(CHIAVE);
  } catch {
    /* niente da cancellare se il dispositivo non conserva */
  }
}

export type EsitoPista =
  | { ok: true }
  | { ok: false; motivo: "codice_errato" | "troppi_tentativi" | "guasto"; messaggio: string };

/** Formato del codice del club: PI-XXXX-XXXX, alfabeto senza I, O, L, 0, 1. */
export function codice_pista_completo(codice: string): boolean {
  return /^PI-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codice);
}

/**
 * Accesso della sessione pista con il codice del club.
 * Non salva nulla: chi chiama decide se conservare il codice sul dispositivo.
 */
export async function accedi_pista_con_codice(codice: string): Promise<EsitoPista> {
  try {
    const { data, error } = await supabase.functions.invoke("pista-login", { body: { codice } });
    const corpo: any = data ?? {};
    if (error || corpo?.error) {
      const motivo = corpo?.error === "too_many_attempts" ? "troppi_tentativi" : "codice_errato";
      return {
        ok: false,
        motivo,
        messaggio: String(corpo?.message || corpo?.error || error?.message || ""),
      };
    }
    if (!corpo?.access_token || !corpo?.refresh_token) {
      return { ok: false, motivo: "codice_errato", messaggio: "" };
    }
    const { error: err_sessione } = await supabase.auth.setSession({
      access_token: corpo.access_token,
      refresh_token: corpo.refresh_token,
    });
    if (err_sessione) {
      return { ok: false, motivo: "guasto", messaggio: err_sessione.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "guasto", messaggio: e instanceof Error ? e.message : String(e) };
  }
}

/** Quanto può durare al massimo la chiusura di sessione prima di arrendersi. */
const TIMEOUT_USCITA_MS = 2500;

/**
 * Rimuove a mano la chiave di sessione che il client conserva in locale.
 * Ultima spiaggia quando la chiusura normale non è andata a buon fine:
 * al prossimo caricamento la sessione non c'è più.
 */
function rimuovi_sessione_locale(): void {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split(".")[0];
    window.localStorage.removeItem(`sb-${ref}-auth-token`);
  } catch {
    /* dispositivo che non consente l'accesso: non resta altro da fare */
  }
}

/**
 * Chiude la sessione del tablet in modo che non possa appendersi:
 * la chiusura ha un tempo massimo, e se dopo la sessione risulta ancora
 * viva la chiave locale viene rimossa a mano. Funziona anche a rete morta.
 */
export async function chiudi_sessione_pista(): Promise<void> {
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise<never>((_, rifiuta) => setTimeout(() => rifiuta(new Error("timeout uscita")), TIMEOUT_USCITA_MS)),
    ]);
  } catch {
    /* rete lenta o assente: si prosegue con la rimozione manuale */
  }
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) rimuovi_sessione_locale();
  } catch {
    rimuovi_sessione_locale();
  }
}

/**
 * Uscita definitiva del tablet. Ordine obbligatorio: prima la sessione
 * (con tempo massimo e rimozione manuale di riserva), poi il codice, poi
 * il cambio pagina. Un guasto non deve mai lasciare il dispositivo con
 * la sessione viva e il codice già perso.
 */
export async function esci_dalla_pista(): Promise<void> {
  await chiudi_sessione_pista();
  cancella_codice_pista();
  window.location.replace("/pista-login");
}
