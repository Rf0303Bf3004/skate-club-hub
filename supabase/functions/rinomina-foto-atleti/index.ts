// Edge Function: rinomina-foto-atleti
// Manutenzione riservata al superadmin: rinomina i file del bucket `foto-atleti`
// da `<club_id>/<timestamp>.<ext>` (enumerabile) a `<club_id>/<uuid>.<ext>`.
// Aggiorna sia atleti.foto_path sia atleti.foto_url (l'app mobile legge ancora foto_url).
// Ripetibile senza danni: i percorsi già casuali vengono saltati.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BUCKET = "foto-atleti";
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth_header = req.headers.get("Authorization") ?? "";
    if (!auth_header.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const user_client = createClient(url, anon, { global: { headers: { Authorization: auth_header } } });
    const { data: { user } } = await user_client.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: uc } = await admin.from("utenti_club").select("ruolo").eq("user_id", user.id).maybeSingle();
    if (!uc || uc.ruolo !== "superadmin") return json({ error: "forbidden" }, 403);

    const { data: atleti, error: sel_err } = await admin
      .from("atleti")
      .select("id, club_id, foto_path")
      .not("foto_path", "is", null);
    if (sel_err) {
      console.error("[rinomina-foto-atleti] sel_err", sel_err);
      return json({ error: "db_error", messaggio: sel_err.message }, 500);
    }

    let rinominate = 0;
    let saltate = 0;
    const errori: { atleta_id: string; messaggio: string }[] = [];

    for (const a of atleti ?? []) {
      const vecchio = String(a.foto_path ?? "");
      if (!vecchio) continue;

      const nome_file = vecchio.split("/").pop() ?? "";
      const punto = nome_file.lastIndexOf(".");
      const base = punto > 0 ? nome_file.slice(0, punto) : nome_file;
      const ext = punto > 0 ? nome_file.slice(punto + 1) : "jpg";

      // Già rinominato in un giro precedente: non toccarlo
      if (RE_UUID.test(base)) {
        saltate++;
        continue;
      }

      const nuovo = `${a.club_id}/${crypto.randomUUID()}.${ext}`;
      const { error: mv_err } = await admin.storage.from(BUCKET).move(vecchio, nuovo);
      if (mv_err) {
        console.error("[rinomina-foto-atleti] move", vecchio, mv_err);
        errori.push({ atleta_id: a.id, messaggio: mv_err.message });
        continue; // NON aggiornare il DB se lo spostamento fallisce
      }

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(nuovo);
      const { error: upd_err } = await admin
        .from("atleti")
        .update({ foto_path: nuovo, foto_url: pub.publicUrl })
        .eq("id", a.id);
      if (upd_err) {
        console.error("[rinomina-foto-atleti] upd_err", a.id, upd_err);
        // Ripristina il file al percorso originale per restare coerenti
        await admin.storage.from(BUCKET).move(nuovo, vecchio);
        errori.push({ atleta_id: a.id, messaggio: upd_err.message });
        continue;
      }

      rinominate++;
    }

    return json({ ok: true, rinominate, saltate, fallite: errori.length, errori });
  } catch (e) {
    console.error("[rinomina-foto-atleti] fatal", e);
    return json({ error: "server_error", messaggio: String((e as Error)?.message ?? e) }, 500);
  }
});
