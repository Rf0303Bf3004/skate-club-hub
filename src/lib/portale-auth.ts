// Helper di autenticazione per il Portale Web Atleta.
// Riusa la edge function `mobile-auth-login` per scambiare un codice atleta
// (formato AT-XXXX-XXXX) con una sessione Supabase.
// Supporta più profili collegati sullo stesso dispositivo (genitore con più figli).

import { supabase } from "@/lib/supabase";

const LEGACY_KEY = "portale_atleta_session";
const PROFILI_KEY = "portale_profili_collegati";
const ATTIVO_KEY = "portale_atleta_attivo_id";

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

function read_profili(): PortaleSession[] {
  try {
    const raw = localStorage.getItem(PROFILI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PortaleSession[]) : [];
    }
    // Migrazione dalla vecchia sessione singola
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as PortaleSession;
      if (s?.atleta?.id) {
        localStorage.setItem(PROFILI_KEY, JSON.stringify([s]));
        localStorage.setItem(ATTIVO_KEY, s.atleta.id);
        localStorage.removeItem(LEGACY_KEY);
        return [s];
      }
    }
    return [];
  } catch {
    return [];
  }
}

function write_profili(lista: PortaleSession[]) {
  localStorage.setItem(PROFILI_KEY, JSON.stringify(lista));
}

export function portale_get_profili_collegati(): PortaleSession[] {
  return read_profili();
}

export function portale_get_atleta_attivo_id(): string | null {
  return localStorage.getItem(ATTIVO_KEY);
}

export function get_portale_session(): PortaleSession | null {
  const lista = read_profili();
  if (lista.length === 0) return null;
  const attivo_id = portale_get_atleta_attivo_id();
  return lista.find((p) => p.atleta.id === attivo_id) ?? lista[0];
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

  const lista = read_profili().filter((p) => p.atleta.id !== session.atleta.id);
  lista.push(session);
  write_profili(lista);
  localStorage.setItem(ATTIVO_KEY, session.atleta.id);

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return session;
}

export async function portale_switch_profilo(atleta_id: string): Promise<PortaleSession | null> {
  const lista = read_profili();
  const target = lista.find((p) => p.atleta.id === atleta_id);
  if (!target) return null;
  const { error } = await supabase.auth.setSession({
    access_token: target.access_token,
    refresh_token: target.refresh_token,
  });
  if (error) throw new Error("Sessione scaduta per questo profilo, reinserisci il codice atleta");
  localStorage.setItem(ATTIVO_KEY, target.atleta.id);
  return target;
}

export async function portale_remove_profilo(atleta_id: string): Promise<PortaleSession | null> {
  const lista = read_profili().filter((p) => p.atleta.id !== atleta_id);
  write_profili(lista);
  if (lista.length === 0) {
    await portale_logout();
    return null;
  }
  if (portale_get_atleta_attivo_id() === atleta_id) {
    return await portale_switch_profilo(lista[0].atleta.id);
  }
  return get_portale_session();
}

export async function portale_restore_session(): Promise<PortaleSession | null> {
  const stored = get_portale_session();
  if (!stored) return null;
  try {
    const { error } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (error) throw error;
    localStorage.setItem(ATTIVO_KEY, stored.atleta.id);
    return stored;
  } catch {
    return null;
  }
}

export async function portale_logout(): Promise<void> {
  localStorage.removeItem(PROFILI_KEY);
  localStorage.removeItem(ATTIVO_KEY);
  localStorage.removeItem(LEGACY_KEY);
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}
