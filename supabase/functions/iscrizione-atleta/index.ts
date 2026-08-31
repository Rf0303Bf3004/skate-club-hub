// Edge Function: iscrizione-atleta
// Endpoint pubblico (codice-scoped): permette al genitore di completare l'iscrizione
// del proprio atleta senza login. Lookup (precompilazione) + salvataggio dati, flag,
// consensi, accettazione contratto e foto profilo. Scrittura con service role.

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

const CAMPI_TESTO = [
  "nome",
  "cognome",
  "genitore1_nome",
  "genitore1_cognome",
  "genitore1_telefono",
  "genitore1_email",
  "genitore1_indirizzo",
  "genitore1_cap",
  "genitore1_citta",
  "genitore1_cantone",
];

const CATEGORIE_OK = ["pulcini", "amatori", "artistica"];
const LIVELLI_OK = [
  "Pulcini",
  "Stellina 1",
  "Stellina 2",
  "Stellina 3",
  "Stellina 4",
  "Interbronzo",
  "Bronzo",
  "Interargento",
  "Argento",
  "Interoro",
  "Oro",
];

const clean = (v: unknown, max = 255) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
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
    let azione = "lookup";
    let payload: Record<string, unknown> = {};
    let file: File | null = null;

    if (is_form) {
      const form = await req.formData();
      raw = String(form.get("codice_atleta") ?? "").trim();
      azione = String(form.get("azione") ?? "salva");
      const dati = form.get("dati");
      if (typeof dati === "string" && dati) {
        try {
          payload = JSON.parse(dati);
        } catch {
          return json({ error: "dati_non_validi" }, 400);
        }
      }
      const f = form.get("file");
      file = f instanceof File ? f : null;
    } else {
      const body = await req.json().catch(() => ({}));
      raw = String((body as any)?.codice_atleta ?? "").trim();
      azione = String((body as any)?.azione ?? "lookup");
      payload = ((body as any)?.dati ?? {}) as Record<string, unknown>;
    }

    const codice = normalizza_codice(raw);
    if (!codice) return json({ error: "codice_non_trovato" }, 404);

    const { data: atleta, error: atl_err } = await admin
      .from("atleti")
      .select(
        "id, club_id, nome, cognome, data_nascita, foto_url, foto_path, categoria, livello_amatori, livello_artistica, livello_stile, genitore1_nome, genitore1_cognome, genitore1_telefono, genitore1_email, genitore1_indirizzo, genitore1_cap, genitore1_citta, genitore1_cantone, partecipa_gare, intende_test_livello, consenso_foto_video, contratto_accettato_at",
      )
      .eq("codice_atleta", codice)
      .maybeSingle();
    if (atl_err) {
      console.error("[iscrizione-atleta] atl_err", atl_err);
      return json({ error: "db_error" }, 500);
    }
    if (!atleta) return json({ error: "codice_non_trovato" }, 404);

    // Contesto club per il contratto
    const [{ data: club }, { data: setup }, { data: stagione }] = await Promise.all([
      admin.from("clubs").select("nome, citta, cantone, paese").eq("id", atleta.club_id).maybeSingle(),
      admin.from("setup_club").select("clausole_contratto").eq("club_id", atleta.club_id).maybeSingle(),
      admin
        .from("stagioni")
        .select("nome, data_inizio, data_fine")
        .eq("club_id", atleta.club_id)
        .eq("attiva", true)
        .maybeSingle(),
    ]);

    const contesto = {
      club_nome: club?.nome ?? null,
      club_citta: club?.citta ?? null,
      club_cantone: club?.cantone ?? null,
      club_paese: club?.paese ?? null,
      stagione_nome: stagione?.nome ?? null,
      stagione_data_inizio: stagione?.data_inizio ?? null,
      stagione_data_fine: stagione?.data_fine ?? null,
      clausole_contratto: setup?.clausole_contratto ?? null,
    };

    if (azione === "lookup") {
      return json({ ok: true, atleta, contesto });
    }

    if (azione !== "salva") return json({ error: "azione_non_valida" }, 400);

    if (!payload?.contratto_accettato) return json({ error: "contratto_non_accettato" }, 400);

    const update: Record<string, unknown> = {};

    // Nome/cognome/data nascita: modificabili solo se mancanti a DB
    if (!atleta.nome) update.nome = clean(payload.nome, 80);
    if (!atleta.cognome) update.cognome = clean(payload.cognome, 80);
    if (!atleta.data_nascita && payload.data_nascita) {
      const d = String(payload.data_nascita);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: "data_non_valida" }, 400);
      update.data_nascita = d;
    }

    // Livello iniziale: impostabile solo se l'atleta non ha ancora una categoria a DB
    if (!atleta.categoria) {
      const categoria = clean(payload.categoria, 20);
      if (categoria && CATEGORIE_OK.includes(categoria)) {
        update.categoria = categoria;
        const liv_am = clean(payload.livello_amatori, 30);
        if (liv_am && LIVELLI_OK.includes(liv_am)) update.livello_amatori = liv_am;
        const liv_ar = clean(payload.livello_artistica, 30);
        if (liv_ar && LIVELLI_OK.includes(liv_ar)) update.livello_artistica = liv_ar;
      }
    }

    for (const campo of CAMPI_TESTO) {
      if (campo === "nome" || campo === "cognome") continue;
      if (campo in payload) update[campo] = clean(payload[campo], campo === "genitore1_indirizzo" ? 200 : 120);
    }

    update.partecipa_gare = !!payload.partecipa_gare;
    update.intende_test_livello = !!payload.intende_test_livello;
    update.consenso_foto_video = !!payload.consenso_foto_video;
    update.contratto_accettato_at = new Date().toISOString();
    update.attivo = true;

    let foto_path_finale: string | null = (atleta as any).foto_path ?? null;

    if (file) {
      const ext = TIPI_OK[file.type];
      if (!ext) return json({ error: "formato_non_valido" }, 400);
      if (file.size > MAX_BYTES) return json({ error: "file_troppo_grande" }, 400);
      const path = `${atleta.club_id}/${crypto.randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: up_err } = await admin.storage
        .from("foto-atleti")
        .upload(path, bytes, { upsert: true, contentType: file.type });
      if (up_err) {
        console.error("[iscrizione-atleta] up_err", up_err);
        return json({ error: "upload_fallito" }, 500);
      }
      const { data: pub } = admin.storage.from("foto-atleti").getPublicUrl(path);
      update.foto_url = pub.publicUrl;
      update.foto_path = path;
      foto_path_finale = path;
    }

    const { error: upd_err } = await admin.from("atleti").update(update).eq("id", atleta.id);
    if (upd_err) {
      console.error("[iscrizione-atleta] upd_err", upd_err);
      return json({ error: "db_error" }, 500);
    }

    let foto_firmata: string | null = null;
    if (foto_path_finale) {
      const { data: sig } = await admin.storage.from("foto-atleti").createSignedUrl(foto_path_finale, 3600);
      foto_firmata = sig?.signedUrl ?? null;
    }

    return json({ ok: true, foto_url: foto_firmata });
  } catch (e) {
    console.error("[iscrizione-atleta] fatal", e);
    return json({ error: "server_error" }, 500);
  }
});
