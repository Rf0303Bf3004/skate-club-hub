import { createClient } from "@supabase/supabase-js";

// Backend di Lovable Cloud (project ref: mdlfhdyyzrxppamlzepd) — unico database
// reale del progetto. Tutti i moduli devono importare da `@/lib/supabase`.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://mdlfhdyyzrxppamlzepd.supabase.co";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbGZoZHl5enJ4cHBhbWx6ZXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTY1MTMsImV4cCI6MjA5MDI3MjUxM30.0zNGzy8aPM0rD1qLfWSOchKU0w8RxozS0sBS-zknxoc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Club di default: "Stella del Ghiaccio ASD" (unico club seed presente nel DB).
const DEFAULT_CLUB_ID = "00030001-0000-0000-0000-000000000001";

export const DEMO_CLUB_ID = "00000000-0000-0000-0000-000000000002";

const club_state = {
  current_id: DEFAULT_CLUB_ID,
};

export function set_current_club_id(id: string) {
  club_state.current_id = id;
}

export function get_current_club_id(): string {
  return club_state.current_id;
}

export const CURRENT_CLUB_ID = club_state.current_id;
