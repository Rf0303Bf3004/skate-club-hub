// supabase/functions/mobile-auth-login/index.ts
// Edge Function: mobile-auth-login
// POST /functions/v1/mobile-auth-login

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

function normalize_codice(raw: string): string | null {
  if (!raw) return null;
  const compact = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact.startsWith("AT") || compact.length !== 10) return null;
  const body = compact.slice(2);
  return `AT-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

async function derive_password(codice: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}::${codice}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `Mb!${b64}`;
}

Deno.serve(async (req) => {
  console.log("[mobile-auth-login] incoming", { method: req.method });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase_url = Deno.env.get("SUPABASE_URL");
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon_key = Deno.env.get("SUPABASE_ANON_KEY");
    const salt = Deno.env.get("MOBILE_AUTH_SALT");

    const missing: string[] = [];
    if (!supabase_url) missing.push("SUPABASE_URL");
    if (!service_key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!anon_key) missing.push("SUPABASE_ANON_KEY");
    if (!salt) missing.push("MOBILE_AUTH_SALT");

    if (missing.length > 0) {
      console.error("[mobile-auth-login] missing env vars:", missing);
      return json({ error: "server_misconfigured", missing }, 500);
    }

    let body: any;
    try { body = await req.json(); }
    catch { return json({ error: "invalid_body" }, 400); }

    const codice = normalize_codice(String(body?.token ?? body?.codice ?? ""));
    if (!codice) {
      console.warn("[mobile-auth-login] codice non normalizzabile");
      return json({ error: "invalid_codice" }, 400);
    }
    console.log("[mobile-auth-login] codice normalized OK");

    const admin = createClient(supabase_url!, service_key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: atleta, error: atl_err } = await admin
      .from("atleti")
      .select("id, nome, cognome, club_id, codice_atleta")
      .eq("codice_atleta", codice)
      .maybeSingle();

    if (atl_err) {
      console.error("[mobile-auth-login] atleti query error:", JSON.stringify(atl_err));
      return json({
        error: "db_error",
        message: atl_err.message,
        code: atl_err.code,
        hint: atl_err.hint,
      }, 500);
    }
    if (!atleta) {
      console.warn("[mobile-auth-login] codice non trovato");
      return json({ error: "invalid_codice" }, 404);
    }

    const { data: club } = await admin
      .from("clubs").select("id, nome").eq("id", atleta.club_id).maybeSingle();

    const email = `atleta-${atleta.id}@portal.local`;
    const password = await derive_password(codice, salt!);
    const app_metadata = { atleta_id: atleta.id, club_id: atleta.club_id, role: "mobile_parent" };
    const user_metadata = { nome: atleta.nome, cognome: atleta.cognome };

    const auth_client = createClient(supabase_url!, anon_key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let signin = await auth_client.auth.signInWithPassword({ email, password });

    if (signin.error) {
      console.log("[mobile-auth-login] signin failed, createUser fallback");
      const { data: created, error: create_err } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata, app_metadata,
      });

      if (create_err) {
        const msg = (create_err.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          let found_id: string | null = null;
          for (let page = 1; page <= 50 && !found_id; page++) {
            const { data: pg } = await admin.auth.admin.listUsers({ page, perPage: 200 });
            const u = pg?.users?.find((x: any) => x.email === email);
            if (u) found_id = u.id;
            if (!pg || (pg.users?.length ?? 0) < 200) break;
          }
          if (found_id) {
            await admin.auth.admin.updateUserById(found_id, { password, user_metadata, app_metadata });
            signin = await auth_client.auth.signInWithPassword({ email, password });
          } else {
            return json({ error: "auth_failed", message: "user_not_findable" }, 500);
          }
        } else {
          console.error("[mobile-auth-login] createUser error:", create_err.message);
          return json({ error: "auth_failed", message: create_err.message }, 500);
        }
      } else if (created?.user) {
        signin = await auth_client.auth.signInWithPassword({ email, password });
      }
    } else if (signin.data.user?.id) {
      await admin.auth.admin.updateUserById(signin.data.user.id, { user_metadata, app_metadata });
    }

    if (signin.error || !signin.data.session) {
      console.error("[mobile-auth-login] final signin failed:", signin.error?.message);
      return json({ error: "auth_failed", message: signin.error?.message ?? "no session" }, 500);
    }

    console.log("[mobile-auth-login] login OK for atleta", atleta.id);
    return json({
      access_token: signin.data.session.access_token,
      refresh_token: signin.data.session.refresh_token,
      expires_in: signin.data.session.expires_in,
      token_type: signin.data.session.token_type,
      atleta: {
        id: atleta.id, nome: atleta.nome, cognome: atleta.cognome,
        club_id: atleta.club_id, codice_atleta: atleta.codice_atleta,
      },
      club: club ? { id: club.id, nome: club.nome } : null,
    });
  } catch (e) {
    console.error("[mobile-auth-login] unhandled:", e);
    return json({
      error: "internal_error",
      message: e instanceof Error ? e.message : String(e),
    }, 500);
  }
});
