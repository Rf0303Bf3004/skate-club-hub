import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage, degrees } from "pdf-lib";
import { fetchParagrafiForPdf, type Tono } from "@/lib/paragraphGenerator";
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
const MUTED = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const TEAL = rgb(0x14 / 255, 0xb8 / 255, 0xa6 / 255);
const LIGHT_BORDER = rgb(0.86, 0.84, 0.8);
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

const AREA_INFO: Record<string, { numero: number; titolo: string; insight: string; kpi: string[] }> = {
  sintesi: {
    numero: 1, titolo: "Sintesi della stagione",
    insight: "La stagione mostra crescita della domanda e tenuta economica; le aree critiche sono presidiate.",
    kpi: ["Crescita domanda", "Cassa positiva", "Risultati sportivi record"],
  },
  domanda: {
    numero: 2, titolo: "Domanda & Ghiaccio",
    insight: "La domanda supera la capacità: una fascia oraria aggiuntiva consentirebbe di assorbire la lista d'attesa.",
    kpi: ["92% saturazione", "14 in lista d'attesa", "+3 ore richieste"],
  },
  atleti: {
    numero: 3, titolo: "Atleti",
    insight: "Pulcini in calo, Interbronzo in crescita: i ragazzi avanzano verso l'agonismo.",
    kpi: ["145 atleti attivi", "-2% YoY", "9 livelli coperti"],
  },
  economia: {
    numero: 4, titolo: "Economia",
    insight: "Margine positivo del 6%, generato in particolare da corsi base e pacchetti opzionali.",
    kpi: ["CHF 218'400 ricavi", "CHF 41'200 cassa", "+6% margine"],
  },
  lezioni: {
    numero: 5, titolo: "Lezioni private",
    insight: "Le lezioni private trainano i ricavi e fidelizzano gli agonisti.",
    kpi: ["412 ore erogate", "+18% YoY", "24 atleti coinvolti"],
  },
  sportivo: {
    numero: 6, titolo: "Risultati sportivi",
    insight: "Stagione record: la maturazione del gruppo Argento porta i suoi frutti in gara.",
    kpi: ["27 podi", "9 ori", "12 gare disputate"],
  },
  catalogo: {
    numero: 7, titolo: "Catalogo & Promozione",
    insight: "Cinque partner sostengono il club; cerchiamo uno sponsor pista per coprire le ore aggiuntive.",
    kpi: ["5 sponsor attivi", "CHF 19'000", "3 eventi promozionali"],
  },
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

function drawCopertina(page: PDFPage, fonts: Fonts, club: any, presidente: string, stagione: string, pageNum: number, dateStr: string) {
  drawPageFrame(page, pageNum, fonts);
  const cx = PAGE_W / 2;

  // Logo cerchio
  const initial = sanitize((club?.nome ?? "C").charAt(0).toUpperCase());
  page.drawCircle({ x: cx, y: PAGE_H - 180, size: 28, borderColor: TEAL, borderWidth: 1.5 });
  const iw = fonts.serif.widthOfTextAtSize(initial, 24);
  page.drawText(initial, { x: cx - iw / 2, y: PAGE_H - 188, size: 24, font: fonts.serif, color: INK });

  // Nome club
  const nome = sanitize(club?.nome ?? "Club");
  const nw = fonts.serifBold.widthOfTextAtSize(nome, 30);
  page.drawText(nome, { x: cx - nw / 2, y: PAGE_H - 260, size: 30, font: fonts.serifBold, color: INK });

  // Citta'
  const citta = sanitize((club?.citta ?? "").toUpperCase());
  if (citta) {
    const cw = fonts.sans.widthOfTextAtSize(citta, 10);
    page.drawText(citta, { x: cx - cw / 2, y: PAGE_H - 285, size: 10, font: fonts.sans, color: MUTED });
  }

  // Linea
  page.drawLine({ start: { x: cx - 40, y: PAGE_H - 330 }, end: { x: cx + 40, y: PAGE_H - 330 }, thickness: 0.8, color: TEAL });

  // Titolo relazione
  const t1 = "Relazione di fine stagione";
  const t1w = fonts.serif.widthOfTextAtSize(t1, 20);
  page.drawText(t1, { x: cx - t1w / 2, y: PAGE_H - 380, size: 20, font: fonts.serif, color: INK });

  const t2w = fonts.serif.widthOfTextAtSize(stagione, 16);
  page.drawText(sanitize(stagione), { x: cx - t2w / 2, y: PAGE_H - 410, size: 16, font: fonts.serif, color: MUTED });

  // Presidente
  const lbl = "PRESIDENTE";
  const lw = fonts.sans.widthOfTextAtSize(lbl, 8);
  page.drawText(lbl, { x: cx - lw / 2, y: 200, size: 8, font: fonts.sansBold, color: MUTED });

  const pn = sanitize(presidente);
  const pw = fonts.serif.widthOfTextAtSize(pn, 13);
  page.drawText(pn, { x: cx - pw / 2, y: 180, size: 13, font: fonts.serif, color: INK });

  // Data generazione
  page.drawText(`Generato il ${dateStr}`, { x: PAGE_W - M_RIGHT - 140, y: 50, size: 8, font: fonts.sans, color: MUTED });
}

interface AreaCharts {
  primary?: PDFImage;   // mostrata sotto P2 in pagina 1
  primaryW?: number;
  primaryH?: number;
  secondary?: PDFImage; // mostrata in cima a pagina 2 (solo lezioni)
  secondaryW?: number;
  secondaryH?: number;
}

function drawAreaHeader(page: PDFPage, fonts: Fonts, info: { numero: number; titolo: string }, startY: number): number {
  let y = startY;
  const header = `AREA ${info.numero}`;
  page.drawText(header, { x: M_LEFT, y, size: 8, font: fonts.sansBold, color: TEAL });
  y -= 22;
  const titleLines = wrapText(info.titolo, fonts.serifBold, 24, CONTENT_W);
  for (const ln of titleLines) {
    page.drawText(ln, { x: M_LEFT, y, size: 24, font: fonts.serifBold, color: INK });
    y -= 26;
  }
  y -= 4;
  page.drawLine({ start: { x: M_LEFT, y }, end: { x: M_LEFT + 50, y }, thickness: 1.5, color: TEAL });
  y -= 18;
  return y;
}

function drawParagraph(page: PDFPage, fonts: Fonts, text: string, y: number, opts: {
  font: PDFFont; size: number; color: any; lineH: number; indent?: number; align?: "left" | "right";
}): number {
  const indent = opts.indent ?? 0;
  const align = opts.align ?? "left";
  const w = CONTENT_W - indent;
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

function drawKpiRow(page: PDFPage, fonts: Fonts, kpi: string[], y: number): number {
  const kpiW = CONTENT_W / kpi.length;
  for (let i = 0; i < kpi.length; i++) {
    const parts = kpi[i].split(" ");
    const mid = Math.ceil(parts.length / 2);
    const numLine = parts.slice(0, mid).join(" ");
    const lblLine = parts.slice(mid).join(" ");
    const x0 = M_LEFT + i * kpiW;
    const nw = fonts.serifBold.widthOfTextAtSize(numLine, 16);
    page.drawText(sanitize(numLine), { x: x0 + (kpiW - nw) / 2, y, size: 16, font: fonts.serifBold, color: INK });
    if (lblLine) {
      const lw = fonts.sans.widthOfTextAtSize(lblLine.toUpperCase(), 8);
      page.drawText(sanitize(lblLine.toUpperCase()), { x: x0 + (kpiW - lw) / 2, y: y - 14, size: 8, font: fonts.sans, color: MUTED });
    }
  }
  y -= 36;
  page.drawLine({ start: { x: M_LEFT, y }, end: { x: M_LEFT + CONTENT_W, y }, thickness: 0.4, color: LIGHT_BORDER });
  return y - 14;
}

function drawChart(page: PDFPage, img: PDFImage, w: number, h: number, y: number): number {
  // centrato orizzontalmente
  const x = M_LEFT + (CONTENT_W - w) / 2;
  page.drawImage(img, { x, y: y - h, width: w, height: h });
  return y - h - 14;
}

// Disegna la pagina principale di un'area. Restituisce true se serve una pagina di continuazione (P3+P4 e/o chart secondaria).
function drawAreaMain(page: PDFPage, fonts: Fonts, sezione_id: string, pageNum: number, paras: Record<number, string> | undefined, charts: AreaCharts): { needContinuation: boolean } {
  drawPageFrame(page, pageNum, fonts);
  const info = AREA_INFO[sezione_id];
  if (!info) return { needContinuation: false };

  let y = PAGE_H - M_TOP - 10;
  y = drawAreaHeader(page, fonts, info, y);

  // P1 apertura corsivo grigio (oppure fallback insight)
  const p1 = paras?.[1] ?? info.insight;
  y = drawParagraph(page, fonts, p1, y, { font: fonts.serifItalic, size: 11, color: rgb(0.3, 0.3, 0.32), lineH: 15 });
  y -= 6;

  // KPI hero
  y = drawKpiRow(page, fonts, info.kpi, y);

  // P2 numeri
  const p2 = paras?.[2];
  if (p2) {
    y = drawParagraph(page, fonts, p2, y, { font: fonts.serif, size: 11, color: INK, lineH: 14 });
    y -= 6;
  }

  // Grafico primario
  if (charts.primary && charts.primaryW && charts.primaryH) {
    if (y - charts.primaryH < M_BOTTOM + 20) {
      // non c'è spazio: lo metteremo nella pagina di continuazione
      return { needContinuation: true };
    }
    y = drawChart(page, charts.primary, charts.primaryW, charts.primaryH, y);
  }

  const hasMoreText = !!(paras?.[3] || paras?.[4]);
  const hasSecondary = !!charts.secondary;
  return { needContinuation: hasMoreText || hasSecondary };
}

function drawAreaContinuation(page: PDFPage, fonts: Fonts, sezione_id: string, pageNum: number, paras: Record<number, string> | undefined, charts: AreaCharts) {
  drawPageFrame(page, pageNum, fonts);
  const info = AREA_INFO[sezione_id];
  if (!info) return;

  let y = PAGE_H - M_TOP - 10;
  // header ridotto (continua)
  const header = `AREA ${info.numero} · ${sanitize(info.titolo)} (segue)`;
  page.drawText(header, { x: M_LEFT, y, size: 8, font: fonts.sansBold, color: TEAL });
  y -= 22;
  page.drawLine({ start: { x: M_LEFT, y }, end: { x: M_LEFT + 50, y }, thickness: 1.2, color: TEAL });
  y -= 18;

  // Grafico secondario in alto se presente
  if (charts.secondary && charts.secondaryW && charts.secondaryH) {
    y = drawChart(page, charts.secondary, charts.secondaryW, charts.secondaryH, y);
  }

  const p3 = paras?.[3];
  if (p3) {
    y = drawParagraph(page, fonts, p3, y, { font: fonts.serif, size: 11, color: rgb(0.18, 0.18, 0.2), lineH: 14, indent: 20 });
    y -= 6;
  }
  const p4 = paras?.[4];
  if (p4) {
    drawParagraph(page, fonts, p4, y, { font: fonts.serifItalic, size: 10, color: MUTED, lineH: 13, align: "right" });
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
    // strip markdown bold/italic markers per semplicita'
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
}

function drawAllegatoPlaceholder(page: PDFPage, fonts: Fonts, allegato: any, pageNum: number) {
  drawPageFrame(page, pageNum, fonts);
  const cx = PAGE_W / 2;

  // Icona PDF
  const ix = cx - 35, iy = PAGE_H - 280;
  page.drawRectangle({ x: ix, y: iy, width: 70, height: 90, borderColor: LIGHT_BORDER, borderWidth: 1.5 });
  const pdfTxt = "PDF";
  const pw = fonts.serifBold.widthOfTextAtSize(pdfTxt, 22);
  page.drawText(pdfTxt, { x: cx - pw / 2, y: iy + 35, size: 22, font: fonts.serifBold, color: MUTED });

  const cat = allegato?.categoria ?? "altro";
  // badge centrato
  const lbl = sanitize(cat.replace(/_/g, " ").toUpperCase());
  const lw = fonts.sansBold.widthOfTextAtSize(lbl, 8);
  const c = CAT_COLORS[cat] || CAT_COLORS.altro;
  const color = rgb(c[0] / 255, c[1] / 255, c[2] / 255);
  page.drawRectangle({ x: cx - (lw + 14) / 2, y: iy - 30, width: lw + 14, height: 16, color });
  page.drawText(lbl, { x: cx - lw / 2, y: iy - 26, size: 8, font: fonts.sansBold, color: WHITE });

  // Titolo
  const tit = sanitize(allegato?.titolo ?? "Allegato");
  const tw = fonts.serifBold.widthOfTextAtSize(tit, 20);
  page.drawText(tit, { x: cx - tw / 2, y: iy - 70, size: 20, font: fonts.serifBold, color: INK });

  // Descrizione
  if (allegato?.descrizione) {
    const lines = wrapText(allegato.descrizione, fonts.serifItalic, 11, CONTENT_W - 60);
    let dy = iy - 100;
    for (const ln of lines) {
      const lnw = fonts.serifItalic.widthOfTextAtSize(ln, 11);
      page.drawText(ln, { x: cx - lnw / 2, y: dy, size: 11, font: fonts.serifItalic, color: MUTED });
      dy -= 14;
    }
  }

  // Nota
  const note = "Allegato non ancora caricato in Storage - sara' incluso quando il file sara' disponibile.";
  const noteLines = wrapText(note, fonts.sans, 9, CONTENT_W - 80);
  let dy = 200;
  for (const ln of noteLines) {
    const lnw = fonts.sans.widthOfTextAtSize(ln, 9);
    page.drawText(ln, { x: cx - lnw / 2, y: dy, size: 9, font: fonts.sans, color: MUTED });
    dy -= 12;
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

  // Fetch dati grafici + render SVG -> PNG embedded (una sola volta)
  const areaCharts: Record<string, AreaCharts> = {};
  if (club_id && stagione_id) {
    try {
      const chartData: ChartData = await fetchChartData(club_id, stagione_id);
      const pdfTmp = await PDFDocument.create(); void pdfTmp; // placeholder, ignored
      // helper inline per embedare in pdf finale (creato sotto)
      // creiamo prima il pdf finale poi facciamo embed
      // -> spostiamo l'embed dopo la creazione di pdf
      (params as any).__chartData = chartData;
    } catch (e) {
      console.warn("[PDF] Errore fetch dati grafici:", e);
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

  // Pre-calcola la mappa pagine: ogni item -> pagina iniziale.
  // Per gli allegati con file_url HTTP(S) reale tentiamo il merge (puo' avere piu' pagine).
  // Per stimare il numero pagine dell'indice, primo passaggio: assumiamo 1 pagina per item, eccezione: merge allegati.
  // Strategia: rendiamo prima TUTTE le pagine non-indice, costruiamo la mappa, poi prependiamo l'indice come prime pagine (gestendo la copertina come prima).

  // Tipi di item ricevuti: hanno sezione_id (sistema/area) o payload (blocco/allegato)
  // Costruiamo un array di "blocchi pagina" con il count effettivo, poi assembliamo.

  type Block =
    | { type: "copertina" }
    | { type: "indice"; placeholderPages: number }
    | { type: "area"; sezione_id: string; title: string }
    | { type: "blocco"; payload: any; title: string }
    | { type: "allegato_real"; bytes: ArrayBuffer; pages: number; title: string }
    | { type: "allegato_placeholder"; payload: any; title: string }
    | { type: "chiusura" };

  const blocks: Block[] = [];
  let hasIndice = false;

  for (const it of items) {
    if (it.kind === "sistema") {
      if (it.sezione_id === "copertina") blocks.push({ type: "copertina" });
      else if (it.sezione_id === "indice") {
        hasIndice = true;
        blocks.push({ type: "indice", placeholderPages: 1 });
      } else if (it.sezione_id === "chiusura") blocks.push({ type: "chiusura" });
    } else if (it.kind === "area") {
      blocks.push({ type: "area", sezione_id: it.sezione_id!, title: it.titolo });
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
      else if (b.type === "area") title = `${AREA_INFO[b.sezione_id]?.numero ?? ""}. ${AREA_INFO[b.sezione_id]?.titolo ?? b.title}`;
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
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      drawAreaPage(page, fonts, b.sezione_id, pageCursor, paragrafiMap[b.sezione_id]);
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
