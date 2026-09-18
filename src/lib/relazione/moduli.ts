// Moduli dati della Relazione del Presidente.
// Regola: solo numeri veri. Ogni modulo ha tre esiti possibili:
//   "ok"      -> ci sono dati, il grafico/tabella si può stampare
//   "vuoto"   -> la lettura è riuscita ma non ci sono dati: il modulo si spegne da solo
//   "errore"  -> la lettura è fallita: il modulo lo dice, non finge zero
// Nessun valore di ripiego, nessuna stima, nessun dato di esempio.

import { supabase } from "@/lib/supabase";
import i18n from "@/i18n";
import { formatta, type GraficoSpec, type PuntoSerie } from "./grafici";
import {
  fetchFonteEconomica, testo_economia, SOGLIA_FATTURE, type EsitoFonte,
} from "./fonte-economica";

// Il tono è definito qui per non creare una dipendenza circolare con paragraphGenerator.
export type TonoModuli = "soci" | "formale";

export type AreaId =
  | "atleti" | "corsi" | "economia" | "lezioni"
  | "sportivo" | "presenze" | "comunicazione" | "sponsor";

export const AREE_ORDINATE: AreaId[] = [
  "atleti", "corsi", "economia", "lezioni", "sportivo", "presenze", "comunicazione", "sponsor",
];

export type StatoModulo = "ok" | "vuoto" | "errore";

export interface ModuloDef {
  id: string;
  area: AreaId;
  titolo: string;
}

export interface ModuloRisultato extends ModuloDef {
  stato: StatoModulo;
  motivo?: string;
  grafico?: GraficoSpec;
}

export interface Stagione {
  id: string;
  nome: string;
  data_inizio: string | null;
  data_fine: string | null;
  attiva: boolean | null;
}

export const MODULI: ModuloDef[] = [
  { id: "atleti_andamento", area: "atleti", titolo: "Andamento delle atlete per stagione" },
  { id: "atleti_piramide", area: "atleti", titolo: "Piramide dei livelli" },
  { id: "atleti_eta", area: "atleti", titolo: "Fasce d'età" },
  { id: "atleti_flussi", area: "atleti", titolo: "Nuove e uscite" },
  { id: "atleti_agoniste", area: "atleti", titolo: "Agoniste e non agoniste" },
  { id: "corsi_riempimento", area: "corsi", titolo: "Riempimento dei corsi" },
  { id: "ghiaccio_ore", area: "corsi", titolo: "Ore di ghiaccio" },
  { id: "economia_mensile", area: "economia", titolo: "Fatturato e incassato per mese" },
  { id: "economia_enti", area: "economia", titolo: "Ripartizione per ente" },
  { id: "economia_fonti", area: "economia", titolo: "Ricavi per fonte" },
  { id: "economia_bilancio", area: "economia", titolo: "Bilancio della stagione" },
  { id: "economia_istruttori", area: "economia", titolo: "Costi degli istruttori" },
  { id: "lezioni_istruttore", area: "lezioni", titolo: "Lezioni private per istruttore" },
  { id: "lezioni_fasce", area: "lezioni", titolo: "Lezioni private per fascia oraria" },
  { id: "lezioni_incasso", area: "lezioni", titolo: "Incasso delle lezioni private" },
  { id: "sportivo_gare", area: "sportivo", titolo: "Gare e partecipazioni" },
  { id: "sportivo_podi", area: "sportivo", titolo: "Podi conquistati" },
  { id: "sportivo_podio_dettaglio", area: "sportivo", titolo: "Il podio della stagione" },
  { id: "sportivo_test", area: "sportivo", titolo: "Test di livello superati" },
  { id: "sportivo_test_dettaglio", area: "sportivo", titolo: "Test superati" },
  { id: "sportivo_gare_elenco", area: "sportivo", titolo: "Le gare della stagione" },
  { id: "sportivo_resoconto", area: "sportivo", titolo: "Resoconto tecnico delle gare" },
  { id: "sportivo_cammino", area: "sportivo", titolo: "Il cammino delle atlete" },
  { id: "presenze_corsi", area: "presenze", titolo: "Frequenza media per corso" },
  { id: "comunicazione_messaggi", area: "comunicazione", titolo: "Messaggi inviati e letti" },
  { id: "sponsor_elenco", area: "sponsor", titolo: "Sponsor della stagione" },
];

export const MODULI_ASSEMBLEA = new Set([
  "atleti_andamento", "atleti_piramide", "atleti_agoniste",
  "corsi_riempimento", "economia_mensile", "economia_fonti",
  "lezioni_istruttore", "sportivo_podi", "sportivo_podio_dettaglio", "sportivo_test_dettaglio",
  "sportivo_gare_elenco", "sportivo_resoconto", "sponsor_elenco",
]);

export const MODULI_COMITATO = new Set([
  "atleti_andamento", "atleti_flussi", "corsi_riempimento", "ghiaccio_ore",
  "economia_mensile", "economia_enti", "economia_bilancio", "economia_istruttori",
  "lezioni_incasso", "sportivo_gare", "sportivo_podio_dettaglio", "sportivo_test", "sportivo_test_dettaglio",
  "sportivo_gare_elenco", "sportivo_resoconto", "presenze_corsi", "sponsor_elenco",
]);

/** Moduli presenti nel catalogo ma spenti all'apertura: sono lunghi da stampare. */
export const MODULI_SPENTI_DI_DEFAULT = new Set(["sportivo_cammino"]);

// ────────────────────────────────────────────────────────────────
// Utilità
// ────────────────────────────────────────────────────────────────

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const testo_modulo = (chiave: string) => i18n.t(`relazione.moduli_catalogo.${chiave}`, { ns: "dashboard" }) as string;

function ok(def: ModuloDef, grafico: GraficoSpec): ModuloRisultato {
  return { ...def, stato: "ok", grafico };
}
function vuoto(def: ModuloDef, motivo: string): ModuloRisultato {
  return { ...def, stato: "vuoto", motivo };
}
function errore(def: ModuloDef, e: any): ModuloRisultato {
  return { ...def, stato: "errore", motivo: e?.message ? String(e.message) : String(e) };
}

/** Stagioni del club ordinate per data di inizio (più vecchia prima). */
export async function fetchStagioniOrdinate(club_id: string): Promise<Stagione[]> {
  const { data, error } = await supabase
    .from("stagioni" as any)
    .select("id,nome,data_inizio,data_fine,attiva")
    .eq("club_id", club_id);
  if (error) throw error;
  return ((data ?? []) as any[])
    .map((s) => ({
      id: s.id, nome: s.nome,
      data_inizio: s.data_inizio ?? null, data_fine: s.data_fine ?? null,
      attiva: s.attiva ?? null,
    }))
    .sort((a, b) => String(a.data_inizio ?? "").localeCompare(String(b.data_inizio ?? "")));
}

/** Stagione immediatamente precedente per data (non la prima della lista). */
export function stagionePrecedente(stagioni: Stagione[], stagione_id: string): Stagione | null {
  const idx = stagioni.findIndex((s) => s.id === stagione_id);
  if (idx <= 0) return null;
  return stagioni[idx - 1];
}

/**
 * Stagione da proporre all'apertura: se siamo nei primi tre mesi di una stagione
 * nuova, si parte da quella appena chiusa; altrimenti da quella attiva.
 */
export function stagioneDaProporre(stagioni: Stagione[], oggi = new Date()): Stagione | null {
  if (stagioni.length === 0) return null;
  const attiva = stagioni.find((s) => s.attiva) ?? stagioni[stagioni.length - 1];
  if (!attiva?.data_inizio) return attiva ?? null;
  const inizio = new Date(`${attiva.data_inizio}T00:00:00`);
  const mesi_trascorsi =
    (oggi.getFullYear() - inizio.getFullYear()) * 12 + (oggi.getMonth() - inizio.getMonth());
  if (mesi_trascorsi >= 0 && mesi_trascorsi < 3) {
    const prec = stagionePrecedente(stagioni, attiva.id);
    if (prec) return prec;
  }
  return attiva;
}

