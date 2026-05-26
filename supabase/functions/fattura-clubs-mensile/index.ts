// Edge function: genera le fatture mensili B2B per ogni club attivo.
// Pensata per essere chiamata via cron HTTP (es. il 1° del mese alle 03:00 UTC).
// Idempotente: ON CONFLICT (club_id, periodo) DO NOTHING.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function due_date_from(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}

function periodo_corrente(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "missing_env" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let periodo = periodo_corrente();
    let oggi = new Date().toISOString().slice(0, 10);
    try {
      const body = await req.json();
      if (body?.periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.periodo)) periodo = body.periodo;
      if (body?.data_emissione) oggi = body.data_emissione;
    } catch (_) { /* no body */ }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: clubs, error: e_clubs } = await sb
      .from("clubs")
      .select("id, nome, indirizzo, cap, citta, cantone, paese_iso, regione, provincia, partita_iva, numero_iva_chf, iban, prezzo_per_atleta_chf, fee_fissa_chf, mesi_fatturazione_fee, mesi_fatturazione_atleti, mese_inizio_fatturazione, costo_setup_chf, setup_fatturato")
      .eq("attivo", true);
    if (e_clubs) throw e_clubs;

    const scadenza = due_date_from(oggi);
    const risultato: any[] = [];
    const mese_corrente = parseInt(periodo.slice(5, 7), 10);

    const mese_attivo = (mese: number, inizio: number, durata: number): boolean => {
      if (!durata || durata <= 0) return false;
      if (durata >= 12) return true;
      for (let i = 0; i < durata; i++) {
        const m = ((inizio - 1 + i) % 12) + 1;
        if (m === mese) return true;
      }
      return false;
    };

    for (const c of clubs ?? []) {
      const { count, error: e_atl } = await sb
        .from("atleti")
        .select("id", { count: "exact", head: true })
        .eq("club_id", c.id)
        .eq("attivo", true);
      if (e_atl) { risultato.push({ club: c.id, error: e_atl.message }); continue; }

      const n_atleti = count ?? 0;
      const prezzo = Number(c.prezzo_per_atleta_chf ?? 5);
      const fee_fissa_base = Number((c as any).fee_fissa_chf ?? 50);
      const mesi_fee = Number((c as any).mesi_fatturazione_fee ?? 12);
      const mesi_atl = Number((c as any).mesi_fatturazione_atleti ?? 12);
      const mese_inizio = Number((c as any).mese_inizio_fatturazione ?? 1);
      const costo_setup = Number((c as any).costo_setup_chf ?? 0);
      const setup_gia_fatt = Boolean((c as any).setup_fatturato ?? false);

      const fee_fissa = mese_attivo(mese_corrente, mese_inizio, mesi_fee) ? fee_fissa_base : 0;
      const importo_atleti = mese_attivo(mese_corrente, mese_inizio, mesi_atl) ? Number((n_atleti * prezzo).toFixed(2)) : 0;
      const importo_setup = !setup_gia_fatt && costo_setup > 0 ? costo_setup : 0;
      const importo = Number((fee_fissa + importo_atleti + importo_setup).toFixed(2));

      if (importo <= 0) { risultato.push({ club: c.id, skip: "nulla da fatturare" }); continue; }

      const { error: e_ins } = await sb.from("fatture_clubs").upsert(
        {
          club_id: c.id,
          periodo,
          n_atleti,
          prezzo_per_atleta_chf: prezzo,
          fee_fissa_chf: fee_fissa,
          importo_atleti_chf: importo_atleti,
          importo_setup_chf: importo_setup,
          importo_chf: importo,
          stato: "bozza",
          data_emissione: oggi,
          data_scadenza: scadenza,
          intestatario_nome: (c as any).nome ?? null,
          intestatario_indirizzo: (c as any).indirizzo ?? null,
          intestatario_cap: (c as any).cap ?? null,
          intestatario_citta: (c as any).citta ?? null,
          intestatario_cantone: (c as any).cantone ?? null,
          intestatario_paese_iso: (c as any).paese_iso ?? "CH",
          intestatario_regione: (c as any).regione ?? null,
          intestatario_provincia: (c as any).provincia ?? null,
          intestatario_partita_iva: (c as any).partita_iva ?? null,
          intestatario_numero_iva_chf: (c as any).numero_iva_chf ?? null,
          intestatario_iban: (c as any).iban ?? null,
        },
        { onConflict: "club_id,periodo", ignoreDuplicates: true },
      );
      if (e_ins) { risultato.push({ club: c.id, error: e_ins.message }); continue; }

      if (importo_setup > 0) {
        await sb.from("clubs").update({ setup_fatturato: true }).eq("id", c.id);
      }

      // Comunicazione al presidente (best effort).
      await sb.from("comunicazioni").insert({
        club_id: c.id,
        titolo: `Fattura mensile ${periodo}`,
        testo: `Fattura mensile generata: CHF ${importo.toFixed(2)} per ${n_atleti} atleti. Scadenza ${scadenza}.`,
        tipo: "fattura",
        sotto_tipo: "fattura_mensile_club",
        categoria: "ricevuta",
        stato: "sent",
        tipo_destinatari: "staff",
      });

      risultato.push({ club: c.id, n_atleti, importo });
    }

    return new Response(JSON.stringify({ ok: true, periodo, risultato }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
