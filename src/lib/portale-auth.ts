// Helper di autenticazione per il Portale Web Atleta.
// Riusa la edge function `mobile-auth-login` per scambiare un codice atleta
// (formato AT-XXXX-XXXX) con una sessione Supabase salvata in localStorage.

import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "portale_atleta_session";

export interface PortaleSession {
  access_token: string;
  refresh_token: string;
  atleta: {
    id: string;
    nome: string;
    cognome: string;
    club_id: string;
    codice_atleta: string;
  };
  club: { id: string; nome: string } | null;
}

export function normalize_codice(raw: string): string {
  const compact = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length !== 10 || !compact.startsWith("AT")) return raw.toUpperCase();
  return `AT-${compact.slice(2, 6)}-${compact.slice(6, 10)}`;
}

export function get_portale_session(): PortaleSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PortaleSession) : null;
  } catch {
    return null;
  }
}

export async function portale_login(codice_raw: string): Promise<PortaleSession> {
  const codice = normalize_codice(codice_raw);
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-auth-login`;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ token: codice }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data?.error === "invalid_codice") throw new Error("Codice atleta non valido o non trovato");
    throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  }

  const session: PortaleSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    atleta: data.atleta,
    club: data.club ?? null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return session;
}

export async function portale_restore_session(): Promise<PortaleSession | null> {
  const stored = get_portale_session();
  if (!stored) return null;
  try {
    await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    return stored;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function portale_logout(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}
