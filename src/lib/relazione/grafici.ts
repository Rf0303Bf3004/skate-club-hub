// Renderer SVG generici per i moduli della Relazione del Presidente.
// Nessun dato di esempio: chi chiama passa solo dati veri; se non ci sono dati
// il modulo non viene nemmeno costruito (vedi moduli.ts).
//
// Regole di disegno (valgono per tutti i grafici):
//  - una sola scala verticale per grafico: due unità diverse = due grafici;
//  - con due serie: legenda sempre presente e seconda serie distinguibile anche
//    in bianco e nero (tratteggio), perché la relazione viene stampata;
//  - i valori non si scrivono su ogni punto: solo primo, ultimo e massimo;
//  - griglia e assi in grigio chiaro, dati in primo piano;
//  - barre sottili con estremi arrotondati;
//  - colore principale = colore del club, seconda serie = stessa tinta schiarita;
//  - i testi restano in grigio scuro, mai colorati come la serie;
//  - nessun testo tagliato: le etichette vanno a capo, mai i puntini.

export type FormatoValore = "numero" | "chf" | "percento" | "ore";

export interface PuntoSerie {
  etichetta: string;
  valore: number;
  valore2?: number;
}

export interface RiferimentoGrafico {
  valore: number;
  etichetta: string;
}

export interface GraficoBarre {
  tipo: "barre";
  titolo: string;
  sottotitolo?: string;
  dati: PuntoSerie[];
  formato?: FormatoValore;
  etichetta_serie1?: string;
  etichetta_serie2?: string;
  orientamento?: "orizzontale" | "verticale";
  impilate?: boolean;
  riferimento?: RiferimentoGrafico;
  didascalia?: string;
}

export interface GraficoLinea {
  tipo: "linea";
  titolo: string;
  sottotitolo?: string;
  dati: PuntoSerie[];
  formato?: FormatoValore;
  didascalia?: string;
}

export interface GraficoDonut {
  tipo: "donut";
  titolo: string;
  sottotitolo?: string;
  dati: PuntoSerie[];
  formato?: FormatoValore;
  didascalia?: string;
}

export interface GraficoTabella {
  tipo: "tabella";
  titolo: string;
  sottotitolo?: string;
  colonne: string[];
  righe: string[][];
  allinea_destra?: number[];
  didascalia?: string;
}

/** Riga di una classifica: le atlete del club sono evidenziate. */
export interface RigaResoconto {
  celle: string[];
  evidenzia?: boolean;
}

export interface TabellaResoconto {
  titolo: string;
  colonne: string[];
  righe: RigaResoconto[];
  allinea_destra?: number[];
  /** Colonna del nome: sull'evidenziata prende il colore del club. */
  colonna_nome?: number;
  sintesi?: string;
}

export interface BloccoGara {
  titolo: string;
  sottotitolo?: string;
  nota?: string;
  tabelle: TabellaResoconto[];
}

/** Resoconto gara per gara: una pagina per gara, disegnato nativamente. */
export interface GraficoResoconto {
  tipo: "resoconto";
  titolo: string;
  sottotitolo?: string;
  gare: BloccoGara[];
  didascalia?: string;
}

export type GraficoSpec =
  | GraficoBarre | GraficoLinea | GraficoDonut | GraficoTabella | GraficoResoconto;

const FONT_SERIF = "Times, 'Times New Roman', serif";
const FONT_SANS = "Helvetica, Arial, sans-serif";
const SFONDO = "#fefcf7";
const TESTO = "#1f2937";
const TESTO_TENUE = "#6b7280";
const GRIGLIA = "#e2e8f0";

