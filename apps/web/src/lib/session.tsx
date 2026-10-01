"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, TOKEN_KEY, type AuthResult } from "@/lib/api";
import type { User } from "@/types/product";

interface SessionValue {
  user: User | null;
  /** true enquanto o token salvo ainda está sendo validado. */
  loading: boolean;
  signIn: (result: AuthResult) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.localStorage.getItem(TOKEN_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sem token: nada a validar
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => window.localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(({ token, user }: AuthResult) => {
    window.localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fora do SessionProvider");
  return ctx;
}
