// Edge function: registrazione pubblica di un nuovo club.
// Crea auth user (presidente) + clubs + club_identity + stagione + utenti_club.
// Trigger DB seed_new_club popola pacchetti e permessi automaticamente.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  nome_club: string;
  sigla?: string;
  cantone?: string;
  citta?: string;
  federazione?: string;
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

    // 1. Create auth user (auto-confirmed)
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email: body.email_presidente.trim().toLowerCase(),
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
    const { data: clubData, error: clubErr } = await admin
      .from("clubs")
      .insert({
        nome: body.nome_club.trim(),
        sigla: body.sigla?.trim() || null,
        cantone: body.cantone?.trim() || null,
        citta: body.citta?.trim() || null,
        email: body.email_presidente.trim().toLowerCase(),
        telefono: body.telefono?.trim() || null,
        paese: "Svizzera",
        attivo: true,
        onboarding_completato: false,
        fee_fissa_chf: 50,
        prezzo_per_atleta_chf: 1.20,
        costo_setup_chf: 0,
        setup_fatturato: false,
        mesi_fatturazione_fee: 12,
        mesi_fatturazione_atleti: 12,
      })
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
      email_contatto: body.email_presidente.trim().toLowerCase(),
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
