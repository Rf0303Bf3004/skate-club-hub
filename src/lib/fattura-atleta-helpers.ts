import { supabase } from "@/lib/supabase";
import type { FatturaAtletaData, FatturaAtletaRiga, FatturaQrData } from "@/lib/fattura-atleta-pdf";
import { genera_fattura_atleta_blob } from "@/lib/fattura-atleta-pdf";
import { genera_qr_data_url } from "@/lib/qr";
import { segnala_a_vuoto } from "@/lib/errori";

const BUCKET_FATTURE = "fatture-atleti";

export type FatturaFull = {
  id: string;
  club_id: string;
  ragione_sociale_id: string | null;
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
  tipo_documento: string | null;
  documento_origine_id: string | null;
  motivo_annullamento: string | null;
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

/** Polizza QR svizzera: payload calcolato dal database + immagine QR generata in locale. */
export async function carica_qr_fattura(fattura_id: string): Promise<FatturaQrData> {
  const { data, error } = await supabase.rpc("swiss_qr_payload", { p_fattura: fattura_id });
  if (error) return { data_url: null, payload: null, tipo_riferimento: null, riferimento: null, errori: error.message };
  const r = (Array.isArray(data) ? data[0] : data) as any;
  if (!r) return { data_url: null, payload: null, tipo_riferimento: null, riferimento: null, errori: "Polizza non disponibile" };
  if (r.errori) {
    return { data_url: null, payload: null, tipo_riferimento: r.tipo_riferimento ?? null, riferimento: r.riferimento ?? null, errori: r.errori };
  }
  const data_url = await genera_qr_data_url(String(r.payload ?? ""), 900);
  return {
    data_url: data_url || null,
    payload: r.payload ?? null,
    tipo_riferimento: r.tipo_riferimento ?? null,
    riferimento: r.riferimento ?? null,
    errori: data_url ? null : "Impossibile generare il codice QR",
  };
}

export async function load_fattura_full(id: string): Promise<{
  fattura: FatturaFull;
  atleta: any | null;
  club: any | null;
}> {
  const { data: f, error } = await supabase.from("fatture").select("*").eq("id", id).maybeSingle();
  if (error || !f) throw error || new Error("Fattura non trovata");
  const ragione_sociale_id = (f as any).ragione_sociale_id ?? null;
  const [atletaRes, clubRes, setupRes, ragioneRes] = await Promise.all([
    f.atleta_id
      ? supabase
          .from("atleti")
          .select("nome, cognome, codice_atleta, livello_attuale, livello_artistica, livello_stile")
          .eq("id", f.atleta_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("clubs")
      .select("nome, logo_url, indirizzo, cap, citta, cantone, email, telefono, partita_iva, numero_iva_chf")
      .eq("id", f.club_id)
      .maybeSingle(),
    supabase
      .from("setup_club")
      .select("iban, intestatario_conto, twint_paylink, fattura_mostra_logo, fattura_colore_accento, fattura_mostra_iban, fattura_note_legali, fattura_footer_testo")
      .eq("club_id", f.club_id)
      .maybeSingle(),
    ragione_sociale_id
      ? supabase
          .from("ragioni_sociali")
          .select("nome, indirizzo, cap, citta, iban, intestatario_iban, partita_iva, numero_iva, logo_url, colore_primario")
          .eq("id", ragione_sociale_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const setup = (setupRes as any).data;
  const rs = (ragioneRes as any).data;
  const base = (clubRes as any).data;
  // Il beneficiario stampato deve coincidere con quello codificato nel QR:
  // se la fattura è legata a una ragione sociale, quella prevale sul club.
  const club = {
    ...base,
    nome: rs?.nome ?? base?.nome,
    indirizzo: rs?.indirizzo ?? base?.indirizzo,
    cap: rs?.cap ?? base?.cap,
    citta: rs?.citta ?? base?.citta,
    cantone: rs ? null : base?.cantone,
    partita_iva: rs?.partita_iva ?? base?.partita_iva,
    numero_iva_chf: rs?.numero_iva ?? base?.numero_iva_chf,
    logo_url: rs?.logo_url ?? base?.logo_url,
    iban: rs ? rs.iban ?? null : setup?.iban ?? null,
    intestatario_iban: rs ? rs.intestatario_iban ?? rs.nome ?? null : setup?.intestatario_conto ?? null,
    twint_qr_url: setup?.twint_paylink ?? null,
    fattura_mostra_logo: setup?.fattura_mostra_logo ?? false,
    fattura_colore_accento: rs?.colore_primario ?? setup?.fattura_colore_accento ?? null,
    fattura_mostra_iban: setup?.fattura_mostra_iban ?? true,
    fattura_note_legali: setup?.fattura_note_legali ?? null,
    fattura_footer_testo: setup?.fattura_footer_testo ?? null,
  };
  return { fattura: f as unknown as FatturaFull, atleta: (atletaRes as any).data, club };
}

export function build_pdf_data(
  fattura: FatturaFull,
  atleta: any | null,
  club: any | null,
  qr?: FatturaQrData | null,
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
  const totale = subtotale < 0 ? subtotale - sconto : Math.max(0, subtotale - sconto);
  const livello = atleta?.livello_artistica || atleta?.livello_stile || atleta?.livello_attuale || null;

  return {
    numero: fattura.numero || fattura.id.slice(0, 8),
    periodo: fattura.periodo || undefined,
    data_emissione: fattura.data_emissione || new Date().toISOString().slice(0, 10),
    data_scadenza: fattura.data_scadenza,
    tipo_documento: fattura.tipo_documento ?? null,
    righe,
    subtotale,
    sconto_importo: sconto,
    sconto_causale: fattura.sconto_causale,
    sconto_note: fattura.sconto_note,
    totale,
    note: fattura.note,
    qr: qr ?? null,
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
      fattura_mostra_logo: club?.fattura_mostra_logo ?? false,
      fattura_colore_accento: club?.fattura_colore_accento ?? null,
      fattura_mostra_iban: club?.fattura_mostra_iban ?? true,
      fattura_note_legali: club?.fattura_note_legali ?? null,
      fattura_footer_testo: club?.fattura_footer_testo ?? null,
    },
  };
}

/** Carica i dati completi del PDF (fattura + polizza QR). */
export async function carica_dati_pdf(id: string): Promise<FatturaAtletaData> {
  const r = await load_fattura_full(id);
  const qr = r.fattura.tipo_documento === "nota_credito" ? null : await carica_qr_fattura(id);
  return build_pdf_data(r.fattura, r.atleta, r.club, qr);
}

/** URL temporaneo del PDF congelato in archivio, se presente. */
export async function url_pdf_salvato(pdf_url: string | null | undefined): Promise<string | null> {
  if (!pdf_url) return null;
  if (pdf_url.startsWith("http")) return pdf_url;
  const { data } = await supabase.storage.from(BUCKET_FATTURE).createSignedUrl(pdf_url, 3600);
  return data?.signedUrl ?? null;
}

/** Le fatture non in bozza servono il PDF congelato, mai rigenerato. */
export async function url_pdf_congelato(id: string): Promise<string | null> {
  const { data } = await supabase.from("fatture").select("stato, pdf_url").eq("id", id).maybeSingle();
  if (!data || (data as any).stato === "bozza") return null;
  return await url_pdf_salvato((data as any).pdf_url);
}

function estrai_percorso_pdf_storage(pdf_url: string): string {
  if (!pdf_url.startsWith("http")) {
    const percorso = pdf_url.replace(/^\/+/, "");
    return percorso.startsWith(`${BUCKET_FATTURE}/`)
      ? percorso.slice(BUCKET_FATTURE.length + 1)
      : percorso;
  }

  const url = new URL(pdf_url);
  const marker = `/${BUCKET_FATTURE}/`;
  const indice = url.pathname.indexOf(marker);
  if (indice < 0) throw new Error("Percorso del PDF archiviato non valido");
  return decodeURIComponent(url.pathname.slice(indice + marker.length));
}

/**
 * Prepara sempre un Blob locale e il relativo object URL. Anche i documenti
 * congelati vengono scaricati dallo storage, così anteprima, download e stampa
 * non dipendono dal visualizzatore PDF o dalle regole cross-origin del browser.
 */
export async function prepara_pdf_fattura(
  id: string,
  opzioni?: { preferisci_locale?: boolean },
): Promise<{ blob: Blob; url: string; nome_file: string; congelato: boolean }> {
  // Il portale famiglie non ha accesso all'archivio storage del club:
  // in quel caso il PDF viene sempre rigenerato lato client.
  const solo_locale = opzioni?.preferisci_locale === true;
  const { data: fattura, error } = await supabase
    .from("fatture")
    .select("stato, pdf_url, numero")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  if (!solo_locale && fattura && (fattura as any).stato !== "bozza" && (fattura as any).pdf_url) {
    const percorso = estrai_percorso_pdf_storage(String((fattura as any).pdf_url));
    const { data: blob_archiviato, error: download_error } = await supabase.storage
      .from(BUCKET_FATTURE)
      .download(percorso);
    if (download_error || !blob_archiviato) {
      throw download_error ?? new Error("PDF archiviato non disponibile");
    }
    const blob = blob_archiviato.type === "application/pdf"
      ? blob_archiviato
      : new Blob([blob_archiviato], { type: "application/pdf" });
    return {
      blob,
      url: URL.createObjectURL(blob),
      nome_file: `fattura-${(fattura as any).numero || id.slice(0, 8)}.pdf`,
      congelato: true,
    };
  }

  const data = await carica_dati_pdf(id);
  const blob = await genera_fattura_atleta_blob(data);
  return { blob, url: URL.createObjectURL(blob), nome_file: `fattura-${data.numero}.pdf`, congelato: false };
}


export async function genera_pdf_blob_per_email(id: string): Promise<{ blob: Blob; numero: string; data: FatturaAtletaData }> {
  const data = await carica_dati_pdf(id);
  const blob = await genera_fattura_atleta_blob(data);
  return { blob, numero: data.numero, data };
}

/**
 * Invio della fattura: congela il PDF in archivio (pdf_url), invia l'email e
 * porta il documento in stato "inviata".
 */
export async function invia_fattura_email(fattura_id: string, destinatario: string) {
  const email = (destinatario ?? "").trim();
  // Verifica prima di congelare il PDF: senza destinatario l'invio fallisce
  // e lascerebbe la fattura con un pdf_url già scritto.
  if (!email) throw new Error("Destinatario email mancante");

  const { fattura, atleta, club } = await load_fattura_full(fattura_id);
  const qr = fattura.tipo_documento === "nota_credito" ? null : await carica_qr_fattura(fattura_id);
  const data = build_pdf_data(fattura, atleta, club, qr);
  const blob = await genera_fattura_atleta_blob(data);

  const path = `${fattura.club_id}/${fattura_id}.pdf`;
  const up = await supabase.storage.from(BUCKET_FATTURE).upload(path, blob, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (up.error) throw up.error;

  const { data: r_pdf, error: e_pdf } = await supabase
    .from("fatture")
    .update({ pdf_url: path })
    .eq("id", fattura_id)
    .select("id");
  if (e_pdf) throw e_pdf;
  if (!r_pdf || r_pdf.length === 0) {
    await segnala_a_vuoto("fattura-atleta-helpers", "Salvataggio PDF fattura", { fattura_id });
    throw new Error("La fattura non è stata aggiornata: nessuna riga modificata (permessi o id inesistente).");
  }

  // Link firmato di lunga durata (30 giorni) da mettere nell'email.
  const { data: signed } = await supabase.storage.from(BUCKET_FATTURE).createSignedUrl(path, 60 * 60 * 24 * 30);

  const { error: e_fn } = await supabase.functions.invoke("send-fattura-email-atleta", {
    body: { fattura_id, destinatario: email, pdf_url: signed?.signedUrl ?? null },
  });
  if (e_fn) throw e_fn;


  const { data: r_stato, error: e_stato } = await supabase
    .from("fatture")
    .update({ stato: "inviata", email_inviata_at: new Date().toISOString() })
    .eq("id", fattura_id)
    .select("id");
  if (e_stato) throw e_stato;
  if (!r_stato || r_stato.length === 0) {
    await segnala_a_vuoto("fattura-atleta-helpers", "Passaggio fattura in stato inviata", { fattura_id });
    throw new Error("Email inviata ma lo stato della fattura non è stato aggiornato.");
  }

  return path;
}
