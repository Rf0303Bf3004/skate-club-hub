// Generatori SVG per i grafici del PDF Relazione.
// Tutte le funzioni restituiscono una stringa SVG completa (con <?xml ?>).
// La palette e la tipografia sono coerenti con il resto del PDF (serif Times-Roman, teal/slate/ambra).

import { supabase } from "@/lib/supabase";

// ============================================================
// Palette
// ============================================================
const C = {
  primary: "#14b8a6",       // teal
  primaryDark: "#0f766e",
  primaryLight: "#5eead4",
  secondary: "#475569",     // slate scuro
  accent: "#f59e0b",         // ambra
  neutralLight: "#e2e8f0",   // slate chiaro
  neutralMid: "#94a3b8",
  text: "#1a1a1a",
  textMuted: "#6b7280",
  white: "#ffffff",
};

const FONT_SERIF = "Times, 'Times New Roman', serif";
const FONT_SANS = "Helvetica, Arial, sans-serif";

function escapeXml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtCHF(n: number): string {
  return Math.round(n).toLocaleString("de-CH").replace(/,/g, "'");
}

// ============================================================
// 1. Piramide Atleti
// ============================================================
export interface PiramideAtletiData {
  pulcini: number;
  stellina: number;
  interbronzo: number;
  bronzo: number;
  interargento: number;
  argento: number;
  interoro: number;
  oro: number;
}

export function generatePiramideAtletiSVG(data: PiramideAtletiData): string {
  const W = 400, H = 300;
  // Dal basso (Pulcini, vivaio) verso l'alto (Oro, agonismo)
  const levels: { label: string; count: number; color: string }[] = [
    { label: "Oro",          count: data.oro,          color: "#0f766e" },
    { label: "Interoro",     count: data.interoro,     color: "#0d8278" },
    { label: "Argento",      count: data.argento,      color: "#0d9488" },
    { label: "Interargento", count: data.interargento, color: "#14b8a6" },
    { label: "Bronzo",       count: data.bronzo,       color: "#2dd4bf" },
    { label: "Interbronzo",  count: data.interbronzo,  color: "#5eead4" },
    { label: "Stellina",     count: data.stellina,     color: "#99f6e4" },
    { label: "Pulcini",      count: data.pulcini,      color: "#ccfbf1" },
  ];

  const titleY = 22;
  const top = 40;
  const rowH = 26;
  const gap = 2;
  const labelW = 130; // spazio etichetta destra
  const maxBarW = W - 30 - labelW - 10;
  const maxCount = Math.max(1, ...levels.map(l => l.count));

  let bars = "";
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    const y = top + i * (rowH + gap);
    const barW = Math.max(8, (lv.count / maxCount) * maxBarW);
    const cx = 15 + barW / 2;
    const numText = String(lv.count);
    const numInside = barW > 28;
    bars += `
      <rect x="15" y="${y}" width="${barW}" height="${rowH}" fill="${lv.color}" rx="2"/>
      <text x="${numInside ? cx : 15 + barW + 6}" y="${y + rowH / 2 + 4}" text-anchor="${numInside ? "middle" : "start"}"
        font-family="${FONT_SANS}" font-size="11" font-weight="bold"
        fill="${numInside ? "#ffffff" : C.text}">${numText}</text>
      <text x="${15 + maxBarW + 12}" y="${y + rowH / 2 + 4}" font-family="${FONT_SERIF}" font-size="11" fill="${C.text}">
        ${escapeXml(lv.label)}
      </text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fefcf7"/>
  <text x="15" y="${titleY}" font-family="${FONT_SERIF}" font-size="14" font-weight="bold" fill="${C.text}">Piramide del Vivaio</text>
  ${bars}
</svg>`;
}

// ============================================================
// 2. Donut Ricavi
// ============================================================
export interface DonutRicaviData {
  quote_corsi: number;
  pacchetti: number;
  lezioni_private: number;
  altro: number;
}