function dentro(data: string | null | undefined, stag: Stagione | null): boolean {
  if (!stag?.data_inizio || !stag?.data_fine) return true;
  if (!data) return false;
  const d = String(data).slice(0, 10);
  return d >= stag.data_inizio && d <= stag.data_fine;
}

async function sicuro(def: ModuloDef, fn: () => Promise<ModuloRisultato>): Promise<ModuloRisultato> {
  try {
    return await fn();
  } catch (e) {
    return errore(def, e);
  }
}

const def_di = (id: string): ModuloDef => {
  const definizione = MODULI.find((m) => m.id === id);
  if (!definizione) throw new Error(`Modulo relazione non definito: ${id}`);
  return definizione;
};

// ────────────────────────────────────────────────────────────────
// Costruzione dei moduli
// ────────────────────────────────────────────────────────────────

export interface ContestoModuli {
  club_id: string;
  stagione: Stagione;
  stagioni: Stagione[];
  tono?: TonoModuli;
}

/**
 * Tiene le prime sette voci e raggruppa il resto in "Altro".
 * Vale per le serie di categorie (livelli, fonti, istruttori): non si applica
 * agli assi temporali, dove togliere mesi o ore falserebbe la lettura.
 */
function limita_voci(dati: PuntoSerie[], massimo = 7): PuntoSerie[] {
  if (dati.length <= massimo + 1) return dati;
  const tenute = dati.slice(0, massimo);
  const resto = dati.slice(massimo);
  return [
    ...tenute,
    {
      etichetta: testo_modulo("altro"),
      valore: resto.reduce((s, d) => s + d.valore, 0),
      valore2: resto.some((d) => typeof d.valore2 === "number")
        ? resto.reduce((s, d) => s + (d.valore2 ?? 0), 0)
        : undefined,
    },
  ];
}

/** Didascalia generata, nel tono scelto: dice a parole cosa mostra il grafico. */
function didascalia_di(g: GraficoSpec, tono: TonoModuli): string | undefined {
  const suffisso = tono === "formale" ? "_formale" : "";
  const chiave = (k: string, opzioni: Record<string, string>) =>
    i18n.t(`relazione.didascalie.${k}${suffisso}`, { ns: "dashboard", ...opzioni }) as string;
  if (g.tipo === "tabella" || g.tipo === "resoconto" || g.dati.length === 0) return undefined;
  const formato = g.formato ?? "numero";
  const totale = g.dati.reduce((s, d) => s + d.valore, 0);
  const ordinati = [...g.dati].sort((a, b) => b.valore - a.valore);

  if (g.tipo === "linea") {
    const prima = g.dati[0], ultima = g.dati[g.dati.length - 1], max = ordinati[0];
    return chiave("linea", {
      prima: prima.etichetta, prima_valore: formatta(prima.valore, formato),
      ultima: ultima.etichetta, ultima_valore: formatta(ultima.valore, formato),
      massima: max.etichetta, massimo_valore: formatta(max.valore, formato),
    });
  }
  if (g.tipo === "barre" && g.dati.some((d) => typeof d.valore2 === "number")) {
    const t2 = g.dati.reduce((s, d) => s + (d.valore2 ?? 0), 0);
    return chiave("due_serie", {
      serie1: g.etichetta_serie1 ?? "", totale1: formatta(totale, formato),
      serie2: g.etichetta_serie2 ?? "", totale2: formatta(t2, formato),
    });
  }
  if (ordinati.length === 1) {
    return chiave("una_voce", {
      prima: ordinati[0].etichetta, prima_valore: formatta(ordinati[0].valore, formato),
    });
  }
  return chiave("serie", {
    totale: formatta(totale, formato),
    prima: ordinati[0].etichetta, prima_valore: formatta(ordinati[0].valore, formato),
    seconda: ordinati[1].etichetta, seconda_valore: formatta(ordinati[1].valore, formato),
  });
}

export async function fetchModuli(ctx: ContestoModuli): Promise<Record<string, ModuloRisultato>> {
  const risultati = await Promise.all([
    modAtletiAndamento(ctx),
    modAtletiPiramide(ctx),
    modAtletiEta(ctx),
    modAtletiFlussi(ctx),
    modAtletiAgoniste(ctx),
    modCorsiRiempimento(ctx),
    modGhiaccioOre(ctx),
    modEconomiaMensile(ctx),
    modEconomiaEnti(ctx),
    modEconomiaFonti(ctx),
    modEconomiaBilancio(ctx),
    modEconomiaIstruttori(ctx),
    modLezioniIstruttore(ctx),
    modLezioniFasce(ctx),
    modLezioniIncasso(ctx),
    modSportivoGare(ctx),
    modSportivoPodi(ctx),
    modSportivoPodioDettaglio(ctx),
    modSportivoTest(ctx),
    modSportivoTestDettaglio(ctx),
    modGareStagione(ctx),
    modResocontoGare(ctx),
    modCamminoAtlete(ctx),
    modPresenzeCorsi(ctx),
    modComunicazione(ctx),
    modSponsor(ctx),
  ]);
  const out: Record<string, ModuloRisultato> = {};
  for (const r of risultati) {
    // La didascalia si aggiunge qui una volta sola, così vale per ogni modulo.
    if (r.stato === "ok" && r.grafico && !r.grafico.didascalia) {
      r.grafico.didascalia = didascalia_di(r.grafico, ctx.tono ?? "soci");
    }
    out[r.id] = r;
  }
  return out;
}

// ── Atlete ──────────────────────────────────────────────────────

async function modAtletiAndamento(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("atleti_andamento");
  return sicuro(def, async () => {
    const ids = ctx.stagioni.map((s) => s.id);
    if (ids.length === 0) return vuoto(def, "Nessuna stagione registrata.");
    const { data, error } = await supabase
      .from("atleti_storici_stagioni").select("stagione_id,status")
      .eq("club_id", ctx.club_id).in("stagione_id", ids);
    if (error) throw error;
    const conteggi = new Map<string, number>();
    for (const r of (data ?? []) as any[]) {
      if (r.status !== "attivo") continue;
      conteggi.set(r.stagione_id, (conteggi.get(r.stagione_id) ?? 0) + 1);
    }
    const dati = ctx.stagioni
      .filter((s) => conteggi.has(s.id))
      .map((s) => ({ etichetta: s.nome, valore: conteggi.get(s.id)! }));
    if (dati.length === 0) {
      return vuoto(def, "Lo storico delle atlete per stagione non è stato registrato.");
    }
    return ok(def, { tipo: "linea", titolo: def.titolo, sottotitolo: "atlete attive per stagione", dati });
  });
}

// Le atlete lette qui sono quelle della stagione scelta: in corso = anagrafico
// vivo, chiusa = storico di quella stagione (stessa logica dei paragrafi e dei
// KPI, in src/lib/relazione/atleti-stagione.ts).
async function atletiAttivi(ctx: ContestoModuli) {
  const righe = await fetchAtletiDellaStagione(
    ctx.club_id, ctx.stagione, "id,livello_attuale,categoria,data_nascita,agonista,created_at",
  );
  return righe ?? [];
}

async function modAtletiPiramide(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("atleti_piramide");
  return sicuro(def, async () => {
    const atleti = await atletiAttivi(ctx.club_id);
    if (atleti.length === 0) return vuoto(def, "Non ci sono atlete attive.");
    const per_livello = new Map<string, number>();
    for (const a of atleti) {
      const k = a.livello_attuale || a.categoria;
      if (!k) continue;
      per_livello.set(k, (per_livello.get(k) ?? 0) + 1);
    }
    if (per_livello.size === 0) return vuoto(def, "Il livello delle atlete non è stato registrato.");
    // Piramide: dalla base (il livello più numeroso) alla cima.
    const dati = limita_voci(Array.from(per_livello.entries())
      .map(([etichetta, valore]) => ({ etichetta, valore }))
      .sort((a, b) => b.valore - a.valore));
    return ok(def, {
      tipo: "barre", orientamento: "orizzontale", titolo: def.titolo,
      sottotitolo: "atlete attive per livello", dati,
    });
  });
}

