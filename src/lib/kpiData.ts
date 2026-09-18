// KPI della Relazione: solo numeri veri, presi dalle stesse letture dei moduli.
// Se un numero non c'è, la cella non viene prodotta: nessuna stima, nessun ripiego.
//
// Scelta dichiarata una volta per tutto il documento: la misura economica usata
// è il FATTURATO (somma delle fatture emesse nella stagione, escluse bozze e
// annullate). Il bilancio di stagione compare solo nel modulo dedicato.

import { supabase } from "@/lib/supabase";
import type { Stagione } from "@/lib/relazione/moduli";

export interface KpiCell {
  value: string;
  label: string;
}

export type KpiData = Record<string, KpiCell[]>;

const fmt_n = (n: number) => new Intl.NumberFormat("it-CH").format(Math.round(n));
const fmt_chf = (n: number) =>
  "CHF " + new Intl.NumberFormat("it-CH", { maximumFractionDigits: 0 }).format(Math.round(n));

function dentro(data: string | null | undefined, stag: Stagione): boolean {
  if (!stag.data_inizio || !stag.data_fine) return true;
  if (!data) return false;
  const d = String(data).slice(0, 10);
  return d >= stag.data_inizio && d <= stag.data_fine;
}

export async function fetchKpiData(club_id: string, stagione: Stagione): Promise<KpiData> {
  const out: KpiData = {};
  const aggiungi = (area: string, cella: KpiCell | null) => {
    if (!cella) return;
    out[area] = out[area] ?? [];
    if (out[area].length < 3) out[area].push(cella);
  };

  // Atlete
  try {
    const { data, error } = await supabase
      .from("atleti").select("id,agonista").eq("club_id", club_id).eq("attivo", true);
    if (error) throw error;
    const atleti = (data ?? []) as any[];
    if (atleti.length > 0) {
      aggiungi("atleti", { value: fmt_n(atleti.length), label: "Atlete attive" });
      const agoniste = atleti.filter((a) => a.agonista).length;
      if (agoniste > 0) aggiungi("atleti", { value: fmt_n(agoniste), label: "Agoniste" });
    }
  } catch { /* nessuna cella: il KPI resta assente, non finto */ }

  // Corsi
  try {
    const { data, error } = await supabase
      .from("corsi").select("id,attivo").eq("club_id", club_id).eq("stagione_id", stagione.id);
    if (error) throw error;
    const attivi = ((data ?? []) as any[]).filter((c) => c.attivo !== false);
    if (attivi.length > 0) {
      aggiungi("corsi", { value: fmt_n(attivi.length), label: "Corsi attivi" });
      const { data: iscr } = await supabase
        .from("iscrizioni_corsi").select("corso_id,attiva").in("corso_id", attivi.map((c) => c.id));
      const n = ((iscr ?? []) as any[]).filter((i) => i.attiva !== false).length;
      if (n > 0) aggiungi("corsi", { value: fmt_n(n), label: "Iscrizioni" });
    }
  } catch { /* vedi sopra */ }

  // Economia: fatturato e incassato della stagione
  try {
    const { data, error } = await supabase
      .from("fatture").select("importo,data_emissione,data_pagamento,stato").eq("club_id", club_id);
    if (error) throw error;
    const fatture = ((data ?? []) as any[]).filter(
      (f) => f.stato !== "bozza" && f.stato !== "annullata" && dentro(f.data_emissione, stagione),
    );
    if (fatture.length > 0) {
      const fatturato = fatture.reduce((s, f) => s + (Number(f.importo) || 0), 0);
      const incassato = fatture.filter((f) => f.data_pagamento).reduce((s, f) => s + (Number(f.importo) || 0), 0);
      aggiungi("economia", { value: fmt_chf(fatturato), label: "Fatturato" });
      aggiungi("economia", { value: fmt_chf(incassato), label: "Incassato" });
      aggiungi("economia", { value: fmt_n(fatture.length), label: "Fatture emesse" });
    }
  } catch { /* vedi sopra */ }

  // Lezioni private
  try {
    const { data, error } = await supabase
      .from("lezioni_private").select("data,durata_minuti,costo_totale,annullata").eq("club_id", club_id);
    if (error) throw error;
    const lez = ((data ?? []) as any[]).filter((l) => !l.annullata && dentro(l.data, stagione));
    if (lez.length > 0) {
      const ore = lez.reduce((s, l) => s + (Number(l.durata_minuti) || 0), 0) / 60;
      aggiungi("lezioni", { value: fmt_n(lez.length), label: "Lezioni" });
      if (ore > 0) aggiungi("lezioni", { value: fmt_n(ore), label: "Ore erogate" });
      const incasso = lez.reduce((s, l) => s + (Number(l.costo_totale) || 0), 0);
      if (incasso > 0) aggiungi("lezioni", { value: fmt_chf(incasso), label: "Incasso" });
    }
  } catch { /* vedi sopra */ }

  // Sportivo
  try {
    const { data: gare, error } = await supabase
      .from("gare_calendario").select("id").eq("club_id", club_id).eq("stagione_id", stagione.id);
    if (error) throw error;
    const ids = ((gare ?? []) as any[]).map((g) => g.id);
    if (ids.length > 0) {
      aggiungi("sportivo", { value: fmt_n(ids.length), label: "Gare disputate" });
      const { data: iscr } = await supabase
        .from("iscrizioni_gare").select("posizione,medaglia,gara_id").in("gara_id", ids);
      const righe = (iscr ?? []) as any[];
      const podi = righe.filter((i) => {
        const m = String(i.medaglia ?? "").toLowerCase();
        return m.includes("oro") || m.includes("argent") || m.includes("bronz") || (i.posizione && i.posizione <= 3);
      }).length;
      if (righe.length > 0) {
        aggiungi("sportivo", { value: fmt_n(righe.length), label: "Partecipazioni" });
        aggiungi("sportivo", { value: fmt_n(podi), label: "Podi" });
      }
    }
  } catch { /* vedi sopra */ }

  // Sponsor
  try {
    const { data, error } = await supabase
      .from("sponsor_attivi").select("importo_annuo").eq("club_id", club_id);
    if (error) throw error;
    const righe = (data ?? []) as any[];
    if (righe.length > 0) {
      aggiungi("sponsor", { value: fmt_n(righe.length), label: "Sponsor" });
      const tot = righe.reduce((s, r) => s + (Number(r.importo_annuo) || 0), 0);
      if (tot > 0) aggiungi("sponsor", { value: fmt_chf(tot), label: "Valore annuo" });
    }
  } catch { /* vedi sopra */ }

  return out;
}
