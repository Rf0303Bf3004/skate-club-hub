// Colore stabile per ogni club dentro un campo inter-club.
// L'assegnazione segue l'ordine di invito (riga più vecchia = primo colore),
// così il colore è identico in ogni punto della scheda e nelle stampe.

/** Il club ospitante ha sempre il proprio colore, distinto dagli ospiti. */
export const COLORE_CLUB_OSPITANTE = "#1D4ED8";

/** Tavolozza fissa, tinte medie leggibili sia in chiaro sia in scuro. */
export const PALETTE_CLUB_CAMPO = [
  "#0F766E",
  "#B45309",
  "#7C3AED",
  "#BE185D",
  "#0369A1",
  "#4D7C0F",
  "#B91C1C",
  "#0891B2",
];

export function colore_club_per_indice(indice: number): string {
  if (indice < 0) return COLORE_CLUB_OSPITANTE;
  return PALETTE_CLUB_CAMPO[indice % PALETTE_CLUB_CAMPO.length];
}

/** Pastiglia tenue: sfondo trasparente del colore, testo dello stesso colore. */
export function stile_pastiglia_club(colore: string): React.CSSProperties {
  return {
    borderLeft: `3px solid ${colore}`,
    backgroundColor: `${colore}1F`,
    color: colore,
  };
}
