import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => null);
    const raw_messages = payload?.messages;
    if (!Array.isArray(raw_messages) || raw_messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages[] richiesto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: ExpoMessage[] = raw_messages
      .filter((m: any) => m && typeof m.to === "string" && m.to.length > 0)
      .map((m: any) => ({
        to: m.to,
        title: String(m.title ?? ""),
        body: String(m.body ?? ""),
        data: typeof m.data === "object" && m.data !== null ? m.data : undefined,
        sound: "default",
      })) as ExpoMessage[];

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "nessun token valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tickets: any[] = [];
    // Expo accetta max 100 messaggi per richiesta
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(EXPO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => ({}));
      const data = Array.isArray(json?.data) ? json.data : [];
      tickets.push(...data);

      // Pulizia token non più registrati
      const invalid: string[] = [];
      data.forEach((ticket: any, idx: number) => {
        if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
          const tok = ticket?.details?.expoPushToken ?? chunk[idx]?.to;
          if (tok) invalid.push(tok);
        }
      });
      if (invalid.length > 0) {
        await supabase.from("device_tokens").update({ attivo: false }).in("token", invalid);
      }
    }

    return new Response(JSON.stringify({ ok: true, inviati: messages.length, tickets }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-expo-push error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