export const W_GRAFICO = 460;

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function schiarisci(hex: string, quota: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const m = (c: number) => Math.round(c + (255 - c) * quota);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function formatta(valore: number, formato: FormatoValore = "numero"): string {
  if (!Number.isFinite(valore)) return "—";
  if (formato === "chf") return "CHF " + Math.round(valore).toLocaleString("de-CH").replace(/,/g, "'");
  if (formato === "percento") return Math.round(valore) + "%";
  if (formato === "ore") return new Intl.NumberFormat("it-CH", { maximumFractionDigits: 1 }).format(valore) + " h";
  return new Intl.NumberFormat("it-CH").format(Math.round(valore * 100) / 100);
}

/** Larghezza approssimata di un testo: basta per decidere dove andare a capo. */
function largo(testo: string, dimensione: number, serif = false): number {
  return String(testo ?? "").length * dimensione * (serif ? 0.47 : 0.52);
}

/**
 * Manda a capo sulle parole dentro la larghezza data. Una parola più lunga
 * della riga viene spezzata: mai fatta uscire dal margine, mai troncata.
 */
export function spezza(
  testo: string, larghezza: number, dimensione: number, serif = false, righe_max = 0,
): string[] {
  const parole = String(testo ?? "").trim().split(/\s+/).filter(Boolean);
  const righe: string[] = [];
  let cur = "";
  const spezza_parola = (p: string) => {
    let resto = p;
    while (largo(resto, dimensione, serif) > larghezza && resto.length > 1) {
      let taglio = 1;
      while (taglio < resto.length && largo(resto.slice(0, taglio + 1), dimensione, serif) <= larghezza) taglio++;
      righe.push(resto.slice(0, taglio));
      resto = resto.slice(taglio);
    }
    return resto;
  };
  for (const p of parole) {
    const prova = cur ? cur + " " + p : p;
    if (largo(prova, dimensione, serif) > larghezza && cur) {
      righe.push(cur);
      cur = largo(p, dimensione, serif) > larghezza ? spezza_parola(p) : p;
    } else if (largo(prova, dimensione, serif) > larghezza) {
      cur = spezza_parola(prova);
    } else {
      cur = prova;
    }
  }
  if (cur) righe.push(cur);
  if (righe.length === 0) return [""];
  // Il limite di righe serve solo dove lo spazio è fisico (etichette d'asse):
  // il testo residuo confluisce nell'ultima riga, non viene buttato via.
  if (righe_max > 0 && righe.length > righe_max) {
    const tenute = righe.slice(0, righe_max - 1);
    tenute.push(righe.slice(righe_max - 1).join(" "));
    return tenute;
  }
  return righe;
}

function testoMultiriga(
  righe: string[], x: number, y: number, dimensione: number,
  opz?: { serif?: boolean; colore?: string; ancora?: "start" | "middle" | "end"; grassetto?: boolean },
): string {
  const passo = dimensione + 2;
  return righe.map((r, i) =>
    `<text x="${x}" y="${y + i * passo}" text-anchor="${opz?.ancora ?? "start"}" font-family="${opz?.serif ? FONT_SERIF : FONT_SANS}" font-size="${dimensione}"${opz?.grassetto ? ' font-weight="bold"' : ""} fill="${opz?.colore ?? TESTO}">${escapeXml(r)}</text>`,
  ).join("");
}

function intestazione(titolo: string, sottotitolo: string | undefined): { svg: string; y: number } {
  const righe_titolo = spezza(titolo, W_GRAFICO - 30, 14, true);
  let svg = testoMultiriga(righe_titolo, 15, 20, 14, { serif: true, grassetto: true });
  let y = 20 + (righe_titolo.length - 1) * 16 + 14;
  if (sottotitolo) {
    const righe_sotto = spezza(sottotitolo, W_GRAFICO - 30, 9);
    svg += testoMultiriga(righe_sotto, 15, y, 9, { colore: TESTO_TENUE });
    y += righe_sotto.length * 11 + 2;
  }
  return { svg, y };
}

/** Didascalia in coda al grafico: dice cosa mostra, va a capo, non viene tagliata. */
function didascaliaSvg(testo: string | undefined, y: number): { svg: string; h: number } {
  if (!testo?.trim()) return { svg: "", h: 0 };
  const righe = spezza(testo, W_GRAFICO - 30, 9, true);
  return {
    svg: testoMultiriga(righe, 15, y + 11, 9, { serif: true, colore: TESTO_TENUE }),
    h: righe.length * 11 + 8,
  };
}

const TRATTEGGIO_ID = "tratteggio_serie2";
function definizioni(colore2: string): string {
  return `<defs><pattern id="${TRATTEGGIO_ID}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="5" height="5" fill="${colore2}"/>`
    + `<line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" stroke-width="1.6"/></pattern></defs>`;
}

function legenda(x: number, y: number, e1: string, e2: string, colore: string, colore2: string): string {
  const l1 = Math.max(60, largo(e1, 8) + 16);
  return `<rect x="${x}" y="${y}" width="9" height="9" rx="1.5" fill="${colore}"/>`
    + `<text x="${x + 13}" y="${y + 8}" font-family="${FONT_SANS}" font-size="8" fill="${TESTO}">${escapeXml(e1)}</text>`
    + `<rect x="${x + l1}" y="${y}" width="9" height="9" rx="1.5" fill="url(#${TRATTEGGIO_ID})" stroke="${colore2}" stroke-width="0.6"/>`
    + `<text x="${x + l1 + 13}" y="${y + 8}" font-family="${FONT_SANS}" font-size="8" fill="${TESTO}">${escapeXml(e2)}</text>`;
}

function involucro(contenuto: string, h: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W_GRAFICO}" height="${h}" viewBox="0 0 ${W_GRAFICO} ${h}">
  <rect width="${W_GRAFICO}" height="${h}" fill="${SFONDO}"/>
  ${contenuto}
</svg>`;
}

/** Indici dei punti da etichettare: primo, ultimo e massimo. */
function indiciDaEtichettare(valori: number[]): Set<number> {
  if (valori.length === 0) return new Set();
  let max = 0;
  valori.forEach((v, i) => { if (v > valori[max]) max = i; });
  return new Set([0, valori.length - 1, max]);
}

// ── Barre orizzontali ───────────────────────────────────────────
function renderBarreOrizzontali(g: GraficoBarre, colore: string): { svg: string; w: number; h: number } {
  const colore2 = schiarisci(colore, 0.55);
  const testa = intestazione(g.titolo, g.sottotitolo);
  const doppia = g.dati.some((d) => typeof d.valore2 === "number");
  const impilate = doppia && g.impilate === true;
  let y = testa.y + 6;
  let corpo = "";
  if (doppia) {
    corpo += legenda(15, y, g.etichetta_serie1 ?? "", g.etichetta_serie2 ?? "", colore, colore2);
    y += 18;
  }

  const larghezza_etichetta = 132;
  const x0 = 15 + larghezza_etichetta;
  const larghezza_max = W_GRAFICO - x0 - 96;
  const massimo = Math.max(
    1,
    g.riferimento?.valore ?? 0,
    ...g.dati.map((d) => (impilate ? d.valore + (d.valore2 ?? 0) : Math.max(d.valore, d.valore2 ?? 0))),
  );
  const alt_barra = 10;
  const top_barre = y;

  const righe_etichette = g.dati.map((d) => spezza(d.etichetta, larghezza_etichetta - 8, 9, true, 2));
  const altezze = righe_etichette.map((r, i) => {
    const alt_testo = r.length * 11;
    const alt_dati = doppia && !impilate ? alt_barra * 2 + 4 : alt_barra;
    return Math.max(alt_testo, alt_dati) + 10;
  });

  g.dati.forEach((d, i) => {
    const y_riga = top_barre + altezze.slice(0, i).reduce((s, a) => s + a, 0);
    corpo += testoMultiriga(righe_etichette[i], 15, y_riga + 9, 9, { serif: true });
    const w1 = Math.max(2, (d.valore / massimo) * larghezza_max);
    if (impilate) {
      const w2 = Math.max(0, ((d.valore2 ?? 0) / massimo) * larghezza_max);
      corpo += `<rect x="${x0}" y="${y_riga}" width="${w1}" height="${alt_barra}" fill="${colore}" rx="${alt_barra / 2}"/>`;
      if (w2 > 0) corpo += `<rect x="${x0 + w1 + 1}" y="${y_riga}" width="${w2}" height="${alt_barra}" fill="url(#${TRATTEGGIO_ID})" stroke="${colore2}" stroke-width="0.5" rx="${alt_barra / 2}"/>`;
      const testo = `${formatta(d.valore, g.formato)} / ${formatta(d.valore2 ?? 0, g.formato)}`;
      corpo += `<text x="${x0 + w1 + w2 + 8}" y="${y_riga + alt_barra - 1}" font-family="${FONT_SANS}" font-size="8.5" fill="${TESTO}">${escapeXml(testo)}</text>`;
    } else {
      corpo += `<rect x="${x0}" y="${y_riga}" width="${w1}" height="${alt_barra}" fill="${colore}" rx="${alt_barra / 2}"/>`;
      corpo += `<text x="${x0 + w1 + 8}" y="${y_riga + alt_barra - 1}" font-family="${FONT_SANS}" font-size="9" fill="${TESTO}">${escapeXml(formatta(d.valore, g.formato))}</text>`;
      if (doppia) {
        const w2 = Math.max(2, ((d.valore2 ?? 0) / massimo) * larghezza_max);
        const y2 = y_riga + alt_barra + 4;
        corpo += `<rect x="${x0}" y="${y2}" width="${w2}" height="${alt_barra}" fill="url(#${TRATTEGGIO_ID})" stroke="${colore2}" stroke-width="0.5" rx="${alt_barra / 2}"/>`;
        corpo += `<text x="${x0 + w2 + 8}" y="${y2 + alt_barra - 1}" font-family="${FONT_SANS}" font-size="9" fill="${TESTO}">${escapeXml(formatta(d.valore2 ?? 0, g.formato))}</text>`;
      }
    }
  });

  const alt_totale = altezze.reduce((s, a) => s + a, 0);
  // Asse e linea di riferimento: grigio chiaro, dietro ai dati.
  let sfondo = `<line x1="${x0}" y1="${top_barre - 4}" x2="${x0}" y2="${top_barre + alt_totale}" stroke="${GRIGLIA}" stroke-width="0.8"/>`;
  let coda = "";
  if (g.riferimento) {
    const xr = x0 + (g.riferimento.valore / massimo) * larghezza_max;
    sfondo += `<line x1="${xr}" y1="${top_barre - 6}" x2="${xr}" y2="${top_barre + alt_totale}" stroke="${TESTO_TENUE}" stroke-width="0.8" stroke-dasharray="3 3"/>`;
    coda += `<text x="${xr}" y="${top_barre - 9}" text-anchor="middle" font-family="${FONT_SANS}" font-size="8" fill="${TESTO_TENUE}">${escapeXml(g.riferimento.etichetta)}</text>`;
  }

  const y_fine = top_barre + alt_totale + 6;
  const dida = didascaliaSvg(g.didascalia, y_fine);
  const h = y_fine + dida.h + 8;
  return {
    svg: involucro(definizioni(colore2) + testa.svg + sfondo + corpo + coda + dida.svg, h),
    w: W_GRAFICO, h,
  };
}

// ── Barre verticali ─────────────────────────────────────────────
function renderBarreVerticali(g: GraficoBarre, colore: string): { svg: string; w: number; h: number } {
  const colore2 = schiarisci(colore, 0.55);
  const testa = intestazione(g.titolo, g.sottotitolo);
  const doppia = g.dati.some((d) => typeof d.valore2 === "number");
  let top = testa.y + 6;
  let corpo = "";
  if (doppia) {
    corpo += legenda(15, top, g.etichetta_serie1 ?? "", g.etichetta_serie2 ?? "", colore, colore2);
    top += 18;
  }
  top += 14; // spazio per i valori etichettati sopra le barre

  const padL = 22, padR = 18;
  const larghezza = W_GRAFICO - padL - padR;
  const alt_grafico = 150;
  const base = top + alt_grafico;
  const massimo = Math.max(1, ...g.dati.map((d) => Math.max(d.valore, d.valore2 ?? 0)));
  const passo = larghezza / Math.max(1, g.dati.length);
  const spessore = Math.max(3, Math.min(14, passo * (doppia ? 0.32 : 0.5)));

  let griglia = "";
  for (let i = 0; i <= 2; i++) {
    const yg = top + (i / 2) * alt_grafico;
    griglia += `<line x1="${padL}" y1="${yg}" x2="${padL + larghezza}" y2="${yg}" stroke="${GRIGLIA}" stroke-width="0.5"/>`;
  }
  griglia += `<line x1="${padL}" y1="${base}" x2="${padL + larghezza}" y2="${base}" stroke="${GRIGLIA}" stroke-width="0.9"/>`;

  const etichettati = indiciDaEtichettare(g.dati.map((d) => d.valore));
  // Etichette dell'asse: si mostrano solo quelle che non si sovrappongono.
  const passo_etichette = Math.max(1, Math.ceil(largo("00-00", 7.5) / passo));
  let alt_etichette = 0;

  g.dati.forEach((d, i) => {
    const cx = padL + i * passo + passo / 2;
    const h1 = Math.max(1, (d.valore / massimo) * alt_grafico);
    const x1 = doppia ? cx - spessore - 1 : cx - spessore / 2;
    corpo += `<rect x="${x1}" y="${base - h1}" width="${spessore}" height="${h1}" fill="${colore}" rx="${Math.min(3, spessore / 2)}"/>`;
    if (doppia) {
      const h2 = Math.max(1, ((d.valore2 ?? 0) / massimo) * alt_grafico);
      corpo += `<rect x="${cx + 1}" y="${base - h2}" width="${spessore}" height="${h2}" fill="url(#${TRATTEGGIO_ID})" stroke="${colore2}" stroke-width="0.5" rx="${Math.min(3, spessore / 2)}"/>`;
    }
    if (etichettati.has(i)) {
      corpo += `<text x="${cx}" y="${base - h1 - 5}" text-anchor="middle" font-family="${FONT_SANS}" font-size="8.5" fill="${TESTO}">${escapeXml(formatta(d.valore, g.formato))}</text>`;
    }
    if (i % passo_etichette === 0) {
      const righe = spezza(d.etichetta, Math.max(28, passo * passo_etichette), 7.5, false, 2);
      corpo += testoMultiriga(righe, cx, base + 11, 7.5, { ancora: "middle", colore: TESTO_TENUE });
      alt_etichette = Math.max(alt_etichette, righe.length * 9.5);
    }
  });

  const y_fine = base + 12 + alt_etichette;
  const dida = didascaliaSvg(g.didascalia, y_fine);
  const h = y_fine + dida.h + 8;
  return {
    svg: involucro(definizioni(colore2) + testa.svg + griglia + corpo + dida.svg, h),
    w: W_GRAFICO, h,
  };
}

function renderBarre(g: GraficoBarre, colore: string) {
  return g.orientamento === "verticale"
    ? renderBarreVerticali(g, colore)
    : renderBarreOrizzontali(g, colore);
}

// ── Linea ───────────────────────────────────────────────────────
function renderLinea(g: GraficoLinea, colore: string): { svg: string; w: number; h: number } {
  const testa = intestazione(g.titolo, g.sottotitolo);
  const padL = 22, padR = 22;
  const top = testa.y + 22;
  const alt_grafico = 140;
  const larghezza = W_GRAFICO - padL - padR;
  const massimo = Math.max(1, ...g.dati.map((d) => d.valore));

  let griglia = "";
  for (let i = 0; i <= 2; i++) {
    const yg = top + (i / 2) * alt_grafico;
    griglia += `<line x1="${padL}" y1="${yg}" x2="${padL + larghezza}" y2="${yg}" stroke="${GRIGLIA}" stroke-width="0.5"/>`;
  }

  const punti = g.dati.map((d, i) => ({
    x: padL + (g.dati.length === 1 ? larghezza / 2 : (i / (g.dati.length - 1)) * larghezza),
    y: top + alt_grafico - (d.valore / massimo) * alt_grafico,
    d,
  }));
  const percorso = "M " + punti.map((p) => `${p.x} ${p.y}`).join(" L ");
  const etichettati = indiciDaEtichettare(g.dati.map((d) => d.valore));
  const passo = larghezza / Math.max(1, g.dati.length);
  const passo_etichette = Math.max(1, Math.ceil(largo("2026/2027", 7.5) / Math.max(1, passo)));
  let alt_etichette = 0;
  let marker = "";
  punti.forEach((p, i) => {
    marker += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${colore}" stroke="#ffffff" stroke-width="1.2"/>`;
    if (etichettati.has(i)) {
      marker += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-family="${FONT_SANS}" font-size="8.5" fill="${TESTO}">${escapeXml(formatta(p.d.valore, g.formato))}</text>`;
    }
    if (i % passo_etichette === 0 || i === punti.length - 1) {
      const righe = spezza(p.d.etichetta, Math.max(40, passo * passo_etichette), 7.5, false, 2);
      marker += testoMultiriga(righe, p.x, top + alt_grafico + 14, 7.5, { ancora: "middle", colore: TESTO_TENUE });
      alt_etichette = Math.max(alt_etichette, righe.length * 9.5);
    }
  });

  const y_fine = top + alt_grafico + 16 + alt_etichette;
  const dida = didascaliaSvg(g.didascalia, y_fine);
  const h = y_fine + dida.h + 8;
  const corpo = `${griglia}<line x1="${padL}" y1="${top + alt_grafico}" x2="${padL + larghezza}" y2="${top + alt_grafico}" stroke="${GRIGLIA}" stroke-width="0.9"/>`
    + `<path d="${percorso}" fill="none" stroke="${colore}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${marker}`;
  return { svg: involucro(testa.svg + corpo + dida.svg, h), w: W_GRAFICO, h };
}

// ── Donut ───────────────────────────────────────────────────────
function renderDonut(g: GraficoDonut, colore: string): { svg: string; w: number; h: number } {
  const testa = intestazione(g.titolo, g.sottotitolo);
  const voci = g.dati.filter((d) => d.valore > 0);
  const totale = voci.reduce((s, d) => s + d.valore, 0) || 1;
  const cx = 110, cy = testa.y + 100;
  const rEst = 72, rInt = 44;

  const colori = voci.map((_, i) => schiarisci(colore, Math.min(0.72, i * (0.7 / Math.max(1, voci.length - 1)))));
  let archi = "";
  let angolo = -Math.PI / 2;
  voci.forEach((v, i) => {
    const ampiezza = (v.valore / totale) * 2 * Math.PI;
    const fine = angolo + ampiezza;
    const grande = ampiezza > Math.PI ? 1 : 0;
    const x1 = cx + rEst * Math.cos(angolo), y1 = cy + rEst * Math.sin(angolo);
    const x2 = cx + rEst * Math.cos(fine), y2 = cy + rEst * Math.sin(fine);
    const x3 = cx + rInt * Math.cos(fine), y3 = cy + rInt * Math.sin(fine);
    const x4 = cx + rInt * Math.cos(angolo), y4 = cy + rInt * Math.sin(angolo);
    archi += `<path d="M ${x1} ${y1} A ${rEst} ${rEst} 0 ${grande} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInt} ${rInt} 0 ${grande} 0 ${x4} ${y4} Z" fill="${colori[i]}" stroke="${SFONDO}" stroke-width="0.8"/>`;
    angolo = fine;
  });

  const centro = `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="14" font-weight="bold" fill="${TESTO}">${escapeXml(formatta(totale, g.formato))}</text>`;

  let legenda_voci = "";
  let ly = testa.y + 24;
  voci.forEach((v, i) => {
    const pct = Math.round((v.valore / totale) * 100);
    const righe = spezza(v.etichetta, W_GRAFICO - 262, 9.5, true, 2);
    legenda_voci += `<rect x="230" y="${ly}" width="10" height="10" fill="${colori[i]}" rx="1.5"/>`
      + testoMultiriga(righe, 246, ly + 9, 9.5, { serif: true })
      + `<text x="246" y="${ly + 9 + righe.length * 11}" font-family="${FONT_SANS}" font-size="8" fill="${TESTO_TENUE}">${pct}% · ${escapeXml(formatta(v.valore, g.formato))}</text>`;
    ly += righe.length * 11 + 18;
  });

  const y_fine = Math.max(ly, cy + rEst + 12);
  const dida = didascaliaSvg(g.didascalia, y_fine);
  const h = y_fine + dida.h + 10;
  return { svg: involucro(testa.svg + archi + centro + legenda_voci + dida.svg, h), w: W_GRAFICO, h };
}

// ── Tabella ─────────────────────────────────────────────────────
// Nel PDF le tabelle sono disegnate direttamente (con a capo nelle celle e
// continuazione di pagina): questo renderer serve solo dove serve un'immagine.
function renderTabella(g: GraficoTabella, colore: string): { svg: string; w: number; h: number } {
  const testa = intestazione(g.titolo, g.sottotitolo);
  const top = testa.y + 12;
  const ncol = g.colonne.length;
  const x0 = 15;
  const larghezza = W_GRAFICO - 30;
  const prima = ncol > 1 ? larghezza * 0.36 : larghezza;
  const altre = ncol > 1 ? (larghezza - prima) / (ncol - 1) : 0;
  const xdi = (i: number) => (i === 0 ? x0 : x0 + prima + (i - 1) * altre);
  const wdi = (i: number) => (i === 0 ? prima : altre);

  let corpo = `<rect x="${x0}" y="${top}" width="${larghezza}" height="18" fill="${schiarisci(colore, 0.82)}"/>`;
  g.colonne.forEach((c, i) => {
    const destra = (g.allinea_destra ?? []).includes(i);
    const x = destra ? xdi(i) + wdi(i) - 6 : xdi(i) + 6;
    corpo += `<text x="${x}" y="${top + 13}" text-anchor="${destra ? "end" : "start"}" font-family="${FONT_SANS}" font-size="8.5" font-weight="bold" fill="${TESTO}">${escapeXml(c)}</text>`;
  });

  let y = top + 18;
  g.righe.forEach((r, ri) => {
    const celle = r.map((cella, i) => spezza(String(cella), wdi(i) - 12, 9.5, true));
    const alt = Math.max(18, ...celle.map((c) => c.length * 11 + 7));
    if (ri % 2 === 1) corpo += `<rect x="${x0}" y="${y}" width="${larghezza}" height="${alt}" fill="#ffffff" opacity="0.6"/>`;
    celle.forEach((righe_cella, i) => {
      const destra = (g.allinea_destra ?? []).includes(i);
      const x = destra ? xdi(i) + wdi(i) - 6 : xdi(i) + 6;
      corpo += testoMultiriga(righe_cella, x, y + 12, 9.5, { serif: true, ancora: destra ? "end" : "start" });
    });
    y += alt;
    corpo += `<line x1="${x0}" y1="${y}" x2="${x0 + larghezza}" y2="${y}" stroke="${GRIGLIA}" stroke-width="0.4"/>`;
  });

  const dida = didascaliaSvg(g.didascalia, y + 4);
  const h = y + 12 + dida.h;
  return { svg: involucro(testa.svg + corpo + dida.svg, h), w: W_GRAFICO, h };
}

export function renderGraficoSVG(spec: GraficoSpec, colore_primario: string): { svg: string; w: number; h: number } {
  const colore = /^#[0-9a-fA-F]{6}$/.test(colore_primario) ? colore_primario : "#14b8a6";
  switch (spec.tipo) {
    case "barre": return renderBarre(spec, colore);
    case "linea": return renderLinea(spec, colore);
    case "donut": return renderDonut(spec, colore);
    case "tabella": return renderTabella(spec, colore);
    // Il resoconto gara per gara non è un'immagine: si disegna nativamente nel
    // PDF e in HTML nell'anteprima (una pagina per gara, righe evidenziate).
    case "resoconto": {
      const testa = intestazione(spec.titolo, spec.sottotitolo);
      const h = testa.y + 12;
      return { svg: involucro(testa.svg, h), w: W_GRAFICO, h };
    }
  }
}

// ── SVG -> PNG (solo browser) ───────────────────────────────────
export async function svgToPngBytes(svg: string, width: number, height: number, scala = 2): Promise<Uint8Array> {
  if (typeof document === "undefined") {
    throw new Error("La conversione dei grafici richiede il browser.");
  }
  const { Canvg } = await import("canvg");
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scala);
  canvas.height = Math.round(height * scala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Non è stato possibile disegnare il grafico: contesto grafico non disponibile.");
  ctx.fillStyle = SFONDO;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scala, scala);
  const v = await Canvg.fromString(ctx, svg, { ignoreDimensions: true });
  v.resize(width, height, "xMidYMid meet");
  await v.render();
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
