// Edge Function: campo-ospite
// Endpoint pubblico (token-scoped) per i club ospitati che NON usano il portale.
// Il token vive su campi_club_partecipanti.token ed è generato da genera_link_club_ospite().
// Tutte le query girano con service role: il token è l'unica credenziale.

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
    const azione = String(body.azione ?? "info");
    const token = String(body.token ?? "").trim();
    if (!token) return json({ error: "token_mancante" }, 400);

    const { data: riga, error: err_riga } = await admin
      .from("campi_club_partecipanti")
      .select("id, evento_campo_id, club_id, club_esterno_nome, stato, valido_dal, valido_al")
      .eq("token", token)
      .maybeSingle();
    if (err_riga) return json({ error: "errore_lettura", dettaglio: err_riga.message }, 500);
    if (!riga) return json({ error: "token_non_valido" }, 404);

    const { data: evento } = await admin
      .from("eventi_campi")
      .select("id, nome, data_inizio, data_fine, luogo, descrizione, scadenza_adesioni, stato, quota_atleta")
      .eq("id", riga.evento_campo_id)
      .maybeSingle();

    const { data: gruppi } = await admin
      .from("campi_gruppi")
      .select("id, nome, criterio, ordine")
      .eq("evento_campo_id", riga.evento_campo_id)
      .order("ordine", { ascending: true });

    // Nome del club di provenienza: quello esterno oppure il nome del club a portale.
    let club_provenienza = riga.club_esterno_nome ?? "";
    if (!club_provenienza && riga.club_id) {
      const { data: club } = await admin.from("clubs").select("nome").eq("id", riga.club_id).maybeSingle();
      club_provenienza = club?.nome ?? "";
    }

    if (azione === "info") {
      const { count } = await admin
        .from("atleti")
        .select("id", { count: "exact", head: true })
        .eq("ospite_di_campo_id", riga.evento_campo_id)
        .eq("club_provenienza", club_provenienza);
      return json({
        evento,
        club_provenienza,
        stato_partecipazione: riga.stato,
        gruppi: gruppi ?? [],
        atleti_registrati: count ?? 0,
      });
    }

    if (azione === "registra") {
      const elenco = Array.isArray(body.elenco) ? body.elenco : [];
      if (elenco.length === 0) return json({ error: "elenco_vuoto" }, 400);
      if (evento?.stato === "chiuso" || evento?.stato === "concluso") {
        return json({ error: "campo_chiuso" }, 409);
      }
      const { data, error } = await admin.rpc("registra_atleti_ospiti_massa", {
        p_campo: riga.evento_campo_id,
        p_club_provenienza: club_provenienza,
        p_elenco: elenco,
        p_gruppo: body.gruppo_id ?? null,
      });
      if (error) return json({ error: "registrazione_fallita", dettaglio: error.message }, 400);
      return json({ risultato: data ?? [] });
    }

    return json({ error: "azione_sconosciuta" }, 400);
  } catch (e) {
    return json({ error: "errore_interno", dettaglio: String(e) }, 500);
  }
});