async function modAtletiEta(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("atleti_eta");
  return sicuro(def, async () => {
    const atleti = await atletiAttivi(ctx.club_id);
    const con_data = atleti.filter((a) => a.data_nascita);
    if (con_data.length === 0) return vuoto(def, "Le date di nascita non sono state registrate.");
    const riferimento = ctx.stagione.data_fine
      ? new Date(`${ctx.stagione.data_fine}T00:00:00`) : new Date();
    const fasce = [
      { etichetta: "fino a 7 anni", min: 0, max: 7 },
      { etichetta: "8 - 11 anni", min: 8, max: 11 },
      { etichetta: "12 - 15 anni", min: 12, max: 15 },
      { etichetta: "16 - 18 anni", min: 16, max: 18 },
      { etichetta: "19 anni e oltre", min: 19, max: 200 },
    ];
    const conteggi = fasce.map((f) => ({ etichetta: f.etichetta, valore: 0 }));
    for (const a of con_data) {
      const n = new Date(`${String(a.data_nascita).slice(0, 10)}T00:00:00`);
      let eta = riferimento.getFullYear() - n.getFullYear();
      const m = riferimento.getMonth() - n.getMonth();
      if (m < 0 || (m === 0 && riferimento.getDate() < n.getDate())) eta--;
      const idx = fasce.findIndex((f) => eta >= f.min && eta <= f.max);
      if (idx >= 0) conteggi[idx].valore++;
    }
    const dati = conteggi.filter((c) => c.valore > 0);
    if (dati.length === 0) return vuoto(def, "Le date di nascita non sono state registrate.");
    return ok(def, { tipo: "barre", titolo: def.titolo, sottotitolo: "atlete attive per fascia d'età", dati });
  });
}

async function modAtletiFlussi(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("atleti_flussi");
  return sicuro(def, async () => {
    const { data, error } = await supabase
      .from("atleti_storici_stagioni").select("atleta_id,status,data_iscrizione,data_abbandono")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (error) throw error;
    const righe = (data ?? []) as any[];
    if (righe.length === 0) {
      return vuoto(def, "Lo storico di questa stagione non è stato registrato.");
    }
    const prec = stagionePrecedente(ctx.stagioni, ctx.stagione.id);
    let nuove = 0;
    let uscite = righe.filter((r) => r.status !== "attivo" || r.data_abbandono).length;
    if (prec) {
      const { data: prima, error: err2 } = await supabase
        .from("atleti_storici_stagioni").select("atleta_id,status")
        .eq("club_id", ctx.club_id).eq("stagione_id", prec.id);
      if (err2) throw err2;
      const prima_ids = new Set(((prima ?? []) as any[]).filter((r) => r.status === "attivo").map((r) => r.atleta_id));
      nuove = righe.filter((r) => r.status === "attivo" && !prima_ids.has(r.atleta_id)).length;
    } else {
      nuove = righe.filter((r) => r.status === "attivo").length;
    }
    return ok(def, {
      tipo: "barre", titolo: def.titolo,
      sottotitolo: prec ? `confronto con la stagione ${prec.nome}` : "prima stagione registrata",
      dati: [
        { etichetta: "Nuove atlete", valore: nuove },
        { etichetta: "Uscite", valore: uscite },
      ],
    });
  });
}

async function modAtletiAgoniste(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("atleti_agoniste");
  return sicuro(def, async () => {
    const atleti = await atletiAttivi(ctx.club_id);
    if (atleti.length === 0) return vuoto(def, "Non ci sono atlete attive.");
    const agoniste = atleti.filter((a) => a.agonista).length;
    if (agoniste === 0) return vuoto(def, "Nessuna atleta è registrata come agonista.");
    return ok(def, {
      tipo: "donut", titolo: def.titolo, sottotitolo: "atlete attive",
      dati: [
        { etichetta: "Agoniste", valore: agoniste },
        { etichetta: "Non agoniste", valore: atleti.length - agoniste },
      ],
    });
  });
}

// ── Corsi e ghiaccio ────────────────────────────────────────────

async function modCorsiRiempimento(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("corsi_riempimento");
  return sicuro(def, async () => {
    const { data: corsi, error } = await supabase
      .from("corsi").select("id,nome,capienza_max,attivo")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (error) throw error;
    const lista = ((corsi ?? []) as any[]).filter((c) => c.attivo !== false);
    if (lista.length === 0) return vuoto(def, "Non ci sono corsi registrati per questa stagione.");
    const { data: iscr, error: err2 } = await supabase
      .from("iscrizioni_corsi").select("corso_id,attiva")
      .in("corso_id", lista.map((c) => c.id));
    if (err2) throw err2;
    const conteggi = new Map<string, number>();
    for (const i of (iscr ?? []) as any[]) {
      if (i.attiva === false) continue;
      conteggi.set(i.corso_id, (conteggi.get(i.corso_id) ?? 0) + 1);
    }
    // Solo i corsi con una capienza registrata: senza capienza la percentuale non esiste.
    const dati = lista
      .filter((c) => Number(c.capienza_max) > 0)
      .map((c) => ({
        etichetta: String(c.nome ?? "—"),
        valore: Math.round(((conteggi.get(c.id) ?? 0) / Number(c.capienza_max)) * 100),
      }))
      .sort((a, b) => b.valore - a.valore);
    if (dati.length === 0) return vuoto(def, "La capienza dei corsi non è stata registrata.");
    return ok(def, {
      tipo: "barre", orientamento: "orizzontale", titolo: def.titolo,
      sottotitolo: testo_modulo("riempimento_sottotitolo"), formato: "percento",
      dati: limita_voci(dati),
      riferimento: { valore: 100, etichetta: testo_modulo("capienza") },
    });
  });
}

function oreTra(inizio: any, fine: any): number {
  if (!inizio || !fine) return 0;
  const [h1, m1] = String(inizio).split(":").map(Number);
  const [h2, m2] = String(fine).split(":").map(Number);
  if ([h1, m1, h2, m2].some((v) => !Number.isFinite(v))) return 0;
  return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
}

async function modGhiaccioOre(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("ghiaccio_ore");
  return sicuro(def, async () => {
    const { data: disp, error } = await supabase
      .from("disponibilita_ghiaccio").select("ora_inizio,ora_fine,tipo,stagione_id")
      .eq("club_id", ctx.club_id);
    if (error) throw error;
    const righe = ((disp ?? []) as any[]).filter(
      (d) => (d.tipo ?? "ghiaccio") === "ghiaccio" && (!d.stagione_id || d.stagione_id === ctx.stagione.id),
    );
    if (righe.length === 0) {
      return vuoto(def, "La disponibilità di ghiaccio non è stata registrata per questa stagione.");
    }
    const ore_disponibili = righe.reduce((s, d) => s + oreTra(d.ora_inizio, d.ora_fine), 0);
    const { data: corsi, error: err2 } = await supabase
      .from("corsi").select("ora_inizio,ora_fine,attivo,usa_ghiaccio")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (err2) throw err2;
    const ore_usate = ((corsi ?? []) as any[])
      .filter((c) => c.attivo !== false && c.usa_ghiaccio !== false)
      .reduce((s, c) => s + oreTra(c.ora_inizio, c.ora_fine), 0);
    if (ore_disponibili <= 0) return vuoto(def, "Le ore di ghiaccio registrate sono a zero.");
    return ok(def, {
      tipo: "barre", titolo: def.titolo, sottotitolo: "ore a settimana", formato: "ore",
      dati: [
        { etichetta: "Ore disponibili", valore: ore_disponibili },
        { etichetta: "Ore usate dai corsi", valore: ore_usate },
      ],
    });
  });
}

// ── Economia ────────────────────────────────────────────────────
//
// Una sola fonte per stagione (vedi fonte-economica.ts): o le fatture del
// portale, o il bilancio di stagione. Mai i due numeri affiancati come se
// fossero la stessa cosa, mai un totale che li somma.

