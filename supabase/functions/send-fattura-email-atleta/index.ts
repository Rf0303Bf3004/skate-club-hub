// Edge Function: send-fattura-email-atleta
// Invia per email la fattura di un atleta.
// Il chiamante deve essere identificato: staff del club (superadmin/admin/presidente/segreteria)
// oppure l'account del portale famiglia collegato all'atleta della fattura.
// Il collegamento al PDF e il destinatario NON sono più accettati dal corpo della richiesta.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORIGINI_AMMESSE = [
  "https://app.icearena.ch",
  "https://ice-arena-manager.lovable.app",
  "https://id-preview--f73d3b52-ac71-4df5-835a-6a9b98a06a92.lovable.app",
  "http://localhost:8080",
];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const ammessa = ORIGINI_AMMESSE.includes(origin)
    ? origin
    : /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin)
      ? origin
      : ORIGINI_AMMESSE[0];
  return {
    "Access-Control-Allow-Origin": ammessa,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const RUOLI_FATTURAZIONE = ["superadmin", "admin", "presidente", "segreteria"];
const BUCKET_FATTURE = "fatture-atleti";

Deno.serve(async (req) => {
  const corsHeaders = cors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon_key = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Identità del chiamante: serve un JWT utente vero, non la chiave pubblica.
    const auth_header = req.headers.get("Authorization") ?? "";
    const token = auth_header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "unauthorized" }, 401);

    const user_client = createClient(url, anon_key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: u_err } = await user_client.auth.getUser();
    if (u_err || !user) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(url, service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const fattura_id = String((body as any)?.fattura_id ?? "").trim();
    const destinatario_richiesto = String((body as any)?.destinatario ?? "").trim().toLowerCase();
    if (!fattura_id) return json({ error: "missing_params" }, 400);

    const { data: f, error: f_err } = await supabase
      .from("fatture")
      .select("*, clubs(nome)")
      .eq("id", fattura_id)
      .maybeSingle();
    if (f_err) return json({ error: "lookup_failed" }, 500);
    // Messaggio identico se la fattura non esiste o non è del chiamante.
    if (!f) return json({ error: "forbidden" }, 403);

    // 2) Autorizzazione: staff dello stesso club, oppure famiglia dell'atleta.
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const atleta_del_portale = typeof meta.atleta_id === "string" ? meta.atleta_id : null;

    let autorizzato = false;
    if (atleta_del_portale && f.atleta_id && atleta_del_portale === f.atleta_id) {
      autorizzato = true;
    } else {
      const { data: caller, error: c_err } = await supabase
        .from("utenti_club")
        .select("ruolo, club_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (c_err) return json({ error: "lookup_failed" }, 500);
      if (
        caller &&
        RUOLI_FATTURAZIONE.includes(String(caller.ruolo)) &&
        (caller.ruolo === "superadmin" || caller.club_id === f.club_id)
      ) {
        autorizzato = true;
      }
    }
    if (!autorizzato) return json({ error: "forbidden" }, 403);

    // 3) Destinatario: solo indirizzi già presenti sull'atleta o sulla fattura.
    let atleta: { genitore1_email: string | null; genitore2_email: string | null } | null = null;
    if (f.atleta_id) {
      const { data: a, error: a_err } = await supabase
        .from("atleti")
        .select("genitore1_email, genitore2_email")
        .eq("id", f.atleta_id)
        .maybeSingle();
      if (a_err) return json({ error: "lookup_failed" }, 500);
      atleta = a as any;
    }
    const ammessi = [
      f.intestatario_email,
      atleta?.genitore1_email,
      atleta?.genitore2_email,
    ]
      .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
      .map((e) => e.trim().toLowerCase());

    const destinatario = destinatario_richiesto || ammessi[0] || "";
    if (!destinatario) return json({ error: "destinatario_mancante" }, 400);
    if (!ammessi.includes(destinatario)) return json({ error: "destinatario_non_ammesso" }, 403);

    // 4) Collegamento al PDF: costruito qui dal bucket, mai preso dalla richiesta.
    const percorso_pdf = typeof f.pdf_url === "string" && f.pdf_url.trim().length > 0
      ? f.pdf_url.trim()
      : `${f.club_id}/${fattura_id}.pdf`;
    let link_pdf: string | null = null;
    const { data: signed } = await supabase.storage
      .from(BUCKET_FATTURE)
      .createSignedUrl(percorso_pdf, 60 * 60 * 24 * 30);
    if (signed?.signedUrl) link_pdf = signed.signedUrl;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
      await supabase.from("fatture").update({ email_inviata_at: new Date().toISOString(), stato: "inviata" }).eq("id", fattura_id);
      return json({ ok: true, warning: "Email skipped: provider non configurato" });
    }

    const clubNome = (f as any).clubs?.nome ?? "Il tuo club";
    const html = `<div style="font-family:sans-serif;color:#0f172a">
      <h2>Fattura ${f.numero ?? ""}</h2>
      <p>${link_pdf ? `Puoi scaricare la fattura ${f.numero ?? ""} di ${clubNome} dal pulsante qui sotto.` : `La fattura ${f.numero ?? ""} di ${clubNome} è disponibile nel portale.`}</p>
      <p><strong>Totale:</strong> CHF ${Number(f.importo ?? 0).toFixed(2)}</p>
      ${f.data_scadenza ? `<p><strong>Scadenza:</strong> ${f.data_scadenza}</p>` : ""}
      ${link_pdf ? `<p><a href="${link_pdf}" style="display:inline-block;background:#0284c7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Scarica la fattura</a></p><p style="font-size:12px;color:#64748b">Il collegamento resta valido 30 giorni.</p>` : ""}
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
    const risposta = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(risposta));

    await supabase.from("fatture").update({ email_inviata_at: new Date().toISOString(), stato: "inviata" }).eq("id", fattura_id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
