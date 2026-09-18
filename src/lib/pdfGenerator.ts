// Generatore del PDF della Relazione del Presidente.
// Documento a moduli: copertina, messaggio del presidente, indice, capitoli
// (testo + moduli dati veri), testi liberi, allegati, chiusura.
// Nessun dato di esempio: i moduli senza dati non arrivano fin qui.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import { supabase } from "@/lib/supabase";
import { fetchParagrafiForPdf, AREA_LABELS, type Tono } from "@/lib/paragraphGenerator";
import { fetchKpiData, type KpiData, type KpiCell } from "@/lib/kpiData";
import type { AreaId, ModuloRisultato, Stagione } from "@/lib/relazione/moduli";
import { renderGraficoSVG, svgToPngBytes, type RigaResoconto } from "@/lib/relazione/grafici";

// ── Geometria ───────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M_TOP = 60;
const M_BOTTOM = 60;
const M_LEFT = 70;
const M_RIGHT = 70;
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT;

const CREMA = rgb(0xfe / 255, 0xfc / 255, 0xf7 / 255);
const INCHIOSTRO = rgb(0.1, 0.1, 0.1);
const TENUE = rgb(0x47 / 255, 0x55 / 255, 0x69 / 255);
const FILO = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255);
const BIANCO = rgb(1, 1, 1);