/** La fonte si legge una volta sola per costruzione del documento. */
async function fonteDi(ctx: ContestoModuli): Promise<EsitoFonte> {
  const c = ctx as ContestoModuli & { __fonte?: Promise<EsitoFonte> };
  if (!c.__fonte) c.__fonte = fetchFonteEconomica(ctx.club_id, ctx.stagione);
  return c.__fonte;
}

/** Motivo per cui un modulo basato sulle fatture non si stampa in questa stagione. */
function motivo_non_fatture(f: EsitoFonte): string {
  return f.fonte === "bilancio"
    ? testo_economia("solo_bilancio", { soglia: SOGLIA_FATTURE })
    : testo_economia("senza_dati");
}

async function modEconomiaMensile(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_mensile");
  return sicuro(def, async () => {
    const f = await fonteDi(ctx);
    if (f.fonte !== "fatture") return vuoto(def, motivo_non_fatture(f));
    const fatture = f.fatture;
    const mesi = new Map<string, { fatturato: number; incassato: number }>();
    const chiave = (d: string) => String(d).slice(0, 7);
    for (const fa of fatture) {
      if (!fa.data_emissione) continue;
      const k = chiave(fa.data_emissione);
      const v = mesi.get(k) ?? { fatturato: 0, incassato: 0 };
      v.fatturato += fa.importo;
      mesi.set(k, v);
      if (fa.data_pagamento) {
        const kp = chiave(fa.data_pagamento);
        const vp = mesi.get(kp) ?? { fatturato: 0, incassato: 0 };
        vp.incassato += fa.importo;
        mesi.set(kp, vp);
      }
    }
    const dati = Array.from(mesi.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        etichetta: `${MESI[Number(k.slice(5, 7)) - 1] ?? k} ${k.slice(2, 4)}`,
        valore: v.fatturato,
        valore2: v.incassato,
      }));
    if (dati.length === 0) return vuoto(def, testo_economia("senza_dati"));
    return ok(def, {
      tipo: "barre", titolo: testo_economia("titolo_fatturato_mese"),
      sottotitolo: testo_economia("etichetta_fatture"), formato: "chf",
      dati, etichetta_serie1: testo_economia("serie_fatturato"), etichetta_serie2: testo_economia("serie_incassato"),
    });
  });
}

async function modEconomiaEnti(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_enti");
  return sicuro(def, async () => {
    const f = await fonteDi(ctx);
    if (f.fonte !== "fatture") return vuoto(def, motivo_non_fatture(f));
    const { data: enti, error } = await supabase
      .from("ragioni_sociali").select("id,nome").eq("club_id", ctx.club_id);
    if (error) throw error;
    const nomi = new Map(((enti ?? []) as any[]).map((r) => [r.id, r.nome]));
    if (nomi.size === 0) return vuoto(def, testo_economia("senza_enti"));
    const per_ente = new Map<string, number>();
    for (const fa of f.fatture) {
      const k = fa.ragione_sociale_id
        ? (nomi.get(fa.ragione_sociale_id) ?? testo_economia("ente_non_trovato"))
        : testo_economia("ente_club");
      per_ente.set(k, (per_ente.get(k) ?? 0) + fa.importo);
    }
    const dati = Array.from(per_ente.entries()).map(([etichetta, valore]) => ({ etichetta, valore }));
    return ok(def, {
      tipo: "donut", titolo: def.titolo,
      sottotitolo: testo_economia("etichetta_fatture"), formato: "chf", dati,
    });
  });
}

/** Etichetta leggibile di una fonte di ricavo salvata a codice (quote_corsi -> Quote corsi). */
function nome_fonte_ricavo(valore: string): string {
  const pulito = String(valore ?? "").trim().replace(/_/g, " ");
  if (!pulito) return testo_modulo("altro");
  return pulito.charAt(0).toUpperCase() + pulito.slice(1);
}

async function modEconomiaFonti(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_fonti");
  return sicuro(def, async () => {
    const f = await fonteDi(ctx);
    if (f.fonte === "nessuna") return vuoto(def, testo_economia("senza_dati"));

    // Comanda il bilancio: la ripartizione arriva da ricavi_per_fonte, mai dalle fatture.
    if (f.fonte === "bilancio") {
      const { data, error } = await supabase
        .from("ricavi_per_fonte").select("fonte,importo")
        .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
      if (error) throw error;
      const dati = ((data ?? []) as any[])
        .map((r) => ({ etichetta: nome_fonte_ricavo(r.fonte), valore: Number(r.importo) || 0 }))
        .filter((r) => r.valore > 0)
        .sort((a, b) => b.valore - a.valore);
      if (dati.length === 0) return vuoto(def, testo_economia("fonti_bilancio_vuoto"));
      return ok(def, {
        tipo: "barre", orientamento: "orizzontale", titolo: def.titolo,
        sottotitolo: testo_economia("etichetta_bilancio"), formato: "chf", dati: limita_voci(dati),
      });
    }

    // Comandano le fatture: la ripartizione sta nelle righe della fattura.
    const per_tipo = new Map<string, number>();
    const aggiungi = (etichetta: string, importo: number) => {
      if (!(importo > 0)) return;
      per_tipo.set(etichetta, (per_tipo.get(etichetta) ?? 0) + importo);
    };
    for (const fa of f.fatture) {
      const righe = Array.isArray(fa.righe) ? (fa.righe as any[]) : [];
      if (righe.length === 0) {
        aggiungi(testo_modulo("altro"), fa.importo);
        continue;
      }
      for (const r of righe) {
        const etichetta = String(r?.tipo ?? "").trim() || testo_modulo("altro");
        aggiungi(etichetta, Number(r?.importo) || 0);
      }
    }
    const dati = Array.from(per_tipo.entries())
      .map(([etichetta, valore]) => ({ etichetta, valore }))
      .sort((a, b) => b.valore - a.valore);
    if (dati.length === 0) return vuoto(def, testo_economia("fonti_fatture_vuoto"));
    return ok(def, {
      tipo: "barre", orientamento: "orizzontale", titolo: def.titolo,
      sottotitolo: testo_economia("etichetta_fatture"), formato: "chf", dati: limita_voci(dati),
    });
  });
}

async function modEconomiaBilancio(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_bilancio");
  return sicuro(def, async () => {
    const f = await fonteDi(ctx);
    if (!f.bilancio) return vuoto(def, testo_economia("bilancio_mancante"));
    const b = f.bilancio;
    const chf = (v: number) => "CHF " + Math.round(v).toLocaleString("de-CH").replace(/,/g, "'");
    const righe: string[][] = [
      [testo_economia("voce_entrate"), chf(b.totale_entrate)],
      [testo_economia("voce_uscite"), chf(b.totale_uscite)],
      [testo_economia("voce_saldo"), chf(b.saldo)],
    ];
    if (b.cassa_iniziale != null) righe.push([testo_economia("voce_cassa_iniziale"), chf(b.cassa_iniziale)]);
    if (b.cassa_finale != null) righe.push([testo_economia("voce_cassa_finale"), chf(b.cassa_finale)]);
    return ok(def, {
      tipo: "tabella", titolo: testo_economia("titolo_bilancio"),
      sottotitolo: testo_economia("etichetta_bilancio"),
      colonne: [testo_economia("col_voce"), testo_economia("col_importo")],
      righe,
      allinea_destra: [1],
      // Con entrambe le fonti si dice perché i due numeri non coincidono.
      didascalia: f.due_blocchi ? testo_economia("nota_due_fonti") : undefined,
    });
  });
}

