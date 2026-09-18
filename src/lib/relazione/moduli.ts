// Moduli dati della Relazione del Presidente.
// Regola: solo numeri veri. Ogni modulo ha tre esiti possibili:
//   "ok"      -> ci sono dati, il grafico/tabella si può stampare
//   "vuoto"   -> la lettura è riuscita ma non ci sono dati: il modulo si spegne da solo
//   "errore"  -> la lettura è fallita: il modulo lo dice, non finge zero
// Nessun valore di ripiego, nessuna stima, nessun dato di esempio.

import { supabase } from "@/lib/supabase";
import i18n from "@/i18n";
import type { GraficoSpec } from "./grafici";

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
  { id: "presenze_corsi", area: "presenze", titolo: "Frequenza media per corso" },
  { id: "comunicazione_messaggi", area: "comunicazione", titolo: "Messaggi inviati e letti" },
  { id: "sponsor_elenco", area: "sponsor", titolo: "Sponsor della stagione" },
];

export const MODULI_ASSEMBLEA = new Set([
  "atleti_andamento", "atleti_piramide", "atleti_agoniste",
  "corsi_riempimento", "economia_mensile", "economia_fonti",
  "lezioni_istruttore", "sportivo_podi", "sportivo_podio_dettaglio", "sportivo_test_dettaglio", "sponsor_elenco",
]);

export const MODULI_COMITATO = new Set([
  "atleti_andamento", "atleti_flussi", "corsi_riempimento", "ghiaccio_ore",
  "economia_mensile", "economia_enti", "economia_bilancio", "economia_istruttori",
  "lezioni_incasso", "sportivo_gare", "sportivo_podio_dettaglio", "sportivo_test", "sportivo_test_dettaglio", "presenze_corsi", "sponsor_elenco",
]);

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
    modPresenzeCorsi(ctx),
    modComunicazione(ctx),
    modSponsor(ctx),
  ]);
  const out: Record<string, ModuloRisultato> = {};
  for (const r of risultati) out[r.id] = r;
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

