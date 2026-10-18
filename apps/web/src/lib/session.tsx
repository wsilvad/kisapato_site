"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, TOKEN_KEY, type AuthResult } from "@/lib/api";
import type { User } from "@/types/product";

interface SessionValue {
  user: User | null;
  /** true enquanto o token salvo ainda está sendo validado. */
  loading: boolean;
  signIn: (result: AuthResult) => void;
  signOut: () => void;
  /** Troca os dados da conta em memória (depois de editar o perfil, por exemplo). */
  updateUser: (user: User) => void;
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
      .catch((err) => {
        // só uma sessão recusada pela API (401) apaga o token; queda de rede ou API reiniciando não desloga o cliente
        if (err instanceof ApiError && err.status === 401) window.localStorage.removeItem(TOKEN_KEY);
      })
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

  const updateUser = useCallback((next: User) => setUser(next), []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, updateUser }), [user, loading, signIn, signOut, updateUser]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fora do SessionProvider");
  return ctx;
}
