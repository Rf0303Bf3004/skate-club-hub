import React, { createContext, useContext, useState } from 'react';

export type user_role = 'superadmin' | 'admin' | 'istruttore' | 'genitore';

interface auth_user {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: user_role;
  club_id: string;
}

interface AuthContextType {
  user: auth_user | null;
  login: (email: string, password: string) => void;
  logout: () => void;
  is_authenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  is_authenticated: false,
});

const DEMO_USER: auth_user = {
  id: 'usr_001',
  email: 'admin@demoskating.ch',
  nome: 'Admin',
  cognome: 'Demo',
  ruolo: 'admin',
  club_id: 'club_001',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, set_user] = useState<auth_user | null>(null);

  const login = (_email: string, _password: string) => {
    set_user(DEMO_USER);
  };

  const logout = () => {
    set_user(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, is_authenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
