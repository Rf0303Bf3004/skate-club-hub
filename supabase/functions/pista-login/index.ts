// supabase/functions/pista-login/index.ts
// Edge Function: pista-login
// POST /functions/v1/pista-login
//
// Accesso del tablet di bordo pista con il codice del club (clubs.codice_pista).
// L'utente tecnico che ne deriva NON ha riga in utenti_club: senza quella riga
// user_club_id() resta NULL e tutte le politiche amministrative falliscono da sole.
// Il token porta app_metadata: { role: 'pista', club_id }.
//
// Freno ai tentativi: attesa_prima_di_riprovare() prima della validazione,
// registra_tentativo_accesso() dopo. Il codice in chiaro non viene mai salvato.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function origine_da_request(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const primo = xff.split(",")[0]?.trim();
  return primo || "sconosciuta";
}

function normalizza_codice(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatta_codice(pulito: string): string {
  if (pulito.startsWith("PI") && pulito.length === 10) {
    return `PI-${pulito.slice(2, 6)}-${pulito.slice(6, 10)}`;
  }
  return "";
}

async function derive_password(seme: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::pista::${seme}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `Pi!${b64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const origine = origine_da_request(req);

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
      console.error("[pista-login] missing env vars:", missing);
      return json({ error: "server_misconfigured", missing }, 500);
    }

    let body: any;
    try { body = await req.json(); }
    catch { return json({ error: "invalid_body" }, 400); }

    const grezzo = String(body?.codice ?? "").trim();
    const pulito = normalizza_codice(grezzo);
    const codice = formatta_codice(pulito);

    const admin = createClient(supabase_url!, service_key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const registra = async (esito: "riuscito" | "fallito", motivo: string) => {
      try {
        await admin.rpc("registra_tentativo_accesso" as any, {
          p_origine: origine,
          p_codice: grezzo || null,
          p_esito: esito,
          p_motivo: motivo,
        });
      } catch (e) {
        console.error("[pista-login] registra_tentativo_accesso error", e);
      }
    };

    // ── Freno ai tentativi: PRIMA di validare il codice ──
    const { data: attesa_rows, error: attesa_err } = await admin
      .rpc("attesa_prima_di_riprovare" as any, { p_origine: origine });
    if (attesa_err) {
      console.error("[pista-login] attesa_prima_di_riprovare error", attesa_err.message);
    } else {
      const attesa: any = Array.isArray(attesa_rows) ? attesa_rows[0] : attesa_rows;
      if (attesa?.bloccato) {
        return json({
          error: "too_many_attempts",
          message: attesa.messaggio,
          secondi_di_attesa: attesa.secondi_di_attesa,
        }, 429);
      }
    }

    if (!codice) {
      await registra("fallito", "codice_non_valido");
      return json({ error: "codice_non_valido" }, 400);
    }

    const { data: club, error: club_err } = await admin
      .from("clubs")
      .select("id, nome, codice_pista")
      .eq("codice_pista", codice)
      .maybeSingle();

    if (club_err) {
      console.error("[pista-login] lettura club error:", club_err.message);
      return json({ error: "db_error", message: club_err.message }, 500);
    }
    if (!club) {
      await registra("fallito", "codice_non_trovato");
      return json({ error: "codice_non_valido" }, 404);
    }

    const email = `pista-${club.id}@portal.local`;
    const password = await derive_password(codice, salt!);
    const app_metadata = { role: "pista", club_id: club.id };
    const user_metadata = { club_nome: club.nome };

    const auth_client = createClient(supabase_url!, anon_key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let signin = await auth_client.auth.signInWithPassword({ email, password });

    if (signin.error) {
      const { data: created, error: create_err } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata, app_metadata,
      });

      if (create_err) {
        const msg = (create_err.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          // Il codice è cambiato: l'utente tecnico esiste già con la vecchia password.
          let found_id: string | null = null;
          for (let page = 1; page <= 50 && !found_id; page++) {
            const { data: pg } = await admin.auth.admin.listUsers({ page, perPage: 200 });
            const u = pg?.users?.find((x: any) => x.email === email);
            if (u) found_id = u.id;
            if (!pg || (pg.users?.length ?? 0) < 200) break;
          }
          if (!found_id) return json({ error: "auth_failed", message: "user_not_findable" }, 500);
          await admin.auth.admin.updateUserById(found_id, { password, user_metadata, app_metadata });
          signin = await auth_client.auth.signInWithPassword({ email, password });
        } else {
          console.error("[pista-login] createUser error:", create_err.message);
          return json({ error: "auth_failed", message: create_err.message }, 500);
        }
      } else if (created?.user) {
        signin = await auth_client.auth.signInWithPassword({ email, password });
      }
    } else if (signin.data.user?.id) {
      await admin.auth.admin.updateUserById(signin.data.user.id, { user_metadata, app_metadata });
    }

    if (signin.error || !signin.data.session) {
      console.error("[pista-login] final signin failed:", signin.error?.message);
      return json({ error: "auth_failed", message: signin.error?.message ?? "no session" }, 500);
    }

    // Nessuna riga in utenti_club: la sessione pista resta fuori dall'amministrazione.
    await registra("riuscito", "pista");

    return json({
      access_token: signin.data.session.access_token,
      refresh_token: signin.data.session.refresh_token,
      expires_in: signin.data.session.expires_in,
      token_type: signin.data.session.token_type,
      club: { id: club.id, nome: club.nome },
    });
  } catch (e) {
    console.error("[pista-login] unhandled:", e);
    return json({
      error: "internal_error",
      message: e instanceof Error ? e.message : String(e),
    }, 500);
  }
});
