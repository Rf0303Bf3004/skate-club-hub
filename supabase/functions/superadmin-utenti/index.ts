// Edge Function: superadmin-utenti
// Operazioni di gestione utenti riservate al ruolo `superadmin`.
// Verifica il JWT del chiamante e poi usa il service role per le operazioni admin.

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

function gen_password(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const sym = "!@#$%&*?";
  let out = "";
  const arr = new Uint32Array(len - 1);
  crypto.getRandomValues(arr);
  for (const n of arr) out += chars[n % chars.length];
  const sa = new Uint32Array(1); crypto.getRandomValues(sa);
  out += sym[sa[0] % sym.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth_header = req.headers.get("Authorization") ?? "";
    if (!auth_header.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    // Verifica chiamante e ruolo superadmin
    const user_client = createClient(url, anon, { global: { headers: { Authorization: auth_header } } });
    const { data: { user } } = await user_client.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: uc } = await admin.from("utenti_club").select("ruolo").eq("user_id", user.id).maybeSingle();
    if (!uc || uc.ruolo !== "superadmin") return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list") {
      // Lista utenti tramite admin.listUsers + join con utenti_club
      const { data: pages } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const users_map = new Map<string, any>();
      for (const u of pages?.users ?? []) {
        users_map.set(u.id, {
          id: u.id,
          email: u.email,
          last_sign_in_at: u.last_sign_in_at,
          created_at: u.created_at,
          banned: !!(u as any).banned_until,
        });
      }
      const { data: rows } = await admin
        .from("utenti_club")
        .select("user_id, email, nome, cognome, ruolo, club_id, clubs(nome)")
        .order("cognome");
      const merged = (rows ?? []).map((r: any) => ({
        ...users_map.get(r.user_id),
        user_id: r.user_id,
        email: r.email ?? users_map.get(r.user_id)?.email,
        nome: r.nome,
        cognome: r.cognome,
        ruolo: r.ruolo,
        club_id: r.club_id,
        club_nome: r.clubs?.nome ?? null,
      }));
      // Aggiungi utenti senza utenti_club (rari)
      for (const [uid, info] of users_map) {
        if (!merged.find((m) => m.user_id === uid)) {
          merged.push({ ...info, user_id: uid, ruolo: null, club_id: null, club_nome: null });
        }
      }
      return json({ utenti: merged });
    }

    if (action === "reset_password") {
      const user_id = String(body?.user_id ?? "");
      if (!user_id) return json({ error: "missing_user_id" }, 400);
      const new_password = gen_password(14);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) return json({ error: "update_failed", message: error.message }, 500);
      return json({ ok: true, new_password });
    }

    if (action === "set_disattivo") {
      const user_id = String(body?.user_id ?? "");
      const disattivo = !!body?.disattivo;
      if (!user_id) return json({ error: "missing_user_id" }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: disattivo ? "876000h" : "none",
      });
      if (error) return json({ error: "update_failed", message: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "cambia_ruolo") {
      const user_id = String(body?.user_id ?? "");
      const nuovo_ruolo = String(body?.ruolo ?? "");
      if (!user_id || !nuovo_ruolo) return json({ error: "missing_params" }, 400);
      const { error } = await admin.from("utenti_club").update({ ruolo: nuovo_ruolo }).eq("user_id", user_id);
      if (error) return json({ error: "update_failed", message: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "crea_superadmin") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const nome = String(body?.nome ?? "").trim();
      const cognome = String(body?.cognome ?? "").trim();
      if (!email || !nome || !cognome) return json({ error: "missing_params" }, 400);
      const new_password = gen_password(14);
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password: new_password, email_confirm: true,
        user_metadata: { full_name: `${nome} ${cognome}` },
      });
      if (error) return json({ error: "create_failed", message: error.message }, 500);
      // Inserisci riga in utenti_club come superadmin (senza club specifico)
      await admin.from("utenti_club").insert({
        user_id: created.user!.id,
        email, nome, cognome,
        ruolo: "superadmin",
      });
      return json({ ok: true, new_password, user_id: created.user!.id });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[superadmin-utenti]", e);
    return json({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
