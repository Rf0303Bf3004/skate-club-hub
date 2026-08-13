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

// ─── Suggerimento Città / Cantone dal NAP (CAP svizzero) ────────────────

export type nap_info = { citta: string; cantone: string };

// Cache locale dei NAP più usati (Ticino e dintorni): risposta immediata, zero rete.
const NAP_LOCALI: Record<string, nap_info> = {
  "6500": { citta: "Bellinzona", cantone: "TI" },
  "6512": { citta: "Giubiasco", cantone: "TI" },
  "6513": { citta: "Monte Carasso", cantone: "TI" },
  "6528": { citta: "Camorino", cantone: "TI" },
  "6534": { citta: "San Vittore", cantone: "GR" },
  "6600": { citta: "Locarno", cantone: "TI" },
  "6612": { citta: "Ascona", cantone: "TI" },
  "6616": { citta: "Losone", cantone: "TI" },
  "6648": { citta: "Minusio", cantone: "TI" },
  "6652": { citta: "Tegna", cantone: "TI" },
  "6710": { citta: "Biasca", cantone: "TI" },
  "6742": { citta: "Pollegio", cantone: "TI" },
  "6760": { citta: "Faido", cantone: "TI" },
  "6780": { citta: "Airolo", cantone: "TI" },
  "6803": { citta: "Camignolo", cantone: "TI" },
  "6807": { citta: "Taverne", cantone: "TI" },
  "6814": { citta: "Cadempino", cantone: "TI" },
  "6815": { citta: "Melide", cantone: "TI" },
  "6828": { citta: "Balerna", cantone: "TI" },
  "6830": { citta: "Chiasso", cantone: "TI" },
  "6850": { citta: "Mendrisio", cantone: "TI" },
  "6855": { citta: "Stabio", cantone: "TI" },
  "6900": { citta: "Lugano", cantone: "TI" },
  "6928": { citta: "Manno", cantone: "TI" },
  "6932": { citta: "Breganzona", cantone: "TI" },
  "6942": { citta: "Savosa", cantone: "TI" },
  "6944": { citta: "Cureglia", cantone: "TI" },
  "6952": { citta: "Canobbio", cantone: "TI" },
  "6962": { citta: "Viganello", cantone: "TI" },
  "6963": { citta: "Pregassona", cantone: "TI" },
  "6965": { citta: "Cadro", cantone: "TI" },
  "6976": { citta: "Castagnola", cantone: "TI" },
  "8001": { citta: "Zurigo", cantone: "ZH" },
  "3000": { citta: "Berna", cantone: "BE" },
  "4000": { citta: "Basilea", cantone: "BS" },
  "1200": { citta: "Ginevra", cantone: "GE" },
  "1000": { citta: "Losanna", cantone: "VD" },
  "7000": { citta: "Coira", cantone: "GR" },
  "9000": { citta: "San Gallo", cantone: "SG" },
  "6000": { citta: "Lucerna", cantone: "LU" },
};

const cache_remota = new Map<string, nap_info | null>();

/**
 * Restituisce città e cantone per un NAP svizzero (4 cifre).
 * Prima consulta la tabella locale, poi (se serve) il servizio pubblico zippopotam.
 */
export async function cerca_nap(cap: string): Promise<nap_info | null> {
  const c = String(cap ?? "").trim();
  if (!/^\d{4}$/.test(c)) return null;
  if (NAP_LOCALI[c]) return NAP_LOCALI[c];
  if (cache_remota.has(c)) return cache_remota.get(c) ?? null;
  try {
    const res = await fetch(`https://api.zippopotam.us/ch/${c}`);
    if (!res.ok) {
      cache_remota.set(c, null);
      return null;
    }
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) {
      cache_remota.set(c, null);
      return null;
    }
    const info: nap_info = {
      citta: capitalizza_nome(place["place name"] ?? ""),
      cantone: String(place["state abbreviation"] ?? "").toUpperCase(),
    };
    cache_remota.set(c, info);
    return info;
  } catch {
    cache_remota.set(c, null);
    return null;
  }
}
