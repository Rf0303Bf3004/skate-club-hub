import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage, degrees } from "pdf-lib";
import { fetchParagrafiForPdf, type Tono } from "@/lib/paragraphGenerator";
import { fetchKpiData, type KpiData, type KpiCell } from "@/lib/kpiData";
import {
  fetchChartData,
  generatePiramideAtletiSVG,
  generateDonutRicaviSVG,
  generateSparklinePodiSVG,
  generateHeatmapFasceSVG,
  generateBarTariffeSVG,
  svgToPngBytes,
  type ChartData,
} from "@/lib/pdfCharts";

// ============================================================
// Tipi
// ============================================================

export interface GenerateRelazioneParams {
  club: { nome?: string; citta?: string } | null;
  presidente: string;
  stagione_nome: string;
  club_id?: string;
  stagione_id?: string;
  tono?: Tono;
  // Items già ordinati e filtrati (solo attivi)
  items: Array<{
    id: string;
    kind: "sistema" | "area" | "blocco" | "allegato";
    sezione_id?: string;
    titolo: string;
    payload?: any;
  }>;
}

// ============================================================
// Costanti grafiche
// ============================================================

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M_TOP = 60;
const M_BOTTOM = 60;
const M_LEFT = 70;
const M_RIGHT = 70;
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT;

const CREAM = rgb(0xfe / 255, 0xfc / 255, 0xf7 / 255);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0x47 / 255, 0x55 / 255, 0x69 / 255);
const MUTED_SOFT = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const TEAL = rgb(0x14 / 255, 0xb8 / 255, 0xa6 / 255);
const LIGHT_BORDER = rgb(0.9, 0.88, 0.85);
const HAIR = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255);
const WHITE = rgb(1, 1, 1);

const CAT_COLORS: Record<string, [number, number, number]> = {
  apertura: [0x3b, 0x82, 0xf6],
  staff: [0xf5, 0x9e, 0x0b],
  eventi_futuri: [0x10, 0xb9, 0x81],
  trattative: [0x8b, 0x5c, 0xf6],
  progetti: [0x14, 0xb8, 0xa6],
  conclusioni: [0x63, 0x66, 0xf1],
  altro: [0x6b, 0x72, 0x80],
  bilancio: [0x10, 0xb9, 0x81],
  federazione: [0x3b, 0x82, 0xf6],
  certificazione: [0xf5, 0x9e, 0x0b],
  contratto_sponsor: [0x8b, 0x5c, 0xf6],
  verbale: [0xe1, 0x1d, 0x48],
};

const AREA_INFO: Record<string, { numero: number; titolo: string; insight: string }> = {
  sintesi: {
    numero: 1, titolo: "Sintesi della stagione",
    insight: "La stagione mostra crescita della domanda e tenuta economica; le aree critiche sono presidiate.",
  },
  domanda: {
    numero: 2, titolo: "Domanda & Ghiaccio",
    insight: "La domanda supera la capacita': una fascia oraria aggiuntiva consentirebbe di assorbire la lista d'attesa.",
  },
  atleti: {
    numero: 3, titolo: "Atleti",
    insight: "Pulcini in calo, Interbronzo in crescita: i ragazzi avanzano verso l'agonismo.",
  },
  economia: {
    numero: 4, titolo: "Economia",
    insight: "Margine positivo, generato in particolare da corsi base e pacchetti opzionali.",
  },
  lezioni: {
    numero: 5, titolo: "Lezioni private",
    insight: "Le lezioni private trainano i ricavi e fidelizzano gli agonisti.",
  },
  sportivo: {
    numero: 6, titolo: "Risultati sportivi",
    insight: "Stagione di crescita: la maturazione del gruppo agonistico si riflette in gara.",
  },
  catalogo: {
    numero: 7, titolo: "Catalogo & Promozione",
    insight: "I partner sostengono il club; cerchiamo nuove collaborazioni per coprire le ore aggiuntive.",
  },
};

// Didascalia grafico per area (Sezione C - cornice)
const CHART_CAPTIONS: Record<string, string> = {
  atleti: "FIG. 1 - PIRAMIDE LIVELLI ATLETI",
  economia: "FIG. 2 - COMPOSIZIONE RICAVI",
  sportivo: "FIG. 3 - PODI STAGIONE",
  lezioni: "FIG. 4 - DISTRIBUZIONE FASCE ORARIE",
};

// ============================================================
// Helpers
// ============================================================

interface Fonts {
  serif: PDFFont;
  serifBold: PDFFont;
  serifItalic: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

function sanitize(s: string): string {
  // pdf-lib StandardFonts (WinAnsi) non supporta tutti i caratteri unicode
  return (s ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2013|\u2014/g, "-").replace(/\u2026/g, "...").replace(/[^\x00-\xff]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawPageFrame(page: PDFPage, pageNum: number, fonts: Fonts) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
  const txt = `- ${pageNum} -`;
  const w = fonts.sans.widthOfTextAtSize(txt, 9);
  page.drawText(txt, { x: (PAGE_W - w) / 2, y: 30, size: 9, font: fonts.sans, color: MUTED });
}

function drawCategoryBadge(page: PDFPage, x: number, y: number, label: string, category: string, fonts: Fonts) {
  const c = CAT_COLORS[category] || CAT_COLORS.altro;
  const color = rgb(c[0] / 255, c[1] / 255, c[2] / 255);
  const text = sanitize(label.toUpperCase());
  const size = 8;
  const w = fonts.sansBold.widthOfTextAtSize(text, size);
  page.drawRectangle({ x, y, width: w + 14, height: 16, color });
  page.drawText(text, { x: x + 7, y: y + 4, size, font: fonts.sansBold, color: WHITE });
}

// ============================================================
// Pagine
// ============================================================

// Copertina editoriale (Sezione A): banda teal 60% top + sezione crema 40% bottom
function drawCopertina(page: PDFPage, fonts: Fonts, club: any, presidente: string, stagione: string, _pageNum: number, dateStr: string) {
  // Sfondo crema integrale
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
  // Banda teal alta 60%
  const bandH = PAGE_H * 0.6;
  page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: TEAL });