function hexToRgb(hex?: string | null) {
  const h = String(hex ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return rgb(0x14 / 255, 0xb8 / 255, 0xa6 / 255);
  return rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
}

interface Fonts {
  serif: PDFFont; serifBold: PDFFont; serifItalic: PDFFont; sans: PDFFont; sansBold: PDFFont;
}

function sanitize(s: string): string {
  return (s ?? "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, "-").replace(/\u2026/g, "...")
    .replace(/[^\x00-\xff]/g, "?");
}

/**
 * Manda a capo sulle parole dentro la larghezza data. Una parola più lunga
 * della riga viene spezzata carattere per carattere: mai fuori dal margine,
 * mai troncata, mai con i puntini.
 */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const parole = sanitize(text).split(/\s+/).filter(Boolean);
  const righe: string[] = [];
  let cur = "";
  const spezzaParola = (p: string): string => {
    let resto = p;
    while (font.widthOfTextAtSize(resto, size) > maxWidth && resto.length > 1) {
      let taglio = 1;
      while (taglio < resto.length && font.widthOfTextAtSize(resto.slice(0, taglio + 1), size) <= maxWidth) taglio++;
      righe.push(resto.slice(0, taglio));
      resto = resto.slice(taglio);
    }
    return resto;
  };
  for (const p of parole) {
    const prova = cur ? cur + " " + p : p;
    if (font.widthOfTextAtSize(prova, size) > maxWidth && cur) {
      righe.push(cur);
      cur = font.widthOfTextAtSize(p, size) > maxWidth ? spezzaParola(p) : p;
    } else if (font.widthOfTextAtSize(prova, size) > maxWidth) {
      cur = spezzaParola(prova);
    } else {
      cur = prova;
    }
  }
  if (cur) righe.push(cur);
  return righe;
}

// ── Parametri ───────────────────────────────────────────────────

export type TipoVoce = "sistema" | "messaggio" | "sezione" | "modulo" | "blocco" | "allegato";

export interface VoceComposizione {
  id: string;            // "sis:copertina" | "messaggio" | "sez:atleti" | "mod:xxx" | "blo:<id>" | "all:<id>"
  tipo: TipoVoce;
  riferimento: string;   // copertina/indice/chiusura, area, id modulo, id riga
  titolo: string;
  payload?: any;
}

export interface GenerateRelazioneParams {
  club: any;
  presidente: string;
  stagione: Stagione;
  club_id: string;
  tono: Tono;
  messaggio?: string | null;
  voci: VoceComposizione[];              // già attive e ordinate
  moduli: Record<string, ModuloRisultato>;
}

// ── Disegno di base ─────────────────────────────────────────────

class Foglio {
  pdf: PDFDocument;
  fonts: Fonts;
  colore: ReturnType<typeof hexToRgb>;
  page!: PDFPage;
  y = 0;

  constructor(pdf: PDFDocument, fonts: Fonts, colore: ReturnType<typeof hexToRgb>) {
    this.pdf = pdf; this.fonts = fonts; this.colore = colore;
  }

  nuova(): PDFPage {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREMA });
    this.y = PAGE_H - M_TOP;
    return this.page;
  }

  spazio(necessario: number) {
    if (this.y - necessario < M_BOTTOM + 20) this.nuova();
  }

  titoloCapitolo(numero: number, titolo: string) {
    this.spazio(90);
    const kicker = sanitize(`CAPITOLO ${numero}`);
    this.page.drawText(kicker, { x: M_LEFT, y: this.y, size: 8, font: this.fonts.sansBold, color: this.colore });
    this.y -= 8;
    this.page.drawLine({
      start: { x: M_LEFT, y: this.y }, end: { x: M_LEFT + 100, y: this.y },
      thickness: 0.7, color: this.colore,
    });
    this.y -= 30;
    for (const ln of wrapText(titolo, this.fonts.serifBold, 26, CONTENT_W)) {
      this.spazio(30);
      this.page.drawText(ln, { x: M_LEFT, y: this.y, size: 26, font: this.fonts.serifBold, color: INCHIOSTRO });
      this.y -= 30;
    }
    this.y -= 8;
  }

  paragrafo(testo: string, opz?: { corsivo?: boolean; size?: number }) {
    if (!testo?.trim()) return;
    const size = opz?.size ?? 11;
    const font = opz?.corsivo ? this.fonts.serifItalic : this.fonts.serif;
    for (const ln of wrapText(testo, font, size, CONTENT_W)) {
      this.spazio(16);
      this.page.drawText(ln, { x: M_LEFT, y: this.y, size, font, color: INCHIOSTRO });
      this.y -= 16;
    }
    this.y -= 8;
  }

  nota(testo: string) {
    if (!testo?.trim()) return;
    for (const ln of wrapText(testo, this.fonts.serifItalic, 9.5, CONTENT_W)) {
      this.spazio(13);
      this.page.drawText(ln, { x: M_LEFT, y: this.y, size: 9.5, font: this.fonts.serifItalic, color: TENUE });
      this.y -= 13;
    }
    this.y -= 6;
  }

  kpi(celle: KpiCell[] | undefined) {
    if (!celle || celle.length === 0) return;
    const alte = 70;
    this.spazio(alte + 16);
    const larghezza = Math.min(460, CONTENT_W);
    const x0 = M_LEFT + (CONTENT_W - larghezza) / 2;
    const cellaW = larghezza / celle.length;
    const top = this.y - alte;
    this.page.drawRectangle({
      x: x0, y: top, width: larghezza, height: alte,
      color: CREMA, borderColor: FILO, borderWidth: 0.5,
    });
    celle.forEach((c, i) => {
      const cx = x0 + i * cellaW + cellaW / 2;
      if (i > 0) {
        this.page.drawLine({
          start: { x: x0 + i * cellaW, y: top + 10 }, end: { x: x0 + i * cellaW, y: top + alte - 10 },
          thickness: 0.4, color: FILO,
        });
      }
      let size = 22;
      const txt = sanitize(c.value);
      let w = this.fonts.serifBold.widthOfTextAtSize(txt, size);
      while (w > cellaW - 14 && size > 10) { size -= 1; w = this.fonts.serifBold.widthOfTextAtSize(txt, size); }
      this.page.drawText(txt, { x: cx - w / 2, y: top + 34, size, font: this.fonts.serifBold, color: this.colore });
      const lbl = sanitize(c.label.toUpperCase());
      const lw = this.fonts.sansBold.widthOfTextAtSize(lbl, 7.5);
      this.page.drawText(lbl, { x: cx - lw / 2, y: top + 16, size: 7.5, font: this.fonts.sansBold, color: TENUE });
    });
    this.y = top - 16;
  }

  /**
   * Tabella disegnata direttamente nel PDF: le celle vanno a capo su più righe,
   * la riga cresce di conseguenza e la tabella continua nella pagina seguente
   * ripetendo l'intestazione. Nessuna cella viene tagliata.
   */
  tabella(
    colonne: string[],
    righe: (string[] | RigaResoconto)[],
    allinea_destra: number[] = [],
    opz?: { colonna_nome?: number; prima_stretta?: boolean },
  ) {
    const ncol = Math.max(1, colonne.length);
    // Nel resoconto la prima colonna è la posizione: stretta, non il nome.
    const prima = ncol > 1 ? CONTENT_W * (opz?.prima_stretta ? 0.09 : 0.36) : CONTENT_W;
    const altre = ncol > 1 ? (CONTENT_W - prima) / (ncol - 1) : 0;
    const xdi = (i: number) => (i === 0 ? M_LEFT : M_LEFT + prima + (i - 1) * altre);
    const wdi = (i: number) => (i === 0 ? prima : altre);
    const corpo = 9.5;
    const passo = corpo + 3;

    const intestazione = () => {
      this.spazio(40);
      const alt = 16;
      this.page.drawRectangle({
        x: M_LEFT, y: this.y - alt + 4, width: CONTENT_W, height: alt, color: FILO,
      });
      colonne.forEach((c, i) => {
        const destra = allinea_destra.includes(i);
        const testo = sanitize(c);
        const w = this.fonts.sansBold.widthOfTextAtSize(testo, 8.5);
        const x = destra ? xdi(i) + wdi(i) - 4 - w : xdi(i) + 4;
        this.page.drawText(testo, { x, y: this.y, size: 8.5, font: this.fonts.sansBold, color: INCHIOSTRO });
      });
      this.y -= alt + 4;
    };

    intestazione();
    for (const riga_grezza of righe) {
      const riga: RigaResoconto = Array.isArray(riga_grezza) ? { celle: riga_grezza } : riga_grezza;
      // Riga di un'atleta del club: grassetto, nome nel colore del club e
      // triangolo pieno prima della posizione. Tre segni insieme, così si
      // riconosce anche su una stampa in bianco e nero.
      const evidenzia = riga.evidenzia === true;
      const font = evidenzia ? this.fonts.serifBold : this.fonts.serif;
      const rientro = (i: number) => (evidenzia && i === 0 ? 8 : 0);
      const celle = riga.celle.map((c, i) =>
        wrapText(String(c ?? ""), font, corpo, wdi(i) - 8 - rientro(i)));
      const alt_riga = Math.max(...celle.map((c) => c.length)) * passo + 4;
      if (this.y - alt_riga < M_BOTTOM + 20) {
        this.nuova();
        intestazione();
      }
      const y_riga = this.y;
      if (evidenzia) {
        this.page.drawSvgPath("M 0 0 L 5 2.6 L 0 5.2 Z", {
          x: xdi(0) + 3, y: y_riga + 7.5, color: this.colore, borderWidth: 0,
        });
      }
      celle.forEach((linee, i) => {
        const destra = allinea_destra.includes(i);
        const colore_cella = evidenzia && i === (opz?.colonna_nome ?? -1) ? this.colore : INCHIOSTRO;
        linee.forEach((ln, j) => {
          const w = font.widthOfTextAtSize(ln, corpo);
          const x = destra ? xdi(i) + wdi(i) - 4 - w : xdi(i) + 4 + rientro(i);
          this.page.drawText(ln, { x, y: y_riga - j * passo, size: corpo, font, color: colore_cella });
        });
      });
      this.y -= alt_riga;
      this.page.drawLine({
        start: { x: M_LEFT, y: this.y + passo - 4 }, end: { x: M_LEFT + CONTENT_W, y: this.y + passo - 4 },
        thickness: 0.4, color: FILO,
      });
    }
    this.y -= 12;
  }

  /** Intestazione della pagina di una gara: nome, data e luogo. */
  intestazioneGara(nome: string, dettagli?: string) {
    for (const ln of wrapText(nome, this.fonts.serifBold, 18, CONTENT_W)) {
      this.spazio(22);
      this.page.drawText(ln, { x: M_LEFT, y: this.y, size: 18, font: this.fonts.serifBold, color: INCHIOSTRO });
      this.y -= 22;
    }
    if (dettagli?.trim()) {
      for (const ln of wrapText(dettagli, this.fonts.sans, 9.5, CONTENT_W)) {
        this.spazio(13);
        this.page.drawText(ln, { x: M_LEFT, y: this.y, size: 9.5, font: this.fonts.sans, color: TENUE });
        this.y -= 13;
      }
    }
    this.page.drawLine({
      start: { x: M_LEFT, y: this.y + 4 }, end: { x: M_LEFT + CONTENT_W, y: this.y + 4 },
      thickness: 0.7, color: this.colore,
    });
    this.y -= 16;
  }

  /** Titolo di una categoria dentro la gara. */
  titoletto(testo: string) {
    for (const ln of wrapText(testo, this.fonts.serifBold, 11.5, CONTENT_W)) {
      this.spazio(30);
      this.page.drawText(ln, { x: M_LEFT, y: this.y, size: 11.5, font: this.fonts.serifBold, color: INCHIOSTRO });
      this.y -= 15;
    }
    this.y -= 3;
  }

  immagine(img: PDFImage, w: number, h: number) {
    // Il grafico non deve mai debordare: si riduce anche in altezza.
    const altezza_utile = PAGE_H - M_TOP - M_BOTTOM - 40;
    const scala = Math.min(1, CONTENT_W / w, altezza_utile / h);
    const fw = w * scala, fh = h * scala;
    this.spazio(fh + 20);
    const x = M_LEFT + (CONTENT_W - fw) / 2;
    this.page.drawRectangle({
      x: x - 6, y: this.y - fh - 6, width: fw + 12, height: fh + 12,
      borderColor: this.colore, borderWidth: 0.5,
    });
    this.page.drawImage(img, { x, y: this.y - fh, width: fw, height: fh });
    this.y -= fh + 22;
  }
}

