import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, set_current_club_id } from "./supabase";

export interface UserSession {
  user_id: string;
  email: string;
  club_id: string;
  club_nome: string;
  ruolo: "superadmin" | "admin" | "staff";
  nome: string;
  cognome: string;
}

interface AuthContextType {
  session: UserSession | null;
  is_authenticated: boolean;
  is_loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  is_authenticated: false,
  is_loading: true,
  login: async () => {},
  logout: async () => {},
});

async function fetch_session(): Promise<UserSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: utente } = await supabase
    .from("utenti_club")
    .select("club_id, ruolo, nome, cognome, clubs(nome)")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!utente) return null;

  const club_id = utente.club_id;
  set_current_club_id(club_id);

  return {
    user_id: session.user.id,
    email: session.user.email || "",
    club_id,
    club_nome: (utente.clubs as any)?.nome || "",
    ruolo: utente.ruolo,
    nome: utente.nome || "",
    cognome: utente.cognome || "",
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, set_session] = useState<UserSession | null>(null);
  const [is_loading, set_is_loading] = useState(true);

  useEffect(() => {
    // Carica sessione iniziale
    fetch_session().then((s) => {
      set_session(s);
      set_is_loading(false);
    });

    // Ascolta cambiamenti auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        set_session(null);
        set_current_club_id("00000000-0000-0000-0000-000000000002");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const s = await fetch_session();
        set_session(s);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const s = await fetch_session();
    set_session(s);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    set_session(null);
    set_current_club_id("00000000-0000-0000-0000-000000000002");
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        is_authenticated: !!session,
        is_loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
