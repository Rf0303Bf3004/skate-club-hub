import React from "react";
import { supabase } from "@/lib/supabase";

/**
 * Sessione «pista»: il tablet di bordo ghiaccio entra con il codice del club.
 * Non ha riga in utenti_club, quindi non è una sessione amministrativa:
 * si riconosce solo dal gettone (app_metadata.role = 'pista').
 */
export interface StatoPista {
  is_pista: boolean;
  club_id: string | null;
  club_nome: string;
  is_loading: boolean;
}

export function usePistaSession(): StatoPista {
  const [stato, set_stato] = React.useState<StatoPista>({
    is_pista: false,
    club_id: null,
    club_nome: "",
    is_loading: true,
  });

  React.useEffect(() => {
    let vivo = true;

    const leggi = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!vivo) return;
      if (error) {
        // Non sappiamo: meglio non fingere che sia una sessione pista.
        set_stato({ is_pista: false, club_id: null, club_nome: "", is_loading: false });
        return;
      }
      const utente = data.session?.user;
      const meta = (utente?.app_metadata ?? {}) as Record<string, unknown>;
      const is_pista = meta.role === "pista";
      set_stato({
        is_pista,
        club_id: is_pista ? ((meta.club_id as string) ?? null) : null,
        club_nome: is_pista ? (((utente?.user_metadata as any)?.club_nome as string) ?? "") : "",
        is_loading: false,
      });
    };

    void leggi();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void leggi();
    });
    return () => {
      vivo = false;
      subscription.unsubscribe();
    };
  }, []);

  return stato;
}