async function modEconomiaIstruttori(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_istruttori");
  return sicuro(def, async () => {
    const { data: costi, error } = await supabase
      .from("costi_istruttori").select("istruttore_id,tariffa_oraria,costo_fisso_mensile")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (error) throw error;
    const { data: ore, error: err2 } = await supabase
      .from("ore_lavorate_istruttori")
      .select("istruttore_id,ore_corsi,ore_lezioni_private,ore_eventi,ore_amministrative,ore_extra,ore_campi,ore_gare")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (err2) throw err2;
    const righe_ore = (ore ?? []) as any[];
    const righe_costi = (costi ?? []) as any[];
    if (righe_ore.length === 0 && righe_costi.length === 0) {
      return vuoto(def, "Le ore lavorate e le tariffe degli istruttori non sono state registrate.");
    }
    const tariffa = new Map(righe_costi.map((c) => [c.istruttore_id, Number(c.tariffa_oraria) || 0]));
    const ore_tot = new Map<string, number>();
    for (const r of righe_ore) {
      const somma = ["ore_corsi", "ore_lezioni_private", "ore_eventi", "ore_amministrative", "ore_extra", "ore_campi", "ore_gare"]
        .reduce((s, k) => s + (Number(r[k]) || 0), 0);
      ore_tot.set(r.istruttore_id, (ore_tot.get(r.istruttore_id) ?? 0) + somma);
    }
    const ids = Array.from(new Set([...ore_tot.keys(), ...tariffa.keys()])).filter(Boolean);
    if (ids.length === 0) return vuoto(def, "Le ore lavorate degli istruttori non sono state registrate.");
    const { data: istr, error: err3 } = await supabase
      .from("istruttori").select("id,nome,cognome").in("id", ids);
    if (err3) throw err3;
    const nomi = new Map(((istr ?? []) as any[]).map((i) => [i.id, `${i.nome ?? ""} ${i.cognome ?? ""}`.trim()]));
    const chf = (v: number) => "CHF " + Math.round(v).toLocaleString("de-CH").replace(/,/g, "'");
    const righe = ids.map((id) => {
      const h = ore_tot.get(id) ?? 0;
      const t = tariffa.get(id) ?? 0;
      return [
        nomi.get(id) ?? "—",
        h > 0 ? new Intl.NumberFormat("it-CH", { maximumFractionDigits: 1 }).format(h) : "—",
        t > 0 ? chf(t) : "—",
        h > 0 && t > 0 ? chf(h * t) : "—",
      ];
    }).sort((a, b) => a[0].localeCompare(b[0]));
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: "ore lavorate e tariffe registrate",
      colonne: ["Istruttore", "Ore", "Tariffa oraria", "Costo"],
      righe, allinea_destra: [1, 2, 3],
    });
  });
}

// ── Lezioni private ─────────────────────────────────────────────

async function lezioniStagione(ctx: ContestoModuli) {
  // Il costo sta in costo_totale: non esiste nessuna colonna "prezzo".
  const { data, error } = await supabase
    .from("lezioni_private")
    .select("id,istruttore_id,data,ora_inizio,durata_minuti,costo_totale,annullata")
    .eq("club_id", ctx.club_id);
  if (error) throw error;
  return ((data ?? []) as any[]).filter((l) => !l.annullata && dentro(l.data, ctx.stagione));
}

async function nomiIstruttori(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("istruttori").select("id,nome,cognome").in("id", ids);
  if (error) throw error;
  return new Map(((data ?? []) as any[]).map((i) => [i.id, `${i.nome ?? ""} ${i.cognome ?? ""}`.trim()]));
}

async function modLezioniIstruttore(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("lezioni_istruttore");
  return sicuro(def, async () => {
    const lez = await lezioniStagione(ctx);
    if (lez.length === 0) return vuoto(def, "Non ci sono lezioni private in questa stagione.");
    const ore = new Map<string, number>();
    for (const l of lez) {
      if (!l.istruttore_id) continue;
      ore.set(l.istruttore_id, (ore.get(l.istruttore_id) ?? 0) + (Number(l.durata_minuti) || 0) / 60);
    }
    if (ore.size === 0) return vuoto(def, "Le lezioni private non sono collegate a un istruttore.");
    const nomi = await nomiIstruttori(Array.from(ore.keys()));
    const dati = limita_voci(Array.from(ore.entries())
      .map(([id, valore]) => ({ etichetta: nomi.get(id) ?? "—", valore }))
      .sort((a, b) => b.valore - a.valore));
    return ok(def, {
      tipo: "barre", orientamento: "orizzontale", titolo: def.titolo,
      sottotitolo: "ore erogate", formato: "ore", dati,
    });
  });
}

async function modLezioniFasce(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("lezioni_fasce");
  return sicuro(def, async () => {
    const lez = await lezioniStagione(ctx);
    if (lez.length === 0) return vuoto(def, "Non ci sono lezioni private in questa stagione.");
    // Tutta la giornata: nessun taglio sulle ore del mattino.
    const per_ora = new Map<number, number>();
    for (const l of lez) {
      const h = Number(String(l.ora_inizio ?? "").slice(0, 2));
      if (!Number.isFinite(h) || h < 0 || h > 23) continue;
      per_ora.set(h, (per_ora.get(h) ?? 0) + 1);
    }
    if (per_ora.size === 0) return vuoto(def, "L'orario delle lezioni private non è stato registrato.");
    const ore = Array.from(per_ora.keys()).sort((a, b) => a - b);
    const dati = [];
    for (let h = ore[0]; h <= ore[ore.length - 1]; h++) {
      dati.push({
        etichetta: `${String(h).padStart(2, "0")}-${String(h + 1).padStart(2, "0")}`,
        valore: per_ora.get(h) ?? 0,
      });
    }
    return ok(def, {
      tipo: "barre", orientamento: "verticale", titolo: def.titolo,
      sottotitolo: "numero di lezioni per ora di inizio", dati,
    });
  });
}

async function modLezioniIncasso(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("lezioni_incasso");
  return sicuro(def, async () => {
    const lez = await lezioniStagione(ctx);
    if (lez.length === 0) return vuoto(def, "Non ci sono lezioni private in questa stagione.");
    const con_costo = lez.filter((l) => Number(l.costo_totale) > 0);
    if (con_costo.length === 0) return vuoto(def, "Il costo delle lezioni private non è stato registrato.");
    const per_istr = new Map<string, { n: number; ore: number; incasso: number }>();
    for (const l of con_costo) {
      const k = l.istruttore_id ?? "—";
      const v = per_istr.get(k) ?? { n: 0, ore: 0, incasso: 0 };
      v.n++;
      v.ore += (Number(l.durata_minuti) || 0) / 60;
      v.incasso += Number(l.costo_totale) || 0;
      per_istr.set(k, v);
    }
    const nomi = await nomiIstruttori(Array.from(per_istr.keys()).filter((k) => k !== "—"));
    const chf = (v: number) => "CHF " + Math.round(v).toLocaleString("de-CH").replace(/,/g, "'");
    const righe = Array.from(per_istr.entries())
      .sort((a, b) => b[1].incasso - a[1].incasso)
      .map(([id, v]) => [
        nomi.get(id) ?? "Senza istruttore",
        String(v.n),
        new Intl.NumberFormat("it-CH", { maximumFractionDigits: 1 }).format(v.ore),
        chf(v.incasso),
      ]);
    const totale = con_costo.reduce((s, l) => s + (Number(l.costo_totale) || 0), 0);
    righe.push(["Totale", String(con_costo.length), "", chf(totale)]);
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: "costo registrato sulle lezioni",
      colonne: ["Istruttore", "Lezioni", "Ore", "Incasso"],
      righe, allinea_destra: [1, 2, 3],
    });
  });
}

// ── Attività sportiva ───────────────────────────────────────────

const testo_resoconto = (chiave: string, opzioni: Record<string, any> = {}) =>
  i18n.t(`relazione.resoconto.${chiave}`, { ns: "dashboard", ...opzioni }) as string;

const data_it = (d: any) => (d ? String(d).slice(0, 10).split("-").reverse().join(".") : "—");

/** Gare della stagione, ordinate per data. Ogni lettura è delimitata dal club. */
async function gareStagione(ctx: ContestoModuli) {
  const { data, error } = await supabase
    .from("gare_calendario").select("id,nome,data,luogo,club_ospitante")
    .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
  if (error) throw error;
  return ((data ?? []) as any[]).sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? "")));
}

