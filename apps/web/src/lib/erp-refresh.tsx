"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ErpRefreshStatus } from "@/types/product";

const POLL_MS = 1500;

interface ErpRefreshContext {
  status: ErpRefreshStatus | null;
  /** Começa a atualização (ou, se já houver uma rodando, passa a acompanhar a dela). */
  start: () => Promise<void>;
  /** Avisa quando uma atualização acompanhada por esta aba termina (para recarregar listas). */
  onFinish: (listener: (status: ErpRefreshStatus) => void) => () => void;
}
const Ctx = createContext<ErpRefreshContext | null>(null);

export function useErpRefresh() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useErpRefresh fora do ErpRefreshProvider");
  return ctx;
}

/** Resumo de uma linha do resultado, usado no aviso de conclusão. */
export function refreshSummary(s: ErpRefreshStatus) {
  if (s.phase === "failed") return s.error ?? "A atualização falhou.";
  const r = s.report;
  if (!r) return "";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [plural(r.created.length, "produto novo", "produtos novos"), plural(r.updated.length, "alterado", "alterados"), plural(r.attention, "pendência", "pendências")].join(", ");
}

/**
 * Acompanha a atualização com o ERP no painel inteiro: lê o andamento ao abrir (a tarefa roda na API, então recarregar a
 * página não a interrompe), consulta a cada 1,5 s enquanto roda e, quando termina, mostra um aviso em qualquer tela do painel
 * (em Produtos, o resultado completo aparece na própria página).
 */
export function ErpRefreshProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<ErpRefreshStatus | null>(null);
  const [toast, setToast] = useState<ErpRefreshStatus | null>(null);
  const wasRunning = useRef(false);
  const listeners = useRef(new Set<(s: ErpRefreshStatus) => void>());

  const apply = useCallback((next: ErpRefreshStatus) => {
    if (wasRunning.current && !next.running) {
      setToast(next);
      for (const listener of listeners.current) listener(next);
    }
    wasRunning.current = next.running;
    setStatus(next);
  }, []);

  useEffect(() => {
    api.admin.erpRefreshStatus().then(apply, () => undefined);
  }, [apply]);

  const running = status?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => api.admin.erpRefreshStatus().then(apply, () => undefined), POLL_MS);
    return () => clearInterval(timer);
  }, [running, apply]);

  const start = useCallback(async () => {
    setToast(null);
    apply(await api.admin.refreshFromErp());
  }, [apply]);

  const onFinish = useCallback((listener: (s: ErpRefreshStatus) => void) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);

  const onProducts = pathname?.startsWith("/admin/produtos");
  return (
    <Ctx.Provider value={{ status, start, onFinish }}>
      {children}
      {toast && !onProducts && (
        <div className={`erp-toast${toast.phase === "failed" ? " is-error" : ""}`} role="status">
          <p>
            <strong>{toast.phase === "failed" ? "A atualização com o ERP falhou" : "Atualização com o ERP concluída"}</strong>
            <br />
            {refreshSummary(toast)}
          </p>
          <div className="erp-toast-actions">
            <Link href="/admin/produtos" onClick={() => setToast(null)}>Ver resultado</Link>
            <button type="button" className="link-btn" onClick={() => setToast(null)}>Fechar</button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
