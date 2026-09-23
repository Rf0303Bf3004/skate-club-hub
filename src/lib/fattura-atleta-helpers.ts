import { format_local_iso } from "@/lib/planning-occorrenze";
import { supabase } from "@/lib/supabase";
import type { FatturaAtletaData, FatturaAtletaRiga, FatturaQrData } from "@/lib/fattura-atleta-pdf";
import { genera_qr_data_url } from "@/lib/qr";

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
          // Vista di famiglia: al genitore che è entrato mostra il SUO codice di accesso,
          // mai quello dell'altro genitore. Per lo staff restituisce i dati completi.
          .from("atleti_famiglia")
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
    data_emissione: fattura.data_emissione || format_local_iso(new Date()),
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

/** Il server manda il PDF in base64: qui torna a essere un file. */
function blob_da_base64(b64: string): Blob {
  const grezzo = atob(b64);
  const byte = new Uint8Array(grezzo.length);
  for (let i = 0; i < grezzo.length; i += 1) byte[i] = grezzo.charCodeAt(i);
  return new Blob([byte], { type: "application/pdf" });
}

/**
 * supabase-js non porta il corpo della risposta quando lo stato non è 2xx:
 * senza questo, un errore spiegato bene dal server arriva all'utente come
 * "Edge Function returned a non-2xx status code".
 */
async function motivo_errore(errore: any, predefinito: string): Promise<string> {
  try {
    const corpo = await errore?.context?.json?.();
    const testo = corpo?.messaggio || corpo?.dettaglio || corpo?.error;
    if (testo) return String(testo);
  } catch {
    /* il corpo non era leggibile: resta il messaggio predefinito */
  }
  return errore?.message || predefinito;
}

/**
 * Il PDF lo fa il server, sempre, per tutti.
 * Una fattura già uscita dalla bozza torna indietro congelata, cioè esattamente
 * il documento che la famiglia ha ricevuto, non una ricostruzione dai dati di adesso.
 */
export async function pdf_dal_server(
  fattura_id: string,
  opzioni?: { congela?: boolean; rigenera?: boolean },
): Promise<{ blob: Blob; numero: string; congelato: boolean; percorso: string | null; avvisi: string[] }> {
  const { data, error } = await supabase.functions.invoke("genera-fattura-pdf", {
    body: {
      fattura_id,
      congela: opzioni?.congela === true,
      rigenera: opzioni?.rigenera === true,
    },
  });
  if (error) throw new Error(await motivo_errore(error, "Il PDF della fattura non è stato prodotto."));
  const r = data as any;
  if (!r?.ok || !r?.pdf_base64) {
    throw new Error(r?.dettaglio || r?.error || "Il PDF della fattura non è stato prodotto.");
  }
  return {
    blob: blob_da_base64(String(r.pdf_base64)),
    numero: String(r.numero ?? fattura_id.slice(0, 8)),
    congelato: r.congelato === true,
    percorso: r.percorso ?? null,
    avvisi: Array.isArray(r.avvisi) ? r.avvisi : [],
  };
}

/**
 * Anteprima, scarica e stampa passano tutte da qui, e tutte dal server.
 * Prima il browser rigenerava il PDF per conto suo e il portale famiglie ne
 * riceveva una versione ricostruita: due strade diverse per lo stesso documento.
 */
export async function prepara_pdf_fattura(
  id: string,
  opzioni?: { rigenera?: boolean },
): Promise<{ blob: Blob; url: string; nome_file: string; congelato: boolean; avvisi: string[] }> {
  const r = await pdf_dal_server(id, { rigenera: opzioni?.rigenera === true });
  return {
    blob: r.blob,
    url: URL.createObjectURL(r.blob),
    nome_file: `fattura-${r.numero}.pdf`,
    congelato: r.congelato,
    avvisi: r.avvisi,
  };
}

/**
 * Invio della fattura. Il congelamento del PDF in archivio non lo fa più il
 * browser: lo garantisce la funzione di invio, che ha i permessi per farlo anche
 * quando a premere è una famiglia o, di notte, nessuno.
 */
export async function invia_fattura_email(fattura_id: string, destinatario: string) {
  const email = (destinatario ?? "").trim();
  if (!email) throw new Error("Destinatario email mancante");

  const { data, error } = await supabase.functions.invoke("send-fattura-email-atleta", {
    body: { fattura_id, destinatario: email },
  });
  if (error) throw new Error(await motivo_errore(error, "La fattura non è stata inviata."));
  const r = data as any;
  if (r?.error) {
    throw new Error(r?.messaggio || r?.dettaglio || String(r.error));
  }
  return r?.ok === true;
}
