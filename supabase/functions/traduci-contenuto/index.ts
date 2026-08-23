import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LINGUE = ["de", "fr", "en", "rm"] as const;

// Whitelist fissa lato server: nessun campo arbitrario dal client.
const CAMPI_PER_TABELLA: Record<string, string[]> = {
  comunicazioni: ["titolo", "testo"],
  convenzioni: ["titolo", "descrizione", "valore_proposta"],
  convenzioni_aree: ["nome"],
  corsi: ["note"],
  campi_allenamento: ["nome", "note"],
};

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
    const is_service = auth === `Bearer ${service_key}`;

    const body = await req.json().catch(() => ({}));
    const tabella = body?.tabella;
    const record_id = body?.record_id;
    const job_id = body?.job_id;

    if (typeof tabella !== "string" || !CAMPI_PER_TABELLA[tabella]) {
      return json({ error: "tabella non supportata" }, 400);
    }
    if (typeof record_id !== "string" || !/^[0-9a-f-]{36}$/i.test(record_id)) {
      return json({ error: "record_id (uuid) obbligatorio" }, 400);
    }
    const campi = CAMPI_PER_TABELLA[tabella];

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, service_key);

    // Autorizzazione: chiamata interna (service role) oppure job creato dal
    // trigger DB (tabella accessibile solo a service_role → prova di origine).
    if (!is_service) {
      if (typeof job_id !== "string") return json({ error: "forbidden" }, 403);
      const { data: job } = await supabase
        .from("traduzioni_jobs")
        .select("id, record_id, tabella")
        .eq("id", job_id)
        .maybeSingle();
      if (!job || job.record_id !== record_id || job.tabella !== tabella) {
        return json({ error: "forbidden" }, 403);
      }
      await supabase.from("traduzioni_jobs").delete().eq("id", job_id);
    }

    const { data: riga, error: riga_err } = await supabase
      .from(tabella)
      .select(["id", ...campi].join(", "))
      .eq("id", record_id)
      .maybeSingle();
    if (riga_err) throw riga_err;
    if (!riga) return json({ error: "record non trovato" }, 404);

    const campi_pieni = campi.filter((c) => {
      const v = (riga as any)[c];
      return typeof v === "string" && v.trim() !== "";
    });
    if (campi_pieni.length === 0) return json({ ok: true, skipped: "nessun testo da tradurre" });

    const prompt = `Traduci i seguenti testi provenienti da un club svizzero di pattinaggio su ghiaccio, destinati agli atleti e ai loro genitori.
Tono: professionale ma cordiale. Preserva ESATTAMENTE emoji, numeri, orari, date, nomi propri e importi come nell'originale.
Non aggiungere commenti o testo extra. Traduci ogni campo separatamente mantenendo la stessa chiave.

CAMPI (italiano):
${campi_pieni.map((c) => `[${c}]\n${(riga as any)[c]}`).join("\n\n")}

Traduci in: tedesco (de), francese (fr), inglese (en), romancio Rumantsch Grischun (rm).`;

    const campo_props = Object.fromEntries(campi_pieni.map((c) => [c, { type: "string" }]));
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
            required: campi_pieni,
            properties: campo_props,
          },
        ]),
      ),
    };

    const api_key = Deno.env.get("LOVABLE_API_KEY");
    if (!api_key) return json({ error: "LOVABLE_API_KEY non configurata" }, 401);

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
      await mark_errore(supabase, tabella, record_id, campi_pieni);
      if (ai_res.status === 429) return json({ error: "rate_limited", detail: txt }, 429);
      if (ai_res.status === 402) return json({ error: "crediti_esauriti", detail: txt }, 402);
      return json({ error: "ai_error", status: ai_res.status, detail: txt }, 502);
    }

    const ai_json = await ai_res.json();
    const content = ai_json?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, Record<string, string>>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("parsing fallito", content);
      await mark_errore(supabase, tabella, record_id, campi_pieni);
      return json({ error: "parsing_fallito" }, 502);
    }

    const now = new Date().toISOString();
    const righe = campi_pieni.map((campo) => ({
      tabella,
      record_id,
      campo,
      it: (riga as any)[campo] ?? "",
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

    return json({ ok: true, tabella, record_id, campi: campi_pieni, lingue: LINGUE });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function mark_errore(supabase: any, tabella: string, record_id: string, campi: string[]) {
  await supabase.from("contenuti_traduzioni").upsert(
    campi.map((campo) => ({
      tabella,
      record_id,
      campo,
      stato: "errore",
      aggiornato_il: new Date().toISOString(),
    })),
    { onConflict: "tabella,record_id,campo" },
  );
}
