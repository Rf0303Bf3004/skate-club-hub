import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase_url = Deno.env.get("SUPABASE_URL")!;
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabase_url, service_key);

    // 1) carica template di sistema
    const { data: template, error: tpl_err } = await supabase
      .from("comunicazioni_template")
      .select("*")
      .eq("nome", "Auguri di Compleanno")
      .is("club_id", null)
      .maybeSingle();

    if (tpl_err) throw tpl_err;
    if (!template) {
      return new Response(
        JSON.stringify({ error: "Template 'Auguri di Compleanno' non trovato" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) trova atleti attivi che compiono oggi (MM-DD)
    const oggi = new Date();
    const mm = String(oggi.getMonth() + 1).padStart(2, "0");
    const dd = String(oggi.getDate()).padStart(2, "0");
    const oggi_mmdd = `${mm}-${dd}`;
    const oggi_anno = oggi.getFullYear();

    const { data: atleti, error: atl_err } = await supabase
      .from("atleti")
      .select("id, nome, cognome, data_nascita, club_id, attivo")
      .eq("attivo", true)
      .not("data_nascita", "is", null);

    if (atl_err) throw atl_err;

    const titolo_tpl: string = (template as any).titolo ?? `🎉 Tanti auguri {nome_atleta}!`;
    const testo_tpl: string = (template as any).testo ?? "";
    const canali = (template as any).canali ?? null;

    let created = 0;
    const checked = atleti?.length ?? 0;
    const errors: string[] = [];

    for (const a of atleti ?? []) {
      if (!a.data_nascita) continue;
      const dn = String(a.data_nascita); // YYYY-MM-DD
      const dn_mmdd = dn.slice(5, 10);
      if (dn_mmdd !== oggi_mmdd) continue;

      const anno_nascita = parseInt(dn.slice(0, 4), 10);
      const eta = oggi_anno - anno_nascita;

      const replace_all = (s: string) =>
        s.replaceAll("{nome_atleta}", a.nome ?? "")
         .replaceAll("{eta}", String(eta));

      const payload: Record<string, unknown> = {
        club_id: a.club_id,
        titolo: replace_all(titolo_tpl),
        testo: replace_all(testo_tpl),
        tipo: "auguri_compleanno",
        atleta_id: a.id,
        tipo_destinatari: "per_atleta",
        stato: "pending",
        programmata_per: new Date().toISOString(),
      };
      if (canali !== null && canali !== undefined) payload.canali = canali;
      if ((template as any).id) payload.template_id = (template as any).id;

      const { error: ins_err } = await supabase.from("comunicazioni").insert(payload);
      if (ins_err) {
        // ritenta senza colonne opzionali se mancano nello schema
        if (ins_err.message?.includes("column")) {
          delete payload.canali;
          delete payload.template_id;
          const { error: retry_err } = await supabase.from("comunicazioni").insert(payload);
          if (retry_err) {
            errors.push(`${a.id}: ${retry_err.message}`);
            continue;
          }
        } else {
          errors.push(`${a.id}: ${ins_err.message}`);
          continue;
        }
      }
      created++;
    }

    return new Response(
      JSON.stringify({ created, checked, errors: errors.length ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("birthday-greetings error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