  // Etichetta in alto a sinistra
  const kicker = sanitize(`RELAZIONE DI FINE STAGIONE - ${stagione}`).toUpperCase();
  page.drawText(kicker, { x: M_LEFT, y: PAGE_H - 80, size: 9, font: fonts.sansBold, color: WHITE });
  page.drawLine({ start: { x: M_LEFT, y: PAGE_H - 90 }, end: { x: M_LEFT + 60, y: PAGE_H - 90 }, thickness: 0.6, color: WHITE });

  // Nome club centrato nella banda, 48pt serif bianco, su 2 righe se serve
  const nome = sanitize(club?.nome ?? "Club");
  const nameLines = wrapText(nome, fonts.serifBold, 48, PAGE_W - 100);
  const centerY = PAGE_H - bandH / 2 + ((nameLines.length - 1) * 26);
  let ny = centerY;
  for (const ln of nameLines.slice(0, 2)) {
    const w = fonts.serifBold.widthOfTextAtSize(ln, 48);
    page.drawText(ln, { x: (PAGE_W - w) / 2, y: ny, size: 48, font: fonts.serifBold, color: WHITE });
    ny -= 52;
  }
  const citta = sanitize((club?.citta ?? "").toUpperCase());
  if (citta) {
    const cw = fonts.sansBold.widthOfTextAtSize(citta, 10);
    page.drawText(citta, { x: (PAGE_W - cw) / 2, y: ny - 16, size: 10, font: fonts.sansBold, color: WHITE });
  }

  // Sezione inferiore crema
  const bottomTop = PAGE_H - bandH - 40;
  page.drawText("PRESENTATA DA", { x: M_LEFT, y: bottomTop, size: 9, font: fonts.sansBold, color: MUTED });
  const pn = sanitize(presidente || "Il Presidente");
  page.drawText(pn, { x: M_LEFT, y: bottomTop - 32, size: 22, font: fonts.serifBold, color: INK });
  page.drawLine({ start: { x: M_LEFT, y: bottomTop - 48 }, end: { x: M_LEFT + 60, y: bottomTop - 48 }, thickness: 0.8, color: TEAL });
  page.drawText(`Generato il ${dateStr}`, { x: M_LEFT, y: 60, size: 10, font: fonts.sans, color: MUTED });
}

interface AreaCharts {
  primary?: PDFImage;   // mostrata sotto P2 in pagina 1
  primaryW?: number;
  primaryH?: number;
  secondary?: PDFImage; // mostrata in cima a pagina 2 (solo lezioni)
  secondaryW?: number;
  secondaryH?: number;
}

// Header pagina area (Sezione C): kicker uppercase + linea teal 100pt + titolo 32pt left
function drawAreaHeader(page: PDFPage, fonts: Fonts, info: { numero: number; titolo: string }, startY: number): number {
  let y = startY;
  const kicker = `CAPITOLO ${info.numero} - ${sanitize(info.titolo.toUpperCase())}`;
  page.drawText(kicker, { x: M_LEFT, y, size: 8, font: fonts.sansBold, color: TEAL });
  y -= 8;
  page.drawLine({ start: { x: M_LEFT, y }, end: { x: M_LEFT + 100, y }, thickness: 0.7, color: TEAL });
  y -= 28;
  const titleLines = wrapText(info.titolo, fonts.serifBold, 32, CONTENT_W);
  for (const ln of titleLines.slice(0, 2)) {
    page.drawText(ln, { x: M_LEFT, y, size: 32, font: fonts.serifBold, color: INK });
    y -= 36;
  }
  y -= 10;
  return y;
}

function drawParagraph(page: PDFPage, fonts: Fonts, text: string, y: number, opts: {
  font: PDFFont; size: number; color: any; lineH: number; indent?: number; align?: "left" | "right"; maxW?: number;
}): number {
  const indent = opts.indent ?? 0;
  const align = opts.align ?? "left";
  const w = (opts.maxW ?? CONTENT_W) - indent;
  const lines = wrapText(text, opts.font, opts.size, w);
  for (const ln of lines) {
    if (y < M_BOTTOM + 20) break;
    let x = M_LEFT + indent;
    if (align === "right") {
      const lw = opts.font.widthOfTextAtSize(ln, opts.size);
      x = M_LEFT + CONTENT_W - lw;
    }
    page.drawText(ln, { x, y, size: opts.size, font: opts.font, color: opts.color });
    y -= opts.lineH;
  }
  return y;
}

