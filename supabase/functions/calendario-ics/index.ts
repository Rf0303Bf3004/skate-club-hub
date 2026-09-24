// Edge Function: calendario-ics
// GET /functions/v1/calendario-ics?codice=AT-XXXX-XXXX
//
// Consegna il calendario iCalendar dell'atleta già composto dal database
// (calendario_ics_atleta). Nessuna generazione qui.
// In caso di errore NON si restituisce mai un calendario vuoto: il programma
// del genitore cancellerebbe gli appuntamenti già presenti.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function testo(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function formatta_codice(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 10 || !c.startsWith("AT")) return null;
  return `AT-${c.slice(2, 6)}-${c.slice(6, 10)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") return testo("Method not allowed", 405);

  const url = new URL(req.url);
  const grezzo = (url.searchParams.get("codice") ?? "").replace(/\.ics$/i, "");
  const codice = formatta_codice(grezzo);
  if (!codice) return testo("Not found", 404);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("calendario_ics_atleta", { p_codice: codice });
  if (error) {
    if (error.code === "P0002") return testo("Not found", 404);
    if (error.code === "53400") return testo("Too many requests", 429);
    console.error("calendario_ics_atleta failed", error.code, error.message);
    return testo("Calendar unavailable", 503);
  }
  if (typeof data !== "string" || !data.startsWith("BEGIN:VCALENDAR")) {
    console.error("calendario_ics_atleta: risposta inattesa");
    return testo("Calendar unavailable", 503);
  }

  return new Response(req.method === "HEAD" ? null : data, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="calendario.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
});
