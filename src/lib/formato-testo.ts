// Regole centralizzate di formattazione dei dati inseriti dall'utente.
// Obiettivo: evitare incongruenze (MARIO rossi / mario ROSSI) normalizzando
// ogni parola con iniziale maiuscola e resto minuscolo.

const PARTICELLE = new Set([
  "di", "de", "del", "della", "dello", "dei", "degli", "delle", "da", "dal",
  "dalla", "van", "von", "der", "den", "e", "la", "le", "lo", "il", "i", "su",
]);

/** Capitalizza una singola parola gestendo apostrofi e trattini (es. "d'angelo" -> "D'Angelo"). */
function capitalizza_parola(p: string): string {
  return p
    .split(/([-'’])/)
    .map((seg) =>
      /[-'’]/.test(seg) ? seg : seg.charAt(0).toLocaleUpperCase("it-CH") + seg.slice(1).toLocaleLowerCase("it-CH"),
    )
    .join("");
}

/**
 * Nome proprio / città: ogni parola con iniziale maiuscola e resto minuscolo.
 * Le particelle (di, de, van…) restano minuscole se non sono la prima parola.
 */
export function capitalizza_nome(value: string | null | undefined): string {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s
    .split(" ")
    .map((w, i) => {
      const lower = w.toLocaleLowerCase("it-CH");
      if (i > 0 && PARTICELLE.has(lower)) return lower;
      return capitalizza_parola(lower);
    })
    .join(" ");
}

/** Indirizzo: stessa regola, ma i numeri civici restano invariati. */
export function capitalizza_indirizzo(value: string | null | undefined): string {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s
    .split(" ")
    .map((w) => (/\d/.test(w) ? w : capitalizza_nome(w)))
    .join(" ");
}

/** Email sempre minuscola. */
export function normalizza_email(value: string | null | undefined): string {
  return String(value ?? "").trim().toLocaleLowerCase();
}

// ─── Suggerimento Località / Cantone dal CAP svizzero ────────────────
// Unica fonte: l'elenco cap_svizzera del database (lo stesso di cerca_cap),
// leggibile anche dalle pagine pubbliche.

import { supabase } from "@/lib/supabase";

export type nap_info = { localita: string[]; cantone: string };

const cache_cap = new Map<string, nap_info | null>();

/**
 * Località (una o più, in ordine alfabetico) e cantone per un CAP svizzero di 4 cifre.
 * È un aiuto: se la lettura fallisce restituisce null e chi chiama lascia i campi come sono.
 */
export async function cerca_nap(cap: string): Promise<nap_info | null> {
  const c = String(cap ?? "").trim();
  if (!/^\d{4}$/.test(c)) return null;
  if (cache_cap.has(c)) return cache_cap.get(c) ?? null;
  const { data, error } = await supabase
    .from("cap_svizzera")
    .select("localita, cantone")
    .eq("cap", c)
    .order("localita");
  if (error) {
    // Nessuna cache: al prossimo tentativo si riprova.
    console.warn("[cerca_nap]", error.message);
    return null;
  }
  const righe = data ?? [];
  const info: nap_info | null = righe.length
    ? { localita: righe.map((r) => r.localita), cantone: righe[0].cantone }
    : null;
  cache_cap.set(c, info);
  return info;
}
