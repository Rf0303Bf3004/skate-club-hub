import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { fattura_id, destinatario } = await req.json();
    if (!fattura_id || !destinatario) {
      return new Response(JSON.stringify({ error: "fattura_id e destinatario obbligatori" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: f } = await supabase.from("fatture").select("*, clubs(nome)").eq("id", fattura_id).maybeSingle();
    if (!f) return new Response(JSON.stringify({ error: "fattura non trovata" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
      await supabase.from("fatture").update({ email_inviata_at: new Date().toISOString(), data_invio: new Date().toISOString(), stato: "inviata" }).eq("id", fattura_id);
      return new Response(JSON.stringify({ ok: true, warning: "Email skipped: provider non configurato" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clubNome = (f as any).clubs?.nome ?? "Il tuo club";
    const html = `<div style="font-family:sans-serif;color:#0f172a">
      <h2>Fattura ${f.numero ?? ""}</h2>
      <p>Trovi in allegato (oppure tramite il portale) la fattura ${f.numero ?? ""} di ${clubNome}.</p>
      <p><strong>Totale:</strong> CHF ${Number(f.importo ?? 0).toFixed(2)}</p>
      ${f.data_scadenza ? `<p><strong>Scadenza:</strong> ${f.data_scadenza}</p>` : ""}
      <p>Puoi visualizzare e pagare la fattura dal portale.</p>
    </div>`;

    const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: `${clubNome} <onboarding@resend.dev>`,
        to: [destinatario],
        subject: `Fattura ${f.numero ?? ""} - ${clubNome}`,
        html,
      }),
    });
    const body = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(body));

    await supabase.from("fatture").update({ email_inviata_at: new Date().toISOString(), data_invio: new Date().toISOString(), stato: "inviata" }).eq("id", fattura_id);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
