// Edge Function: invia-email-iscrizioni
// Le tre email della campagna iscrizioni: invito al rinnovo, benvenuto dopo
// l'approvazione di una domanda nuova, rifiuto di una domanda.
// I destinatari dei rinnovi arrivano SEMPRE da email_comunicazioni_atleta(),
// che rispetta già la scelta sui genitori separati. Per le domande nuove si usa
// l'indirizzo scritto sulla domanda.
// Chi non ha nessun indirizzo non viene nascosto: viene contato e riportato.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function cors(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ??
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

const RUOLI_AMMESSI = ["superadmin", "admin", "presidente", "vicepresidente", "dt", "segreteria"];
const BASE_APP = "https://app.icearena.ch";

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  const corsHeaders = cors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon_key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Identità: solo staff del club.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "unauthorized" }, 401);
    const user_client = createClient(url, anon_key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: u_err } = await user_client.auth.getUser();
    if (u_err || !user) return json({ error: "unauthorized" }, 401);
    const { data: caller, error: c_err } = await admin
      .from("utenti_club")
      .select("ruolo, club_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (c_err) return json({ error: "lookup_failed", dettaglio: c_err.message }, 500);
    if (!caller || !RUOLI_AMMESSI.includes(String(caller.ruolo))) return json({ error: "forbidden" }, 403);
    const club_id = String(caller.club_id ?? "");
    if (!club_id) return json({ error: "club_mancante" }, 400);

    const body = await req.json().catch(() => ({}));
    const tipo = String((body as any)?.tipo ?? "");
    if (!["invito_rinnovo", "benvenuto", "domanda_rifiutata"].includes(tipo)) {
      return json({ error: "tipo_non_valido" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
      return json({
        error: "provider_email_non_configurato",
        messaggio: "L'invio delle email non è configurato: nessun messaggio è stato spedito.",
      }, 503);
    }

    const { data: club, error: cl_err } = await admin
      .from("clubs")
      .select("id, nome")
      .eq("id", club_id)
      .maybeSingle();
    if (cl_err) return json({ error: "lookup_failed", dettaglio: cl_err.message }, 500);
    const club_nome = club?.nome ?? "Il tuo club";

    const spedisci = async (destinatari: string[], oggetto: string, html: string) => {
      const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: `${club_nome} <iscrizioni@send.icearena.ch>`,
          to: destinatari,
          subject: oggetto,
          html,
        }),
      });
      if (!resp.ok) {
        const testo = await resp.text();
        throw new Error(`[${resp.status}] ${testo}`);
      }
    };

    const registra = async (payload: Record<string, unknown>) => {
      const { error } = await admin.from("comunicazioni").insert({
        club_id,
        tipo_destinatari: "per_atleta",
        stato: "inviata",
        categoria: "inviata",
        inviata_at: new Date().toISOString(),
        ...payload,
      });
      if (error) console.error("[invia-email-iscrizioni] registro comunicazione", error);
      return !error;
    };

    // ── Invito al rinnovo ────────────────────────────────────────────────
    if (tipo === "invito_rinnovo") {
      const stagione_id = String((body as any)?.stagione_id ?? "");
      if (!stagione_id) return json({ error: "stagione_mancante" }, 400);

      const { data: stagione, error: st_err } = await admin
        .from("stagioni")
        .select("id, nome, iscrizioni_scadenza")
        .eq("id", stagione_id)
        .eq("club_id", club_id)
        .maybeSingle();
      if (st_err) return json({ error: "lookup_failed", dettaglio: st_err.message }, 500);
      if (!stagione) return json({ error: "stagione_non_trovata" }, 404);

      const ids_richiesti: string[] = Array.isArray((body as any)?.atleta_ids)
        ? (body as any).atleta_ids.map((x: unknown) => String(x))
        : [];

      let q = admin
        .from("atleti_storici_stagioni")
        .select("atleta_id, atleti(id, nome, cognome, codice_atleta)")
        .eq("club_id", club_id)
        .eq("stagione_id", stagione_id)
        .eq("status", "invitato");
      if (ids_richiesti.length > 0) q = q.in("atleta_id", ids_richiesti);
      const { data: righe, error: r_err } = await q;
      if (r_err) return json({ error: "lookup_failed", dettaglio: r_err.message }, 500);

      let inviati = 0;
      let senza_email = 0;
      let senza_codice = 0;
      const falliti: { atleta: string; motivo: string }[] = [];

      for (const riga of righe ?? []) {
        const a = (riga as any).atleti;
        if (!a) continue;
        const nome_completo = `${a.nome ?? ""} ${a.cognome ?? ""}`.trim();
        if (!a.codice_atleta) {
          senza_codice++;
          continue;
        }
        const { data: emails, error: e_err } = await admin.rpc("email_comunicazioni_atleta", {
          p_atleta: a.id,
        });
        if (e_err) {
          falliti.push({ atleta: nome_completo, motivo: e_err.message });
          continue;
        }
        const destinatari = ((emails ?? []) as string[]).filter((x) => !!x && x.includes("@"));
        if (destinatari.length === 0) {
          senza_email++;
          continue;
        }

        const link = `${BASE_APP}/iscrizione/${a.codice_atleta}`;
        const scadenza = stagione.iscrizioni_scadenza
          ? `<p><strong>Conferma entro il ${esc(String(stagione.iscrizioni_scadenza))}.</strong></p>`
          : "";
        const oggetto = `Rinnovo iscrizione ${nome_completo} — ${club_nome}`;
        const html = `<div style="font-family:sans-serif;color:#0f172a">
          <h2>Rinnovo iscrizione ${esc(stagione.nome ?? "")}</h2>
          <p>Le iscrizioni alla stagione ${esc(stagione.nome ?? "")} di ${esc(club_nome)} sono aperte.</p>
          <p>Dalla pagina qui sotto puoi confermare l'iscrizione di <strong>${esc(nome_completo)}</strong>, controllare i dati e scegliere i corsi.</p>
          ${scadenza}
          <p><a href="${link}" style="display:inline-block;background:#0284c7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Conferma l'iscrizione</a></p>
          <p style="font-size:12px;color:#64748b">${link}</p>
        </div>`;

        try {
          await spedisci(destinatari, oggetto, html);
        } catch (err) {
          falliti.push({ atleta: nome_completo, motivo: (err as Error).message });
          continue;
        }
        inviati++;
        await registra({
          titolo: oggetto,
          testo: `Invito al rinnovo per la stagione ${stagione.nome ?? ""}. Inviato a: ${destinatari.join(", ")}`,
          tipo: "invito_rinnovo",
          atleta_id: a.id,
        });
      }

      return json({ ok: true, inviati, senza_email, senza_codice, falliti });
    }

    // ── Benvenuto dopo l'approvazione ────────────────────────────────────
    if (tipo === "benvenuto") {
      const atleta_id = String((body as any)?.atleta_id ?? "");
      if (!atleta_id) return json({ error: "atleta_mancante" }, 400);

      const { data: a, error: a_err } = await admin
        .from("atleti")
        .select("id, nome, cognome, codice_atleta, club_id")
        .eq("id", atleta_id)
        .eq("club_id", club_id)
        .maybeSingle();
      if (a_err) return json({ error: "lookup_failed", dettaglio: a_err.message }, 500);
      if (!a) return json({ error: "atleta_non_trovato" }, 404);

      const { data: emails, error: e_err } = await admin.rpc("email_comunicazioni_atleta", {
        p_atleta: a.id,
      });
      if (e_err) return json({ error: "lookup_failed", dettaglio: e_err.message }, 500);
      let destinatari = ((emails ?? []) as string[]).filter((x) => !!x && x.includes("@"));
      const email_domanda = String((body as any)?.email_famiglia ?? "").trim();
      if (destinatari.length === 0 && email_domanda.includes("@")) destinatari = [email_domanda];
      if (destinatari.length === 0) return json({ ok: false, senza_email: 1, inviati: 0 });

      const livello = String((body as any)?.livello ?? "").trim();
      const nome_completo = `${a.nome ?? ""} ${a.cognome ?? ""}`.trim();
      const oggetto = `Iscrizione confermata — ${club_nome}`;
      const html = `<div style="font-family:sans-serif;color:#0f172a">
        <h2>Benvenuta in ${esc(club_nome)}</h2>
        <p>L'iscrizione di <strong>${esc(nome_completo)}</strong> è confermata.</p>
        ${livello ? `<p>Livello assegnato: <strong>${esc(livello)}</strong></p>` : ""}
        <p>Codice di accesso: <strong style="font-family:monospace;font-size:18px;letter-spacing:2px">${esc(a.codice_atleta ?? "")}</strong></p>
        <p>Con questo codice si entra nel portale delle famiglie su <a href="${BASE_APP}">${BASE_APP}</a> e si accede all'app del club, dove trovi calendario, comunicazioni e fatture.</p>
      </div>`;

      try {
        await spedisci(destinatari, oggetto, html);
      } catch (err) {
        return json({ error: "invio_fallito", dettaglio: (err as Error).message }, 502);
      }
      await registra({
        titolo: oggetto,
        testo: `Benvenuto e codice di accesso. Inviato a: ${destinatari.join(", ")}`,
        tipo: "benvenuto_iscrizione",
        atleta_id: a.id,
      });
      return json({ ok: true, inviati: 1, senza_email: 0 });
    }

    // ── Domanda rifiutata ────────────────────────────────────────────────
    const domanda_id = String((body as any)?.domanda_id ?? "");
    if (!domanda_id) return json({ error: "domanda_mancante" }, 400);
    const { data: d, error: d_err } = await admin
      .from("domande_iscrizione")
      .select("id, nome, cognome, genitore1_email, note_risposta, club_id")
      .eq("id", domanda_id)
      .eq("club_id", club_id)
      .maybeSingle();
    if (d_err) return json({ error: "lookup_failed", dettaglio: d_err.message }, 500);
    if (!d) return json({ error: "domanda_non_trovata" }, 404);
    const destinatario = String(d.genitore1_email ?? "").trim();
    if (!destinatario.includes("@")) return json({ ok: false, senza_email: 1, inviati: 0 });

    const nota = String((body as any)?.note ?? d.note_risposta ?? "").trim();
    const oggetto = `La tua richiesta a ${club_nome}`;
    const html = `<div style="font-family:sans-serif;color:#0f172a">
      <p>Buongiorno,</p>
      <p>abbiamo esaminato la richiesta di iscrizione di <strong>${esc(`${d.nome ?? ""} ${d.cognome ?? ""}`.trim())}</strong> e non possiamo accoglierla.</p>
      ${nota ? `<p>${esc(nota)}</p>` : ""}
      <p>Grazie per l'interesse verso ${esc(club_nome)}.</p>
    </div>`;
    try {
      await spedisci([destinatario], oggetto, html);
    } catch (err) {
      return json({ error: "invio_fallito", dettaglio: (err as Error).message }, 502);
    }
    await registra({
      titolo: oggetto,
      testo: `Risposta a una domanda di iscrizione. Inviata a: ${destinatario}`,
      tipo: "domanda_rifiutata",
      tipo_destinatari: "singolo",
    });
    return json({ ok: true, inviati: 1, senza_email: 0 });
  } catch (e) {
    console.error("[invia-email-iscrizioni] fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});