// KPI mosaico 3 colonne (Sezione C): 3 celle 90pt cream + bordo hair, num serif 36 teal, label sans 8 tracking
function drawKpiMosaic(page: PDFPage, fonts: Fonts, kpis: KpiCell[] | undefined, y: number): number {
  if (!kpis || kpis.length === 0) return y;
  const cells = kpis.slice(0, 3);
  const totalW = Math.min(480, CONTENT_W);
  const x0 = M_LEFT + (CONTENT_W - totalW) / 2;
  const cellW = totalW / cells.length;
  const cellH = 90;
  const yTop = y - cellH;

  // sfondo unico + bordo esterno
  page.drawRectangle({ x: x0, y: yTop, width: totalW, height: cellH, color: CREAM, borderColor: HAIR, borderWidth: 0.5 });

  for (let i = 0; i < cells.length; i++) {
    const cx = x0 + i * cellW + cellW / 2;
    const k = cells[i];
    // separatori verticali
    if (i > 0) {
      page.drawLine({
        start: { x: x0 + i * cellW, y: yTop + 12 },
        end: { x: x0 + i * cellW, y: yTop + cellH - 12 },
        thickness: 0.4, color: HAIR,
      });
    }
    // numero serif bold 28 teal centrato (36 era troppo per stringhe lunghe tipo CHF)
    let nSize = 28;
    let txt = sanitize(k.value);
    let nw = fonts.serifBold.widthOfTextAtSize(txt, nSize);
    while (nw > cellW - 16 && nSize > 14) {
      nSize -= 1;
      nw = fonts.serifBold.widthOfTextAtSize(txt, nSize);
    }
    page.drawText(txt, { x: cx - nw / 2, y: yTop + 46, size: nSize, font: fonts.serifBold, color: TEAL });
    // label sans uppercase 8 tracking
    const lbl = sanitize(k.label.toUpperCase());
    const lw = fonts.sansBold.widthOfTextAtSize(lbl, 8) + (lbl.length - 1) * 1.5;
    page.drawText(lbl, { x: cx - lw / 2, y: yTop + 22, size: 8, font: fonts.sansBold, color: MUTED });
  }
  return yTop - 18;
}

function drawChart(page: PDFPage, fonts: Fonts, img: PDFImage, w: number, h: number, y: number, caption?: string): number {
  // Cornice teal 0.5 attorno + didascalia sans uppercase sopra
  const pad = 12;
  const frameW = w + pad * 2;
  const frameH = h + pad * 2;
  const fx = M_LEFT + (CONTENT_W - frameW) / 2;
  let topY = y;
  if (caption) {
    const cap = sanitize(caption);
    const capw = fonts.sansBold.widthOfTextAtSize(cap, 8) + (cap.length - 1) * 1.5;
    page.drawText(cap, { x: M_LEFT + (CONTENT_W - capw) / 2, y: topY, size: 8, font: fonts.sansBold, color: MUTED });
    topY -= 14;
  }
  page.drawRectangle({
    x: fx, y: topY - frameH, width: frameW, height: frameH,
    borderColor: TEAL, borderWidth: 0.5,
  });
  page.drawImage(img, { x: fx + pad, y: topY - frameH + pad, width: w, height: h });
  return topY - frameH - 14;
}

// ============================================================
// Layout dinamico aree (Prompt C - magazine intelligente)
// ============================================================

function estimateLines(text: string, font: PDFFont, size: number, maxW: number): number {
  if (!text) return 0;
  return wrapText(text, font, size, maxW).length;
}

interface AreaLayout {
  totalPages: 1 | 2;
  chartScaledW?: number;
  chartScaledH?: number;
  decoration?: { kind: "A" | "C"; quote?: string };
}

// Solo decorazioni A (citazione) e C (linea con rombo). I callout "B" (mini-KPI fluttuante)
// sono stati rimossi (Prompt D): i numeri sono gia' nei KPI hero e nei paragrafi.
function pickDecoration(p3: string): AreaLayout["decoration"] {
  if (p3) {
    const sentences = p3.split(/(?<=[.!?])\s+/);
    const short = sentences.find((s) => s.length >= 20 && s.length <= 80);
    if (short) return { kind: "A", quote: short.trim() };
  }
  return { kind: "C" };
}

const HEADER_CONSUMED = 70;
const KPI_BLOCK_H = 50;
const PARA_SPACING = 6;
const CHART_SPACING = 14;
const AREA_AVAIL = PAGE_H - M_TOP - M_BOTTOM - 20; // ~702pt

