// Renderer SVG generici per i moduli della Relazione del Presidente.
// Nessun dato di esempio: chi chiama passa solo dati veri; se non ci sono dati
// il modulo non viene nemmeno costruito (vedi moduli.ts).

export type FormatoValore = "numero" | "chf" | "percento" | "ore";

export interface PuntoSerie {
  etichetta: string;
  valore: number;
  valore2?: number;
}

export interface GraficoBarre {
  tipo: "barre";
  titolo: string;
  sottotitolo?: string;
  dati: PuntoSerie[];
  formato?: FormatoValore;
  etichetta_serie1?: string;
  etichetta_serie2?: string;
}

export interface GraficoLinea {
  tipo: "linea";
  titolo: string;
  sottotitolo?: string;
  dati: PuntoSerie[];
  formato?: FormatoValore;
}

export interface GraficoDonut {
  tipo: "donut";
  titolo: string;
  sottotitolo?: string;
  dati: PuntoSerie[];
  formato?: FormatoValore;
}

export interface GraficoTabella {
  tipo: "tabella";
  titolo: string;
  sottotitolo?: string;
  colonne: string[];
  righe: string[][];
  allinea_destra?: number[];
}

export type GraficoSpec = GraficoBarre | GraficoLinea | GraficoDonut | GraficoTabella;

const FONT_SERIF = "Times, 'Times New Roman', serif";
const FONT_SANS = "Helvetica, Arial, sans-serif";
const SFONDO = "#fefcf7";
const TESTO = "#1a1a1a";
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

function intestazione(titolo: string, sottotitolo: string | undefined): { svg: string; y: number } {
  let svg = `<text x="15" y="20" font-family="${FONT_SERIF}" font-size="14" font-weight="bold" fill="${TESTO}">${escapeXml(titolo)}</text>`;
  let y = 34;
  if (sottotitolo) {
    svg += `<text x="15" y="${y}" font-family="${FONT_SANS}" font-size="9" fill="${TESTO_TENUE}">${escapeXml(sottotitolo)}</text>`;
    y += 12;
  }
  return { svg, y };
}

function involucro(contenuto: string, h: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W_GRAFICO}" height="${h}" viewBox="0 0 ${W_GRAFICO} ${h}">
  <rect width="${W_GRAFICO}" height="${h}" fill="${SFONDO}"/>
  ${contenuto}
