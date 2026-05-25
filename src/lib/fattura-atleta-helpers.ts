import { supabase } from "@/lib/supabase";
import type { FatturaAtletaData, FatturaAtletaRiga } from "@/lib/fattura-atleta-pdf";
import { genera_fattura_atleta_blob } from "@/lib/fattura-atleta-pdf";

export type FatturaFull = {
  id: string;
  club_id: string;
  atleta_id: string | null;
  numero: string | null;
  periodo: string | null;
  descrizione: string | null;
  importo: number | null;
  data_emissione: string | null;
  data_scadenza: string | null;
  data_pagamento: string | null;
  pagata: boolean | null;
  stato: string;
  pdf_url: string | null;
  note: string | null;
  righe: FatturaAtletaRiga[] | null;
  intestatario_nome: string | null;
  intestatario_cognome: string | null;
  intestatario_indirizzo: string | null;
  intestatario_cap: string | null;
  intestatario_citta: string | null;
  intestatario_cantone: string | null;
  intestatario_email: string | null;
  sconto_importo_chf: number;
  sconto_percentuale: number;
  sconto_causale: string | null;
  sconto_note: string | null;
};

export async function load_fattura_full(id: string): Promise<{
  fattura: FatturaFull;
  atleta: any | null;
  club: any | null;
}> {
  const { data: f, error } = await supabase.from("fatture").select("*").eq("id", id).maybeSingle();
  if (error || !f) throw error || new Error("Fattura non trovata");
  const [atletaRes, clubRes] = await Promise.all([
    f.atleta_id
      ? supabase
          .from("atleti")
          .select("nome, cognome, codice_atleta, livello_attuale, livello_artistica, livello_stile")
          .eq("id", f.atleta_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("clubs")
      .select("nome, logo_url, indirizzo, cap, citta, cantone, email, telefono, partita_iva, numero_iva_chf, iban, intestatario_iban, twint_qr_url")
      .eq("id", f.club_id)
      .maybeSingle(),
  ]);
  return { fattura: f as FatturaFull, atleta: (atletaRes as any).data, club: (clubRes as any).data };
}

export function build_pdf_data(
  fattura: FatturaFull,
  atleta: any | null,
  club: any | null,
): FatturaAtletaData {
  const righe: FatturaAtletaRiga[] =
    Array.isArray(fattura.righe) && fattura.righe.length > 0
      ? fattura.righe
      : [
          {
            descrizione: fattura.descrizione || "Voce",
            quantita: 1,
            prezzo_unitario: Number(fattura.importo || 0),
            importo: Number(fattura.importo || 0),
          },
        ];
  const subtotale = righe.reduce((s, r) => s + Number(r.importo || 0), 0);
  let sconto = Number(fattura.sconto_importo_chf || 0);
  if (!sconto && Number(fattura.sconto_percentuale || 0) > 0) {
    sconto = +(subtotale * Number(fattura.sconto_percentuale) / 100).toFixed(2);
  }
  const totale = Math.max(0, subtotale - sconto);
  const livello = atleta?.livello_artistica || atleta?.livello_stile || atleta?.livello_attuale || null;

  return {
    numero: fattura.numero || fattura.id.slice(0, 8),
    periodo: fattura.periodo || undefined,
    data_emissione: fattura.data_emissione || new Date().toISOString().slice(0, 10),
    data_scadenza: fattura.data_scadenza,
    righe,
    subtotale,
    sconto_importo: sconto,
    sconto_causale: fattura.sconto_causale,
    sconto_note: fattura.sconto_note,
    totale,
    note: fattura.note,
    intestatario: {
      nome: fattura.intestatario_nome,
      cognome: fattura.intestatario_cognome,
      indirizzo: fattura.intestatario_indirizzo,
      cap: fattura.intestatario_cap,
      citta: fattura.intestatario_citta,
      cantone: fattura.intestatario_cantone,
      email: fattura.intestatario_email,
    },
    atleta: {
      nome: atleta?.nome ?? "",
      cognome: atleta?.cognome ?? "",
      codice: atleta?.codice_atleta ?? null,
      livello,
    },
    club: {
      nome: club?.nome ?? "Club",
      logo_url: club?.logo_url,
      indirizzo: club?.indirizzo,
      cap: club?.cap,
      citta: club?.citta,
      cantone: club?.cantone,
      email: club?.email,
      telefono: club?.telefono,
      partita_iva: club?.partita_iva,
      numero_iva_chf: club?.numero_iva_chf,
      iban: club?.iban,
      intestatario_iban: club?.intestatario_iban,
      twint_qr_url: club?.twint_qr_url,
    },
  };
}

export async function genera_e_apri_pdf(id: string, modo: "apri" | "scarica" | "stampa" = "apri") {
  const { fattura, atleta, club } = await load_fattura_full(id);
  const data = build_pdf_data(fattura, atleta, club);
  const blob = await genera_fattura_atleta_blob(data);
  const url = URL.createObjectURL(blob);
  if (modo === "scarica") {
    const a = document.createElement("a");
    a.href = url;
    a.download = `fattura-${data.numero}.pdf`;
    a.click();
  } else {
    const w = window.open(url, "_blank");
    if (modo === "stampa" && w) {
      w.addEventListener("load", () => w.print());
    }
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function genera_pdf_blob_per_email(id: string): Promise<{ blob: Blob; numero: string; data: FatturaAtletaData }> {
  const { fattura, atleta, club } = await load_fattura_full(id);
  const data = build_pdf_data(fattura, atleta, club);
  const blob = await genera_fattura_atleta_blob(data);
  return { blob, numero: data.numero, data };
}