function planAreaLayout(sezione_id: string, paras: Record<number, string> | undefined, charts: AreaCharts, fonts: Fonts): AreaLayout {
  const info = AREA_INFO[sezione_id];
  if (!info) return { totalPages: 1 };
  const p1 = paras?.[1] ?? info.insight;
  const p2 = paras?.[2] ?? "";
  const p3 = paras?.[3] ?? "";
  const p4 = paras?.[4] ?? "";

  const h_p1 = estimateLines(p1, fonts.serifItalic, 11, CONTENT_W) * 15 + (p1 ? PARA_SPACING : 0);
  const h_p2 = estimateLines(p2, fonts.serif, 11, CONTENT_W) * 14 + (p2 ? PARA_SPACING : 0);
  const h_p3 = estimateLines(p3, fonts.serif, 11, CONTENT_W - 20) * 14 + (p3 ? PARA_SPACING : 0);
  const h_p4 = estimateLines(p4, fonts.serifItalic, 10, CONTENT_W) * 13 + (p4 ? PARA_SPACING : 0);
  const h_chart_orig = charts.primary && charts.primaryH ? charts.primaryH + CHART_SPACING : 0;
  const hasSecondary = !!(charts.secondary && charts.secondaryH);

  // Se c'e' grafico secondario serve sempre la seconda pagina (lezioni)
  if (hasSecondary) {
    const p2used = HEADER_CONSUMED + (charts.secondaryH ?? 0) + CHART_SPACING + h_p3 + h_p4;
    const empty = AREA_AVAIL - p2used;
    const decoration = empty > 150 ? pickDecoration(p3) : undefined;
    return { totalPages: 2, chartScaledW: charts.primaryW, chartScaledH: charts.primaryH, decoration };
  }

  const usedAll = HEADER_CONSUMED + h_p1 + KPI_BLOCK_H + h_p2 + h_chart_orig + h_p3 + h_p4;

  if (usedAll <= AREA_AVAIL * 0.95) {
    // Entra tutto in 1 pagina; ridimensiona il grafico per riempire armoniosamente
    let cW = charts.primaryW;
    let cH = charts.primaryH;
    if (h_chart_orig > 0 && cW && cH) {
      const aspect = cW / cH;
      const otherH = HEADER_CONSUMED + h_p1 + KPI_BLOCK_H + h_p2 + h_p3 + h_p4;
      const availChart = AREA_AVAIL - otherH - CHART_SPACING - 30; // margine respiro
      if (availChart < 200) {
        cH = 200; cW = 200 * aspect;
      } else if (availChart > 350) {
        cH = 350; cW = 350 * aspect;
      } else {
        cH = availChart; cW = cH * aspect;
      }
      // se cW eccede CONTENT_W, riscala
      if (cW > CONTENT_W) {
        cW = CONTENT_W;
        cH = cW / aspect;
      }
    }
    const finalChartH = cH ? cH + CHART_SPACING : 0;
    const finalUsed = HEADER_CONSUMED + h_p1 + KPI_BLOCK_H + h_p2 + finalChartH + h_p3 + h_p4;
    const empty = AREA_AVAIL - finalUsed;
    const decoration = empty > 150 ? pickDecoration(p3) : undefined;
    return { totalPages: 1, chartScaledW: cW, chartScaledH: cH, decoration };
  }

  // 2 pagine: P1+KPI+P2+chart sulla prima, P3+P4 sulla seconda
  const p2used = HEADER_CONSUMED + h_p3 + h_p4;
  const empty = AREA_AVAIL - p2used;
  const decoration = empty > 150 ? pickDecoration(p3) : undefined;
  return { totalPages: 2, chartScaledW: charts.primaryW, chartScaledH: charts.primaryH, decoration };
}

function drawDecoration(page: PDFPage, fonts: Fonts, deco: NonNullable<AreaLayout["decoration"]>, yTop: number, yBottomLimit: number) {
  const cx = PAGE_W / 2;
  const yCenter = Math.max(yBottomLimit + 60, (yTop + yBottomLimit) / 2);
  if (deco.kind === "A" && deco.quote) {
    const q = `"${sanitize(deco.quote)}"`;
    const lines = wrapText(q, fonts.serifItalic, 16, CONTENT_W - 80);
    let y = yCenter + (lines.length - 1) * 11;
    for (const ln of lines) {
      const w = fonts.serifItalic.widthOfTextAtSize(ln, 16);
      page.drawText(ln, { x: cx - w / 2, y, size: 16, font: fonts.serifItalic, color: rgb(0.3, 0.3, 0.32) });
      y -= 22;
    }
  } else {
    // Linea decorativa con piccolo rombo centrale teal
    page.drawLine({ start: { x: cx - 50, y: yCenter }, end: { x: cx - 6, y: yCenter }, thickness: 0.6, color: TEAL });
    page.drawLine({ start: { x: cx + 6, y: yCenter }, end: { x: cx + 50, y: yCenter }, thickness: 0.6, color: TEAL });
    page.drawLine({ start: { x: cx, y: yCenter + 3 }, end: { x: cx + 3, y: yCenter }, thickness: 0.8, color: TEAL });
    page.drawLine({ start: { x: cx + 3, y: yCenter }, end: { x: cx, y: yCenter - 3 }, thickness: 0.8, color: TEAL });
    page.drawLine({ start: { x: cx, y: yCenter - 3 }, end: { x: cx - 3, y: yCenter }, thickness: 0.8, color: TEAL });
    page.drawLine({ start: { x: cx - 3, y: yCenter }, end: { x: cx, y: yCenter + 3 }, thickness: 0.8, color: TEAL });
  }
}

// Singola pagina area
function drawAreaSingle(page: PDFPage, fonts: Fonts, sezione_id: string, pageNum: number, paras: Record<number, string> | undefined, charts: AreaCharts, layout: AreaLayout, kpiData: KpiData) {
  drawPageFrame(page, pageNum, fonts);
  const info = AREA_INFO[sezione_id];
  if (!info) return;
  let y = PAGE_H - M_TOP - 10;
  y = drawAreaHeader(page, fonts, info, y);

  const p1 = paras?.[1] ?? info.insight;
  y = drawParagraph(page, fonts, p1, y, { font: fonts.serifItalic, size: 12, color: rgb(0.3, 0.3, 0.32), lineH: 17, maxW: CONTENT_W - 20 });
  y -= 10;

  y = drawKpiMosaic(page, fonts, kpiData[sezione_id], y);

  const p2 = paras?.[2];
  if (p2) {
    y = drawParagraph(page, fonts, p2, y, { font: fonts.serif, size: 11, color: INK, lineH: 16 });
    y -= 6;
  }

  if (charts.primary && layout.chartScaledW && layout.chartScaledH) {
    y = drawChart(page, fonts, charts.primary, layout.chartScaledW, layout.chartScaledH, y, CHART_CAPTIONS[sezione_id]);
  }

  const p3 = paras?.[3];
  if (p3) {
    y = drawParagraph(page, fonts, p3, y, { font: fonts.serif, size: 11, color: rgb(0.18, 0.18, 0.2), lineH: 16, indent: 20 });
    y -= 6;
  }
  const p4 = paras?.[4];
  if (p4) {
    y = drawParagraph(page, fonts, p4, y, { font: fonts.serifItalic, size: 10, color: MUTED, lineH: 14, align: "right" });
  }

  if (layout.decoration) {
    drawDecoration(page, fonts, layout.decoration, y, M_BOTTOM + 30);
  }
}