</svg>`;
}

// ── Barre orizzontali (una o due serie affiancate) ──────────────
function renderBarre(g: GraficoBarre, colore: string): { svg: string; w: number; h: number } {
  const testa = intestazione(g.titolo, g.sottotitolo);
  const doppia = g.dati.some((d) => typeof d.valore2 === "number");
  const altezza_riga = doppia ? 30 : 22;
  const spazio = 6;
  const top = testa.y + (doppia ? 18 : 8);
  const larghezza_etichetta = 118;
  const x0 = 15 + larghezza_etichetta;
  const larghezza_max = W_GRAFICO - x0 - 90;
  const massimo = Math.max(
    1,
    ...g.dati.map((d) => Math.max(d.valore, d.valore2 ?? 0)),
  );

  let corpo = "";
  if (doppia) {
    corpo += `<rect x="${x0}" y="${testa.y + 2}" width="9" height="9" fill="${colore}"/>`
      + `<text x="${x0 + 13}" y="${testa.y + 10}" font-family="${FONT_SANS}" font-size="8" fill="${TESTO_TENUE}">${escapeXml(g.etichetta_serie1 ?? "")}</text>`
      + `<rect x="${x0 + 110}" y="${testa.y + 2}" width="9" height="9" fill="${schiarisci(colore, 0.55)}"/>`
      + `<text x="${x0 + 123}" y="${testa.y + 10}" font-family="${FONT_SANS}" font-size="8" fill="${TESTO_TENUE}">${escapeXml(g.etichetta_serie2 ?? "")}</text>`;
  }

  g.dati.forEach((d, i) => {
    const y = top + i * (altezza_riga + spazio);
    const h1 = doppia ? 12 : 16;
    const w1 = Math.max(1, (d.valore / massimo) * larghezza_max);
    corpo += `<text x="15" y="${y + h1}" font-family="${FONT_SERIF}" font-size="10" fill="${TESTO}">${escapeXml(d.etichetta.slice(0, 26))}</text>`;
    corpo += `<rect x="${x0}" y="${y}" width="${w1}" height="${h1}" fill="${colore}" rx="2"/>`;
    corpo += `<text x="${x0 + w1 + 6}" y="${y + h1 - 2}" font-family="${FONT_SANS}" font-size="9" fill="${TESTO}">${escapeXml(formatta(d.valore, g.formato))}</text>`;
    if (doppia) {
      const w2 = Math.max(1, ((d.valore2 ?? 0) / massimo) * larghezza_max);
      const y2 = y + h1 + 2;
      corpo += `<rect x="${x0}" y="${y2}" width="${w2}" height="${h1}" fill="${schiarisci(colore, 0.55)}" rx="2"/>`;
      corpo += `<text x="${x0 + w2 + 6}" y="${y2 + h1 - 2}" font-family="${FONT_SANS}" font-size="9" fill="${TESTO_TENUE}">${escapeXml(formatta(d.valore2 ?? 0, g.formato))}</text>`;
    }
  });

  const h = top + g.dati.length * (altezza_riga + spazio) + 14;
  return { svg: involucro(testa.svg + corpo, h), w: W_GRAFICO, h };
}

// ── Linea ───────────────────────────────────────────────────────
function renderLinea(g: GraficoLinea, colore: string): { svg: string; w: number; h: number } {
  const testa = intestazione(g.titolo, g.sottotitolo);
  const h = 210;
  const padL = 20, padR = 20, padB = 34;
  const top = testa.y + 18;
  const larghezza = W_GRAFICO - padL - padR;
  const altezza = h - top - padB;
  const massimo = Math.max(1, ...g.dati.map((d) => d.valore));

  let griglia = "";
  for (let i = 0; i <= 2; i++) {
    const y = top + (i / 2) * altezza;
    griglia += `<line x1="${padL}" y1="${y}" x2="${padL + larghezza}" y2="${y}" stroke="${GRIGLIA}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
  }

  const punti = g.dati.map((d, i) => ({
    x: padL + (g.dati.length === 1 ? larghezza / 2 : (i / (g.dati.length - 1)) * larghezza),
    y: top + altezza - (d.valore / massimo) * altezza,
    d,
  }));
  const percorso = "M " + punti.map((p) => `${p.x} ${p.y}`).join(" L ");
  let marker = "";
  for (const p of punti) {
    marker += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${colore}" stroke="#ffffff" stroke-width="1.2"/>`
      + `<text x="${p.x}" y="${p.y - 9}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="9.5" font-weight="bold" fill="${TESTO}">${escapeXml(formatta(p.d.valore, g.formato))}</text>`
      + `<text x="${p.x}" y="${h - 12}" text-anchor="middle" font-family="${FONT_SANS}" font-size="8" fill="${TESTO_TENUE}">${escapeXml(p.d.etichetta.slice(0, 12))}</text>`;
  }

  const corpo = `${griglia}<path d="${percorso}" fill="none" stroke="${colore}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${marker}`;
  return { svg: involucro(testa.svg + corpo, h), w: W_GRAFICO, h };
}

