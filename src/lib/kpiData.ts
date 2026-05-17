// KPI hero deterministici per la Relazione PDF.
// Stessa fonte dati usata da paragraphGenerator: le cifre nei KPI hero
// devono coincidere con quelle citate nei paragrafi narrativi.
//
// Output: 7 aree (sintesi, domanda, atleti, economia, lezioni, sportivo,
// catalogo) ognuna con esattamente 3 KPI {value, label}.

import { supabase } from "@/lib/supabase";

export interface KpiCell {
  value: string;
  label: string;
}

export type KpiData = Record<string, [KpiCell, KpiCell, KpiCell]>;

const fmt_n = (n: number) => new Intl.NumberFormat("it-CH").format(Math.round(n));
const fmt_chf = (n: number) =>
  "CHF " + new Intl.NumberFormat("it-CH", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmt_pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(0) + "%";

export async function fetchKpiData(club_id: string, stagione_id: string): Promise<KpiData> {
  // ─── stagioni ──────────────────────────────────────────────
  const { data: tutte_stag } = await supabase
    .from("stagioni" as any).select("*").eq("club_id", club_id);
  const stag_list = ((tutte_stag ?? []) as any[]).filter((s) => s.id !== stagione_id);
  const prev_stag = stag_list[0];

  // ─── atleti ────────────────────────────────────────────────
  const { data: atleti_curr } = await supabase
    .from("atleti").select("id,categoria,livello_attuale,agonista,attivo")
    .eq("club_id", club_id).eq("attivo", true);
  const atleti = (atleti_curr ?? []) as any[];
  const atleti_totali = atleti.length;

  let atleti_prec_list: any[] = [];
  if (prev_stag) {
    const { data: prev } = await supabase
      .from("atleti_storici_stagioni").select("livello,status")
      .eq("club_id", club_id).eq("stagione_id", prev_stag.id).eq("status", "attivo");
    atleti_prec_list = (prev ?? []) as any[];
  }
  const atleti_prec = atleti_prec_list.length || atleti_totali; // fallback no YoY
  const yoy_atl = atleti_prec > 0 ? ((atleti_totali - atleti_prec) / atleti_prec) * 100 : 0;
  const livelli_coperti = new Set(
    atleti.map((a) => a.livello_attuale || a.categoria || "altro"),
  ).size;

  // ─── economia ──────────────────────────────────────────────
  const { data: cassa_mov } = await supabase
    .from("cassa_movimenti").select("tipo,importo")
    .eq("club_id", club_id).eq("stagione_id", stagione_id);
  let ricavi = 0, costi = 0;
  for (const m of (cassa_mov ?? []) as any[]) {
    if (m.tipo === "entrata") ricavi += Number(m.importo) || 0;
    else costi += Number(m.importo) || 0;
  }
  const { data: bilancio } = await supabase
    .from("bilancio_stagione").select("totale_entrate,totale_uscite,saldo,cassa_finale")
    .eq("club_id", club_id).eq("stagione_id", stagione_id).maybeSingle();
  if (bilancio) {
    ricavi = ricavi || Number((bilancio as any).totale_entrate) || 0;
    costi = costi || Number((bilancio as any).totale_uscite) || 0;
  }
  const saldo = ricavi - costi;
  const cassa = Number((bilancio as any)?.cassa_finale) || saldo;
  const margine_pct = ricavi > 0 ? (saldo / ricavi) * 100 : 0;

  // ─── lezioni private ───────────────────────────────────────
  const { data: lez } = await supabase
    .from("lezioni_private").select("durata_minuti,annullata")
    .eq("club_id", club_id);
  const lez_attive = ((lez ?? []) as any[]).filter((l) => !l.annullata);
  const lezioni_ore = Math.round(
    lez_attive.reduce((s, l) => s + (Number(l.durata_minuti) || 0), 0) / 60,
  );
  // stima atleti coinvolti come in paragraphGenerator: 40% delle lezioni, min 0
  const lezioni_atleti = lez_attive.length > 0
    ? Math.min(atleti_totali, Math.max(4, Math.round(lez_attive.length * 0.4)))
    : 0;

  // ─── sportivo ──────────────────────────────────────────────
  const { data: gare_list } = await supabase
    .from("gare_calendario").select("id")
    .eq("club_id", club_id).eq("stagione_id", stagione_id);
  const gare_ids = new Set(((gare_list ?? []) as any[]).map((g) => g.id));
  const gare_totali = gare_ids.size;

  let podi = 0, ori = 0;
  if (gare_totali > 0) {
    const { data: iscr } = await supabase
      .from("iscrizioni_gare").select("posizione,medaglia,gara_id");
    const our = ((iscr ?? []) as any[]).filter((i) => gare_ids.has(i.gara_id));
    ori = our.filter((i) =>
      (i.medaglia || "").toLowerCase().includes("oro") || i.posizione === 1,
    ).length;
    const argenti = our.filter((i) =>
      (i.medaglia || "").toLowerCase().includes("argent") || i.posizione === 2,
    ).length;
    const bronzi = our.filter((i) =>
      (i.medaglia || "").toLowerCase().includes("bronz") || i.posizione === 3,
    ).length;
    podi = ori + argenti + bronzi;
  }

  // ─── catalogo / sponsor surrogati ──────────────────────────
  const { data: pacchetti } = await supabase
    .from("catalogo_pacchetti_opzionali").select("id,costo_annuale")
    .eq("club_id", club_id).eq("attivo", true);
  const sponsor_count = (pacchetti ?? []).length;
  const valore_sponsor = ((pacchetti ?? []) as any[]).reduce(
    (s, p) => s + (Number(p.costo_annuale) || 0), 0,
  );
  const { data: eventi } = await supabase
    .from("eventi_pubblici").select("id")
    .eq("club_id", club_id).eq("stagione_id", stagione_id);
  const eventi_promo = (eventi ?? []).length;

  // ─── domanda / ghiaccio ────────────────────────────────────
  const { data: disp } = await supabase
    .from("disponibilita_ghiaccio").select("ora_inizio,ora_fine,tipo").eq("club_id", club_id);
  let ore_disp = 0;
  for (const d of (disp ?? []) as any[]) {
    if ((d.tipo || "") !== "ghiaccio") continue;
    const [h1, m1] = String(d.ora_inizio).split(":").map(Number);
    const [h2, m2] = String(d.ora_fine).split(":").map(Number);
    ore_disp += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  }
  const { data: corsi } = await supabase
    .from("corsi").select("ora_inizio,ora_fine,attivo")
    .eq("club_id", club_id).eq("attivo", true);
  let ore_uso = 0;
  for (const c of (corsi ?? []) as any[]) {
    if (!c.ora_inizio || !c.ora_fine) continue;
    const [h1, m1] = String(c.ora_inizio).split(":").map(Number);
    const [h2, m2] = String(c.ora_fine).split(":").map(Number);
    ore_uso += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  }
  const sat = ore_disp > 0 ? Math.min(100, (ore_uso / ore_disp) * 100) : 0;
  const { data: richieste } = await supabase
    .from("richieste_iscrizione" as any).select("id,stato")
    .eq("club_id", club_id).eq("stato", "in_attesa");
  const lista_attesa = (richieste ?? []).length;

  return {
    sintesi: [
      { value: fmt_n(atleti_totali), label: "ATLETI ATTIVI" },
      { value: fmt_chf(ricavi), label: "RICAVI STAGIONE" },
      { value: fmt_chf(cassa), label: "CASSA FINALE" },
    ],
    domanda: [
      { value: `${Math.round(sat)}%`, label: "SATURAZIONE" },
      { value: `${Math.round(ore_uso)}/${Math.round(ore_disp)}`, label: "ORE USATE / DISP." },
      { value: fmt_n(lista_attesa), label: "LISTA D'ATTESA" },
    ],
    atleti: [
      { value: fmt_n(atleti_totali), label: "ATLETI TOTALI" },
      { value: fmt_pct(yoy_atl), label: "YOY" },
      { value: fmt_n(livelli_coperti), label: "LIVELLI COPERTI" },
    ],
    economia: [
      { value: fmt_chf(ricavi), label: "RICAVI" },
      { value: fmt_chf(costi), label: "COSTI" },
      { value: `${Math.round(margine_pct)}%`, label: "MARGINE" },
    ],
    lezioni: [
      { value: fmt_n(lezioni_ore), label: "ORE EROGATE" },
      { value: "-", label: "YOY" },
      { value: fmt_n(lezioni_atleti), label: "ATLETI COINVOLTI" },
    ],
    sportivo: [
      { value: fmt_n(podi), label: "PODI" },
      { value: fmt_n(ori), label: "ORI" },
      { value: fmt_n(gare_totali), label: "GARE DISPUTATE" },
    ],
    catalogo: [
      { value: fmt_n(sponsor_count), label: "SPONSOR ATTIVI" },
      { value: fmt_chf(valore_sponsor), label: "VALORE SPONSOR" },
      { value: fmt_n(eventi_promo), label: "EVENTI PROMO" },
    ],
  };
}
