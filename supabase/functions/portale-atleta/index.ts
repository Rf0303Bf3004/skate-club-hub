// Edge Function: portale-atleta
// Endpoint pubblico (token-scoped) per il Portale Atleta.
// Sostituisce le policy RLS pubbliche su atleti/fatture/comunicazioni/lezioni/etc.
// Tutte le query sono server-side con service role e filtrate per portal_token.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const action = String(body?.action ?? "init");
    if (!token || token.length < 8) return json({ error: "invalid_token" }, 400);

    // Risolvi atleta dal token (server-side, solo questa riga)
    const { data: atleta, error: atl_err } = await admin
      .from("atleti")
      .select("*")
      .eq("portal_token", token)
      .maybeSingle();
    if (atl_err) return json({ error: "db_error", detail: atl_err.message }, 500);
    if (!atleta) return json({ error: "invalid_token" }, 404);

    const atleta_id = atleta.id;
    const club_id = atleta.club_id;
    const oggi = new Date().toISOString().split("T")[0];

    // Whitelist dei campi atleta esposti (esclude verificato_da_user_id, importato_da_excel ecc.)
    const atleta_pub = {
      id: atleta.id, club_id, nome: atleta.nome, cognome: atleta.cognome,
      data_nascita: atleta.data_nascita, luogo_nascita: (atleta as any).luogo_nascita,
      indirizzo: atleta.indirizzo, telefono: atleta.telefono, codice_fiscale: atleta.codice_fiscale,
      carriera_artistica: atleta.carriera_artistica, carriera_stile: atleta.carriera_stile,
      percorso_amatori: (atleta as any).percorso_amatori, livello_attuale: atleta.livello_attuale,
      foto_url: atleta.foto_url, licenza_sis_numero: atleta.licenza_sis_numero,
      licenza_sis_categoria: atleta.licenza_sis_categoria,
      licenza_sis_disciplina: atleta.licenza_sis_disciplina,
      licenza_sis_validita_a: atleta.licenza_sis_validita_a,
    };

    if (action === "init") {
      const { data: club } = await admin.from("clubs").select("id, nome, logo_url, colore_primario").eq("id", club_id).maybeSingle();
      return json({ atleta: atleta_pub, club });
    }

    if (action === "calendario") {
      const { data: lp } = await admin
        .from("lezioni_private_atlete")
        .select("lezione_id, lezioni_private(*)")
        .eq("atleta_id", atleta_id);
      const lezioni = (lp ?? []).map((x: any) => x.lezioni_private)
        .filter((l: any) => l && !l.annullata && l.data >= oggi)
        .map((l: any) => ({ tipo: "Lezione privata", data: l.data, ora_inizio: l.ora_inizio, ora_fine: l.ora_fine, titolo: "Lezione privata" }));
      const { data: ig } = await admin
        .from("iscrizioni_gare")
        .select("gara_id, gare_calendario(*)")
        .eq("atleta_id", atleta_id);
      const gare = (ig ?? []).map((x: any) => x.gare_calendario)
        .filter((g: any) => g && g.data >= oggi)
        .map((g: any) => ({ tipo: "Gara", data: g.data, ora_inizio: null, ora_fine: null, titolo: g.nome, luogo: g.luogo }));
      const { data: ie } = await admin
        .from("iscrizioni_eventi")
        .select("evento_id, eventi_straordinari(*)")
        .eq("atleta_id", atleta_id);
      const eventi = (ie ?? []).map((x: any) => x.eventi_straordinari)
        .filter((e: any) => e && e.data >= oggi)
        .map((e: any) => ({ tipo: e.tipo || "Evento", data: e.data, ora_inizio: e.ora_inizio, ora_fine: e.ora_fine, titolo: e.titolo, luogo: e.luogo }));
      const tutti = [...lezioni, ...gare, ...eventi].sort((a, b) =>
        (a.data + (a.ora_inizio ?? "")).localeCompare(b.data + (b.ora_inizio ?? "")),
      );
      return json({ eventi: tutti });
    }

    if (action === "comunicazioni") {
      const { data: cd } = await admin
        .from("comunicazioni_destinatari")
        .select("*, comunicazioni(*)")
        .eq("atleta_id", atleta_id)
        .order("creato_at", { ascending: false });
      return json({ comunicazioni: (cd ?? []).filter((x: any) => x.comunicazioni) });
    }

    if (action === "fatture") {
      const { data: f } = await admin
        .from("fatture")
        .select("id, numero, descrizione, tipo, importo, pagata, stato, data_emissione, data_scadenza, data_pagamento, periodo")
        .eq("atleta_id", atleta_id)
        .order("data_emissione", { ascending: false });
      return json({ fatture: f ?? [] });
    }

    if (action === "corsi") {
      const { data: corsi } = await admin
        .from("corsi").select("*").eq("club_id", club_id).eq("attivo", true).order("nome");
      const { data: isc } = await admin
        .from("iscrizioni_corsi").select("corso_id, attiva").eq("atleta_id", atleta_id);
      const { data: ric } = await admin
        .from("richieste_iscrizione").select("corso_id, stato").eq("atleta_id", atleta_id).eq("stato", "in_attesa");
      return json({
        corsi: corsi ?? [],
        iscrizioni_attive: (isc ?? []).filter((x: any) => x.attiva !== false).map((x: any) => x.corso_id),
        richieste: (ric ?? []).map((x: any) => x.corso_id),
      });
    }

    if (action === "rsvp") {
      const destinatario_id = String(body?.destinatario_id ?? "");
      const risposta = body?.risposta === "si" ? "si" : "no";
      if (!destinatario_id) return json({ error: "missing_destinatario_id" }, 400);
      // Verifica che il destinatario appartenga a questo atleta
      const { data: dest } = await admin
        .from("comunicazioni_destinatari").select("id, atleta_id").eq("id", destinatario_id).maybeSingle();
      if (!dest || dest.atleta_id !== atleta_id) return json({ error: "forbidden" }, 403);
      const now = new Date().toISOString();
      const { error } = await admin
        .from("comunicazioni_destinatari")
        .update({ rsvp_risposta: risposta, rsvp_at: now, letto_at: now })
        .eq("id", destinatario_id);
      if (error) return json({ error: "db_error", detail: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "richiedi_iscrizione") {
      const corso_id = String(body?.corso_id ?? "");
      if (!corso_id) return json({ error: "missing_corso_id" }, 400);
      const { data: corso } = await admin
        .from("corsi").select("id, club_id, nome").eq("id", corso_id).maybeSingle();
      if (!corso || corso.club_id !== club_id) return json({ error: "forbidden" }, 403);
      const { error } = await admin.from("richieste_iscrizione").insert({
        club_id, atleta_id, corso_id, stato: "in_attesa",
        note_richiesta: `Richiesta inviata dal portale per ${atleta.nome} ${atleta.cognome}`,
      });
      if (error) return json({ error: "db_error", detail: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[portale-atleta]", e);
    return json({ error: "internal_error", detail: String(e) }, 500);
  }
});
