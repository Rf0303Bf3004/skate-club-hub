// Esportazione della Relazione in PowerPoint (.pptx) per l'assemblea.
// Stessa composizione e stesse fonti dati del PDF: i moduli accesi, il loro
// ordine e il tono valgono per tutti e due i formati. Nessun numero ricalcolato
// in modo diverso, nessuna query nuova (l'unica lettura in più è la foto delle
// atlete, e solo quando l'interruttore dedicato è acceso).
//
// Regole di composizione delle slide:
//  - nessun testo sotto i 18 punti, nessuna riga tagliata, nessun puntino:
//    se il contenuto non entra, si aggiunge una slide "(continua)";
//  - i grafici sono grafici veri di PowerPoint (serie e valori), non immagini,
//    così chi riceve il file può modificarli;
//  - i moduli spenti o senza dati non producono slide.

import PptxGenJS from "pptxgenjs";
import i18n from "@/i18n";
import { fetchParagrafiForPdf, sincronizzaParagrafi, AREA_LABELS, type Tono } from "@/lib/paragraphGenerator";
import { fetchKpiData, type KpiData } from "@/lib/kpiData";
import { fetchCamminoAtlete, type AreaId, type ModuloRisultato, type Stagione } from "@/lib/relazione/moduli";
import type { GraficoSpec, RigaResoconto } from "@/lib/relazione/grafici";
import { firma_foto_atleta } from "@/hooks/useSignedPhoto";
import type { VoceComposizione } from "@/lib/pdfGenerator";

const ts = (chiave: string, opzioni?: Record<string, unknown>) =>
  i18n.t(`relazione.slide.${chiave}`, { ns: "dashboard", ...(opzioni ?? {}) }) as string;
const tr = (chiave: string) => i18n.t(`relazione.resoconto.${chiave}`, { ns: "dashboard" }) as string;

// ── Geometria della slide (16:9, pollici) ───────────────────────
const SLIDE_W = 10;
const SLIDE_H = 5.625;
const MARGINE = 0.5;
const CONTENUTO_W = SLIDE_W - MARGINE * 2;
const CORPO_PT = 18;          // minimo assoluto: mai sotto
const TITOLO_PT = 30;
const DIDASCALIA_PT = 18;

const INCHIOSTRO = "1F2937";
const TENUE = "475569";
const GRIGIO_ALTRI = "6B7280";
const SFONDO = "FEFCF7";
const FILO = "E2E8F0";
const BIANCO = "FFFFFF";

export interface GeneraSlideParams {
  club: any;
  presidente: string;
  stagione: Stagione;
  club_id: string;
  tono: Tono;
  messaggio?: string | null;
  voci: VoceComposizione[];              // già attive e ordinate
  moduli: Record<string, ModuloRisultato>;
  /** Slide per atleta con la foto: spenta di default, riguarda minorenni. */
  con_foto_atlete?: boolean;
}

