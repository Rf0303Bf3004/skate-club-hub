// Edge Function: genera-fattura-pdf
// Costruisce il PDF della fattura di un atleta con lo STESSO documento usato dal
// browser (supabase/functions/_shared/fattura-documento.tsx).
// Esiste perché di notte non c'è nessun browser aperto: senza questa funzione
// nessun automatismo può produrre o inviare una fattura.
//
// Chi può chiamarla:
//  - uno staff del club (superadmin/admin/presidente/segreteria) con JWT vero
//  - l'account portale della famiglia, solo per le fatture del proprio atleta
//  - le altre funzioni server, presentando la chiave di servizio come Bearer
//
// Congelamento: una fattura già inviata NON viene mai rigenerata in silenzio.
// Il PDF archiviato è il documento che la famiglia ha ricevuto.

import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { genera_fattura_atleta_blob } from "../_shared/fattura-documento.tsx";
import type { FatturaAtletaData, FatturaAtletaRiga } from "../_shared/fattura-documento.tsx";

const ORIGINI_AMMESSE = [
  "https://app.icearena.ch",
  "https://ice-arena-manager.lovable.app",
  "https://id-preview--f73d3b52-ac71-4df5-835a-6a9b98a06a92.lovable.app",
  "http://localhost:8080",
];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const ammessa = ORIGINI_AMMESSE.includes(origin)
    ? origin
    : /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin)
      ? origin
      : ORIGINI_AMMESSE[0];
  return {
    "Access-Control-Allow-Origin": ammessa,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const RUOLI_FATTURAZIONE = ["superadmin", "admin", "presidente", "segreteria"];
const BUCKET_FATTURE = "fatture-atleti";

/** Stessa matematica di build_pdf_data nel portale: se cambia una, va cambiata l'altra. */
function build_pdf_data(fattura: any, atleta: any, club: any, qr: any): FatturaAtletaData {
  const righe: FatturaAtletaRiga[] =
    Array.isArray(fattura.righe) && fattura.righe.length > 0
      ? fattura.righe
      : [{
          descrizione: fattura.descrizione || "Voce",
          quantita: 1,
          prezzo_unitario: Number(fattura.importo || 0),
          importo: Number(fattura.importo || 0),
        }];
  const subtotale = righe.reduce((s, r) => s + Number(r.importo || 0), 0);
  let sconto = Number(fattura.sconto_importo_chf || 0);
  if (!sconto && Number(fattura.sconto_percentuale || 0) > 0) {
    sconto = +(subtotale * Number(fattura.sconto_percentuale) / 100).toFixed(2);
  }
  const totale = subtotale < 0 ? subtotale - sconto : Math.max(0, subtotale - sconto);
  const livello = atleta?.livello_artistica || atleta?.livello_stile || atleta?.livello_attuale || null;

  return {
    numero: fattura.numero || String(fattura.id).slice(0, 8),
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
    qr,
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
    club,
  };
}

/**
 * Il logo viene scaricato qui e incorporato come data URL.
 * Se lo scaricasse react-pdf da solo, un errore di rete toglierebbe la carta
 * intestata senza dire niente: una fattura non può cambiare aspetto in silenzio.
 */
async function logo_incorporato(url: string | null | undefined, avvisi: string[]): Promise<string | null> {
  const pulito = (url ?? "").split("?")[0];
  if (!pulito) return null;
  try {
    const risposta = await fetch(pulito, { signal: AbortSignal.timeout(8000) });
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
    const tipo = risposta.headers.get("content-type") || "image/png";
    const byte = new Uint8Array(await risposta.arrayBuffer());
    let binario = "";
    for (let i = 0; i < byte.length; i += 1) binario += String.fromCharCode(byte[i]);
    return `data:${tipo};base64,${btoa(binario)}`;
  } catch (e) {
    avvisi.push(`Logo del club non scaricato (${(e as Error).message}): la fattura esce senza carta intestata.`);
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = cors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon_key = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth_header = req.headers.get("Authorization") ?? "";
    const token = auth_header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(url, service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const fattura_id = String((body as any)?.fattura_id ?? "").trim();
    const congela = (body as any)?.congela === true;
    const rigenera = (body as any)?.rigenera === true;
    if (!fattura_id) return json({ error: "missing_params" }, 400);

    const { data: f, error: f_err } = await supabase
      .from("fatture")
      .select("*")
      .eq("id", fattura_id)
      .maybeSingle();
    if (f_err) return json({ error: "lookup_failed" }, 500);
    if (!f) return json({ error: "forbidden" }, 403);

    // --- autorizzazione ---
    // Due forme di chiamata interna:
    //  - un'altra funzione server, che presenta la chiave di servizio come Bearer
    //  - il database, che presenta un gettone usa e getta valido 5 minuti
    // Il gettone evita di tenere la chiave di servizio dentro i comandi del cron,
    // dove la vedrebbe chiunque abbia accesso al database.
    let interna = token === service_key;

    const gettone = String((body as any)?.token_interno ?? "").trim();
    if (!interna && gettone) {
      const { data: valido, error: g_err } = await supabase.rpc("consuma_token_interno", {
        p_token: gettone,
        p_scopo: "genera-fattura-pdf",
      });
      if (g_err) return json({ error: "gettone_non_verificabile", dettaglio: g_err.message }, 500);
      if (valido !== true) return json({ error: "gettone_non_valido" }, 401);
      interna = true;
    }

    if (!interna) {
      const user_client = createClient(url, anon_key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error: u_err } = await user_client.auth.getUser();
      if (u_err || !user) return json({ error: "unauthorized" }, 401);

      const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
      const atleta_del_portale = typeof meta.atleta_id === "string" ? meta.atleta_id : null;

      let autorizzato = false;
      if (atleta_del_portale && f.atleta_id && atleta_del_portale === f.atleta_id) {
        autorizzato = true;
      } else {
        const { data: caller, error: c_err } = await supabase
          .from("utenti_club")
          .select("ruolo, club_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (c_err) return json({ error: "lookup_failed" }, 500);
        if (
          caller &&
          RUOLI_FATTURAZIONE.includes(String(caller.ruolo)) &&
          (caller.ruolo === "superadmin" || caller.club_id === f.club_id)
        ) {
          autorizzato = true;
        }
      }
      if (!autorizzato) return json({ error: "forbidden" }, 403);
    }

    const avvisi: string[] = [];

    // --- il documento già congelato non si tocca ---
    const percorso = `${f.club_id}/${fattura_id}.pdf`;
    const gia_congelato = typeof f.pdf_url === "string" && f.pdf_url.trim().length > 0;
    if (congela && gia_congelato && !rigenera) {
      return json({
        ok: true,
        gia_presente: true,
        percorso: f.pdf_url,
        avvisi,
      });
    }

    // --- dati ---
    const ragione_sociale_id = (f as any).ragione_sociale_id ?? null;
    const [atletaRes, clubRes, setupRes, ragioneRes] = await Promise.all([
      f.atleta_id
        ? supabase.from("atleti")
            .select("nome, cognome, codice_atleta, livello_attuale, livello_artistica, livello_stile")
            .eq("id", f.atleta_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("clubs")
        .select("nome, logo_url, indirizzo, cap, citta, cantone, email, telefono, partita_iva, numero_iva_chf")
        .eq("id", f.club_id).maybeSingle(),
      supabase.from("setup_club")
        .select("iban, intestatario_conto, twint_paylink, fattura_mostra_logo, fattura_colore_accento, fattura_mostra_iban, fattura_note_legali, fattura_footer_testo")
        .eq("club_id", f.club_id).maybeSingle(),
      ragione_sociale_id
        ? supabase.from("ragioni_sociali")
            .select("nome, indirizzo, cap, citta, iban, intestatario_iban, partita_iva, numero_iva, logo_url, colore_primario")
            .eq("id", ragione_sociale_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    const setup = (setupRes as any).data;
    const rs = (ragioneRes as any).data;
    const base = (clubRes as any).data;
    // Il beneficiario stampato deve coincidere con quello codificato nel QR.
    const club: any = {
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

    if (club.fattura_mostra_logo && club.logo_url) {
      club.logo_url = await logo_incorporato(club.logo_url, avvisi);
      if (!club.logo_url) club.fattura_mostra_logo = false;
    }

    // --- polizza QR (il payload lo calcola il database) ---
    let qr: any = null;
    if (f.tipo_documento !== "nota_credito") {
      const { data: q, error: q_err } = await supabase.rpc("swiss_qr_payload", { p_fattura: fattura_id });
      const r = Array.isArray(q) ? q[0] : q;
      if (q_err) {
        qr = { data_url: null, payload: null, tipo_riferimento: null, riferimento: null, errori: q_err.message };
        avvisi.push(`Polizza QR non calcolata: ${q_err.message}`);
      } else if (!r) {
        qr = { data_url: null, payload: null, tipo_riferimento: null, riferimento: null, errori: "Polizza non disponibile" };
        avvisi.push("Polizza QR non disponibile.");
      } else if (r.errori) {
        qr = { data_url: null, payload: null, tipo_riferimento: r.tipo_riferimento ?? null, riferimento: r.riferimento ?? null, errori: r.errori };
        avvisi.push(`Polizza QR incompleta: ${r.errori}`);
      } else {
        const data_url = await QRCode.toDataURL(String(r.payload ?? ""), { width: 900, margin: 0 });
        qr = {
          data_url,
          payload: r.payload ?? null,
          tipo_riferimento: r.tipo_riferimento ?? null,
          riferimento: r.riferimento ?? null,
          errori: null,
        };
      }
    }

    const dati = build_pdf_data(f, (atletaRes as any).data, club, qr);
    const blob = await genera_fattura_atleta_blob(dati);
    const byte = new Uint8Array(await blob.arrayBuffer());

    let percorso_salvato: string | null = null;
    if (congela) {
      const up = await supabase.storage.from(BUCKET_FATTURE).upload(percorso, byte, {
        upsert: true,
        contentType: "application/pdf",
      });
      if (up.error) return json({ error: "upload_fallito", dettaglio: up.error.message }, 500);
      const { data: agg, error: e_agg } = await supabase
        .from("fatture").update({ pdf_url: percorso }).eq("id", fattura_id).select("id");
      if (e_agg) return json({ error: "aggiornamento_fallito", dettaglio: e_agg.message }, 500);
      if (!agg || agg.length === 0) return json({ error: "aggiornamento_a_vuoto" }, 500);
      percorso_salvato = percorso;
    }

    let b64 = "";
    const blocco = 0x8000;
    for (let i = 0; i < byte.length; i += blocco) {
      b64 += String.fromCharCode(...byte.subarray(i, i + blocco));
    }

    return json({
      ok: true,
      numero: dati.numero,
      byte: byte.length,
      pdf_base64: btoa(b64),
      percorso: percorso_salvato,
      congelato: percorso_salvato !== null,
      avvisi,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