export function generateDonutRicaviSVG(data: DonutRicaviData): string {
  const W = 400, H = 300;
  const segments = [
    { label: "Quote corsi",     value: data.quote_corsi,     color: C.primary },
    { label: "Pacchetti",       value: data.pacchetti,       color: C.accent },
    { label: "Lezioni private", value: data.lezioni_private, color: C.secondary },
    { label: "Altro",           value: data.altro,           color: C.neutralMid },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;

  const cx = 110, cy = 165;
  const rOuter = 80, rInner = 50;

  let arcs = "";
  let startAngle = -Math.PI / 2;
  for (const s of segments) {
    const angle = (s.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    if (angle <= 0) { startAngle = endAngle; continue; }
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1o = cx + rOuter * Math.cos(startAngle);
    const y1o = cy + rOuter * Math.sin(startAngle);
    const x2o = cx + rOuter * Math.cos(endAngle);
    const y2o = cy + rOuter * Math.sin(endAngle);
    const x1i = cx + rInner * Math.cos(endAngle);
    const y1i = cy + rInner * Math.sin(endAngle);
    const x2i = cx + rInner * Math.cos(startAngle);
    const y2i = cy + rInner * Math.sin(startAngle);
    const d = `M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
    arcs += `<path d="${d}" fill="${s.color}"/>`;
    startAngle = endAngle;
  }

  // Centro
  const center = `
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="16" font-weight="bold" fill="${C.text}">CHF ${fmtCHF(total)}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="${FONT_SANS}" font-size="8" fill="${C.textMuted}" letter-spacing="1.5">TOTALE</text>`;

  // Legenda destra
  let legend = "";
  const lx = 230;
  let ly = 80;
  for (const s of segments) {
    const pct = ((s.value / total) * 100).toFixed(0);
    legend += `
      <rect x="${lx}" y="${ly}" width="12" height="12" fill="${s.color}" rx="1"/>
      <text x="${lx + 18}" y="${ly + 10}" font-family="${FONT_SERIF}" font-size="11" fill="${C.text}">${escapeXml(s.label)}</text>
      <text x="${lx + 18}" y="${ly + 24}" font-family="${FONT_SANS}" font-size="9" fill="${C.textMuted}">${pct}% · CHF ${fmtCHF(s.value)}</text>`;
    ly += 38;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fefcf7"/>
  <text x="15" y="22" font-family="${FONT_SERIF}" font-size="14" font-weight="bold" fill="${C.text}">Composizione Ricavi</text>
  ${arcs}
  ${center}
  ${legend}
</svg>`;
}

// ============================================================
// 3. Sparkline Podi
// ============================================================
export interface SparklinePodiData {
  stagioni: { nome: string; podi: number }[];
}

export function generateSparklinePodiSVG(data: SparklinePodiData): string {
  const W = 400, H = 150;
  const stagioni = data.stagioni.length ? data.stagioni : [
    { nome: "2022/23", podi: 0 },
    { nome: "2023/24", podi: 0 },
    { nome: "2024/25", podi: 0 },
    { nome: "2025/26", podi: 0 },
  ];

  const padL = 140, padR = 25, padT = 30, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxV = Math.max(1, ...stagioni.map(s => s.podi));

  const points = stagioni.map((s, i) => {
    const x = padL + (stagioni.length === 1 ? plotW / 2 : (i / (stagioni.length - 1)) * plotW);
    const y = padT + plotH - (s.podi / maxV) * plotH;
    return { x, y, s };
  });

  // Asse Y tratteggiato (3 linee)
  let gridY = "";
  for (let i = 0; i <= 2; i++) {
    const y = padT + (i / 2) * plotH;
    gridY += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="${C.neutralLight}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
  }

  // Ombra sotto
  const shadowPath = "M " + points.map(p => `${p.x} ${p.y + 3}`).join(" L ");
  // Linea principale
  const mainPath = "M " + points.map(p => `${p.x} ${p.y}`).join(" L ");

  let dots = "";
  for (const p of points) {
    dots += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${C.primary}" stroke="#ffffff" stroke-width="1.5"/>
      <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="10" font-weight="bold" fill="${C.text}">${p.s.podi}</text>
      <text x="${p.x}" y="${H - 10}" text-anchor="middle" font-family="${FONT_SANS}" font-size="8" fill="${C.textMuted}">${escapeXml(p.s.nome)}</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fefcf7"/>
  <text x="15" y="${padT - 4}" font-family="${FONT_SERIF}" font-size="13" font-weight="bold" fill="${C.text}">Trend Podi</text>
  <text x="15" y="${padT + 12}" font-family="${FONT_SANS}" font-size="9" fill="${C.textMuted}">4 stagioni</text>
  ${gridY}
  <path d="${shadowPath}" fill="none" stroke="${C.neutralLight}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
  <path d="${mainPath}" fill="none" stroke="${C.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  ${dots}
</svg>`;
}

// ============================================================
// 4. Heatmap Fasce Orarie
// ============================================================
export interface HeatmapFasceData {
  fasce: { ora: string; vendute: number }[];
}

export function generateHeatmapFasceSVG(data: HeatmapFasceData): string {
  const W = 400, H = 200;
  const fasce = data.fasce.length ? data.fasce : [
    { ora: "15-16", vendute: 0 },
    { ora: "16-17", vendute: 0 },
    { ora: "17-18", vendute: 0 },
    { ora: "18-19", vendute: 0 },
    { ora: "19-20", vendute: 0 },
    { ora: "20-21", vendute: 0 },
  ];

  const titleY = 22;
  const cellTop = 60;
  const cellH = 70;
  const padX = 20;
  const cellGap = 4;
  const cellW = (W - 2 * padX - cellGap * (fasce.length - 1)) / fasce.length;
  const maxV = Math.max(1, ...fasce.map(f => f.vendute));

  // scala teal: da chiaro (#ccfbf1) a scuro (#0f766e)
  function intensityColor(v: number): string {
    const t = v / maxV;
    // interpolazione tra #ccfbf1 (204,251,241) e #0f766e (15,118,110)
    const r = Math.round(204 + (15 - 204) * t);
    const g = Math.round(251 + (118 - 251) * t);
    const b = Math.round(241 + (110 - 241) * t);
    return `rgb(${r},${g},${b})`;
  }

  let cells = "";
  for (let i = 0; i < fasce.length; i++) {
    const f = fasce[i];
    const x = padX + i * (cellW + cellGap);
    const color = intensityColor(f.vendute);
    const textColor = (f.vendute / maxV) > 0.55 ? "#ffffff" : C.text;
    cells += `
      <rect x="${x}" y="${cellTop}" width="${cellW}" height="${cellH}" fill="${color}" rx="3"/>
      <text x="${x + cellW / 2}" y="${cellTop + cellH / 2 + 6}" text-anchor="middle" font-family="${FONT_SANS}" font-size="16" font-weight="bold" fill="${textColor}">${f.vendute}</text>
      <text x="${x + cellW / 2}" y="${cellTop + cellH + 16}" text-anchor="middle" font-family="${FONT_SANS}" font-size="9" fill="${C.textMuted}">${escapeXml(f.ora)}</text>`;
  }

  // Legenda colori in basso
  const legY = H - 18;
  let legend = `<text x="${padX}" y="${legY}" font-family="${FONT_SANS}" font-size="8" fill="${C.textMuted}">poche ore</text>`;
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const r = Math.round(204 + (15 - 204) * t);
    const g = Math.round(251 + (118 - 251) * t);
    const b = Math.round(241 + (110 - 241) * t);
    legend += `<rect x="${padX + 60 + i * 16}" y="${legY - 9}" width="14" height="10" fill="rgb(${r},${g},${b})"/>`;
  }
  legend += `<text x="${padX + 60 + 5 * 16 + 4}" y="${legY}" font-family="${FONT_SANS}" font-size="8" fill="${C.textMuted}">molte ore</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fefcf7"/>
  <text x="15" y="${titleY}" font-family="${FONT_SERIF}" font-size="14" font-weight="bold" fill="${C.text}">Saturazione Fasce Orarie</text>
  <text x="15" y="${titleY + 14}" font-family="${FONT_SANS}" font-size="9" fill="${C.textMuted}">ore vendute per fascia</text>
  ${cells}
  ${legend}
</svg>`;
}

// ============================================================
// 5. Bar Tariffe Istruttori
// ============================================================
export interface BarTariffeData {
  istruttori: { nome: string; tariffa: number; ore_vendute: number }[];
}

export function generateBarTariffeSVG(data: BarTariffeData): string {
  const W = 400, H = 250;
  const istruttori = data.istruttori.length ? data.istruttori : [
    { nome: "—", tariffa: 0, ore_vendute: 0 },
  ];

  const titleY = 22;
  const baseY = H - 50;
  const topY = 60;
  const plotH = baseY - topY;
  const maxTariffa = Math.max(1, ...istruttori.map(i => i.tariffa));
  const maxOre = Math.max(1, ...istruttori.map(i => i.ore_vendute));

  const slotW = (W - 40) / istruttori.length;
  const maxBarW = Math.min(80, slotW * 0.7);
  const minBarW = 18;

  let bars = "";
  for (let i = 0; i < istruttori.length; i++) {
    const it = istruttori[i];
    const slotCenter = 20 + slotW * i + slotW / 2;
    const barH = (it.tariffa / maxTariffa) * plotH;
    const barW = minBarW + (it.ore_vendute / maxOre) * (maxBarW - minBarW);
    const x = slotCenter - barW / 2;
    const y = baseY - barH;
    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${C.primary}" stroke="${C.primaryDark}" stroke-width="1" rx="2"/>
      <text x="${slotCenter}" y="${y - 6}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="11" font-weight="bold" fill="${C.text}">CHF ${it.tariffa}/h</text>
      <text x="${slotCenter}" y="${baseY + 16}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="11" fill="${C.text}">${escapeXml(it.nome)}</text>
      <text x="${slotCenter}" y="${baseY + 30}" text-anchor="middle" font-family="${FONT_SANS}" font-size="9" fill="${C.textMuted}">${it.ore_vendute} ore vendute</text>`;
  }

  // Linea base
  const baseLine = `<line x1="20" y1="${baseY}" x2="${W - 20}" y2="${baseY}" stroke="${C.neutralMid}" stroke-width="0.8"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fefcf7"/>
  <text x="15" y="${titleY}" font-family="${FONT_SERIF}" font-size="14" font-weight="bold" fill="${C.text}">Tariffe Istruttori e Volumi</text>
  <text x="15" y="${titleY + 14}" font-family="${FONT_SANS}" font-size="9" fill="${C.textMuted}">altezza = tariffa oraria · larghezza = ore vendute</text>
  ${baseLine}
  ${bars}
</svg>`;
}

// ============================================================
// Conversione SVG -> PNG bytes (client-side, canvas + canvg)
// ============================================================
export async function svgToPngBytes(svgString: string, width: number, height: number, scale = 2): Promise<Uint8Array> {
  if (typeof document === "undefined") {
    throw new Error("svgToPngBytes richiede ambiente browser (document non disponibile).");
  }
  const { Canvg } = await import("canvg");
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context non disponibile.");
  // sfondo cream coerente col PDF
  ctx.fillStyle = "#fefcf7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  const v = await Canvg.fromString(ctx, svgString, { ignoreDimensions: true });
  v.resize(width, height, "xMidYMid meet");
  await v.render();
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ============================================================
// Fetch dati per i grafici (con fallback su valori esempio)
// ============================================================
export interface ChartData {
  piramide: PiramideAtletiData;
  donut: DonutRicaviData;
  sparkline: SparklinePodiData;
  heatmap: HeatmapFasceData;
  bartariffe: BarTariffeData;
}

const DEFAULT_CHART_DATA: ChartData = {
  piramide: { pulcini: 32, stellina: 28, interbronzo: 24, bronzo: 22, interargento: 18, argento: 12, interoro: 6, oro: 3 },
  donut: { quote_corsi: 118000, pacchetti: 42000, lezioni_private: 48000, altro: 10400 },
  sparkline: { stagioni: [
    { nome: "2022/23", podi: 14 },
    { nome: "2023/24", podi: 19 },
    { nome: "2024/25", podi: 22 },
    { nome: "2025/26", podi: 27 },
  ]},
  heatmap: { fasce: [
    { ora: "15-16", vendute: 32 },
    { ora: "16-17", vendute: 58 },
    { ora: "17-18", vendute: 74 },
    { ora: "18-19", vendute: 81 },
    { ora: "19-20", vendute: 62 },
    { ora: "20-21", vendute: 41 },
  ]},
  bartariffe: { istruttori: [
    { nome: "Marta",   tariffa: 60, ore_vendute: 168 },
    { nome: "Davide",  tariffa: 45, ore_vendute: 142 },
    { nome: "Barbara", tariffa: 35, ore_vendute: 102 },
  ]},
};

function levelCategory(livello: string | null | undefined): keyof PiramideAtletiData | null {
  if (!livello) return "pulcini";
  const l = String(livello).toLowerCase();
  if (l.includes("oro") && l.includes("inter")) return "interoro";
  if (l.includes("oro")) return "oro";
  if (l.includes("argento") && l.includes("inter")) return "interargento";
  if (l.includes("argento")) return "argento";
  if (l.includes("bronzo") && l.includes("inter")) return "interbronzo";
  if (l.includes("bronzo")) return "bronzo";
  if (l.includes("stellin")) return "stellina";
  if (l.includes("pulcin")) return "pulcini";
  return "pulcini";
}

export async function fetchChartData(club_id: string, stagione_id: string): Promise<ChartData> {
  const out: ChartData = JSON.parse(JSON.stringify(DEFAULT_CHART_DATA));

  try {
    // PIRAMIDE: atleti per livello
    const { data: atleti } = await supabase
      .from("atleti").select("livello_attuale,attivo").eq("club_id", club_id).eq("attivo", true);
    if (atleti && atleti.length) {
      const p: PiramideAtletiData = { pulcini: 0, stellina: 0, interbronzo: 0, bronzo: 0, interargento: 0, argento: 0, interoro: 0, oro: 0 };
      for (const a of atleti as any[]) {
        const k = levelCategory(a.livello_attuale);
        if (k) p[k] += 1;
      }
      out.piramide = p;
    }
  } catch (e) { console.warn("[charts] piramide:", e); }

  try {
    // DONUT: cassa_movimenti tipo entrata
    const { data: mov } = await supabase
      .from("cassa_movimenti").select("tipo,importo,categoria").eq("club_id", club_id).eq("stagione_id", stagione_id);
    if (mov && mov.length) {
      let quote = 0, pacc = 0, lez = 0, altro = 0;
      for (const m of mov as any[]) {
        if (m.tipo !== "entrata") continue;
        const imp = Number(m.importo) || 0;
        const cat = String(m.categoria ?? "").toLowerCase();
        if (cat.includes("quota") || cat.includes("corso")) quote += imp;
        else if (cat.includes("pacch")) pacc += imp;
        else if (cat.includes("lezion")) lez += imp;
        else altro += imp;
      }
      const total = quote + pacc + lez + altro;
      if (total > 0) out.donut = { quote_corsi: quote, pacchetti: pacc, lezioni_private: lez, altro };
    }
  } catch (e) { console.warn("[charts] donut:", e); }

  try {
    // SPARKLINE: podi per stagione (ultime 4)
    const { data: stags } = await supabase
      .from("stagioni" as any).select("id,nome").eq("club_id", club_id).order("nome");
    if (stags && stags.length) {
      const lastFour = (stags as any[]).slice(-4);
      const ids = lastFour.map((s: any) => s.id);
      const { data: gare } = await supabase
        .from("gare_calendario").select("id,stagione_id").eq("club_id", club_id).in("stagione_id", ids);
      const gareByStag: Record<string, string[]> = {};
      for (const g of (gare as any[] ?? [])) {
        (gareByStag[g.stagione_id] ||= []).push(g.id);
      }
      const allGareIds = Object.values(gareByStag).flat();
      const podiByStag: Record<string, number> = {};
      if (allGareIds.length) {
        const { data: isc } = await supabase
          .from("iscrizioni_gare").select("medaglia,gara_id").in("gara_id", allGareIds);
        const gToS: Record<string, string> = {};
        for (const sid of ids) for (const gid of gareByStag[sid] ?? []) gToS[gid] = sid;
        for (const i of (isc as any[] ?? [])) {
          if (!i.medaglia) continue;
          const sid = gToS[i.gara_id]; if (!sid) continue;
          podiByStag[sid] = (podiByStag[sid] || 0) + 1;
        }
      }
      out.sparkline = { stagioni: lastFour.map((s: any) => ({ nome: s.nome, podi: podiByStag[s.id] || 0 })) };
    }
  } catch (e) { console.warn("[charts] sparkline:", e); }

  try {
    // HEATMAP: lezioni_private per fascia oraria (campo orario_inizio o data_ora)
    const { data: lez } = await supabase
      .from("lezioni_private").select("ora_inizio,durata_minuti,annullata").eq("club_id", club_id);
    if (lez && lez.length) {
      const buckets = ["15-16","16-17","17-18","18-19","19-20","20-21"];
      const counts: Record<string, number> = Object.fromEntries(buckets.map(b => [b, 0]));
      for (const l of lez as any[]) {
        if (l.annullata) continue;
        const t = String(l.ora_inizio ?? "");
        const h = parseInt(t.slice(0, 2), 10);
        if (isNaN(h)) continue;
        const ore = (Number(l.durata_minuti) || 60) / 60;
        const key = `${h}-${h+1}`;
        if (key in counts) counts[key] += ore;
      }
      const total = Object.values(counts).reduce((s, v) => s + v, 0);
      if (total > 0) out.heatmap = { fasce: buckets.map(b => ({ ora: b, vendute: Math.round(counts[b]) })) };
    }
  } catch (e) { console.warn("[charts] heatmap:", e); }

  try {
    // BAR TARIFFE: istruttori top con tariffa media e ore vendute
    const { data: lez2 } = await supabase
      .from("lezioni_private").select("istruttore_id,durata_minuti,annullata,prezzo").eq("club_id", club_id);
    if (lez2 && lez2.length) {
      const agg: Record<string, { ore: number; ricavi: number }> = {};
      for (const l of lez2 as any[]) {
        if (l.annullata || !l.istruttore_id) continue;
        const ore = (Number(l.durata_minuti) || 60) / 60;
        const a = (agg[l.istruttore_id] ||= { ore: 0, ricavi: 0 });
        a.ore += ore;
        a.ricavi += Number(l.prezzo) || 0;
      }
      const top = Object.entries(agg).sort((a, b) => b[1].ore - a[1].ore).slice(0, 3);
      if (top.length) {
        const ids = top.map(([id]) => id);
        const { data: istr } = await supabase.from("istruttori").select("id,nome,cognome").in("id", ids);
        const nameOf = (id: string) => {
          const r = (istr as any[] ?? []).find(x => x.id === id);
          return r ? (r.nome || r.cognome || "—") : "—";
        };
        out.bartariffe = { istruttori: top.map(([id, v]) => ({
          nome: nameOf(id),
          tariffa: Math.round(v.ore > 0 ? v.ricavi / v.ore : 0) || 40,
          ore_vendute: Math.round(v.ore),
        }))};
      }
    }
  } catch (e) { console.warn("[charts] bartariffe:", e); }

  return out;
}
