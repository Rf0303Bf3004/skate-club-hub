// Generatore dei paragrafi narrativi della Relazione del Presidente.
// Regole: nessun numero inventato, nessuna frase che dia per scontato un fatto
// non presente nei dati. Se un dato manca, la frase che lo conterrebbe non viene
// scritta. Il confronto con l'anno prima usa la stagione immediatamente
// precedente per data e solo se quella stagione ha dati.

import { supabase } from "@/lib/supabase";
import i18n from "@/i18n";
import {
  AREE_ORDINATE, type AreaId, type Stagione,
  fetchStagioniOrdinate, stagionePrecedente,
} from "@/lib/relazione/moduli";

export type Tono = "soci" | "formale";

/** Aree narrative del documento, nell'ordine di stampa. */
export const AREE_NARRATIVE: AreaId[] = AREE_ORDINATE;

export const AREA_LABELS: Record<AreaId, string> = {
  atleti: "Le atlete",
  corsi: "Corsi e ghiaccio",
  economia: "Economia",
  lezioni: "Lezioni private",
  sportivo: "Attività sportiva",
  presenze: "Presenze",
  comunicazione: "Comunicazione",
  sponsor: "Sponsor",
};

export const ORDINE_LABELS: Record<number, string> = {
  1: "Apertura",
  2: "I numeri",
};

const fmt_n = (n: number) => new Intl.NumberFormat("it-CH").format(Math.round(n));
const fmt_chf = (n: number) =>
  "CHF " + new Intl.NumberFormat("it-CH", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmt_pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1).replace(".", ",") + "%";

function dentro(data: string | null | undefined, stag: Stagione): boolean {
  if (!stag.data_inizio || !stag.data_fine) return true;
  if (!data) return false;
  const d = String(data).slice(0, 10);
  return d >= stag.data_inizio && d <= stag.data_fine;
}

// ────────────────────────────────────────────────────────────────
// Dati narrativi: tutto opzionale. undefined = non lo sappiamo.
// ────────────────────────────────────────────────────────────────

export interface DatiNarrativi {
  club_nome: string;
  stagione_nome: string;
  stagione_prec_nome?: string;
  federazione?: string;
  atlete?: number;
  atlete_prec?: number;
  agoniste?: number;
  corsi?: number;
  iscrizioni?: number;
  ore_ghiaccio_disponibili?: number;
  ore_ghiaccio_usate?: number;
  fatturato?: number;
  incassato?: number;
  lezioni_numero?: number;
  lezioni_ore?: number;
  lezioni_incasso?: number;
  gare?: number;
  podi?: number;
  ori?: number;
  podi_atlete?: Array<{ nome: string; medaglia: string; gara: string }>;
  test_superati?: number;
  presenza_media?: number;
  messaggi_inviati?: number;
  messaggi_letti?: number;
  sponsor?: number;
  sponsor_valore?: number;
  sponsor_nomi?: string[];
  argenti?: number;
  bronzi?: number;
  /** Quante letture non sono riuscite: se > 0 i testi non si riscrivono. */
  letture_fallite?: number;
}

/** Swiss Ice Skating per i club svizzeri, FISG per quelli italiani, nessuna se il paese non è impostato. */
export function federazioneDelClub(club: any): string | undefined {
  const paese = String(club?.paese_iso ?? club?.paese ?? "").trim().toLowerCase();
  if (!paese) return undefined;
  if (["ch", "che", "svizzera", "suisse", "schweiz", "switzerland"].includes(paese)) return "Swiss Ice Skating";
  if (["it", "ita", "italia", "italy"].includes(paese)) return "FISG";
  return undefined;
}

