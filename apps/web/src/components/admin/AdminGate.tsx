"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminShell } from "@/components/admin/AdminShell";
import { clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-session";
import { api, type AuthResult } from "@/lib/api";
import { ErpRefreshProvider } from "@/lib/erp-refresh";
import type { User } from "@/types/product";

type State = { status: "checking" } | { status: "out" } | { status: "in"; user: User };

/**
 * Porta do painel. O admin só é alcançado digitando /admin no endereço do site (a loja não tem links para ele)
 * e usa uma sessão própria, guardada só na aba: abrir o painel numa aba nova sempre pede login, e a sessão de
 * cliente da loja nunca dá acesso a ele. A tela de entrada aparece no mesmo endereço.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "checking" });

  useEffect(() => {
    // Recarregar a página na mesma aba mantém a sessão; qualquer outra situação cai na tela de login.
    if (!getAdminToken()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sem token: nada a validar
      setState({ status: "out" });
      return;
    }
    api
      .adminMe()
      .then((user) => {
        if (user.role === "ADMIN" && (user.permissions?.length ?? 0) > 0) setState({ status: "in", user });
        else throw new Error("sem acesso");
      })
      .catch(() => {
        clearAdminToken();
        setState({ status: "out" });
      });
  }, []);

  if (state.status === "checking") {
    return (
      <div className="page">
        <p>Carregando…</p>
      </div>
    );
  }

  if (state.status === "out") {
    return (
      <AdminLogin
        onSignedIn={(result: AuthResult) => {
          setAdminToken(result.token);
          setState({ status: "in", user: result.user });
        }}
      />
    );
  }

  return (
    <AdminShell
      permissions={state.user.permissions ?? []}
      onSignOut={() => {
        clearAdminToken();
        setState({ status: "out" });
        router.push("/");
      }}
    >
      <ErpRefreshProvider>{children}</ErpRefreshProvider>
    </AdminShell>
  );
}
