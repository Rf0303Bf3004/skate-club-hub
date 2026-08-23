import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LINGUE = ["de", "fr", "en", "rm"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${service_key}`) {
      return json({ error: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const record_id = body?.record_id;
    if (typeof record_id !== "string" || !/^[0-9a-f-]{36}$/i.test(record_id)) {
      return json({ error: "record_id (uuid) obbligatorio" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, service_key);

    const { data: com, error: com_err } = await supabase
      .from("comunicazioni")
      .select("id, titolo, testo")
      .eq("id", record_id)
      .maybeSingle();
    if (com_err) throw com_err;
    if (!com) return json({ error: "comunicazione non trovata" }, 404);

    const api_key = Deno.env.get("LOVABLE_API_KEY");
    if (!api_key) return json({ error: "LOVABLE_API_KEY non configurata" }, 401);

    const prompt = `Traduci il seguente testo di una comunicazione ufficiale di un club svizzero di pattinaggio su ghiaccio, indirizzata ai genitori degli atleti.
Tono: professionale ma cordiale. Preserva ESATTAMENTE emoji, numeri, orari, date, nomi propri e importi come nell'originale.
Non aggiungere commenti o testo extra.

TITOLO (italiano):
${com.titolo ?? ""}

TESTO (italiano):
${com.testo ?? ""}

Traduci in: tedesco (de), francese (fr), inglese (en), romancio Rumantsch Grischun (rm).`;

    const schema = {
      type: "object",
      additionalProperties: false,
      required: [...LINGUE],
      properties: Object.fromEntries(
        LINGUE.map((l) => [
          l,
          {
            type: "object",
            additionalProperties: false,
            required: ["titolo", "testo"],
            properties: { titolo: { type: "string" }, testo: { type: "string" } },
          },
        ]),
      ),
    };

    const ai_res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash",
        messages: [
          {
            role: "system",
            content:
              "Sei un traduttore professionista svizzero. Rispondi SOLO con JSON valido secondo lo schema richiesto.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "traduzioni", strict: true, schema },
        },
      }),
    });

    if (!ai_res.ok) {
      const txt = await ai_res.text();
      console.error("AI gateway error", ai_res.status, txt);
      await mark_errore(supabase, record_id);
      if (ai_res.status === 429) return json({ error: "rate_limited", detail: txt }, 429);
      if (ai_res.status === 402) return json({ error: "crediti_esauriti", detail: txt }, 402);
      return json({ error: "ai_error", status: ai_res.status, detail: txt }, 502);
    }

    const ai_json = await ai_res.json();
    const content = ai_json?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, { titolo: string; testo: string }>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("parsing fallito", content);
      await mark_errore(supabase, record_id);
      return json({ error: "parsing_fallito" }, 502);
    }

    const now = new Date().toISOString();
    const righe = (["titolo", "testo"] as const).map((campo) => ({
      tabella: "comunicazioni",
      record_id,
      campo,
      it: (com as any)[campo] ?? "",
      de: parsed.de?.[campo] ?? null,
      fr: parsed.fr?.[campo] ?? null,
      en: parsed.en?.[campo] ?? null,
      rm: parsed.rm?.[campo] ?? null,
      stato: "auto",
      aggiornato_il: now,
    }));

    const { error: up_err } = await supabase
      .from("contenuti_traduzioni")
      .upsert(righe, { onConflict: "tabella,record_id,campo" });
    if (up_err) throw up_err;

    return json({ ok: true, record_id, lingue: LINGUE });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function mark_errore(supabase: any, record_id: string) {
  await supabase.from("contenuti_traduzioni").upsert(
    (["titolo", "testo"] as const).map((campo) => ({
      tabella: "comunicazioni",
      record_id,
      campo,
      stato: "errore",
      aggiornato_il: new Date().toISOString(),
    })),
    { onConflict: "tabella,record_id,campo" },
  );
}