export async function fetchDatiNarrativi(club_id: string, stagione: Stagione): Promise<DatiNarrativi> {
  const stagioni = await fetchStagioniOrdinate(club_id);
  const prec = stagionePrecedente(stagioni, stagione.id);

  const { data: club } = await supabase
    .from("clubs").select("nome,paese,paese_iso").eq("id", club_id).maybeSingle();

  const d: DatiNarrativi = {
    club_nome: (club as any)?.nome ?? "il club",
    stagione_nome: stagione.nome,
    federazione: federazioneDelClub(club),
  };

  try {
    const { data, error } = await supabase
      .from("atleti").select("id,agonista").eq("club_id", club_id).eq("attivo", true);
    if (error) throw error;
    const atleti = (data ?? []) as any[];
    if (atleti.length > 0) {
      d.atlete = atleti.length;
      const ag = atleti.filter((a) => a.agonista).length;
      if (ag > 0) d.agoniste = ag;
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  if (prec) {
    try {
      const { data, error } = await supabase
        .from("atleti_storici_stagioni").select("atleta_id,status")
        .eq("club_id", club_id).eq("stagione_id", prec.id).eq("status", "attivo");
      if (error) throw error;
      const n = (data ?? []).length;
      if (n > 0) { d.atlete_prec = n; d.stagione_prec_nome = prec.nome; }
    } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }
  }

  try {
    const { data, error } = await supabase
      .from("corsi").select("id,attivo,ora_inizio,ora_fine,usa_ghiaccio")
      .eq("club_id", club_id).eq("stagione_id", stagione.id);
    if (error) throw error;
    const attivi = ((data ?? []) as any[]).filter((c) => c.attivo !== false);
    if (attivi.length > 0) {
      d.corsi = attivi.length;
      const ore = attivi
        .filter((c) => c.usa_ghiaccio !== false && c.ora_inizio && c.ora_fine)
        .reduce((s, c) => {
          const [h1, m1] = String(c.ora_inizio).split(":").map(Number);
          const [h2, m2] = String(c.ora_fine).split(":").map(Number);
          return s + ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
        }, 0);
      if (ore > 0) d.ore_ghiaccio_usate = Math.round(ore);
      const { data: iscr } = await supabase
        .from("iscrizioni_corsi").select("corso_id,attiva").in("corso_id", attivi.map((c) => c.id));
      const n = ((iscr ?? []) as any[]).filter((i) => i.attiva !== false).length;
      if (n > 0) d.iscrizioni = n;
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  try {
    const { data, error } = await supabase
      .from("disponibilita_ghiaccio").select("ora_inizio,ora_fine,tipo,stagione_id").eq("club_id", club_id);
    if (error) throw error;
    const righe = ((data ?? []) as any[]).filter(
      (r) => (r.tipo ?? "ghiaccio") === "ghiaccio" && (!r.stagione_id || r.stagione_id === stagione.id),
    );
    if (righe.length > 0) {
      const ore = righe.reduce((s, r) => {
        const [h1, m1] = String(r.ora_inizio).split(":").map(Number);
        const [h2, m2] = String(r.ora_fine).split(":").map(Number);
        return s + ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
      }, 0);
      if (ore > 0) d.ore_ghiaccio_disponibili = Math.round(ore);
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  try {
    const { data, error } = await supabase
      .from("fatture").select("importo,data_emissione,data_pagamento,stato").eq("club_id", club_id);
    if (error) throw error;
    const fatture = ((data ?? []) as any[]).filter(
      (f) => f.stato !== "bozza" && f.stato !== "annullata" && dentro(f.data_emissione, stagione),
    );
    if (fatture.length > 0) {
      d.fatturato = fatture.reduce((s, f) => s + (Number(f.importo) || 0), 0);
      d.incassato = fatture.filter((f) => f.data_pagamento).reduce((s, f) => s + (Number(f.importo) || 0), 0);
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  try {
    const { data, error } = await supabase
      .from("lezioni_private").select("data,durata_minuti,costo_totale,annullata").eq("club_id", club_id);
    if (error) throw error;
    const lez = ((data ?? []) as any[]).filter((l) => !l.annullata && dentro(l.data, stagione));
    if (lez.length > 0) {
      d.lezioni_numero = lez.length;
      const ore = lez.reduce((s, l) => s + (Number(l.durata_minuti) || 0), 0) / 60;
      if (ore > 0) d.lezioni_ore = Math.round(ore);
      const inc = lez.reduce((s, l) => s + (Number(l.costo_totale) || 0), 0);
      if (inc > 0) d.lezioni_incasso = inc;
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  try {
    const { data: gare, error } = await supabase
      .from("gare_calendario").select("id,nome,data").eq("club_id", club_id).eq("stagione_id", stagione.id);
    if (error) throw error;
    const ids = ((gare ?? []) as any[]).map((g) => g.id);
    if (ids.length > 0) {
      d.gare = ids.length;
      const { data: iscr, error: err2 } = await supabase
        .from("iscrizioni_gare").select("atleta_id,posizione,medaglia,gara_id").in("gara_id", ids);
      if (err2) throw err2;
      const righe = (iscr ?? []) as any[];
       const podio = (i: any) => ["oro", "argento", "bronzo"].includes(String(i.medaglia ?? "").toLowerCase());
      const con_podio = righe.filter(podio);
      if (con_podio.length > 0) {
        d.podi = con_podio.length;
         const quante = (m: string) => righe.filter((i) => String(i.medaglia ?? "").toLowerCase() === m).length;
         d.ori = quante("oro");
         d.argenti = quante("argento");
         d.bronzi = quante("bronzo");
         const atleta_ids = Array.from(new Set(con_podio.map((i) => i.atleta_id).filter(Boolean)));
         const { data: atlete, error: err3 } = await supabase
           .from("atleti").select("id,nome,cognome").eq("club_id", club_id).in("id", atleta_ids);
         if (err3) throw err3;
         const nomi = new Map(((atlete ?? []) as any[]).map((a) => [a.id, `${a.nome ?? ""} ${a.cognome ?? ""}`.trim()]));
         const gare_per_id = new Map(((gare ?? []) as any[]).map((g) => [g.id, g]));
          if (con_podio.some((i) => !nomi.get(i.atleta_id))) throw new Error("Atleta del podio non trovata nel club");
          d.podi_atlete = con_podio
           .map((i) => ({
              nome: nomi.get(i.atleta_id) ?? "",
             medaglia: String(i.medaglia).toLowerCase(),
             gara: String(gare_per_id.get(i.gara_id)?.nome ?? "—"),
             data: String(gare_per_id.get(i.gara_id)?.data ?? ""),
           }))
           .sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome))
           .map(({ nome, medaglia, gara }) => ({ nome, medaglia, gara }));
      }
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  try {
    const { data: test, error } = await supabase
      .from("test_livello").select("id").eq("club_id", club_id).eq("stagione_id", stagione.id);
    if (error) throw error;
    const ids = ((test ?? []) as any[]).map((t) => t.id);
    if (ids.length > 0) {
      const { data: righe, error: err2 } = await supabase
        .from("test_livello_atleti").select("esito").in("test_id", ids);
      if (err2) throw err2;
      const superati = ((righe ?? []) as any[]).filter(
        (r) => String(r.esito ?? "").toLowerCase().includes("superat"),
      ).length;
      if (superati > 0) d.test_superati = superati;
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  try {
    const { data, error } = await supabase
      .from("comunicazioni").select("inviata_at,letta,created_at").eq("club_id", club_id);
    if (error) throw error;
    const righe = ((data ?? []) as any[]).filter((c) => dentro(c.inviata_at ?? c.created_at, stagione));
    const inviati = righe.filter((c) => c.inviata_at).length;
    if (inviati > 0) {
      d.messaggi_inviati = inviati;
      d.messaggi_letti = righe.filter((c) => c.inviata_at && c.letta).length;
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  try {
    const { data, error } = await supabase
      .from("sponsor_attivi").select("nome_sponsor,importo_annuo").eq("club_id", club_id);
    if (error) throw error;
    const righe = (data ?? []) as any[];
    if (righe.length > 0) {
      d.sponsor = righe.length;
      d.sponsor_nomi = righe.map((r) => String(r.nome_sponsor)).filter(Boolean).slice(0, 4);
      const tot = righe.reduce((s, r) => s + (Number(r.importo_annuo) || 0), 0);
      if (tot > 0) d.sponsor_valore = tot;
    }
  } catch { d.letture_fallite = (d.letture_fallite ?? 0) + 1; }

  return d;
}

// ────────────────────────────────────────────────────────────────
// Testi
// ────────────────────────────────────────────────────────────────

/**
 * Una frase generata non esce mai monca. Se contiene un buco — due spazi di
 * fila, una virgola senza nulla davanti, parentesi vuote, un segnaposto non
 * sostituito — la frase non si scrive affatto: meglio una frase in meno.
 */
export function frase_valida(frase: string | null | undefined): boolean {
  if (!frase) return false;
  const s = String(frase).trim();
  if (s.length === 0) return false;
  if (/\s{2,}/.test(s)) return false;          // "a  che"
  if (/(^|\s)[,;:]/.test(s)) return false;     // "a , che"
  if (/[,;:(]\s*[.)]/.test(s)) return false;   // "speciale a ." / "()"
  if (/\(\s*\)/.test(s)) return false;
  if (/\{\{|\}\}|\{\d+\}/.test(s)) return false; // segnaposto non sostituito
  return true;
}

const unisci = (frasi: (string | null | undefined)[]) =>
  frasi.filter((f) => frase_valida(f)).join(" ").trim();

/** Testo tradotto del generatore di paragrafi. */
const tp = (chiave: string, opzioni: Record<string, any> = {}): string =>
  i18n.t(`relazione.paragrafi_auto.${chiave}`, { ns: "dashboard", ...opzioni }) as string;

/** Plurale corretto anche per lo zero, che l'italiano non ha come regola. */
const conteggio = (base: string, n: number): string =>
  n === 0 ? tp(`${base}_nessuno`) : tp(base, { count: n });

export function paragrafiArea(area: AreaId, tono: Tono, d: DatiNarrativi): Array<{ ordine: number; testo: string }> {
  const soci = tono === "soci";
  let apertura = "";
  let numeri = "";

  switch (area) {
    case "atleti": {
      apertura = soci
        ? `Il primo capitolo riguarda le nostre atlete: quante sono, come sono distribuite fra i livelli e come è cambiato il gruppo rispetto all'anno scorso.`
        : `La presente sezione rendiconta la consistenza e la composizione del bacino atleti nella stagione ${d.stagione_nome}.`;
      const variazione =
        d.atlete != null && d.atlete_prec != null && d.atlete_prec > 0
          ? `Nella stagione ${d.stagione_prec_nome} le atlete attive erano ${fmt_n(d.atlete_prec)}: la variazione è del ${fmt_pct(((d.atlete - d.atlete_prec) / d.atlete_prec) * 100)}.`
          : null;
      numeri = unisci([
        d.atlete != null ? `Le atlete attive sono ${fmt_n(d.atlete)}.` : null,
        d.agoniste != null ? `Di queste, ${fmt_n(d.agoniste)} sono registrate come agoniste.` : null,
        variazione,
        d.federazione ? `I tesseramenti fanno capo a ${d.federazione}.` : null,
      ]);
      break;
    }
    case "corsi": {
      apertura = soci
        ? `I corsi sono il cuore dell'attività settimanale, e le ore di ghiaccio sono la risorsa che li rende possibili.`
        : `La sezione illustra l'offerta corsistica della stagione e l'impiego delle ore di ghiaccio disponibili.`;
      numeri = unisci([
        d.corsi != null ? `I corsi attivi sono ${fmt_n(d.corsi)}.` : null,
        d.iscrizioni != null ? `Le iscrizioni registrate sono ${fmt_n(d.iscrizioni)}.` : null,
        d.ore_ghiaccio_disponibili != null && d.ore_ghiaccio_usate != null
          ? `Sulle ${fmt_n(d.ore_ghiaccio_disponibili)} ore di ghiaccio registrate a settimana, i corsi ne impegnano ${fmt_n(d.ore_ghiaccio_usate)}.`
          : d.ore_ghiaccio_usate != null
            ? `I corsi impegnano ${fmt_n(d.ore_ghiaccio_usate)} ore di ghiaccio a settimana.`
            : null,
      ]);
      break;
    }
    case "economia": {
      apertura = soci
        ? `I conti del club sono esposti in modo semplice. La misura usata in tutto il documento è il fatturato, cioè la somma delle fatture emesse nella stagione; l'incassato è indicato a parte.`
        : `L'analisi economica assume come grandezza di riferimento il fatturato della stagione, inteso come somma delle fatture emesse ed escluse bozze e note annullate. L'incassato è riportato separatamente.`;
      numeri = unisci([
        d.fatturato != null ? `Il fatturato della stagione è di ${fmt_chf(d.fatturato)}.` : null,
        d.incassato != null ? `Di questo importo risulta incassato ${fmt_chf(d.incassato)}.` : null,
      ]);
      break;
    }
    case "lezioni": {
      apertura = soci
        ? `Le lezioni private accompagnano il percorso tecnico individuale delle atlete.`
        : `La sezione rendiconta il volume e il valore delle lezioni individuali erogate nella stagione.`;
      numeri = unisci([
        d.lezioni_numero != null ? `Le lezioni private svolte sono ${fmt_n(d.lezioni_numero)}.` : null,
        d.lezioni_ore != null ? `Corrispondono a ${fmt_n(d.lezioni_ore)} ore.` : null,
        d.lezioni_incasso != null ? `Il costo registrato su queste lezioni è di ${fmt_chf(d.lezioni_incasso)}.` : null,
      ]);
      break;
    }
    case "sportivo": {
      apertura = soci
        ? `Le gare e i test di livello sono il momento in cui il lavoro dell'anno si misura fuori casa.`
        : `La sezione espone i risultati dell'attività agonistica e dei test tecnici della stagione.`;
      // Le atlete del podio entrano nella frase solo se hanno davvero un nome.
      const podio_nominato = (d.podi_atlete ?? []).filter(
        (p) => p.nome.trim().length > 0 && p.gara.trim().length > 0 && p.medaglia.trim().length > 0,
      );
      const medaglie =
        d.ori != null && d.argenti != null && d.bronzi != null
          ? tp("medaglie", {
              ori: conteggio("ori", d.ori),
              argenti: conteggio("argenti", d.argenti),
              bronzi: conteggio("bronzi", d.bronzi),
            })
          : null;
      numeri = unisci([
        d.gare != null ? tp("gare", { count: d.gare }) : null,
        d.podi != null ? tp("podi", { count: d.podi }) : null,
        medaglie,
        podio_nominato.length > 0
          ? tp("podio_elenco", {
              elenco: podio_nominato.map((p) => `${p.nome} (${p.medaglia}, ${p.gara})`).join(", "),
            })
          : null,
        d.test_superati != null ? tp("test", { count: d.test_superati }) : null,
      ]);
      break;
    }
    case "presenze": {
      apertura = soci
        ? `Le presenze sono riportate solo come totali: nessun nome, nessun dato personale.`
        : `I dati di frequenza sono esposti esclusivamente in forma aggregata.`;
      numeri = d.presenza_media != null
        ? `La presenza media per lezione è di ${fmt_n(d.presenza_media)} atlete.`
        : "";
      break;
    }
    case "comunicazione": {
      apertura = soci
        ? `Questa sezione racconta quanto abbiamo scritto alle famiglie e quanto è stato letto.`
        : `La sezione riporta il volume delle comunicazioni inviate e la relativa lettura.`;
      numeri = unisci([
        d.messaggi_inviati != null ? `I messaggi inviati sono ${fmt_n(d.messaggi_inviati)}.` : null,
        d.messaggi_letti != null ? `Quelli risultati letti sono ${fmt_n(d.messaggi_letti)}.` : null,
      ]);
      break;
    }
    case "sponsor": {
      apertura = soci
        ? `Gli sponsor sostengono una parte dell'attività: qui sono elencati per trasparenza.`
        : `La sezione rendiconta il sostegno dei partner commerciali registrati.`;
      numeri = unisci([
        d.sponsor != null ? `Gli sponsor registrati sono ${fmt_n(d.sponsor)}.` : null,
        d.sponsor_valore != null ? `Il valore annuo registrato è di ${fmt_chf(d.sponsor_valore)}.` : null,
        d.sponsor_nomi && d.sponsor_nomi.length > 0 ? `Fra questi: ${d.sponsor_nomi.join(", ")}.` : null,
      ]);
      break;
    }
  }

  const out: Array<{ ordine: number; testo: string }> = [{ ordine: 1, testo: apertura }];
  if (numeri) out.push({ ordine: 2, testo: numeri });
  return out;
}

// ────────────────────────────────────────────────────────────────
// Scrittura su database
// ────────────────────────────────────────────────────────────────

/**
 * Allinea i testi generati ai dati e al codice di oggi.
 *
 * Il testo salvato è esso stesso la firma: si rigenera il paragrafo dai dati
 * correnti e lo si confronta con quello in tabella. Se cambia il dato o
 * cambia il generatore, il testo cambia e viene riscritto; se un paragrafo
 * non ha più nulla da dire, la riga vecchia viene tolta invece di restare lì
 * monca. I paragrafi con `is_edited = true` non si toccano mai.
 *
 * Se una delle letture dei dati è fallita non si riscrive nulla: un testo non
 * si sostituisce sulla base di numeri che non sappiamo.
 */
export async function sincronizzaParagrafi(
  club_id: string, stagione: Stagione, tono: Tono,
): Promise<{ aggiornati: number; rimossi: number }> {
  const dati = await fetchDatiNarrativi(club_id, stagione);
  if ((dati.letture_fallite ?? 0) > 0) {
    throw new Error(i18n.t("relazione.paragrafi.errore_dati_incompleti", { ns: "dashboard" }) as string);
  }

  const { data, error } = await supabase
    .from("relazioni_paragrafi_auto" as any)
    .select("area_id,paragrafo_ordine,contenuto,is_edited")
    .eq("club_id", club_id).eq("stagione_id", stagione.id).eq("tono", tono);
  if (error) throw error;
  const esistenti = new Map(
    ((data ?? []) as any[]).map((r) => [`${r.area_id}|${r.paragrafo_ordine}`, r]),
  );

  const da_scrivere: any[] = [];
  const da_rimuovere: Array<{ area: AreaId; ordine: number }> = [];

  for (const area of AREE_NARRATIVE) {
    const prodotti = new Map(paragrafiArea(area, tono, dati).map((p) => [p.ordine, p.testo]));
    const ordini = new Set<number>([...prodotti.keys(), ...Object.keys(ORDINE_LABELS).map(Number)]);
    for (const ordine of ordini) {
      const riga = esistenti.get(`${area}|${ordine}`);
      if (riga?.is_edited) continue;
      const testo = (prodotti.get(ordine) ?? "").trim();
      if (!testo) { if (riga) da_rimuovere.push({ area, ordine }); continue; }
      if (riga && String(riga.contenuto ?? "") === testo) continue;
      da_scrivere.push({
        club_id, stagione_id: stagione.id, area_id: area,
        paragrafo_ordine: ordine, tono, contenuto: testo,
        is_edited: false, generated_at: new Date().toISOString(),
      });
    }
  }

  if (da_scrivere.length > 0) {
    const { error: err2 } = await supabase
      .from("relazioni_paragrafi_auto" as any)
      .upsert(da_scrivere, { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" });
    if (err2) throw err2;
  }
  for (const r of da_rimuovere) {
    const { error: err3 } = await supabase
      .from("relazioni_paragrafi_auto" as any).delete()
      .eq("club_id", club_id).eq("stagione_id", stagione.id).eq("tono", tono)
      .eq("area_id", r.area).eq("paragrafo_ordine", r.ordine).eq("is_edited", false);
    if (err3) throw err3;
  }
  return { aggiornati: da_scrivere.length, rimossi: da_rimuovere.length };
}

export interface GenerateProgress {
  area_idx: number;
  area_label: string;
  total: number;
}

/** Rigenera i paragrafi non modificati a mano. I testi corretti a mano non si toccano. */
export async function generateAllParagraphs(
  club_id: string,
  stagione: Stagione,
  tono: Tono,
  on_progress?: (p: GenerateProgress) => void,
): Promise<{ scritti: number; saltati: number }> {
  const dati = await fetchDatiNarrativi(club_id, stagione);

  const { data: esistenti, error } = await supabase
    .from("relazioni_paragrafi_auto" as any)
    .select("area_id,paragrafo_ordine,tono,is_edited")
    .eq("club_id", club_id).eq("stagione_id", stagione.id).eq("tono", tono);
  if (error) throw error;
  const modificati = new Set(
    ((esistenti ?? []) as any[]).filter((r) => r.is_edited).map((r) => `${r.area_id}|${r.paragrafo_ordine}`),
  );

  let scritti = 0, saltati = 0;
  const righe: any[] = [];
  AREE_NARRATIVE.forEach((area, i) => {
    on_progress?.({ area_idx: i + 1, area_label: AREA_LABELS[area], total: AREE_NARRATIVE.length });
    for (const p of paragrafiArea(area, tono, dati)) {
      if (modificati.has(`${area}|${p.ordine}`)) { saltati++; continue; }
      righe.push({
        club_id, stagione_id: stagione.id, area_id: area,
        paragrafo_ordine: p.ordine, tono,
        contenuto: p.testo, is_edited: false,
        generated_at: new Date().toISOString(),
      });
    }
  });

  if (righe.length > 0) {
    const { error: err2 } = await supabase
      .from("relazioni_paragrafi_auto" as any)
      .upsert(righe, { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" });
    if (err2) throw err2;
    scritti = righe.length;
  }
  return { scritti, saltati };
}

/** Rigenera UN SOLO paragrafo, senza toccare gli altri. */
export async function regeneraParagrafo(
  club_id: string, stagione: Stagione, tono: Tono, area: AreaId, ordine: number,
): Promise<string> {
  const dati = await fetchDatiNarrativi(club_id, stagione);
  const p = paragrafiArea(area, tono, dati).find((x) => x.ordine === ordine);
  const testo = p?.testo ?? "";
  const { error } = await supabase
    .from("relazioni_paragrafi_auto" as any)
    .upsert(
      {
        club_id, stagione_id: stagione.id, area_id: area,
        paragrafo_ordine: ordine, tono, contenuto: testo,
        is_edited: false, generated_at: new Date().toISOString(),
      },
      { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" },
    );
  if (error) throw error;
  return testo;
}

/** Paragrafi di una stagione per un tono, pronti per il PDF. */
export async function fetchParagrafiForPdf(
  club_id: string, stagione_id: string, tono: Tono,
): Promise<Record<string, Record<number, string>>> {
  const { data, error } = await supabase
    .from("relazioni_paragrafi_auto" as any)
    .select("area_id,paragrafo_ordine,contenuto")
    .eq("club_id", club_id).eq("stagione_id", stagione_id).eq("tono", tono);
  if (error) throw error;
  const map: Record<string, Record<number, string>> = {};
  for (const r of (data ?? []) as any[]) {
    map[r.area_id] = map[r.area_id] ?? {};
    map[r.area_id][r.paragrafo_ordine] = r.contenuto;
  }
  return map;
}