/** Classifiche importate: tutte le righe, anche delle atlete degli altri club. */
async function risultatiDelleGare(gara_ids: string[]) {
  if (gara_ids.length === 0) return [] as any[];
  const { data, error } = await supabase
    .from("risultati_gara")
    .select("gara_id,atleta_id,atleta_nome_esterno,club_esterno,rank,starting_number,tot,tes,pcs,deductions,categoria,gruppo,disciplina,segmento")
    .in("gara_id", gara_ids);
  if (error) throw error;
  return (data ?? []) as any[];
}

async function nomeDelClub(club_id: string): Promise<string> {
  const { data, error } = await supabase.from("clubs").select("nome").eq("id", club_id).maybeSingle();
  if (error) throw error;
  return String((data as any)?.nome ?? "").trim();
}

function ordinale(n: number): string {
  return testo_resoconto("ordinale", { n });
}

/** Modulo indice: le gare della stagione con iscritte e podi. */
async function modGareStagione(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = { ...def_di("sportivo_gare_elenco"), titolo: testo_resoconto("titolo_elenco") };
  return sicuro(def, async () => {
    const gare = await gareStagione(ctx);
    if (gare.length === 0) return vuoto(def, testo_resoconto("vuoto_gare"));
    const { iscrizioni } = await gareEIscrizioni(ctx);
    const risultati = await risultatiDelleGare(gare.map((g) => g.id));
    const righe = gare.map((g) => {
      const sue_iscrizioni = iscrizioni.filter((i) => i.gara_id === g.id);
      const sue_righe = risultati.filter((r) => r.gara_id === g.id);
      const nostre = sue_righe.filter((r) => r.atleta_id);
      const iscritte = Math.max(sue_iscrizioni.length, new Set(nostre.map((r) => r.atleta_id)).size);
      const podi = Math.max(
        sue_iscrizioni.filter((i) => medaglia_di(i)).length,
        nostre.filter((r) => Number(r.rank) >= 1 && Number(r.rank) <= 3).length,
      );
      const nome = sue_righe.length === 0
        ? `${String(g.nome ?? "—")}\n(${testo_resoconto("classifica_mancante")})`
        : String(g.nome ?? "—");
      return [
        data_it(g.data), nome, String(g.luogo ?? g.club_ospitante ?? "—"),
        String(iscritte), String(podi),
      ];
    });
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: testo_resoconto("sottotitolo_elenco"),
      colonne: [
        testo_resoconto("col_data"), testo_resoconto("col_gara"), testo_resoconto("col_luogo"),
        testo_resoconto("col_iscritte"), testo_resoconto("col_podi"),
      ],
      righe, allinea_destra: [3, 4],
    });
  });
}

/** Resoconto tecnico: una pagina per gara, classifica completa per categoria. */
async function modResocontoGare(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = { ...def_di("sportivo_resoconto"), titolo: testo_resoconto("titolo_resoconto") };
  return sicuro(def, async () => {
    const gare = await gareStagione(ctx);
    if (gare.length === 0) return vuoto(def, testo_resoconto("vuoto_gare"));
    const risultati = await risultatiDelleGare(gare.map((g) => g.id));
    if (risultati.length === 0) return vuoto(def, testo_resoconto("vuoto_classifiche"));
    const nome_club = await nomeDelClub(ctx.club_id);

    const blocchi = [];
    for (const g of gare) {
      const sue = risultati.filter((r) => r.gara_id === g.id);
      // Gara senza classifica: non si stampa una pagina vuota, resta nell'indice.
      if (sue.length === 0) continue;
      const gruppi = new Map<string, any[]>();
      for (const r of sue) {
        const categoria = String(r.categoria ?? "").trim() || testo_resoconto("senza_categoria");
        const segmento = String(r.segmento ?? "").trim();
        const chiave = segmento ? `${categoria} · ${segmento}` : categoria;
        gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), r]);
      }
      const tabelle = Array.from(gruppi.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([titolo, righe_gruppo]) => {
          // Le colonne dei punteggi compaiono solo se la categoria le ha davvero.
          const ha = (campo: string) => righe_gruppo.some((r) => r[campo] !== null && r[campo] !== undefined);
          const punteggi = (["tot", "tes", "pcs"] as const).filter((c) => ha(c));
          const colonne = [
            testo_resoconto("col_pos"), testo_resoconto("col_atleta"), testo_resoconto("col_club"),
            ...punteggi.map((c) => testo_resoconto(`col_${c}`)),
          ];
          const num = (v: any) =>
            v === null || v === undefined ? "—" : new Intl.NumberFormat("it-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));
          const ordinate = [...righe_gruppo].sort((a, b) => {
            const ra = Number.isFinite(Number(a.rank)) && a.rank !== null ? Number(a.rank) : 9999;
            const rb = Number.isFinite(Number(b.rank)) && b.rank !== null ? Number(b.rank) : 9999;
            return ra - rb || Number(a.starting_number ?? 0) - Number(b.starting_number ?? 0);
          });
          const righe = ordinate.map((r) => ({
            evidenzia: Boolean(r.atleta_id),
            celle: [
              r.rank === null || r.rank === undefined ? "—" : String(r.rank),
              String(r.atleta_nome_esterno ?? "").trim() || "—",
              String(r.club_esterno ?? "").trim() || "—",
              ...punteggi.map((c) => num(r[c])),
            ],
          }));
          const nostre = ordinate.filter((r) => r.atleta_id);
          let sintesi: string | undefined;
          if (nostre.length > 0) {
            const piazzamenti = nostre
              .map((r) => Number(r.rank))
              .filter((n) => Number.isFinite(n) && n > 0);
            const podi = nostre.filter((r) => Number(r.rank) >= 1 && Number(r.rank) <= 3).length;
            sintesi = testo_resoconto("sintesi", {
              count: nostre.length,
              club: nome_club || testo_resoconto("col_club"),
              miglior: piazzamenti.length > 0 ? ordinale(Math.min(...piazzamenti)) : "—",
              podi: testo_resoconto(podi === 0 ? "podi_zero" : "podi", { count: podi }),
            });
          }
          return {
            titolo, colonne, righe, colonna_nome: 1,
            allinea_destra: punteggi.map((_, i) => 3 + i),
            sintesi,
          };
        });
      blocchi.push({
        titolo: String(g.nome ?? "—"),
        sottotitolo: [data_it(g.data), String(g.luogo ?? g.club_ospitante ?? "").trim()]
          .filter((s) => s && s !== "—").join(" · "),
        nota: testo_resoconto("nostre_atlete"),
        tabelle,
      });
    }
    if (blocchi.length === 0) return vuoto(def, testo_resoconto("vuoto_classifiche"));
    return ok(def, {
      tipo: "resoconto", titolo: def.titolo, sottotitolo: testo_resoconto("sottotitolo_resoconto"),
      gare: blocchi, didascalia: testo_resoconto("didascalia", { count: blocchi.length }),
    });
  });
}

/** Una agonista con il suo cammino nella stagione. */
export interface CamminoAtleta {
  atleta_id: string;
  nome: string;
  foto_path: string | null;
  gare_disputate: number;
  miglior_piazzamento: string;
  test_superati: number;
  livello: string;
}

/**
 * Il cammino delle agoniste: gare, miglior piazzamento, test e livello.
 * Unica lettura, usata sia dal modulo della relazione sia dalle slide per
 * atleta: i due formati non devono mai contare in modo diverso.
 */
