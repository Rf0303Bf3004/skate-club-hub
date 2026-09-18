// Edge Function: iscrizione-pubblica
// Porta pubblica per le famiglie nuove: dal token del club (clubs.iscrizioni_token)
// restituisce il contesto del contratto e i livelli dichiarabili ("info"), e riceve
// la domanda di iscrizione ("invia"), che finisce in domande_iscrizione con stato
// 'in_attesa'. Nessun atleta viene creato: nasce solo quando la segreteria approva.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { contratto_completo } from "../_shared/contratto.ts";


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

const clean = (v: unknown, max = 255) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
};

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

const SESSI_OK = ["F", "M"];
const CANTONI_CH = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

const MAX_PER_IP_ORA = 5;

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
    const token = clean((body as any)?.token, 120);
    const azione = String((body as any)?.azione ?? "info");
    const dati = ((body as any)?.dati ?? {}) as Record<string, unknown>;

    if (!token) return json({ error: "token_non_valido" }, 404);

    const { data: club, error: club_err } = await admin
      .from("clubs")
      .select("id, nome, logo_url, citta, cantone, paese")
      .eq("iscrizioni_token", token)
      .maybeSingle();
    if (club_err) {
      console.error("[iscrizione-pubblica] club_err", club_err);
      return json({ error: "db_error" }, 500);
    }
    if (!club) return json({ error: "token_non_valido" }, 404);

    const [{ data: setup }, { data: stagione, error: st_err }] = await Promise.all([
      admin.from("setup_club").select("clausole_contratto").eq("club_id", club.id).maybeSingle(),
      admin
        .from("stagioni")
        .select("id, nome, data_inizio, data_fine, iscrizioni_aperte, iscrizioni_scadenza")
        .eq("club_id", club.id)
        .eq("attiva", true)
        .maybeSingle(),
    ]);
    if (st_err) {
      console.error("[iscrizione-pubblica] st_err", st_err);
      return json({ error: "db_error" }, 500);
    }

    const contesto = {
      club_nome: club.nome ?? null,
      club_citta: club.citta ?? null,
      club_cantone: club.cantone ?? null,
      club_paese: club.paese ?? null,
      stagione_nome: stagione?.nome ?? null,
      stagione_data_inizio: stagione?.data_inizio ?? null,
      stagione_data_fine: stagione?.data_fine ?? null,
      clausole_contratto: setup?.clausole_contratto ?? null,
    };

    const aperte = !!stagione?.iscrizioni_aperte;

    // Il contratto lo costruisce il server: la pagina lo mostra soltanto e al
    // salvataggio rimanda l'impronta ricevuta.
    const contratto = await contratto_completo(contesto);

    if (azione === "info") {
      return json({
        ok: true,
        club: { nome: club.nome, logo_url: club.logo_url ?? null },
        stagione: stagione
          ? {
              nome: stagione.nome,
              iscrizioni_aperte: aperte,
              iscrizioni_scadenza: stagione.iscrizioni_scadenza ?? null,
            }
          : null,
        contesto,
        contratto: { articoli: contratto.articoli, impronta: contratto.impronta },
        livelli: LIVELLI_OK,
      });
    }


    if (azione !== "invia") return json({ error: "azione_non_valida" }, 400);
    if (!stagione?.id || !aperte) return json({ error: "iscrizioni_chiuse" }, 400);

    const ip =
      (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "sconosciuto";

    const da = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count, error: cnt_err } = await admin
      .from("domande_iscrizione")
      .select("id", { count: "exact", head: true })
      .eq("origine", ip)
      .gte("created_at", da);
    if (cnt_err) {
      console.error("[iscrizione-pubblica] cnt_err", cnt_err);
      return json({ error: "db_error" }, 500);
    }
    if ((count ?? 0) >= MAX_PER_IP_ORA) return json({ error: "troppe_richieste" }, 429);

    const nome = clean(dati.nome, 80);
    const cognome = clean(dati.cognome, 80);
    const data_nascita = clean(dati.data_nascita, 10);
    const gen_nome = clean(dati.genitore1_nome, 80);
    const gen_cognome = clean(dati.genitore1_cognome, 80);
    const gen_email = clean(dati.genitore1_email, 120);
    const contratto_testo = clean(dati.contratto_testo, 60000);

    if (!nome || !cognome) return json({ error: "atleta_incompleto" }, 400);
    if (!data_nascita || !/^\d{4}-\d{2}-\d{2}$/.test(data_nascita)) return json({ error: "data_non_valida" }, 400);
    if (!gen_nome || !gen_cognome) return json({ error: "genitore_incompleto" }, 400);
    if (!gen_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gen_email)) return json({ error: "email_non_valida" }, 400);
    if (!dati.contratto_accettato || !contratto_testo) return json({ error: "contratto_non_accettato" }, 400);

    const sesso = clean(dati.sesso, 1);
    const cantone = clean(dati.genitore1_cantone, 2);
    const livello = clean(dati.livello_dichiarato, 30);

    const { error: ins_err } = await admin.from("domande_iscrizione").insert({
      club_id: club.id,
      stagione_id: stagione.id,
      nome,
      cognome,
      data_nascita,
      sesso: sesso && SESSI_OK.includes(sesso) ? sesso : null,
      genitore1_nome: gen_nome,
      genitore1_cognome: gen_cognome,
      genitore1_email: gen_email,
      genitore1_telefono: clean(dati.genitore1_telefono, 40),
      genitore1_indirizzo: clean(dati.genitore1_indirizzo, 200),
      genitore1_cap: clean(dati.genitore1_cap, 10),
      genitore1_citta: clean(dati.genitore1_citta, 120),
      genitore1_cantone: cantone && CANTONI_CH.includes(cantone) ? cantone : null,
      livello_dichiarato: livello && LIVELLI_OK.includes(livello) ? livello : null,
      esperienza: clean(dati.esperienza, 2000),
      note_famiglia: clean(dati.note_famiglia, 2000),
      consenso_foto_video: !!dati.consenso_foto_video,
      partecipa_gare: !!dati.partecipa_gare,
      intende_test_livello: !!dati.intende_test_livello,
      contratto_accettato_at: new Date().toISOString(),
      contratto_testo,
      stato: "in_attesa",
      origine: ip,
    });
    if (ins_err) {
      console.error("[iscrizione-pubblica] ins_err", ins_err);
      return json({ error: "db_error" }, 500);
    }

    return json({ ok: true, nome, email: gen_email });
  } catch (e) {
    console.error("[iscrizione-pubblica] fatal", e);
    return json({ error: "server_error" }, 500);
  }
});
