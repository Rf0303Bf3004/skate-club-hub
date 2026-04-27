// Edge Function: mobile-auth-login
// POST /functions/v1/mobile-auth-login
// Body: { token: string }
// Scambia il QR token (inviti_genitori.token) con una sessione Supabase autenticata.
// Strategia: password deterministica derivata da hash(qr_token + MOBILE_AUTH_SALT).
// L'utente viene creato se non esiste (idempotente), poi signInWithPassword.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean_token(raw: string): string {
  return (raw || "").toUpperCase().replace(/[-\s]/g, "").trim();
}

async function derive_password(token: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}::${token}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  // base64 url-safe — abbastanza entropia per password Supabase
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  // prefisso per garantire mix di caratteri
  return `Mb!${b64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const supabase_url = Deno.env.get("SUPABASE_URL")!;
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon_key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const salt = Deno.env.get("MOBILE_AUTH_SALT");
    if (!salt) {
      console.error("[mobile-auth-login] missing MOBILE_AUTH_SALT");
      return json({ error: "server_misconfigured" }, 500);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const token = clean_token(body?.token ?? "");
    if (!token || token.length < 6) {
      return json({ error: "invalid_token" }, 400);
    }

    const admin = createClient(supabase_url, service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Trova invito (case-insensitive sul token)
    const { data: invito, error: inv_err } = await admin
      .from("inviti_genitori")
      .select("id, atleta_id, club_id, email, token")
      .ilike("token", token)
      .maybeSingle();

    if (inv_err) {
      console.error("[mobile-auth-login] invito query error", inv_err);
      return json({ error: "db_error" }, 500);
    }
    if (!invito) {
      console.warn("[mobile-auth-login] token non trovato", { token_len: token.length });
      return json({ error: "invalid_token" }, 404);
    }

    // 2. Carica atleta e club
    const { data: atleta } = await admin
      .from("atleti")
      .select("id, nome, cognome, club_id")
      .eq("id", invito.atleta_id)
      .maybeSingle();

    if (!atleta) {
      return json({ error: "atleta_not_found" }, 404);
    }

    const { data: club } = await admin
      .from("clubs")
      .select("id, nome")
      .eq("id", atleta.club_id)
      .maybeSingle();

    // 3. Email deterministica + password derivata
    const email = `atleta-${atleta.id}@portal.local`;
    const password = await derive_password(token, salt);

    const user_metadata = {
      atleta_id: atleta.id,
      club_id: atleta.club_id,
      role: "mobile_parent",
      nome: atleta.nome,
      cognome: atleta.cognome,
    };

    // 4. Crea o aggiorna utente (idempotente)
    // Usiamo listUsers con filtro email per trovare l'esistente
    const { data: existing_list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // listUsers non supporta filter email diretto in tutte le versioni: usiamo signInWithPassword come fast-path
    const auth_client = createClient(supabase_url, anon_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let signin = await auth_client.auth.signInWithPassword({ email, password });

    if (signin.error) {
      // Probabile: utente non esiste → crealo
      const { data: created, error: create_err } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata,
        });

      if (create_err) {
        // Se esiste ma password sbagliata (es. salt cambiato): aggiorna password
        const msg = (create_err.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          // Trova user via getUserById non possibile senza id: usa listUsers paginato
          let found_id: string | null = null;
          for (let page = 1; page <= 50 && !found_id; page++) {
            const { data: pg } = await admin.auth.admin.listUsers({ page, perPage: 200 });
            const u = pg?.users?.find((x: any) => x.email === email);
            if (u) found_id = u.id;
            if (!pg || (pg.users?.length ?? 0) < 200) break;
          }
          if (found_id) {
            await admin.auth.admin.updateUserById(found_id, {
              password,
              user_metadata,
            });
            signin = await auth_client.auth.signInWithPassword({ email, password });
          }
        } else {
          console.error("[mobile-auth-login] createUser error", create_err);
          return json({ error: "auth_create_failed", detail: create_err.message }, 500);
        }
      } else if (created?.user) {
        signin = await auth_client.auth.signInWithPassword({ email, password });
      }
    } else {
      // Aggiorna user_metadata se è cambiato (nome/cognome atleta)
      if (signin.data.user?.id) {
        await admin.auth.admin.updateUserById(signin.data.user.id, { user_metadata });
      }
    }

    if (signin.error || !signin.data.session) {
      console.error("[mobile-auth-login] signin failed", signin.error);
      return json({ error: "auth_signin_failed", detail: signin.error?.message }, 500);
    }

    return json({
      access_token: signin.data.session.access_token,
      refresh_token: signin.data.session.refresh_token,
      expires_in: signin.data.session.expires_in,
      token_type: signin.data.session.token_type,
      atleta: {
        id: atleta.id,
        nome: atleta.nome,
        cognome: atleta.cognome,
        club_id: atleta.club_id,
      },
      club: club ? { id: club.id, nome: club.nome } : null,
    });
  } catch (e) {
    console.error("[mobile-auth-login] unhandled", e);
    return json({ error: "internal_error", detail: String(e) }, 500);
  }
});