// ── Donut ───────────────────────────────────────────────────────
function renderDonut(g: GraficoDonut, colore: string): { svg: string; w: number; h: number } {
  const testa = intestazione(g.titolo, g.sottotitolo);
  const voci = g.dati.filter((d) => d.valore > 0);
  const totale = voci.reduce((s, d) => s + d.valore, 0) || 1;
  const h = Math.max(200, testa.y + 20 + voci.length * 22 + 20);
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
    archi += `<path d="M ${x1} ${y1} A ${rEst} ${rEst} 0 ${grande} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInt} ${rInt} 0 ${grande} 0 ${x4} ${y4} Z" fill="${colori[i]}"/>`;
    angolo = fine;
  });

  const centro = `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="14" font-weight="bold" fill="${TESTO}">${escapeXml(formatta(totale, g.formato))}</text>`;

  let legenda = "";
  let ly = testa.y + 24;
  voci.forEach((v, i) => {
    const pct = Math.round((v.valore / totale) * 100);
    legenda += `<rect x="230" y="${ly}" width="10" height="10" fill="${colori[i]}" rx="1"/>`
      + `<text x="246" y="${ly + 9}" font-family="${FONT_SERIF}" font-size="10" fill="${TESTO}">${escapeXml(v.etichetta.slice(0, 22))}</text>`
      + `<text x="246" y="${ly + 20}" font-family="${FONT_SANS}" font-size="8" fill="${TESTO_TENUE}">${pct}% · ${escapeXml(formatta(v.valore, g.formato))}</text>`;
    ly += 26;
  });

  return { svg: involucro(testa.svg + archi + centro + legenda, h), w: W_GRAFICO, h };
}

// ── Tabella ─────────────────────────────────────────────────────
function renderTabella(g: GraficoTabella, colore: string): { svg: string; w: number; h: number } {
  const testa = intestazione(g.titolo, g.sottotitolo);
  const righe = g.righe;
  const top = testa.y + 12;
  const hRiga = 18;
  const h = top + 20 + righe.length * hRiga + 12;
  const ncol = g.colonne.length;
  const x0 = 15;
  const larghezza = W_GRAFICO - 30;
  const prima = ncol > 1 ? larghezza * 0.42 : larghezza;
  const altre = ncol > 1 ? (larghezza - prima) / (ncol - 1) : 0;
  const xdi = (i: number) => (i === 0 ? x0 : x0 + prima + (i - 1) * altre);

  let corpo = `<rect x="${x0}" y="${top}" width="${larghezza}" height="18" fill="${schiarisci(colore, 0.82)}"/>`;
  g.colonne.forEach((c, i) => {
    const destra = (g.allinea_destra ?? []).includes(i);
    const x = destra ? xdi(i) + altre - 6 : xdi(i) + 6;
    corpo += `<text x="${x}" y="${top + 13}" text-anchor="${destra ? "end" : "start"}" font-family="${FONT_SANS}" font-size="8.5" font-weight="bold" fill="${TESTO}">${escapeXml(c)}</text>`;
  });

  righe.forEach((r, ri) => {
    const y = top + 18 + ri * hRiga;
    if (ri % 2 === 1) corpo += `<rect x="${x0}" y="${y}" width="${larghezza}" height="${hRiga}" fill="#ffffff" opacity="0.6"/>`;
    r.forEach((cella, i) => {
      const destra = (g.allinea_destra ?? []).includes(i);
      const x = destra ? xdi(i) + altre - 6 : xdi(i) + 6;
      corpo += `<text x="${x}" y="${y + 13}" text-anchor="${destra ? "end" : "start"}" font-family="${FONT_SERIF}" font-size="9.5" fill="${TESTO}">${escapeXml(String(cella).slice(0, 34))}</text>`;
    });
    corpo += `<line x1="${x0}" y1="${y + hRiga}" x2="${x0 + larghezza}" y2="${y + hRiga}" stroke="${GRIGLIA}" stroke-width="0.4"/>`;
  });

  return { svg: involucro(testa.svg + corpo, h), w: W_GRAFICO, h };
}

export function renderGraficoSVG(spec: GraficoSpec, colore_primario: string): { svg: string; w: number; h: number } {
  const colore = /^#[0-9a-fA-F]{6}$/.test(colore_primario) ? colore_primario : "#14b8a6";
  switch (spec.tipo) {
    case "barre": return renderBarre(spec, colore);
    case "linea": return renderLinea(spec, colore);
    case "donut": return renderDonut(spec, colore);
    case "tabella": return renderTabella(spec, colore);
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