async function atletiAttivi(club_id: string) {
  const { data, error } = await supabase
    .from("atleti")
    .select("id,livello_attuale,categoria,data_nascita,agonista,created_at")
    .eq("club_id", club_id).eq("attivo", true);
  if (error) throw error;
  return (data ?? []) as any[];
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
    const dati = Array.from(per_livello.entries())
      .map(([etichetta, valore]) => ({ etichetta, valore }))
      .sort((a, b) => b.valore - a.valore);
    return ok(def, { tipo: "barre", titolo: def.titolo, sottotitolo: "atlete attive per livello", dati });
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
    const righe = lista
      .map((c) => {
        const n = conteggi.get(c.id) ?? 0;
        const cap = Number(c.capienza_max) || 0;
        return [
          String(c.nome ?? "—"),
          String(n),
          cap > 0 ? String(cap) : "—",
          cap > 0 ? Math.round((n / cap) * 100) + "%" : "—",
        ];
      })
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: "iscritti su capienza",
      colonne: ["Corso", "Iscritti", "Capienza", "Riempimento"],
      righe, allinea_destra: [1, 2, 3],
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

async function fattureStagione(ctx: ContestoModuli) {
  const { data, error } = await supabase
    .from("fatture")
    .select("id,importo,data_emissione,data_pagamento,pagata,stato,tipo,ragione_sociale_id")
    .eq("club_id", ctx.club_id);
  if (error) throw error;
  return ((data ?? []) as any[]).filter(
    (f) => f.stato !== "bozza" && f.stato !== "annullata" && dentro(f.data_emissione, ctx.stagione),
  );
}

async function modEconomiaMensile(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_mensile");
  return sicuro(def, async () => {
    const fatture = await fattureStagione(ctx);
    if (fatture.length === 0) return vuoto(def, "Non ci sono fatture emesse in questa stagione.");
    const mesi = new Map<string, { fatturato: number; incassato: number }>();
    const chiave = (d: string) => String(d).slice(0, 7);
    for (const f of fatture) {
      if (!f.data_emissione) continue;
      const k = chiave(f.data_emissione);
      const v = mesi.get(k) ?? { fatturato: 0, incassato: 0 };
      v.fatturato += Number(f.importo) || 0;
      mesi.set(k, v);
      if (f.data_pagamento) {
        const kp = chiave(f.data_pagamento);
        const vp = mesi.get(kp) ?? { fatturato: 0, incassato: 0 };
        vp.incassato += Number(f.importo) || 0;
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
    return ok(def, {
      tipo: "barre", titolo: def.titolo, sottotitolo: "fatture emesse nella stagione", formato: "chf",
      dati, etichetta_serie1: "Fatturato", etichetta_serie2: "Incassato",
    });
  });
}

async function modEconomiaEnti(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_enti");
  return sicuro(def, async () => {
    const fatture = await fattureStagione(ctx);
    if (fatture.length === 0) return vuoto(def, "Non ci sono fatture emesse in questa stagione.");
    const { data: enti, error } = await supabase
      .from("ragioni_sociali").select("id,nome").eq("club_id", ctx.club_id);
    if (error) throw error;
    const nomi = new Map(((enti ?? []) as any[]).map((r) => [r.id, r.nome]));
    if (nomi.size === 0) return vuoto(def, "Il club non ha ragioni sociali separate.");
    const per_ente = new Map<string, number>();
    for (const f of fatture) {
      const k = f.ragione_sociale_id ? (nomi.get(f.ragione_sociale_id) ?? "Ente non trovato") : "Club";
      per_ente.set(k, (per_ente.get(k) ?? 0) + (Number(f.importo) || 0));
    }
    const dati = Array.from(per_ente.entries()).map(([etichetta, valore]) => ({ etichetta, valore }));
    return ok(def, { tipo: "donut", titolo: def.titolo, sottotitolo: "fatturato per ente", formato: "chf", dati });
  });
}

async function modEconomiaFonti(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_fonti");
  return sicuro(def, async () => {
    // La ripartizione per fonte sta nelle righe della fattura: fatture.tipo è quasi sempre "Mensile".
    const { data, error } = await supabase
      .from("fatture")
      .select("id,importo,data_emissione,stato,righe")
      .eq("club_id", ctx.club_id);
    if (error) throw error;
    const fatture = ((data ?? []) as any[]).filter(
      (f) => f.stato !== "bozza" && f.stato !== "annullata" && dentro(f.data_emissione, ctx.stagione),
    );
    if (fatture.length === 0) return vuoto(def, "Non ci sono fatture emesse in questa stagione.");

    const per_tipo = new Map<string, number>();
    const aggiungi = (etichetta: string, importo: number) => {
      if (!(importo > 0)) return;
      per_tipo.set(etichetta, (per_tipo.get(etichetta) ?? 0) + importo);
    };
    for (const f of fatture) {
      const righe = Array.isArray(f.righe) ? (f.righe as any[]) : [];
      if (righe.length === 0) {
        aggiungi("Altro", Number(f.importo) || 0);
        continue;
      }
      for (const r of righe) {
        const etichetta = String(r?.tipo ?? "").trim() || "Altro";
        aggiungi(etichetta, Number(r?.importo) || 0);
      }
    }
    const dati = Array.from(per_tipo.entries())
      .map(([etichetta, valore]) => ({ etichetta, valore }))
      .sort((a, b) => b.valore - a.valore);
    if (dati.length === 0) return vuoto(def, "Le fatture di questa stagione non hanno righe con un importo.");
    return ok(def, { tipo: "donut", titolo: def.titolo, sottotitolo: "fatturato per fonte", formato: "chf", dati });
  });
}

async function modEconomiaBilancio(ctx: ContestoModuli): Promise<ModuloRisultato> {
  const def = def_di("economia_bilancio");
  return sicuro(def, async () => {
    const { data, error } = await supabase
      .from("bilancio_stagione").select("totale_entrate,totale_uscite,saldo,cassa_iniziale,cassa_finale")
      .eq("club_id", ctx.club_id).eq("stagione_id", ctx.stagione.id).maybeSingle();
    if (error) throw error;
    if (!data) return vuoto(def, "Il bilancio di questa stagione non è stato compilato.");
    const b = data as any;
    const chf = (v: any) => "CHF " + Math.round(Number(v) || 0).toLocaleString("de-CH").replace(/,/g, "'");
    return ok(def, {
      tipo: "tabella", titolo: def.titolo, sottotitolo: "dal bilancio di stagione",
      colonne: ["Voce", "Importo"],
      righe: [
        ["Totale entrate", chf(b.totale_entrate)],
        ["Totale uscite", chf(b.totale_uscite)],
        ["Saldo", chf(b.saldo ?? (Number(b.totale_entrate) || 0) - (Number(b.totale_uscite) || 0))],
        ["Cassa iniziale", chf(b.cassa_iniziale)],
        ["Cassa finale", chf(b.cassa_finale)],
      ],
      allinea_destra: [1],
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
    const dati = Array.from(ore.entries())
      .map(([id, valore]) => ({ etichetta: nomi.get(id) ?? "—", valore }))
      .sort((a, b) => b.valore - a.valore);
    return ok(def, { tipo: "barre", titolo: def.titolo, sottotitolo: "ore erogate", formato: "ore", dati });
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
    return ok(def, { tipo: "barre", titolo: def.titolo, sottotitolo: "numero di lezioni per ora di inizio", dati });
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
    const conta = (t: string) => iscrizioni.filter((i) => medaglia_di(i) === t).length;
    const dati = [
      { etichetta: "Ori", valore: conta("oro") },
      { etichetta: "Argenti", valore: conta("argento") },
      { etichetta: "Bronzi", valore: conta("bronzo") },
    ];
    if (dati.every((d) => d.valore === 0)) return vuoto(def, "I risultati di gara non sono stati registrati.");
    return ok(def, { tipo: "barre", titolo: def.titolo, sottotitolo: "medaglie della stagione", dati });
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
    const superati = ((righe ?? []) as any[]).filter(
      (r) => String(r.esito ?? "").toLowerCase().includes("superat") || String(r.esito ?? "").toLowerCase() === "ok",
    );
    if (superati.length === 0) return vuoto(def, "L'esito dei test non è stato registrato.");
    const per_livello = new Map<string, number>();
    for (const r of superati) {
      const k = r.livello_target || "Livello non indicato";
      per_livello.set(k, (per_livello.get(k) ?? 0) + 1);
    }
    const dati = Array.from(per_livello.entries())
      .map(([etichetta, valore]) => ({ etichetta, valore }))
      .sort((a, b) => b.valore - a.valore);
    return ok(def, { tipo: "barre", titolo: def.titolo, sottotitolo: "test superati per livello", dati });
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
    return ok(def, {
      tipo: "barre", titolo: def.titolo,
      sottotitolo: "media di atlete presenti per lezione (solo totali)", dati,
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
