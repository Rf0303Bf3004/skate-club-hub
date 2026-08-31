// Edge Function: upload-foto-atleta
// Endpoint pubblico (codice-scoped): permette al genitore di caricare SOLO la foto
// profilo del proprio atleta, senza login. Scrittura su storage/DB con service role.

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

function normalizza_codice(raw: string): string | null {
  const pulito = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (pulito.length !== 10 || !pulito.startsWith("AT")) return null;
  return `AT-${pulito.slice(2, 6)}-${pulito.slice(6, 10)}`;
}

const MAX_BYTES = 2 * 1024 * 1024;
const TIPI_OK: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const content_type = req.headers.get("content-type") ?? "";
    const is_form = content_type.includes("multipart/form-data");

    let raw = "";
    let file: File | null = null;

    if (is_form) {
      const form = await req.formData();
      raw = String(form.get("codice_atleta") ?? "").trim();
      const f = form.get("file");
      file = f instanceof File ? f : null;
    } else {
      const body = await req.json().catch(() => ({}));
      raw = String(body?.codice_atleta ?? "").trim();
    }

    const codice = normalizza_codice(raw);
    if (!codice) return json({ error: "codice_non_trovato" }, 404);

    const { data: atleta, error: atl_err } = await admin
      .from("atleti")
      .select("id, nome, cognome, club_id, attivo, foto_url, foto_path")
      .eq("codice_atleta", codice)
      .maybeSingle();
    if (atl_err) {
      console.error("[upload-foto-atleta] atl_err", atl_err);
      return json({ error: "db_error" }, 500);
    }
    if (!atleta) return json({ error: "codice_non_trovato" }, 404);


    // Firma al volo il percorso della foto (mai l'URL pubblico grezzo)
    const firma = async (p: string | null) => {
      if (!p) return null;
      const { data } = await admin.storage.from("foto-atleti").createSignedUrl(p, 3600);
      return data?.signedUrl ?? null;
    };

    // Lookup (nessun file): restituisce i dati per la conferma visiva
    if (!file) {
      return json({
        ok: true,
        atleta: {
          nome: atleta.nome,
          cognome: atleta.cognome,
          foto_url: await firma((atleta as any).foto_path ?? null),
        },
      });
    }

    const ext = TIPI_OK[file.type];
    if (!ext) return json({ error: "formato_non_valido" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "file_troppo_grande" }, 400);

    const path = `${atleta.club_id}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: up_err } = await admin.storage
      .from("foto-atleti")
      .upload(path, bytes, { upsert: true, contentType: file.type });
    if (up_err) {
      console.error("[upload-foto-atleta] up_err", up_err);
      return json({ error: "upload_fallito" }, 500);
    }

    const { data: pub } = admin.storage.from("foto-atleti").getPublicUrl(path);
    const foto_url = pub.publicUrl;

    const { error: upd_err } = await admin
      .from("atleti")
      .update({ foto_url, foto_path: path })
      .eq("id", atleta.id);
    if (upd_err) {
      console.error("[upload-foto-atleta] upd_err", upd_err);
      return json({ error: "db_error" }, 500);
    }

    return json({ ok: true, foto_url: await firma(path) });
  } catch (e) {
    console.error("[upload-foto-atleta] fatal", e);
    return json({ error: "server_error" }, 500);
  }
});
