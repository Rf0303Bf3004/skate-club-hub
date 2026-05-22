// Edge function: invita un membro staff a un club esistente.
// Crea auth user con password temporanea, riga utenti_club e (se istruttore) riga istruttori.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  club_id: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: "istruttore" | "segreteria" | "dt" | "aiuto_monitore";
}

function genPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + "!2";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body.club_id || !body.email || !body.nome || !body.cognome || !body.ruolo) {
      return new Response(JSON.stringify({ error: "Campi obbligatori mancanti" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin-like or presidente of this club
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: caller } = await admin
      .from("utenti_club")
      .select("ruolo")
      .eq("user_id", claimsData.claims.sub)
      .eq("club_id", body.club_id)
      .maybeSingle();
    if (!caller || !["admin", "superadmin", "presidente"].includes(caller.ruolo)) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = body.email.trim().toLowerCase();
    const password = genPassword();

    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${body.nome} ${body.cognome}` },
    });
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: userErr?.message ?? "Errore creazione utente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("utenti_club").insert({
      user_id: userData.user.id,
      club_id: body.club_id,
      ruolo: body.ruolo,
      nome: body.nome,
      cognome: body.cognome,
      attivo: true,
    });

    if (body.ruolo === "istruttore") {
      await admin.from("istruttori").insert({
        club_id: body.club_id,
        nome: body.nome,
        cognome: body.cognome,
        email,
        livello_istruttore: "istruttore",
        attivo: true,
      });
    }

    // TODO: send actual invite email with password reset link.
    // For now, return the temporary password so admin can communicate it.
    return new Response(JSON.stringify({ ok: true, temp_password: password }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