function drawAreaMain(page: PDFPage, fonts: Fonts, sezione_id: string, pageNum: number, paras: Record<number, string> | undefined, charts: AreaCharts, layout: AreaLayout, kpiData: KpiData) {
  drawPageFrame(page, pageNum, fonts);
  const info = AREA_INFO[sezione_id];
  if (!info) return;
  let y = PAGE_H - M_TOP - 10;
  y = drawAreaHeader(page, fonts, info, y);

  const p1 = paras?.[1] ?? info.insight;
  y = drawParagraph(page, fonts, p1, y, { font: fonts.serifItalic, size: 12, color: rgb(0.3, 0.3, 0.32), lineH: 17, maxW: CONTENT_W - 20 });
  y -= 10;

  y = drawKpiMosaic(page, fonts, kpiData[sezione_id], y);

  const p2 = paras?.[2];
  if (p2) {
    y = drawParagraph(page, fonts, p2, y, { font: fonts.serif, size: 11, color: INK, lineH: 16 });
    y -= 6;
  }

  if (charts.primary && layout.chartScaledW && layout.chartScaledH) {
    if (y - layout.chartScaledH - 38 >= M_BOTTOM + 20) {
      drawChart(page, fonts, charts.primary, layout.chartScaledW, layout.chartScaledH, y, CHART_CAPTIONS[sezione_id]);
    }
  }
}

function drawAreaContinuation(page: PDFPage, fonts: Fonts, sezione_id: string, pageNum: number, paras: Record<number, string> | undefined, charts: AreaCharts, layout: AreaLayout) {
  drawPageFrame(page, pageNum, fonts);
  const info = AREA_INFO[sezione_id];
  if (!info) return;

  let y = PAGE_H - M_TOP - 10;
  const header = `CAPITOLO ${info.numero} - ${sanitize(info.titolo.toUpperCase())} (SEGUE)`;
  page.drawText(header, { x: M_LEFT, y, size: 8, font: fonts.sansBold, color: TEAL });
  y -= 8;
  page.drawLine({ start: { x: M_LEFT, y }, end: { x: M_LEFT + 100, y }, thickness: 0.7, color: TEAL });
  y -= 28;

  if (charts.secondary && charts.secondaryW && charts.secondaryH) {
    y = drawChart(page, fonts, charts.secondary, charts.secondaryW, charts.secondaryH, y, CHART_CAPTIONS[sezione_id]);
  }

  const p3 = paras?.[3];
  if (p3) {
    y = drawParagraph(page, fonts, p3, y, { font: fonts.serif, size: 11, color: rgb(0.18, 0.18, 0.2), lineH: 16, indent: 20 });
    y -= 6;
  }
  const p4 = paras?.[4];
  if (p4) {
    y = drawParagraph(page, fonts, p4, y, { font: fonts.serifItalic, size: 10, color: MUTED, lineH: 14, align: "right" });
  }

  if (layout.decoration) {
    drawDecoration(page, fonts, layout.decoration, y, M_BOTTOM + 30);
  }
}

function drawBloccoPage(page: PDFPage, fonts: Fonts, blocco: any, pageNum: number) {
  drawPageFrame(page, pageNum, fonts);
  let y = PAGE_H - M_TOP - 10;

  const cat = blocco?.categoria ?? "altro";
  drawCategoryBadge(page, M_LEFT, y - 6, cat.replace(/_/g, " "), cat, fonts);
  y -= 36;

  const titleLines = wrapText(blocco?.titolo ?? "Blocco", fonts.serifBold, 22, CONTENT_W);
  for (const ln of titleLines) {
    page.drawText(ln, { x: M_LEFT, y, size: 22, font: fonts.serifBold, color: INK });
    y -= 26;
  }
  y -= 10;

  page.drawLine({ start: { x: M_LEFT, y }, end: { x: M_LEFT + 50, y }, thickness: 1.2, color: TEAL });
  y -= 22;

  const paragraphs = (blocco?.contenuto ?? "").split(/\n\s*\n/);
  const size = 11;
  const lh = 16;
  for (const para of paragraphs) {
    const clean = para.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\n/g, " ");
    const lines = wrapText(clean, fonts.serif, size, CONTENT_W);
    for (const ln of lines) {
      if (y < M_BOTTOM + 30) break;
      page.drawText(ln, { x: M_LEFT, y, size, font: fonts.serif, color: INK });
      y -= lh;
    }
    y -= 8;
    if (y < M_BOTTOM + 30) break;
  }

  // Decorazione finale (Parte 4-C) se la pagina ha > 150pt vuoti in basso
  if (y > M_BOTTOM + 180) {
    const yCenter = (y + M_BOTTOM + 30) / 2;
    const cx = PAGE_W / 2;
    page.drawLine({ start: { x: cx - 50, y: yCenter }, end: { x: cx + 50, y: yCenter }, thickness: 1, color: TEAL });
  }
}