function coloreClub(hex?: string | null): string {
  const h = String(hex ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h.slice(1).toUpperCase() : "14B8A6";
}

/** Stessa tinta schiarita: la seconda serie non introduce un colore nuovo. */
function schiarisci(hex: string, quota = 0.45): string {
  const n = parseInt(hex, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * quota);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Righe stimate di un testo dentro una larghezza, al corpo indicato. */
function righe_stimate(testo: string, larghezza_in: number, corpo_pt: number): number {
  const utile = Math.max(0.4, larghezza_in - 0.22);   // margini interni della cella
  const per_riga = Math.max(6, Math.floor((utile * 96) / (corpo_pt * 0.72)));
  return (testo ?? "").split("\n").reduce(
    (tot, riga) => tot + Math.max(1, Math.ceil(riga.length / per_riga)), 0,
  );
}

function data_oggi(): string {
  return new Intl.DateTimeFormat(i18n.language || "it", { dateStyle: "long" }).format(new Date());
}

// ── Impaginazione ───────────────────────────────────────────────

class Mazzo {
  pptx: PptxGenJS;
  colore: string;
  colore_chiaro: string;

  constructor(colore: string) {
    this.pptx = new PptxGenJS();
    this.pptx.layout = "LAYOUT_16x9";
    this.colore = colore;
    this.colore_chiaro = schiarisci(colore);
  }

  /** Slide di contenuto con il titolo in alto e il filetto del club. */
  nuova(titolo?: string) {
    const slide = this.pptx.addSlide();
    slide.background = { color: SFONDO };
    if (titolo) {
      slide.addText(titolo, {
        x: MARGINE, y: 0.32, w: CONTENUTO_W, h: 0.75,
        fontSize: TITOLO_PT, bold: true, color: INCHIOSTRO, fontFace: "Georgia",
        align: "left", valign: "top", shrinkText: false, margin: 0,
      });
      slide.addShape("line", {
        x: MARGINE, y: 1.14, w: 1.6, h: 0,
        line: { color: this.colore, width: 2 },
      });
    }
    return slide;
  }

  /** Didascalia sotto un contenuto: stessa frase del documento. */
  didascalia(slide: PptxGenJS.Slide, testo?: string) {
    if (!testo?.trim()) return;
    slide.addText(testo, {
      x: MARGINE, y: SLIDE_H - 1.0, w: CONTENUTO_W, h: 0.7,
      fontSize: DIDASCALIA_PT, italic: true, color: TENUE, fontFace: "Calibri",
      valign: "top", shrinkText: false, margin: 0,
    });
  }
}

// ── Tabelle: quante righe entrano in una slide ──────────────────

const ALTEZZA_TABELLA = 3.8;          // pollici disponibili sotto il titolo
const ALTEZZA_RIGA = 0.5;            // riga a 18 punti, una linea di testo

interface RigaTabella {
  celle: string[];
  evidenzia?: boolean;
}

/**
 * Spezza le righe in gruppi che stanno in una slide: si contano le righe di
 * testo di ogni cella, così un nome lungo che va a capo occupa lo spazio che
 * gli serve invece di uscire dal bordo.
 */
function gruppi_righe(righe: RigaTabella[], larghezze: number[]): RigaTabella[][] {
  // l'intestazione occupa la sua riga: si toglie dalla capienza
  const capienza = Math.max(2, Math.floor((ALTEZZA_TABELLA - ALTEZZA_RIGA) / ALTEZZA_RIGA));
  const gruppi: RigaTabella[][] = [];
  let corrente: RigaTabella[] = [];
  let usate = 0;
  for (const riga of righe) {
    const alt = Math.max(
      1, ...riga.celle.map((c, i) => righe_stimate(String(c ?? ""), larghezze[i] ?? 2, CORPO_PT)),
    );
    if (corrente.length > 0 && usate + alt > capienza) {
      gruppi.push(corrente);
      corrente = [];
      usate = 0;
    }
    corrente.push(riga);
    usate += alt;
  }
  if (corrente.length > 0) gruppi.push(corrente);
  return gruppi;
}

/**
 * Larghezze proporzionali al contenuto: una colonna con nomi lunghi riceve lo
 * spazio che le serve, così le celle vanno a capo poco e la tabella non si
 * spezza su una riga per slide.
 */
function larghezze_colonne(
  colonne: string[], righe: RigaTabella[], prima_stretta = false,
): number[] {
  const ncol = colonne.length;
  if (ncol <= 1) return [CONTENUTO_W];
  const CARATTERE = (CORPO_PT * 0.64) / 96;   // larghezza di un carattere, in pollici
  const contenuto = colonne.map((c, i) =>
    [String(c ?? ""), ...righe.map((r) => String(r.celle[i] ?? ""))]);

  // Ogni colonna deve almeno contenere la sua parola più lunga: una parola
  // non va mai spezzata a metà per far stare la tabella.
  const minimi = contenuto.map((celle) => {
    // l'intestazione è in grassetto: conta per un 15% in più
    const parole = celle.flatMap((t, idx) =>
      t.split(/\s+/).map((p) => p.length * (idx === 0 ? 1.15 : 1)));
    const parola = Math.max(3, ...parole);
    return Math.min(CONTENUTO_W * 0.45, Math.max(0.6, parola * CARATTERE + 0.34));
  });

  const pesi = contenuto.map((celle, i) =>
    prima_stretta && i === 0 ? 5 : Math.min(42, Math.max(8, ...celle.map((t) => t.length))));

  const somma = pesi.reduce((s, p) => s + p, 0);
  let larghezze = pesi.map((p) => (CONTENUTO_W * p) / somma);
  // Le colonne sotto il minimo vengono alzate; lo spazio si toglie alle altre.
  for (let giro = 0; giro < ncol; giro++) {
    const sotto = larghezze.map((w, i) => w < minimi[i]);
    if (!sotto.some(Boolean)) break;
    const fisso = minimi.reduce((s, m, i) => s + (sotto[i] ? m : 0), 0);
    const resto = Math.max(0.5, CONTENUTO_W - fisso);
    const peso_resto = pesi.reduce((s, p, i) => s + (sotto[i] ? 0 : p), 0) || 1;
    larghezze = larghezze.map((w, i) =>
      sotto[i] ? minimi[i] : (resto * pesi[i]) / peso_resto);
  }
  const totale = larghezze.reduce((s, w) => s + w, 0);
  return larghezze.map((w) => (w * CONTENUTO_W) / totale);
}



function titolo_continua(titolo: string, indice: number): string {
  return indice === 0 ? titolo : `${titolo} ${ts("continua")}`;
}

/** Tabella su una o più slide, senza mai rimpicciolire il testo. */
function aggiungiTabella(
  mazzo: Mazzo,
  titolo: string,
  colonne: string[],
  righe: RigaTabella[],
  opz?: {
    allinea_destra?: number[];
    prima_stretta?: boolean;
    colonna_nome?: number;
    didascalia?: string;
    sottotitolo?: string;
    /** Riga di legenda ripetuta su ogni slide della tabella. */
    nota?: string;
  },
) {
  if (righe.length === 0) return;
  const larghezze = larghezze_colonne(colonne, righe, opz?.prima_stretta);
  const destra = opz?.allinea_destra ?? [];
  const gruppi = gruppi_righe(righe, larghezze);

  gruppi.forEach((gruppo, indice) => {
    const slide = mazzo.nuova(titolo_continua(titolo, indice));
    if (indice === 0 && opz?.sottotitolo) {
      slide.addText(opz.sottotitolo, {
        x: MARGINE, y: 1.2, w: CONTENUTO_W, h: 0.34,
        fontSize: DIDASCALIA_PT, color: TENUE, fontFace: "Calibri", margin: 0, shrinkText: false,
      });
    }
    const y = indice === 0 && opz?.sottotitolo ? 1.62 : 1.35;
    const intestazione = colonne.map((c, i) => ({
      text: c,
      options: {
        bold: true, color: INCHIOSTRO, fill: { color: FILO },
        align: (destra.includes(i) ? "right" : "left") as "right" | "left",
      },
    }));
    const corpo = gruppo.map((r) =>
      r.celle.map((c, i) => ({
        text: String(c ?? ""),
        options: {
          bold: r.evidenzia === true,
          // Le atlete del club: grassetto, colore del club sul nome e segno
          // prima della posizione. Gli altri club restano in grigio.
          color: r.evidenzia
            ? (i === (opz?.colonna_nome ?? -1) ? mazzo.colore : INCHIOSTRO)
            : GRIGIO_ALTRI,
          align: (destra.includes(i) ? "right" : "left") as "right" | "left",
        },
      })),
    );
    slide.addTable([intestazione, ...corpo], {
      x: MARGINE, y, w: CONTENUTO_W, colW: larghezze,
      fontSize: CORPO_PT, fontFace: "Calibri", color: INCHIOSTRO,
      border: { type: "solid", color: FILO, pt: 0.5 },
      valign: "top", autoPage: false,
    });
    const ultima = indice === gruppi.length - 1;
    const sotto = [ultima ? opz?.didascalia : undefined, opz?.nota]
      .filter((t) => !!t?.trim()).join("\n");
    mazzo.didascalia(slide, sotto);
  });
}

// ── Grafici veri di PowerPoint ──────────────────────────────────

function aggiungiGrafico(mazzo: Mazzo, grafico: GraficoSpec) {
  if (grafico.tipo === "tabella" || grafico.tipo === "resoconto") return;
  const dati = grafico.dati ?? [];
  if (dati.length === 0) return;

  const slide = mazzo.nuova(grafico.titolo);
  if (grafico.sottotitolo) {
    slide.addText(grafico.sottotitolo, {
      x: MARGINE, y: 1.2, w: CONTENUTO_W, h: 0.34,
      fontSize: DIDASCALIA_PT, color: TENUE, fontFace: "Calibri", margin: 0, shrinkText: false,
    });
  }
  const etichette = dati.map((d) => d.etichetta);
  const serie: { name: string; labels: string[]; values: number[] }[] = [
    {
      name: (grafico as any).etichetta_serie1 ?? grafico.titolo,
      labels: etichette,
      values: dati.map((d) => Number(d.valore) || 0),
    },
  ];
  const ha_seconda = dati.some((d) => typeof d.valore2 === "number");
  if (ha_seconda) {
    serie.push({
      name: (grafico as any).etichetta_serie2 ?? "",
      labels: etichette,
      values: dati.map((d) => Number(d.valore2) || 0),
    });
  }

  const comuni = {
    x: MARGINE, y: grafico.sottotitolo ? 1.68 : 1.42,
    w: CONTENUTO_W, h: SLIDE_H - (grafico.sottotitolo ? 1.68 : 1.42) - 1.05,
    chartColors: [mazzo.colore, mazzo.colore_chiaro],
    showLegend: ha_seconda,
    legendPos: "b" as const,
    legendColor: INCHIOSTRO,
    // Regola dei 18 punti anche sui grafici: se le etichette si accavallano si
    // riduce il numero di etichette, mai il corpo del carattere.
    showValue: dati.length <= 8,
    dataLabelColor: INCHIOSTRO,
    dataLabelFontSize: CORPO_PT,
    catAxisLabelColor: INCHIOSTRO,
    valAxisLabelColor: INCHIOSTRO,
    catAxisLabelFontSize: CORPO_PT,
    valAxisLabelFontSize: CORPO_PT,
    catAxisLabelFrequency: Math.max(1, Math.ceil(dati.length / 8)),
    valGridLine: { color: FILO, style: "solid" as const, size: 1 },
  };

  if (grafico.tipo === "donut") {
    slide.addChart("doughnut", serie.slice(0, 1) as any, {
      ...comuni, showLegend: true, showPercent: false,
      chartColors: undefined,
    } as any);
  } else if (grafico.tipo === "linea") {
    slide.addChart("line", serie as any, { ...comuni, lineSmooth: false } as any);
  } else {
    slide.addChart("bar", serie as any, {
      ...comuni,
      barDir: grafico.orientamento === "orizzontale" ? "bar" : "col",
      barGrouping: grafico.impilate ? "stacked" : "clustered",
      barGapWidthPct: 120,
    } as any);
  }
  mazzo.didascalia(slide, grafico.didascalia);
}

// ── Resoconto tecnico delle gare ────────────────────────────────

function aggiungiResoconto(mazzo: Mazzo, grafico: Extract<GraficoSpec, { tipo: "resoconto" }>) {
  for (const gara of grafico.gare) {
    for (const tab of gara.tabelle) {
      const righe: RigaTabella[] = tab.righe.map((r: RigaResoconto) => ({
        celle: r.celle.map((c, i) => (r.evidenzia && i === 0 ? `▲ ${c}` : c)),
        evidenzia: r.evidenzia,
      }));
      aggiungiTabella(mazzo, `${gara.titolo} — ${tab.titolo}`, tab.colonne, righe, {
        allinea_destra: tab.allinea_destra, prima_stretta: true,
        colonna_nome: tab.colonna_nome, didascalia: tab.sintesi,
        sottotitolo: gara.sottotitolo, nota: ts("legenda_classifica"),
      });
    }
    // Dopo ogni gara, la slide con le sole atlete del club: al posto del club,
    // che qui è sempre lo stesso, si indica la categoria in cui hanno gareggiato.
    // L'intestazione è l'unione delle colonne di tutte le categorie: se una
    // categoria non ha un punteggio, quella cella resta vuota invece di
    // scivolare sotto l'intestazione di un'altra colonna.
    const colonne_unione: string[] = [];
    for (const tab of gara.tabelle) {
      for (const c of tab.colonne) if (!colonne_unione.includes(c)) colonne_unione.push(c);
    }
    const i_club = colonne_unione.findIndex((c) => c === tr("col_club"));
    const destra_unione = colonne_unione
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => gara.tabelle.some((t) => {
        const j = t.colonne.indexOf(c);
        return j >= 0 && (t.allinea_destra ?? []).includes(j);
      }))
      .map(({ i }) => i);
    const prima = gara.tabelle[0];
    const nome_colonna = prima && prima.colonna_nome != null ? prima.colonne[prima.colonna_nome] : undefined;
    const i_nome = nome_colonna ? colonne_unione.indexOf(nome_colonna) : -1;
    const nostre: RigaTabella[] = [];
    for (const tab of gara.tabelle) {
      for (const r of tab.righe) {
        if (!r.evidenzia) continue;
        const celle = colonne_unione.map((c) => {
          const j = tab.colonne.indexOf(c);
          return j >= 0 ? String(r.celle[j] ?? "") : "";
        });
        if (i_club >= 0) celle[i_club] = tab.titolo;
        nostre.push({ celle, evidenzia: true });
      }
    }
    if (nostre.length > 0 && colonne_unione.length > 0) {
      const colonne = [...colonne_unione];
      if (i_club >= 0) colonne[i_club] = ts("col_categoria");
      aggiungiTabella(mazzo, `${gara.titolo} — ${ts("le_nostre")}`, colonne, nostre, {
        allinea_destra: destra_unione, prima_stretta: true,
        colonna_nome: i_nome >= 0 ? i_nome : undefined,
        nota: ts("legenda_classifica"),
      });
    }

  }
}

// ── Generatore ──────────────────────────────────────────────────

let generazione_in_corso = false;

export async function generateRelazionePPTX(
  params: GeneraSlideParams,
): Promise<{ blob: Blob; slides: number; avvisi: string[] }> {
  if (generazione_in_corso) throw new Error(ts("gia_in_corso"));
  generazione_in_corso = true;
  const avvisi: string[] = [];
  try {
    const { club, presidente, stagione, club_id, tono, messaggio, voci, moduli } = params;
    const colore = coloreClub(club?.colore_primario);
    const mazzo = new Mazzo(colore);
    mazzo.pptx.title = `${i18n.t("relazione.title", { ns: "dashboard" })} - ${club?.nome ?? ""} - ${stagione.nome}`;
    mazzo.pptx.author = presidente;

    // Stessi testi del PDF: prima si riallineano ai dati di oggi.
    let paragrafi: Record<string, Record<number, string>> = {};
    try {
      await sincronizzaParagrafi(club_id, stagione, tono);
    } catch (e: any) {
      avvisi.push(ts("avviso_testi") + " " + (e?.message ?? e));
    }
    try {
      paragrafi = await fetchParagrafiForPdf(club_id, stagione.id, tono);
    } catch (e: any) {
      avvisi.push(ts("avviso_testi") + " " + (e?.message ?? e));
    }
    let kpi: KpiData = {};
    try {
      kpi = await fetchKpiData(club_id, stagione);
    } catch (e: any) {
      avvisi.push(ts("avviso_numeri") + " " + (e?.message ?? e));
    }

    // ── Copertina ──
    if (voci.some((v) => v.tipo === "sistema" && v.riferimento === "copertina")) {
      const slide = mazzo.pptx.addSlide();
      slide.background = { color: colore };
      if (club?.logo_url) {
        try {
          const dato = await scaricaImmagine(club.logo_url);
          if (dato) slide.addImage({ data: dato, x: SLIDE_W / 2 - 0.6, y: 0.45, w: 1.2, h: 1.2, sizing: { type: "contain", w: 1.2, h: 1.2 } });
        } catch {
          avvisi.push(ts("avviso_logo"));
        }
      }
      slide.addText(String(club?.nome ?? ""), {
        x: MARGINE, y: 1.95, w: CONTENUTO_W, h: 1.2,
        fontSize: 40, bold: true, color: BIANCO, fontFace: "Georgia", align: "center",
        valign: "middle", shrinkText: false, margin: 0,
      });
      slide.addText(`${i18n.t("relazione.title", { ns: "dashboard" })} — ${stagione.nome}`, {
        x: MARGINE, y: 3.2, w: CONTENUTO_W, h: 0.6,
        fontSize: 22, color: BIANCO, fontFace: "Calibri", align: "center", shrinkText: false, margin: 0,
      });
      slide.addText(ts("generato_il", { data: data_oggi() }), {
        x: MARGINE, y: 4.4, w: CONTENUTO_W, h: 0.5,
        fontSize: CORPO_PT, color: BIANCO, fontFace: "Calibri", align: "center", shrinkText: false, margin: 0,
      });
    }

    // ── Il messaggio del presidente, spezzato su più slide ──
    if (messaggio?.trim() && voci.some((v) => v.tipo === "messaggio")) {
      const titolo = i18n.t("relazione.documento.messaggio_titolo", { ns: "dashboard" }) as string;
      const capienza = 11;                 // righe di testo a 18 punti
      const blocchi = messaggio.split(/\n{2,}/).map((b) => b.replace(/\n/g, " ").trim()).filter(Boolean);
      const pagine: string[][] = [];
      let corrente: string[] = [];
      let usate = 0;
      for (const blocco of blocchi) {
        const alt = righe_stimate(blocco, CONTENUTO_W, CORPO_PT) + 1;
        if (corrente.length > 0 && usate + alt > capienza) {
          pagine.push(corrente); corrente = []; usate = 0;
        }
        if (alt > capienza) {
          // Un blocco più lungo di una slide: si spezza sulle frasi, mai a metà parola.
          const frasi = blocco.split(/(?<=[.!?])\s+/);
          let pezzo = "";
          for (const frase of frasi) {
            const prova = pezzo ? `${pezzo} ${frase}` : frase;
            if (righe_stimate(prova, CONTENUTO_W, CORPO_PT) + 1 > capienza && pezzo) {
              pagine.push([pezzo]); pezzo = frase;
            } else {
              pezzo = prova;
            }
          }
          if (pezzo) { corrente.push(pezzo); usate += righe_stimate(pezzo, CONTENUTO_W, CORPO_PT) + 1; }
          continue;
        }
        corrente.push(blocco);
        usate += alt;
      }
      if (corrente.length > 0) pagine.push(corrente);

      pagine.forEach((blocchi_pagina, indice) => {
        const slide = mazzo.nuova(titolo_continua(titolo, indice));
        slide.addText(blocchi_pagina.join("\n\n"), {
          x: MARGINE, y: 1.35, w: CONTENUTO_W, h: SLIDE_H - 1.35 - 0.8,
          fontSize: CORPO_PT + 2, color: INCHIOSTRO, fontFace: "Georgia",
          valign: "top", shrinkText: false, margin: 0, lineSpacingMultiple: 1.15,
        });
        if (indice === pagine.length - 1 && presidente) {
          slide.addText(presidente, {
            x: MARGINE, y: SLIDE_H - 0.85, w: CONTENUTO_W, h: 0.5,
            fontSize: CORPO_PT, italic: true, color: TENUE, fontFace: "Georgia",
            align: "right", shrinkText: false, margin: 0,
          });
        }
      });
    }

    // ── Capitoli: testo, grafici, tabelle, resoconto gare ──
    const voci_moduli = voci.filter((v) => v.tipo === "modulo");
    const per_area = new Map<AreaId, VoceComposizione[]>();
    for (const v of voci_moduli) {
      const m = moduli[v.riferimento];
      if (!m || m.stato !== "ok") continue;      // modulo spento o senza dati: nessuna slide
      const lista = per_area.get(m.area) ?? [];
      lista.push(v);
      per_area.set(m.area, lista);
    }

    for (const voce of voci) {
      if (voce.tipo !== "sezione") continue;
      const area = voce.riferimento as AreaId;
      const moduli_area = per_area.get(area) ?? [];
      const testi = paragrafi[area] ?? {};
      const testo_area = [testi[1], testi[2]].filter(Boolean).join("\n\n");
      if (moduli_area.length === 0 && !testo_area) continue;

      // Apertura del capitolo: titolo e testo, alla stessa misura del documento.
      const slide = mazzo.nuova(AREA_LABELS[area] ?? voce.titolo);
      if (testo_area) {
        slide.addText(testo_area, {
          x: MARGINE, y: 1.35, w: CONTENUTO_W, h: SLIDE_H - 2.0,
          fontSize: CORPO_PT, color: INCHIOSTRO, fontFace: "Georgia",
          valign: "top", shrinkText: false, margin: 0, lineSpacingMultiple: 1.15,
        });
      }
      const celle = kpi[area] ?? [];
      if (celle.length > 0) {
        const larghezza = CONTENUTO_W / celle.length;
        celle.forEach((c, i) => {
          slide.addText(c.value, {
            x: MARGINE + i * larghezza, y: SLIDE_H - 1.35, w: larghezza, h: 0.6,
            fontSize: 26, bold: true, color: colore, fontFace: "Georgia", align: "center",
            shrinkText: false, margin: 0,
          });
          slide.addText(c.label, {
            x: MARGINE + i * larghezza, y: SLIDE_H - 0.78, w: larghezza, h: 0.45,
            fontSize: CORPO_PT, color: TENUE, fontFace: "Calibri", align: "center",
            shrinkText: false, margin: 0,
          });
        });
      }

      for (const v of moduli_area) {
        const g = moduli[v.riferimento]?.grafico;
        if (!g) continue;
        if (g.tipo === "tabella") {
          if ((g.righe ?? []).length === 0) continue;
          aggiungiTabella(mazzo, g.titolo, g.colonne ?? [], (g.righe ?? []).map((r) => ({ celle: r })), {
            allinea_destra: g.allinea_destra, didascalia: g.didascalia, sottotitolo: g.sottotitolo,
          });
        } else if (g.tipo === "resoconto") {
          aggiungiResoconto(mazzo, g);
        } else {
          aggiungiGrafico(mazzo, g);
        }
      }
    }

    // ── Una slide per atleta con la foto (opzione spenta di default) ──
    if (params.con_foto_atlete) {
      try {
        const atlete = await fetchCamminoAtlete({ club_id, stagione, stagioni: [] });
        for (const a of atlete) {
          const slide = mazzo.nuova(a.nome);
          let con_foto = false;
          if (a.foto_path) {
            try {
              const url = await firma_foto_atleta(a.foto_path);
              const dato = url ? await scaricaImmagine(url) : null;
              if (dato) {
                slide.addImage({ data: dato, x: MARGINE, y: 1.35, w: 2.6, h: 3.2, sizing: { type: "contain", w: 2.6, h: 3.2 } });
                con_foto = true;
              }
            } catch {
              // Foto mancante o non leggibile: la slide esce comunque, senza foto.
            }
          }
          const x = con_foto ? MARGINE + 3.0 : MARGINE;
          const w = con_foto ? CONTENUTO_W - 3.0 : CONTENUTO_W;
          const righe = [
            `${tr("col_gare_disputate")}: ${a.gare_disputate}`,
            `${tr("col_miglior")}: ${a.miglior_piazzamento}`,
            `${tr("col_test_superati")}: ${a.test_superati}`,
            `${tr("col_livello")}: ${a.livello}`,
          ].join("\n");
          slide.addText(righe, {
            x, y: 1.5, w, h: 3.0,
            fontSize: CORPO_PT + 2, color: INCHIOSTRO, fontFace: "Calibri",
            valign: "top", shrinkText: false, margin: 0, lineSpacingMultiple: 1.4,
          });
        }
      } catch (e: any) {
        avvisi.push(ts("avviso_atlete") + " " + (e?.message ?? e));
      }
    }

    // ── Chiusura: i numeri della stagione ──
    if (voci.some((v) => v.tipo === "sistema" && v.riferimento === "chiusura")) {
      const slide = mazzo.nuova(ts("chiusura_titolo"));
      const tutte = Object.entries(kpi).flatMap(([area, celle]) =>
        celle.map((c) => ({ ...c, area: AREA_LABELS[area as AreaId] ?? area })),
      ).slice(0, 6);
      if (tutte.length > 0) {
        const colonne = Math.min(3, tutte.length);
        const larghezza = CONTENUTO_W / colonne;
        tutte.forEach((c, i) => {
          const riga = Math.floor(i / colonne);
          const x = MARGINE + (i % colonne) * larghezza;
          const y = 1.5 + riga * 1.7;
          slide.addText(c.value, {
            x, y, w: larghezza, h: 0.7, fontSize: 30, bold: true, color: colore,
            fontFace: "Georgia", align: "center", shrinkText: false, margin: 0,
          });
          slide.addText(`${c.label} · ${c.area}`, {
            x, y: y + 0.72, w: larghezza, h: 0.8, fontSize: CORPO_PT, color: TENUE,
            fontFace: "Calibri", align: "center", shrinkText: false, margin: 0,
          });
        });
      } else {
        slide.addText(ts("chiusura_senza_numeri"), {
          x: MARGINE, y: 1.5, w: CONTENUTO_W, h: 1,
          fontSize: CORPO_PT, color: TENUE, fontFace: "Calibri", shrinkText: false, margin: 0,
        });
      }
    }

    const blob = (await mazzo.pptx.write({ outputType: "blob" })) as Blob;
    return { blob, slides: (mazzo.pptx as any).slides?.length ?? 0, avvisi };
  } finally {
    generazione_in_corso = false;
  }
}

/** Scarica un'immagine e la restituisce in base64 per pptxgenjs. */
async function scaricaImmagine(url: string): Promise<string | null> {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const blob = await resp.blob();
  return await new Promise<string | null>((risolvi) => {
    const lettore = new FileReader();
    lettore.onload = () => risolvi(typeof lettore.result === "string" ? lettore.result : null);
    lettore.onerror = () => risolvi(null);
    lettore.readAsDataURL(blob);
  });
}

/** relazione_<club>_<stagione>.pptx, senza spazi né accenti. */
export function buildRelazioneSlideFilename(club_nome: string, stagione: string): string {
  const pulisci = (s: string) =>
    (s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return `relazione_${pulisci(club_nome) || "club"}_${pulisci(stagione) || "stagione"}.pptx`;
}
