// Edge Function: fatture-invio-automatico
// Manda le fatture alle famiglie senza che nessuno prema Invia.
// Gira ogni ora: di notte non c'è nessun browser aperto, quindi tutto il lavoro
// (PDF, congelamento, email) deve avvenire qui.
//
// Chi può chiamarla: un'altra funzione server con la chiave di servizio, oppure
// il database con un gettone usa e getta di scopo "fatture-invio-automatico".
//
// Regole volute, non accidentali:
//  - si toccano solo le fatture in bozza, mai inviate, di tipo fattura
//  - importo zero o negativo: si salta
//  - nessun indirizzo della famiglia: si salta
//  - dati di pagamento incompleti (polizza QR in errore): si salta, perché una
//    fattura svizzera senza polizza valida non è pagabile
//  - "prova": fa tutti i controlli e NON manda niente, così si può vedere
//    esattamente cosa farebbe prima di lasciarla andare sul serio

import { createClient } from "@supabase/supabase-js";

const BUDGET_MS = 100_000;   // si ferma prima che la funzione venga interrotta
const MAX_PER_GIRO = 200;    // un errore non può svuotare la rubrica di un club
const MAX_DETTAGLIO = 100;   // il dettaglio salvato non deve diventare enorme

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok");

  const inizio = Date.now();

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth_header = req.headers.get("Authorization") ?? "";
    const token = auth_header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(url, service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const prova = (body as any)?.prova === true;
    const solo_club = String((body as any)?.club_id ?? "").trim() || null;

    // --- chi chiama ---
    let interna = token === service_key;
    const gettone = String((body as any)?.token_interno ?? "").trim();
    if (!interna && gettone) {
      const { data: valido, error: g_err } = await supabase.rpc("consuma_token_interno", {
        p_token: gettone,
        p_scopo: "fatture-invio-automatico",
      });
      if (g_err) return json({ error: "gettone_non_verificabile", dettaglio: g_err.message }, 500);
      if (valido !== true) return json({ error: "gettone_non_valido" }, 401);
      interna = true;
    }
    if (!interna) return json({ error: "forbidden" }, 403);

    // --- club che hanno acceso l'interruttore ---
    let q = supabase.from("setup_club").select("club_id").eq("fatturazione_invio_email_auto", true);
    if (solo_club) q = q.eq("club_id", solo_club);
    const { data: setups, error: s_err } = await q;
    if (s_err) return json({ error: "lettura_setup_fallita", dettaglio: s_err.message }, 500);

    const oggi = new Date().toISOString().slice(0, 10);
    const riepilogo: any[] = [];

    for (const s of setups ?? []) {
      const club_id = (s as any).club_id as string;
      if (Date.now() - inizio > BUDGET_MS) break;

      const { data: esec } = await supabase
        .from("esecuzioni_automatismi")
        .insert({ automatismo: prova ? "fatture-invio-automatico (prova)" : "fatture-invio-automatico", club_id })
        .select("id")
        .single();
      const esecuzione_id = (esec as any)?.id ?? null;

      let esaminate = 0, riuscite = 0, fallite = 0, saltate = 0;
      const dettaglio: any[] = [];
      let interrotta_per_tempo = false;

      const annota = (voce: any) => {
        if (dettaglio.length < MAX_DETTAGLIO) dettaglio.push(voce);
      };

      const { data: fatture, error: f_err } = await supabase
        .from("fatture")
        .select("id, numero, importo, intestatario_email, atleta_id, data_emissione")
        .eq("club_id", club_id)
        .eq("stato", "bozza")
        .eq("tipo_documento", "fattura")
        .is("email_inviata_at", null)
        .lte("data_emissione", oggi)
        .order("data_emissione", { ascending: true })
        .limit(MAX_PER_GIRO);

      if (f_err) {
        await supabase.from("esecuzioni_automatismi").update({
          finita_il: new Date().toISOString(),
          errore: `Lettura fatture fallita: ${f_err.message}`,
        }).eq("id", esecuzione_id);
        riepilogo.push({ club_id, errore: f_err.message });
        continue;
      }

      for (const f of fatture ?? []) {
        if (Date.now() - inizio > BUDGET_MS) { interrotta_per_tempo = true; break; }
        esaminate += 1;
        const etichetta = (f as any).numero ?? String((f as any).id).slice(0, 8);

        const importo = Number((f as any).importo ?? 0);
        if (!(importo > 0)) {
          saltate += 1;
          annota({ fattura: etichetta, esito: "saltata", motivo: "importo non positivo" });
          continue;
        }

        // destinatario: gli stessi indirizzi ammessi dalla funzione di invio
        let destinatario = String((f as any).intestatario_email ?? "").trim().toLowerCase();
        if (!destinatario && (f as any).atleta_id) {
          const { data: a } = await supabase
            .from("atleti")
            .select("genitore1_email, genitore2_email")
            .eq("id", (f as any).atleta_id)
            .maybeSingle();
          destinatario = String((a as any)?.genitore1_email ?? (a as any)?.genitore2_email ?? "").trim().toLowerCase();
        }
        if (!destinatario) {
          saltate += 1;
          annota({ fattura: etichetta, esito: "saltata", motivo: "nessun indirizzo della famiglia" });
          continue;
        }

        // una fattura svizzera senza polizza valida non è pagabile: non si manda
        const { data: q_qr, error: qr_err } = await supabase.rpc("swiss_qr_payload", { p_fattura: (f as any).id });
        const r_qr = Array.isArray(q_qr) ? q_qr[0] : q_qr;
        if (qr_err || !r_qr || (r_qr as any).errori) {
          saltate += 1;
          annota({
            fattura: etichetta,
            esito: "saltata",
            motivo: `dati di pagamento incompleti: ${qr_err?.message ?? (r_qr as any)?.errori ?? "polizza non disponibile"}`,
          });
          continue;
        }

        if (prova) {
          riuscite += 1;
          annota({ fattura: etichetta, esito: "sarebbe stata inviata", destinatario });
          continue;
        }

        const invio = await fetch(`${url}/functions/v1/send-fattura-email-atleta`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${service_key}` },
          body: JSON.stringify({ fattura_id: (f as any).id, destinatario }),
        });
        const esito = await invio.json().catch(() => ({}));
        if (invio.ok && (esito as any)?.ok) {
          riuscite += 1;
          annota({ fattura: etichetta, esito: "inviata", destinatario });
        } else {
          fallite += 1;
          annota({
            fattura: etichetta,
            esito: "fallita",
            motivo: (esito as any)?.messaggio ?? (esito as any)?.error ?? `HTTP ${invio.status}`,
          });
        }
      }

      await supabase.from("esecuzioni_automatismi").update({
        finita_il: new Date().toISOString(),
        esaminate, riuscite, fallite, saltate,
        dettaglio: { prova, interrotta_per_tempo, voci: dettaglio },
      }).eq("id", esecuzione_id);

      riepilogo.push({ club_id, esaminate, riuscite, fallite, saltate, interrotta_per_tempo });
    }

    return json({ ok: true, prova, club: riepilogo, durata_ms: Date.now() - inizio });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