export async function fetchCamminoAtlete(
  ctx: Pick<ContestoModuli, "club_id" | "stagione"> & Partial<ContestoModuli>,
): Promise<CamminoAtleta[]> {
  const contesto = { stagioni: [], ...ctx } as ContestoModuli;
  const { data: atlete, error } = await supabase
    .from("atleti").select("id,nome,cognome,livello_attuale,categoria,foto_path")
    .eq("club_id", contesto.club_id).eq("attivo", true).eq("agonista", true);
  if (error) throw error;
  const lista = (atlete ?? []) as any[];
  if (lista.length === 0) return [];

  const gare = await gareStagione(contesto);
  const risultati = await risultatiDelleGare(gare.map((g) => g.id));
  const { iscrizioni } = await gareEIscrizioni(contesto);

  const { data: sessioni, error: err2 } = await supabase
    .from("test_livello").select("id")
    .eq("club_id", contesto.club_id).eq("stagione_id", contesto.stagione.id);
  if (err2) throw err2;
  const sessione_ids = ((sessioni ?? []) as any[]).map((s) => s.id);
  let test_righe: any[] = [];
  if (sessione_ids.length > 0) {
    const { data, error: err3 } = await supabase
      .from("test_livello_atleti").select("atleta_id,esito,livello_target")
      .in("test_id", sessione_ids);
    if (err3) throw err3;
    test_righe = (data ?? []) as any[];
  }

  return lista
    .map((a): CamminoAtleta => {
      const sue_righe = risultati.filter((r) => r.atleta_id === a.id);
      const sue_iscrizioni = iscrizioni.filter((i) => i.atleta_id === a.id);
      const gare_disputate = new Set([
        ...sue_righe.map((r) => r.gara_id),
        ...sue_iscrizioni.map((i) => i.gara_id),
      ]).size;
      const piazzamenti = [
        ...sue_righe.map((r) => Number(r.rank)),
        ...sue_iscrizioni.map((i) => Number(i.posizione)),
      ].filter((n) => Number.isFinite(n) && n > 0);
      const test_superati = test_righe.filter(
        (t) => t.atleta_id === a.id && String(t.esito ?? "").toLowerCase() === "superato",
      ).length;
      return {
        atleta_id: String(a.id),
        nome: `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() || "—",
        foto_path: a.foto_path ?? null,
        gare_disputate,
        miglior_piazzamento: piazzamenti.length > 0 ? ordinale(Math.min(...piazzamenti)) : "—",
        test_superati,
        livello: String(a.livello_attuale ?? a.categoria ?? "—"),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

async function modCamminoAtlete(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = { ...def_di("sportivo_cammino"), titolo: testo_resoconto("titolo_cammino") };
  return sicuro(def, async () => {
    const atlete = await fetchCamminoAtlete(ctx);
    if (atlete.length === 0) return vuoto(def, testo_resoconto("vuoto_agoniste"));
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: testo_resoconto("sottotitolo_cammino"),
      colonne: [
        testo_resoconto("col_atleta"), testo_resoconto("col_gare_disputate"),
        testo_resoconto("col_miglior"), testo_resoconto("col_test_superati"), testo_resoconto("col_livello"),
      ],
      righe: atlete.map((a) => [
        a.nome, String(a.gare_disputate), a.miglior_piazzamento,
        String(a.test_superati), a.livello,
      ]),
      allinea_destra: [1, 3],
    });
  });
}



async function gareEIscrizioni(ctx: ContestoModuli) {
  const { data: gare, error } = await supabase
    .from("gare_calendario").select("id,nome,data")
    .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
  if (error) throw error;
  const lista = (gare ?? []) as any[];
  if (lista.length === 0) return { gare: lista, iscrizioni: [] as any[] };
  const { data: iscr, error: err2 } = await supabase
    .from("iscrizioni_gare").select("gara_id,atleta_id,posizione,medaglia,livello_atleta")
    .in("gara_id", lista.map((g) => g.id));
  if (err2) throw err2;
  return { gare: lista, iscrizioni: (iscr ?? []) as any[] };
}

async function nomiAtlete(club_id: string, ids: string[]): Promise<Map<string, string>> {
  const unici = Array.from(new Set(ids.filter(Boolean)));
  if (unici.length === 0) return new Map();
  const { data, error } = await supabase
    .from("atleti")
    .select("id,nome,cognome")
    .eq("club_id", club_id)
    .in("id", unici);
  if (error) throw error;
  return new Map(((data ?? []) as any[]).map((a) => [a.id, `${a.nome ?? ""} ${a.cognome ?? ""}`.trim()]));
}

function medaglia_di(i: any): "oro" | "argento" | "bronzo" | null {
  const m = String(i.medaglia ?? "").toLowerCase();
  if (m.includes("oro") || i.posizione === 1) return "oro";
  if (m.includes("argent") || i.posizione === 2) return "argento";
  if (m.includes("bronz") || i.posizione === 3) return "bronzo";
  return null;
}

async function modSportivoGare(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("sportivo_gare");
  return sicuro(def, async () => {
    const { gare, iscrizioni } = await gareEIscrizioni(ctx);
    if (gare.length === 0) return vuoto(def, "Non ci sono gare in calendario per questa stagione.");
    if (iscrizioni.length === 0) return vuoto(def, "Le iscrizioni alle gare non sono state registrate.");
    const righe = gare.map((g) => {
      const sue = iscrizioni.filter((i) => i.gara_id === g.id);
      const podi = sue.filter((i) => medaglia_di(i)).length;
      return [
        String(g.nome ?? "—"),
        g.data ? String(g.data).slice(0, 10).split("-").reverse().join(".") : "—",
        String(sue.length),
        String(podi),
      ];
    }).sort((a, b) => a[1].localeCompare(b[1]));
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: "partecipazioni e podi per gara",
      colonne: ["Gara", "Data", "Partecipanti", "Podi"],
      righe, allinea_destra: [2, 3],
    });
  });
}

async function modSportivoPodi(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("sportivo_podi");
  return sicuro(def, async () => {
    const { gare, iscrizioni } = await gareEIscrizioni(ctx);
    if (gare.length === 0) return vuoto(def, "Non ci sono gare in calendario per questa stagione.");
    if (iscrizioni.length === 0) return vuoto(def, "I risultati di gara non sono stati registrati.");
    const podi = iscrizioni.filter((i) => medaglia_di(i));
    if (podi.length === 0) return vuoto(def, "I risultati di gara non sono stati registrati.");
    const per_livello = new Map<string, number>();
    for (const i of podi) {
      const k = String(i.livello_atleta ?? "").trim() || testo_modulo("livello_non_indicato");
      per_livello.set(k, (per_livello.get(k) ?? 0) + 1);
    }
    const dati = limita_voci(Array.from(per_livello.entries())
      .map(([etichetta, valore]) => ({ etichetta, valore }))
      .sort((a, b) => b.valore - a.valore));
    return ok(def, {
      tipo: "barre", orientamento: "orizzontale", titolo: def.titolo,
      sottotitolo: testo_modulo("podi_sottotitolo"), dati,
    });
  });
}

async function modSportivoPodioDettaglio(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = { ...def_di("sportivo_podio_dettaglio"), titolo: testo_modulo("podio_titolo") };
  return sicuro(def, async () => {
    const { gare, iscrizioni } = await gareEIscrizioni(ctx);
    const medaglie = iscrizioni.filter((i) => ["oro", "argento", "bronzo"].includes(String(i.medaglia ?? "").toLowerCase()));
    if (medaglie.length === 0) return vuoto(def, testo_modulo("podio_vuoto"));
    const nomi = await nomiAtlete(ctx.club_id, medaglie.map((i) => i.atleta_id));
    if (medaglie.some((i) => !nomi.get(i.atleta_id))) throw new Error(testo_modulo("atleta_mancante"));
    const gare_per_id = new Map(gare.map((g) => [g.id, g]));
    const righe = medaglie
      .map((i) => {
        const gara = gare_per_id.get(i.gara_id);
        return {
          data: String(gara?.data ?? ""),
          celle: [
            nomi.get(i.atleta_id) ?? "",
            String(gara?.nome ?? "—"),
            gara?.data ? String(gara.data).slice(0, 10).split("-").reverse().join(".") : "—",
            String(i.livello_atleta ?? "—"),
            String(i.medaglia).toLowerCase(),
          ],
        };
      })
      .sort((a, b) => a.data.localeCompare(b.data) || a.celle[0].localeCompare(b.celle[0]))
      .map((r) => r.celle);
    return ok(def, {
      tipo: "tabella", titolo: def.titolo,
      colonne: [testo_modulo("atleta"), testo_modulo("gara"), testo_modulo("data"), testo_modulo("livello"), testo_modulo("medaglia")], righe,
    });
  });
}

async function modSportivoTest(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("sportivo_test");
  return sicuro(def, async () => {
    const { data: test, error } = await supabase
      .from("test_livello").select("id")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (error) throw error;
    const ids = ((test ?? []) as any[]).map((t) => t.id);
    if (ids.length === 0) return vuoto(def, "Non ci sono sessioni di test in questa stagione.");
    const { data: righe, error: err2 } = await supabase
      .from("test_livello_atleti").select("esito,livello_target")
      .in("test_id", ids);
    if (err2) throw err2;
    const con_esito = ((righe ?? []) as any[]).filter((r) => String(r.esito ?? "").trim() !== "");
    if (con_esito.length === 0) return vuoto(def, "L'esito dei test non è stato registrato.");
    const superato = (r: any) => {
      const e = String(r.esito ?? "").toLowerCase();
      return e.includes("superat") && !e.includes("non superat") || e === "ok";
    };
    const per_livello = new Map<string, { si: number; no: number }>();
    for (const r of con_esito) {
      const k = r.livello_target || testo_modulo("livello_non_indicato");
      const v = per_livello.get(k) ?? { si: 0, no: 0 };
      if (superato(r)) v.si++; else v.no++;
      per_livello.set(k, v);
    }
    const dati = limita_voci(Array.from(per_livello.entries())
      .map(([etichetta, v]) => ({ etichetta, valore: v.si, valore2: v.no }))
      .sort((a, b) => (b.valore + (b.valore2 ?? 0)) - (a.valore + (a.valore2 ?? 0))));
    return ok(def, {
      tipo: "barre", orientamento: "orizzontale", impilate: true, titolo: def.titolo,
      sottotitolo: testo_modulo("test_livello_sottotitolo"), dati,
      etichetta_serie1: testo_modulo("test_superati"),
      etichetta_serie2: testo_modulo("test_non_superati"),
    });
  });
}

async function modSportivoTestDettaglio(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = { ...def_di("sportivo_test_dettaglio"), titolo: testo_modulo("test_titolo") };
  return sicuro(def, async () => {
    const { data: test, error } = await supabase
      .from("test_livello").select("id,data")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (error) throw error;
    const sessioni = (test ?? []) as any[];
    if (sessioni.length === 0) return vuoto(def, testo_modulo("test_vuoto"));
    const { data, error: err2 } = await supabase
      .from("test_livello_atleti").select("test_id,atleta_id,livello_target,esito")
      .in("test_id", sessioni.map((r) => r.id)).eq("esito", "superato");
    if (err2) throw err2;
    const superati = (data ?? []) as any[];
    if (superati.length === 0) return vuoto(def, testo_modulo("test_vuoto"));
    const nomi = await nomiAtlete(ctx.club_id, superati.map((r) => r.atleta_id));
    if (superati.some((r) => !nomi.get(r.atleta_id))) throw new Error(testo_modulo("atleta_mancante"));
    const test_per_id = new Map(sessioni.map((r) => [r.id, r]));
    const righe = superati
      .map((r) => {
        const sessione = test_per_id.get(r.test_id);
        return {
          data: String(sessione?.data ?? ""),
          celle: [
            nomi.get(r.atleta_id) ?? "",
            String(r.livello_target ?? "—"),
            sessione?.data ? String(sessione.data).slice(0, 10).split("-").reverse().join(".") : "—",
          ],
        };
      })
      .sort((a, b) => a.data.localeCompare(b.data) || a.celle[0].localeCompare(b.celle[0]))
      .map((r) => r.celle);
    return ok(def, { tipo: "tabella", titolo: def.titolo, colonne: [testo_modulo("atleta"), testo_modulo("livello_ottenuto"), testo_modulo("data")], righe });
  });
}

// ── Presenze (solo totali, mai nomi) ────────────────────────────

async function modPresenzeCorsi(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("presenze_corsi");
  return sicuro(def, async () => {
    const { data: corsi, error } = await supabase
      .from("corsi").select("id,nome")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id);
    if (error) throw error;
    const lista = (corsi ?? []) as any[];
    if (lista.length === 0) return vuoto(def, "Non ci sono corsi registrati per questa stagione.");
    const { data: pres, error: err2 } = await supabase
      .from("presenze_corso").select("corso_id,data,presente")
      .in("corso_id", lista.map((c) => c.id));
    if (err2) throw err2;
    const righe = (pres ?? []) as any[];
    if (righe.length === 0) return vuoto(def, "Gli appelli dei corsi non sono stati registrati.");
    const per_corso = new Map<string, { giorni: Set<string>; presenti: number }>();
    for (const p of righe) {
      const v = per_corso.get(p.corso_id) ?? { giorni: new Set<string>(), presenti: 0 };
      v.giorni.add(String(p.data));
      if (p.presente) v.presenti++;
      per_corso.set(p.corso_id, v);
    }
    const nomi = new Map(lista.map((c) => [c.id, c.nome]));
    const dati = Array.from(per_corso.entries())
      .map(([id, v]) => ({
        etichetta: String(nomi.get(id) ?? "—"),
        valore: v.giorni.size > 0 ? Math.round((v.presenti / v.giorni.size) * 10) / 10 : 0,
      }))
      .filter((d) => d.valore > 0)
      .sort((a, b) => b.valore - a.valore);
    if (dati.length === 0) return vuoto(def, "Gli appelli registrati non contengono presenze.");
    const dati_limitati = limita_voci(dati);
    return ok(def, {
      tipo: "barre", titolo: def.titolo,
      orientamento: "orizzontale",
      sottotitolo: "media di atlete presenti per lezione (solo totali)", dati: dati_limitati,
    });
  });
}

// ── Comunicazione ───────────────────────────────────────────────

async function modComunicazione(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("comunicazione_messaggi");
  return sicuro(def, async () => {
    const { data, error } = await supabase
      .from("comunicazioni").select("id,created_at,inviata_at,letta")
      .eq("club_id", ctx.club_id);
    if (error) throw error;
    const righe = ((data ?? []) as any[]).filter(
      (c) => dentro(c.inviata_at ?? c.created_at, ctx.stagione),
    );
    const inviate = righe.filter((c) => c.inviata_at).length;
    if (inviate === 0) return vuoto(def, "Non sono stati inviati messaggi in questa stagione.");
    const lette = righe.filter((c) => c.inviata_at && c.letta).length;
    return ok(def, {
      tipo: "barre", titolo: def.titolo, sottotitolo: "messaggi della stagione",
      dati: [
        { etichetta: "Inviati", valore: inviate },
        { etichetta: "Letti", valore: lette },
      ],
    });
  });
}

// ── Sponsor ─────────────────────────────────────────────────────

async function modSponsor(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("sponsor_elenco");
  return sicuro(def, async () => {
    const { data, error } = await supabase
      .from("sponsor_attivi").select("nome_sponsor,categoria,livello,importo_annuo,stagione_inizio,stagione_fine")
      .eq("club_id", ctx.club_id);
    if (error) throw error;
    const righe = (data ?? []) as any[];
    if (righe.length === 0) return vuoto(def, "Non ci sono sponsor registrati.");
    const chf = (v: any) => (Number(v) > 0 ? "CHF " + Math.round(Number(v)).toLocaleString("de-CH").replace(/,/g, "'") : "—");
    const tabella = righe
      .sort((a, b) => (Number(b.importo_annuo) || 0) - (Number(a.importo_annuo) || 0))
      .map((s) => [String(s.nome_sponsor ?? "—"), String(s.livello ?? s.categoria ?? "—"), chf(s.importo_annuo)]);
    const totale = righe.reduce((s, r) => s + (Number(r.importo_annuo) || 0), 0);
    if (totale > 0) tabella.push(["Totale", "", chf(totale)]);
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: "sponsor registrati nel club",
      colonne: ["Sponsor", "Livello", "Importo annuo"],
      righe: tabella, allinea_destra: [2],
    });
  });
}
