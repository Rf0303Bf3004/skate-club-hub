import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://urbctwvdlovgodjpyiib.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyYmN0d3ZkbG92Z29kanB5aWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzUwMjgsImV4cCI6MjA4ODY1MTAyOH0.Fgc8ZfvMvMhtTtTgTZ8ABHM-iVky3wqTnoTTvESQq8I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const DEMO_CLUB_ID = "00000000-0000-0000-0000-000000000002";

// Oggetto con riferimento mutabile — le funzioni leggono sempre il valore aggiornato
const club_state = {
  current_id: "00000000-0000-0000-0000-000000000002",
};

export function set_current_club_id(id: string) {
  club_state.current_id = id;
}

export function get_current_club_id(): string {
  return club_state.current_id;
}

// Manteniamo CURRENT_CLUB_ID come getter per compatibilità
Object.defineProperty(exports, "CURRENT_CLUB_ID", {
  get: () => club_state.current_id,
});
