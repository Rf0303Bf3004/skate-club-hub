// Edge Function: manage-user
// POST /functions/v1/manage-user
// Body: { action: "create"|"update_password"|"reset_password", ... }
// Verifica che il chiamante sia admin/superadmin/presidente del club indicato.

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

const ALLOWED_CALLER_ROLES = ["admin", "superadmin", "presidente"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase_url = Deno.env.get("SUPABASE_URL")!;
    const service_role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth_header = req.headers.get("Authorization") || "";
    const token = auth_header.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    // Verifica utente chiamante
    const supa_user = createClient(supabase_url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: u_err } = await supa_user.auth.getUser();
    if (u_err || !user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabase_url, service_role);

    const body = await req.json();
    const { action, club_id } = body || {};
    if (!action || !club_id) return json({ error: "missing_params" }, 400);

    // Verifica ruolo del chiamante per quel club
    const { data: caller, error: c_err } = await admin
      .from("utenti_club")
      .select("ruolo")
      .eq("user_id", user.id)
      .eq("club_id", club_id)
      .maybeSingle();
    if (c_err) return json({ error: "lookup_failed", detail: c_err.message }, 500);
    if (!caller || !ALLOWED_CALLER_ROLES.includes(caller.ruolo)) {
      return json({ error: "forbidden" }, 403);
    }

    if (action === "create") {
      const { email, password, nome, cognome, telefono, ruolo } = body;
      if (!email || !password || !ruolo) return json({ error: "missing_params" }, 400);

      const { data: created, error: cr_err } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, cognome },
      });
      if (cr_err || !created.user) return json({ error: cr_err?.message || "create_failed" }, 400);

      const { error: ins_err } = await admin.from("utenti_club").insert({
        user_id: created.user.id,
        club_id,
        ruolo,
        nome: nome ?? "",
        cognome: cognome ?? "",
        telefono: telefono ?? "",
        attivo: true,
      });
      if (ins_err) {
        // rollback utente
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: ins_err.message }, 400);
      }
      return json({ ok: true, user_id: created.user.id });
    }

    if (action === "update_password") {
      const { user_id, password } = body;
      if (!user_id || !password) return json({ error: "missing_params" }, 400);
      // verifica che user_id appartenga allo stesso club
      const { data: target } = await admin
        .from("utenti_club")
        .select("id")
        .eq("user_id", user_id)
        .eq("club_id", club_id)
        .maybeSingle();
      if (!target) return json({ error: "not_found" }, 404);

      const { error: up_err } = await admin.auth.admin.updateUserById(user_id, { password });
      if (up_err) return json({ error: up_err.message }, 400);
      return json({ ok: true });
    }

    if (action === "list_auth_info") {
      const { user_ids } = body;
      if (!Array.isArray(user_ids)) return json({ error: "missing_params" }, 400);
      const result: Record<string, { email: string | null; last_sign_in_at: string | null }> = {};
      // paginate listUsers
      let page = 1;
      const set = new Set(user_ids);
      while (set.size > 0 && page < 20) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        for (const u of data.users) {
          if (set.has(u.id)) {
            result[u.id] = { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null };
            set.delete(u.id);
          }
        }
        if (data.users.length < 200) break;
        page++;
      }
      return json({ ok: true, users: result });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