// ── Generatore ──────────────────────────────────────────────────

let generazione_in_corso = false;

export async function generateRelazionePDF(
  params: GenerateRelazioneParams,
): Promise<{ blob: Blob; pages: number; avvisi: string[] }> {
  if (generazione_in_corso) throw new Error("Generazione già in corso. Attendi il completamento.");
  generazione_in_corso = true;
  const avvisi: string[] = [];
  try {
    const { club, presidente, stagione, club_id, tono, messaggio, voci, moduli } = params;
    const colore = hexToRgb(club?.colore_primario);

    let paragrafi: Record<string, Record<number, string>> = {};
    try {
      paragrafi = await fetchParagrafiForPdf(club_id, stagione.id, tono);
    } catch (e: any) {
      avvisi.push("I testi narrativi non sono stati letti: " + (e?.message ?? e));
    }

    let kpi: KpiData = {};
    try {
      kpi = await fetchKpiData(club_id, stagione);
    } catch (e: any) {
      avvisi.push("I numeri di sintesi non sono stati letti: " + (e?.message ?? e));
    }

    const pdf = await PDFDocument.create();
    pdf.setTitle(`Relazione - ${sanitize(club?.nome ?? "")} - ${sanitize(stagione.nome)}`);
    pdf.setAuthor(sanitize(presidente));
    pdf.setCreator("Ice Arena Manager");

    const fonts: Fonts = {
      serif: await pdf.embedFont(StandardFonts.TimesRoman),
      serifBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
      serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
      sans: await pdf.embedFont(StandardFonts.Helvetica),
      sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    };

    const oggi = new Date();
    const dataStr = `${String(oggi.getDate()).padStart(2, "0")}.${String(oggi.getMonth() + 1).padStart(2, "0")}.${oggi.getFullYear()}`;

    // Logo del club (bucket pubblico loghi-club)
    let logo: PDFImage | null = null;
    if (club?.logo_url) {
      try {
        const resp = await fetch(club.logo_url);
        if (resp.ok) {
          const bytes = new Uint8Array(await resp.arrayBuffer());
          logo = club.logo_url.toLowerCase().endsWith(".png")
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes).catch(async () => await pdf.embedPng(bytes));
        }
      } catch {
        avvisi.push("Il logo del club non è stato caricato nel documento.");
      }
    }

    // Immagini dei moduli attivi
    const immagini = new Map<string, { img: PDFImage; w: number; h: number }>();
    const voci_moduli = voci.filter((v) => v.tipo === "modulo");
    for (const v of voci_moduli) {
      const m = moduli[v.riferimento];
      if (!m || m.stato !== "ok" || !m.grafico) continue;
      // Le tabelle si disegnano native nel PDF (testo che va a capo e continua
      // nella pagina dopo), non come immagine.
      // Tabelle e resoconto si disegnano nativamente: mai come immagine.
      if (m.grafico.tipo === "tabella" || m.grafico.tipo === "resoconto") continue;
      try {
        const { svg, w, h } = renderGraficoSVG(m.grafico, club?.colore_primario ?? "#14b8a6");
        const bytes = await svgToPngBytes(svg, w, h, 2);
        const img = await pdf.embedPng(bytes);
        immagini.set(v.riferimento, { img, w, h });
      } catch (e: any) {
        avvisi.push(`Il grafico "${m.titolo}" non è stato disegnato: ${e?.message ?? e}`);
      }
    }

    const foglio = new Foglio(pdf, fonts, colore);
    const voci_indice: { titolo: string; pagina: number }[] = [];
    const vuole_indice = voci.some((v) => v.tipo === "sistema" && v.riferimento === "indice");
    const paginaCorrente = () => pdf.getPageCount();

    // ── Copertina ──
    if (voci.some((v) => v.tipo === "sistema" && v.riferimento === "copertina")) {
      const page = foglio.nuova();
      const banda = PAGE_H * 0.6;
      page.drawRectangle({ x: 0, y: PAGE_H - banda, width: PAGE_W, height: banda, color: colore });
      if (logo) {
        const lw = 90;
        const lh = (logo.height / logo.width) * lw;
        page.drawImage(logo, { x: (PAGE_W - lw) / 2, y: PAGE_H - 70 - lh, width: lw, height: lh });
      }
      const kicker = sanitize(`RELAZIONE DI FINE STAGIONE - ${stagione.nome}`).toUpperCase();
      page.drawText(kicker, { x: M_LEFT, y: PAGE_H - 40, size: 9, font: fonts.sansBold, color: BIANCO });
      const nome = sanitize(club?.nome ?? "Club");
      // Il nome del club non viene mai tagliato: se è lungo si rimpicciolisce
      // e va a capo, restando dentro la banda della copertina.
      let corpo_nome = 42;
      let righe_nome = wrapText(nome, fonts.serifBold, corpo_nome, PAGE_W - 120);
      while (righe_nome.length > 3 && corpo_nome > 20) {
        corpo_nome -= 4;
        righe_nome = wrapText(nome, fonts.serifBold, corpo_nome, PAGE_W - 120);
      }
      let ny = PAGE_H - banda / 2 + 20 + (righe_nome.length - 1) * (corpo_nome * 0.6);
      for (const ln of righe_nome) {
        const w = fonts.serifBold.widthOfTextAtSize(ln, corpo_nome);
        page.drawText(ln, { x: (PAGE_W - w) / 2, y: ny, size: corpo_nome, font: fonts.serifBold, color: BIANCO });
        ny -= corpo_nome * 1.15;
      }
      const citta = sanitize(String(club?.citta ?? "").toUpperCase());
      if (citta) {
        const cw = fonts.sansBold.widthOfTextAtSize(citta, 10);
        page.drawText(citta, { x: (PAGE_W - cw) / 2, y: ny - 10, size: 10, font: fonts.sansBold, color: BIANCO });
      }
      const basso = PAGE_H - banda - 60;
      page.drawText("PRESENTATA DA", { x: M_LEFT, y: basso, size: 9, font: fonts.sansBold, color: TENUE });
      page.drawText(sanitize(presidente || "Il Presidente"), {
        x: M_LEFT, y: basso - 30, size: 20, font: fonts.serifBold, color: INCHIOSTRO,
      });
      page.drawText(`Documento generato il ${dataStr}`, {
        x: M_LEFT, y: 60, size: 10, font: fonts.sans, color: TENUE,
      });
    }

    const segnaIndice = (titolo: string) => voci_indice.push({ titolo, pagina: paginaCorrente() });

    // ── Messaggio del presidente (prima pagina dopo la copertina) ──
    if (messaggio && messaggio.trim() && voci.some((v) => v.tipo === "messaggio")) {
      foglio.nuova();
      segnaIndice("Il messaggio del presidente");
      foglio.page.drawText("IL MESSAGGIO DEL PRESIDENTE", {
        x: M_LEFT, y: foglio.y, size: 8, font: fonts.sansBold, color: colore,
      });
      foglio.y -= 8;
      foglio.page.drawLine({
        start: { x: M_LEFT, y: foglio.y }, end: { x: M_LEFT + 100, y: foglio.y },
        thickness: 0.7, color: colore,
      });
      foglio.y -= 34;
      for (const blocco of messaggio.split(/\n{2,}/)) {
        foglio.paragrafo(blocco.replace(/\n/g, " "), { size: 12 });
      }
      foglio.y -= 10;
      const firma = sanitize(presidente || "");
      if (firma) {
        foglio.spazio(30);
        const w = fonts.serifItalic.widthOfTextAtSize(firma, 12);
        foglio.page.drawText(firma, {
          x: M_LEFT + CONTENT_W - w, y: foglio.y, size: 12, font: fonts.serifItalic, color: TENUE,
        });
      }
    }

    // ── Capitoli, testi liberi, allegati ──
    let numero_capitolo = 0;
    const allegati_non_uniti: { titolo: string; motivo: string }[] = [];

    const voci_per_area = new Map<AreaId, VoceComposizione[]>();
    for (const v of voci_moduli) {
      const m = moduli[v.riferimento];
      if (!m) continue;
      const lista = voci_per_area.get(m.area) ?? [];
      lista.push(v);
      voci_per_area.set(m.area, lista);
    }

    for (const voce of voci) {
      if (voce.tipo === "sistema" || voce.tipo === "messaggio" || voce.tipo === "modulo") continue;

      if (voce.tipo === "sezione") {
        const area = voce.riferimento as AreaId;
        const testi = paragrafi[area] ?? {};
        const moduli_area = (voci_per_area.get(area) ?? []).filter((v) => moduli[v.riferimento]?.stato === "ok");
        const ha_testo = Boolean(testi[1] || testi[2]);
        if (!ha_testo && moduli_area.length === 0) continue;

        numero_capitolo++;
        foglio.nuova();
        const titolo = AREA_LABELS[area] ?? voce.titolo;
        segnaIndice(`${numero_capitolo}. ${titolo}`);
        foglio.titoloCapitolo(numero_capitolo, titolo);
        if (testi[1]) foglio.paragrafo(testi[1], { corsivo: true, size: 11.5 });
        foglio.kpi(kpi[area]);
        if (testi[2]) foglio.paragrafo(testi[2]);
        for (const v of moduli_area) {
          const m = moduli[v.riferimento];
          if (m?.stato === "ok" && m.grafico?.tipo === "tabella") {
            foglio.paragrafo(m.grafico.titolo ?? m.titolo, { size: 12 });
            foglio.tabella(m.grafico.colonne ?? [], m.grafico.righe ?? [], m.grafico.allinea_destra ?? []);
            if (m.grafico.didascalia) foglio.nota(m.grafico.didascalia);
            continue;
          }
          // Resoconto tecnico: una pagina per gara, tabelle native per categoria.
          if (m?.stato === "ok" && m.grafico?.tipo === "resoconto") {
            foglio.paragrafo(m.grafico.titolo ?? m.titolo, { size: 12 });
            if (m.grafico.didascalia) foglio.nota(m.grafico.didascalia);
            for (const gara of m.grafico.gare) {
              foglio.nuova();
              foglio.intestazioneGara(gara.titolo, gara.sottotitolo);
              for (const tab of gara.tabelle) {
                foglio.titoletto(tab.titolo);
                foglio.tabella(tab.colonne, tab.righe, tab.allinea_destra ?? [], {
                  colonna_nome: tab.colonna_nome, prima_stretta: true,
                });
                if (tab.sintesi) foglio.nota(tab.sintesi);
              }
              if (gara.nota) foglio.nota(gara.nota);
            }
            continue;
          }
          const img = immagini.get(v.riferimento);
          if (img) foglio.immagine(img.img, img.w, img.h);
        }
        continue;
      }

      if (voce.tipo === "blocco") {
        const b = voce.payload ?? {};
        const contenuto = String(b.contenuto ?? "").trim();
        if (!contenuto) continue;
        numero_capitolo++;
        foglio.nuova();
        segnaIndice(`${numero_capitolo}. ${voce.titolo}`);
        foglio.titoloCapitolo(numero_capitolo, voce.titolo);
        for (const p of contenuto.split(/\n{2,}/)) foglio.paragrafo(p.replace(/\n/g, " "), { size: 11.5 });
        continue;
      }

      if (voce.tipo === "allegato") {
        const a = voce.payload ?? {};
        const bytes = await scaricaAllegato(a);
        if (bytes) {
          try {
            const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const copiate = await pdf.copyPages(src, src.getPageIndices());
            voci_indice.push({ titolo: `${voce.titolo} (allegato)`, pagina: paginaCorrente() + 1 });
            copiate.forEach((p) => pdf.addPage(p));
            continue;
          } catch {
            allegati_non_uniti.push({ titolo: voce.titolo, motivo: "il file non è un PDF leggibile" });
          }
        } else {
          allegati_non_uniti.push({ titolo: voce.titolo, motivo: "il file non è disponibile" });
        }
      }
    }

    // ── Elenco degli allegati non uniti (senza promesse false) ──
    if (allegati_non_uniti.length > 0) {
      foglio.nuova();
      segnaIndice("Elenco degli allegati");
      foglio.titoloCapitolo(++numero_capitolo, "Elenco degli allegati");
      foglio.nota("Questi documenti fanno parte della relazione ma non sono stati uniti al presente file.");
      for (const a of allegati_non_uniti) {
        foglio.spazio(18);
        foglio.page.drawText(sanitize(`• ${a.titolo} — ${a.motivo}`), {
          x: M_LEFT, y: foglio.y, size: 11, font: fonts.serif, color: INCHIOSTRO,
        });
        foglio.y -= 18;
      }
    }

    // ── Chiusura ──
    if (voci.some((v) => v.tipo === "sistema" && v.riferimento === "chiusura")) {
      const page = foglio.nuova();
      const banda = PAGE_H * 0.3;
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: banda, color: colore });
      const cx = PAGE_W / 2;
      const nome = sanitize(club?.nome ?? "Club");
      const nw = fonts.serifBold.widthOfTextAtSize(nome, 18);
      page.drawText(nome, { x: cx - nw / 2, y: banda + 200, size: 18, font: fonts.serifBold, color: INCHIOSTRO });
      const sub = sanitize(`RELAZIONE DEL PRESIDENTE - STAGIONE ${stagione.nome}`).toUpperCase();
      const sw = fonts.sansBold.widthOfTextAtSize(sub, 9);
      page.drawText(sub, { x: cx - sw / 2, y: banda + 180, size: 9, font: fonts.sansBold, color: TENUE });
      const dt = sanitize(`DOCUMENTO GENERATO IL ${dataStr}`);
      const dw = fonts.sansBold.widthOfTextAtSize(dt, 9);
      page.drawText(dt, { x: cx - dw / 2, y: banda / 2, size: 9, font: fonts.sansBold, color: BIANCO });
    }

    // ── Indice: inserito dopo la copertina, numeri ricalcolati ──
    if (vuole_indice && voci_indice.length > 0) {
      const per_pagina = 26;
      const pagine_indice = Math.max(1, Math.ceil(voci_indice.length / per_pagina));
      const posizione = pdf.getPageCount() > 0 ? 1 : 0;
      const nuove: PDFPage[] = [];
      for (let i = 0; i < pagine_indice; i++) {
        nuove.push(pdf.insertPage(posizione + i, [PAGE_W, PAGE_H]));
      }
      const voci_spostate = voci_indice.map((v) => ({ ...v, pagina: v.pagina + pagine_indice }));
      nuove.forEach((page, i) => {
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREMA });
        let y = PAGE_H - M_TOP;
        page.drawText("INDICE", { x: M_LEFT, y, size: 9, font: fonts.sansBold, color: colore });
        y -= 8;
        page.drawLine({ start: { x: M_LEFT, y }, end: { x: M_LEFT + CONTENT_W, y }, thickness: 0.4, color: colore });
        y -= 34;
        for (const e of voci_spostate.slice(i * per_pagina, (i + 1) * per_pagina)) {
          const titolo = sanitize(e.titolo);
          const num = String(e.pagina);
          page.drawText(titolo, { x: M_LEFT, y, size: 12, font: fonts.serif, color: INCHIOSTRO });
          const numW = fonts.serif.widthOfTextAtSize(num, 12);
          page.drawText(num, { x: M_LEFT + CONTENT_W - numW, y, size: 12, font: fonts.serif, color: INCHIOSTRO });
          y -= 20;
        }
      });
    }

    // ── Numeri di pagina (dopo l'inserimento dell'indice) ──
    pdf.getPages().forEach((page, i) => {
      if (i === 0) return;
      const txt = `- ${i + 1} -`;
      const w = fonts.sans.widthOfTextAtSize(txt, 9);
      page.drawText(txt, { x: (PAGE_W - w) / 2, y: 30, size: 9, font: fonts.sans, color: TENUE });
    });

    const bytes = await pdf.save();
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    return { blob, pages: pdf.getPageCount(), avvisi };
  } finally {
    generazione_in_corso = false;
  }
}

/** Scarica il PDF di un allegato: link pubblico oppure percorso nel bucket privato. */
async function scaricaAllegato(allegato: any): Promise<ArrayBuffer | null> {
  const riferimento: string = String(allegato?.file_url ?? "");
  if (!riferimento || riferimento.startsWith("placeholder://")) return null;
  try {
    if (/^https?:\/\//i.test(riferimento)) {
      const resp = await fetch(riferimento);
      return resp.ok ? await resp.arrayBuffer() : null;
    }
    const { data, error } = await supabase.storage
      .from("relazioni-allegati").createSignedUrl(riferimento, 600);
    if (error || !data?.signedUrl) return null;
    const resp = await fetch(data.signedUrl);
    return resp.ok ? await resp.arrayBuffer() : null;
  } catch {
    return null;
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
