// Edge function: registrazione club.
// Usata sia dal flusso pubblico /registrati che dal flusso superadmin "Nuovo club".
// Crea auth user (presidente) + clubs + club_identity + stagione + utenti_club.
// Trigger DB seed_new_club popola pacchetti e permessi automaticamente.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  // Anagrafica club
  nome_club: string;
  sigla?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  cantone?: string;
  regione?: string;
  provincia?: string;
  codice_fiscale?: string;
  paese?: string;
  paese_iso?: string;
  email_club?: string;
  telefono_club?: string;
  sito_web?: string;
  numero_tessera_federale?: string;
  partita_iva?: string;
  numero_iva_chf?: string;
  iban?: string;
  intestatario_iban?: string;
  logo_url?: string;
  colore_primario?: string;
  federazione?: string;

  // Tariffazione (opzionali, defaults applicati)
  fee_fissa_chf?: number;
  prezzo_per_atleta_chf?: number;
  costo_setup_chf?: number;
  setup_fatturato?: boolean;
  mesi_fatturazione_fee?: number;
  mesi_fatturazione_atleti?: number;

  // Presidente
  email_presidente: string;
  password: string;
  nome_presidente: string;
  cognome_presidente: string;
  telefono?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;

    if (!body.nome_club?.trim() || !body.email_presidente?.trim() || !body.password || !body.nome_presidente?.trim() || !body.cognome_presidente?.trim()) {
      return new Response(JSON.stringify({ error: "Campi obbligatori mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.password.length < 8) {
      return new Response(JSON.stringify({ error: "Password minimo 8 caratteri" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const email_presidente = body.email_presidente.trim().toLowerCase();
    const email_club = (body.email_club || email_presidente).trim().toLowerCase();

    // 1. Create auth user (auto-confirmed)
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email: email_presidente,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: `${body.nome_presidente} ${body.cognome_presidente}`.trim(),
      },
    });
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: userErr?.message ?? "Errore creazione utente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = userData.user.id;

    // 2. Create club
    const club_insert: Record<string, unknown> = {
      nome: body.nome_club.trim(),
      sigla: body.sigla?.trim() || null,
      indirizzo: body.indirizzo?.trim() || null,
      cap: body.cap?.trim() || null,
      citta: body.citta?.trim() || null,
      cantone: body.cantone?.trim() || null,
      regione: body.regione?.trim() || null,
      provincia: body.provincia?.trim() || null,
      codice_fiscale: body.codice_fiscale?.trim() || null,
      paese: body.paese?.trim() || "Svizzera",
      paese_iso: (body.paese_iso?.trim() || "CH").toUpperCase(),
      email: email_club,
      telefono: (body.telefono_club || body.telefono)?.trim() || null,
      sito_web: body.sito_web?.trim() || null,
      numero_tessera_federale: body.numero_tessera_federale?.trim() || null,
      partita_iva: body.partita_iva?.trim() || null,
      numero_iva_chf: body.numero_iva_chf?.trim() || null,
      iban: body.iban?.trim() || null,
      intestatario_iban: body.intestatario_iban?.trim() || null,
      logo_url: body.logo_url?.trim() || null,
      colore_primario: body.colore_primario?.trim() || "#3B82F6",
      attivo: true,
      onboarding_completato: false,
      fee_fissa_chf: body.fee_fissa_chf ?? 50,
      prezzo_per_atleta_chf: body.prezzo_per_atleta_chf ?? 1.20,
      costo_setup_chf: body.costo_setup_chf ?? 0,
      setup_fatturato: body.setup_fatturato ?? false,
      mesi_fatturazione_fee: body.mesi_fatturazione_fee ?? 12,
      mesi_fatturazione_atleti: body.mesi_fatturazione_atleti ?? 12,
    };

    const { data: clubData, error: clubErr } = await admin
      .from("clubs")
      .insert(club_insert)
      .select("id")
      .single();
    if (clubErr || !clubData) {
      await admin.auth.admin.deleteUser(user_id);
      return new Response(JSON.stringify({ error: clubErr?.message ?? "Errore creazione club" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const club_id = clubData.id;

    // 3. club_identity
    await admin.from("club_identity").insert({
      club_id,
      citta: body.citta?.trim() || null,
      email_contatto: email_club,
      federazione: body.federazione?.trim() || "",
    });

    // 4. Stagione di default (settembre-giugno)
    const today = new Date();
    const year = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    await admin.from("stagioni").insert({
      club_id,
      nome: `${year}/${year + 1}`,
      tipo: "regolare",
      data_inizio: `${year}-09-01`,
      data_fine: `${year + 1}-06-30`,
      attiva: true,
      stato: "in_corso",
    });

    // 5. utenti_club presidente
    const { error: ucErr } = await admin.from("utenti_club").insert({
      user_id,
      club_id,
      ruolo: "presidente",
      nome: body.nome_presidente.trim(),
      cognome: body.cognome_presidente.trim(),
      telefono: body.telefono?.trim() || null,
      attivo: true,
    });
    if (ucErr) {
      console.error("utenti_club error", ucErr);
    }

    return new Response(JSON.stringify({ ok: true, club_id, user_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
