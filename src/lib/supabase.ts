// Re-export del client Supabase managed da Lovable Cloud.
// NON istanziare un client diverso qui: il file src/integrations/supabase/client.ts
// è autogenerato e punta al backend reale del progetto.
import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Club di default: "Stella del Ghiaccio ASD" (unico club seed presente nel DB).
// In futuro il club può essere risolto dal profilo utente autenticato.
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