function drawAllegatoPlaceholder(page: PDFPage, fonts: Fonts, allegato: any, pageNum: number) {
  drawPageFrame(page, pageNum, fonts);
  const cx = PAGE_W / 2;
  const cy = PAGE_H / 2;

  // Cornice decorativa centrata
  const boxW = CONTENT_W - 40;
  const boxH = 320;
  const boxX = (PAGE_W - boxW) / 2;
  const boxY = cy - boxH / 2;
  page.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, borderColor: LIGHT_BORDER, borderWidth: 1 });

  // Icona PDF centrata verticalmente nel box
  const iconH = 90;
  const iy = boxY + boxH - 50 - iconH;
  const ix = cx - 35;
  page.drawRectangle({ x: ix, y: iy, width: 70, height: iconH, borderColor: LIGHT_BORDER, borderWidth: 1.5 });
  const pdfTxt = "PDF";
  const pw = fonts.serifBold.widthOfTextAtSize(pdfTxt, 22);
  page.drawText(pdfTxt, { x: cx - pw / 2, y: iy + 35, size: 22, font: fonts.serifBold, color: MUTED });

  const cat = allegato?.categoria ?? "altro";
  const lbl = sanitize(cat.replace(/_/g, " ").toUpperCase());
  const lw = fonts.sansBold.widthOfTextAtSize(lbl, 8);
  const c = CAT_COLORS[cat] || CAT_COLORS.altro;
  const color = rgb(c[0] / 255, c[1] / 255, c[2] / 255);
  page.drawRectangle({ x: cx - (lw + 14) / 2, y: iy - 30, width: lw + 14, height: 16, color });
  page.drawText(lbl, { x: cx - lw / 2, y: iy - 26, size: 8, font: fonts.sansBold, color: WHITE });

  const tit = sanitize(allegato?.titolo ?? "Allegato");
  const tw = fonts.serifBold.widthOfTextAtSize(tit, 20);
  page.drawText(tit, { x: cx - tw / 2, y: iy - 70, size: 20, font: fonts.serifBold, color: INK });

  let dy = iy - 100;
  if (allegato?.descrizione) {
    const lines = wrapText(allegato.descrizione, fonts.serifItalic, 11, CONTENT_W - 80);
    for (const ln of lines) {
      const lnw = fonts.serifItalic.widthOfTextAtSize(ln, 11);
      page.drawText(ln, { x: cx - lnw / 2, y: dy, size: 11, font: fonts.serifItalic, color: MUTED });
      dy -= 14;
    }
  }

  // Micro-descrizione
  const microNote = "Il documento completo segue nelle pagine successive del PDF.";
  const mnLines = wrapText(microNote, fonts.sans, 9, CONTENT_W - 100);
  let my = dy - 8;
  for (const ln of mnLines) {
    const w = fonts.sans.widthOfTextAtSize(ln, 9);
    page.drawText(ln, { x: cx - w / 2, y: my, size: 9, font: fonts.sans, color: MUTED });
    my -= 12;
  }
}

function drawIndice(page: PDFPage, fonts: Fonts, entries: { titolo: string; pagina: number }[], pageNum: number) {
  drawPageFrame(page, pageNum, fonts);
  let y = PAGE_H - M_TOP - 10;
  page.drawText("INDICE", { x: M_LEFT, y, size: 8, font: fonts.sansBold, color: TEAL });
  y -= 25;
  page.drawText("Sommario", { x: M_LEFT, y: y - 18, size: 24, font: fonts.serifBold, color: INK });
  y -= 60;

  const size = 11;
  for (const e of entries) {
    if (y < M_BOTTOM + 30) break;
    const tit = sanitize(e.titolo);
    const num = String(e.pagina);
    const titW = fonts.serif.widthOfTextAtSize(tit, size);
    const numW = fonts.sans.widthOfTextAtSize(num, size);
    page.drawText(tit, { x: M_LEFT, y, size, font: fonts.serif, color: INK });
    page.drawText(num, { x: M_LEFT + CONTENT_W - numW, y, size, font: fonts.sans, color: MUTED });
    // Puntini
    const dotsStart = M_LEFT + titW + 6;
    const dotsEnd = M_LEFT + CONTENT_W - numW - 6;
    let dx = dotsStart;
    while (dx < dotsEnd) {
      page.drawText(".", { x: dx, y, size, font: fonts.sans, color: rgb(0.7, 0.68, 0.65) });
      dx += 3.5;
    }
    y -= 20;
  }
}

function drawChiusura(page: PDFPage, fonts: Fonts, club: any, stagione: string, pageNum: number, dateStr: string) {
  drawPageFrame(page, pageNum, fonts);
  const cx = PAGE_W / 2;
  const cy = PAGE_H / 2;

  const nome = sanitize(club?.nome ?? "Club");
  const nw = fonts.serifBold.widthOfTextAtSize(nome, 22);
  page.drawText(nome, { x: cx - nw / 2, y: cy + 20, size: 22, font: fonts.serifBold, color: INK });

  const sub = sanitize(`Relazione del Presidente - Stagione ${stagione}`);
  const sw = fonts.serifItalic.widthOfTextAtSize(sub, 12);
  page.drawText(sub, { x: cx - sw / 2, y: cy - 5, size: 12, font: fonts.serifItalic, color: MUTED });

  page.drawLine({ start: { x: cx - 30, y: cy - 25 }, end: { x: cx + 30, y: cy - 25 }, thickness: 0.8, color: TEAL });

  const dt = `Documento generato il ${dateStr}`;
  const dw = fonts.sans.widthOfTextAtSize(dt, 9);
  page.drawText(dt, { x: cx - dw / 2, y: 80, size: 9, font: fonts.sans, color: MUTED });
}

