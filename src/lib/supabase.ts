// Backend di Lovable Cloud — unico database reale del progetto.
// Tutti i moduli devono importare da `@/lib/supabase`, che riespone l'unica
// istanza client (con storage brokerato per la preview) per evitare due
// istanze auth concorrenti (refresh token race / sessione persa al reload).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as supabase_client } from "@/integrations/supabase/client";

export const supabase = supabase_client as unknown as SupabaseClient;



export const DEMO_CLUB_ID = "00000000-0000-0000-0000-000000000002";

// Il club corrente viene impostato da auth dopo il login. Resta "" finché
// auth.uid() non è disponibile: gli hook con `enabled: !!get_current_club_id()`
// rimangono disabilitati e non eseguono query con club_id fittizio.
const club_state = {
  current_id: "",
};

export function set_current_club_id(id: string) {
  club_state.current_id = id ?? "";
}

export function get_current_club_id(): string {
  return club_state.current_id;
}
