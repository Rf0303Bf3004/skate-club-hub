const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: 'Extract all skaters data and return ONLY valid JSON no markdown no explanation. Format: {"categoria":"","gruppo":"","disciplina":"","atleti":[{"rank":1,"nome":"FIRSTNAME LASTNAME","club":"ABC","starting_number":3,"tot":14.13,"tes":4.79,"pcs":9.34,"deductions":0,"pcs_presentation":2.25,"pcs_skating_skills":2.42,"elementi":[{"seq":1,"nome":"USpA","base_value":0.60,"goe":0.04,"score":0.64,"info_flag":""}]}]}',
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const err_text = await resp.text().catch(() => "Unknown error");
      return new Response(JSON.stringify({ error: `Claude API error ${resp.status}: ${err_text}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claude_resp = await resp.json();
    
    if (!claude_resp?.content || !Array.isArray(claude_resp.content) || claude_resp.content.length === 0) {
      return new Response(JSON.stringify({ error: "Claude returned empty content", raw: JSON.stringify(claude_resp).slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let content_text = claude_resp.content[0]?.text || "";
    content_text = content_text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!content_text) {
      return new Response(JSON.stringify({ error: "Claude returned empty text" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(content_text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
