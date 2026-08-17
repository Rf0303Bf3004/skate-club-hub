/** Riconoscimento tipologia area di mercato (alloggio vs ristorazione). */

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase();

/** Aree in cui ha senso il numero di stelle (hotel / alloggio / viaggi). */
export function e_area_alloggio(nome_area: string | null | undefined): boolean {
  const n = norm(nome_area);
  return ["viagg", "hotel", "albergh", "allogg", "soggiorn"].some((k) => n.includes(k));
}

/** Aree ristorazione. */
export function e_area_ristorazione(nome_area: string | null | undefined): boolean {
  const n = norm(nome_area);
  return ["ristor", "bar", "cucina", "food"].some((k) => n.includes(k));
}

export const TIPI_CUCINA = [
  "Italiana",
  "Pizzeria",
  "Pesce",
  "Carne e grill",
  "Etnica",
  "Fine dining",
  "Vegetariana",
  "Bar e caffetteria",
] as const;

export const FASCE_PREZZO = ["€", "€€", "€€€"] as const;
