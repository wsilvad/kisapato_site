"use client";

import { useSyncExternalStore } from "react";

/** Resposta de GET /admin/uploads/queue. */
export interface UploadQueueStatus {
  processing: number;
  waiting: number;
  /** Fotos de outros envios que serão processadas antes das deste envio. */
  ahead: number;
  mine: number;
}

export interface UploadQueueNotice {
  /** Fotos de outros envios na frente (somadas, se houver mais de um envio em andamento aqui). */
  ahead: number;
  /** Fotos desta aba que ainda esperam. */
  mine: number;
}

const POLL_MS = 1000;
const EMPTY: UploadQueueNotice = { ahead: 0, mine: 0 };

const active = new Map<string, { status: UploadQueueStatus | null; total: number }>();
const listeners = new Set<() => void>();
let snapshot: UploadQueueNotice = EMPTY;

function publish() {
  let ahead = 0;
  let mine = 0;
  for (const { status, total } of active.values()) {
    ahead += status?.ahead ?? 0;
    mine += status ? status.mine || (status.ahead > 0 ? total : 0) : 0;
  }
  // só troca o objeto quando algo mudou (useSyncExternalStore compara por identidade)
  if (ahead !== snapshot.ahead || mine !== snapshot.mine) snapshot = ahead || mine ? { ahead, mine } : EMPTY;
  for (const listener of listeners) listener();
}

/**
 * Acompanha um envio de fotos enquanto ele roda: pergunta à API, a cada segundo, quantas fotos de outros envios estão na
 * frente das dele, para o painel avisar que existe uma fila. Devolve a função que encerra o acompanhamento.
 */
export function watchUploadQueue(id: string, total: number, fetchStatus: () => Promise<UploadQueueStatus>) {
  active.set(id, { status: null, total });
  let stopped = false;
  const poll = () =>
    fetchStatus().then(
      (status) => {
        if (stopped) return;
        active.set(id, { status, total });
        publish();
      },
      () => undefined, // a fila é só um aviso: falha de consulta não atrapalha o envio
    );
  void poll();
  const timer = setInterval(poll, POLL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
    active.delete(id);
    publish();
  };
}

export function useUploadQueueNotice(): UploadQueueNotice {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => snapshot,
    () => EMPTY,
  );
}