// ============================================================
// Generatore principale
// ============================================================

let generation_in_progress = false;

export async function generateRelazionePDF(params: GenerateRelazioneParams): Promise<{ blob: Blob; pages: number }> {
  if (generation_in_progress) {
    throw new Error("Generazione gia in corso. Attendi il completamento.");
  }

  generation_in_progress = true;
  try {
  const { club, presidente, stagione_nome, items, club_id, stagione_id, tono } = params;

  // Fetch paragrafi narrativi per il tono selezionato (se disponibili)
  let paragrafiMap: Record<string, Record<number, string>> = {};
  if (club_id && stagione_id) {
    try {
      paragrafiMap = await fetchParagrafiForPdf(club_id, stagione_id, (tono ?? "soci") as Tono);
    } catch (e) {
      console.warn("[PDF] Impossibile caricare paragrafi narrativi:", e);
    }
  }

  // Fetch KPI hero veri (Prompt D - stessa fonte dei paragrafi)
  let kpiData: KpiData = {};
  if (club_id && stagione_id) {
    try {
      kpiData = await fetchKpiData(club_id, stagione_id);
    } catch (e) {
      console.warn("[PDF] Errore fetch KPI:", e);
    }
  }

  let chartData: ChartData | null = null;
  if (club_id && stagione_id) {
    try {
      chartData = await fetchChartData(club_id, stagione_id);
    } catch (e) {
      console.warn("[PDF] Errore fetch dati grafici:", e);
    }
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relazione - ${sanitize(club?.nome ?? "")} - ${sanitize(stagione_nome)}`);
  pdf.setAuthor(sanitize(presidente));
  pdf.setCreator("Ice Arena Manager");
  pdf.setProducer("Ice Arena Manager - pdf-lib");

  const fonts: Fonts = {
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  // Embed grafici come PNG (una volta sola). Resizing 2x per qualita' retina.
  const areaCharts: Record<string, AreaCharts> = {};
  if (chartData) {
    async function embedSvg(svg: string, w: number, h: number): Promise<{ img: PDFImage; w: number; h: number } | null> {
      try {
        const bytes = await svgToPngBytes(svg, w, h, 2);
        const img = await pdf.embedPng(bytes);
        return { img, w, h };
      } catch (e) {
        console.warn("[PDF] embed grafico fallito:", e);
        return null;
      }
    }
    const [pir, donut, spark, heat, bar] = await Promise.all([
      embedSvg(generatePiramideAtletiSVG(chartData.piramide), 400, 300),
      embedSvg(generateDonutRicaviSVG(chartData.donut), 400, 300),
      embedSvg(generateSparklinePodiSVG(chartData.sparkline), 400, 150),
      embedSvg(generateHeatmapFasceSVG(chartData.heatmap), 400, 200),
      embedSvg(generateBarTariffeSVG(chartData.bartariffe), 400, 250),
    ]);
    if (pir)   areaCharts["atleti"]   = { primary: pir.img,   primaryW: pir.w,   primaryH: pir.h };
    if (donut) areaCharts["economia"] = { primary: donut.img, primaryW: donut.w, primaryH: donut.h };
    if (spark) areaCharts["sportivo"] = { primary: spark.img, primaryW: spark.w, primaryH: spark.h };
    if (heat || bar) {
      areaCharts["lezioni"] = {
        primary: heat?.img, primaryW: heat?.w, primaryH: heat?.h,
        secondary: bar?.img, secondaryW: bar?.w, secondaryH: bar?.h,
      };
    }
  }


  // Pre-calcola la mappa pagine: ogni item -> pagina iniziale.
  // Per gli allegati con file_url HTTP(S) reale tentiamo il merge (puo' avere piu' pagine).
  // Per stimare il numero pagine dell'indice, primo passaggio: assumiamo 1 pagina per item, eccezione: merge allegati.
  // Strategia: rendiamo prima TUTTE le pagine non-indice, costruiamo la mappa, poi prependiamo l'indice come prime pagine (gestendo la copertina come prima).

  // Tipi di item ricevuti: hanno sezione_id (sistema/area) o payload (blocco/allegato)
  // Costruiamo un array di "blocchi pagina" con il count effettivo, poi assembliamo.

  type Block =
    | { type: "copertina" }
    | { type: "indice"; placeholderPages: number }
    | { type: "area"; sezione_id: string; title: string; pages: number }
    | { type: "blocco"; payload: any; title: string }
    | { type: "allegato_real"; bytes: ArrayBuffer; pages: number; title: string }
    | { type: "allegato_placeholder"; payload: any; title: string }
    | { type: "chiusura" };

  const blocks: Block[] = [];
  const areaLayouts: Record<string, AreaLayout> = {};
  let hasIndice = false;

  for (const it of items) {
    if (it.kind === "sistema") {
      if (it.sezione_id === "copertina") blocks.push({ type: "copertina" });
      else if (it.sezione_id === "indice") {
        hasIndice = true;
        blocks.push({ type: "indice", placeholderPages: 1 });
      } else if (it.sezione_id === "chiusura") blocks.push({ type: "chiusura" });
    } else if (it.kind === "area") {
      const sid = it.sezione_id!;
      const layout = planAreaLayout(sid, paragrafiMap[sid], areaCharts[sid] ?? {}, fonts);
      areaLayouts[sid] = layout;
      blocks.push({ type: "area", sezione_id: sid, title: it.titolo, pages: layout.totalPages });
    } else if (it.kind === "blocco") {
      blocks.push({ type: "blocco", payload: it.payload, title: it.titolo });
    } else if (it.kind === "allegato") {
      const url: string | undefined = it.payload?.file_url;
      let merged = false;
      if (url && /^https?:\/\//i.test(url)) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            // Verifica numero pagine
            const tmp = await PDFDocument.load(buf, { ignoreEncryption: true });
            blocks.push({ type: "allegato_real", bytes: buf, pages: tmp.getPageCount(), title: it.titolo });
            merged = true;
          }
        } catch {
          /* fallback placeholder */
        }
      }
      if (!merged) blocks.push({ type: "allegato_placeholder", payload: it.payload, title: it.titolo });
    }
  }

  // Indice entries con pagine reali
  // Calcolo pagine: ogni blocco occupa 1 pagina, tranne allegato_real (n pagine) e indice (1 placeholder iniziale).
  // Per gestire l'indice dinamicamente: facciamo 2 passaggi.

  function computePageMap(): { entries: { title: string; page: number; block: Block }[]; total: number } {
    let p = 1;
    const entries: { title: string; page: number; block: Block }[] = [];
    for (const b of blocks) {
      let title = "";
      let pages = 1;
      if (b.type === "copertina") title = "Copertina";
      else if (b.type === "indice") { title = "Sommario"; pages = b.placeholderPages; }
      else if (b.type === "area") { title = `${AREA_INFO[b.sezione_id]?.numero ?? ""}. ${AREA_INFO[b.sezione_id]?.titolo ?? b.title}`; pages = b.pages; }
      else if (b.type === "blocco") title = b.title;
      else if (b.type === "allegato_real") { title = `${b.title} (allegato)`; pages = b.pages; }
      else if (b.type === "allegato_placeholder") title = `${b.title} (allegato)`;
      else if (b.type === "chiusura") title = "Chiusura";
      entries.push({ title, page: p, block: b });
      p += pages;
    }
    return { entries, total: p - 1 };
  }

  // Primo calcolo (indice = 1 pagina). Se le entries sono > 28 stimiamo 2 pagine indice.
  let map = computePageMap();
  if (hasIndice) {
    const visibleEntries = map.entries.filter((e) => e.block.type !== "copertina" && e.block.type !== "indice").length;
    const indicePagesNeeded = Math.max(1, Math.ceil(visibleEntries / 28));
    for (const b of blocks) {
      if (b.type === "indice") b.placeholderPages = indicePagesNeeded;
    }
    map = computePageMap();
  }

  // Rendering
  let pageCursor = 0;
  for (const entry of map.entries) {
    pageCursor = entry.page;
    const b = entry.block;
    if (b.type === "copertina") {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      drawCopertina(page, fonts, club, presidente, stagione_nome, pageCursor, dateStr);
    } else if (b.type === "indice") {
      const indiceEntries = map.entries
        .filter((e) => e.block.type !== "indice")
        .map((e) => ({ titolo: e.title, pagina: e.page }));
      // pagina(e) indice
      const perPage = 28;
      const totalPages = b.placeholderPages;
      for (let i = 0; i < totalPages; i++) {
        const page = pdf.addPage([PAGE_W, PAGE_H]);
        const slice = indiceEntries.slice(i * perPage, (i + 1) * perPage);
        drawIndice(page, fonts, slice, pageCursor + i);
      }
    } else if (b.type === "area") {
      const paras = paragrafiMap[b.sezione_id];
      const charts = areaCharts[b.sezione_id] ?? {};
      const layout = areaLayouts[b.sezione_id] ?? planAreaLayout(b.sezione_id, paras, charts, fonts);
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      if (layout.totalPages === 1) {
        drawAreaSingle(page, fonts, b.sezione_id, pageCursor, paras, charts, layout, kpiData);
      } else {
        drawAreaMain(page, fonts, b.sezione_id, pageCursor, paras, charts, layout, kpiData);
        const page2 = pdf.addPage([PAGE_W, PAGE_H]);
        drawAreaContinuation(page2, fonts, b.sezione_id, pageCursor + 1, paras, charts, layout);
      }
    } else if (b.type === "blocco") {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      drawBloccoPage(page, fonts, b.payload, pageCursor);
    } else if (b.type === "allegato_real") {
      try {
        const src = await PDFDocument.load(b.bytes, { ignoreEncryption: true });
        const copied = await pdf.copyPages(src, src.getPageIndices());
        copied.forEach((p) => pdf.addPage(p));
      } catch {
        const page = pdf.addPage([PAGE_W, PAGE_H]);
        drawAllegatoPlaceholder(page, fonts, { titolo: b.title, categoria: "altro" }, pageCursor);
      }
    } else if (b.type === "allegato_placeholder") {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      drawAllegatoPlaceholder(page, fonts, b.payload, pageCursor);
    } else if (b.type === "chiusura") {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      drawChiusura(page, fonts, club, stagione_nome, pageCursor, dateStr);
    }
    // Silenzio l'unused var warning
    void degrees;
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return { blob, pages: pdf.getPageCount() };
  } finally {
    generation_in_progress = false;
  }
}

export function slugifyClubName(nome: string): string {
  return (nome || "Club")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 40) || "Club";
}

export function buildRelazioneFilename(clubNome: string, stagione: string): string {
  const slug = slugifyClubName(clubNome);
  const stag = (stagione || "stagione").replace(/\//g, "-").replace(/\s+/g, "");
  return `Relazione_Stagione_${stag}_${slug}.pdf`;
}
