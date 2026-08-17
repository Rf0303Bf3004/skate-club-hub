/**
 * Coordinate approssimative (centroidi) per regioni e province note.
 * Non serve precisione al metro: servono solo a posizionare il pin nella zona giusta.
 * Nessun geocoding esterno: lookup statico per nome normalizzato.
 */

export type coordinate = { lat: number; lng: number };

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Centroidi per provincia / città principale. */
const PROVINCE_COORD: Record<string, coordinate> = {
  // Svizzera
  lugano: { lat: 46.0037, lng: 8.9511 },
  bellinzona: { lat: 46.1946, lng: 9.0245 },
  locarno: { lat: 46.1712, lng: 8.7994 },
  mendrisio: { lat: 45.8697, lng: 8.9819 },
  sion: { lat: 46.2331, lng: 7.3606 },
  briga: { lat: 46.3167, lng: 7.9878 },
  monthey: { lat: 46.2547, lng: 6.9541 },
  coira: { lat: 46.8508, lng: 9.532 },
  davos: { lat: 46.8027, lng: 9.8360 },
  engadina: { lat: 46.4983, lng: 9.8383 },
  losanna: { lat: 46.5197, lng: 6.6323 },
  montreux: { lat: 46.4312, lng: 6.9107 },
  nyon: { lat: 46.3833, lng: 6.2394 },
  zurigo: { lat: 47.3769, lng: 8.5417 },
  winterthur: { lat: 47.5001, lng: 8.7501 },
  berna: { lat: 46.948, lng: 7.4474 },
  thun: { lat: 46.758, lng: 7.6280 },
  interlaken: { lat: 46.6863, lng: 7.8632 },
  ginevra: { lat: 46.2044, lng: 6.1432 },
  // Italia
  milano: { lat: 45.4642, lng: 9.19 },
  bergamo: { lat: 45.6983, lng: 9.6773 },
  brescia: { lat: 45.5416, lng: 10.2118 },
  como: { lat: 45.8081, lng: 9.0852 },
  varese: { lat: 45.8206, lng: 8.8251 },
  sondrio: { lat: 46.1699, lng: 9.8797 },
  torino: { lat: 45.0703, lng: 7.6869 },
  cuneo: { lat: 44.3841, lng: 7.5426 },
  novara: { lat: 45.4469, lng: 8.6216 },
  asti: { lat: 44.9009, lng: 8.2065 },
  firenze: { lat: 43.7696, lng: 11.2558 },
  siena: { lat: 43.3188, lng: 11.3308 },
  grosseto: { lat: 42.7635, lng: 11.1128 },
  pisa: { lat: 43.7228, lng: 10.4017 },
  lucca: { lat: 43.8430, lng: 10.5079 },
  venezia: { lat: 45.4408, lng: 12.3155 },
  verona: { lat: 45.4384, lng: 10.9916 },
  padova: { lat: 45.4064, lng: 11.8768 },
  treviso: { lat: 45.6669, lng: 12.2431 },
  belluno: { lat: 46.1404, lng: 12.2158 },
  trento: { lat: 46.0679, lng: 11.1211 },
  bolzano: { lat: 46.4983, lng: 11.3548 },
  bologna: { lat: 44.4949, lng: 11.3426 },
  modena: { lat: 44.6471, lng: 10.9252 },
  rimini: { lat: 44.0678, lng: 12.5695 },
  parma: { lat: 44.8015, lng: 10.3279 },
  roma: { lat: 41.9028, lng: 12.4964 },
  latina: { lat: 41.4676, lng: 12.9037 },
  viterbo: { lat: 42.4175, lng: 12.1067 },
  // Grecia
  atene: { lat: 37.9838, lng: 23.7275 },
  pireo: { lat: 37.9420, lng: 23.6465 },
  chania: { lat: 35.5138, lng: 24.018 },
  heraklion: { lat: 35.3387, lng: 25.1442 },
  kalamata: { lat: 37.0389, lng: 22.1142 },
  nafplio: { lat: 37.5675, lng: 22.8028 },
  corfu: { lat: 39.6243, lng: 19.9217 },
  zante: { lat: 37.7870, lng: 20.8990 },
};

/** Centroidi per regione. */
const REGIONI_COORD: Record<string, coordinate> = {
  ticino: { lat: 46.3317, lng: 8.8005 },
  vallese: { lat: 46.2, lng: 7.6 },
  grigioni: { lat: 46.66, lng: 9.6 },
  vaud: { lat: 46.57, lng: 6.55 },
  zurigo: { lat: 47.41, lng: 8.65 },
  berna: { lat: 46.85, lng: 7.62 },
  ginevra: { lat: 46.21, lng: 6.14 },
  lombardia: { lat: 45.58, lng: 9.93 },
  piemonte: { lat: 45.05, lng: 7.9 },
  toscana: { lat: 43.42, lng: 11.15 },
  veneto: { lat: 45.55, lng: 11.9 },
  "trentino-alto adige": { lat: 46.35, lng: 11.3 },
  "emilia-romagna": { lat: 44.6, lng: 11.2 },
  lazio: { lat: 41.9, lng: 12.6 },
  attica: { lat: 38.05, lng: 23.75 },
  creta: { lat: 35.24, lng: 24.81 },
  peloponneso: { lat: 37.4, lng: 22.3 },
  "isole ionie": { lat: 38.6, lng: 20.7 },
};

/** Centroidi per nazione (fallback ultimo). */
const NAZIONI_COORD: Record<string, coordinate> = {
  svizzera: { lat: 46.8, lng: 8.23 },
  italia: { lat: 42.5, lng: 12.5 },
  grecia: { lat: 38.5, lng: 23.5 },
  francia: { lat: 46.6, lng: 2.4 },
  germania: { lat: 51.1, lng: 10.4 },
  austria: { lat: 47.6, lng: 14.1 },
};

/**
 * Risolve una coordinata approssimativa a partire da provincia/città → regione → nazione.
 * Restituisce null se nessun livello è noto.
 */
export function risolvi_coordinata(opts: {
  provincia?: string | null;
  citta?: string | null;
  regione?: string | null;
  nazione?: string | null;
}): coordinate | null {
  const p = norm(opts.provincia);
  if (p && PROVINCE_COORD[p]) return PROVINCE_COORD[p];
  const c = norm(opts.citta);
  if (c && PROVINCE_COORD[c]) return PROVINCE_COORD[c];
  const r = norm(opts.regione);
  if (r && REGIONI_COORD[r]) return REGIONI_COORD[r];
  const n = norm(opts.nazione);
  if (n && NAZIONI_COORD[n]) return NAZIONI_COORD[n];
  return null;
}

/** Piccolo jitter deterministico per evitare pin perfettamente sovrapposti. */
export function scosta_coordinata(base: coordinate, seed: string): coordinate {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 10007;
  const dx = ((h % 100) / 100 - 0.5) * 0.05;
  const dy = (((h / 100) % 100) / 100 - 0.5) * 0.05;
  return { lat: base.lat + dy, lng: base.lng + dx };
}
