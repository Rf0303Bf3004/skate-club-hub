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

/** Uscita definitiva del tablet: dimentica il codice e chiude la sessione. */
export async function esci_dalla_pista(): Promise<void> {
  cancella_codice_pista();
  try {
    await supabase.auth.signOut();
  } catch {
    /* anche se la chiusura remota fallisce, il codice non è più sul dispositivo */
  }
}
