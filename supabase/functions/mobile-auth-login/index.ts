// supabase/functions/mobile-auth-login/index.ts
// Edge Function: mobile-auth-login
// POST /functions/v1/mobile-auth-login
//
// Riconoscimento tramite codice atleta, codice istruttore o tag NFC
// (public.riconosci_identita) + freno ai tentativi di accesso
// (public.attesa_prima_di_riprovare / public.registra_tentativo_accesso).

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

function origine_da_request(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const primo = xff.split(",")[0]?.trim();
  return primo || "sconosciuta";
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
      console.error("[mobile-auth-login] missing env vars:", missing);
      return json({ error: "server_misconfigured", missing }, 500);
    }

    let body: any;
    try { body = await req.json(); }
    catch { return json({ error: "invalid_body" }, 400); }

    const valore = String(body?.token ?? body?.codice ?? "").trim();

    const admin = createClient(supabase_url!, service_key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const registra = async (esito: "riuscito" | "fallito", motivo: string) => {
      try {
        await admin.rpc("registra_tentativo_accesso" as any, {
          p_origine: origine,
          p_codice: valore,
          p_esito: esito,
          p_motivo: motivo,
        });
      } catch (e) {
        console.error("[mobile-auth-login] registra_tentativo_accesso error", e);
      }
    };

    // ── Freno ai tentativi: PRIMA di qualunque lettura dei dati ──
    const { data: attesa_rows, error: attesa_err } = await admin
      .rpc("attesa_prima_di_riprovare" as any, { p_origine: origine });
    if (attesa_err) {
      console.error("[mobile-auth-login] attesa_prima_di_riprovare error", attesa_err.message);
    } else {
      const attesa: any = Array.isArray(attesa_rows) ? attesa_rows[0] : attesa_rows;
      if (attesa?.bloccato) {
        console.warn("[mobile-auth-login] bloccato per troppi tentativi");
        return json({
          error: "too_many_attempts",
          message: attesa.messaggio,
          secondi_di_attesa: attesa.secondi_di_attesa,
        }, 429);
      }
    }

    if (!valore) {
      await registra("fallito", "codice_non_valido");
      return json({ error: "invalid_codice" }, 400);
    }

    // ── Riconoscimento identità (atleta | istruttore, codice | tag) ──
    const { data: ident_rows, error: ident_err } = await admin
      .rpc("riconosci_identita" as any, { p_valore: valore });

    if (ident_err) {
      console.error("[mobile-auth-login] riconosci_identita error:", ident_err.message);
      return json({ error: "db_error", message: ident_err.message }, 500);
    }

    const identita: any = Array.isArray(ident_rows) ? ident_rows[0] : ident_rows;
    if (!identita?.id) {
      await registra("fallito", "codice_non_trovato");
      // messaggio volutamente generico
      return json({ error: "invalid_codice" }, 404);
    }

    const auth_client = createClient(supabase_url!, anon_key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Dati specifici per tipo
    let email = "";
    let seme_password = "";
    let app_metadata: Record<string, unknown> = {};
    let user_metadata: Record<string, unknown> = {};
    let atleta: any = null;
    let istruttore: any = null;
    let club_id: string = identita.club_id;

    if (identita.tipo === "atleta") {
      const { data: a } = await admin
        .from("atleti")
        .select("id, nome, cognome, club_id, codice_atleta")
        .eq("id", identita.id)
        .maybeSingle();
      if (!a) {
        await registra("fallito", "codice_non_trovato");
        return json({ error: "invalid_codice" }, 404);
      }
      atleta = a;
      club_id = a.club_id;
      email = `atleta-${a.id}@portal.local`;
      seme_password = a.codice_atleta ?? a.id;
      app_metadata = { atleta_id: a.id, club_id: a.club_id, role: "mobile_parent" };
      user_metadata = { nome: a.nome, cognome: a.cognome };
    } else if (identita.tipo === "istruttore") {
      const { data: i } = await admin
        .from("istruttori")
        .select("id, nome, cognome, club_id, codice_istruttore, user_id")
        .eq("id", identita.id)
        .maybeSingle();
      if (!i) {
        await registra("fallito", "codice_non_trovato");
        return json({ error: "invalid_codice" }, 404);
      }
      istruttore = i;
      club_id = i.club_id;
      email = `istruttore-${i.id}@portal.local`;
      seme_password = i.codice_istruttore ?? i.id;
      app_metadata = {
        role: "mobile_staff",
        istruttore_id: i.id,
        club_id: i.club_id,
        ruolo: identita.ruolo || "istruttore",
      };
      user_metadata = { nome: i.nome, cognome: i.cognome };
    } else {
      await registra("fallito", "tipo_non_supportato");
      return json({ error: "invalid_codice" }, 404);
    }

    const password = await derive_password(seme_password, salt!);

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

    // L'utente creato dal codice NON ha riga in utenti_club: resta fuori
    // dall'amministrazione del club (user_club_id() = NULL).

    // Collega l'utente auth all'anagrafica istruttore: da qui in poi
    // genera_reminder_giornalieri trova i destinatari via istruttori.user_id.
    if (istruttore) {
      const uid = signin.data.user?.id;
      if (uid && istruttore.user_id !== uid) {
        const { error: link_err } = await admin
          .from("istruttori")
          .update({ user_id: uid })
          .eq("id", istruttore.id);
        if (link_err) console.error("[mobile-auth-login] link user_id error:", link_err.message);
      }
    }

    const { data: club } = await admin
      .from("clubs").select("id, nome").eq("id", club_id).maybeSingle();

    await registra("riuscito", identita.tipo);

    console.log("[mobile-auth-login] login OK", identita.tipo, identita.id);
    return json({
      access_token: signin.data.session.access_token,
      refresh_token: signin.data.session.refresh_token,
      expires_in: signin.data.session.expires_in,
      token_type: signin.data.session.token_type,
      tipo: identita.tipo,
      mezzo: identita.mezzo,
      atleta: atleta
        ? {
            id: atleta.id, nome: atleta.nome, cognome: atleta.cognome,
            club_id: atleta.club_id, codice_atleta: atleta.codice_atleta,
          }
        : null,
      istruttore: istruttore
        ? {
            id: istruttore.id, nome: istruttore.nome, cognome: istruttore.cognome,
            club_id: istruttore.club_id, codice_istruttore: istruttore.codice_istruttore,
            ruolo: identita.ruolo || "istruttore",
          }
        : null,
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
